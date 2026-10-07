#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>

#include "config.h"
#include "board_pins.h"
#include "telemetry_data.h"
#include "ble_scanner.h"
#include "cellular_mqtt.h"

// FreeRTOS Queue for passing decoded BLE telemetry to Cellular/MQTT publisher
QueueHandle_t telemetryQueue = nullptr;

// -----------------------------------------------------------------------------
// Core 0: Dedicated FreeRTOS BLE Scanner Task
// -----------------------------------------------------------------------------
void bleScannerTask(void* pvParameters) {
    Serial.println("[Task] BLE Scanner Task Started on Core " + String(xPortGetCoreID()));
    initBleScanner(telemetryQueue);

    while (true) {
        runBleScanCycle();
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}

// -----------------------------------------------------------------------------
// Core 1: Dedicated FreeRTOS Cellular & MQTT Task
// -----------------------------------------------------------------------------
void cellularMqttTask(void* pvParameters) {
    Serial.println("[Task] Cellular & MQTT Task Started on Core " + String(xPortGetCoreID()));

    initCellularModem();
    connectCellularGprs();
    connectMqttBroker();

    SensorTelemetry item;

    while (true) {
        maintainCellularMqtt();

        // Check if new sensor telemetry arrived from BLE scanner
        if (xQueueReceive(telemetryQueue, &item, pdMS_TO_TICKS(100)) == pdTRUE) {
            Serial.printf("[Gateway Pipeline] Forwarding Telemetry for %s to MQTT...\n", item.chipId);
            publishTelemetryToMqtt(item);
        }

        vTaskDelay(pdMS_TO_TICKS(50));
    }
}

void setup() {
    Serial.begin(115200);
    delay(2000);

    Serial.println("======================================================================");
    Serial.println("  LILYGO T-SIM7600 CENTRAL GATEWAY (TINYGSM + MQTT + BLE SCANNER)");
    Serial.printf("  APN: '%s' | MQTT: %s:%d\n", CELLULAR_APN, MQTT_BROKER_HOST, MQTT_BROKER_PORT);
    Serial.println("======================================================================");

    // Create telemetry queue
    telemetryQueue = xQueueCreate(MAX_QUEUED_TELEMETRY, sizeof(SensorTelemetry));
    if (telemetryQueue == nullptr) {
        Serial.println("[FATAL] Failed to create FreeRTOS Telemetry Queue!");
        while (true) { delay(1000); }
    }

    // Launch Dual-Core FreeRTOS Tasks
    xTaskCreatePinnedToCore(
        bleScannerTask,
        "BLE_Scanner",
        4096,
        nullptr,
        1,
        nullptr,
        0 // Core 0
    );

    xTaskCreatePinnedToCore(
        cellularMqttTask,
        "Cellular_MQTT",
        8192,
        nullptr,
        2,
        nullptr,
        1 // Core 1
    );

    Serial.println("[System] FreeRTOS Multi-Core Architecture Initialized.");
}

void loop() {
    // Both subsystems run independently inside FreeRTOS tasks
    vTaskDelay(pdMS_TO_TICKS(1000));
}
