#pragma once
#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include "telemetry_data.h"

extern QueueHandle_t g_telemetryQueue;

void initBleScanner(QueueHandle_t telemetryQueue);
void runBleScanCycle();
