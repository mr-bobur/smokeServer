/**
 * ============================================================================
 * SMART BUILDING ECOSYSTEM - ESP32-C3 WIRELESS SMOKE & SENSOR ENDPOINT (PIO)
 * Ultra-Low Power BLE 5.0 Beaconing + MQ-2 Optical Smoke ADC + Deep Sleep FSM
 * ============================================================================
 */
#include <Arduino.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <esp_sleep.h>

#define PIN_PAIRING_BTN    9   // Active LOW Boot button with pull-up
#define PIN_ALARM_BUZZER   4   // Piezo Siren Output
#define PIN_STATUS_LED     8   // RGB / Status LED
#define PIN_MQ2_ADC        0   // Smoke Optical / MQ-2 Analog Input
#define PIN_MQ7_ADC        1   // CO Sensor Analog Input
#define PIN_REED_SWITCH    3   // Door / Window Reed Switch
#define PIN_GLASS_BREAK    10  // Acoustic Piezo Glass Shatter

#define SMOKE_CRITICAL_THRESHOLD_PPM  400.0f
#define TEMP_CRITICAL_THRESHOLD_C     60.0f

enum EndpointState {
    STATE_STANDBY_SLEEP = 0,
    STATE_PAIRING       = 1,
    STATE_NORMAL_BEACON = 2,
    STATE_ALARM_TRIGGER = 3
};

Preferences nvs;
EndpointState currentState = STATE_NORMAL_BEACON;
uint32_t beaconIntervalSec = 30; // 30s during active demo / 600s in production
bool isCommissioned = false;
uint8_t chipIdBytes[6];

void flashLed(int count, int delayMs = 120) {
    for (int i = 0; i < count; i++) {
        digitalWrite(PIN_STATUS_LED, HIGH);
        delay(delayMs);
        digitalWrite(PIN_STATUS_LED, LOW);
        delay(delayMs);
    }
}

/**
 * Broadcasts Custom BLE 5.0 Manufacturer Data Packet:
 * [0xFF, 0xFF, CHIP_ID (6B), TYPE_BYTE (1B), BATTERY_PCT (1B), VALUE_HIGH (1B), VALUE_LOW (1B)]
 */
void broadcastTelemetryFrame(uint8_t typeByte, uint8_t batteryPct, uint16_t smokeValue) {
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->stop();

    uint8_t mfgPayload[12];
    mfgPayload[0] = 0xFF;
    mfgPayload[1] = 0xFF;
    memcpy(&mfgPayload[2], chipIdBytes, 6);
    mfgPayload[8] = typeByte;                    // 0x01: SMOKE_MQ2
    mfgPayload[9] = batteryPct;                  // Battery % (e.g. 96)
    mfgPayload[10] = (smokeValue >> 8) & 0xFF;   // Value High Byte
    mfgPayload[11] = smokeValue & 0xFF;          // Value Low Byte

    BLEAdvertisementData advData;
    advData.setFlags(0x06); // LE General Discoverable Mode
    advData.setManufacturerData(String((char *)mfgPayload, 12));
    pAdvertising->setAdvertisementData(advData);
    pAdvertising->start();

    Serial.printf("[BLE Tx] Chip: %02X%02X%02X%02X%02X%02X | Type: 0x%02X | Bat: %d%% | Smoke: %d PPM\n",
                  chipIdBytes[0], chipIdBytes[1], chipIdBytes[2],
                  chipIdBytes[3], chipIdBytes[4], chipIdBytes[5],
                  typeByte, batteryPct, smokeValue);
}

bool checkLongPressCommissioning() {
    if (digitalRead(PIN_PAIRING_BTN) == LOW) {
        uint32_t pressStart = millis();
        while (digitalRead(PIN_PAIRING_BTN) == LOW) {
            uint32_t elapsed = millis() - pressStart;
            if (elapsed >= 5000 && elapsed <= 10000) {
                currentState = STATE_PAIRING;
                return true;
            }
            delay(50);
        }
    }
    return false;
}

void setup() {
    Serial.begin(115200);
    delay(1000);

    pinMode(PIN_PAIRING_BTN, INPUT_PULLUP);
    pinMode(PIN_ALARM_BUZZER, OUTPUT);
    pinMode(PIN_STATUS_LED, OUTPUT);
    pinMode(PIN_REED_SWITCH, INPUT_PULLUP);
    pinMode(PIN_GLASS_BREAK, INPUT_PULLUP);

    uint64_t mac = ESP.getEfuseMac();
    for (int i = 0; i < 6; i++) {
        chipIdBytes[i] = (mac >> (8 * (5 - i))) & 0xFF;
    }

    nvs.begin("smart_smoke", false);
    isCommissioned = nvs.getBool("paired", true);
    beaconIntervalSec = nvs.getUInt("beacon_sec", 30);

    Serial.println("======================================================================");
    Serial.printf("  ESP32-C3 SMOKE DETECTOR ENDPOINT [CHIP: C3-%02X%02X%02X%02X%02X%02X]\n",
                  chipIdBytes[0], chipIdBytes[1], chipIdBytes[2],
                  chipIdBytes[3], chipIdBytes[4], chipIdBytes[5]);
    Serial.println("======================================================================");

    BLEDevice::init("SB-C3-SMOKE");
    flashLed(2);
}

void loop() {
    // 1. Commissioning Button Check (5s hold)
    if (checkLongPressCommissioning()) {
        Serial.println("[Endpoint] Entering PAIRING MODE...");
        broadcastTelemetryFrame(0x01, 99, 15);
        flashLed(5, 80);
        nvs.putBool("paired", true);
        currentState = STATE_NORMAL_BEACON;
    }

    // 2. Read Sensors (Optical Smoke / MQ2)
    int rawAdc = analogRead(PIN_MQ2_ADC);
    float smokePpm = (rawAdc / 4095.0f) * 600.0f;
    uint8_t batteryPct = 96;

    // 3. Alarm Threshold Evaluation
    if (smokePpm >= SMOKE_CRITICAL_THRESHOLD_PPM) {
        currentState = STATE_ALARM_TRIGGER;
        Serial.printf("[ALARM CRITICAL] Smoke Level %0.1f PPM exceeds %0.1f PPM threshold!\n",
                      smokePpm, SMOKE_CRITICAL_THRESHOLD_PPM);

        digitalWrite(PIN_ALARM_BUZZER, HIGH);
        flashLed(3, 50);

        // Transmit urgent alarm packets continuously
        broadcastTelemetryFrame(0x01, batteryPct, (uint16_t)smokePpm);
        delay(1000);
    } else {
        digitalWrite(PIN_ALARM_BUZZER, LOW);
        currentState = STATE_NORMAL_BEACON;

        // Normal periodic beacon
        broadcastTelemetryFrame(0x01, batteryPct, (uint16_t)smokePpm);
        delay(3000); // Send beacon every 3 seconds for live gateway testing
    }
}
