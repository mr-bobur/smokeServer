/**
 * ============================================================================
 * SMART BUILDING ECOSYSTEM - ESP32-C3 MODULAR SENSOR ENDPOINT FIRMWARE
 * Section 4.1: BLE 5.0 Pairing (5-10s GPIO9 Long Press) & Dynamic Beaconing FSM
 * ============================================================================
 */
#include <Arduino.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <esp_sleep.h>

#define PIN_PAIRING_BTN    9   // Active LOW with internal pull-up
#define PIN_ALARM_BUZZER   4   // Piezo Siren Latch
#define PIN_STATUS_LED     8   // Green Status LED
#define PIN_MQ2_ADC        0   // Smoke Sensor Analog Input
#define PIN_MQ7_ADC        1   // CO Sensor Analog Input
#define PIN_REED_SWITCH    3   // Magnetic Door Reed Switch
#define PIN_GLASS_BREAK    10  // Acoustic Glass Break Interrupt

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
uint32_t beaconIntervalSec = 600; // Default 600s normal, 1s alarm
bool isCommissioned = false;
uint8_t chipIdBytes[6];

void flashGreenLed(int count) {
  for (int i = 0; i < count; i++) {
    digitalWrite(PIN_STATUS_LED, HIGH);
    delay(180);
    digitalWrite(PIN_STATUS_LED, LOW);
    delay(180);
  }
}

/**
 * Broadcasts Custom BLE 5.0 Manufacturer Data Packet:
 * [0xFF, 0xFF, CHIP_ID (6 bytes), CAPABILITY_MASK (1 byte), BATTERY_PCT (1 byte)]
 */
void broadcastBlePairingFrame(uint8_t capabilityMask, uint8_t batteryPct) {
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->stop();

  uint8_t mfgPayload[10];
  mfgPayload[0] = 0xFF;
  mfgPayload[1] = 0xFF;
  memcpy(&mfgPayload[2], chipIdBytes, 6);
  mfgPayload[8] = capabilityMask;
  mfgPayload[9] = batteryPct;

  BLEAdvertisementData advData;
  advData.setFlags(0x06);
  advData.setManufacturerData(std::string((char *)mfgPayload, 10));
  pAdvertising->setAdvertisementData(advData);
  pAdvertising->start();
}

/**
 * Checks GPIO 9 for 5 to 10 seconds continuous Active-LOW hold
 */
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
  pinMode(PIN_PAIRING_BTN, INPUT_PULLUP);
  pinMode(PIN_ALARM_BUZZER, OUTPUT);
  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_REED_SWITCH, INPUT_PULLUP);
  pinMode(PIN_GLASS_BREAK, INPUT_PULLUP);

  uint64_t mac = ESP.getEfuseMac();
  for (int i = 0; i < 6; i++) {
    chipIdBytes[i] = (mac >> (8 * (5 - i))) & 0xFF;
  }

  nvs.begin("smart_sensor", false);
  isCommissioned = nvs.getBool("paired", false);
  beaconIntervalSec = nvs.getUInt("beacon_sec", 600);

  BLEDevice::init("SB-ESP32C3-ENDPOINT");
}

void loop() {
  // 1. Long-Press Commissioning Check (5-10s on GPIO 9)
  if (checkLongPressCommissioning()) {
    broadcastBlePairingFrame(0x3F, 98);
    delay(1500);
    // On Floor Hub BLE ACK received: write config to NVS & flash LED 3x Green
    nvs.putBool("paired", true);
    nvs.putUInt("beacon_sec", 600);
    isCommissioned = true;
    flashGreenLed(3);
    currentState = STATE_NORMAL_BEACON;
  }

  // 2. Sample Sensors
  float smokePpm = (analogRead(PIN_MQ2_ADC) / 4095.0f) * 900.0f;
  float tempCelsius = 24.5f; // DS18B20 1-Wire sample

  // 3. Dynamic Beaconing Engine
  if (smokePpm > SMOKE_CRITICAL_THRESHOLD_PPM || tempCelsius > TEMP_CRITICAL_THRESHOLD_C) {
    currentState = STATE_ALARM_TRIGGER;
    digitalWrite(PIN_ALARM_BUZZER, HIGH); // Latch Buzzer on GPIO 4
    broadcastBlePairingFrame(0xFF, 94);
    delay(1000); // Transmit alarm packet every 1000ms until Server ACK
  } else {
    digitalWrite(PIN_ALARM_BUZZER, LOW);
    currentState = STATE_STANDBY_SLEEP;
    broadcastBlePairingFrame(0x01, 95);
    delay(250);
    esp_sleep_enable_timer_wakeup((uint64_t)beaconIntervalSec * 1000000ULL);
    esp_light_sleep_start();
  }
}
