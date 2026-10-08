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

// FreeRTOS Buffer Limits
#define MAX_QUEUED_TELEMETRY        32

// BLE Scanning Engine Parameters
#define BLE_SCAN_INTERVAL_MS        100
#define BLE_SCAN_WINDOW_MS          99
#define BLE_SCAN_DURATION_SEC       5
