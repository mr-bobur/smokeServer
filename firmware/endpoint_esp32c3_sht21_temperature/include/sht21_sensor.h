#pragma once
#include <Arduino.h>

/**
 * ============================================================================
 * SENSIRION SHT21 / HTU21D I2C DIGITAL SENSOR DRIVER
 * High precision Temperature & Relative Humidity with CRC8 Validation
 * ============================================================================
 */

#define SHT21_I2C_ADDRESS             0x40

// Command Codes (No Hold Master to avoid ESP32 clock stretching hangs)
#define SHT21_CMD_TRIGGER_TEMP_NOHOLD 0xF3
#define SHT21_CMD_TRIGGER_HUM_NOHOLD  0xF5
#define SHT21_CMD_SOFT_RESET          0xFE

struct Sht21Reading {
    float temperature;         // Deg C (-40.0 to +125.0)
    float humidity;            // %RH (0.0 to 100.0)
    bool isValid;              // True if I2C and CRC passed
    uint32_t readTimestampMs;  // Millis timestamp
};

bool initSht21(int sdaPin, int sclPin, uint32_t frequency = 100000);
bool softResetSht21();
Sht21Reading readSht21();
uint8_t calculateSht21Crc(const uint8_t *data, size_t len);
