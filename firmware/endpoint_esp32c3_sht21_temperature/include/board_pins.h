#pragma once
#include <Arduino.h>

/**
 * ============================================================================
 * LILYGO T-ZIGBEE (ESP32-C3) HARDWARE PIN DEFINITIONS
 * ============================================================================
 * Onboard Peripherals:
 *   - GPIO 2 : Onboard User / KEY Button (Active LOW with internal pull-up)
 *   - GPIO 3 : Onboard Blue Status LED (Active HIGH)
 *   - GPIO 0 : Telink TLSR8258 Zigbee chip power pin (Set LOW to disable TLSR8258)
 *
 * External Sensor Breakout (I2C Bus for SHT21 Module):
 *   - GPIO 4 : I2C SDA (Data Line)
 *   - GPIO 5 : I2C SCL (Clock Line)
 * ============================================================================
 */

#define PIN_KEY_BTN          2   // Onboard User KEY button (Active LOW, shared with SCL)
#define PIN_BOOT_BTN         9   // ESP32-C3 Native BOOT button (Active LOW)
#define PIN_BLUE_LED         3   // Onboard Blue Status LED (Active HIGH)
#define PIN_ZIGBEE_PWR       0   // TLSR8258 Power Control (LOW = Off, HIGH = On)

// I2C Bus for SHT21 Temperature & Humidity Sensor (Updated: 01 SDA, 02 SCL)
#define PIN_SHT21_SDA        1   // GPIO 1 -> SHT21 SDA
#define PIN_SHT21_SCL        2   // GPIO 2 -> SHT21 SCL (CLS)
#define SHT21_I2C_FREQ       100000 // Standard 100 kHz I2C clock
