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
 * D0 / A0             | GPIO2         | IR Receiver / Photodiode (ADC1_CH2)
 * D1 / A1             | GPIO3         | IR Transmitter LED Drive (Pulse Output)
 * D2 / A2             | GPIO4         | Buzzer / Piezo Alarm Output
 * D3 / A3             | GPIO5         | External / Status Indicator LED
 * D9                  | GPIO9         | Xiao Onboard BOOT Button (Test / Calib)
 * 3V3                 | 3.3V Power    | Sensor VCC (or through onboard regulator)
 * GND                 | GND           | Common Ground
 * ============================================================================
 */

// Optical Smoke Chamber Pins
#define PIN_IR_RX_ADC        2   // Xiao D0 (GPIO2) -> Photodiode / Receiver analog input
#define PIN_IR_TX            3   // Xiao D1 (GPIO3) -> IR Emitter LED pulse drive

// User Feedback & Controls
#define PIN_ALARM_BUZZER     4   // Xiao D2 (GPIO4) -> Alarm Buzzer / Piezo driver
#define PIN_STATUS_LED       5   // Xiao D3 (GPIO5) -> Visual Status LED
#define PIN_TEST_BTN         9   // Xiao D9 (GPIO9) -> Built-in BOOT button (Active LOW)

// Polarity Configurations (Customize based on original PCB circuit)
// If IR LED cathode is pulled to GND by MCU pin, set ACTIVE_LEVEL to HIGH.
// If IR LED is driven via PNP transistor or pulled down to VCC, set to LOW.
#define IR_LED_ACTIVE_LEVEL      HIGH

// Buzzer drive mode:
// Set to true if buzzer is a passive piezo disc requiring a PWM frequency (e.g. 2.7kHz - 4kHz)
// Set to false if buzzer is an active DC buzzer (HIGH = sound, LOW = silent)
#define BUZZER_IS_PASSIVE        false
#define BUZZER_PWM_FREQ_HZ       2700
#define BUZZER_ACTIVE_LEVEL      HIGH
