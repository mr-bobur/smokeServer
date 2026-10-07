#pragma once
#include <Arduino.h>

/**
 * Endpoint Telemetry Record for FreeRTOS Inter-Task Queue
 */
struct SensorTelemetry {
    char chipId[24];
    char sensorType[16];
    float primaryValue;
    char primaryUnit[10];
    float smokePpm;
    float temperature;
    float coPpm;
    uint8_t batteryLevel;
    bool isAlarm;
    int8_t rssi;
    uint32_t timestamp;
};
