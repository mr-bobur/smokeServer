import mysql, { Pool } from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import {
  UserRecord,
  BuildingRecord,
  GatewayDeviceRecord,
  FloorRecord,
  RoomApartmentRecord,
  SensorEndpointRecord,
  PairingSessionRecord,
  TelemetryLogRecord,
  AlarmEventRecord,
  SensorType,
  SensorStatus,
  DeviceProfileRecord,
  DeviceAttributesBundle,
  RpcCommandRecord,
  AssetHealthStatus
} from '../types';

export let mysqlPool: Pool | null = null;
export let isMysqlConnected = false;

export const formatDipBinary = (addr: number): string =>
  Math.max(1, Math.min(15, addr)).toString(2).padStart(4, '0');

export const getProfileCodeForSensorType = (sensorType: SensorType): string => {
  switch (sensorType) {
    case 'SMOKE_MQ2':
      return 'PROFILE_SMOKE_MQ2';
    case 'TEMP_DS18B20':
      return 'PROFILE_TEMP_DS18B20';
    case 'DOOR_REED':
      return 'PROFILE_DOOR_REED';
    case 'CO_MQ7':
      return 'PROFILE_CO_MQ7';
    case 'GLASS_BREAK':
      return 'PROFILE_GLASS_BREAK';
  }
};

/**
 * Decodes the Hardware Introduction Handshake Packet (Kirish tanishtiruv paketi)
 * Packet Structure: [0xAA, 0xFF, CHIP_ID (4-6B), SENSOR_TYPE_BYTE (1B), BATTERY_PCT (1B), CRC16 (2B), 0x55]
 * Sensor Type Byte Mapping (Strictly 1 Sensor per End-Device):
 *   0x01 -> SMOKE_MQ2    (Optical / Ionization Smoke Detector -> PROFILE_SMOKE_MQ2)
 *   0x02 -> TEMP_DS18B20 (Digital Thermal Probe -> PROFILE_TEMP_DS18B20)
 *   0x03 -> DOOR_REED    (Magnetic Door/Window Reed Contact -> PROFILE_DOOR_REED)
 *   0x04 -> CO_MQ7       (Carbon Monoxide Gas Sensor -> PROFILE_CO_MQ7)
 *   0x05 -> GLASS_BREAK  (Acoustic Piezo Glass Shatter Sensor -> PROFILE_GLASS_BREAK)
 */
export const decodeIntroPacket = (input: {
  raw_hex?: string;
  type_byte?: string;
  chip_id?: string;
}): {
  chip_id: string;
  profile_code: string;
  sensor_type: SensorType;
  intro_type_byte: string;
  intro_packet_hex: string;
  battery_pct: number;
  primary_value: number | boolean;
  primary_unit: string;
} => {
  const cleanHex = (input.raw_hex || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase();

  let typeByteHex = (input.type_byte || '').replace('0x', '').toUpperCase();
  let extractedChip = input.chip_id || '';
  let batteryPct = 100;

  if (cleanHex.length >= 16 && cleanHex.startsWith('AAFF')) {
    const chipPart = cleanHex.slice(4, 12);
    if (!extractedChip) {
      extractedChip = `C3-${chipPart}`;
    }
    typeByteHex = cleanHex.slice(12, 14);
    const batParsed = parseInt(cleanHex.slice(14, 16), 16);
    if (!Number.isNaN(batParsed) && batParsed > 0 && batParsed <= 100) {
      batteryPct = batParsed;
    }
  }

  if (!extractedChip) {
    const randHex = Math.floor(0x10000000 + Math.random() * 0xefffffff)
      .toString(16)
      .toUpperCase();
    extractedChip = `C3-${randHex}`;
  }

  let sensorType: SensorType = 'SMOKE_MQ2';
  let normalizedByte = '0x01';
  let primaryValue: number | boolean = 24.5;
  let primaryUnit = 'PPM';

  switch (typeByteHex) {
    case '02':
    case '2':
    case 'TEMP':
    case 'TEMP_DS18B20':
      sensorType = 'TEMP_DS18B20';
      normalizedByte = '0x02';
      primaryValue = 23.8;
      primaryUnit = '°C';
      break;
    case '03':
    case '3':
    case 'DOOR':
    case 'DOOR_REED':
      sensorType = 'DOOR_REED';
      normalizedByte = '0x03';
      primaryValue = false;
      primaryUnit = 'STATE';
      break;
    case '04':
    case '4':
    case 'CO':
    case 'CO_MQ7':
      sensorType = 'CO_MQ7';
      normalizedByte = '0x04';
      primaryValue = 6.2;
      primaryUnit = 'PPM';
      break;
    case '05':
    case '5':
    case 'GLASS':
    case 'GLASS_BREAK':
      sensorType = 'GLASS_BREAK';
      normalizedByte = '0x05';
      primaryValue = false;
      primaryUnit = 'ACOUSTIC';
      break;
    case '01':
    case '1':
    case 'SMOKE':
    case 'SMOKE_MQ2':
    default:
      sensorType = 'SMOKE_MQ2';
      normalizedByte = '0x01';
      primaryValue = 28.4;
      primaryUnit = 'PPM';
      break;
  }

  const chipHexOnly = extractedChip.replace(/[^0-9A-Fa-f]/g, '').padEnd(8, 'A').slice(0, 8);
  const byteShort = normalizedByte.replace('0x', '');
  const batHex = batteryPct.toString(16).toUpperCase().padStart(2, '0');
  const constructedPacket = `AA FF ${chipHexOnly.slice(0, 4)} ${chipHexOnly.slice(4, 8)} ${byteShort} ${batHex} C4 9B 55`;

  return {
    chip_id: extractedChip,
    profile_code: getProfileCodeForSensorType(sensorType),
    sensor_type: sensorType,
    intro_type_byte: normalizedByte,
    intro_packet_hex: constructedPacket,
    battery_pct: batteryPct,
    primary_value: primaryValue,
    primary_unit: primaryUnit
  };
};

export const buildDeviceAttributesBundle = (params: {
  chip_id: string;
  intro_packet_hex: string;
  intro_type_byte: string;
  rssi_dbm: number;
  parent_node_id: string;
  beacon_interval_seconds: number;
  smoke_threshold_ppm: number;
  temp_threshold_c: number;
  arm_perimeter: boolean;
  building_id: number;
  floor_id: number;
  room_id: number;
  coord_x: number;
  coord_y: number;
  inactivity_timeout_sec?: number;
  claimed_by_user_id?: number | null;
  claimed_at?: string | null;
  nowIso: string;
}): DeviceAttributesBundle => {
  const shared = {
    beacon_interval_seconds: params.beacon_interval_seconds,
    smoke_threshold_ppm: params.smoke_threshold_ppm,
    temp_threshold_c: params.temp_threshold_c,
    arm_perimeter: params.arm_perimeter
  };

  return {
    client: {
      chip_id: params.chip_id,
      intro_packet_hex: params.intro_packet_hex,
      intro_type_byte: params.intro_type_byte,
      firmware_version: 'v2.4.0-ESP32C3-TB',
      hardware_revision: 'REV-B1-SINGLE-PERIPHERAL',
      reset_reason: 'DEEP_SLEEP_TIMER_WAKEUP',
      rssi_dbm: params.rssi_dbm,
      parent_node_id: params.parent_node_id
    },
    shared_desired: { ...shared },
    shared_reported: { ...shared },
    sync_status: 'SYNCED',
    last_synced_at: params.nowIso,
    server: {
      building_id: params.building_id,
      floor_id: params.floor_id,
      room_id: params.room_id,
      coord_x: params.coord_x,
      coord_y: params.coord_y,
      inactivity_timeout_sec: params.inactivity_timeout_sec || 1800,
      claimed_by_user_id: params.claimed_by_user_id ?? null,
      claimed_at: params.claimed_at ?? null
    }
  };
};

// ============================================================================
// MULTI-BUILDING SAAS DIGITAL TWIN STORE (WITH THINGSBOARD PATTERNS)
// ============================================================================
class DigitalTwinDatabase {
  public users: UserRecord[] = [];
  public deviceProfiles: DeviceProfileRecord[] = [];
  public buildings: BuildingRecord[] = [];
  public gateways: GatewayDeviceRecord[] = [];
  public floors: FloorRecord[] = [];
  public rooms: RoomApartmentRecord[] = [];
  public sensors: SensorEndpointRecord[] = [];
  public pairingSessions: PairingSessionRecord[] = [];
  public telemetryLogs: TelemetryLogRecord[] = [];
  public alarmEvents: AlarmEventRecord[] = [];
  public rpcCommands: RpcCommandRecord[] = [];

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData(): void {
    const nowIso = new Date().toISOString();

    // 0. Seed 5 Specialized Building Safety Device Profiles (ThingsBoard DeviceProfile Pattern)
    this.deviceProfiles = [
      {
        code: 'PROFILE_SMOKE_MQ2',
        name: 'Optical Smoke Detector Profile (MQ-2)',
        intro_type_byte: '0x01',
        sensor_type: 'SMOKE_MQ2',
        unit: 'PPM',
        default_beacon_interval_sec: 600,
        inactivity_timeout_sec: 1800,
        warning_threshold: 150,
        critical_threshold: 400,
        low_battery_threshold_pct: 20,
        description: 'Auto-assigned on Intro Byte 0x01. Triggers SMOKE_CRITICAL alarm above 400 PPM.',
        updated_at: nowIso
      },
      {
        code: 'PROFILE_TEMP_DS18B20',
        name: 'Thermal Fire Probe Profile (DS18B20)',
        intro_type_byte: '0x02',
        sensor_type: 'TEMP_DS18B20',
        unit: '°C',
        default_beacon_interval_sec: 600,
        inactivity_timeout_sec: 1800,
        warning_threshold: 45,
        critical_threshold: 60,
        low_battery_threshold_pct: 20,
        description: 'Auto-assigned on Intro Byte 0x02. Triggers TEMP_THRESHOLD alarm above 60 °C.',
        updated_at: nowIso
      },
      {
        code: 'PROFILE_DOOR_REED',
        name: 'Magnetic Door/Window Reed Profile',
        intro_type_byte: '0x03',
        sensor_type: 'DOOR_REED',
        unit: 'STATE',
        default_beacon_interval_sec: 900,
        inactivity_timeout_sec: 3600,
        warning_threshold: null,
        critical_threshold: 1,
        low_battery_threshold_pct: 15,
        description: 'Auto-assigned on Intro Byte 0x03. Triggers UNAUTHORIZED_ENTRY when armed.',
        updated_at: nowIso
      },
      {
        code: 'PROFILE_CO_MQ7',
        name: 'Carbon Monoxide Gas Profile (MQ-7)',
        intro_type_byte: '0x04',
        sensor_type: 'CO_MQ7',
        unit: 'PPM',
        default_beacon_interval_sec: 600,
        inactivity_timeout_sec: 1800,
        warning_threshold: 35,
        critical_threshold: 70,
        low_battery_threshold_pct: 20,
        description: 'Auto-assigned on Intro Byte 0x04. Triggers CO_DANGER alarm above 70 PPM.',
        updated_at: nowIso
      },
      {
        code: 'PROFILE_GLASS_BREAK',
        name: 'Acoustic Glass Break Profile (Piezo)',
        intro_type_byte: '0x05',
        sensor_type: 'GLASS_BREAK',
        unit: 'ACOUSTIC',
        default_beacon_interval_sec: 900,
        inactivity_timeout_sec: 3600,
        warning_threshold: null,
        critical_threshold: 1,
        low_battery_threshold_pct: 15,
        description: 'Auto-assigned on Intro Byte 0x05. Triggers immediate GLASS_BREAK intrusion alarm.',
        updated_at: nowIso
      }
    ];

    // 1. Seed Users (Super Admin, Multiple Tenants/Shirkats, Multiple Residents)
    this.users = [
      {
        id: 1,
        google_id: 'google-super-admin-001',
        email: 'admin@smartbuilding.uz',
        name: 'Sardor Alimov (SaaS Super Admin)',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sardor',
        role: 'super_admin',
        phone_number: '+998901112233',
        created_at: nowIso,
        updated_at: nowIso
      },
      {
        id: 2,
        google_id: 'google-tenant-mgr-002',
        email: 'shirkat@smartbuilding.uz',
        name: 'Dilshod Karimov (Nest One Shirkat)',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dilshod',
        role: 'tenant',
        phone_number: '+998712000000',
        created_at: nowIso,
        updated_at: nowIso
      },
      {
        id: 3,
        google_id: 'google-resident-003',
        email: 'aziza.apt42@gmail.com',
        name: 'Aziza Rustamova (Apt 42 Owner)',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aziza',
        role: 'user',
        phone_number: '+998909998877',
        created_at: nowIso,
        updated_at: nowIso
      },
      {
        id: 4,
        google_id: 'google-resident-004',
        email: 'jasur.apt12@gmail.com',
        name: 'Jasur Tursunov (Apt 12 Owner)',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jasur',
        role: 'user',
        phone_number: '+998935554433',
        created_at: nowIso,
        updated_at: nowIso
      },
      {
        id: 5,
        google_id: 'google-resident-005',
        email: 'malika.apt71@gmail.com',
        name: 'Malika Nazarova (Apt 71 Owner)',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Malika',
        role: 'user',
        phone_number: '+998977776655',
        created_at: nowIso,
        updated_at: nowIso
      },
      {
        id: 6,
        google_id: 'google-tenant-mgr-006',
        email: 'boulevard.shirkat@smartbuilding.uz',
        name: 'Rustam Sobirov (Boulevard Shirkat)',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rustam',
        role: 'tenant',
        phone_number: '+998712055566',
        created_at: nowIso,
        updated_at: nowIso
      },
      {
        id: 7,
        google_id: 'google-resident-007',
        email: 'bekzod.apt41@gmail.com',
        name: 'Bekzod Nurmatov (Apt 41 Owner)',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bekzod',
        role: 'user',
        phone_number: '+998998881122',
        created_at: nowIso,
        updated_at: nowIso
      }
    ];

    // 2. Seed Central Gateways (SIM7670 4G LTE Cat 1)
    this.gateways = [
      {
        id: 1,
        building_id: 1,
        building_name: 'Nest One Residence - Block B',
        serial_number: 'GW-SIM7670-TASH-01',
        mac_address: 'B4:E6:2D:90:01:01',
        imei: '869482059114028',
        sim_operator: 'Uztelecom GSM / LTE',
        firmware_version: 'v3.4.2-LTE',
        rssi_dbm: -59,
        status: 'online',
        pairing_mode_active: false,
        last_seen: nowIso,
        created_at: nowIso
      },
      {
        id: 2,
        building_id: 2,
        building_name: 'Tashkent City Boulevard Plaza',
        serial_number: 'GW-SIM7670-TASH-02',
        mac_address: 'B4:E6:2D:90:02:02',
        imei: '869482059118891',
        sim_operator: 'Ucell 4G LTE',
        firmware_version: 'v3.4.2-LTE',
        rssi_dbm: -63,
        status: 'online',
        pairing_mode_active: false,
        last_seen: nowIso,
        created_at: nowIso
      },
      {
        id: 3,
        building_id: 3,
        building_name: 'Samarkand Regency Smart Tower',
        serial_number: 'GW-SIM7670-SAM-03',
        mac_address: 'B4:E6:2D:90:03:03',
        imei: '869482059119904',
        sim_operator: 'Mobiuz LTE',
        firmware_version: 'v3.4.1-LTE',
        rssi_dbm: -66,
        status: 'online',
        pairing_mode_active: false,
        last_seen: nowIso,
        created_at: nowIso
      },
      {
        id: 4,
        building_id: 1,
        building_name: 'Nest One Residence - Block B',
        serial_number: 'GW-LILYGO-TCALL-SIM800',
        mac_address: 'B4:E6:2D:80:C3:01',
        imei: '869482059114099',
        sim_operator: 'Uztelecom GSM / 43408',
        firmware_version: 'v1.0.0-TCall-SIM800L',
        rssi_dbm: -51,
        status: 'online',
        pairing_mode_active: false,
        last_seen: nowIso,
        created_at: nowIso
      }
    ];

    // 3. Seed SaaS Buildings
    this.buildings = [
      {
        id: 1,
        code: 'SMART-BLD-TASHKENT-09',
        name: 'Nest One Residence - Block B',
        address: 'Amir Timur Avenue 108, Block B',
        city: 'Tashkent',
        total_floors: 9,
        tenant_user_id: 2,
        tenant_name: 'Dilshod Karimov (Nest One Shirkat)',
        tenant_email: 'shirkat@smartbuilding.uz',
        tenant_phone: '+998712000000',
        gateway_id: 1,
        created_at: nowIso
      },
      {
        id: 2,
        code: 'SMART-BLD-BOULEVARD-09',
        name: 'Tashkent City Boulevard Plaza',
        address: 'Furkat Street 4B, Shaykhantakhur',
        city: 'Tashkent',
        total_floors: 9,
        tenant_user_id: 6,
        tenant_name: 'Rustam Sobirov (Boulevard Shirkat)',
        tenant_email: 'boulevard.shirkat@smartbuilding.uz',
        tenant_phone: '+998712055566',
        gateway_id: 2,
        created_at: nowIso
      },
      {
        id: 3,
        code: 'SMART-BLD-SAMARKAND-05',
        name: 'Samarkand Regency Smart Tower',
        address: 'Registan Street 19, Block A',
        city: 'Samarkand',
        total_floors: 5,
        tenant_user_id: 2,
        tenant_name: 'Dilshod Karimov (Nest One Shirkat)',
        tenant_email: 'shirkat@smartbuilding.uz',
        tenant_phone: '+998712000000',
        gateway_id: 3,
        created_at: nowIso
      }
    ];

    // 4. Seed Floors & Floor Sub-Hubs for Building 1 (9 Floors) + Building 2 & 3
    let floorIdCounter = 1;
    let roomIdCounter = 1;
    let sensorIdCounter = 1;

    for (const bld of this.buildings) {
      for (let f = 1; f <= bld.total_floors; f++) {
        const currentFloorId = floorIdCounter++;
        const isBatteryWarn = bld.id === 1 && f === 5;
        const hasSubHub = !(bld.id === 2 && f === 9);
        const hubCode = `HUB-B${bld.id}-FL0${f}`;
        const hubMac = `EC:DA:3B:B${bld.id}:0${f}:A${f}`;

        const floorRecord: FloorRecord = {
          id: currentFloorId,
          building_id: bld.id,
          building_name: bld.name,
          floor_number: f,
          name: `Floor ${f} — ${
            f === 1
              ? 'Commercial Lobby & Retail'
              : f === 2
                ? 'Executive Offices'
                : f >= 8
                  ? 'Penthouse Suites'
                  : 'Residential Apartments'
          }`,
          map_image_url: `/blueprints/floor-${f}.svg`,
          map_width: 1920,
          map_height: 1080,
          has_sub_hub: hasSubHub,
          hub_id: hasSubHub ? hubCode : `GW-DIRECT-B${bld.id}`,
          hub_mac: hasSubHub ? hubMac : `DIRECT-TO-GW-B${bld.id}`,
          dip_switch_address: f,
          dip_binary: formatDipBinary(f),
          hub_status: !hasSubHub ? 'none' : isBatteryWarn ? 'battery_warning' : 'online',
          hub_battery_pct: !hasSubHub ? 0 : isBatteryWarn ? 34 : 94 + (f % 6),
          pairing_mode_active: false,
          last_heartbeat: nowIso,
          rs485_latency_ms: 4.1 + f * 0.7,
          rs485_packet_loss_pct: isBatteryWarn ? 0.4 : 0.02 * (f % 3),
          rs485_crc_errors: isBatteryWarn ? 2 : 0,
          rs485_tx_frames: 12400 + f * 480,
          rs485_rx_frames: 12396 + f * 480
        };
        this.floors.push(floorRecord);

        if (bld.id === 1 || f <= 2) {
          const aptPrefix = f * 10;
          const floorRoomsConfig: Array<{
            room_number: string;
            owner_user_id: number | null;
            perimeter: 'disarmed' | 'armed_home' | 'armed_away';
            bounds: { x: number; y: number; w: number; h: number; label: string };
            sensors: Array<{
              typeByte: string;
              status: SensorStatus;
              dx: number;
              dy: number;
              battery: number;
              smoke: number;
              co: number;
              temp: number;
              reed: boolean;
              glass: boolean;
              customChip?: string;
            }>;
          }> = [
            {
              room_number: `Apt ${aptPrefix + 1}`,
              owner_user_id: bld.id === 1 && f === 4 ? 7 : bld.id === 1 && f === 7 ? 5 : null,
              perimeter: f === 7 ? 'armed_away' : 'disarmed',
              bounds: { x: 4, y: 6, w: 42, h: 38, label: `Apt ${aptPrefix + 1} (North-West)` },
              sensors: [
                {
                  typeByte: '0x01',
                  status: 'online',
                  dx: 16,
                  dy: 18,
                  battery: 96,
                  smoke: 26 + (f % 5) * 2.2,
                  co: 4.0,
                  temp: 23.4,
                  reed: false,
                  glass: false,
                  customChip: bld.id === 1 && f === 1 ? 'C3-D04589043254' : undefined
                },
                {
                  typeByte: '0x03',
                  status: 'online',
                  dx: 41,
                  dy: 38,
                  battery: 92,
                  smoke: 18.0,
                  co: 3.1,
                  temp: 23.1,
                  reed: false,
                  glass: false
                }
              ]
            },
            {
              room_number: `Apt ${aptPrefix + 2}`,
              owner_user_id: bld.id === 1 && f === 4 ? 3 : bld.id === 1 && f === 1 ? 4 : null,
              perimeter: bld.id === 1 && f === 4 ? 'armed_home' : 'disarmed',
              bounds: { x: 54, y: 6, w: 42, h: 38, label: `Apt ${aptPrefix + 2} (North-East)` },
              sensors: [
                {
                  typeByte: '0x01',
                  status: 'online',
                  dx: 66,
                  dy: 18,
                  battery: 95,
                  smoke: f === 4 ? 45.2 : 29.5,
                  co: 5.0,
                  temp: 24.4,
                  reed: false,
                  glass: false,
                  customChip: bld.id === 1 && f === 4 ? 'C3-9A4F22B8' : undefined
                },
                {
                  typeByte: '0x02',
                  status: 'online',
                  dx: 79,
                  dy: 16,
                  battery: 93,
                  smoke: 22.0,
                  co: 4.2,
                  temp: f === 4 ? 24.6 : 23.8,
                  reed: false,
                  glass: false
                },
                {
                  typeByte: '0x03',
                  status: 'online',
                  dx: 58,
                  dy: 38,
                  battery: 91,
                  smoke: 19.5,
                  co: 3.8,
                  temp: 23.9,
                  reed: false,
                  glass: false
                },
                {
                  typeByte: '0x05',
                  status: 'online',
                  dx: 91,
                  dy: 27,
                  battery: 94,
                  smoke: 18.0,
                  co: 3.5,
                  temp: 23.5,
                  reed: false,
                  glass: false
                }
              ]
            },
            {
              room_number: `Corridor Fl-${f}`,
              owner_user_id: bld.tenant_user_id,
              perimeter: 'armed_home',
              bounds: { x: 4, y: 46, w: 92, h: 12, label: `Evacuation Corridor Fl-${f}` },
              sensors: [
                {
                  typeByte: '0x01',
                  status: 'online',
                  dx: 48,
                  dy: 52,
                  battery: 99,
                  smoke: 21.5,
                  co: 3.8,
                  temp: 22.7,
                  reed: false,
                  glass: false
                }
              ]
            },
            {
              room_number: `Apt ${aptPrefix + 3}`,
              owner_user_id: null,
              perimeter: 'disarmed',
              bounds: { x: 4, y: 60, w: 42, h: 34, label: `Apt ${aptPrefix + 3} (South-West)` },
              sensors: [
                {
                  typeByte: '0x04',
                  status: f === 3 ? 'warning' : 'online',
                  dx: 24,
                  dy: 76,
                  battery: f === 3 ? 19 : 88,
                  smoke: 24.0,
                  co: f === 3 ? 38.5 : 6.1,
                  temp: 24.1,
                  reed: false,
                  glass: false
                }
              ]
            },
            {
              room_number: `Apt ${aptPrefix + 4}`,
              owner_user_id: null,
              perimeter: 'armed_away',
              bounds: { x: 54, y: 60, w: 42, h: 34, label: `Apt ${aptPrefix + 4} (South-East)` },
              sensors: [
                {
                  typeByte: '0x02',
                  status: f === 8 ? 'offline' : 'online',
                  dx: 75,
                  dy: 77,
                  battery: f === 8 ? 0 : 93,
                  smoke: 23.0,
                  co: 4.3,
                  temp: f === 6 ? 46.8 : 23.6,
                  reed: false,
                  glass: false
                }
              ]
            }
          ];

          for (const rm of floorRoomsConfig) {
            const owner = this.users.find((u) => u.id === rm.owner_user_id);
            const roomRecord: RoomApartmentRecord = {
              id: roomIdCounter++,
              building_id: bld.id,
              floor_id: floorRecord.id,
              floor_number: f,
              room_number: rm.room_number,
              owner_user_id: rm.owner_user_id,
              owner_name: owner?.name || null,
              owner_email: owner?.email || null,
              owner_phone: owner?.phone_number || null,
              perimeter_security_status: rm.perimeter,
              created_at: nowIso,
              bounds: rm.bounds
            };
            this.rooms.push(roomRecord);

            for (const s of rm.sensors) {
              const hexSuffix = ((sensorIdCounter * 2654435761) >>> 0)
                .toString(16)
                .toUpperCase()
                .padStart(8, '0')
                .slice(0, 6);
              const chipId = s.customChip || `C3-B${bld.id}F${f}${hexSuffix}`;
              const decoded = decodeIntroPacket({
                chip_id: chipId,
                type_byte: s.typeByte
              });

              const primaryVal =
                decoded.sensor_type === 'SMOKE_MQ2'
                  ? Number(s.smoke.toFixed(1))
                  : decoded.sensor_type === 'TEMP_DS18B20'
                    ? Number(s.temp.toFixed(1))
                    : decoded.sensor_type === 'CO_MQ7'
                      ? Number(s.co.toFixed(1))
                      : decoded.sensor_type === 'DOOR_REED'
                        ? s.reed
                        : s.glass;

              const rssiVal = -61 - ((sensorIdCounter * 3) % 21);
              const parentNodeId = hasSubHub ? hubCode : `GW-SIM7670-TASH-0${bld.id}`;
              const armPerim = rm.perimeter !== 'disarmed';

              const sensorRecord: SensorEndpointRecord = {
                id: sensorIdCounter++,
                building_id: bld.id,
                room_id: roomRecord.id,
                room_number: roomRecord.room_number,
                floor_id: floorRecord.id,
                floor_number: f,
                chip_id: chipId,
                profile_code: decoded.profile_code,
                sensor_type: decoded.sensor_type,
                intro_packet_hex: decoded.intro_packet_hex,
                intro_type_byte: decoded.intro_type_byte,
                parent_link_type: hasSubHub ? 'FLOOR_HUB' : 'CENTRAL_GATEWAY',
                parent_node_id: parentNodeId,
                status: s.status,
                coord_x: s.dx,
                coord_y: s.dy,
                battery_level: s.battery,
                beacon_interval_seconds: 600,
                smoke_threshold_ppm: 400,
                temp_threshold_c: 60,
                arm_perimeter: armPerim,
                primary_value: primaryVal,
                primary_unit: decoded.primary_unit,
                smoke_ppm: Number(s.smoke.toFixed(1)),
                co_ppm: Number(s.co.toFixed(1)),
                temperature: Number(s.temp.toFixed(1)),
                reed_switch_open: s.reed,
                glass_break_detected: s.glass,
                rssi_dbm: rssiVal,
                attributes: buildDeviceAttributesBundle({
                  chip_id: chipId,
                  intro_packet_hex: decoded.intro_packet_hex,
                  intro_type_byte: decoded.intro_type_byte,
                  rssi_dbm: rssiVal,
                  parent_node_id: parentNodeId,
                  beacon_interval_seconds: 600,
                  smoke_threshold_ppm: 400,
                  temp_threshold_c: 60,
                  arm_perimeter: armPerim,
                  building_id: bld.id,
                  floor_id: floorRecord.id,
                  room_id: roomRecord.id,
                  coord_x: s.dx,
                  coord_y: s.dy,
                  claimed_by_user_id: rm.owner_user_id,
                  claimed_at: rm.owner_user_id ? nowIso : null,
                  nowIso
                }),
                claimed_by_user_id: rm.owner_user_id,
                claimed_at: rm.owner_user_id ? nowIso : null,
                last_seen: nowIso,
                created_at: nowIso
              };
              this.sensors.push(sensorRecord);
            }
          }
        }
      }
    }

    // 5. Seed Historical Stateful Alarm Events Archive (ThingsBoard Alarm Lifecycle)
    const apt42Sensor = this.sensors.find((s) => s.chip_id === 'C3-9A4F22B8') || this.sensors[0];
    this.alarmEvents = [
      {
        id: 1,
        building_id: 1,
        alarm_code: 'ALM-20260918-104',
        sensor_id: apt42Sensor.id,
        chip_id: apt42Sensor.chip_id,
        floor_number: 4,
        room_number: 'Apt 42',
        event_type: 'SMOKE_CRITICAL',
        severity: 'warning',
        status: 'acknowledged',
        lifecycle_state: 'CLEARED_ACK',
        trigger_count: 3,
        peak_value: 412.0,
        smoke_val: 412.0,
        temp_val: 48.5,
        co_val: 19.2,
        acknowledged_by: 2,
        acknowledged_by_name: 'Dilshod Karimov (Nest One Shirkat)',
        acknowledged_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        cleared_at: new Date(Date.now() - 86400000 * 3 + 60000).toISOString(),
        comments: [
          {
            id: 'CMT-101',
            user_id: 2,
            user_name: 'Dilshod Karimov (Nest One Shirkat)',
            comment: 'Oshxonada ovqat tutuni aniqlangan, xonadon egasi bilan bog‘lanildi va shamollatildi.',
            created_at: new Date(Date.now() - 86400000 * 3).toISOString()
          }
        ],
        emergency_112_payload: null,
        emergency_112_dispatched_at: null,
        emergency_112_response: null,
        created_at: new Date(Date.now() - 86400000 * 3 - 25000).toISOString(),
        updated_at: new Date(Date.now() - 86400000 * 3 + 60000).toISOString()
      }
    ];

    // 6. Seed Initial RPC Command Queue Log
    this.rpcCommands = [
      {
        id: 1,
        rpc_uid: 'RPC-INIT-9001',
        building_id: 1,
        target_type: 'CENTRAL_GATEWAY',
        target_id: 'GW-SIM7670-TASH-01',
        method: 'SYNC_DEVICE_PROFILES',
        params: { profiles_count: 5, crc_check: 'OK' },
        status: 'ACKED',
        initiated_by_user_id: 1,
        response_payload: { ack: true, latency_ms: 18 },
        created_at: nowIso,
        ack_at: nowIso,
        expires_at: new Date(Date.now() + 300000).toISOString()
      }
    ];
  }

  public enqueueRpcCommand(params: {
    building_id: number;
    target_type: 'CENTRAL_GATEWAY' | 'FLOOR_HUB' | 'END_DEVICE';
    target_id: string;
    method: string;
    payload: Record<string, unknown>;
    initiated_by_user_id?: number | null;
    immediateAck?: boolean;
  }): RpcCommandRecord {
    const nowIso = new Date().toISOString();
    const isImmediate = params.immediateAck ?? params.target_type !== 'END_DEVICE';
    const nextId = this.rpcCommands.length
      ? Math.max(...this.rpcCommands.map((r) => r.id)) + 1
      : 1;

    const record: RpcCommandRecord = {
      id: nextId,
      rpc_uid: `RPC-${Date.now()}-${nextId}`,
      building_id: params.building_id,
      target_type: params.target_type,
      target_id: params.target_id,
      method: params.method,
      params: params.payload,
      status: isImmediate ? 'ACKED' : 'QUEUED',
      initiated_by_user_id: params.initiated_by_user_id ?? 1,
      response_payload: isImmediate
        ? { ack: true, transport: params.target_type === 'CENTRAL_GATEWAY' ? 'MQTT_TLS' : 'RS485_BUS' }
        : { queued_for_deep_sleep_wakeup: true },
      created_at: nowIso,
      ack_at: isImmediate ? nowIso : null,
      expires_at: new Date(Date.now() + 600000).toISOString()
    };

    this.rpcCommands.unshift(record);
    if (this.rpcCommands.length > 100) {
      this.rpcCommands.pop();
    }
    return record;
  }

  /**
   * ThingsBoard Asset Health Rollup Pattern:
   * Aggregates status from End-Devices -> Apartments -> Floors -> Buildings
   */
  public computeAssetHealthRollup(buildingId?: number): {
    buildings: Array<{
      building_id: number;
      name: string;
      health_status: AssetHealthStatus;
      active_alarms_count: number;
      warning_devices_count: number;
      offline_devices_count: number;
      pending_sync_count: number;
      total_devices_count: number;
    }>;
  } {
    const targetBuildings = buildingId
      ? this.buildings.filter((b) => b.id === buildingId)
      : this.buildings;

    const buildingsSummary = targetBuildings.map((bld) => {
      const bldSensors = this.sensors.filter((s) => s.building_id === bld.id);
      const activeAlarms = bldSensors.filter((s) => s.status === 'alarm').length;
      const warningDevices = bldSensors.filter(
        (s) => s.status === 'warning' || s.battery_level < 20
      ).length;
      const offlineDevices = bldSensors.filter((s) => s.status === 'offline').length;
      const pendingSync = bldSensors.filter(
        (s) => s.attributes?.sync_status === 'PENDING_WAKEUP'
      ).length;

      let health: AssetHealthStatus = 'HEALTHY';
      if (activeAlarms > 0) {
        health = 'CRITICAL_ALARM';
      } else if (warningDevices > 0 || offlineDevices > 0) {
        health = 'WARNING';
      }

      return {
        building_id: bld.id,
        name: bld.name,
        health_status: health,
        active_alarms_count: activeAlarms,
        warning_devices_count: warningDevices,
        offline_devices_count: offlineDevices,
        pending_sync_count: pendingSync,
        total_devices_count: bldSensors.length
      };
    });

    return { buildings: buildingsSummary };
  }

  public generateHistoricalTelemetry(
    sensorId: number,
    range: '24h' | '7d' | '30d' | '1y'
  ): Array<{
    timestamp: string;
    label: string;
    smoke_ppm: number;
    co_ppm: number;
    temperature: number;
    threshold_smoke: number;
    threshold_temp: number;
  }> {
    const sensor = this.sensors.find((s) => s.id === sensorId) || this.sensors[0];
    const now = Date.now();
    const pointsCount = range === '24h' ? 24 : range === '7d' ? 28 : range === '30d' ? 30 : 52;
    const stepMs =
      range === '24h'
        ? 3600 * 1000
        : range === '7d'
          ? 6 * 3600 * 1000
          : range === '30d'
            ? 24 * 3600 * 1000
            : 7 * 24 * 3600 * 1000;

    const series = [];
    for (let i = pointsCount - 1; i >= 0; i--) {
      const ts = new Date(now - i * stepMs);
      const phase = (i + sensor.id) * 0.45;
      const seasonal = Math.sin(phase) * 12 + Math.cos(phase * 0.5) * 6;
      const isHistoricalSpike =
        (range === '30d' && i === 12) || (range === '1y' && (i === 19 || i === 37));
      const baseSmoke = Math.max(12, sensor.smoke_ppm + seasonal + (isHistoricalSpike ? 395 : 0));
      const baseTemp = Math.max(
        18,
        sensor.temperature + Math.sin(phase * 0.8) * 3.2 + (isHistoricalSpike ? 38.5 : 0)
      );
      const baseCo = Math.max(
        2,
        sensor.co_ppm + Math.cos(phase) * 2.4 + (isHistoricalSpike ? 42 : 0)
      );

      let label = '';
      if (range === '24h') {
        label = ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      } else if (range === '7d' || range === '30d') {
        label = ts.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      } else {
        label = ts.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      }

      series.push({
        timestamp: ts.toISOString(),
        label,
        smoke_ppm: Number(baseSmoke.toFixed(1)),
        co_ppm: Number(baseCo.toFixed(1)),
        temperature: Number(baseTemp.toFixed(1)),
        threshold_smoke: sensor.smoke_threshold_ppm || 400,
        threshold_temp: sensor.temp_threshold_c || 60
      });
    }
    return series;
  }
}

export const dbStore = new DigitalTwinDatabase();

export const initializeDatabase = async (): Promise<void> => {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'smart_building_ecosystem';

  try {
    mysqlPool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0,
      multipleStatements: true,
      connectTimeout: 2500
    });

    const conn = await mysqlPool.getConnection();
    isMysqlConnected = true;

    const ddlPath = path.join(__dirname, '../models/ddl.sql');
    if (fs.existsSync(ddlPath)) {
      const ddlSql = fs.readFileSync(ddlPath, 'utf8');
      await conn.query(ddlSql);
    }

    conn.release();
    console.log(`[Database] Connected to MySQL (${host}:${port}/${database}) with SaaS schema.`);
  } catch (err) {
    isMysqlConnected = false;
    console.log(
      `[Database] MySQL instance at ${host}:${port} not reachable (${(err as Error).message}). ` +
        `Operating in Autonomous Multi-Building SaaS Digital Twin Store mode.`
    );
  }
};

export const ensureQuarterlyPartitions = async (): Promise<{
  partitionStrategy: string;
  activePartitions: string[];
}> => {
  return {
    partitionStrategy: 'RANGE (UNIX_TIMESTAMP(recorded_at))',
    activePartitions: [
      'p_prev (< 2026-01-01)',
      'p_2026_q1 (< 2026-04-01)',
      'p_2026_q2 (< 2026-07-01)',
      'p_2026_q3 (< 2026-10-01)',
      'p_2026_q4 (< 2027-01-01)',
      'p_future (MAXVALUE)'
    ]
  };
};
