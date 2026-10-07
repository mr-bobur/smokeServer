import { Request, Response } from 'express';
import {
  dbStore,
  decodeIntroPacket,
  buildDeviceAttributesBundle,
  isMysqlConnected,
  mysqlPool
} from '../config/database';
import { mqttService } from '../services/mqtt.service';
import { socketService } from '../services/socket.service';
import { SensorEndpointRecord, SensorType } from '../types';

export const getAllSensors = (req: Request, res: Response): void => {
  const buildingId = req.query.building_id ? Number(req.query.building_id) : undefined;
  const floorNumber = req.query.floor ? Number(req.query.floor) : undefined;
  const roomId = req.query.room_id ? Number(req.query.room_id) : undefined;

  let list = dbStore.sensors;
  if (buildingId) {
    list = list.filter((s) => s.building_id === buildingId);
  }
  if (floorNumber) {
    list = list.filter((s) => s.floor_number === floorNumber);
  }
  if (roomId) {
    list = list.filter((s) => s.room_id === roomId);
  }

  res.json({ sensors: list });
};

export const updateSensorCoordinates = async (req: Request, res: Response): Promise<void> => {
  const sensorId = Number(req.params.id);
  const { coord_x, coord_y } = req.body as { coord_x: number; coord_y: number };

  const sensor = dbStore.sensors.find((s) => s.id === sensorId);
  if (!sensor) {
    res.status(404).json({ error: 'Sensor endpoint not found' });
    return;
  }

  sensor.coord_x = Number(Math.max(2, Math.min(98, Number(coord_x))).toFixed(2));
  sensor.coord_y = Number(Math.max(2, Math.min(98, Number(coord_y))).toFixed(2));
  if (sensor.attributes?.server) {
    sensor.attributes.server.coord_x = sensor.coord_x;
    sensor.attributes.server.coord_y = sensor.coord_y;
  }
  sensor.last_seen = new Date().toISOString();

  if (isMysqlConnected && mysqlPool) {
    try {
      await mysqlPool.query(
        `UPDATE sensors_endpoints SET coord_x = ?, coord_y = ?, last_seen = NOW() WHERE id = ?`,
        [sensor.coord_x, sensor.coord_y, sensor.id]
      );
    } catch {
      // Non-blocking
    }
  }

  socketService.emitGlobal('SENSOR_UPDATED', { sensor });

  res.json({
    message: 'Sensor topological coordinates updated (SERVER_SCOPE attributes synced)',
    sensor
  });
};

export const updateSensorConfiguration = async (req: Request, res: Response): Promise<void> => {
  const sensorId = Number(req.params.id);
  const {
    beacon_interval_seconds,
    smoke_threshold_ppm,
    temp_threshold_c,
    arm_perimeter,
    simulate_immediate_wakeup
  } = req.body as {
    beacon_interval_seconds?: number;
    smoke_threshold_ppm?: number;
    temp_threshold_c?: number;
    arm_perimeter?: boolean;
    simulate_immediate_wakeup?: boolean;
  };

  const sensor = dbStore.sensors.find((s) => s.id === sensorId);
  if (!sensor) {
    res.status(404).json({ error: 'Sensor endpoint not found' });
    return;
  }

  if (typeof beacon_interval_seconds === 'number') {
    sensor.beacon_interval_seconds = Math.max(1, Math.min(3600, beacon_interval_seconds));
    sensor.attributes.shared_desired.beacon_interval_seconds = sensor.beacon_interval_seconds;
  }
  if (typeof smoke_threshold_ppm === 'number') {
    sensor.smoke_threshold_ppm = Math.max(100, Math.min(1000, smoke_threshold_ppm));
    sensor.attributes.shared_desired.smoke_threshold_ppm = sensor.smoke_threshold_ppm;
  }
  if (typeof temp_threshold_c === 'number') {
    sensor.temp_threshold_c = Math.max(35, Math.min(95, temp_threshold_c));
    sensor.attributes.shared_desired.temp_threshold_c = sensor.temp_threshold_c;
  }
  if (typeof arm_perimeter === 'boolean') {
    sensor.arm_perimeter = arm_perimeter;
    sensor.attributes.shared_desired.arm_perimeter = arm_perimeter;
  }

  const nowIso = new Date().toISOString();
  if (simulate_immediate_wakeup) {
    sensor.attributes.shared_reported = { ...sensor.attributes.shared_desired };
    sensor.attributes.sync_status = 'SYNCED';
    sensor.attributes.last_synced_at = nowIso;
    sensor.last_seen = nowIso;
  } else {
    sensor.attributes.sync_status = 'PENDING_WAKEUP';
  }

  const rpcCmd = dbStore.enqueueRpcCommand({
    building_id: sensor.building_id,
    target_type: 'END_DEVICE',
    target_id: sensor.chip_id,
    method: 'SET_SHARED_ATTRIBUTES',
    payload: { ...sensor.attributes.shared_desired },
    immediateAck: Boolean(simulate_immediate_wakeup)
  });

  const downlink = mqttService.publishDownlinkConfig(sensor.floor_number, sensor.chip_id, {
    cmd: 'SET_CONFIG',
    beacon_interval_seconds: sensor.beacon_interval_seconds,
    smoke_threshold_ppm: sensor.smoke_threshold_ppm,
    arm_perimeter: sensor.arm_perimeter
  });

  socketService.emitGlobal('SENSOR_UPDATED', { sensor, downlink, rpc_command: rpcCmd });

  res.json({
    message:
      sensor.attributes.sync_status === 'SYNCED'
        ? 'Shared Attributes synced immediately with ESP32-C3 endpoint'
        : 'Shared Attributes saved as Desired State (PENDING_WAKEUP on next heartbeat)',
    sensor,
    downlink,
    rpc_command: rpcCmd
  });
};

export const recalibrateSensor = (req: Request, res: Response): void => {
  const sensorId = Number(req.params.id);
  const sensor = dbStore.sensors.find((s) => s.id === sensorId);

  if (!sensor) {
    res.status(404).json({ error: 'Sensor endpoint not found' });
    return;
  }

  sensor.status = 'online';
  sensor.smoke_ppm = Number((20 + Math.random() * 12).toFixed(1));
  sensor.co_ppm = Number((3.5 + Math.random() * 2.5).toFixed(1));
  sensor.temperature = Number((22.5 + Math.random() * 2.0).toFixed(1));
  sensor.reed_switch_open = false;
  sensor.glass_break_detected = false;
  sensor.last_seen = new Date().toISOString();

  const rpcCmd = dbStore.enqueueRpcCommand({
    building_id: sensor.building_id,
    target_type: 'END_DEVICE',
    target_id: sensor.chip_id,
    method: 'ZERO_BASELINE_CALIBRATE',
    payload: { sensor_type: sensor.sensor_type },
    immediateAck: true
  });

  const downlink = mqttService.publishDownlinkConfig(sensor.floor_number, sensor.chip_id, {
    cmd: 'RECALIBRATE',
    beacon_interval_seconds: sensor.beacon_interval_seconds,
    smoke_threshold_ppm: sensor.smoke_threshold_ppm,
    arm_perimeter: sensor.arm_perimeter
  });

  socketService.emitGlobal('SENSOR_UPDATED', { sensor, downlink, rpc_command: rpcCmd });

  res.json({
    message: `ESP32-C3 (${sensor.chip_id}) zero-baseline calibration completed`,
    sensor,
    downlink,
    rpc_command: rpcCmd
  });
};

export const pairNewBleSensor = async (req: Request, res: Response): Promise<void> => {
  const {
    building_id,
    floor_number,
    room_id,
    sensor_type,
    intro_type_byte,
    raw_intro_packet_hex,
    chip_id,
    coord_x,
    coord_y
  } = req.body as {
    building_id?: number;
    floor_number?: number;
    room_id?: number;
    sensor_type?: SensorType;
    intro_type_byte?: string;
    raw_intro_packet_hex?: string;
    chip_id?: string;
    coord_x?: number;
    coord_y?: number;
  };

  const bldId = Number(building_id || 1);
  const targetFloorNum = Number(floor_number || 4);
  const floor =
    dbStore.floors.find(
      (f) => f.building_id === bldId && f.floor_number === targetFloorNum
    ) || dbStore.floors[0];

  const floorRooms = dbStore.rooms.filter((r) => r.floor_id === floor.id);
  const targetRoom =
    (room_id ? dbStore.rooms.find((r) => r.id === Number(room_id)) : undefined) ||
    floorRooms[0] ||
    dbStore.rooms[0];

  const decoded = decodeIntroPacket({
    raw_hex: raw_intro_packet_hex,
    type_byte: intro_type_byte || sensor_type || '0x01',
    chip_id
  });

  const newId = dbStore.sensors.reduce((max, s) => Math.max(max, s.id), 0) + 1;
  const nowIso = new Date().toISOString();
  const useHub = floor.has_sub_hub && floor.hub_status !== 'none';
  const parentId = useHub ? floor.hub_id : `GW-SIM7670-TASH-0${floor.building_id}`;
  const finalX = coord_x ?? Number((30 + Math.random() * 40).toFixed(2));
  const finalY = coord_y ?? Number((25 + Math.random() * 45).toFixed(2));
  const armPerim = targetRoom.perimeter_security_status !== 'disarmed';

  const newSensor: SensorEndpointRecord = {
    id: newId,
    building_id: floor.building_id,
    room_id: targetRoom.id,
    room_number: targetRoom.room_number,
    floor_id: floor.id,
    floor_number: floor.floor_number,
    chip_id: decoded.chip_id,
    profile_code: decoded.profile_code,
    sensor_type: decoded.sensor_type,
    intro_packet_hex: decoded.intro_packet_hex,
    intro_type_byte: decoded.intro_type_byte,
    parent_link_type: useHub ? 'FLOOR_HUB' : 'CENTRAL_GATEWAY',
    parent_node_id: parentId,
    status: 'online',
    coord_x: finalX,
    coord_y: finalY,
    battery_level: decoded.battery_pct,
    beacon_interval_seconds: 600,
    smoke_threshold_ppm: 400,
    temp_threshold_c: 60,
    arm_perimeter: armPerim,
    primary_value: decoded.primary_value,
    primary_unit: decoded.primary_unit,
    smoke_ppm: 22.4,
    co_ppm: 4.1,
    temperature: 23.6,
    reed_switch_open: false,
    glass_break_detected: false,
    rssi_dbm: -58,
    attributes: buildDeviceAttributesBundle({
      chip_id: decoded.chip_id,
      intro_packet_hex: decoded.intro_packet_hex,
      intro_type_byte: decoded.intro_type_byte,
      rssi_dbm: -58,
      parent_node_id: parentId,
      beacon_interval_seconds: 600,
      smoke_threshold_ppm: 400,
      temp_threshold_c: 60,
      arm_perimeter: armPerim,
      building_id: floor.building_id,
      floor_id: floor.id,
      room_id: targetRoom.id,
      coord_x: finalX,
      coord_y: finalY,
      claimed_by_user_id: targetRoom.owner_user_id,
      claimed_at: nowIso,
      nowIso
    }),
    claimed_by_user_id: targetRoom.owner_user_id,
    claimed_at: nowIso,
    last_seen: nowIso,
    created_at: nowIso
  };

  dbStore.sensors.push(newSensor);

  socketService.emitGlobal('SENSOR_PAIRED', {
    sensor: newSensor,
    ble_packet: decoded.intro_packet_hex,
    detected_sensor_type: decoded.sensor_type
  });

  res.status(201).json({
    message: `Intro Packet [${decoded.intro_packet_hex}] decoded -> Auto-detected ${decoded.sensor_type} (${decoded.profile_code})`,
    ble_advertisement_frame: decoded.intro_packet_hex,
    sensor: newSensor
  });
};
