#pragma once
#include <Arduino.h>

/**
 * ============================================================================
 * GATEWAY ALARM BUZZER CONTROLLER (DIRECT GPIO DRIVE - NO TRANSISTOR)
 * ============================================================================
 * Hardware Wiring:
 *   - Pin (-) -> GND
 *   - Pin (+) -> GPIO 19 (BUZZER_PIN in board_pins.h)
 *
 * Designed to safely drive 3.3V active or passive piezos without exceeding
 * ESP32 GPIO current limits, featuring zero-chirp startup, non-blocking siren
 * cadences, and audible chirps for installer pairing mode feedback.
 * ============================================================================
 */

void initBuzzer();
void setAlarmBuzzerState(bool active);
bool isAlarmBuzzerActive();
void chirpBuzzer(uint8_t count = 1, uint16_t durationMs = 80);
void updateBuzzer();
