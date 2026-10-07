import {
  buildConfigDownlinkTopic,
  initializeMqttClient,
  isMqttBrokerConnected,
  mqttClient
} from '../config/mqtt';
import { dbStore, isMysqlConnected, mysqlPool } from '../config/database';
import {
  MqttAlarmPayload,
  MqttConfigDownlinkPayload,
  MqttTelemetryPayload
} from '../types';
import { emergencyService } from './emergency.service';
import { socketService } from './socket.service';

class MqttService {
  private simulationTimer: NodeJS.Timeout | null = null;

  public start(): void {
    initializeMqttClient((topic, payloadStr) => {
      this.handleIncomingMqttPacket(topic, payloadStr);
    });

    // Autonomous Digital Twin Hardware Telemetry Ticker (every 4 seconds)
    this.simulationTimer = setInterval(() => {
      this.simulateHardwareHeartbeatTick();
    }, 4000);
  }

  public async handleIncomingMqttPacket(topic: string, payloadStr: string): Promise<void> {
    try {
      const parsed = JSON.parse(payloadStr);

      if (topic.endsWith('/telemetry')) {
        await this.ingestTelemetryPayload(parsed as MqttTelemetryPayload);
      } else if (topic.endsWith('/alarm')) {
        await this.ingestAlarmPayload(parsed as MqttAlarmPayload);
      }
    } catch (err) {
      console.error('[MQTT] Failed to parse incoming payload:', (err as Error).message);
    }
  }

  public async ingestTelemetryPayload(payload: MqttTelemetryPayload): Promise<void> {
    const sensor = dbStore.sensors.find((s) => s.chip_id === payload.chip_id);
    if (!sensor) return;

    const nowIso = new Date().toISOString();
    sensor.smoke_ppm = Number(payload.data.smoke_ppm.toFixed(1));
    sensor.co_ppm = Number(payload.data.co_ppm.toFixed(1));
    sensor.temperature = Number(payload.data.temperature_c.toFixed(1));
    sensor.reed_switch_open = Boolean(payload.data.door_open);
    sensor.glass_break_detected = Boolean(payload.data.glass_broken);
    sensor.battery_level = payload.battery_pct;
    sensor.rssi_dbm = payload.rssi_dbm;
    sensor.last_seen = nowIso;

    // ThingsBoard Shared Attributes Wakeup Sync:
    // When sleeping ESP32-C3 wakes up to transmit telemetry, Gateway delivers pending shared_desired attributes
    if (sensor.attributes && sensor.attributes.sync_status === 'PENDING_WAKEUP') {
      sensor.attributes.shared_reported = { ...sensor.attributes.shared_desired };
      sensor.attributes.sync_status = 'SYNCED';
      sensor.attributes.last_synced_at = nowIso;

      for (const rpc of dbStore.rpcCommands) {
        if (rpc.target_id === sensor.chip_id && rpc.status === 'QUEUED') {
          rpc.status = 'ACKED';
          rpc.ack_at = nowIso;
        }
      }
    }

    // Dynamic Threshold Check against DeviceProfile / Shared Attributes
    if (
      sensor.status !== 'alarm' &&
      (sensor.smoke_ppm >= sensor.smoke_threshold_ppm ||
        sensor.temperature >= sensor.temp_threshold_c)
    ) {
      await emergencyService.triggerAlarm({
        sensorId: sensor.id,
        chipId: sensor.chip_id,
        eventType:
          sensor.smoke_ppm >= sensor.smoke_threshold_ppm ? 'SMOKE_CRITICAL' : 'TEMP_THRESHOLD',
        severity: 'critical',
        smokeVal: sensor.smoke_ppm,
        tempVal: sensor.temperature,
        coVal: sensor.co_ppm
      });
      return;
    }

    if (isMysqlConnected && mysqlPool) {
      try {
        await mysqlPool.query(
          `INSERT INTO telemetry_logs (sensor_id, smoke_ppm, co_ppm, temperature, reed_switch_open, glass_break_detected, battery_level, recorded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            sensor.id,
            sensor.smoke_ppm,
            sensor.co_ppm,
            sensor.temperature,
            sensor.reed_switch_open,
            sensor.glass_break_detected,
            sensor.battery_level
          ]
        );
      } catch {
        // Non-blocking
      }
    }

    socketService.emitGlobal('TELEMETRY_UPDATE', {
      sensor,
      mqtt_topic: `smartbuilding/floor_${sensor.floor_number}/hub_HUB-FL0${sensor.floor_number}/sensor_${sensor.chip_id}/telemetry`,
      payload
    });
  }

  public async ingestAlarmPayload(payload: MqttAlarmPayload): Promise<void> {
    await emergencyService.triggerAlarm({
      chipId: payload.chip_id,
      eventType: payload.event_type,
      severity: payload.severity,
      smokeVal: payload.metrics.smoke_ppm,
      tempVal: payload.metrics.temperature_c,
      coVal: payload.metrics.co_ppm
    });
  }

  public publishDownlinkConfig(
    floorId: number,
    chipId: string,
    config: MqttConfigDownlinkPayload
  ): { topic: string; payload: MqttConfigDownlinkPayload; deliveredVia: string } {
    const hubId = `HUB-FL0${floorId}`;
    const topic = buildConfigDownlinkTopic(floorId, hubId, chipId);

    if (isMqttBrokerConnected && mqttClient) {
      mqttClient.publish(topic, JSON.stringify(config), { qos: 1 });
    }

    socketService.emitGlobal('MQTT_DOWNLINK_SENT', {
      topic,
      payload: config,
      timestamp: new Date().toISOString()
    });

    return {
      topic,
      payload: config,
      deliveredVia: isMqttBrokerConnected ? 'MQTT_TLS_BROKER' : 'RS485_GATEWAY_BRIDGE'
    };
  }

  private simulateHardwareHeartbeatTick(): void {
    const onlineSensors = dbStore.sensors.filter(
      (s) => s.status === 'online' || s.status === 'warning'
    );
    if (onlineSensors.length === 0) return;

    const nowIso = new Date().toISOString();
    const batch = [];
    for (let i = 0; i < 3; i++) {
      const target = onlineSensors[Math.floor(Math.random() * onlineSensors.length)];
      if (!target) continue;

      const deltaSmoke = (Math.random() - 0.49) * 1.8;
      const deltaTemp = (Math.random() - 0.49) * 0.3;
      const deltaCo = (Math.random() - 0.49) * 0.4;

      target.smoke_ppm = Number(
        Math.max(12, Math.min(350, target.smoke_ppm + deltaSmoke)).toFixed(1)
      );
      target.temperature = Number(
        Math.max(19.5, Math.min(52, target.temperature + deltaTemp)).toFixed(1)
      );
      target.co_ppm = Number(Math.max(2.0, Math.min(45, target.co_ppm + deltaCo)).toFixed(1));
      target.rssi_dbm = -60 - Math.floor(Math.random() * 18);
      target.last_seen = nowIso;

      if (target.sensor_type === 'SMOKE_MQ2') target.primary_value = target.smoke_ppm;
      if (target.sensor_type === 'TEMP_DS18B20') target.primary_value = target.temperature;
      if (target.sensor_type === 'CO_MQ7') target.primary_value = target.co_ppm;

      if (target.attributes) {
        target.attributes.client.rssi_dbm = target.rssi_dbm;
        if (target.attributes.sync_status === 'PENDING_WAKEUP') {
          target.attributes.shared_reported = { ...target.attributes.shared_desired };
          target.attributes.sync_status = 'SYNCED';
          target.attributes.last_synced_at = nowIso;

          for (const rpc of dbStore.rpcCommands) {
            if (rpc.target_id === target.chip_id && rpc.status === 'QUEUED') {
              rpc.status = 'ACKED';
              rpc.ack_at = nowIso;
            }
          }
        }
      }

      batch.push(target);
    }

    for (const fl of dbStore.floors) {
      fl.rs485_tx_frames += Math.floor(1 + Math.random() * 4);
      fl.rs485_rx_frames += Math.floor(1 + Math.random() * 4);
      fl.rs485_latency_ms = Number(
        (3.8 + fl.floor_number * 0.7 + Math.random() * 1.2).toFixed(1)
      );
      fl.last_heartbeat = nowIso;
    }

    socketService.emitGlobal('TELEMETRY_BATCH_TICK', {
      updated_sensors: batch,
      floors: dbStore.floors,
      timestamp: nowIso
    });
  }
}

export const mqttService = new MqttService();
