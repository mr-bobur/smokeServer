/**
 * ============================================================================
 * SMART BUILDING ECOSYSTEM - ESP32-C3 TEMPERATURE & HUMIDITY ENDPOINT
 * Board: LilyGO T-ZigBee (ESP32-C3 MCU) + Sensirion SHT21 I2C Sensor
 *
 * Hardware Peripherals:
 *   - GPIO 2 : Onboard User / KEY Button (Active LOW)
 *              * 5-second long press -> Resets pairing in NVS & reboots MCU
 *              * Short press         -> Immediate manual sensor read & BLE broadcast
 *   - GPIO 3 : Onboard Blue Status LED (Active HIGH)
 *              * Pairing Mode: Fast blink (100ms)
 *              * Normal: Gentle heartbeat flash (30ms)
 *              * High Temp Alarm: Rapid emergency strobe
 *   - GPIO 0 : Telink TLSR8258 Zigbee Power (Held LOW to save battery power)
 *   - GPIO 4 : SHT21 I2C SDA
 *   - GPIO 5 : SHT21 I2C SCL
 * ============================================================================
 * Protocol Specifications:
 *   1. Initial Connection / Pairing Algorithm (Dastlabki ulanish):
 *      - Triggered when KEY button is held for 5 seconds (NVS reset + reboot).
 *      - Broadcasts BLE Intro / Commissioning packet containing:
 *        * Device Identity (Unique Chip MAC: C3-XXXXXX)
 *        * Device Type: 0x02 (TEMP_DS18B20 / SHT21 Temperature & Humidity)
 *        * Battery Level (%): 98%
 *        * Real-time Initial Temperature & Humidity readings
 *        * Handshake signature (0xAA 0xFF ... 0x55 & 0xFF 0xFF standard frame)
 *      - Active for 30 seconds to allow Gateway to capture and claim device.
 *   2. Normal Operation:
 *      - Reads SHT21 temperature and relative humidity every 5 seconds.
 *      - Transmits keep-alive telemetry frame to Gateway every 30 seconds.
 *   3. High Temperature Critical Alarm:
 *      - Triggers when Temperature >= 50.0°C.
 *      - Transmits 3 CONSECUTIVE ALARM packets immediately to Gateway.
 *      - Urgent broadcast every 1s with emergency LED strobe.
 *      - Automatic recovery when temperature drops below 48.0°C (3x NORMAL recovery burst).
 * ============================================================================
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <Preferences.h>
#include <esp_sleep.h>

#include "board_pins.h"
#include "config.h"
#include "sht21_sensor.h"

static Preferences nvs;
static uint8_t chipIdBytes[6];
static char chipIdString[18];

static bool isBleInitialized = false;
static bool isPaired = false;
static bool inAlarmState = false;

static uint32_t lastSampleMs = 0;
static uint32_t lastBeaconMs = 0;
static uint32_t lastAlarmBurstMs = 0;
static float lastReportedTemp = -999.0f;

// -----------------------------------------------------------------------------
// LED Helper Functions
// -----------------------------------------------------------------------------
void setStatusLed(bool on) {
    digitalWrite(PIN_BLUE_LED, on ? HIGH : LOW);
}

void flashLed(int count, int onMs = 60, int offMs = 60) {
    for (int i = 0; i < count; i++) {
        setStatusLed(true);
        delay(onMs);
        setStatusLed(false);
        if (i < count - 1) delay(offMs);
    }
}

// -----------------------------------------------------------------------------
// BLE 5.0 Broadcast Engine
// -----------------------------------------------------------------------------

/**
 * Broadcasts Ecosystem-Compatible Manufacturer Data Packet:
 * [0xFF, 0xFF, CHIP_ID (6B), TYPE_BYTE (1B), BATTERY_PCT (1B), TEMP_H (1B), TEMP_L (1B), HUMIDITY (1B), FLAGS (1B)]
 */
void broadcastTelemetryFrame(uint8_t typeByte, uint8_t batteryPct, float temperatureC, float humidityPct, bool isAlarm) {
    if (!isBleInitialized) {
        BLEDevice::init(BLE_DEVICE_NAME);
        isBleInitialized = true;
    }

    BLEAdvertising *pAdv = BLEDevice::getAdvertising();
    pAdv->stop();

    int16_t tempEncoded = (int16_t)(temperatureC * 10.0f); // 24.5°C -> 245
    uint8_t humEncoded = (uint8_t)constrain((int)humidityPct, 0, 100);
    uint8_t statusFlag = isAlarm ? 0x01 : 0x00;

    uint8_t mfgPayload[14];
    mfgPayload[0] = 0xFF;
    mfgPayload[1] = 0xFF;
    memcpy(&mfgPayload[2], chipIdBytes, 6);
    mfgPayload[8] = typeByte;                           // 0x02: Temperature / SHT21
    mfgPayload[9] = batteryPct;                         // Battery %
    mfgPayload[10] = (uint8_t)((tempEncoded >> 8) & 0xFF); // Temp High Byte
    mfgPayload[11] = (uint8_t)(tempEncoded & 0xFF);        // Temp Low Byte
    mfgPayload[12] = humEncoded;                        // Humidity %
    mfgPayload[13] = statusFlag;                        // 0x01 = ALARM, 0x00 = NORMAL

    BLEAdvertisementData advData;
    advData.setFlags(0x06); // General Discoverable Mode + BR/EDR Not Supported
    advData.setManufacturerData(String((char *)mfgPayload, 14));
    pAdv->setAdvertisementData(advData);
    pAdv->start();

    Serial.printf("[BLE Tx] %s | Type: 0x%02X (TEMP_SHT21) | Temp: %.1f°C | Hum: %.1f%% | Bat: %d%% | %s\n",
                  chipIdString, typeByte, temperatureC, humidityPct, batteryPct,
                  isAlarm ? ">>> CRITICAL ALARM! <<<" : "NORMAL");
}

/**
 * Broadcasts Industrial Introduction / Handshake Frame (Kirish tanishtiruv paketi):
 * [0xAA, 0xFF, CHIP_ID (6B), TYPE_BYTE (0x02), BATTERY_PCT (1B), TEMP_H (1B), TEMP_L (1B), HUMIDITY (1B), 0x55]
 * Recognized by Cloud Dashboard & Gateway pairing auto-detection engine
 */
void broadcastIntroPairingFrame(uint8_t batteryPct, float temperatureC, float humidityPct) {
    if (!isBleInitialized) {
        BLEDevice::init(BLE_DEVICE_NAME);
        isBleInitialized = true;
    }

    BLEAdvertising *pAdv = BLEDevice::getAdvertising();
    pAdv->stop();

    int16_t tempEncoded = (int16_t)(temperatureC * 10.0f);
    uint8_t humEncoded = (uint8_t)constrain((int)humidityPct, 0, 100);

    uint8_t introPayload[14];
    introPayload[0] = 0xAA; // Handshake intro signature start
    introPayload[1] = 0xFF;
    memcpy(&introPayload[2], chipIdBytes, 6);
    introPayload[8] = BLE_MFG_TYPE_TEMP; // 0x02: TEMP_DS18B20 / SHT21
    introPayload[9] = batteryPct;
    introPayload[10] = (uint8_t)((tempEncoded >> 8) & 0xFF);
    introPayload[11] = (uint8_t)(tempEncoded & 0xFF);
    introPayload[12] = humEncoded;
    introPayload[13] = 0x55; // Stop byte

    BLEAdvertisementData advData;
    advData.setFlags(0x06);
    advData.setManufacturerData(String((char *)introPayload, 14));
    pAdv->setAdvertisementData(advData);
    pAdv->start();

    // Print raw intro hex string for easy debugging and clipboard copy
    char hexStr[48] = {0};
    int pos = 0;
    for (int i = 0; i < 14; i++) {
        pos += snprintf(hexStr + pos, sizeof(hexStr) - pos, "%02X ", introPayload[i]);
    }

    Serial.printf("[BLE Intro Tx] Handshake Packet: [%s]\n", hexStr);
    Serial.printf("               Device: %s | Type: 0x02 (TEMP_SHT21) | Temp: %.1f°C | Hum: %.1f%% | Bat: %d%%\n",
                  chipIdString, temperatureC, humidityPct, batteryPct);
}

/**
 * Transmits N consecutive bursts with inter-frame spacing to guarantee delivery
 */
void sendPacketBurst(float tempC, float humPct, bool isAlarm, int burstCount = ALARM_BURST_COUNT) {
    for (int i = 0; i < burstCount; i++) {
        broadcastTelemetryFrame(BLE_MFG_TYPE_TEMP, 98, tempC, humPct, isAlarm);
        delay(120); // 120ms RF spacing
    }
}

// -----------------------------------------------------------------------------
// Initial Connection Algorithm (Dastlabki ulanish algoritmi)
// -----------------------------------------------------------------------------
void runInitialConnectionAlgorithm() {
    Serial.println("\n======================================================================");
    Serial.println("  >>> [DASTLABKI ULANISH ALGORITMI / PAIRING MODE ACTIVATED] <<<");
    Serial.printf("  Device ID    : %s\n", chipIdString);
    Serial.println("  Sensor Type  : 0x02 (TEMP_DS18B20 / Sensirion SHT21)");
    Serial.printf("  Window       : %d seconds active BLE broadcasting\n", PAIRING_WINDOW_SEC);
    Serial.println("  Waiting for Gateway to capture and claim this endpoint...");
    Serial.println("======================================================================\n");

    // Sample initial sensor reading
    Sht21Reading initReading = readSht21();
    float curTemp = initReading.isValid ? initReading.temperature : 25.0f;
    float curHum = initReading.isValid ? initReading.humidity : 45.0f;

    uint32_t pairingStart = millis();
    uint32_t lastIntroBroadcast = 0;
    uint32_t pairingDurationMs = (uint32_t)PAIRING_WINDOW_SEC * 1000UL;

    // Active Pairing Mode Loop: Fast LED cadence + continuous dual-frame broadcasting
    while (millis() - pairingStart < pairingDurationMs) {
        // 1. Toggle LED for clear visual indication (100ms ON / 100ms OFF)
        setStatusLed((millis() / 100) % 2 == 0);

        // 2. Broadcast intro frame every 1.5 seconds
        if (millis() - lastIntroBroadcast >= 1500) {
            lastIntroBroadcast = millis();

            // Alternate between Handshake Intro Frame and Ecosystem Telemetry Frame
            broadcastIntroPairingFrame(98, curTemp, curHum);
            delay(100);
            broadcastTelemetryFrame(BLE_MFG_TYPE_TEMP, 98, curTemp, curHum, false);

            uint32_t remainingSec = (pairingDurationMs - (millis() - pairingStart)) / 1000;
            Serial.printf("  [Pairing Active] Broadcast sent! Remaining time: %u sec...\n", remainingSec);
        }

        delay(20);
    }

    // Mark as paired in NVS
    nvs.begin(NVS_NAMESPACE, false);
    nvs.putBool("is_paired", true);
    nvs.putBool("need_pairing_intro", false);
    nvs.end();
    isPaired = true;

    setStatusLed(false);
    Serial.println("\n======================================================================");
    Serial.println("  [Pairing Complete] Initial Connection window ended.");
    Serial.println("  Device successfully initialized and registered in NVS memory!");
    Serial.println("  Transitioning to normal continuous monitoring mode...");
    Serial.println("======================================================================\n");

    // 3 slow LED blinks to confirm pairing completion
    flashLed(3, 200, 200);
}

// -----------------------------------------------------------------------------
// Button Handling: Short Press = Manual Test, 5s Long Press = Reset & Pairing
// -----------------------------------------------------------------------------
void handleButton() {
    static uint32_t pressStartMs = 0;
    static bool isPressing = false;
    static bool restartTriggered = false;

    // Detect button press on either PIN_KEY_BTN (GPIO 2, shared with SCL) or PIN_BOOT_BTN (GPIO 9)
    bool isBtnDown = (digitalRead(PIN_KEY_BTN) == LOW) || (digitalRead(PIN_BOOT_BTN) == LOW);

    if (isBtnDown) {
        if (!isPressing) {
            isPressing = true;
            pressStartMs = millis();
            restartTriggered = false;
            Serial.println("[Button] KEY/BOOT button pressed (Active LOW). Tracking duration...");
        } else {
            uint32_t holdDuration = millis() - pressStartMs;

            // Give visual feedback when approaching 5 seconds
            if (holdDuration >= 4000 && holdDuration < KEY_LONG_PRESS_MS) {
                setStatusLed((holdDuration / 80) % 2 == 0);
            }

            // 5-Second Long Press Threshold reached!
            if (holdDuration >= KEY_LONG_PRESS_MS && !restartTriggered) {
                restartTriggered = true;

                Serial.println("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
                Serial.printf("  >>> [5-SECOND KEY HOLD DETECTED: %u ms] <<<\n", holdDuration);
                Serial.println("  Resetting Commissioning State in NVS...");
                Serial.println("  Restarting MCU to launch Initial Connection Algorithm (Dastlabki ulanish)!");
                Serial.println("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n");

                // Reset pairing status in NVS
                nvs.begin(NVS_NAMESPACE, false);
                nvs.putBool("is_paired", false);
                nvs.putBool("need_pairing_intro", true);
                nvs.end();

                // Rapid 10-blink confirmation
                flashLed(10, 40, 40);

                Serial.println("[System] Rebooting now via esp_restart()...\n");
                Serial.flush();
                delay(200);
                ESP.restart();
            }
        }
    } else {
        if (isPressing) {
            uint32_t elapsed = millis() - pressStartMs;
            isPressing = false;
            setStatusLed(false);

            // Short press detected (50ms - 3000ms): Manual test reading & burst
            if (elapsed > 50 && elapsed < 3000 && !restartTriggered) {
                Serial.printf("[Button] Short press detected (%u ms) -> Triggering Manual SHT21 Read & BLE Burst!\n", elapsed);
                flashLed(2, 60, 60);

                Sht21Reading r = readSht21();
                broadcastTelemetryFrame(BLE_MFG_TYPE_TEMP, 98, r.temperature, r.humidity, inAlarmState);
                sendPacketBurst(r.temperature, r.humidity, inAlarmState, 2);
            }
        }
    }
}

// -----------------------------------------------------------------------------
// Interactive Serial Command Handler
// -----------------------------------------------------------------------------
void handleSerialCommands() {
    if (!Serial.available()) return;

    char cmd = Serial.read();
    switch (cmd) {
        case 'p':
        case 'P':
            Serial.println("[Command] Manually triggering Initial Connection Algorithm (Pairing)...");
            runInitialConnectionAlgorithm();
            break;
        case 'r':
        case 'R': {
            Sht21Reading r = readSht21();
            Serial.printf("[SHT21 Sample] Temp: %.2f °C | Hum: %.2f %%RH | Valid: %s\n",
                          r.temperature, r.humidity, r.isValid ? "YES" : "NO");
            break;
        }
        case 't':
        case 'T':
            Serial.println("[Command] Broadcasting manual BLE telemetry frame...");
            {
                Sht21Reading r = readSht21();
                broadcastTelemetryFrame(BLE_MFG_TYPE_TEMP, 98, r.temperature, r.humidity, inAlarmState);
            }
            break;
        case 'a':
        case 'A':
            Serial.println("[Command] Simulating HIGH TEMPERATURE ALARM (> 50°C)...");
            sendPacketBurst(58.5f, 32.0f, true, 3);
            break;
        case 'h':
        case '?':
            Serial.println("\n========== SHT21 ENDPOINT COMMAND MENU ==========");
            Serial.println("  'p' : Trigger Initial Connection Algorithm (Pairing)");
            Serial.println("  'r' : Read live SHT21 temperature & humidity");
            Serial.println("  't' : Broadcast manual BLE telemetry beacon");
            Serial.println("  'a' : Test 3x High-Temp Alarm burst (> 50°C)");
            Serial.println("  'h' : Show this help menu");
            Serial.println("=================================================\n");
            break;
        default:
            break;
    }
}

// -----------------------------------------------------------------------------
// Arduino Setup
// -----------------------------------------------------------------------------
void setup() {
    // 1. Immediately disable TLSR8258 Zigbee chip to maximize power saving
    pinMode(PIN_ZIGBEE_PWR, OUTPUT);
    digitalWrite(PIN_ZIGBEE_PWR, LOW);

    // 2. Configure Board Pins
    pinMode(PIN_BLUE_LED, OUTPUT);
    digitalWrite(PIN_BLUE_LED, LOW);

    pinMode(PIN_BOOT_BTN, INPUT_PULLUP);

    Serial.begin(115200);
    delay(1000); // Allow UART connection

    Serial.println("\n======================================================================");
    Serial.println("  LILYGO T-ZIGBEE (ESP32-C3) TEMPERATURE & HUMIDITY ENDPOINT FIRMWARE");
    Serial.println("  Sensirion SHT21 Digital I2C Sensor + BLE 5.0 Broadcast + Pairing FSM");
    Serial.println("======================================================================");

    // 3. Extract Unique Chip ID from eFuse MAC
    uint64_t mac = ESP.getEfuseMac();
    for (int i = 0; i < 6; i++) {
        chipIdBytes[i] = (mac >> (8 * (5 - i))) & 0xFF;
    }
    snprintf(chipIdString, sizeof(chipIdString), "C3-%02X%02X%02X%02X%02X%02X",
             chipIdBytes[0], chipIdBytes[1], chipIdBytes[2],
             chipIdBytes[3], chipIdBytes[4], chipIdBytes[5]);
    Serial.printf("[System] Device Unique ID: %s\n", chipIdString);

    // 4. Initialize I2C Bus and SHT21 Sensor
    initSht21(PIN_SHT21_SDA, PIN_SHT21_SCL, SHT21_I2C_FREQ);

    // 5. Initialize BLE Subsystem
    BLEDevice::init(BLE_DEVICE_NAME);
    isBleInitialized = true;
    Serial.println("[BLE] BLE 5.0 Radio Initialized. Device Name: " BLE_DEVICE_NAME);

    // 6. Read NVS Commissioning Flags
    nvs.begin(NVS_NAMESPACE, false);
    isPaired = nvs.getBool("is_paired", false);
    bool needPairingIntro = nvs.getBool("need_pairing_intro", true);
    nvs.end();

    Serial.printf("[NVS] Commissioning Status: %s | Need Intro: %s\n",
                  isPaired ? "PAIRED" : "UNPAIRED (Needs Pairing)",
                  needPairingIntro ? "YES" : "NO");

    // 7. Check if Initial Connection Algorithm is required
    // (Triggered on first boot or after 5-second KEY hold)
    if (!isPaired || needPairingIntro) {
        Serial.println("[Setup] Device requires commissioning -> Launching Initial Connection Algorithm!");
        runInitialConnectionAlgorithm();
    } else {
        // Startup confirmation chirp
        flashLed(2, 80, 80);
        Serial.println("[Setup] Device already paired. Running normal monitoring loop.");
    }

    Serial.println("[System] Ready. Type 'h' in Serial Monitor for commands.\n");
}

// -----------------------------------------------------------------------------
// Main Arduino Loop
// -----------------------------------------------------------------------------
void loop() {
    handleSerialCommands();
    handleButton();

    uint32_t now = millis();
    uint32_t sampleRate = inAlarmState ? SAMPLE_INTERVAL_ALARM_MS : SAMPLE_INTERVAL_NORMAL_MS;

    // Periodic SHT21 Measurement Cycle
    if (now - lastSampleMs >= sampleRate) {
        lastSampleMs = now;

        Sht21Reading r = readSht21();
        float tempC = r.temperature;
        float humPct = r.humidity;

        // Check High Temperature Alarm Condition (Temp >= 50.0°C)
        bool tempAlarmCondition = (tempC >= DEFAULT_TEMP_ALARM_C);

        if (tempAlarmCondition && !inAlarmState) {
            // === ENTER CRITICAL ALARM STATE ===
            inAlarmState = true;
            Serial.println("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
            Serial.printf("  >>> [CRITICAL HIGH TEMPERATURE ALARM!] %.1f°C >= %.1f°C <<<\n",
                          tempC, DEFAULT_TEMP_ALARM_C);
            Serial.println("  Transmitting initial 3x ALARM burst to Gateway...");
            Serial.println("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");

            sendPacketBurst(tempC, humPct, true, 3);
            lastAlarmBurstMs = now;
            lastBeaconMs = now;

        } else if (!tempAlarmCondition && inAlarmState) {
            // Check hysteresis before clearing alarm (Temp <= 48.0°C)
            if (tempC <= (DEFAULT_TEMP_ALARM_C - DEFAULT_TEMP_HYSTERESIS_C)) {
                // === RECOVERY CONFIRMED ===
                inAlarmState = false;
                Serial.println("\n======================================================================");
                Serial.printf("  >>> [RECOVERY CONFIRMED] Temperature cooled: %.1f°C <= %.1f°C <<<\n",
                              tempC, (DEFAULT_TEMP_ALARM_C - DEFAULT_TEMP_HYSTERESIS_C));
                Serial.println("  Transmitting 3x NORMAL recovery burst to Gateway...");
                Serial.println("======================================================================");

                sendPacketBurst(tempC, humPct, false, 3);
                setStatusLed(false);
                flashLed(3, 100, 100);
                lastBeaconMs = now;
            }
        }

        // Print Telemetry Log
        Serial.printf("[SHT21] Temp: %5.1f°C | Hum: %5.1f%% | Status: %s | AlarmThresh: >= %.1f°C\n",
                      tempC, humPct,
                      inAlarmState ? ">>> CRITICAL ALARM! <<<" : "OK (Normal)",
                      DEFAULT_TEMP_ALARM_C);

        // Visual Indicator:
        if (inAlarmState) {
            // Rapid strobe while in alarm
            setStatusLed(true);
            delay(50);
            setStatusLed(false);

            // Re-transmit alarm burst every 1 second
            if (now - lastAlarmBurstMs >= (BLE_BEACON_INTERVAL_ALARM * 1000UL)) {
                lastAlarmBurstMs = now;
                broadcastTelemetryFrame(BLE_MFG_TYPE_TEMP, 98, tempC, humPct, true);
            }
        } else {
            // 30ms gentle heartbeat blink in normal state
            setStatusLed(true);
            delay(30);
            setStatusLed(false);

            // Keep-alive beacon transmission every 30 seconds
            // OR immediate broadcast if temperature shifted by > 0.5°C
            bool tempChangedSignificantly = (fabs(tempC - lastReportedTemp) >= 0.5f);
            uint32_t beaconIntervalMs = (uint32_t)BLE_BEACON_INTERVAL_NORMAL * 1000UL;

            if ((now - lastBeaconMs >= beaconIntervalMs) || tempChangedSignificantly) {
                lastBeaconMs = now;
                lastReportedTemp = tempC;
                broadcastTelemetryFrame(BLE_MFG_TYPE_TEMP, 98, tempC, humPct, false);
            }
        }
    }

    // Small yield for background FreeRTOS tasks & watchdog
    delay(10);
}
