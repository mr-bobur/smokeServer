#pragma once
#include <Arduino.h>

/**
 * ============================================================================
 * OPTICAL SMOKE DETECTOR CONFIGURATION & CALIBRATION CONSTANTS
 * ============================================================================
 */

// Strobe & Sampling Timing
#define IR_PULSE_DURATION_US         350    // IR LED on-time in microseconds (100-500us)
#define ADC_OVERSAMPLE_COUNT         16     // ADC averaging samples per reading
#define SAMPLE_INTERVAL_NORMAL_MS    800    // Sampling rate in clear air
#define SAMPLE_INTERVAL_ALARM_MS     250    // Sampling rate when smoke/alarm active

// Thresholds & Signal Processing
// ESP32-C3 ADC resolution is 12-bit (0 - 4095 counts).
// Delta = (Photodiode ADC during IR Pulse) - (Photodiode ADC in Ambient Dark).
// Clean Air Baseline Delta: typically 20 - 150 counts (internal chamber wall bounce).
// Smoke Entering Chamber: Delta jumps by +300 to +2000 counts!
#define DEFAULT_SMOKE_THRESHOLD_ADC  350    // Delta above baseline to trigger alarm
#define ALARM_CONFIRM_CYCLES         2      // Consecutive alarm readings to sound alarm

// BLE Beacon Broadcasting (Ecosystem Compatible)
#define BLE_DEVICE_NAME              "XIAO-C3-SMOKE"
#define BLE_MFG_TYPE_SMOKE           0x01   // Standard Smoke sensor type
#define BLE_BEACON_INTERVAL_NORMAL   10     // Seconds between regular BLE updates
#define BLE_BEACON_INTERVAL_ALARM    1      // Seconds between urgent alarm broadcasts

// NVS Storage Namespace
#define NVS_NAMESPACE                "smoke_opt"
