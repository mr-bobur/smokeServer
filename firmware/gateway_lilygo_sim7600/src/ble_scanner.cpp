#include "ble_scanner.h"
#include "config.h"
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>

QueueHandle_t g_telemetryQueue = nullptr;
static BLEScan* pBLEScan = nullptr;

class SmartBuildingAdvertisedDeviceCallbacks : public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) override {
        // 1. Check for Manufacturer Data Packet
        if (advertisedDevice.haveManufacturerData()) {
            String mfgData = advertisedDevice.getManufacturerData();
            const uint8_t* raw = (const uint8_t*)mfgData.c_str();
            size_t len = mfgData.length();

            // Expected packet: [0xFF, 0xFF, CHIP_ID (6B), TYPE_BYTE (1B), BATTERY_PCT (1B), ...]
            if (len >= 8 && raw[0] == 0xFF && raw[1] == 0xFF) {
                SensorTelemetry item = {};

                // Extract Chip ID (e.g. C3-A1B2C3D4E5)
                snprintf(item.chipId, sizeof(item.chipId), "C3-%02X%02X%02X%02X%02X%02X",
                         raw[2], raw[3], raw[4], raw[5], raw[6], raw[7]);

                uint8_t typeByte = (len >= 9) ? raw[8] : 0x01;
                item.batteryLevel = (len >= 10) ? raw[9] : 95;
                item.rssi = advertisedDevice.getRSSI();
                item.timestamp = millis() / 1000;

                // Decode Sensor Type
                switch (typeByte) {
                    case 0x01: // SMOKE_MQ2
                        strncpy(item.sensorType, "SMOKE_MQ2", sizeof(item.sensorType));
                        strncpy(item.primaryUnit, "PPM", sizeof(item.primaryUnit));
                        item.smokePpm = (len >= 12) ? (raw[10] << 8 | raw[11]) : 28.5f;
                        item.primaryValue = item.smokePpm;
                        item.temperature = 24.5f;
                        item.coPpm = 4.2f;
                        item.isAlarm = (item.smokePpm > 400.0f);
                        break;
                    case 0x02: // TEMP_DS18B20
                        strncpy(item.sensorType, "TEMP_DS18B20", sizeof(item.sensorType));
                        strncpy(item.primaryUnit, "°C", sizeof(item.primaryUnit));
                        item.temperature = (len >= 12) ? ((int16_t)(raw[10] << 8 | raw[11])) / 10.0f : 25.2f;
                        item.primaryValue = item.temperature;
                        item.smokePpm = 15.0f;
                        item.coPpm = 2.0f;
                        item.isAlarm = (item.temperature > 60.0f);
                        break;
                    case 0x03: // DOOR_REED
                        strncpy(item.sensorType, "DOOR_REED", sizeof(item.sensorType));
                        strncpy(item.primaryUnit, "STATE", sizeof(item.primaryUnit));
                        item.primaryValue = (len >= 11) ? raw[10] : 0;
                        item.isAlarm = (item.primaryValue > 0);
                        break;
                    case 0x04: // CO_MQ7
                        strncpy(item.sensorType, "CO_MQ7", sizeof(item.sensorType));
                        strncpy(item.primaryUnit, "PPM", sizeof(item.primaryUnit));
                        item.coPpm = (len >= 12) ? (raw[10] << 8 | raw[11]) / 10.0f : 5.8f;
                        item.primaryValue = item.coPpm;
                        item.isAlarm = (item.coPpm > 50.0f);
                        break;
                    case 0x05: // GLASS_BREAK
                        strncpy(item.sensorType, "GLASS_BREAK", sizeof(item.sensorType));
                        strncpy(item.primaryUnit, "ACOUSTIC", sizeof(item.primaryUnit));
                        item.primaryValue = (len >= 11) ? raw[10] : 0;
                        item.isAlarm = (item.primaryValue > 0);
                        break;
                    default:
                        strncpy(item.sensorType, "SMOKE_MQ2", sizeof(item.sensorType));
                        strncpy(item.primaryUnit, "PPM", sizeof(item.primaryUnit));
                        item.smokePpm = 25.0f;
                        item.primaryValue = 25.0f;
                        item.isAlarm = false;
                        break;
                }

                Serial.printf("[BLE] Captured Telemetry -> %s | Type: %s | Val: %.1f %s | Bat: %d%% | RSSI: %d dBm\n",
                              item.chipId, item.sensorType, item.primaryValue, item.primaryUnit, item.batteryLevel, item.rssi);

                if (g_telemetryQueue != nullptr) {
                    xQueueSend(g_telemetryQueue, &item, 0);
                }
            }
        }
    }
};

void initBleScanner(QueueHandle_t telemetryQueue) {
    g_telemetryQueue = telemetryQueue;

    Serial.println("[BLE] Initializing ESP32 BLE Central Subsystem...");
    BLEDevice::init("LILYGO_CENTRAL_GATEWAY");

    pBLEScan = BLEDevice::getScan();
    pBLEScan->setAdvertisedDeviceCallbacks(new SmartBuildingAdvertisedDeviceCallbacks(), true);
    pBLEScan->setActiveScan(true);
    pBLEScan->setInterval(BLE_SCAN_INTERVAL_MS);
    pBLEScan->setWindow(BLE_SCAN_WINDOW_MS);

    Serial.println("[BLE] BLE Central Scanner Ready.");
}

void runBleScanCycle() {
    if (pBLEScan != nullptr) {
        pBLEScan->start(BLE_SCAN_DURATION_SEC, false);
        pBLEScan->clearResults();
    }
}
