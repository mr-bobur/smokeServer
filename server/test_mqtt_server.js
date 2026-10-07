const mqtt = require('mqtt');

const brokerUrl = 'mqtt://127.0.0.1:1883';
const client = mqtt.connect(brokerUrl, {
  clientId: 'test_publisher_' + Math.random().toString(16).slice(2, 8)
});

client.on('connect', () => {
  console.log('[TEST] Connected to local MQTT broker at', brokerUrl);

  const testPayload = {
    timestamp: Math.floor(Date.now() / 1000),
    chip_id: 'C3-B1F1DAA66D',
    floor: 1,
    hub_id: 'HUB-B1-FL01',
    data: {
      smoke_ppm: 345.5,
      co_ppm: 12.3,
      temperature_c: 28.7,
      door_open: false,
      glass_broken: false
    },
    battery_pct: 88,
    rssi_dbm: -58
  };

  const topic = 'smartbuilding/floor_1/hub_HUB-B1-FL01/sensor_C3-B1F1DAA66D/telemetry';
  console.log('[TEST] Publishing test telemetry to topic:', topic);
  
  client.publish(topic, JSON.stringify(testPayload), { qos: 1 }, (err) => {
    if (err) {
      console.error('[TEST] Publish error:', err);
    } else {
      console.log('[TEST] Telemetry successfully published!');
    }

    setTimeout(() => {
      client.end();
      process.exit(0);
    }, 1000);
  });
});

client.on('error', (err) => {
  console.error('[TEST] MQTT connection error:', err);
  process.exit(1);
});
