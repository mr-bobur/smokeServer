import mqtt, { MqttClient } from 'mqtt';

export let mqttClient: MqttClient | null = null;
export let isMqttBrokerConnected = false;

export const TELEMETRY_TOPIC_PATTERN = 'smartbuilding/+/+/+/telemetry';
export const ALARM_TOPIC_PATTERN = 'smartbuilding/+/+/+/alarm';

export const buildConfigDownlinkTopic = (floorId: number, hubId: string, chipId: string): string => {
  return `smartbuilding/floor_${floorId}/hub_${hubId}/sensor_${chipId}/config`;
};

export const initializeMqttClient = (
  onMessageCallback: (topic: string, payloadStr: string) => void
): MqttClient | null => {
  const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883';

  try {
    mqttClient = mqtt.connect(brokerUrl, {
      clientId: `building_gw_server_${Math.random().toString(16).slice(2, 8)}`,
      connectTimeout: 2500,
      reconnectPeriod: 15000,
      clean: true,
      username: process.env.MQTT_USER || undefined,
      password: process.env.MQTT_PASSWORD || undefined
    });

    mqttClient.on('connect', () => {
      isMqttBrokerConnected = true;
      console.log(`[MQTT] Connected to broker at ${brokerUrl}`);
      mqttClient?.subscribe(TELEMETRY_TOPIC_PATTERN, { qos: 1 });
      mqttClient?.subscribe(ALARM_TOPIC_PATTERN, { qos: 2 });
    });

    mqttClient.on('message', (topic: string, payload: Buffer) => {
      onMessageCallback(topic, payload.toString('utf8'));
    });

    mqttClient.on('error', () => {
      isMqttBrokerConnected = false;
    });

    return mqttClient;
  } catch {
    isMqttBrokerConnected = false;
    return null;
  }
};
