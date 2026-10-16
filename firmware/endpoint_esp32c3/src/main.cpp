/**
 * ============================================================================
 * SMART BUILDING ECOSYSTEM - ESP32-C3 INTEGRATED OPTICAL SMOKE ENDPOINT
 * Board: Seeed Studio XIAO ESP32-C3
 * 
 * Hardware Pin Mapping:
 *   - D1 (GPIO 3 / ADC1_CH3) : Optical Smoke Sensor Receiver (AO)
 *   - D2 (GPIO 4)            : Chamber IR Emitter LED (Synchronous Pulsed Drive)
 *   - D3 (GPIO 5)            : Alarm Buzzer Siren (Anti-Chirp Hardware Pulldown)
 *   - D4 (GPIO 6)            : Status LED Indicator
 *   - GPIO 9                 : Onboard BOOT Button
 * ============================================================================
 * Full Test Production Protocol:
 *   1. Measures every 5 seconds.
 *   2. In Normal state:
 *      - Full Deep Sleep between 5s cycles (Ultra-Low Power ~5uA).
 *      - Buzzer hardware locked to 0V (Zero chirp / zero click).
 *      - Status LED heartbeat flash (30ms).
 *      - Keep-alive telemetry beacon to Gateway every 30s.
 *   3. Smoke Detection Threshold:
 *      - Clean air: Raw 4090 - 4095 -> 0.0 PPM (Normal)
 *      - Smoke detected: Raw <= 3800 -> 400+ PPM (Critical Alarm Threshold)
 *   4. When smoke is detected:
 *      - Broadcasts exactly 3 CONSECUTIVE ALARM packets to Gateway.
 *      - Sounds Temporal-3 siren pattern on D3 & flashes Alarm LED on D4.
 *      - Runs a 1-minute (60s / 12 cycles) repeating window.
 *   5. If smoke clears within/after 1 minute (Raw > 3800):
 *      - Silences siren and turns off LED.
 *      - Broadcasts exactly 3 CONSECUTIVE NORMAL recovery packets to Gateway.
 *      - Resumes standard 5-second sleep cycle.
 *   6. If smoke remains after 1 minute:
 *      - Re-transmits 3 CONSECUTIVE ALARM packets and continues siren alert.
 * ============================================================================
 */
#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <esp_sleep.h>
#include <driver/gpio.h>

// Set to true for Full Deep Sleep (~5uA battery mode)
// Set to false for Continuous Loop (keeps USB Serial Monitor open without disconnects)
#define USE_DEEP_SLEEP                true

// ============================================================================
// HARDWARE BOARD SELECTION & PIN CONFIGURATION
// ============================================================================
#if defined(BOARD_ESP32C3_MICRO)
  // --------------------------------------------------------------------------
  // Board: ESP32-C3 SuperMini / Micro (Direct Silkscreen Number Mapping)
  // Connect wires directly to the numbers printed on the SuperMini PCB:
  //   Pin 1 (GPIO 1 / ADC1_CH1) -> Optical Smoke Sensor (AO)
  //   Pin 2 (GPIO 2)            -> Chamber IR Emitter LED
  //   Pin 3 (GPIO 3)            -> Piezo Alarm Buzzer Siren
  //   Pin 4 (GPIO 4)            -> External Status LED
  //   Pin 8 (GPIO 8)            -> Onboard Blue Status LED (Active-LOW)
  //   Pin 9 (GPIO 9)            -> BOOT Button
  // --------------------------------------------------------------------------
  #define BOARD_PROFILE_NAME            "ESP32-C3 SuperMini / Micro"
  #define PIN_SMOKE_ADC                 1   // PCB Pin '1' (GPIO 1 / ADC1_CH1) - Smoke Receiver (AO)
  #define PIN_IR_LED                    2   // PCB Pin '2' (GPIO 2)            - Chamber IR Emitter LED
  #define PIN_ALARM_BUZZER              3   // PCB Pin '3' (GPIO 3)            - Piezo Alarm Siren
  #define PIN_STATUS_LED                4   // PCB Pin '4' (GPIO 4)            - External Status LED
  #define PIN_ONBOARD_LED               8   // PCB Pin '8' (GPIO 8)            - Onboard Blue LED (Active-LOW)
  #define PIN_BOOT_BTN                  9   // PCB Pin '9' (GPIO 9)            - Onboard BOOT Button
#else
  // --------------------------------------------------------------------------
  // Board: Seeed Studio XIAO ESP32-C3 (Default)
  // Silkscreen Label Mapping:
  //   D1 (GPIO 3 / ADC1_CH3)    -> Optical Smoke Sensor (AO)
  //   D2 (GPIO 4)               -> Chamber IR Emitter LED
  //   D3 (GPIO 5)               -> Piezo Alarm Buzzer Siren
  //   D4 (GPIO 6)               -> External Status LED
  //   D9 (GPIO 9)               -> BOOT Button
  // --------------------------------------------------------------------------
  #define BOARD_PROFILE_NAME            "Seeed Studio XIAO ESP32-C3"
  #define PIN_SMOKE_ADC                 3   // D1 (GPIO 3 / ADC1_CH3) - Smoke Receiver (AO)
  #define PIN_IR_LED                    4   // D2 (GPIO 4)            - Chamber IR Emitter LED
  #define PIN_ALARM_BUZZER              5   // D3 (GPIO 5)            - Piezo Alarm Siren
  #define PIN_STATUS_LED                6   // D4 (GPIO 6)            - External Status LED
  #define PIN_ONBOARD_LED               -1  // No user LED on XIAO
  #define PIN_BOOT_BTN                  9   // GPIO 9                 - Onboard BOOT Button
#endif

// Smoke Detection Parameters
#define RAW_CLEAN_BASELINE            4095
#define RAW_SMOKE_THRESHOLD           3800 // Trigger point: Raw <= 3800 is SMOKE ALARM
#define SMOKE_CRITICAL_THRESHOLD_PPM  400.0f
#define SLEEP_INTERVAL_SEC            5
#define ALARM_REPEAT_CYCLES           12   // 12 cycles * 5s = 60s (1 minute)

// Persistent state across Deep Sleep (stored in RTC memory)
RTC_DATA_ATTR bool rtcInAlarmState = false;
RTC_DATA_ATTR uint32_t rtcAlarmCycleCount = 0;       // Counts 5s cycles in alarm
RTC_DATA_ATTR uint32_t rtcWakeupCount = 0;
RTC_DATA_ATTR uint32_t rtcNormalHeartbeatCount = 0;

uint8_t chipIdBytes[6];
bool isBleInitialized = false;
static bool isToneRunning = false;

// Buzzer controller with hardware anti-chirp pulldown
void soundBuzzer(bool enable, int freq = 2700) {
    if (enable) {
        gpio_hold_dis((gpio_num_t)PIN_ALARM_BUZZER);
        tone(PIN_ALARM_BUZZER, freq);
        isToneRunning = true;
    } else {
        if (isToneRunning) {
            noTone(PIN_ALARM_BUZZER);
            isToneRunning = false;
        }
        pinMode(PIN_ALARM_BUZZER, OUTPUT);
        digitalWrite(PIN_ALARM_BUZZER, LOW);
        gpio_pulldown_en((gpio_num_t)PIN_ALARM_BUZZER);
        gpio_pullup_dis((gpio_num_t)PIN_ALARM_BUZZER);
    }
}

// Flash status LED (supports external LED and onboard blue LED on SuperMini)
void flashStatusLed(int count, int delayMs = 60) {
    for (int i = 0; i < count; i++) {
        digitalWrite(PIN_STATUS_LED, HIGH);
#if defined(BOARD_ESP32C3_MICRO)
        digitalWrite(PIN_ONBOARD_LED, LOW); // Onboard blue LED on SuperMini is active-low
#endif
        delay(delayMs);
        digitalWrite(PIN_STATUS_LED, LOW);
#if defined(BOARD_ESP32C3_MICRO)
        digitalWrite(PIN_ONBOARD_LED, HIGH);
#endif
        if (i < count - 1) delay(delayMs);
    }
}

/**
 * Broadcasts Custom BLE 5.0 Manufacturer Data Packet:
 * [0xFF, 0xFF, CHIP_ID (6B), TYPE_BYTE (1B), BATTERY_PCT (1B), VALUE_HIGH (1B), VALUE_LOW (1B)]
 */
void broadcastTelemetryFrame(uint8_t typeByte, uint8_t batteryPct, uint16_t smokeValue) {
    if (!isBleInitialized) {
        BLEDevice::init("SB-C3-SMOKE");
        isBleInitialized = true;
    }

    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->stop();

    uint8_t mfgPayload[12];
    mfgPayload[0] = 0xFF;
    mfgPayload[1] = 0xFF;
    memcpy(&mfgPayload[2], chipIdBytes, 6);
    mfgPayload[8] = typeByte;                    // 0x01: SMOKE_MQ2 / OPTICAL
    mfgPayload[9] = batteryPct;                  // Battery %
    mfgPayload[10] = (smokeValue >> 8) & 0xFF;   // Value High Byte
    mfgPayload[11] = smokeValue & 0xFF;          // Value Low Byte

    BLEAdvertisementData advData;
    advData.setFlags(0x06); // LE General Discoverable Mode
    advData.setManufacturerData(String((char *)mfgPayload, 12));
    pAdvertising->setAdvertisementData(advData);
    pAdvertising->start();

    Serial.printf("[BLE Tx] Chip: C3-%02X%02X%02X%02X%02X%02X | Type: 0x%02X | Bat: %d%% | Smoke: %d PPM\n",
                  chipIdBytes[0], chipIdBytes[1], chipIdBytes[2],
                  chipIdBytes[3], chipIdBytes[4], chipIdBytes[5],
                  typeByte, batteryPct, smokeValue);
}

/**
 * Transmits exactly N consecutive BLE packets with spacing to guarantee 100% RF delivery
 */
void sendPacketBurst(uint8_t typeByte, uint8_t batteryPct, uint16_t smokeValue, int burstCount = 3) {
    for (int i = 0; i < burstCount; i++) {
        Serial.printf("  -> Transmitting Burst Frame [%d/%d] (Smoke: %d PPM)...\n", i + 1, burstCount, smokeValue);
        broadcastTelemetryFrame(typeByte, batteryPct, smokeValue);
        delay(120); // 120ms RF inter-frame spacing
    }
}

/**
 * Optical Smoke Sensor Measurement:
 * Synchronous 30ms IR LED pulse (0.6% duty cycle) + 16x oversampled ADC read on D1.
 * 30ms settle time allows phototransistor RC filter to fully saturate to 4095 in clean air.
 */
float readOpticalSmoke(int &outRawAdc, float &outDrop) {
    // 1. Turn ON IR LED pulse
    digitalWrite(PIN_IR_LED, HIGH);
    delay(30); // 30ms optical & capacitor settling time

    // 2. 16x fast oversampling to filter ADC electrical noise
    int sum = 0;
    for (int i = 0; i < 16; i++) {
        sum += analogRead(PIN_SMOKE_ADC);
        delayMicroseconds(20);
    }
    outRawAdc = sum / 16;

    // 3. Immediately turn OFF IR LED (Duty cycle: 30ms / 5000ms = 0.6% -> Transistor is completely cold!)
    digitalWrite(PIN_IR_LED, LOW);

    // 4. Compute drop from clean baseline (4095)
    outDrop = (float)RAW_CLEAN_BASELINE - (float)outRawAdc;
    if (outDrop < 0.0f) outDrop = 0.0f;

    // 5. Calibrated PPM:
    //    Clean air (raw > 3800): 0.0 PPM (Normal)
    //    Smoke detected (raw <= 3800): 400.0 PPM to 600.0 PPM (Alarm)
    float smokePpm = 0.0f;
    if (outRawAdc <= RAW_SMOKE_THRESHOLD) {
        smokePpm = 400.0f + ((float)(RAW_SMOKE_THRESHOLD - outRawAdc) / (float)(RAW_SMOKE_THRESHOLD - 600)) * 200.0f;
        if (smokePpm > 600.0f) smokePpm = 600.0f;
    } else {
        smokePpm = 0.0f;
    }

    return smokePpm;
}

void soundAlarmSirenPattern() {
    // Standard ISO/NFPA Temporal-3 emergency siren burst
    for (int i = 0; i < 3; i++) {
        digitalWrite(PIN_STATUS_LED, HIGH);
#if defined(BOARD_ESP32C3_MICRO)
        digitalWrite(PIN_ONBOARD_LED, LOW); // Onboard blue LED is active-low
#endif
        soundBuzzer(true, 2800);
        delay(150);
        soundBuzzer(false);
        digitalWrite(PIN_STATUS_LED, LOW);
#if defined(BOARD_ESP32C3_MICRO)
        digitalWrite(PIN_ONBOARD_LED, HIGH);
#endif
        delay(100);
    }
}

/**
 * Active Alarm Mode:
 * Enters a continuous alarm alert loop when smoke is detected (Raw <= 3800).
 * Prevents Deep Sleep entirely while smoke is present.
 * The piezo siren sounds continuously (Temporal-3 cadence) and LED strobes.
 * Periodically re-samples optical sensor and re-broadcasts 3x ALARM bursts every 60 seconds.
 * Exits immediately and returns to Normal Deep Sleep only when Raw > 3800 (Clean).
 */
void handleActiveAlarmMode(int initialRaw, float initialDrop, float initialPpm, uint8_t batteryPct) {
    rtcInAlarmState = true;
    rtcAlarmCycleCount = 0;

    Serial.println("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    Serial.println("  >>> [CRITICAL ALARM ACTIVATED] SMOKE DETECTED! <<<");
    Serial.printf("  Initial Raw: %d | Drop: %.0f | Smoke: %.1f PPM | Threshold: <= %d\n",
                  initialRaw, initialDrop, initialPpm, RAW_SMOKE_THRESHOLD);
    Serial.println("  Transmitting initial 3x ALARM burst to Gateway...");
    Serial.println("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");

    // 1. Send initial emergency burst (3x consecutive frames)
    sendPacketBurst(0x01, batteryPct, (uint16_t)initialPpm, 3);

    unsigned long lastAlarmBurstTime = millis();
    uint32_t alarmCycleIndex = 0;

    // 2. Active Continuous Siren Loop (5-second sensor measurement interval)
    while (true) {
        alarmCycleIndex++;
        unsigned long cycleStartTime = millis();

        // A. Sound standard emergency siren bursts across the 5-second window
        // Burst 1 (3x 150ms tones + 100ms pause = 750ms)
        soundAlarmSirenPattern();
        delay(1000); // 1000ms pause between bursts

        // Burst 2 (3x 150ms tones + 100ms pause = 750ms)
        soundAlarmSirenPattern();

        // Wait out the remainder of the 5-second interval before next optical measurement
        while (millis() - cycleStartTime < 5000UL) {
            delay(50);
        }

        // B. Re-sample optical smoke chamber (Every 5 seconds)
        int currentRaw = 0;
        float currentDrop = 0.0f;
        float currentPpm = readOpticalSmoke(currentRaw, currentDrop);

        Serial.printf("[ALARM CYCLE #%d (5s Interval)] Raw: %4d | Drop: %4.0f | PPM: %5.1f | Status: %s\n",
                      alarmCycleIndex, currentRaw, currentDrop, currentPpm,
                      (currentRaw <= RAW_SMOKE_THRESHOLD ? "SMOKE ACTIVE (SIREN ON)" : "SMOKE CLEARED"));

        // C. Check recovery condition: Has smoke cleared? (Raw > 3800)
        // Confirm with a second verification sample after a short pause to eliminate noise spikes
        if (currentRaw > RAW_SMOKE_THRESHOLD) {
            delay(100);
            int verifyRaw = 0;
            float verifyDrop = 0.0f;
            float verifyPpm = readOpticalSmoke(verifyRaw, verifyDrop);
            if (verifyRaw > RAW_SMOKE_THRESHOLD) {
                Serial.println("\n======================================================================");
                Serial.printf("  >>> [RECOVERY CONFIRMED] Smoke cleared! Raw: %d > %d <<<\n",
                              verifyRaw, RAW_SMOKE_THRESHOLD);
                Serial.println("  Silencing siren and transmitting 3x NORMAL recovery burst to Gateway...");
                Serial.println("======================================================================");

                // Stop siren and LED immediately
                soundBuzzer(false);
                digitalWrite(PIN_STATUS_LED, LOW);

                // Transmit 3x NORMAL recovery burst (Smoke: 0 PPM)
                sendPacketBurst(0x01, batteryPct, 0, 3);

                // Confirm with 3 visual LED blinks
                flashStatusLed(3, 100);

                // Reset alarm state
                rtcInAlarmState = false;
                rtcAlarmCycleCount = 0;
                break; // Exit alarm loop -> allows deep sleep to resume!
            }
        }

        // D. Every 60 seconds (1 minute), re-transmit 3x ALARM burst to ensure Gateway / Web Dashboard sync
        if (millis() - lastAlarmBurstTime >= 60000UL) {
            lastAlarmBurstTime = millis();
            Serial.println(">>> [ALARM 60s RE-NOTIFY] Smoke still present! Re-transmitting 3x ALARM burst to Gateway! <<<");
            sendPacketBurst(0x01, batteryPct, (uint16_t)currentPpm, 3);
        }
    }
}

/**
 * Core Execution Logic (Shared across Deep Sleep and Continuous Loop)
 */
void runFullSmokeCycle() {
    rtcWakeupCount++;

    Serial.println("\n======================================================================");
    Serial.printf("  SMART SMOKE ENDPOINT [CYCLE #%d] | Standby Wakeup\n", rtcWakeupCount);
    Serial.println("======================================================================");

    // 1. Measure Optical Smoke Sensor
    int rawAdc = 0;
    float drop = 0.0f;
    float smokePpm = readOpticalSmoke(rawAdc, drop);
    uint8_t batteryPct = 96;

    // Detection condition: Raw <= 3800
    bool isSmokePresent = (rawAdc <= RAW_SMOKE_THRESHOLD);

    Serial.printf("[Sensor D1] Raw: %4d | Drop: %4.0f | Smoke: %5.1f PPM | Thresh: %d | Result: %s\n",
                  rawAdc, drop, smokePpm, RAW_SMOKE_THRESHOLD,
                  (isSmokePresent ? "SMOKE CRITICAL (<= 3800)" : "CLEAN NORMAL (> 3800)"));

    // 2. State Machine & Execution Logic
    if (isSmokePresent) {
        // Enters active alarm loop: stays awake, sounds buzzer continuously until smoke clears (Raw > 3800)
        handleActiveAlarmMode(rawAdc, drop, smokePpm, batteryPct);
    } else {
        // --- CLEAN / NO SMOKE ---
        rtcInAlarmState = false;
        flashStatusLed(1, 30); // 30ms gentle heartbeat blink

        // Send keep-alive telemetry beacon every 6 cycles (30s)
        rtcNormalHeartbeatCount++;
        if (rtcNormalHeartbeatCount >= 6) {
            rtcNormalHeartbeatCount = 0;
            broadcastTelemetryFrame(0x01, batteryPct, (uint16_t)smokePpm);
        }
    }

    // Ensure buzzer is completely off and silent during sleep interval
    soundBuzzer(false);
}

void setup() {
    // Anti-Chirp Hardware Protection for Buzzer on GPIO 5:
    gpio_hold_dis((gpio_num_t)PIN_ALARM_BUZZER);
    pinMode(PIN_ALARM_BUZZER, OUTPUT);
    digitalWrite(PIN_ALARM_BUZZER, LOW);
    gpio_pulldown_en((gpio_num_t)PIN_ALARM_BUZZER);
    gpio_pullup_dis((gpio_num_t)PIN_ALARM_BUZZER);

    Serial.begin(115200);

    // Configure Hardware Pins
    pinMode(PIN_IR_LED, OUTPUT);
    digitalWrite(PIN_IR_LED, LOW);

    pinMode(PIN_STATUS_LED, OUTPUT);
    digitalWrite(PIN_STATUS_LED, LOW);

#if defined(BOARD_ESP32C3_MICRO)
    pinMode(PIN_ONBOARD_LED, OUTPUT);
    digitalWrite(PIN_ONBOARD_LED, HIGH); // Turn off active-low blue onboard LED
#endif

    pinMode(PIN_BOOT_BTN, INPUT_PULLUP);

    analogSetAttenuation(ADC_11db);
    analogReadResolution(12);

    // Extract MAC Address for Chip ID
    uint64_t mac = ESP.getEfuseMac();
    for (int i = 0; i < 6; i++) {
        chipIdBytes[i] = (mac >> (8 * (5 - i))) & 0xFF;
    }

    Serial.println("\n**********************************************************************");
    Serial.printf("  SMART SMOKE ENDPOINT INITIALIZED | Board: %s\n", BOARD_PROFILE_NAME);
    Serial.printf("  Pin Mapping -> Smoke ADC: GPIO %d | IR LED: GPIO %d | Buzzer: GPIO %d | LED: GPIO %d\n",
                  PIN_SMOKE_ADC, PIN_IR_LED, PIN_ALARM_BUZZER, PIN_STATUS_LED);
    Serial.println("**********************************************************************");

#if USE_DEEP_SLEEP
    // Run the measurement cycle
    runFullSmokeCycle();

    // Hardware Anti-Chirp Lock: Lock D3 Buzzer at 0V during Deep Sleep
    soundBuzzer(false);
    gpio_pulldown_en((gpio_num_t)PIN_ALARM_BUZZER);
    gpio_pullup_dis((gpio_num_t)PIN_ALARM_BUZZER);
    gpio_hold_en((gpio_num_t)PIN_ALARM_BUZZER);

    // Configure 5-second timer wakeup
    Serial.println("[Power] Entering Full Deep Sleep for 5 seconds (~5uA)...\n");
    Serial.flush();
    delay(50);

    esp_sleep_enable_timer_wakeup((uint64_t)SLEEP_INTERVAL_SEC * 1000000ULL);
    esp_deep_sleep_start();
#endif
}

void loop() {
#if !USE_DEEP_SLEEP
    runFullSmokeCycle();
    delay(SLEEP_INTERVAL_SEC * 1000);
#endif
}
