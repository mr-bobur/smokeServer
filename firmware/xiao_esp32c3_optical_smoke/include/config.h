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
#define SAMPLE_INTERVAL_NORMAL_MS    1000   // Sampling rate in clear air (5 seconds test time)
#define SAMPLE_INTERVAL_ALARM_MS     500    // Fast sampling rate when smoke detected
#define DEFAULT_SMOKE_THRESHOLD_ADC  350    // Delta above baseline to trigger alarm
#define ALARM_CONFIRM_CYCLES         2      // 2 consecutive checks to confirm alarm

// BLE Beacon Broadcasting (Ecosystem Compatible)
#define BLE_DEVICE_NAME              "XIAO-C3-SMOKE"
#define BLE_MFG_TYPE_SMOKE           0x01   // Standard Smoke sensor type
#define BLE_BEACON_INTERVAL_NORMAL   20     // Seconds between regular BLE updates
#define BLE_BEACON_INTERVAL_ALARM    1      // Seconds between urgent alarm broadcasts

// NVS Storage Namespace
#define NVS_NAMESPACE                "smoke_opt"
