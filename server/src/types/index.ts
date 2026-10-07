import { Request } from 'express';

export type UserRole = 'super_admin' | 'tenant' | 'user';

export interface UserRecord {
  id: number;
  google_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: UserRole;
  phone_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface JwtUserPayload {
  id: number;
  email: string;
  role: UserRole;
  name?: string;
}

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends JwtUserPayload {}
  }
}

export interface AuthenticatedRequest extends Request {
  user?: JwtUserPayload;
}

export type AssetHealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL_ALARM';

/**
 * STRICT SINGLE-SENSOR RULE:
 * Each physical End-Device carries strictly 1 dedicated sensor peripheral.
 * Its type is automatically decoded from its incoming Intro Packet (Kirish tanishtiruv paketi):
 * 0x01 -> SMOKE_MQ2
 * 0x02 -> TEMP_DS18B20
 * 0x03 -> DOOR_REED
 * 0x04 -> CO_MQ7
 * 0x05 -> GLASS_BREAK
 */
export type SensorType =
  | 'SMOKE_MQ2'
  | 'TEMP_DS18B20'
  | 'DOOR_REED'
  | 'CO_MQ7'
  | 'GLASS_BREAK';

/**
 * ThingsBoard-Inspired Specialized Safety Device Profile
 */
export interface DeviceProfileRecord {
  code: string; // e.g., 'PROFILE_SMOKE_MQ2'
  name: string;
  intro_type_byte: string; // '0x01' .. '0x05'
  sensor_type: SensorType;
  unit: string;
  default_beacon_interval_sec: number;
  inactivity_timeout_sec: number;
  warning_threshold: number | null;
  critical_threshold: number | null;
  low_battery_threshold_pct: number;
  description: string;
  updated_at: string;
}

/**
 * ThingsBoard 3-Scope Attributes Model (Client / Shared [Desired vs Reported] / Server)
 */
export type AttributeSyncStatus = 'SYNCED' | 'PENDING_WAKEUP' | 'FAILED';

export interface DeviceClientAttributes {
  chip_id: string;
  intro_packet_hex: string;
  intro_type_byte: string;
  firmware_version: string;
  hardware_revision: string;
  reset_reason: string;
  rssi_dbm: number;
  parent_node_id: string;
}

export interface DeviceSharedAttributes {
  beacon_interval_seconds: number;
  smoke_threshold_ppm: number;
  temp_threshold_c: number;
  arm_perimeter: boolean;
}

export interface DeviceServerAttributes {
  building_id: number;
  floor_id: number;
  room_id: number;
  coord_x: number;
  coord_y: number;
  inactivity_timeout_sec: number;
  claimed_by_user_id: number | null;
  claimed_at: string | null;
}

export interface DeviceAttributesBundle {
  client: DeviceClientAttributes;
  shared_desired: DeviceSharedAttributes;
  shared_reported: DeviceSharedAttributes;
  sync_status: AttributeSyncStatus;
  last_synced_at: string;
  server: DeviceServerAttributes;
}

// SaaS Building Entity (ThingsBoard Top-Level Asset)
export interface BuildingRecord {
  id: number;
  code: string;
  name: string;
  address: string;
  city: string;
  total_floors: number;
  tenant_user_id: number | null;
  tenant_name?: string | null;
  tenant_email?: string | null;
  tenant_phone?: string | null;
  gateway_id: number | null;
  health_status?: AssetHealthStatus;
  active_alarms_count?: number;
  offline_devices_count?: number;
  created_at: string;
}

// Central Building Gateway (SIM7670 4G LTE / Ethernet)
export interface GatewayDeviceRecord {
  id: number;
  building_id: number | null;
  building_name?: string | null;
  serial_number: string;
  mac_address: string;
  imei: string;
  sim_operator: string;
  firmware_version: string;
  rssi_dbm: number;
  status: 'online' | 'offline' | 'pairing_mode';
  pairing_mode_active: boolean;
  last_seen: string;
  created_at: string;
}

export type HubStatus = 'online' | 'offline' | 'battery_warning' | 'pairing_mode' | 'none';

// Floor & Floor Sub-Hub (ESP32-C3 + RS485 + 4x DIP Switch)
export interface FloorRecord {
  id: number;
  building_id: number;
  building_name?: string;
  floor_number: number;
  name: string;
  map_image_url: string;
  map_width: number;
  map_height: number;
  has_sub_hub: boolean;
  hub_id: string;
  hub_mac: string;
  dip_switch_address: number;
  dip_binary: string;
  hub_status: HubStatus;
  hub_battery_pct: number;
  pairing_mode_active?: boolean;
  health_status?: AssetHealthStatus;
  last_heartbeat: string;
  rs485_latency_ms: number;
  rs485_packet_loss_pct: number;
  rs485_crc_errors: number;
  rs485_tx_frames: number;
  rs485_rx_frames: number;
}

export type PerimeterSecurityStatus = 'disarmed' | 'armed_home' | 'armed_away';

export interface RoomApartmentRecord {
  id: number;
  building_id: number;
  floor_id: number;
  floor_number: number;
  room_number: string;
  owner_user_id: number | null;
  owner_name?: string | null;
  owner_email?: string | null;
  owner_phone?: string | null;
  perimeter_security_status: PerimeterSecurityStatus;
  health_status?: AssetHealthStatus;
  created_at: string;
  bounds?: { x: number; y: number; w: number; h: number; label: string };
}

export type SensorStatus = 'online' | 'offline' | 'alarm' | 'warning' | 'pairing';

export interface SensorEndpointRecord {
  id: number;
  building_id: number;
  room_id: number;
  room_number: string;
  floor_id: number;
  floor_number: number;
  chip_id: string;
  profile_code: string;
  sensor_type: SensorType;
  intro_packet_hex: string;
  intro_type_byte: string; // '0x01' | '0x02' | '0x03' | '0x04' | '0x05'
  parent_link_type: 'FLOOR_HUB' | 'CENTRAL_GATEWAY';
  parent_node_id: string;
  status: SensorStatus;
  coord_x: number;
  coord_y: number;
  battery_level: number;
  beacon_interval_seconds: number;
  smoke_threshold_ppm: number;
  temp_threshold_c: number;
  arm_perimeter: boolean;
  // Single primary reading + environmental context
  primary_value: number | boolean;
  primary_unit: string;
  smoke_ppm: number;
  co_ppm: number;
  temperature: number;
  reed_switch_open: boolean;
  glass_break_detected: boolean;
  rssi_dbm: number;
  // ThingsBoard 3-Scope Attributes + Device Claiming
  attributes: DeviceAttributesBundle;
  claimed_by_user_id: number | null;
  claimed_at: string | null;
  last_seen: string;
  created_at: string;
}

export interface PairingSessionRecord {
  session_id: string;
  building_id: number;
  floor_id: number;
  floor_number: number;
  room_id: number;
  room_number: string;
  coord_x: number;
  coord_y: number;
  target_receiver_type: 'FLOOR_HUB' | 'CENTRAL_GATEWAY';
  target_receiver_id: string;
  claim_secret: string;
  status: 'listening' | 'completed' | 'expired';
  initiated_by_user_id: number;
  created_at: string;
  expires_at: string;
}

export interface TelemetryLogRecord {
  id: number;
  sensor_id: number;
  smoke_ppm: number | null;
  co_ppm: number | null;
  temperature: number | null;
  reed_switch_open: boolean | null;
  glass_break_detected: boolean | null;
  battery_level: number;
  recorded_at: string;
}

export type AlarmEventType =
  | 'SMOKE_CRITICAL'
  | 'CO_DANGER'
  | 'TEMP_THRESHOLD'
  | 'UNAUTHORIZED_ENTRY'
  | 'GLASS_BREAK';

export type AlarmSeverity = 'warning' | 'critical' | 'emergency';
export type AlarmStatus = 'active' | 'acknowledged' | 'resolved' | 'escalated_to_112';

/**
 * ThingsBoard 4-State Alarm Lifecycle
 */
export type AlarmLifecycleState =
  | 'ACTIVE_UNACK'
  | 'ACTIVE_ACK'
  | 'CLEARED_UNACK'
  | 'CLEARED_ACK';

export interface AlarmCommentRecord {
  id: string;
  user_id: number;
  user_name: string;
  comment: string;
  created_at: string;
}

export interface Emergency112Payload {
  agency_code: string;
  building_id: string;
  address: string;
  floor_number: number;
  room_number: string;
  threat_type: string;
  readings: {
    smoke_ppm: number | null;
    temp_celsius: number | null;
  };
  contact_person: string;
  contact_phone: string;
  dispatched_at: string;
}

export interface AlarmEventRecord {
  id: number;
  building_id?: number;
  alarm_code: string;
  sensor_id: number;
  chip_id: string;
  floor_number: number;
  room_number: string;
  event_type: AlarmEventType;
  severity: AlarmSeverity;
  status: AlarmStatus;
  lifecycle_state: AlarmLifecycleState;
  trigger_count: number;
  peak_value: number | null;
  smoke_val: number | null;
  temp_val: number | null;
  co_val?: number | null;
  acknowledged_by: number | null;
  acknowledged_by_name?: string | null;
  acknowledged_at: string | null;
  cleared_at: string | null;
  comments: AlarmCommentRecord[];
  emergency_112_payload: Emergency112Payload | null;
  emergency_112_dispatched_at: string | null;
  emergency_112_response: Record<string, unknown> | null;
  countdown_remaining_sec?: number;
  created_at: string;
  updated_at?: string;
}

/**
 * ThingsBoard Persistent RPC Command Queue Record
 */
export type RpcCommandStatus = 'QUEUED' | 'DELIVERED' | 'ACKED' | 'TIMED_OUT';

export interface RpcCommandRecord {
  id: number;
  rpc_uid: string;
  building_id: number;
  target_type: 'CENTRAL_GATEWAY' | 'FLOOR_HUB' | 'END_DEVICE';
  target_id: string;
  method: string;
  params: Record<string, unknown>;
  status: RpcCommandStatus;
  initiated_by_user_id: number | null;
  response_payload: Record<string, unknown> | null;
  created_at: string;
  ack_at: string | null;
  expires_at: string;
}

export interface MqttTelemetryPayload {
  timestamp: number;
  chip_id: string;
  floor: number;
  hub_id: string;
  data: {
    smoke_ppm: number;
    co_ppm: number;
    temperature_c: number;
    door_open: boolean;
    glass_broken: boolean;
  };
  battery_pct: number;
  rssi_dbm: number;
}

export interface MqttAlarmPayload {
  alarm_id: string;
  timestamp: number;
  chip_id: string;
  floor: number;
  room_number: string;
  event_type: AlarmEventType;
  severity: AlarmSeverity;
  metrics: {
    smoke_ppm: number;
    temperature_c: number;
    co_ppm?: number;
  };
}

export interface MqttConfigDownlinkPayload {
  cmd: 'SET_CONFIG' | 'RECALIBRATE' | 'BLE_ACK_PAIRING' | 'ENABLE_PAIRING_MODE';
  beacon_interval_seconds: number;
  smoke_threshold_ppm: number;
  arm_perimeter: boolean;
}

export interface Sim7670Status {
  module_model: string;
  imei: string;
  sim_ready: boolean;
  operator: string;
  network_mode: '4G LTE Cat 1' | 'GSM Fallback' | 'Offline';
  rssi_csq: number;
  rssi_dbm: number;
  signal_bars: number;
  gprs_attached: boolean;
  mqtt_tls_connected: boolean;
  sms_credit_balance_uzs: number;
  api_112_uplink: 'READY' | 'DISPATCHING' | 'DEGRADED';
  last_at_command: string;
  at_logs: Array<{
    timestamp: string;
    tx: string;
    rx: string;
    category: 'INIT' | 'MQTT' | 'SMS' | 'VOICE';
  }>;
}
