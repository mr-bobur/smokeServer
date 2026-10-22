#pragma once
#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <ArduinoJson.h>
#include "telemetry_data.h"

/**
 * ============================================================================
 * RS485 INDUSTRIAL MASTER BUS ENGINE
 * ============================================================================
 * Connects Gateway to 3 - 20 Floor MCUs (Sub-Hubs) via Half-Duplex RS485.
 * Features:
 *   - JSON Packet Framing with 16-bit CRC Checksum verification
 *   - Multi-Drop Addressing (Floors 1 to 20)
 *   - Automatic Request/Response Retry Engine (3 Retries on drop or CRC error)
 *   - Real-time Telemetry & Alarm Streaming to Cellular MQTT Pipeline
 *   - Downlink Pairing Mode Broadcast to all Floor MCUs
 * ============================================================================
 */

struct FloorHubDiagnostics {
    uint8_t floorNumber;
    bool isOnline;
    uint32_t lastSeenMs;
    uint32_t txPackets;
    uint32_t rxPackets;
    uint32_t crcErrors;
    uint32_t timeouts;
    float lastLatencyMs;
    bool hasActiveAlarm;
};

// CRC-16 Calculation (Modbus polynomial 0xA001)
uint16_t calculateCrc16(const uint8_t *data, size_t length);

// Initialization & Engine Lifecycle
void initRs485Master(QueueHandle_t telemetryQueue);
void runRs485MasterPollCycle();

// Downlink Broadcast Commands
void broadcastRs485PairingMode(bool enable, uint32_t windowSec);
void broadcastRs485AlarmSilence();

// Diagnostics Query
FloorHubDiagnostics getFloorDiagnostics(uint8_t floor);
uint8_t getActiveFloorsCount();
