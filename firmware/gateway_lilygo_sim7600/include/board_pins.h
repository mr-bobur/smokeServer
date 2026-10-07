#pragma once
#include <Arduino.h>

/**
 * ============================================================================
 * LILYGO T-SIM7600 / T-SIM7600-S3 HARDWARE PIN ASSIGNMENTS
 * ============================================================================
 */

#if defined(BOARD_LILYGO_S3)
    // LilyGO T-SIM7670G-S3 / T-SIM7600-S3 (ESP32-S3 Core)
    #define MODEM_TX_PIN        5      // ESP32-S3 TX -> SIM7600 RX
    #define MODEM_RX_PIN        4      // ESP32-S3 RX <- SIM7600 TX
    #define MODEM_PWRKEY_PIN    12     // Power Key (Pulse HIGH/LOW to power on)
    #define MODEM_DTR_PIN       42     // Data Terminal Ready
    #define MODEM_RI_PIN        3      // Ring Indicator (Call/SMS interrupt)
    #define BOARD_POWERON_PIN   -1     // Power enable pin if present
    #define LED_PIN             1      // On-board user status LED

#elif defined(BOARD_LILYGO_ESP32)
    // LilyGO T-SIM7600X (Classic ESP32-WROVER-B Core)
    #define MODEM_TX_PIN        27     // ESP32 TX -> SIM7600 RX
    #define MODEM_RX_PIN        26     // ESP32 RX <- SIM7600 TX
    #define MODEM_PWRKEY_PIN    4      // Power Key (Pulse HIGH/LOW)
    #define MODEM_DTR_PIN       25     // Sleep control
    #define MODEM_RI_PIN        33     // Ring Indicator
    #define BOARD_POWERON_PIN   12     // Modem LDO Power Switch
    #define LED_PIN             12     // Blue LED

#else
    // Default Fallback
    #define MODEM_TX_PIN        27
    #define MODEM_RX_PIN        26
    #define MODEM_PWRKEY_PIN    4
    #define MODEM_DTR_PIN       -1
    #define MODEM_RI_PIN        -1
    #define BOARD_POWERON_PIN   -1
    #define LED_PIN             -1
#endif

#define MODEM_BAUDRATE          115200
