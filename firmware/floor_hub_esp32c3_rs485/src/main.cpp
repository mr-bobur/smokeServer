#include <Arduino.h>
#include <ArduinoJson.h>
#include "board_pins.h"
#include "config.h"

static uint8_t g_floorAddress = DEFAULT_HARDWARE_FLOOR;
static char g_hubId[24] = {0};
static bool g_hasAlarm = false;
static bool g_pairingModeActive = false;
static uint32_t g_pairingUntilMs = 0;

uint16_t calculateCrc16(const uint8_t *data, size_t length) {
    uint16_t crc = 0xFFFF;
    for (size_t i = 0; i < length; i++) {
        crc ^= (uint16_t)data[i];
        for (uint8_t j = 0; j < 8; j++) {
            if (crc & 0x0001) {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc >>= 1;
            }
        }
    }
    return crc;
}

uint8_t readFloorAddress() {
    uint8_t addr = (!digitalRead(DIP_SW1_PIN) << 0) |
                   (!digitalRead(DIP_SW2_PIN) << 1) |
                   (!digitalRead(DIP_SW3_PIN) << 2) |
                   (!digitalRead(DIP_SW4_PIN) << 3) |
                   (!digitalRead(DIP_SW5_PIN) << 4);

    if (addr < 1 || addr > 20) {
        return DEFAULT_HARDWARE_FLOOR;
    }
    return addr;
}

void sendRs485Response(JsonDocument& doc) {
    doc.remove("crc");
    String raw;
    serializeJson(doc, raw);
    uint16_t crc = calculateCrc16((const uint8_t*)raw.c_str(), raw.length());

    char crcHex[8];
    snprintf(crcHex, sizeof(crcHex), "%04X", crc);
    doc["crc"] = crcHex;

    String line;
    serializeJson(doc, line);
    line += "\n";

    // Enable MAX485 Transceiver Output
    digitalWrite(RS485_DE_RE_PIN, HIGH);
    delayMicroseconds(60);
    Serial1.print(line);
    Serial1.flush();
    delayMicroseconds(60);
    // Return to Receive Mode
    digitalWrite(RS485_DE_RE_PIN, LOW);
}

void handleIncomingGatewayFrame(const String& line) {
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, line);
    if (err) {
        return; // ignore malformed frames
    }

    // Verify CRC
    if (!doc["crc"].is<const char*>()) {
        return;
    }

    const char* receivedCrcStr = doc["crc"];
    uint16_t receivedCrc = (uint16_t)strtoul(receivedCrcStr, nullptr, 16);

    doc.remove("crc");
    String checkStr;
    serializeJson(doc, checkStr);
    uint16_t calculatedCrc = calculateCrc16((const uint8_t*)checkStr.c_str(), checkStr.length());

    if (receivedCrc != calculatedCrc) {
        Serial.printf("[RS485 Floor %d] CRC Mismatch! Expected 0x%04X, got 0x%04X\n",
                      g_floorAddress, calculatedCrc, receivedCrc);
        return;
    }

    uint8_t target = doc["target"] | 0;

    // Check if packet is addressed to this floor (or broadcast 255)
    if (target != g_floorAddress && target != 255) {
        return; // Not for this floor
    }

    const char* cmd = doc["cmd"];
    if (cmd == nullptr) return;

    // 1. Central Gateway Polling Query
    if (strcmp(cmd, "POLL") == 0) {
        JsonDocument resp;
        resp["sender"] = g_floorAddress;
        resp["target"] = 0; // 0 = Gateway Master
        resp["type"] = "TELEMETRY";
        resp["seq"] = doc["seq"] | 0;
        resp["hub_id"] = g_hubId;
        resp["status"] = "online";
        resp["alarm"] = g_hasAlarm;

        JsonArray sensors = resp["sensors"].to<JsonArray>();

        // Sample floor optical smoke & environmental sensor payload
        JsonObject s1 = sensors.add<JsonObject>();
        char chipBuf[20];
        snprintf(chipBuf, sizeof(chipBuf), "C3-FL%02d-OPT01", g_floorAddress);
        s1["chip_id"] = chipBuf;
        s1["type"] = "SMOKE_OPTICAL";
        s1["val"] = g_hasAlarm ? 420.0f : 24.5f;
        s1["unit"] = "PPM";
        s1["smoke_ppm"] = s1["val"];
        s1["temperature"] = 24.2f;
        s1["battery"] = 98;
        s1["alarm"] = g_hasAlarm;

        // If pairing mode captured intro packet, forward it upstream
        if (g_pairingModeActive && millis() < g_pairingUntilMs) {
            s1["is_intro"] = true;
            s1["raw_intro_hex"] = "AA FF 2A 99 B4 E1 01 62 C4 9B 55";
        }

        sendRs485Response(resp);
    }
    // 2. Broadcast Pairing Mode from Gateway
    else if (strcmp(cmd, "ENABLE_PAIRING_MODE") == 0) {
        uint32_t windowSec = doc["window_sec"] | 60;
        g_pairingModeActive = true;
        g_pairingUntilMs = millis() + (windowSec * 1000UL);
        Serial.printf("[RS485 Floor %d] Entered Pairing Mode for %u sec\n", g_floorAddress, windowSec);
    }
    // 3. Cancel Pairing Mode
    else if (strcmp(cmd, "CANCEL_PAIRING_MODE") == 0) {
        g_pairingModeActive = false;
        Serial.printf("[RS485 Floor %d] Pairing Mode Cancelled\n", g_floorAddress);
    }
    // 4. Alarm Silence / Reset
    else if (strcmp(cmd, "SILENCE_ALARM") == 0) {
        g_hasAlarm = false;
        Serial.printf("[RS485 Floor %d] Alarm Silenced\n", g_floorAddress);
    }
}

void setup() {
    Serial.begin(115200);

    // Initialize DIP Switch Pins
    pinMode(DIP_SW1_PIN, INPUT_PULLUP);
    pinMode(DIP_SW2_PIN, INPUT_PULLUP);
    pinMode(DIP_SW3_PIN, INPUT_PULLUP);
    pinMode(DIP_SW4_PIN, INPUT_PULLUP);
    pinMode(DIP_SW5_PIN, INPUT_PULLUP);

    // Initialize RS485 Transceiver Controls
    pinMode(RS485_DE_RE_PIN, OUTPUT);
    digitalWrite(RS485_DE_RE_PIN, LOW); // Receive mode

    // Start Hardware Serial1 for RS485 Bus
    Serial1.begin(RS485_BAUDRATE, SERIAL_8N1, RS485_RX_PIN, RS485_TX_PIN);

    pinMode(STATUS_LED_PIN, OUTPUT);
    digitalWrite(STATUS_LED_PIN, LOW);

    g_floorAddress = readFloorAddress();
    snprintf(g_hubId, sizeof(g_hubId), "%s%02d", HUB_ID_PREFIX, g_floorAddress);

    delay(500);
    Serial.printf("\n=======================================================\n");
    Serial.printf("  ESP32-C3 FLOOR SUB-HUB INITIALIZED\n");
    Serial.printf("  Floor Hardware Address: %d (Range: 1 - 20)\n", g_floorAddress);
    Serial.printf("  Hub Identity: %s\n", g_hubId);
    Serial.printf("  RS485 RX:%d, TX:%d, DE_RE:%d at %d baud\n",
                  RS485_RX_PIN, RS485_TX_PIN, RS485_DE_RE_PIN, RS485_BAUDRATE);
    Serial.printf("=======================================================\n");
}

String g_rxBuffer = "";

void loop() {
    // Listen for incoming frames from Central Gateway
    while (Serial1.available()) {
        char c = (char)Serial1.read();
        if (c == '\n') {
            g_rxBuffer.trim();
            if (g_rxBuffer.length() > 0) {
                handleIncomingGatewayFrame(g_rxBuffer);
            }
            g_rxBuffer = "";
        } else if (c != '\r') {
            g_rxBuffer += c;
            if (g_rxBuffer.length() > 512) {
                g_rxBuffer = "";
            }
        }
    }

    // Auto-expire pairing mode
    if (g_pairingModeActive && millis() > g_pairingUntilMs) {
        g_pairingModeActive = false;
    }

    delay(2);
}
