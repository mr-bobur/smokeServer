#include "rs485_master.h"
#include "board_pins.h"
#include "config.h"
#include "buzzer_alarm.h"

static QueueHandle_t g_rs485TelemetryQueue = nullptr;
static uint32_t g_rs485Seq = 1;
static uint8_t g_currentPollingFloor = RS485_MIN_FLOOR;

static FloorHubDiagnostics g_floorStats[RS485_MAX_FLOOR + 1];

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

static bool sendRs485JsonPacket(JsonDocument& doc) {
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

    // Flush any pending noise on RX line before sending
    while (Serial2.available()) {
        Serial2.read();
    }

    digitalWrite(RS485_DE_RE_PIN, HIGH); // Transmit Mode
    delayMicroseconds(60);
    Serial2.print(line);
    Serial2.flush();
    delayMicroseconds(60);
    digitalWrite(RS485_DE_RE_PIN, LOW);  // Return to Receive Mode

    return true;
}

static bool receiveRs485JsonPacket(JsonDocument& doc, uint32_t timeoutMs) {
    uint32_t startMs = millis();
    String line = "";

    while (millis() - startMs < timeoutMs) {
        while (Serial2.available()) {
            char c = (char)Serial2.read();
            if (c == '\n') {
                line.trim();
                if (line.length() > 0) {
                    goto parse_line;
                }
            } else if (c != '\r') {
                line += c;
                if (line.length() > 512) {
                    line = ""; // avoid overflow on garbage noise
                }
            }
        }
        vTaskDelay(pdMS_TO_TICKS(5));
    }
    return false; // Timeout

parse_line:
    DeserializationError err = deserializeJson(doc, line);
    if (err) {
        Serial.printf("[RS485 Parse Error] %s | Line: %s\n", err.c_str(), line.c_str());
        return false;
    }

    if (!doc["crc"].is<const char*>()) {
        Serial.printf("[RS485 CRC] Missing 'crc' field in frame: %s\n", line.c_str());
        return false;
    }

    const char* receivedCrcStr = doc["crc"];
    uint16_t receivedCrc = (uint16_t)strtoul(receivedCrcStr, nullptr, 16);

    doc.remove("crc");
    String checkStr;
    serializeJson(doc, checkStr);
    uint16_t calculatedCrc = calculateCrc16((const uint8_t*)checkStr.c_str(), checkStr.length());

    doc["crc"] = receivedCrcStr; // restore crc

    if (receivedCrc != calculatedCrc) {
        Serial.printf("[RS485 CRC MISMATCH] Expected 0x%04X, Received 0x%04X\n", calculatedCrc, receivedCrc);
        return false;
    }

    return true;
}

void initRs485Master(QueueHandle_t telemetryQueue) {
    g_rs485TelemetryQueue = telemetryQueue;

    pinMode(RS485_DE_RE_PIN, OUTPUT);
    digitalWrite(RS485_DE_RE_PIN, LOW); // Default to Receive Mode

    Serial2.begin(RS485_BAUDRATE, SERIAL_8N1, RS485_RX_PIN, RS485_TX_PIN);

    for (uint8_t f = 0; f <= RS485_MAX_FLOOR; f++) {
        g_floorStats[f].floorNumber = f;
        g_floorStats[f].isOnline = false;
        g_floorStats[f].lastSeenMs = 0;
        g_floorStats[f].txPackets = 0;
        g_floorStats[f].rxPackets = 0;
        g_floorStats[f].crcErrors = 0;
        g_floorStats[f].timeouts = 0;
        g_floorStats[f].lastLatencyMs = 0.0f;
        g_floorStats[f].hasActiveAlarm = false;
    }

    Serial.printf("[RS485 Master] Initialized on RX:%d, TX:%d, DE_RE:%d at %d baud\n",
                  RS485_RX_PIN, RS485_TX_PIN, RS485_DE_RE_PIN, RS485_BAUDRATE);
    Serial.printf("[RS485 Master] Configured for Floors %d to %d (Max %d Nodes)\n",
                  RS485_MIN_FLOOR, RS485_MAX_FLOOR, (RS485_MAX_FLOOR - RS485_MIN_FLOOR + 1));
}

void runRs485MasterPollCycle() {
    uint8_t targetFloor = g_currentPollingFloor;

    // Advance round-robin pointer for next poll cycle
    g_currentPollingFloor++;
    if (g_currentPollingFloor > RS485_MAX_FLOOR) {
        g_currentPollingFloor = RS485_MIN_FLOOR;
    }

    bool success = false;
    uint8_t attempt = 0;

    while (!success && attempt < RS485_MAX_RETRIES) {
        attempt++;

        JsonDocument pollDoc;
        pollDoc["cmd"] = "POLL";
        pollDoc["target"] = targetFloor;
        pollDoc["sender"] = 0; // 0 = Central Gateway Master
        pollDoc["seq"] = g_rs485Seq++;
        pollDoc["attempt"] = attempt;
        pollDoc["timestamp"] = millis();

        g_floorStats[targetFloor].txPackets++;

        uint32_t tStart = millis();
        sendRs485JsonPacket(pollDoc);

        JsonDocument respDoc;
        if (receiveRs485JsonPacket(respDoc, RS485_REPLY_TIMEOUT_MS)) {
            uint32_t tLatency = millis() - tStart;
            g_floorStats[targetFloor].rxPackets++;
            g_floorStats[targetFloor].lastLatencyMs = (float)tLatency;
            g_floorStats[targetFloor].lastSeenMs = millis();
            g_floorStats[targetFloor].isOnline = true;
            success = true;

            // Extract Hub and Floor identity
            uint8_t respFloor = respDoc["sender"] | targetFloor;
            const char* hubId = respDoc["hub_id"] | "HUB-B1-FLxx";
            bool isAlarm = respDoc["alarm"] | false;

            g_floorStats[targetFloor].hasActiveAlarm = isAlarm;

            // 1. If Floor MCU reports Alarm, immediately sound Gateway Buzzer!
            if (isAlarm) {
                setAlarmBuzzerState(true);
                Serial.printf("\n[RS485 CRITICAL ALARM] Received Emergency Alarm from Floor %d (%s)!\n\n",
                              respFloor, hubId);
            }

            // 2. Ingest Floor Telemetry / Sensors and push into Gateway Pipeline
            if (respDoc["sensors"].is<JsonArray>()) {
                JsonArray sensors = respDoc["sensors"].as<JsonArray>();
                for (JsonObject s : sensors) {
                    SensorTelemetry item = {};
                    item.floorId = respFloor;
                    strncpy(item.hubId, hubId, sizeof(item.hubId));

                    const char* chip = s["chip_id"] | "C3-UNKNOWN";
                    strncpy(item.chipId, chip, sizeof(item.chipId));

                    const char* type = s["type"] | "SMOKE_OPTICAL";
                    strncpy(item.sensorType, type, sizeof(item.sensorType));

                    item.primaryValue = s["val"] | 0.0f;
                    const char* unit = s["unit"] | "PPM";
                    strncpy(item.primaryUnit, unit, sizeof(item.primaryUnit));

                    item.smokePpm = s["smoke_ppm"] | item.primaryValue;
                    item.temperature = s["temperature"] | s["temp"] | 24.5f;
                    item.coPpm = s["co_ppm"] | 2.0f;
                    item.batteryLevel = s["battery"] | s["battery_pct"] | 95;
                    item.rssi = s["rssi"] | -50;
                    item.isAlarm = s["alarm"] | isAlarm;
                    item.timestamp = millis() / 1000;

                    if (s["is_intro"] | false) {
                        item.isIntroPacket = true;
                        const char* rawHex = s["raw_intro_hex"] | "";
                        strncpy(item.rawIntroHex, rawHex, sizeof(item.rawIntroHex));
                    }

                    if (g_rs485TelemetryQueue != nullptr) {
                        xQueueSend(g_rs485TelemetryQueue, &item, 0);
                    }
                }
            } else {
                // Single sensor or floor hub self-telemetry payload
                SensorTelemetry item = {};
                item.floorId = respFloor;
                strncpy(item.hubId, hubId, sizeof(item.hubId));

                const char* chip = respDoc["chip_id"];
                if (chip != nullptr) {
                    strncpy(item.chipId, chip, sizeof(item.chipId));
                } else {
                    snprintf(item.chipId, sizeof(item.chipId), "FL%02d-HUB", respFloor);
                }

                const char* type = respDoc["sensor_type"] | "SMOKE_OPTICAL";
                strncpy(item.sensorType, type, sizeof(item.sensorType));

                item.primaryValue = respDoc["val"] | respDoc["smoke_ppm"] | respDoc["temperature"] | 24.0f;
                const char* unit = respDoc["unit"] | (strcmp(type, "TEMP_DS18B20") == 0 ? "°C" : "PPM");
                strncpy(item.primaryUnit, unit, sizeof(item.primaryUnit));

                item.smokePpm = respDoc["smoke_ppm"] | 20.0f;
                item.temperature = respDoc["temperature"] | respDoc["temp"] | 24.0f;
                item.coPpm = respDoc["co_ppm"] | 3.0f;
                item.batteryLevel = respDoc["battery"] | respDoc["battery_pct"] | 98;
                item.rssi = respDoc["rssi"] | -45;
                item.isAlarm = isAlarm;
                item.timestamp = millis() / 1000;

                if (respDoc["is_intro"] | false) {
                    item.isIntroPacket = true;
                    const char* rawHex = respDoc["raw_intro_hex"] | "";
                    strncpy(item.rawIntroHex, rawHex, sizeof(item.rawIntroHex));
                }

                if (g_rs485TelemetryQueue != nullptr) {
                    xQueueSend(g_rs485TelemetryQueue, &item, 0);
                }
            }

            Serial.printf("[RS485 Master] Floor %d (%s) responded in %ums (Attempt %d/%d) | Alarm: %s\n",
                          respFloor, hubId, tLatency, attempt, RS485_MAX_RETRIES, isAlarm ? "YES" : "NO");

        } else {
            // Drop or CRC error on this attempt -> Retry request
            if (attempt < RS485_MAX_RETRIES) {
                Serial.printf("[RS485 Retry] Floor %d did not respond on attempt %d. Retrying (%d/%d)...\n",
                              targetFloor, attempt, attempt + 1, RS485_MAX_RETRIES);
                vTaskDelay(pdMS_TO_TICKS(25)); // Brief pause before retry
            } else {
                g_floorStats[targetFloor].timeouts++;
                if (millis() - g_floorStats[targetFloor].lastSeenMs > 45000) {
                    g_floorStats[targetFloor].isOnline = false;
                }
                // Serial.printf("[RS485 Timeout] Floor %d failed after %d retries.\n", targetFloor, RS485_MAX_RETRIES);
            }
        }
    }
}

void broadcastRs485PairingMode(bool enable, uint32_t windowSec) {
    JsonDocument doc;
    doc["cmd"] = enable ? "ENABLE_PAIRING_MODE" : "CANCEL_PAIRING_MODE";
    doc["target"] = RS485_BROADCAST_ADDR; // 255 = Broadcast to all floors
    doc["sender"] = 0;
    doc["seq"] = g_rs485Seq++;
    doc["window_sec"] = windowSec;
    doc["timestamp"] = millis();

    sendRs485JsonPacket(doc);
    Serial.printf("[RS485 Broadcast] Dispatched %s to all floors (Window: %us)\n",
                  doc["cmd"].as<const char*>(), windowSec);
}

void broadcastRs485AlarmSilence() {
    JsonDocument doc;
    doc["cmd"] = "SILENCE_ALARM";
    doc["target"] = RS485_BROADCAST_ADDR;
    doc["sender"] = 0;
    doc["seq"] = g_rs485Seq++;
    doc["timestamp"] = millis();

    sendRs485JsonPacket(doc);
    Serial.println("[RS485 Broadcast] Dispatched SILENCE_ALARM to all floor MCUs.");
}

FloorHubDiagnostics getFloorDiagnostics(uint8_t floor) {
    if (floor <= RS485_MAX_FLOOR) {
        return g_floorStats[floor];
    }
    FloorHubDiagnostics empty = {};
    return empty;
}

uint8_t getActiveFloorsCount() {
    uint8_t active = 0;
    for (uint8_t f = RS485_MIN_FLOOR; f <= RS485_MAX_FLOOR; f++) {
        if (g_floorStats[f].isOnline) {
            active++;
        }
    }
    return active;
}
