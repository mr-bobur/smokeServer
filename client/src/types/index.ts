export type UserRole = 'super_admin' | 'tenant' | 'user';
export type AssetHealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL_ALARM';

export interface UserProfile {
  id: number;
  google_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: UserRole;
  phone_number: string | null;
}

export type SensorType =
  | 'SMOKE_MQ2'
  | 'TEMP_DS18B20'
  | 'DOOR_REED'
  | 'CO_MQ7'
  | 'GLASS_BREAK';

export interface DeviceProfileData {
  code: string;
  name: string;
  intro_type_byte: string;
  sensor_type: SensorType;
  unit: string;
  default_beacon_interval_sec: number;
  inactivity_timeout_sec: number;
  warning_threshold: number | null;
  critical_threshold: number | null;
  low_battery_threshold_pct: number;
  description: string;
  updated_at?: string;
}

export type AttributeSyncStatus = 'SYNCED' | 'PENDING_WAKEUP' | 'FAILED';

export interface DeviceAttributesBundleData {
  client: {
    chip_id: string;
    intro_packet_hex: string;
    intro_type_byte: string;
    firmware_version: string;
    hardware_revision: string;
    reset_reason: string;
    rssi_dbm: number;
    parent_node_id: string;
  };
  shared_desired: {
    beacon_interval_seconds: number;
    smoke_threshold_ppm: number;
    temp_threshold_c: number;
    arm_perimeter: boolean;
  };
  shared_reported: {
    beacon_interval_seconds: number;
    smoke_threshold_ppm: number;
    temp_threshold_c: number;
    arm_perimeter: boolean;
  };
  sync_status: AttributeSyncStatus;
  last_synced_at: string;
  server: {
    building_id: number;
    floor_id: number;
    room_id: number;
    coord_x: number;
    coord_y: number;
    inactivity_timeout_sec: number;
    claimed_by_user_id: number | null;
    claimed_at: string | null;
  };
}

export interface RpcCommandData {
  id: number;
  rpc_uid: string;
  building_id: number;
  target_type: 'CENTRAL_GATEWAY' | 'FLOOR_HUB' | 'END_DEVICE';
  target_id: string;
  method: string;
  params: Record<string, unknown>;
  status: 'QUEUED' | 'DELIVERED' | 'ACKED' | 'TIMED_OUT';
  initiated_by_user_id: number | null;
  response_payload: Record<string, unknown> | null;
  created_at: string;
  ack_at: string | null;
  expires_at: string;
}

export interface GatewayDeviceData {
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
}

export interface BuildingData {
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
  gateway?: GatewayDeviceData | null;
  stats?: {
    floors_count: number;
    hubs_count: number;
    apartments_count: number;
    sensors_count: number;
    online_sensors: number;
    alarm_sensors: number;
    pending_sync_sensors?: number;
  };
}

export type HubStatus = 'online' | 'offline' | 'battery_warning' | 'pairing_mode' | 'none';

export interface FloorStats {
  total_sensors: number;
  online_sensors: number;
  warning_sensors: number;
  alarm_sensors: number;
  offline_sensors: number;
  active_alarms_count: number;
  total_rooms: number;
}

export interface FloorData {
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
  stats?: FloorStats;
}

export type PerimeterSecurityStatus = 'disarmed' | 'armed_home' | 'armed_away';

export interface RoomApartmentData {
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
  bounds?: { x: number; y: number; w: number; h: number; label: string };
  sensors?: SensorEndpointData[];
}

export type SensorStatus = 'online' | 'offline' | 'alarm' | 'warning' | 'pairing';

export interface SensorEndpointData {
  id: number;
  building_id: number;
  room_id: number;
  room_number: string;
  floor_id: number;
  floor_number: number;
  chip_id: string;
  profile_code?: string;
  sensor_type: SensorType;
  intro_packet_hex: string;
  intro_type_byte: string;
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
  primary_value: number | boolean;
  primary_unit: string;
  smoke_ppm: number;
  co_ppm: number;
  temperature: number;
  reed_switch_open: boolean;
  glass_break_detected: boolean;
  rssi_dbm: number;
  attributes?: DeviceAttributesBundleData;
  claimed_by_user_id?: number | null;
  claimed_at?: string | null;
  last_seen: string;
}

export interface PairingSessionData {
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
  claim_secret?: string;
  status: 'listening' | 'completed' | 'expired';
}

export interface DevicesInventoryData {
  summary: {
    total_gateways: number;
    total_floor_hubs: number;
    total_end_devices: number;
    pending_attribute_sync?: number;
    by_sensor_type: Record<SensorType, number>;
  };
  device_profiles?: DeviceProfileData[];
  gateways: GatewayDeviceData[];
  floor_hubs: Array<{
    id: number;
    building_id: number;
    building_name?: string;
    floor_number: number;
    floor_name: string;
    has_sub_hub: boolean;
    hub_id: string;
    hub_mac: string;
    dip_switch_address: number;
    dip_binary: string;
    hub_status: HubStatus;
    hub_battery_pct: number;
    pairing_mode_active: boolean;
    rs485_latency_ms: number;
    connected_endpoints_count: number;
  }>;
  end_devices: SensorEndpointData[];
  rpc_commands?: RpcCommandData[];
}

export type AlarmEventType =
  | 'SMOKE_CRITICAL'
  | 'CO_DANGER'
  | 'TEMP_THRESHOLD'
  | 'UNAUTHORIZED_ENTRY'
  | 'GLASS_BREAK';

export type AlarmSeverity = 'warning' | 'critical' | 'emergency';
export type AlarmStatus = 'active' | 'acknowledged' | 'resolved' | 'escalated_to_112';
export type AlarmLifecycleState =
  | 'ACTIVE_UNACK'
  | 'ACTIVE_ACK'
  | 'CLEARED_UNACK'
  | 'CLEARED_ACK';

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

export interface AlarmEventData {
  id: number;
  alarm_code: string;
  sensor_id: number;
  chip_id: string;
  floor_number: number;
  room_number: string;
  event_type: AlarmEventType;
  severity: AlarmSeverity;
  status: AlarmStatus;
  lifecycle_state?: AlarmLifecycleState;
  trigger_count?: number;
  peak_value?: number | null;
  smoke_val: number | null;
  temp_val: number | null;
  co_val?: number | null;
  acknowledged_by: number | null;
  acknowledged_by_name?: string | null;
  acknowledged_at: string | null;
  cleared_at?: string | null;
  comments?: Array<{
    id: string;
    user_id: number;
    user_name: string;
    comment: string;
    created_at: string;
  }>;
  emergency_112_payload: Emergency112Payload | null;
  emergency_112_dispatched_at: string | null;
  emergency_112_response: Record<string, unknown> | null;
  countdown_remaining_sec?: number;
  created_at: string;
}

export interface TelemetryPoint {
  timestamp: string;
  label: string;
  smoke_ppm: number;
  co_ppm: number;
  temperature: number;
  threshold_smoke: number;
  threshold_temp: number;
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
