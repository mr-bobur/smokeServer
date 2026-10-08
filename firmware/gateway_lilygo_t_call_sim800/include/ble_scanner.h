#pragma once
#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include "telemetry_data.h"

void initBleScanner(QueueHandle_t outQueue);
void runBleScanCycle();
