#pragma once
#include <Arduino.h>

/**
 * ============================================================================
 * SHT21 TEMPERATURE & HUMIDITY ENDPOINT CONFIGURATION CONSTANTS
 * ============================================================================
 */

// BLE Ecosystem Identifiers
#define BLE_DEVICE_NAME               "TZIG-C3-TEMP"
#define BLE_MFG_TYPE_TEMP             0x02   // Standard Ecosystem Temperature sensor type (TEMP_DS18B20/SHT21)

// Temperature Thresholds & Alarm Calibration
#define DEFAULT_TEMP_ALARM_C          50.0f  // Critical High Temperature Alarm Threshold (°C)
#define DEFAULT_TEMP_HYSTERESIS_C     2.0f   // Hysteresis for alarm recovery (clears when Temp <= 48.0°C)

// Sampling & Transmission Timing
#define SAMPLE_INTERVAL_NORMAL_MS     5000   // Sensor sample interval in normal state (5 seconds)
#define SAMPLE_INTERVAL_ALARM_MS      1000   // Accelerated sample interval during alarm (1 second)
#define BLE_BEACON_INTERVAL_NORMAL    30     // Seconds between regular keep-alive BLE updates (30 seconds)
#define BLE_BEACON_INTERVAL_ALARM     1      // Seconds between urgent alarm broadcasts (1 second)
#define ALARM_BURST_COUNT             3      // Transmit 3 consecutive bursts on alarm / recovery

// Commissioning & Initial Connection (Pairing) Configuration
#define KEY_LONG_PRESS_MS             5000   // 5.0 seconds hold on KEY button triggers restart & pairing algorithm
#define PAIRING_WINDOW_SEC            30     // Pairing advertisement active duration (30 seconds)
#define PAIRING_INTRO_BURST_COUNT     5      // Number of initial handshake intro bursts transmitted

// NVS Persistent Storage Namespace
#define NVS_NAMESPACE                 "tzig_temp"
