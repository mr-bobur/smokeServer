#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>

#include "config.h"
#include "board_pins.h"
#include "telemetry_data.h"
#include "ble_scanner.h"
#include "cellular_mqtt.h"
#include "buzzer_alarm.h"
#include "rs485_master.h"

// FreeRTOS Queue for passing decoded BLE and RS485 telemetry to Cellular/MQTT publisher
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
// Core 0: Dedicated FreeRTOS RS485 Master Bus Polling Task (3 to 20 Floors)
// -----------------------------------------------------------------------------
void rs485MasterTask(void* pvParameters) {
    Serial.println("[Task] RS485 Master Engine Started on Core " + String(xPortGetCoreID()));
    initRs485Master(telemetryQueue);

    while (true) {
        runRs485MasterPollCycle();
        vTaskDelay(pdMS_TO_TICKS(RS485_POLL_INTERVAL_MS));
    }
}

// -----------------------------------------------------------------------------
// Core 1: Dedicated FreeRTOS Cellular & MQTT Task
// -----------------------------------------------------------------------------
void cellularMqttTask(void* pvParameters) {
    Serial.println("[Task] Cellular & MQTT Task Started on Core " + String(xPortGetCoreID()));

    initCellularModem();
    if (connectCellularGprs()) {
        connectMqttBroker();
    }

    SensorTelemetry item;

    while (true) {
        maintainCellularMqtt();

        // Check if new sensor telemetry arrived from BLE scanner or RS485 floor bus
        if (xQueueReceive(telemetryQueue, &item, pdMS_TO_TICKS(100)) == pdTRUE) {
            Serial.printf("[Gateway Pipeline] Forwarding Telemetry for %s (Floor %d) to MQTT...\n",
                          item.chipId, item.floorId);
            publishTelemetryToMqtt(item);
        }

        vTaskDelay(pdMS_TO_TICKS(20));
    }
}

void setup() {
    Serial.begin(115200);
    delay(1500);

    Serial.println("\n======================================================================");
    Serial.println("  LILYGO T-CALL GATEWAY (ESP32 + SIM800L 2G GPRS + BLE + RS485 MASTER)");
    Serial.printf("  APN: '%s' | MQTT: %s:%d\n", CELLULAR_APN, MQTT_BROKER_HOST, MQTT_BROKER_PORT);
    Serial.printf("  RS485 Bus: Floors %d to %d (Max %d Floor Sub-Hubs)\n",
                  RS485_MIN_FLOOR, RS485_MAX_FLOOR, (RS485_MAX_FLOOR - RS485_MIN_FLOOR + 1));
    Serial.printf("  Buzzer Siren: GPIO %d (Direct GPIO drive, No Transistor)\n", BUZZER_PIN);
    Serial.println("======================================================================");

    // Initialize Alarm Buzzer
    initBuzzer();
    chirpBuzzer(1, 100); // Startup chirp confirmation

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
        rs485MasterTask,
        "RS485_Master",
        4096,
        nullptr,
        2,
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

    Serial.println("[System] FreeRTOS Tri-Task Architecture Initialized Successfully.");
}

void loop() {
    updateBuzzer();
    vTaskDelay(pdMS_TO_TICKS(20));
}
