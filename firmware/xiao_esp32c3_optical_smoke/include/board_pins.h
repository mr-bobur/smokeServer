#pragma once
#include <Arduino.h>

/**
 * ============================================================================
 * SEEED STUDIO XIAO ESP32-C3 PINOUT MAPPING FOR OPTICAL SMOKE DETECTOR
 * ============================================================================
 * Replaces the 8-pin onboard MCU of a standard photoelectric smoke detector.
 *
 * Xiao ESP32-C3 Pin   | ESP32-C3 GPIO | Function
 * --------------------+---------------+---------------------------------------
 * D1 / A1             | GPIO3         | IR Receiver / Photodiode (ADC1_CH3)
 * D2 / A2             | GPIO4         | IR Transmitter LED Drive (Pulse Output)
 * D3 / A3             | GPIO5         | Buzzer / Piezo Alarm Output (Active LOW)
 * D4                  | GPIO6         | Status Indicator LED (Active LOW)
 * D9                  | GPIO9         | Xiao Onboard BOOT Button (Test / Calib)
 * D0 / A0             | GPIO2         | UNUSED (Avoids boot strapping conflict)
 * 3V3                 | 3.3V Power    | Sensor VCC (or through onboard regulator)
 * GND                 | GND           | Common Ground
 * ============================================================================
 */

// Optical Smoke Chamber Pins (Avoided strapping pin GPIO2/D0)
#define PIN_IR_RX_ADC        3   // Xiao D1 (GPIO3) -> Photodiode / Receiver analog input (ADC1_CH3)
#define PIN_IR_TX            4   // Xiao D2 (GPIO4) -> IR Emitter LED pulse drive

// User Feedback & Controls
#define PIN_ALARM_BUZZER     5   // Xiao D3 (GPIO5) -> Alarm Buzzer (Active LOW via transistor)
#define PIN_STATUS_LED       6   // Xiao D4 (GPIO6) -> Visual Status LED (Active LOW)
#define PIN_TEST_BTN         9   // Xiao D9 (GPIO9) -> Built-in BOOT button (Active LOW)

// Polarity Configurations (Inverted for active-low transistor & LED circuits)
#define IR_LED_ACTIVE_LEVEL      HIGH

// Status Indicator LED Logic (Active LOW: LOW = ON, HIGH = OFF)
#define STATUS_LED_ACTIVE_LEVEL  LOW

// Buzzer drive mode:
// Active buzzer controlled via transistor (Active LOW: LOW = Sound ON, HIGH = Silent OFF)
#define BUZZER_IS_PASSIVE        false
#define BUZZER_PWM_FREQ_HZ       2700
#define BUZZER_ACTIVE_LEVEL      LOW
