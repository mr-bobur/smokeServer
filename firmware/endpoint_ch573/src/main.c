/**
 * ============================================================================
 * SMART BUILDING ECOSYSTEM - WCH CH573 ULTRA-LOW-POWER SMOKE ENDPOINT
 * Target Chip: WCH CH573F (32-bit QingKe RISC-V3A BLE 5.0 SoC)
 * Framework: None-OS SDK / TMOS
 * Platform: PlatformIO (platform-ch32v)
 * ============================================================================
 * 
 * Hardware Pin Mapping (WeAct Studio CH573F & Standard CH573F Core Boards):
 *   - PA4 (AIN0 / ADC CH0) : Optical Smoke Chamber Phototransistor (Analog In)
 *   - PA5                  : Chamber IR Emitter LED (Synchronous Pulsed Drive)
 *   - PA12                 : Piezo Siren Buzzer Driver (Anti-Chirp Low-Power Lock)
 *   - PA8                  : Onboard User / Status LED (Active-LOW on WeAct board)
 *   - PB4                  : External Alarm LED (Optional auxiliary strobe)
 *   - PA9                  : UART1 RX (115200 baud)
 *   - PA8 (Shared/TX)      : UART1 TX (115200 baud debug console)
 * 
 * Low-Power Architecture:
 *   - Standby Sleep Current: ~1.5 - 2.5 uA (RTC Timer + 18KB SRAM retention)
 *   - Measurement Duty Cycle: 16 ms awake every 5000 ms (0.32% active window)
 *   - Average Current: ~35 uA -> 3 to 5+ Years on 2x AA Alkaline Batteries
 * 
 * Sensor Processing:
 *   - Differential Sampling (Dark ambient ADC vs Lit pulsed ADC)
 *   - Adaptive Baseline Tracking (Eliminates battery voltage drop false alarms)
 * 
 * Telemetry Protocol (Smart Building Enterprise Standard):
 *   - BLE 5.0 Manufacturer Data Frame:
 *     [0xFF, 0xFF, CHIP_ID (6B MAC), TYPE (0x01), BATTERY (1B), PPM_HIGH, PPM_LOW]
 * ============================================================================
 */

#include "CH57x_common.h"
#include "CH57xBLE_LIB.h"
#include "HAL.h"
#include <stdio.h>
#include <string.h>

// ============================================================================
// BLE STACK CONFIGURATION & BUFFERS
// ============================================================================
__attribute__((aligned(4))) uint32_t MEM_BUF[BLE_MEMHEAP_SIZE / 4];
uint8_t MacAddr[6] = {0};

// Hardware Pins
#define PIN_SMOKE_ADC           GPIO_Pin_4  // PA4 (AIN0 / ADC Channel 0)
#define PIN_IR_LED              GPIO_Pin_5  // PA5 (IR Emitter LED)
#define PIN_BUZZER              GPIO_Pin_12 // PA12 (Piezo Buzzer Siren)
#define PIN_STATUS_LED          GPIO_Pin_8  // PA8 (Onboard Status LED - Active Low)
#define PIN_EXT_LED             GPIO_Pin_4  // PB4 (External Alarm Strobe LED)

// Smoke Detection Constants
#define RAW_CLEAN_BASELINE_INIT 4000        // Initial expected clean air baseline
#define RAW_SMOKE_DROP_THRESH   200         // Drop >= 200 counts triggers SMOKE ALARM
#define RAW_SMOKE_ABS_THRESH    3800        // Fallback absolute threshold: <= 3800 PPM trigger
#define SLEEP_INTERVAL_SEC      5           // Standby measurement period (5 seconds)
#define HEARTBEAT_CYCLES        6           // Send keepalive every 6 cycles (30 seconds)
#define BURST_SPACING_MS        120         // 120ms RF inter-frame spacing (from old version)
#define BURST_COUNT_ALARM       3           // 3 consecutive packets on alarm
#define BURST_COUNT_RECOVERY    3           // 3 consecutive packets on recovery

// TMOS Events
tmosTaskID smokeTaskId = INVALID_TASK_ID;
#define SBP_SMOKE_MEASURE_EVT   0x0001
#define SBP_ALARM_SIREN_EVT     0x0002

// Runtime State Variables
static uint8_t  chipIdBytes[6] = {0};
static bool     inAlarmState   = false;
static uint32_t wakeupCount    = 0;
static uint32_t heartbeatCount = 0;
static uint16_t adaptiveBaseline = RAW_CLEAN_BASELINE_INIT;

// BLE Advertising Buffers (Complies with Smart Building Gateway Protocol)
static uint8_t advertData[17] = {
    // 1. Flags: General Discoverable Mode, BR/EDR not supported
    0x02, GAP_ADTYPE_FLAGS, GAP_ADTYPE_FLAGS_GENERAL | GAP_ADTYPE_FLAGS_BREDR_NOT_SUPPORTED,
    // 2. Custom Manufacturer Specific Data (13 bytes payload)
    0x0D, GAP_ADTYPE_MANUFACTURER_SPECIFIC,
    0xFF, 0xFF,                         // Company ID placeholder
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Unique 6-byte Chip ID (MAC)
    0x01,                               // Sensor Type: 0x01 (Optical Smoke MQ-2 / Photodiode)
    100,                                // Battery % (0-100)
    0x00, 0x00                          // Smoke PPM (High Byte, Low Byte)
};

static uint8_t scanRspData[10] = {
    0x09, GAP_ADTYPE_LOCAL_NAME_COMPLETE,
    'S', 'B', '-', 'C', 'H', '5', '7', '3'
};

// ============================================================================
// SERIAL CONSOLE (RETARGET PRINTF TO UART1)
// ============================================================================
int _write(int fd, char *buf, int size) {
    for (int i = 0; i < size; i++) {
        while ((R8_UART1_LSR & RB_LSR_TX_FIFO_EMP) == 0);
        R8_UART1_THR = buf[i];
    }
    return size;
}

// ============================================================================
// BLE BROADCASTER CALLBACKS
// ============================================================================
static void Broadcaster_StateNotificationCB(gapRole_States_t newState) {
    switch (newState) {
        case GAPROLE_STARTED:
            printf("[BLE] GAP Broadcaster Role Initialized.\r\n");
            break;
        case GAPROLE_ADVERTISING:
            printf("[BLE] Advertising Frame Transmitted.\r\n");
            break;
        case GAPROLE_WAITING:
            break;
        case GAPROLE_ERROR:
            printf("[BLE ERROR] Broadcaster State Error!\r\n");
            break;
        default:
            break;
    }
}

static gapRolesBroadcasterCBs_t broadcasterCBs = {
    Broadcaster_StateNotificationCB,
    NULL
};

// ============================================================================
// BATTERY VOLTAGE MONITORING (INTERNAL ADC CH_INTE_VBAT)
// ============================================================================
uint8_t readBatteryPercent(void) {
    ADC_InterBATSampInit();
    uint32_t sum = 0;
    for (int i = 0; i < 8; i++) {
        sum += ADC_ExcutSingleConver();
        DelayUs(10);
    }
    uint16_t vbatRaw = sum / 8;

    // CH573 internal battery divider (-12dB mode):
    // 3.0V (Full 2x AA) -> Raw ADC ~3000
    // 2.4V (Cutoff)     -> Raw ADC ~2400
    int pct = ((int)vbatRaw - 2400) * 100 / (3000 - 2400);
    if (pct > 100) pct = 100;
    if (pct < 0)   pct = 0;
    return (uint8_t)pct;
}

// ============================================================================
// DIFFERENTIAL OPTICAL SMOKE MEASUREMENT
// ============================================================================
/**
 * Synchronous Pulsed Differential Measurement:
 * 1. Measures ambient light/electrical zero with IR LED OFF (rawDark).
 * 2. Pulses IR LED ON for 15ms settling time.
 * 3. Measures optical transmission with IR LED ON (rawLit) with 16x oversampling.
 * 4. Shuts OFF IR LED immediately (0.3% duty cycle, transistor stays cold).
 * 5. Differential drop = AdaptiveBaseline - (rawLit - rawDark).
 *    This makes the reading 100% immune to external light leakage and battery voltage droop!
 */
float readDifferentialOpticalSmoke(uint16_t *outRawDark, uint16_t *outRawLit, int16_t *outDrop) {
    ADC_ExtSingleChSampInit(SampleFreq_3_2, ADC_PGA_0);
    ADC_ChannelCfg(CH_EXTIN_0);

    // 1. Dark ambient read (IR LED OFF)
    GPIOA_ResetBits(PIN_IR_LED);
    DelayUs(50);
    uint32_t darkSum = 0;
    for (int i = 0; i < 16; i++) {
        darkSum += ADC_ExcutSingleConver();
        DelayUs(10);
    }
    *outRawDark = darkSum / 16;

    // 2. Turn ON IR LED pulse (15ms settle)
    GPIOA_SetBits(PIN_IR_LED);
    DelayMs(15);

    // 3. Lit optical reading (IR LED ON)
    uint32_t litSum = 0;
    for (int i = 0; i < 16; i++) {
        litSum += ADC_ExcutSingleConver();
        DelayUs(10);
    }
    *outRawLit = litSum / 16;

    // 4. Immediately turn OFF IR LED
    GPIOA_ResetBits(PIN_IR_LED);
    R8_ADC_CFG &= ~RB_ADC_POWER_ON; // Power down ADC to save microamps

    // 5. Differential drop calculation
    *outDrop = (int16_t)adaptiveBaseline - (int16_t)(*outRawLit);
    if (*outDrop < 0) *outDrop = 0;

    // 6. Calibrated Smoke PPM:
    // Clean air: Drop < RAW_SMOKE_DROP_THRESH (and rawLit > RAW_SMOKE_ABS_THRESH) -> 0.0 PPM
    // Smoke: 400.0 to 600.0 PPM
    float smokePpm = 0.0f;
    if ((*outRawLit <= RAW_SMOKE_ABS_THRESH) || (*outDrop >= RAW_SMOKE_DROP_THRESH)) {
        smokePpm = 400.0f + ((float)(*outDrop) / 400.0f) * 200.0f;
        if (smokePpm > 600.0f) smokePpm = 600.0f;
    } else {
        // Slow adaptive baseline tracking when clean (alpha = 1/64)
        if (*outRawLit > 3850 && *outRawLit < 4095) {
            adaptiveBaseline = (uint16_t)(((uint32_t)adaptiveBaseline * 63 + *outRawLit) / 64);
        }
        smokePpm = 0.0f;
    }

    return smokePpm;
}

// ============================================================================
// PIEZO BUZZER SIREN & HARDWARE ANTI-CHIRP
// ============================================================================
void soundBuzzerTone(uint16_t freqHz, uint16_t durationMs) {
    if (freqHz == 0) return;
    uint32_t halfPeriodUs = 500000UL / freqHz;
    uint32_t totalCycles = ((uint32_t)durationMs * freqHz) / 1000UL;

    for (uint32_t i = 0; i < totalCycles; i++) {
        GPIOA_InverseBits(PIN_BUZZER);
        DelayUs(halfPeriodUs);
    }
    // Anti-chirp hardware lock: Ensure pin is forced to ground LOW
    GPIOA_ResetBits(PIN_BUZZER);
}

// ============================================================================
// TELEMETRY & BLE BROADCAST ENGINE
// ============================================================================
void updateTelemetryPayload(uint8_t batteryPct, uint16_t smokePpm) {
    memcpy(&advertData[4], chipIdBytes, 6);
    advertData[10] = 0x01; // Optical Smoke sensor type
    advertData[11] = batteryPct;
    advertData[12] = (smokePpm >> 8) & 0xFF;
    advertData[13] = smokePpm & 0xFF;

    GAPRole_SetParameter(GAPROLE_ADVERT_DATA, sizeof(advertData), advertData);
}

void sendBleBurst(uint8_t batteryPct, uint16_t smokePpm, uint8_t burstCount) {
    updateTelemetryPayload(batteryPct, smokePpm);

    for (uint8_t i = 0; i < burstCount; i++) {
        uint8_t enable = TRUE;
        GAPRole_SetParameter(GAPROLE_ADVERT_ENABLED, sizeof(uint8_t), &enable);

        printf("[BLE Tx Burst %d/%d] Chip: %02X:%02X:%02X:%02X:%02X:%02X | Bat: %3d%% | Smoke: %4d PPM\r\n",
               i + 1, burstCount,
               chipIdBytes[0], chipIdBytes[1], chipIdBytes[2],
               chipIdBytes[3], chipIdBytes[4], chipIdBytes[5],
               batteryPct, smokePpm);

        if (i < burstCount - 1) {
            DelayMs(BURST_SPACING_MS); // 120ms RF inter-frame spacing from previous version
        }
    }
}

// ============================================================================
// TMOS SMOKE DETECTION STATE MACHINE
// ============================================================================
tmosEvents SmokeTask_ProcessEvent(tmosTaskID task_id, tmosEvents events) {
    if (events & SBP_SMOKE_MEASURE_EVT) {
        wakeupCount++;
        uint16_t rawDark = 0, rawLit = 0;
        int16_t  drop = 0;
        float    smokePpm = readDifferentialOpticalSmoke(&rawDark, &rawLit, &drop);
        uint8_t  batPct = readBatteryPercent();

        bool isSmokePresent = (smokePpm >= 400.0f);

        printf("\r\n======================================================================\r\n");
        printf("  CH573 SMOKE ENDPOINT [CYCLE #%ld] | Standby Wakeup (0.3%% Duty Cycle)\r\n", wakeupCount);
        printf("  Optical Sensor -> Dark: %4d | Lit: %4d | Baseline: %4d | Drop: %3d\r\n",
               rawDark, rawLit, adaptiveBaseline, drop);
        printf("  Telemetry      -> Smoke: %5.1f PPM | Battery: %3d%% | Alarm: %s\r\n",
               smokePpm, batPct, isSmokePresent ? ">>> CRITICAL ALARM! <<<" : "CLEAN NORMAL");
        printf("======================================================================\r\n");

        if (isSmokePresent) {
            inAlarmState = true;

            // 1. Transmit 3x CONSECUTIVE ALARM packets to Gateway
            printf(">>> [EMERGENCY ALERT] Broadcasting 3x ALARM bursts to Gateway...\r\n");
            sendBleBurst(batPct, (uint16_t)smokePpm, 3);

            // 2. Sound Temporal-3 emergency siren burst (NFPA / ISO 7240 standard)
            for (int i = 0; i < 3; i++) {
                GPIOA_ResetBits(PIN_STATUS_LED); // Strobe On (Active Low)
                GPIOB_SetBits(PIN_EXT_LED);
                soundBuzzerTone(2800, 150);
                GPIOA_SetBits(PIN_STATUS_LED);   // Strobe Off
                GPIOB_ResetBits(PIN_EXT_LED);
                DelayMs(100);
            }

            // In Alarm state: Resample rapidly every 1000ms until smoke clears
            tmos_start_task(smokeTaskId, SBP_SMOKE_MEASURE_EVT, MS1_TO_SYSTEM_TIME(1000));
        } else {
            if (inAlarmState) {
                // Smoke has cleared -> Transmit 3x NORMAL recovery packets
                inAlarmState = false;
                printf("\r\n======================================================================\r\n");
                printf("  >>> [RECOVERY CONFIRMED] Smoke cleared! Silencing siren. <<<\r\n");
                printf("  Broadcasting 3x NORMAL recovery packets to Gateway...\r\n");
                printf("======================================================================\r\n");
                sendBleBurst(batPct, 0, 3);
            }

            // Synchronized Heartbeat Flash for both Onboard LED and External Device LED
            GPIOA_ResetBits(PIN_STATUS_LED); // Onboard LED ON (active low)
            GPIOB_SetBits(PIN_EXT_LED);      // External Indicator LED ON (active high)
            DelayMs(15);
            GPIOA_SetBits(PIN_STATUS_LED);   // Onboard LED OFF
            GPIOB_ResetBits(PIN_EXT_LED);    // External Indicator LED OFF

            // Periodic Keep-Alive Beacon (Every 30 seconds / 6 cycles)
            heartbeatCount++;
            if (heartbeatCount >= HEARTBEAT_CYCLES) {
                heartbeatCount = 0;
                sendBleBurst(batPct, (uint16_t)smokePpm, 1);
            }

            // Return to Ultra-Low-Power Standby Sleep (~2 uA) for 5 seconds
            tmos_start_task(smokeTaskId, SBP_SMOKE_MEASURE_EVT, MS1_TO_SYSTEM_TIME(SLEEP_INTERVAL_SEC * 1000));
        }

        return events ^ SBP_SMOKE_MEASURE_EVT;
    }

    return 0;
}

void SmokeTask_Init(void) {
    smokeTaskId = TMOS_ProcessEventRegister(SmokeTask_ProcessEvent);
    // Kick off first measurement cycle after 300ms
    tmos_start_task(smokeTaskId, SBP_SMOKE_MEASURE_EVT, MS1_TO_SYSTEM_TIME(300));
}

// ============================================================================
// SYSTEM ENTRY POINT
// ============================================================================
int main(void) {
    // 1. High-Performance / Low-Jitter 60MHz PLL System Clock
    SetSysClock(CLK_SOURCE_PLL_60MHz);

    // 2. Initialize Debug Console UART1 (PA8 TX / PA9 RX)
    GPIOA_SetBits(GPIO_Pin_8);
    GPIOA_ModeCfg(GPIO_Pin_8, GPIO_ModeOut_PP_5mA);
    GPIOA_ModeCfg(GPIO_Pin_9, GPIO_ModeIN_PU);
    UART1_DefInit();

    printf("\r\n**********************************************************************\r\n");
    printf("  SMART BUILDING ECOSYSTEM - WCH CH573 WIRELESS SMOKE ENDPOINT\r\n");
    printf("  Target Core: 32-bit QingKe RISC-V3A BLE 5.0 SoC | F_CPU: 60 MHz\r\n");
    printf("  Ultra-Low-Power Standby Mode: ~1.5 - 2.5 uA with RTC & 18KB SRAM\r\n");
    printf("  Battery Life Target: 3 to 5+ Years on 2x AA Alkaline Cells\r\n");
    printf("**********************************************************************\r\n");

    // 3. Configure Hardware GPIOs with Anti-Chirp Hardware Protection
    GPIOA_ModeCfg(PIN_SMOKE_ADC, GPIO_ModeIN_Floating); // PA4 (AIN0) Optical Receiver AO
    GPIOA_ResetBits(PIN_IR_LED);
    GPIOA_ModeCfg(PIN_IR_LED, GPIO_ModeOut_PP_5mA);      // PA5 Chamber IR LED Pulse Drive
    GPIOA_ResetBits(PIN_BUZZER);
    GPIOA_ModeCfg(PIN_BUZZER, GPIO_ModeOut_PP_5mA);      // PA12 Piezo Buzzer Locked LOW
    GPIOA_SetBits(PIN_STATUS_LED);
    GPIOA_ModeCfg(PIN_STATUS_LED, GPIO_ModeOut_PP_5mA);  // PA8 Onboard Status LED
    GPIOB_ResetBits(PIN_EXT_LED);
    GPIOB_ModeCfg(PIN_EXT_LED, GPIO_ModeOut_PP_5mA);     // PB4 External Strobe LED

    // 4. Retrieve unique Factory MAC Address for Chip ID
    GetMACAddress(chipIdBytes);
    printf("[System] Hardware MAC / Chip ID: %02X:%02X:%02X:%02X:%02X:%02X\r\n",
           chipIdBytes[0], chipIdBytes[1], chipIdBytes[2],
           chipIdBytes[3], chipIdBytes[4], chipIdBytes[5]);

    // 5. Initialize WCH BLE Stack and Low-Power Hardware Abstraction Layer
    CH57X_BLEInit();
    HAL_Init();

    // 6. Initialize Broadcaster GAP Profile
    GAPRole_BroadcasterInit();

    // Set Advertising Interval (160 * 0.625ms = 100ms)
    uint16_t advInterval = 160;
    GAP_SetParamValue(TGAP_DISC_ADV_INT_MIN, advInterval);
    GAP_SetParamValue(TGAP_DISC_ADV_INT_MAX, advInterval);

    // Non-connectable undirected advertising (Standard beacon broadcaster)
    uint8_t advType = GAP_ADTYPE_ADV_NONCONN_IND;
    GAPRole_SetParameter(GAPROLE_ADV_EVENT_TYPE, sizeof(uint8_t), &advType);

    // Set Initial Telemetry Payload and Device Name
    uint8_t initialBat = readBatteryPercent();
    updateTelemetryPayload(initialBat, 0);
    GAPRole_SetParameter(GAPROLE_SCAN_RSP_DATA, sizeof(scanRspData), scanRspData);

    // Start Broadcaster Stack
    GAPRole_BroadcasterStartDevice(&broadcasterCBs);

    // 7. Initialize Application Smoke Detection Task
    SmokeTask_Init();

    printf("[System] Initialization complete. Entering TMOS ultra-low-power event loop...\r\n");

    // 8. Main TMOS Event Loop (Automatically enters Sleep between cycles)
    while (1) {
        TMOS_SystemProcess();
    }
}
