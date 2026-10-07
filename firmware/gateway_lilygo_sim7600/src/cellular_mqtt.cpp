#include "cellular_mqtt.h"
#include "board_pins.h"
#include "config.h"
#include <TinyGsmClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// UART interface for SIM7600 Modem
HardwareSerial SerialAT(1);
TinyGsm modem(SerialAT);
TinyGsmClient gsmClient(modem);
PubSubClient mqttClient(gsmClient);

static uint32_t lastHeartbeatMs = 0;
static uint32_t lastMqttRetryMs = 0;

void mqttMessageCallback(char* topic, byte* payload, unsigned int length) {
    char message[256];
    size_t copyLen = (length < sizeof(message) - 1) ? length : sizeof(message) - 1;
    memcpy(message, payload, copyLen);
    message[copyLen] = '\0';

    Serial.printf("[MQTT Downlink] Topic: %s | Payload: %s\n", topic, message);

    // Parse JSON commands (e.g. recalibrate, change interval, trigger alarm test)
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, message);
    if (!err) {
        const char* cmd = doc["command"];
        if (cmd != nullptr) {
            Serial.printf("[MQTT RPC] Processing Command: %s\n", cmd);
        }
    }
}

void initCellularModem() {
    Serial.println("[Modem] Initializing Power & GPIOs...");

    if (LED_PIN >= 0) {
        pinMode(LED_PIN, OUTPUT);
        digitalWrite(LED_PIN, LOW);
    }

    if (BOARD_POWERON_PIN >= 0) {
        pinMode(BOARD_POWERON_PIN, OUTPUT);
        digitalWrite(BOARD_POWERON_PIN, HIGH);
        delay(200);
    }

    if (MODEM_DTR_PIN >= 0) {
        pinMode(MODEM_DTR_PIN, OUTPUT);
        digitalWrite(MODEM_DTR_PIN, LOW); // Disable sleep mode
    }

    if (MODEM_PWRKEY_PIN >= 0) {
        pinMode(MODEM_PWRKEY_PIN, OUTPUT);
        Serial.println("[Modem] Pulsing PWRKEY to boot SIM7600...");
        digitalWrite(MODEM_PWRKEY_PIN, LOW);
        delay(100);
        digitalWrite(MODEM_PWRKEY_PIN, HIGH);
        delay(1000); // 1-second pulse for SIM7600
        digitalWrite(MODEM_PWRKEY_PIN, LOW);
        delay(3000); // Allow modem internal boot
    }

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

    // Send quick AT diagnostics to Serial
    SerialAT.println("AT+CPIN?");
    delay(200);
    while (SerialAT.available()) {
        Serial.write(SerialAT.read());
    }

    int csq = modem.getSignalQuality();
    Serial.printf("[Cellular] Signal Quality (CSQ): %d (0-31, 99=no signal)\n", csq);

    SerialAT.println("AT+CEREG?");
    delay(200);
    while (SerialAT.available()) {
        Serial.write(SerialAT.read());
    }

    Serial.println("[Cellular] Checking network registration...");
    if (!modem.waitForNetwork(15000L)) {
        Serial.println("[Cellular] Network registration timed out or no cellular signal/SIM!");
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
        publishGatewayHeartbeat();
        return true;
    } else {
        Serial.printf("[MQTT] Connection failed, rc=%d\n", mqttClient.state());
        return false;
    }
}

static uint32_t lastGprsRetryMs = 0;

void maintainCellularMqtt() {
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

    // Topic format: smartbuilding/floor_1/hub_HUB-B1-FL01/sensor_{chip_id}/telemetry
    char topic[128];
    snprintf(topic, sizeof(topic), "%s/floor_%d/hub_%s/sensor_%s/telemetry",
             TOPIC_TELEMETRY_PREFIX, DEFAULT_FLOOR_ID, DEFAULT_HUB_ID, data.chipId);

    JsonDocument doc;
    doc["chip_id"] = data.chipId;
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

    // If critical alarm, publish immediately to dedicated emergency alarm topic
    if (data.isAlarm) {
        char alarmTopic[128];
        snprintf(alarmTopic, sizeof(alarmTopic), "%s/floor_%d/hub_%s/sensor_%s/alarm",
                 TOPIC_TELEMETRY_PREFIX, DEFAULT_FLOOR_ID, DEFAULT_HUB_ID, data.chipId);

        JsonDocument alarmDoc;
        alarmDoc["chip_id"] = data.chipId;
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

    JsonDocument doc;
    doc["gateway_id"] = GATEWAY_ID;
    doc["building_id"] = BUILDING_ID;
    doc["status"] = "ONLINE";
    doc["modem"] = "SIM7600_4G";
    doc["apn"] = CELLULAR_APN;
    doc["csq"] = modem.getSignalQuality();
    doc["operator"] = modem.getOperator();
    doc["uptime_sec"] = millis() / 1000;

    char buffer[256];
    size_t len = serializeJson(doc, buffer);
    mqttClient.publish(TOPIC_GATEWAY_STATUS, (const uint8_t*)buffer, len, false);
    Serial.println("[MQTT] Gateway Heartbeat Dispatched.");
}

bool isMqttConnected() {
    return mqttClient.connected();
}
