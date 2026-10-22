#include "sht21_sensor.h"
#include <Wire.h>

static int g_sdaPin = 1;
static int g_sclPin = 2;

uint8_t calculateSht21Crc(const uint8_t *data, size_t len) {
    uint8_t crc = 0x00;
    for (size_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (uint8_t bit = 8; bit > 0; --bit) {
            if (crc & 0x80) {
                crc = (crc << 1) ^ 0x131; // CRC-8 polynomial: x^8 + x^5 + x^4 + 1
            } else {
                crc = (crc << 1);
            }
        }
    }
    return crc;
}

bool softResetSht21() {
    Wire.beginTransmission(SHT21_I2C_ADDRESS);
    Wire.write(SHT21_CMD_SOFT_RESET);
    uint8_t err = Wire.endTransmission();
    delay(20); // SHT21 soft reset requires <= 15ms
    return (err == 0);
}

bool initSht21(int sdaPin, int sclPin, uint32_t frequency) {
    g_sdaPin = sdaPin;
    g_sclPin = sclPin;

    Serial.printf("[SHT21] Initializing I2C bus on SDA: GPIO %d, SCL: GPIO %d at %u Hz...\n",
                  sdaPin, sclPin, (unsigned int)frequency);
    Wire.begin(sdaPin, sclPin, frequency);

    // Verify presence by checking I2C ACK
    Wire.beginTransmission(SHT21_I2C_ADDRESS);
    uint8_t err = Wire.endTransmission();

    if (err == 0) {
        softResetSht21();
        Serial.println("[SHT21] Sensor detected and verified on I2C address 0x40!");
        return true;
    } else {
        Serial.printf("[SHT21] Warning: Sensor not responding on 0x40 (I2C error code: %d). Check wiring!\n", err);
        return false;
    }
}

static bool readRawSht21(uint8_t command, uint16_t &outRaw, uint32_t waitMs) {
    Wire.beginTransmission(SHT21_I2C_ADDRESS);
    Wire.write(command);
    if (Wire.endTransmission() != 0) {
        return false;
    }

    delay(waitMs);

    if (Wire.requestFrom((uint8_t)SHT21_I2C_ADDRESS, (uint8_t)3) != 3) {
        return false;
    }

    uint8_t msb = Wire.read();
    uint8_t lsb = Wire.read();
    uint8_t crc = Wire.read();

    uint8_t payload[2] = {msb, lsb};
    if (calculateSht21Crc(payload, 2) != crc) {
        Serial.printf("[SHT21] CRC check failed for cmd 0x%02X! Raw: 0x%02X%02X, CRC: 0x%02X\n",
                      command, msb, lsb, crc);
        return false;
    }

    // Clear lower 2 status bits (bit 1: type, bit 0: reserved)
    outRaw = ((uint16_t)msb << 8) | (lsb & ~0x0003);
    return true;
}

Sht21Reading readSht21() {
    Sht21Reading r = { 0.0f, 0.0f, false, millis() };

    uint16_t rawTemp = 0;
    uint16_t rawHum = 0;

    // 1. Read Temperature (No-Hold Master, max 85ms conversion)
    bool tempOk = readRawSht21(SHT21_CMD_TRIGGER_TEMP_NOHOLD, rawTemp, 85);

    // 2. Read Humidity (No-Hold Master, max 30ms conversion)
    bool humOk = readRawSht21(SHT21_CMD_TRIGGER_HUM_NOHOLD, rawHum, 35);

    if (tempOk && humOk) {
        // Temperature Formula: T = -46.85 + 175.72 * (S_T / 2^16)
        r.temperature = -46.85f + 175.72f * ((float)rawTemp / 65536.0f);

        // Humidity Formula: RH = -6.0 + 125.0 * (S_RH / 2^16)
        r.humidity = -6.0f + 125.0f * ((float)rawHum / 65536.0f);
        if (r.humidity < 0.0f) r.humidity = 0.0f;
        if (r.humidity > 100.0f) r.humidity = 100.0f;

        r.isValid = true;
    } else {
        r.isValid = false;
        // Keep fallback safe values if sensor unattached during test bench run
        r.temperature = 24.5f;
        r.humidity = 45.0f;
    }

    return r;
}
