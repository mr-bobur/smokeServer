const mqtt = require('mqtt');

const brokerUrl = 'mqtt://127.0.0.1:1883';
const client = mqtt.connect(brokerUrl, {
  clientId: 'test_alarm_pub_' + Math.random().toString(16).slice(2, 8)
});

client.on('connect', () => {
  console.log('[TEST] Connected to MQTT broker');

  const alarmPayload = {
    alarm_id: 'ALM-TEST-MQTT-999',
    timestamp: Math.floor(Date.now() / 1000),
    chip_id: 'C3-B1F1DAA66D',
    floor: 1,
    room_number: 'Apt 12',
    event_type: 'SMOKE_CRITICAL',
    severity: 'critical',
    metrics: {
      smoke_ppm: 520.4,
      temperature_c: 68.2,
      co_ppm: 35.8
    }
  };

  const topic = 'smartbuilding/floor_1/hub_HUB-B1-FL01/sensor_C3-B1F1DAA66D/alarm';
  console.log('[TEST] Publishing ALARM to topic:', topic);

  client.publish(topic, JSON.stringify(alarmPayload), { qos: 2 }, (err) => {
    if (err) {
      console.error('[TEST] Publish error:', err);
    } else {
      console.log('[TEST] Alarm published successfully!');
    }
    setTimeout(() => {
      client.end();
      process.exit(0);
    }, 1000);
  });
});
