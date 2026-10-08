#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

#include "board_pins.h"
#include "config.h"
#include "optical_sensor.h"

static uint8_t chipIdBytes[6];
static uint32_t lastBeaconMs = 0;
static uint32_t lastSampleMs = 0;
static bool alarmState = false;

// -----------------------------------------------------------------------------
// BLE 5.0 Beacon Broadcast (Compatible with Smart Building Gateway)
// -----------------------------------------------------------------------------
void broadcastBleTelemetry(uint8_t typeByte, uint8_t batteryPct, uint16_t smokeValue, bool isAlarm) {
    BLEAdvertising *pAdv = BLEDevice::getAdvertising();
    pAdv->stop();

    uint8_t mfgPayload[12];
    mfgPayload[0] = 0xFF;
    mfgPayload[1] = 0xFF;
    memcpy(&mfgPayload[2], chipIdBytes, 6);
    mfgPayload[8] = typeByte;                    // 0x01: SMOKE sensor
    mfgPayload[9] = batteryPct;                  // Battery percentage (e.g. 100%)
    mfgPayload[10] = (smokeValue >> 8) & 0xFF;   // Primary Value High Byte
    mfgPayload[11] = smokeValue & 0xFF;          // Primary Value Low Byte

    BLEAdvertisementData advData;
    advData.setFlags(0x06); // LE General Discoverable Mode
    advData.setManufacturerData(String((char *)mfgPayload, 12));
    pAdv->setAdvertisementData(advData);
    pAdv->start();

    Serial.printf("[BLE Tx] Beacon -> Chip: C3-%02X%02X%02X%02X%02X%02X | Val: %d PPM | Status: %s\n",
                  chipIdBytes[0], chipIdBytes[1], chipIdBytes[2],
                  chipIdBytes[3], chipIdBytes[4], chipIdBytes[5],
                  smokeValue, isAlarm ? "ALARM!!" : "NORMAL");
}

// -----------------------------------------------------------------------------
// Interactive Serial Console Command Handler
// -----------------------------------------------------------------------------
void handleSerialCommands() {
    if (!Serial.available()) return;

    char cmd = Serial.read();
    switch (cmd) {
        case 'c':
        case 'C':
            calibrateCleanAirBaseline(25);
            break;
        case '+': {
            int th = getSmokeThreshold() + 50;
            setSmokeThreshold(th);
            break;
        }
        case '-': {
            int th = getSmokeThreshold() - 50;
            setSmokeThreshold(th);
            break;
        }
        case 't':
        case 'T':
            Serial.println("[Manual Test] Triggering test chirp...");
            playTestChirp();
            break;
        case 'h':
        case '?':
            Serial.println("\n========== COMMAND MENU ==========");
            Serial.println("  'c' : Calibrate clean air baseline");
            Serial.println("  '+' : Increase alarm threshold (+50 ADC)");
            Serial.println("  '-' : Decrease alarm threshold (-50 ADC)");
            Serial.println("  't' : Test chirp buzzer & LED");
            Serial.println("  'h' : Show this help menu");
            Serial.println("==================================\n");
            break;
        default:
            break;
    }
}

// -----------------------------------------------------------------------------
// Onboard Button Handler (Short Press = Test, Long Press > 3s = Calibrate)
// -----------------------------------------------------------------------------
void handleButton() {
    if (digitalRead(PIN_TEST_BTN) == LOW) {
        delay(50); // Debounce
        if (digitalRead(PIN_TEST_BTN) == LOW) {
            uint32_t pressStart = millis();
            while (digitalRead(PIN_TEST_BTN) == LOW) {
                if (millis() - pressStart > 3000) {
                    Serial.println("[Button] Long press detected -> Starting Calibration!");
                    calibrateCleanAirBaseline(30);
                    while (digitalRead(PIN_TEST_BTN) == LOW) { delay(50); }
                    return;
                }
                delay(20);
            }
            // Short press: Test chirp
            Serial.println("[Button] Short press -> Sounder Test!");
            playTestChirp();
        }
    }
}

void setup() {
    Serial.begin(115200);
    delay(2000); // Wait for USB CDC connection

    Serial.println("\n======================================================================");
    Serial.println("  SEEED XIAO ESP32-C3 OPTICAL SMOKE DETECTOR FIRMWARE");
    Serial.println("  Photoelectric IR Chamber + Dual Strobe + Piezo Buzzer + BLE 5.0");
    Serial.println("======================================================================");

    // Read unique chip MAC address
    uint64_t mac = ESP.getEfuseMac();
    for (int i = 0; i < 6; i++) {
        chipIdBytes[i] = (mac >> (8 * (5 - i))) & 0xFF;
    }
    Serial.printf("[System] Device Unique ID: C3-%02X%02X%02X%02X%02X%02X\n",
                  chipIdBytes[0], chipIdBytes[1], chipIdBytes[2],
                  chipIdBytes[3], chipIdBytes[4], chipIdBytes[5]);

    pinMode(PIN_TEST_BTN, INPUT_PULLUP);

    // Initialize Subsystems
    initAlarmSounder();
    initOpticalSensor();

    // Initialize BLE Subsystem
    BLEDevice::init(BLE_DEVICE_NAME);
    Serial.println("[BLE] Radio Initialized. Name: " BLE_DEVICE_NAME);

    // Play startup chirp
    playTestChirp();
    Serial.println("[System] Ready. Type 'h' in Serial Monitor for command options.\n");
}

void loop() {
    handleSerialCommands();
    handleButton();

    uint32_t now = millis();
    uint32_t sampleRate = alarmState ? SAMPLE_INTERVAL_ALARM_MS : SAMPLE_INTERVAL_NORMAL_MS;

    // Periodic Optical Smoke Chamber Sample
    if (now - lastSampleMs >= sampleRate) {
        lastSampleMs = now;

        OpticalReading r = sampleOpticalChamber();
        alarmState = r.isAlarm;

        // Print telemetry report
        Serial.printf("[OPTICAL] Amb: %4d | Pls: %4d | RawΔ: %4d | NetSmoke: %4d | PPM: %5.1f | Thresh: %4d | %s\n",
                      r.ambientAdc, r.pulseAdc, r.rawDelta, r.netSmokeSignal,
                      r.estimatedPpm, getSmokeThreshold(),
                      r.isAlarm ? ">>> ALARM CRITICAL! <<<" : "OK (Normal)");

        // Manage buzzer / LED fire alarm sounder
        updateAlarmSounder(r.isAlarm);

        // Manage BLE Beacon Transmission
        uint32_t beaconInterval = r.isAlarm ? (BLE_BEACON_INTERVAL_ALARM * 1000)
                                            : (BLE_BEACON_INTERVAL_NORMAL * 1000);

        if (now - lastBeaconMs >= beaconInterval) {
            lastBeaconMs = now;
            broadcastBleTelemetry(BLE_MFG_TYPE_SMOKE, 100, (uint16_t)r.estimatedPpm, r.isAlarm);
        }
    }

    // Small yield for background FreeRTOS tasks & watchdog
    delay(10);
}
