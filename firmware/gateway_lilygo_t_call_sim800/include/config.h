#pragma once
#include <Arduino.h>

/**
 * ============================================================================
 * GATEWAY CONFIGURATION & MQTT CREDENTIALS
 * ============================================================================
 */

// Cellular Network Configuration (Uzbekistan APN)
#define CELLULAR_APN                "internet"
#define CELLULAR_USER               ""
#define CELLULAR_PASS               ""

// Remote Server MQTT Broker (Dedicated Mosquitto at 170.168.60.245)
#define MQTT_BROKER_HOST            "170.168.60.245"
#define MQTT_BROKER_PORT            1883
#define MQTT_USERNAME               "public"
#define MQTT_PASSWORD               "Acdb@2026"
#define MQTT_CLIENT_ID_PREFIX       "Gateway_TCall_"

// Metadata Identifiers
#define GATEWAY_ID                  "GW-LILYGO-TCALL-SIM800"
#define BUILDING_ID                 "BLD-TASHKENT-MAIN"
#define DEFAULT_FLOOR_ID            1
#define DEFAULT_HUB_ID              "HUB-B1-FL01"

// MQTT Topic Architecture
#define TOPIC_TELEMETRY_PREFIX      "smartbuilding"
#define TOPIC_GATEWAY_STATUS        "smartbuilding/gateway/GW-LILYGO-TCALL-SIM800/status"
#define TOPIC_GATEWAY_CMD           "smartbuilding/gateway/GW-LILYGO-TCALL-SIM800/command"
#define TOPIC_GATEWAY_PAIRING       "smartbuilding/gateway/GW-LILYGO-TCALL-SIM800/pairing"

// FreeRTOS Buffer Limits
#define MAX_QUEUED_TELEMETRY        32

#define BLE_SCAN_INTERVAL_MS        100
#define BLE_SCAN_WINDOW_MS          99
#define BLE_SCAN_DURATION_SEC       5

// RS485 Industrial Bus Multi-Drop Architecture
// Configured to support buildings with 3 to 20 floor MCUs
#define RS485_MIN_FLOOR             1      // Lowest floor address (default 1)
#define RS485_MAX_FLOOR             20     // Highest floor address (up to 20 floors)
#define RS485_POLL_INTERVAL_MS      150    // Time gap between querying floor MCUs
#define RS485_REPLY_TIMEOUT_MS      250    // Response timeout per floor MCU
#define RS485_MAX_RETRIES           3      // Automatic retry attempts if packet lost or CRC error
#define RS485_BROADCAST_ADDR        255    // Broadcast address to all floor MCUs
