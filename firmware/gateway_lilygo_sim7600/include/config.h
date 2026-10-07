#pragma once
#include <Arduino.h>

/**
 * ============================================================================
 * GATEWAY CONFIGURATION & NETWORK CREDENTIALS
 * ============================================================================
 */

// 1. Cellular Network APN Configuration (Uzbekistan: Ucell, Beeline, Mobiuz, Uztelecom)
#define CELLULAR_APN            "internet"
#define CELLULAR_USER           ""
#define CELLULAR_PASS           ""

// 2. MQTT Broker Configuration
// Connected to your cloud production server
#define MQTT_BROKER_HOST        "170.168.60.245"  // Production Server Host IP
#define MQTT_BROKER_PORT        1883
#define MQTT_CLIENT_ID_PREFIX   "GW_LILYGO_SIM7600_"
#define MQTT_USERNAME           "public"
#define MQTT_PASSWORD           "Acdb@2026"

// 3. Smart Building Topology Identity
#define GATEWAY_ID              "GATEWAY-CENTRAL-01"
#define BUILDING_ID             1
#define DEFAULT_FLOOR_ID        1
#define DEFAULT_HUB_ID          "HUB-B1-FL01"

// 4. MQTT Topic Architecture (Conforming to Smart Building Backend)
#define TOPIC_TELEMETRY_PREFIX  "smartbuilding"
#define TOPIC_GATEWAY_STATUS    "smartbuilding/gateway/GATEWAY-CENTRAL-01/status"
#define TOPIC_GATEWAY_CMD       "smartbuilding/gateway/GATEWAY-CENTRAL-01/cmd"

// 5. BLE Scanner Parameters
#define BLE_SCAN_INTERVAL_MS    100
#define BLE_SCAN_WINDOW_MS      99
#define BLE_SCAN_DURATION_SEC   10

// 6. FreeRTOS Queue Capacity
#define MAX_QUEUED_TELEMETRY    32
