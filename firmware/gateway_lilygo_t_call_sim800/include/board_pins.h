#pragma once
#include <Arduino.h>

/**
 * ============================================================================
 * LILYGO T-CALL (ESP32 + SIMCOM SIM800L) HARDWARE PIN ASSIGNMENTS
 * ============================================================================
 * Official Reference: LilyGO T-Call V1.3 / V1.4 (IP5306 / AXP Power Management)
 *
 * ESP32 Pin  | Hardware / Peripherals
 * -----------+---------------------------------------------------------------
 * GPIO 26    | SIM800L TX (ESP32 UART1 RX)
 * GPIO 27    | SIM800L RX (ESP32 UART1 TX)
 * GPIO 4     | SIM800L PWRKEY (Pulse LOW for >1s to turn ON)
 * GPIO 23    | SIM800L POWER_ON (LDO Enable - Set HIGH to power modem)
 * GPIO 5     | SIM800L RST (Reset - Keep HIGH)
 * GPIO 32    | SIM800L DTR (Sleep Control)
 * GPIO 33    | SIM800L RI (Ring Indicator)
 * GPIO 21    | I2C SDA (IP5306 Power Management IC at 0x75)
 * GPIO 22    | I2C SCL (IP5306 Power Management IC at 0x75)
 * GPIO 13    | Onboard Blue User LED
 * ============================================================================
 */

// SIM800L UART Pins
#define MODEM_RX_PIN             26    // ESP32 RX <- SIM800L TX
#define MODEM_TX_PIN             27    // ESP32 TX -> SIM800L RX
#define MODEM_BAUDRATE           115200

// SIM800L Power & Control Pins
#define MODEM_PWRKEY_PIN         4     // Active LOW pulse
#define MODEM_POWER_ON_PIN       23    // LDO Enable pin (HIGH = ON)
#define MODEM_RST_PIN            5     // Reset pin (HIGH = Normal)
#define MODEM_DTR_PIN            32    // Sleep mode control
#define MODEM_RI_PIN             33    // Call/SMS interrupt

// I2C Power Management (IP5306)
#define I2C_SDA_PIN              21
#define I2C_SCL_PIN              22
#define IP5306_I2C_ADDR          0x75
#define IP5306_REG_SYS_CTL0      0x00

// Status Indicator LED
#define LED_PIN                  13
