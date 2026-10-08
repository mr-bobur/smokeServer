import {
  buildConfigDownlinkTopic,
  initializeMqttClient,
  isMqttBrokerConnected,
  mqttClient
} from '../config/mqtt';
import { dbStore, isMysqlConnected, mysqlPool } from '../config/database';
import {
  AlarmEventType,
  AlarmSeverity,
  GatewayDeviceRecord,
  MqttAlarmPayload,
  MqttConfigDownlinkPayload,
  MqttTelemetryPayload,
  SensorEndpointRecord,
  SensorType
} from '../types';
import { emergencyService } from './emergency.service';
import { socketService } from './socket.service';
import { sim7670Service } from './sim7670.service';

class MqttService {
  private simulationTimer: NodeJS.Timeout | null = null;

  public start(): void {
    initializeMqttClient((topic, payloadStr) => {
      this.handleIncomingMqttPacket(topic, payloadStr);
    });

    // Real-only mode: Autonomous mock simulation ticker is disabled so that only genuine hardware telemetry is displayed.
    // this.simulationTimer = setInterval(() => {
    //   this.simulateHardwareHeartbeatTick();
    // }, 4000);
  }

  public async handleIncomingMqttPacket(topic: string, payloadStr: string): Promise<void> {
    try {
      const parsed = JSON.parse(payloadStr);

      if (topic.includes('/gateway/') && topic.endsWith('/status')) {
        await this.ingestGatewayStatusPayload(parsed, topic);
      } else if (topic.endsWith('/telemetry')) {
        await this.ingestTelemetryPayload(parsed, topic);
      } else if (topic.endsWith('/alarm')) {
        await this.ingestAlarmPayload(parsed, topic);
      }
    } catch (err) {
      console.error('[MQTT] Failed to parse incoming payload:', (err as Error).message);
    }
  }

  public async ingestGatewayStatusPayload(payload: any, topic: string): Promise<void> {
    const parts = topic.split('/');
    const gatewayId = payload.gateway_id || parts[2] || 'GW-LILYGO-TCALL-SIM800';
    const nowIso = new Date().toISOString();

    let gw = dbStore.gateways.find((g) => g.serial_number === gatewayId);
    const csq = typeof payload.csq === 'number' ? payload.csq : 31;
    const rssiDbm = csq === 99 ? -113 : -113 + csq * 2;
    const simOperator = payload.operator ? String(payload.operator) : 'Uztelecom GSM / 43408';
    const modem = payload.modem ? String(payload.modem) : 'SIM800L_2G';

    if (!gw) {
      const newId = dbStore.gateways.reduce((max, g) => Math.max(max, g.id), 0) + 1;
      gw = {
        id: newId,
        building_id: 1,
        building_name: 'Nest One Residence - Block B',
        serial_number: gatewayId,
        mac_address: 'B4:E6:2D:80:C3:01',
        imei: '869482059114099',
        sim_operator: simOperator,
        firmware_version: modem,
        rssi_dbm: rssiDbm,
        status: 'online',
        pairing_mode_active: false,
        last_seen: nowIso,
        created_at: nowIso
      };
      dbStore.gateways.push(gw);
      console.log(`[MQTT] Gateway ${gatewayId} registered in dbStore.`);
    } else {
      gw.status = 'online';
      gw.last_seen = nowIso;
      gw.rssi_dbm = rssiDbm;
      gw.sim_operator = simOperator;
      gw.firmware_version = modem;
    }

    // Update modem status for AT console & live telemetry
    sim7670Service.updateFromLiveModem({
      modem,
      operator: simOperator,
      csq,
      uptime: payload.uptime_sec,
      gatewayId
    });

    socketService.emitGlobal('GATEWAY_UPDATE', { gateway: gw });
    socketService.emitGlobal('INVENTORY_UPDATE', { action: 'GATEWAY_HEARTBEAT', gateway: gw });
  }

  private autoProvisionSensor(payload: any, topic?: string): SensorEndpointRecord {
    const nowIso = new Date().toISOString();
    const newId = dbStore.sensors.reduce((max, s) => Math.max(max, s.id), 0) + 1;

    let floorNumber = 1;
    if (topic) {
      const m = topic.match(/floor_(\d+)/i);
      if (m && m[1]) floorNumber = parseInt(m[1], 10);
    } else if (payload.floor) {
      floorNumber = Number(payload.floor);
    }

    const floor =
      dbStore.floors.find((f) => f.building_id === 1 && f.floor_number === floorNumber) ||
      dbStore.floors.find((f) => f.floor_number === floorNumber) ||
      dbStore.floors[0];

    const room =
      dbStore.rooms.find((r) => r.floor_id === floor.id) ||
      dbStore.rooms[0];

    const rawType = String(payload.sensor_type || payload.alarm_type || 'SMOKE_MQ2').toUpperCase();
    let sensorType: SensorType = 'SMOKE_MQ2';
    let profileCode = 'PROFILE_SMOKE_MQ2';
    let primaryUnit = 'PPM';
    let introTypeByte = '0x01';

    if (rawType.includes('TEMP')) {
      sensorType = 'TEMP_DS18B20';
      profileCode = 'PROFILE_TEMP_DS18B20';
      primaryUnit = '°C';
      introTypeByte = '0x02';
    } else if (rawType.includes('DOOR') || rawType.includes('REED')) {
      sensorType = 'DOOR_REED';
      profileCode = 'PROFILE_DOOR_REED';
      primaryUnit = 'STATE';
      introTypeByte = '0x03';
    } else if (rawType.includes('CO')) {
      sensorType = 'CO_MQ7';
      profileCode = 'PROFILE_CO_MQ7';
      primaryUnit = 'PPM';
      introTypeByte = '0x04';
    } else if (rawType.includes('GLASS')) {
      sensorType = 'GLASS_BREAK';
      profileCode = 'PROFILE_GLASS_BREAK';
      primaryUnit = 'ACOUSTIC';
      introTypeByte = '0x05';
    }

    const parentNodeId = payload.gateway_id || payload.hub_id || 'GW-LILYGO-TCALL-SIM800';
    const chipId = String(payload.chip_id);

    const smokeVal = Number(
      payload.smoke_ppm ??
      payload.data?.smoke_ppm ??
      payload.value ??
      payload.primary_value ??
      15.0
    );

    const tempVal = Number(
      payload.temperature ??
      payload.data?.temperature_c ??
      payload.data?.temperature ??
      24.5
    );

    const coVal = Number(
      payload.co_ppm ??
      payload.data?.co_ppm ??
      4.0
    );

    const batteryLevel = Number(
      payload.battery_level ??
      payload.battery_pct ??
      payload.data?.battery_pct ??
      100
    );

    const rssiDbm = Number(
      payload.rssi ??
      payload.rssi_dbm ??
      payload.data?.rssi_dbm ??
      -53
    );

    const newSensor: SensorEndpointRecord = {
      id: newId,
      building_id: floor.building_id,
      room_id: room.id,
      room_number: room.room_number,
      floor_id: floor.id,
      floor_number: floor.floor_number,
      chip_id: chipId,
      profile_code: profileCode,
      sensor_type: sensorType,
      intro_packet_hex: 'AA FF ' + chipId.replace(/[^0-9A-Fa-f]/g, '').padEnd(8, '0').slice(-8) + ' ' + introTypeByte.replace('0x', '') + ' 64 C4 9B 55',
      intro_type_byte: introTypeByte,
      parent_link_type: 'CENTRAL_GATEWAY',
      parent_node_id: parentNodeId,
      status: payload.status === 'alarm' ? 'alarm' : 'online',
      coord_x: 20 + ((newId * 17) % 55),
      coord_y: 20 + ((newId * 13) % 45),
      battery_level: batteryLevel,
      beacon_interval_seconds: 600,
      smoke_threshold_ppm: 400,
      temp_threshold_c: 60,
      arm_perimeter: false,
      primary_value: sensorType === 'SMOKE_MQ2' ? smokeVal : sensorType === 'TEMP_DS18B20' ? tempVal : coVal,
      primary_unit: primaryUnit,
      smoke_ppm: smokeVal,
      co_ppm: coVal,
      temperature: tempVal,
      reed_switch_open: Boolean(payload.door_open ?? payload.data?.door_open),
      glass_break_detected: Boolean(payload.glass_broken ?? payload.data?.glass_broken),
      rssi_dbm: rssiDbm,
      attributes: {
        client: {
          chip_id: chipId,
          intro_packet_hex: 'AA FF ' + chipId.replace(/[^0-9A-Fa-f]/g, '').padEnd(8, '0').slice(-8) + ' ' + introTypeByte.replace('0x', '') + ' 64 C4 9B 55',
          intro_type_byte: introTypeByte,
          firmware_version: 'v2.4.0-ESP32C3-OPTICAL',
          hardware_revision: 'REV-B1-SINGLE-PERIPHERAL',
          reset_reason: 'POWERON_RESET',
          rssi_dbm: rssiDbm,
          parent_node_id: parentNodeId
        },
        shared_desired: {
          beacon_interval_seconds: 600,
          smoke_threshold_ppm: 400,
          temp_threshold_c: 60,
          arm_perimeter: false
        },
        shared_reported: {
          beacon_interval_seconds: 600,
          smoke_threshold_ppm: 400,
          temp_threshold_c: 60,
          arm_perimeter: false
        },
        sync_status: 'SYNCED',
        last_synced_at: nowIso,
        server: {
          building_id: floor.building_id,
          floor_id: floor.id,
          room_id: room.id,
          coord_x: 20 + ((newId * 17) % 55),
          coord_y: 20 + ((newId * 13) % 45),
          inactivity_timeout_sec: 1800,
          claimed_by_user_id: null,
          claimed_at: null
        }
      },
      claimed_by_user_id: null,
      claimed_at: null,
      last_seen: nowIso,
      created_at: nowIso
    };

    dbStore.sensors.push(newSensor);
    console.log(`[AutoProvision] Auto-registered sensor ${chipId} on Floor ${floor.floor_number} (${room.room_number})`);

    socketService.emitGlobal('INVENTORY_UPDATE', {
      action: 'SENSOR_PROVISIONED',
      sensor: newSensor
    });

    return newSensor;
  }

  public async ingestTelemetryPayload(payload: any, topic?: string): Promise<void> {
    if (!payload || !payload.chip_id) return;

    let sensor = dbStore.sensors.find((s) => s.chip_id === payload.chip_id);
    if (!sensor) {
      sensor = this.autoProvisionSensor(payload, topic);
    }

    const nowIso = new Date().toISOString();

    const smokeVal = Number(
      (
        payload.smoke_ppm ??
        payload.data?.smoke_ppm ??
        payload.primary_value ??
        sensor.smoke_ppm
      )
    );

    const coVal = Number(
      (
        payload.co_ppm ??
        payload.data?.co_ppm ??
        sensor.co_ppm
      )
    );

    const tempVal = Number(
      (
        payload.temperature ??
        payload.data?.temperature_c ??
        payload.data?.temperature ??
        sensor.temperature
      )
    );

    const batteryVal = Number(
      (
        payload.battery_level ??
        payload.battery_pct ??
        payload.data?.battery_pct ??
        sensor.battery_level
      )
    );

    const rssiVal = Number(
      (
        payload.rssi ??
        payload.rssi_dbm ??
        payload.data?.rssi_dbm ??
        sensor.rssi_dbm
      )
    );

    sensor.smoke_ppm = Number(smokeVal.toFixed(1));
    sensor.co_ppm = Number(coVal.toFixed(1));
    sensor.temperature = Number(tempVal.toFixed(1));
    sensor.reed_switch_open = Boolean(payload.door_open ?? payload.data?.door_open ?? sensor.reed_switch_open);
    sensor.glass_break_detected = Boolean(payload.glass_broken ?? payload.data?.glass_broken ?? sensor.glass_break_detected);
    sensor.battery_level = Math.min(100, Math.max(0, batteryVal));
    sensor.rssi_dbm = rssiVal;
    sensor.last_seen = nowIso;

    if (sensor.sensor_type === 'SMOKE_MQ2') sensor.primary_value = sensor.smoke_ppm;
    if (sensor.sensor_type === 'TEMP_DS18B20') sensor.primary_value = sensor.temperature;
    if (sensor.sensor_type === 'CO_MQ7') sensor.primary_value = sensor.co_ppm;

    if (payload.status === 'alarm') {
      sensor.status = 'alarm';
    } else if (sensor.status !== 'alarm') {
      sensor.status = 'online';
    }

    // ThingsBoard Shared Attributes Wakeup Sync:
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
      mqtt_topic: topic || `smartbuilding/floor_${sensor.floor_number}/hub_HUB-FL0${sensor.floor_number}/sensor_${sensor.chip_id}/telemetry`,
      payload
    });
    socketService.emitGlobal('SENSOR_UPDATED', { sensor });
  }

  public async ingestAlarmPayload(payload: any, topic?: string): Promise<void> {
    if (!payload || !payload.chip_id) return;

    let sensor = dbStore.sensors.find((s) => s.chip_id === payload.chip_id);
    if (!sensor) {
      sensor = this.autoProvisionSensor({ ...payload, status: 'alarm' }, topic);
    }

    const smokeVal = Number(
      payload.value ??
      payload.metrics?.smoke_ppm ??
      payload.smoke_ppm ??
      payload.primary_value ??
      500
    );

    const tempVal = Number(
      payload.metrics?.temperature_c ??
      payload.temperature ??
      payload.tempVal ??
      25
    );

    const coVal = Number(
      payload.metrics?.co_ppm ??
      payload.co_ppm ??
      payload.coVal ??
      5
    );

    sensor.status = 'alarm';
    sensor.smoke_ppm = smokeVal;
    sensor.last_seen = new Date().toISOString();

    const eventType: AlarmEventType =
      payload.event_type ||
      (payload.alarm_type === 'TEMP' ? 'TEMP_THRESHOLD' : 'SMOKE_CRITICAL');

    const severity: AlarmSeverity = payload.severity === 'warning' ? 'warning' : 'critical';

    await emergencyService.triggerAlarm({
      sensorId: sensor.id,
      chipId: payload.chip_id,
      eventType,
      severity,
      smokeVal,
      tempVal,
      coVal
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
