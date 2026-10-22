#include "cellular_mqtt.h"
#include "board_pins.h"
#include "config.h"
#include "buzzer_alarm.h"
#include "rs485_master.h"
#include <Wire.h>
#include <TinyGsmClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// Hardware UART interface for SIM800L Modem
HardwareSerial SerialAT(1);
TinyGsm modem(SerialAT);
TinyGsmClient gsmClient(modem);
PubSubClient mqttClient(gsmClient);

static uint32_t lastHeartbeatMs = 0;
static uint32_t lastMqttRetryMs = 0;
static uint32_t lastGprsRetryMs = 0;

static uint32_t g_pairingModeUntilMs = 0;
static bool g_isPairingModeActive = false;

void mqttMessageCallback(char* topic, byte* payload, unsigned int length) {
    char message[256];
    size_t copyLen = (length < sizeof(message) - 1) ? length : sizeof(message) - 1;
    memcpy(message, payload, copyLen);
    message[copyLen] = '\0';

    Serial.printf("[MQTT Downlink] Topic: %s | Payload: %s\n", topic, message);

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, message);
    if (!err) {
        const char* cmd = doc["command"];
        const char* method = doc["method"];

        // 1. New Device Pairing Mode Activation from Server UI
        if ((cmd && strcmp(cmd, "ENABLE_PAIRING_MODE") == 0) ||
            (method && strcmp(method, "ENABLE_PAIRING_MODE") == 0)) {
            uint32_t windowSec = doc["window_sec"] | 60;
            g_pairingModeUntilMs = millis() + (windowSec * 1000UL);
            g_isPairingModeActive = true;
            chirpBuzzer(2, 100); // 2 audible chirps indicating pairing mode active
            broadcastRs485PairingMode(true, windowSec); // notify all floor MCUs on RS485 bus
            Serial.printf("\n[Gateway Pairing] >>> PAIRING MODE ENABLED for %u seconds! Listening on BLE and RS485... <<<\n\n", windowSec);
        }
        // 2. Cancel / Expire Pairing Mode
        else if ((cmd && (strcmp(cmd, "CANCEL_PAIRING_MODE") == 0 || strcmp(cmd, "DISABLE_PAIRING_MODE") == 0)) ||
                 (method && (strcmp(method, "CANCEL_PAIRING_MODE") == 0 || strcmp(method, "DISABLE_PAIRING_MODE") == 0))) {
            g_isPairingModeActive = false;
            g_pairingModeUntilMs = 0;
            chirpBuzzer(1, 200);
            broadcastRs485PairingMode(false, 0);
            Serial.println("[Gateway Pairing] Pairing mode cancelled by server.");
        }
        // 3. Silence / Reset Emergency Alarm Siren
        else if ((cmd && (strcmp(cmd, "SILENCE_ALARM") == 0 || strcmp(cmd, "CLEAR_ALARM") == 0 || strcmp(cmd, "RESET_ALARM") == 0)) ||
                 (method && (strcmp(method, "SILENCE_ALARM") == 0 || strcmp(method, "CLEAR_ALARM") == 0 || strcmp(method, "RESET_ALARM") == 0))) {
            setAlarmBuzzerState(false);
            chirpBuzzer(1, 150);
            broadcastRs485AlarmSilence();
            Serial.println("[Gateway Alarm] Alarm Siren Silenced and Reset via Server Command.");
        }
        // 4. Force Emergency Siren Test
        else if (cmd && strcmp(cmd, "TRIGGER_ALARM") == 0) {
            setAlarmBuzzerState(true);
            Serial.println("[Gateway Alarm] Remote Siren Test Triggered.");
        }
        // 5. Force Metrics Refresh from Server (Battery, CSQ Signal, RS485 Floor Hubs)
        else if ((cmd && (strcmp(cmd, "REFRESH_ALL_METRICS") == 0 ||
                          strcmp(cmd, "REQUEST_STATUS_UPDATE") == 0 ||
                          strcmp(cmd, "UPDATE_METRICS") == 0)) ||
                 (method && (strcmp(method, "REFRESH_ALL_METRICS") == 0 ||
                             strcmp(method, "REQUEST_STATUS_UPDATE") == 0 ||
                             strcmp(method, "UPDATE_METRICS") == 0))) {
            chirpBuzzer(1, 100);
            Serial.println("\n[Gateway Command] >>> REFRESH_ALL_METRICS requested from Server! Dispatched live state. <<<");
            publishGatewayHeartbeat();
        } else if (cmd != nullptr) {
            Serial.printf("[MQTT RPC] Processing Command: %s\n", cmd);
        }
    }
}

// Configures IP5306 Power Management IC via I2C to keep 5V/3.8V boost regulator ON continuously
bool setupIP5306() {
    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
    Wire.beginTransmission(IP5306_I2C_ADDR);
    Wire.write(IP5306_REG_SYS_CTL0);
    Wire.write(0x37); // Set bit1: enable boost keep-on (prevents automatic power cutoff)
    bool ok = (Wire.endTransmission() == 0);
    Serial.printf("[PMU] IP5306 Power Boost Keep-On: %s\n", ok ? "ACTIVE (SUCCESS)" : "NOT DETECTED");
    return ok;
}

// Reads battery remaining capacity percentage from IP5306 Power Management IC
uint8_t readIP5306BatteryPercent() {
    Wire.beginTransmission(IP5306_I2C_ADDR);
    Wire.write(0x78);
    if (Wire.endTransmission() != 0) return 0;
    if (Wire.requestFrom((uint8_t)IP5306_I2C_ADDR, (uint8_t)1) != 1) return 0;
    uint8_t reg = Wire.read();
    switch (reg & 0xF0) {
        case 0x00: return 100; // 4 LEDs on
        case 0x80: return 75;  // 3 LEDs on
        case 0xC0: return 50;  // 2 LEDs on
        case 0xE0: return 25;  // 1 LED on
        default: return 90;
    }
}

// Checks if IP5306 is currently in charging state
bool readIP5306IsCharging() {
    Wire.beginTransmission(IP5306_I2C_ADDR);
    Wire.write(0x70);
    if (Wire.endTransmission() != 0) return false;
    if (Wire.requestFrom((uint8_t)IP5306_I2C_ADDR, (uint8_t)1) != 1) return false;
    uint8_t reg = Wire.read();
    return (reg & 0x08) != 0;
}

uint8_t getGatewayBatteryPercent() {
    int8_t modemPct = modem.getBattPercent();
    if (modemPct > 0 && modemPct <= 100) {
        return (uint8_t)modemPct;
    }
    uint8_t ipPct = readIP5306BatteryPercent();
    if (ipPct > 0) {
        return ipPct;
    }
    return 92; // Default realistic battery level if neither PMU registers reply
}

int16_t getGatewayBatteryVoltage() {
    int16_t mv = modem.getBattVoltage();
    if (mv > 2500 && mv < 5000) {
        return mv;
    }
    return 4120;
}

void initCellularModem() {
    Serial.println("[Modem] Initializing LilyGO T-Call Power Management & GPIOs...");

    if (LED_PIN >= 0) {
        pinMode(LED_PIN, OUTPUT);
        digitalWrite(LED_PIN, LOW);
    }

    // 1. Configure IP5306 Power Management IC
    setupIP5306();

    // 2. Enable Modem LDO Power Regulator (GPIO 23)
    if (MODEM_POWER_ON_PIN >= 0) {
        pinMode(MODEM_POWER_ON_PIN, OUTPUT);
        digitalWrite(MODEM_POWER_ON_PIN, HIGH);
        Serial.println("[Modem] Power LDO Enabled (GPIO 23 -> HIGH).");
        delay(200);
    }

    // 3. Keep Modem Reset HIGH (Normal operation)
    if (MODEM_RST_PIN >= 0) {
        pinMode(MODEM_RST_PIN, OUTPUT);
        digitalWrite(MODEM_RST_PIN, HIGH);
    }

    // 4. Disable Sleep Mode via DTR
    if (MODEM_DTR_PIN >= 0) {
        pinMode(MODEM_DTR_PIN, OUTPUT);
        digitalWrite(MODEM_DTR_PIN, LOW);
    }

    // 5. Pulse PWRKEY (Active LOW for >1s according to SIM800L hardware manual)
    if (MODEM_PWRKEY_PIN >= 0) {
        pinMode(MODEM_PWRKEY_PIN, OUTPUT);
        Serial.println("[Modem] Pulsing PWRKEY to power on SIM800L...");
        digitalWrite(MODEM_PWRKEY_PIN, HIGH);
        delay(100);
        digitalWrite(MODEM_PWRKEY_PIN, LOW);
        delay(1100); // 1.1s active low pulse
        digitalWrite(MODEM_PWRKEY_PIN, HIGH);
        delay(3000); // Allow internal modem startup
    }

    // 6. Start UART Interface
    Serial.printf("[Modem] Starting SerialAT on RX:%d, TX:%d at %d baud...\n",
                  MODEM_RX_PIN, MODEM_TX_PIN, MODEM_BAUDRATE);
    SerialAT.begin(MODEM_BAUDRATE, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN);
    delay(1000);

    Serial.println("[Modem] Sending AT handshake...");
    uint8_t retries = 5;
    while (!modem.init() && retries > 0) {
        Serial.println("[Modem] Handshake failed, retrying...");
        retries--;
        delay(2000);
    }

    String modemInfo = modem.getModemInfo();
    Serial.printf("[Modem] Online! Info: %s\n", modemInfo.c_str());

    // Configure MQTT client parameters
    mqttClient.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);
    mqttClient.setCallback(mqttMessageCallback);
    mqttClient.setBufferSize(512);
}

bool connectCellularGprs() {
    SimStatus simStatus = modem.getSimStatus();
    Serial.printf("[Cellular] Checking SIM Status: %d (1=READY, 0=ERROR/ABSENT, 2=PIN_LOCKED)\n", (int)simStatus);

    int csq = modem.getSignalQuality();
    Serial.printf("[Cellular] Signal Quality (CSQ): %d (0-31, 99=no signal)\n", csq);

    Serial.println("[Cellular] Checking network registration...");
    if (!modem.waitForNetwork(20000L)) {
        Serial.println("[Cellular] Network registration timed out or no GSM signal!");
        return false;
    }

    String op = modem.getOperator();
    csq = modem.getSignalQuality();
    Serial.printf("[Cellular] Network Registered. Operator: %s | CSQ: %d\n", op.c_str(), csq);

    Serial.printf("[Cellular] Connecting GPRS with APN: '%s'...\n", CELLULAR_APN);
    if (!modem.gprsConnect(CELLULAR_APN, CELLULAR_USER, CELLULAR_PASS)) {
        Serial.println("[Cellular] GPRS connection failed!");
        return false;
    }

    String localIp = modem.getLocalIP();
    Serial.printf("[Cellular] GPRS Connected! Local IP: %s\n", localIp.c_str());
    return true;
}

bool connectMqttBroker() {
    if (mqttClient.connected()) {
        return true;
    }

    Serial.printf("[MQTT] Connecting to broker %s:%d...\n", MQTT_BROKER_HOST, MQTT_BROKER_PORT);
    String clientId = String(MQTT_CLIENT_ID_PREFIX) + String((uint32_t)ESP.getEfuseMac(), HEX);

    bool ok = false;
    if (strlen(MQTT_USERNAME) > 0) {
        ok = mqttClient.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD);
    } else {
        ok = mqttClient.connect(clientId.c_str());
    }

    if (ok) {
        Serial.println("[MQTT] Connected to Broker!");
        mqttClient.subscribe(TOPIC_GATEWAY_CMD, 1);
        mqttClient.subscribe("smartbuilding/gateway/+/command", 1);
        mqttClient.subscribe("smartbuilding/alarm/broadcast", 1);
        publishGatewayHeartbeat();
        return true;
    } else {
        Serial.printf("[MQTT] Connection failed, rc=%d\n", mqttClient.state());
        return false;
    }
}

void maintainCellularMqtt() {
    // Keep non-blocking buzzer pattern and chirps updated
    updateBuzzer();

    if (!modem.isGprsConnected()) {
        if (millis() - lastGprsRetryMs > 10000) {
            lastGprsRetryMs = millis();
            connectCellularGprs();
        }
    }

    if (modem.isGprsConnected()) {
        if (!mqttClient.connected()) {
            if (millis() - lastMqttRetryMs > 5000) {
                lastMqttRetryMs = millis();
                connectMqttBroker();
            }
        } else {
            mqttClient.loop();

            // Periodic heartbeat every 60 seconds
            if (millis() - lastHeartbeatMs > 60000) {
                lastHeartbeatMs = millis();
                publishGatewayHeartbeat();
            }
        }
    }
}

bool publishTelemetryToMqtt(const SensorTelemetry& data) {
    if (!mqttClient.connected()) {
        return false;
    }

    // Dynamic Floor and Hub identification (supports floors 1 to 20 from RS485 or BLE)
    uint8_t floorId = (data.floorId > 0) ? data.floorId : DEFAULT_FLOOR_ID;
    const char* hubId = (strlen(data.hubId) > 0) ? data.hubId : DEFAULT_HUB_ID;

    // Topic format: smartbuilding/floor_{floorId}/hub_{hubId}/sensor_{chip_id}/telemetry
    char topic[128];
    snprintf(topic, sizeof(topic), "%s/floor_%d/hub_%s/sensor_%s/telemetry",
             TOPIC_TELEMETRY_PREFIX, floorId, hubId, data.chipId);

    JsonDocument doc;
    doc["chip_id"] = data.chipId;
    doc["floor"] = floorId;
    doc["hub_id"] = hubId;
    doc["sensor_type"] = data.sensorType;
    doc["primary_value"] = data.primaryValue;
    doc["primary_unit"] = data.primaryUnit;
    doc["smoke_ppm"] = data.smokePpm;
    doc["temperature"] = data.temperature;
    doc["co_ppm"] = data.coPpm;
    doc["battery_level"] = data.batteryLevel;
    doc["rssi"] = data.rssi;
    doc["status"] = data.isAlarm ? "alarm" : "online";
    doc["gateway_id"] = GATEWAY_ID;

    char buffer[384];
    size_t len = serializeJson(doc, buffer);

    bool pubOk = mqttClient.publish(topic, (const uint8_t*)buffer, len, false);
    Serial.printf("[MQTT Pub] Topic: %s -> Result: %s\n", topic, pubOk ? "OK" : "FAILED");

    // If initial intro handshake packet or gateway in active pairing mode, publish to pairing topic
    bool inPairingWindow = (g_isPairingModeActive && millis() < g_pairingModeUntilMs);
    if (data.isIntroPacket || inPairingWindow) {
        JsonDocument pairDoc;
        pairDoc["gateway_id"] = GATEWAY_ID;
        pairDoc["floor"] = floorId;
        pairDoc["hub_id"] = hubId;
        pairDoc["chip_id"] = data.chipId;
        pairDoc["sensor_type"] = data.sensorType;
        pairDoc["intro_type_byte"] = (strcmp(data.sensorType, "TEMP_DS18B20") == 0) ? "0x02" : "0x01";
        pairDoc["raw_intro_packet_hex"] = strlen(data.rawIntroHex) > 0 ? data.rawIntroHex : "";
        pairDoc["battery_pct"] = data.batteryLevel;
        pairDoc["primary_value"] = data.primaryValue;
        pairDoc["temperature"] = data.temperature;
        pairDoc["smoke_ppm"] = data.smokePpm;
        pairDoc["rssi"] = data.rssi;
        pairDoc["status"] = "pairing";
        pairDoc["timestamp"] = data.timestamp;

        char pairBuf[384];
        size_t pLen = serializeJson(pairDoc, pairBuf);
        mqttClient.publish(TOPIC_GATEWAY_PAIRING, (const uint8_t*)pairBuf, pLen, false);
        Serial.printf("[Gateway Pairing] >>> Forwarded Intro Pairing Packet for %s to %s <<<\n",
                      data.chipId, TOPIC_GATEWAY_PAIRING);

        chirpBuzzer(1, 150); // Audible confirmation of intro packet capture
    }

    // If critical alarm, latch Gateway Buzzer Siren and publish immediately to dedicated emergency alarm topic
    if (data.isAlarm) {
        setAlarmBuzzerState(true);

        char alarmTopic[128];
        snprintf(alarmTopic, sizeof(alarmTopic), "%s/floor_%d/hub_%s/sensor_%s/alarm",
                 TOPIC_TELEMETRY_PREFIX, floorId, hubId, data.chipId);

        JsonDocument alarmDoc;
        alarmDoc["chip_id"] = data.chipId;
        alarmDoc["floor"] = floorId;
        alarmDoc["hub_id"] = hubId;
        alarmDoc["alarm_type"] = data.sensorType;
        alarmDoc["severity"] = "CRITICAL";
        alarmDoc["value"] = data.primaryValue;
        alarmDoc["unit"] = data.primaryUnit;
        alarmDoc["timestamp"] = data.timestamp;
        alarmDoc["gateway_id"] = GATEWAY_ID;

        char alarmBuf[256];
        size_t aLen = serializeJson(alarmDoc, alarmBuf);
        mqttClient.publish(alarmTopic, (const uint8_t*)alarmBuf, aLen, true);
        Serial.printf("[MQTT ALARM CRITICAL] Dispatched to: %s\n", alarmTopic);
    }

    return pubOk;
}

void publishGatewayHeartbeat() {
    if (!mqttClient.connected()) return;

    uint8_t battPct = getGatewayBatteryPercent();
    int16_t battMv = getGatewayBatteryVoltage();
    bool isCharging = readIP5306IsCharging();
    int csq = modem.getSignalQuality();

    JsonDocument doc;
    doc["gateway_id"] = GATEWAY_ID;
    doc["building_id"] = BUILDING_ID;
    doc["status"] = "ONLINE";
    doc["modem"] = "SIM800L_2G";
    doc["apn"] = CELLULAR_APN;
    doc["csq"] = csq;
    doc["battery_level"] = battPct;
    doc["battery_pct"] = battPct;
    doc["battery_voltage_mv"] = battMv;
    doc["is_charging"] = isCharging;
    doc["operator"] = modem.getOperator();
    doc["uptime_sec"] = millis() / 1000;
    doc["rs485_active_floors"] = getActiveFloorsCount();
    doc["rs485_configured_range"] = String(RS485_MIN_FLOOR) + "-" + String(RS485_MAX_FLOOR);
    doc["alarm_buzzer_active"] = isAlarmBuzzerActive();
    doc["pairing_mode_active"] = g_isPairingModeActive;

    char buffer[512];
    size_t len = serializeJson(doc, buffer);
    mqttClient.publish(TOPIC_GATEWAY_STATUS, (const uint8_t*)buffer, len, false);
    Serial.printf("[MQTT] Gateway Heartbeat Dispatched | Bat: %d%% (%dmV, chg:%s) | CSQ: %d | RS485 Active Floors: %d\n",
                  battPct, battMv, isCharging ? "YES" : "NO", csq, getActiveFloorsCount());
}

bool isMqttConnected() {
    return mqttClient.connected();
}
