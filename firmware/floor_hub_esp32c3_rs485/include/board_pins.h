#pragma once
#include <Arduino.h>

/**
 * ============================================================================
 * ESP32-C3 FLOOR SUB-HUB HARDWARE PIN ASSIGNMENTS
 * ============================================================================
 * RS485 MAX485 Transceiver Pinout:
 *   - GPIO 20 (or RX pin) : RO (RX) <- MAX485 Receiver Out
 *   - GPIO 21 (or TX pin) : DI (TX) -> MAX485 Driver In
 *   - GPIO 7              : DE/RE   -> Transmit Enable (HIGH=TX, LOW=RX)
 *
 * DIP Switch Address Pins (Floors 1 - 20) with Internal Pullups:
 *   - SW1: GPIO 0
 *   - SW2: GPIO 1
 *   - SW3: GPIO 2
 *   - SW4: GPIO 3
 *   - SW5: GPIO 4 (Supports up to 32 floors: 2^5 = 32)
 *
 * Local Status LED:
 *   - GPIO 8
 * ============================================================================
 */

// MAX485 / SP485 Transceiver Pins
#define RS485_RX_PIN       20    // ESP32-C3 RX
#define RS485_TX_PIN       21    // ESP32-C3 TX
#define RS485_DE_RE_PIN    7     // MAX485 DE & RE (Active HIGH transmit)
#define RS485_BAUDRATE     115200

// 5-bit DIP Switch Address Inputs (Active LOW with pull-up)
#define DIP_SW1_PIN        0
#define DIP_SW2_PIN        1
#define DIP_SW3_PIN        2
#define DIP_SW4_PIN        3
#define DIP_SW5_PIN        4

// Status Indicator LED
#define STATUS_LED_PIN     8
