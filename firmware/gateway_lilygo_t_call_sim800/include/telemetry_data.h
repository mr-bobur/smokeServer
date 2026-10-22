#pragma once
#include <Arduino.h>

/**
 * ============================================================================
 * SENSOR TELEMETRY PAYLOAD STRUCT
 * Passed from BLE Central Scanner task to Cellular MQTT publisher via FreeRTOS
 * ============================================================================
 */
struct SensorTelemetry {
    char chipId[16];           // E.g. "C3-B1F1DAA66D"
    char sensorType[24];       // E.g. "SMOKE_OPTICAL", "SMOKE_MQ2", "CO_MQ7"
    float primaryValue;        // E.g. 175.0
    char primaryUnit[10];      // E.g. "PPM", "%"
    float smokePpm;            // Smoke PPM
    float temperature;         // Deg C
    float coPpm;               // CO PPM
    uint8_t batteryLevel;      // 0 - 100%
    int rssi;                  // Signal strength (dBm)
    bool isAlarm;              // True if critical alarm
    uint32_t timestamp;        // Millis
    bool isIntroPacket;        // True if initial handshake / intro pairing packet
    char rawIntroHex[48];      // Raw packet hex string e.g. "AA FF ..."
    uint8_t floorId;           // Floor number (1 to 20)
    char hubId[24];            // Hub identifier e.g. "HUB-B1-FL03"
};
