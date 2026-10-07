import { Request, Response } from 'express';
import {
  dbStore,
  decodeIntroPacket,
  formatDipBinary,
  buildDeviceAttributesBundle
} from '../config/database';
import { socketService } from '../services/socket.service';
import {
  AuthenticatedRequest,
  BuildingRecord,
  FloorRecord,
  GatewayDeviceRecord,
  PairingSessionRecord,
  RoomApartmentRecord,
  SensorEndpointRecord,
  UserRecord,
  UserRole,
  AssetHealthStatus
} from '../types';

// ============================================================================
// 1. MULTI-BUILDING SAAS MANAGEMENT & ASSET ROLLUP (SUPER ADMIN & TENANT)
// ============================================================================
export const getAllBuildings = (req: Request, res: Response): void => {
  const tenantId = req.query.tenant_id ? Number(req.query.tenant_id) : undefined;

  let list = dbStore.buildings;
  if (tenantId) {
    list = list.filter((b) => b.tenant_user_id === tenantId);
  }

  const enriched = list.map((b) => {
    const bFloors = dbStore.floors.filter((f) => f.building_id === b.id);
    const bRooms = dbStore.rooms.filter((r) => r.building_id === b.id);
    const bSensors = dbStore.sensors.filter((s) => s.building_id === b.id);
    const gateway = dbStore.gateways.find((g) => g.building_id === b.id) || null;
    const tenant = dbStore.users.find((u) => u.id === b.tenant_user_id) || null;

    const alarmCount = bSensors.filter((s) => s.status === 'alarm').length;
    const offlineCount = bSensors.filter((s) => s.status === 'offline').length;
    const warningCount = bSensors.filter(
      (s) => s.status === 'warning' || s.battery_level < 20
    ).length;

    let healthStatus: AssetHealthStatus = 'HEALTHY';
    if (alarmCount > 0) {
      healthStatus = 'CRITICAL_ALARM';
    } else if (offlineCount > 0 || warningCount > 0) {
      healthStatus = 'WARNING';
    }

    return {
      ...b,
      tenant_name: tenant?.name || null,
      tenant_email: tenant?.email || null,
      tenant_phone: tenant?.phone_number || null,
      health_status: healthStatus,
      active_alarms_count: alarmCount,
      offline_devices_count: offlineCount,
      gateway,
      stats: {
        floors_count: bFloors.length,
        hubs_count: bFloors.filter((f) => f.has_sub_hub).length,
        apartments_count: bRooms.length,
        sensors_count: bSensors.length,
        online_sensors: bSensors.filter((s) => s.status === 'online').length,
        alarm_sensors: alarmCount,
        pending_sync_sensors: bSensors.filter(
          (s) => s.attributes?.sync_status === 'PENDING_WAKEUP'
        ).length
      }
    };
  });

  res.json({ buildings: enriched });
};

export const createBuilding = (req: AuthenticatedRequest, res: Response): void => {
  const {
    name,
    code,
    address,
    city,
    total_floors,
    tenant_user_id,
    gateway_serial,
    sim_operator
  } = req.body as {
    name: string;
    code?: string;
    address: string;
    city?: string;
    total_floors?: number;
    tenant_user_id?: number | null;
    gateway_serial?: string;
    sim_operator?: string;
  };

  if (!name || !address) {
    res.status(400).json({ error: 'Building name and address are required' });
    return;
  }

  const nowIso = new Date().toISOString();
  const newBuildingId =
    dbStore.buildings.reduce((max, b) => Math.max(max, b.id), 0) + 1;
  const floorsCount = Math.max(1, Math.min(30, Number(total_floors || 9)));
  const tenant = tenant_user_id
    ? dbStore.users.find((u) => u.id === Number(tenant_user_id))
    : null;

  const newGwId = dbStore.gateways.reduce((max, g) => Math.max(max, g.id), 0) + 1;
  const gatewayRecord: GatewayDeviceRecord = {
    id: newGwId,
    building_id: newBuildingId,
    building_name: name,
    serial_number: gateway_serial || `GW-SIM7670-BLD-0${newBuildingId}`,
    mac_address: `B4:E6:2D:90:0${newBuildingId}:A1`,
    imei: `86948205911${String(1000 + newBuildingId)}`,
    sim_operator: sim_operator || 'Uztelecom GSM / LTE',
    firmware_version: 'v3.4.2-LTE',
    rssi_dbm: -60,
    status: 'online',
    pairing_mode_active: false,
    last_seen: nowIso,
    created_at: nowIso
  };
  dbStore.gateways.push(gatewayRecord);

  const newBuilding: BuildingRecord = {
    id: newBuildingId,
    code: code || `SMART-BLD-${(city || 'TASH').slice(0, 4).toUpperCase()}-0${newBuildingId}`,
    name,
    address,
    city: city || 'Tashkent',
    total_floors: floorsCount,
    tenant_user_id: tenant ? tenant.id : null,
    tenant_name: tenant?.name || null,
    tenant_email: tenant?.email || null,
    tenant_phone: tenant?.phone_number || null,
    gateway_id: gatewayRecord.id,
    health_status: 'HEALTHY',
    active_alarms_count: 0,
    offline_devices_count: 0,
    created_at: nowIso
  };
  dbStore.buildings.push(newBuilding);

  let nextFloorId = dbStore.floors.reduce((max, f) => Math.max(max, f.id), 0) + 1;
  let nextRoomId = dbStore.rooms.reduce((max, r) => Math.max(max, r.id), 0) + 1;

  for (let f = 1; f <= floorsCount; f++) {
    const flId = nextFloorId++;
    const floorObj: FloorRecord = {
      id: flId,
      building_id: newBuilding.id,
      building_name: newBuilding.name,
      floor_number: f,
      name: `Floor ${f} — Residential & Suites`,
      map_image_url: `/blueprints/floor-${f}.svg`,
      map_width: 1920,
      map_height: 1080,
      has_sub_hub: true,
      hub_id: `HUB-B${newBuilding.id}-FL0${f}`,
      hub_mac: `EC:DA:3B:B${newBuilding.id}:0${f}:A${f}`,
      dip_switch_address: f,
      dip_binary: formatDipBinary(f),
      hub_status: 'online',
      hub_battery_pct: 100,
      pairing_mode_active: false,
      health_status: 'HEALTHY',
      last_heartbeat: nowIso,
      rs485_latency_ms: 4.5 + f * 0.5,
      rs485_packet_loss_pct: 0,
      rs485_crc_errors: 0,
      rs485_tx_frames: 100,
      rs485_rx_frames: 100
    };
    dbStore.floors.push(floorObj);

    const aptPrefix = f * 10;
    const defaultRooms = [
      {
        num: `Apt ${aptPrefix + 1}`,
        bounds: { x: 4, y: 6, w: 42, h: 38, label: `Apt ${aptPrefix + 1}` }
      },
      {
        num: `Apt ${aptPrefix + 2}`,
        bounds: { x: 54, y: 6, w: 42, h: 38, label: `Apt ${aptPrefix + 2}` }
      },
      {
        num: `Corridor Fl-${f}`,
        bounds: { x: 4, y: 46, w: 92, h: 12, label: `Corridor Fl-${f}` }
      },
      {
        num: `Apt ${aptPrefix + 3}`,
        bounds: { x: 4, y: 60, w: 42, h: 34, label: `Apt ${aptPrefix + 3}` }
      },
      {
        num: `Apt ${aptPrefix + 4}`,
        bounds: { x: 54, y: 60, w: 42, h: 34, label: `Apt ${aptPrefix + 4}` }
      }
    ];

    for (const dr of defaultRooms) {
      dbStore.rooms.push({
        id: nextRoomId++,
        building_id: newBuilding.id,
        floor_id: flId,
        floor_number: f,
        room_number: dr.num,
        owner_user_id: null,
        perimeter_security_status: 'disarmed',
        health_status: 'HEALTHY',
        created_at: nowIso,
        bounds: dr.bounds
      });
    }
  }

  socketService.emitGlobal('BUILDING_CREATED', {
    building: newBuilding,
    gateway: gatewayRecord
  });

  res.status(201).json({
    message: `Building "${newBuilding.name}" created with ${floorsCount} floors`,
    building: newBuilding,
    gateway: gatewayRecord
  });
};

export const assignBuildingTenant = (req: Request, res: Response): void => {
  const buildingId = Number(req.params.id);
  const { tenant_user_id } = req.body as { tenant_user_id: number | null };

  const building = dbStore.buildings.find((b) => b.id === buildingId);
  if (!building) {
    res.status(404).json({ error: 'Building not found' });
    return;
  }

  const tenant = tenant_user_id
    ? dbStore.users.find((u) => u.id === Number(tenant_user_id))
    : null;

  building.tenant_user_id = tenant ? tenant.id : null;
  building.tenant_name = tenant?.name || null;
  building.tenant_email = tenant?.email || null;
  building.tenant_phone = tenant?.phone_number || null;

  socketService.emitGlobal('BUILDING_UPDATED', { building });

  res.json({
    message: `Assigned tenant ${tenant ? tenant.name : 'Unassigned'} to ${building.name}`,
    building
  });
};

export const addFloorToBuilding = (req: Request, res: Response): void => {
  const buildingId = Number(req.params.id);
  const { floor_number, name, has_sub_hub, hub_mac } = req.body as {
    floor_number?: number;
    name?: string;
    has_sub_hub?: boolean;
    hub_mac?: string;
  };

  const building = dbStore.buildings.find((b) => b.id === buildingId);
  if (!building) {
    res.status(404).json({ error: 'Building not found' });
    return;
  }

  const existingFloors = dbStore.floors.filter((f) => f.building_id === buildingId);
  const nextFloorNum =
    floor_number ||
    existingFloors.reduce((max, f) => Math.max(max, f.floor_number), 0) + 1;

  if (existingFloors.some((f) => f.floor_number === nextFloorNum)) {
    res.status(400).json({ error: `Floor ${nextFloorNum} already exists in this building` });
    return;
  }

  const newFloorId = dbStore.floors.reduce((max, f) => Math.max(max, f.id), 0) + 1;
  const subHubFlag = has_sub_hub !== false;
  const nowIso = new Date().toISOString();

  const newFloor: FloorRecord = {
    id: newFloorId,
    building_id: building.id,
    building_name: building.name,
    floor_number: nextFloorNum,
    name: name || `Floor ${nextFloorNum} — Residential Level`,
    map_image_url: `/blueprints/floor-${nextFloorNum}.svg`,
    map_width: 1920,
    map_height: 1080,
    has_sub_hub: subHubFlag,
    hub_id: subHubFlag ? `HUB-B${building.id}-FL0${nextFloorNum}` : `GW-DIRECT-B${building.id}`,
    hub_mac:
      hub_mac ||
      (subHubFlag
        ? `EC:DA:3B:B${building.id}:${String(nextFloorNum).padStart(2, '0')}:AA`
        : `DIRECT-TO-GW-B${building.id}`),
    dip_switch_address: nextFloorNum,
    dip_binary: formatDipBinary(nextFloorNum),
    hub_status: subHubFlag ? 'online' : 'none',
    hub_battery_pct: subHubFlag ? 100 : 0,
    pairing_mode_active: false,
    health_status: 'HEALTHY',
    last_heartbeat: nowIso,
    rs485_latency_ms: 5.2,
    rs485_packet_loss_pct: 0,
    rs485_crc_errors: 0,
    rs485_tx_frames: 50,
    rs485_rx_frames: 50
  };

  dbStore.floors.push(newFloor);
  building.total_floors = dbStore.floors.filter((f) => f.building_id === building.id).length;

  let nextRoomId = dbStore.rooms.reduce((max, r) => Math.max(max, r.id), 0) + 1;
  const aptPrefix = nextFloorNum * 10;
  dbStore.rooms.push(
    {
      id: nextRoomId++,
      building_id: building.id,
      floor_id: newFloor.id,
      floor_number: nextFloorNum,
      room_number: `Apt ${aptPrefix + 1}`,
      owner_user_id: null,
      perimeter_security_status: 'disarmed',
      health_status: 'HEALTHY',
      created_at: nowIso,
      bounds: { x: 4, y: 6, w: 42, h: 38, label: `Apt ${aptPrefix + 1}` }
    },
    {
      id: nextRoomId++,
      building_id: building.id,
      floor_id: newFloor.id,
      floor_number: nextFloorNum,
      room_number: `Apt ${aptPrefix + 2}`,
      owner_user_id: null,
      perimeter_security_status: 'disarmed',
      health_status: 'HEALTHY',
      created_at: nowIso,
      bounds: { x: 54, y: 6, w: 42, h: 38, label: `Apt ${aptPrefix + 2}` }
    }
  );

  res.status(201).json({
    message: `Floor ${nextFloorNum} added to ${building.name}`,
    floor: newFloor
  });
};

export const addApartmentToFloor = (req: Request, res: Response): void => {
  const buildingId = Number(req.params.id);
  const { floor_number, room_number, owner_user_id } = req.body as {
    floor_number: number;
    room_number: string;
    owner_user_id?: number | null;
  };

  const floor = dbStore.floors.find(
    (f) => f.building_id === buildingId && f.floor_number === Number(floor_number)
  );
  if (!floor) {
    res.status(404).json({ error: 'Floor not found in this building' });
    return;
  }

  const owner = owner_user_id
    ? dbStore.users.find((u) => u.id === Number(owner_user_id))
    : null;
  const newRoomId = dbStore.rooms.reduce((max, r) => Math.max(max, r.id), 0) + 1;
  const existingOnFloor = dbStore.rooms.filter((r) => r.floor_id === floor.id).length;

  const newRoom: RoomApartmentRecord = {
    id: newRoomId,
    building_id: buildingId,
    floor_id: floor.id,
    floor_number: floor.floor_number,
    room_number: room_number || `Apt ${floor.floor_number}${existingOnFloor + 1}`,
    owner_user_id: owner ? owner.id : null,
    owner_name: owner?.name || null,
    owner_email: owner?.email || null,
    owner_phone: owner?.phone_number || null,
    perimeter_security_status: 'disarmed',
    health_status: 'HEALTHY',
    created_at: new Date().toISOString(),
    bounds: {
      x: existingOnFloor % 2 === 0 ? 4 : 54,
      y: existingOnFloor < 2 ? 6 : 60,
      w: 42,
      h: 34,
      label: room_number
    }
  };

  dbStore.rooms.push(newRoom);
  res.status(201).json({
    message: `Apartment ${newRoom.room_number} created on Floor ${floor.floor_number}`,
    apartment: newRoom
  });
};

export const createNewUserAccount = (req: Request, res: Response): void => {
  const { name, email, role, phone_number } = req.body as {
    name: string;
    email: string;
    role: UserRole;
    phone_number?: string;
  };

  if (!name || !email) {
    res.status(400).json({ error: 'Name and email are required' });
    return;
  }

  const nowIso = new Date().toISOString();
  const newId = dbStore.users.reduce((max, u) => Math.max(max, u.id), 0) + 1;
  const newUser: UserRecord = {
    id: newId,
    google_id: `google-sso-${newId}-${Date.now()}`,
    email,
    name,
    avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
    role: role || 'user',
    phone_number: phone_number || '+998900000000',
    created_at: nowIso,
    updated_at: nowIso
  };

  dbStore.users.push(newUser);
  res.status(201).json({
    message: `User ${newUser.name} (${newUser.role}) registered`,
    user: newUser
  });
};

// ============================================================================
// 2. DEDICATED DEVICES INVENTORY (GATEWAYS, FLOOR HUBS, END DEVICES, PROFILES)
// ============================================================================
export const getDevicesInventory = (req: Request, res: Response): void => {
  const buildingId = req.query.building_id ? Number(req.query.building_id) : undefined;

  const gateways = buildingId
    ? dbStore.gateways.filter((g) => g.building_id === buildingId)
    : dbStore.gateways;

  const floorHubs = (
    buildingId
      ? dbStore.floors.filter((f) => f.building_id === buildingId)
      : dbStore.floors
  ).map((fl) => ({
    id: fl.id,
    building_id: fl.building_id,
    building_name: fl.building_name,
    floor_number: fl.floor_number,
    floor_name: fl.name,
    has_sub_hub: fl.has_sub_hub,
    hub_id: fl.hub_id,
    hub_mac: fl.hub_mac,
    dip_switch_address: fl.dip_switch_address,
    dip_binary: fl.dip_binary,
    hub_status: fl.hub_status,
    hub_battery_pct: fl.hub_battery_pct,
    pairing_mode_active: Boolean(fl.pairing_mode_active),
    rs485_latency_ms: fl.rs485_latency_ms,
    connected_endpoints_count: dbStore.sensors.filter((s) => s.floor_id === fl.id).length
  }));

  const endDevices = buildingId
    ? dbStore.sensors.filter((s) => s.building_id === buildingId)
    : dbStore.sensors;

  const rpcCommands = buildingId
    ? dbStore.rpcCommands.filter((r) => r.building_id === buildingId)
    : dbStore.rpcCommands;

  res.json({
    summary: {
      total_gateways: gateways.length,
      total_floor_hubs: floorHubs.filter((h) => h.has_sub_hub).length,
      total_end_devices: endDevices.length,
      pending_attribute_sync: endDevices.filter(
        (d) => d.attributes?.sync_status === 'PENDING_WAKEUP'
      ).length,
      by_sensor_type: {
        SMOKE_MQ2: endDevices.filter((d) => d.sensor_type === 'SMOKE_MQ2').length,
        TEMP_DS18B20: endDevices.filter((d) => d.sensor_type === 'TEMP_DS18B20').length,
        DOOR_REED: endDevices.filter((d) => d.sensor_type === 'DOOR_REED').length,
        CO_MQ7: endDevices.filter((d) => d.sensor_type === 'CO_MQ7').length,
        GLASS_BREAK: endDevices.filter((d) => d.sensor_type === 'GLASS_BREAK').length
      }
    },
    device_profiles: dbStore.deviceProfiles,
    gateways,
    floor_hubs: floorHubs,
    end_devices: endDevices,
    rpc_commands: rpcCommands.slice(0, 30)
  });
};

export const registerCentralGateway = (req: Request, res: Response): void => {
  const { building_id, serial_number, imei, sim_operator } = req.body as {
    building_id?: number | null;
    serial_number: string;
    imei?: string;
    sim_operator?: string;
  };

  const bld = building_id ? dbStore.buildings.find((b) => b.id === Number(building_id)) : null;
  const newId = dbStore.gateways.reduce((max, g) => Math.max(max, g.id), 0) + 1;
  const nowIso = new Date().toISOString();

  const newGw: GatewayDeviceRecord = {
    id: newId,
    building_id: bld ? bld.id : null,
    building_name: bld ? bld.name : null,
    serial_number: serial_number || `GW-SIM7670-0${newId}`,
    mac_address: `B4:E6:2D:99:0${newId}:FF`,
    imei: imei || `8694820599900${newId}`,
    sim_operator: sim_operator || 'Uztelecom LTE',
    firmware_version: 'v3.4.2-LTE',
    rssi_dbm: -58,
    status: 'online',
    pairing_mode_active: false,
    last_seen: nowIso,
    created_at: nowIso
  };

  dbStore.gateways.push(newGw);
  if (bld) {
    bld.gateway_id = newGw.id;
  }

  res.status(201).json({
    message: `Central Gateway ${newGw.serial_number} registered`,
    gateway: newGw
  });
};

export const registerOrUpdateFloorHub = (req: Request, res: Response): void => {
  const { building_id, floor_number, hub_mac, dip_switch_address, has_sub_hub } = req.body as {
    building_id: number;
    floor_number: number;
    hub_mac?: string;
    dip_switch_address?: number;
    has_sub_hub?: boolean;
  };

  const floor = dbStore.floors.find(
    (f) => f.building_id === Number(building_id) && f.floor_number === Number(floor_number)
  );
  if (!floor) {
    res.status(404).json({ error: 'Target floor not found' });
    return;
  }

  const enableHub = has_sub_hub !== false;
  floor.has_sub_hub = enableHub;
  floor.dip_switch_address = dip_switch_address || floor.floor_number;
  floor.dip_binary = formatDipBinary(floor.dip_switch_address);
  floor.hub_id = enableHub
    ? `HUB-B${floor.building_id}-FL0${floor.floor_number}`
    : `GW-DIRECT-B${floor.building_id}`;
  floor.hub_mac =
    hub_mac ||
    (enableHub
      ? `EC:DA:3B:B${floor.building_id}:0${floor.floor_number}:C3`
      : `DIRECT-TO-GW-B${floor.building_id}`);
  floor.hub_status = enableHub ? 'online' : 'none';
  floor.hub_battery_pct = enableHub ? 100 : 0;

  res.json({
    message: enableHub
      ? `Floor Sub-Hub ${floor.hub_id} configured on Floor ${floor.floor_number}`
      : `Floor ${floor.floor_number} switched to Direct Central Gateway mode`,
    floor
  });
};

// ============================================================================
// 3. DRAG-AND-DROP PAIRING MODE, DEVICE CLAIMING & INTRO PACKET AUTO-DETECTION
// ============================================================================
export const startDevicePairingSession = (req: AuthenticatedRequest, res: Response): void => {
  const { building_id, floor_id, floor_number, room_id, apartment_id, coord_x, coord_y } =
    req.body as {
      building_id?: number;
      floor_id?: number;
      floor_number?: number;
      room_id?: number;
      apartment_id?: number;
      coord_x: number;
      coord_y: number;
    };

  const bldId = Number(building_id || 1);
  const floor =
    (floor_id ? dbStore.floors.find((f) => f.id === Number(floor_id)) : undefined) ||
    dbStore.floors.find(
      (f) => f.building_id === bldId && f.floor_number === Number(floor_number || 4)
    ) ||
    dbStore.floors[0];

  const targetRoomId = room_id || apartment_id;
  const room =
    (targetRoomId ? dbStore.rooms.find((r) => r.id === Number(targetRoomId)) : undefined) ||
    dbStore.rooms.find((r) => r.floor_id === floor.id) ||
    dbStore.rooms[0];

  const gateway =
    dbStore.gateways.find((g) => g.building_id === floor.building_id) || dbStore.gateways[0];

  const useFloorHub =
    floor.has_sub_hub && floor.hub_status !== 'none' && floor.hub_status !== 'offline';

  if (useFloorHub) {
    floor.pairing_mode_active = true;
    floor.hub_status = 'pairing_mode';
  } else if (gateway) {
    gateway.pairing_mode_active = true;
    gateway.status = 'pairing_mode';
  }

  const claimSecret = `CLM-${Math.floor(100000 + Math.random() * 900000)}`;

  const session: PairingSessionRecord = {
    session_id: `PAIR-${Date.now()}`,
    building_id: floor.building_id,
    floor_id: floor.id,
    floor_number: floor.floor_number,
    room_id: room.id,
    room_number: room.room_number,
    coord_x: Number(Number(coord_x ?? 50).toFixed(2)),
    coord_y: Number(Number(coord_y ?? 50).toFixed(2)),
    target_receiver_type: useFloorHub ? 'FLOOR_HUB' : 'CENTRAL_GATEWAY',
    target_receiver_id: useFloorHub ? floor.hub_id : gateway.serial_number,
    claim_secret: claimSecret,
    status: 'listening',
    initiated_by_user_id: req.user?.id || 3,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60000).toISOString()
  };

  dbStore.pairingSessions.unshift(session);

  // Enqueue RPC command in ThingsBoard-style RPC Command Queue
  const rpcCmd = dbStore.enqueueRpcCommand({
    building_id: floor.building_id,
    target_type: session.target_receiver_type,
    target_id: session.target_receiver_id,
    method: 'ENABLE_PAIRING_MODE',
    payload: {
      session_id: session.session_id,
      claim_secret: claimSecret,
      window_sec: 60,
      room_number: room.room_number
    },
    initiated_by_user_id: req.user?.id || 3,
    immediateAck: true
  });

  socketService.emitGlobal('PAIRING_MODE_STARTED', {
    session,
    rpc_command: rpcCmd,
    receiver_label: useFloorHub
      ? `Floor ${floor.floor_number} Sub-Hub (${floor.hub_id} / DIP ${floor.dip_binary})`
      : `Central Building Gateway (${gateway.serial_number})`
  });

  res.status(201).json({
    message: useFloorHub
      ? `Floor Sub-Hub (${floor.hub_id}) entered BLE/RS485 Pairing Mode — waiting for device Intro Packet`
      : `Central Gateway (${gateway.serial_number}) entered Direct Pairing Mode — waiting for device Intro Packet`,
    session,
    rpc_command: rpcCmd
  });
};

export const completePairingViaIntroPacket = (req: AuthenticatedRequest, res: Response): void => {
  const {
    session_id,
    raw_intro_packet_hex,
    intro_packet_hex,
    intro_type_byte,
    chip_id,
    building_id,
    floor_id,
    floor_number,
    room_id,
    apartment_id,
    coord_x,
    coord_y
  } = req.body as {
    session_id?: string;
    raw_intro_packet_hex?: string;
    intro_packet_hex?: string;
    intro_type_byte?: string;
    chip_id?: string;
    building_id?: number;
    floor_id?: number;
    floor_number?: number;
    room_id?: number;
    apartment_id?: number;
    coord_x?: number;
    coord_y?: number;
  };

  const session = session_id
    ? dbStore.pairingSessions.find((s) => s.session_id === session_id)
    : dbStore.pairingSessions.find((s) => s.status === 'listening');

  const decoded = decodeIntroPacket({
    raw_hex: raw_intro_packet_hex || intro_packet_hex,
    type_byte: intro_type_byte,
    chip_id
  });

  const matchedProfile =
    dbStore.deviceProfiles.find((p) => p.code === decoded.profile_code) ||
    dbStore.deviceProfiles[0];

  const targetFloorId = session?.floor_id || (floor_id ? Number(floor_id) : undefined);
  const floor =
    (targetFloorId ? dbStore.floors.find((f) => f.id === targetFloorId) : undefined) ||
    dbStore.floors.find(
      (f) =>
        f.building_id === Number(building_id || 1) &&
        f.floor_number === Number(floor_number || 4)
    ) ||
    dbStore.floors[0];

  const targetRoomId = session?.room_id || room_id || apartment_id;
  const room =
    (targetRoomId ? dbStore.rooms.find((r) => r.id === Number(targetRoomId)) : undefined) ||
    dbStore.rooms.find((r) => r.floor_id === floor.id) ||
    dbStore.rooms[0];

  const gateway =
    dbStore.gateways.find((g) => g.building_id === floor.building_id) || dbStore.gateways[0];

  if (floor.pairing_mode_active || floor.hub_status === 'pairing_mode') {
    floor.pairing_mode_active = false;
    floor.hub_status = floor.has_sub_hub ? 'online' : 'none';
  }
  if (gateway && gateway.pairing_mode_active) {
    gateway.pairing_mode_active = false;
    gateway.status = 'online';
  }
  if (session) {
    session.status = 'completed';
  }

  const newSensorId = dbStore.sensors.reduce((max, s) => Math.max(max, s.id), 0) + 1;
  const nowIso = new Date().toISOString();

  const finalX = session?.coord_x ?? Number(Number(coord_x ?? 62).toFixed(2));
  const finalY = session?.coord_y ?? Number(Number(coord_y ?? 24).toFixed(2));
  const parentType =
    session?.target_receiver_type || (floor.has_sub_hub ? 'FLOOR_HUB' : 'CENTRAL_GATEWAY');
  const parentId =
    session?.target_receiver_id || (floor.has_sub_hub ? floor.hub_id : gateway.serial_number);
  const claimerUserId = req.user?.id || room.owner_user_id || 3;
  const armPerim = room.perimeter_security_status !== 'disarmed';

  const newSensor: SensorEndpointRecord = {
    id: newSensorId,
    building_id: floor.building_id,
    room_id: room.id,
    room_number: room.room_number,
    floor_id: floor.id,
    floor_number: floor.floor_number,
    chip_id: decoded.chip_id,
    profile_code: matchedProfile.code,
    sensor_type: decoded.sensor_type,
    intro_packet_hex: decoded.intro_packet_hex,
    intro_type_byte: decoded.intro_type_byte,
    parent_link_type: parentType,
    parent_node_id: parentId,
    status: 'online',
    coord_x: finalX,
    coord_y: finalY,
    battery_level: decoded.battery_pct,
    beacon_interval_seconds: matchedProfile.default_beacon_interval_sec,
    smoke_threshold_ppm:
      matchedProfile.sensor_type === 'SMOKE_MQ2' && matchedProfile.critical_threshold
        ? matchedProfile.critical_threshold
        : 400,
    temp_threshold_c:
      matchedProfile.sensor_type === 'TEMP_DS18B20' && matchedProfile.critical_threshold
        ? matchedProfile.critical_threshold
        : 60,
    arm_perimeter: armPerim,
    primary_value: decoded.primary_value,
    primary_unit: decoded.primary_unit,
    smoke_ppm: decoded.sensor_type === 'SMOKE_MQ2' ? 28.4 : 18.0,
    co_ppm: decoded.sensor_type === 'CO_MQ7' ? 6.2 : 3.0,
    temperature: decoded.sensor_type === 'TEMP_DS18B20' ? 23.8 : 23.5,
    reed_switch_open: false,
    glass_break_detected: false,
    rssi_dbm: -56,
    attributes: buildDeviceAttributesBundle({
      chip_id: decoded.chip_id,
      intro_packet_hex: decoded.intro_packet_hex,
      intro_type_byte: decoded.intro_type_byte,
      rssi_dbm: -56,
      parent_node_id: parentId,
      beacon_interval_seconds: matchedProfile.default_beacon_interval_sec,
      smoke_threshold_ppm: 400,
      temp_threshold_c: 60,
      arm_perimeter: armPerim,
      building_id: floor.building_id,
      floor_id: floor.id,
      room_id: room.id,
      coord_x: finalX,
      coord_y: finalY,
      inactivity_timeout_sec: matchedProfile.inactivity_timeout_sec,
      claimed_by_user_id: claimerUserId,
      claimed_at: nowIso,
      nowIso
    }),
    claimed_by_user_id: claimerUserId,
    claimed_at: nowIso,
    last_seen: nowIso,
    created_at: nowIso
  };

  dbStore.sensors.push(newSensor);

  // Enqueue RPC Downlink ACK for the newly claimed device
  dbStore.enqueueRpcCommand({
    building_id: floor.building_id,
    target_type: 'END_DEVICE',
    target_id: newSensor.chip_id,
    method: 'CLAIM_AND_BIND_PROFILE',
    payload: {
      profile_code: matchedProfile.code,
      parent_node_id: parentId,
      beacon_interval_sec: matchedProfile.default_beacon_interval_sec
    },
    initiated_by_user_id: claimerUserId,
    immediateAck: true
  });

  socketService.emitGlobal('SENSOR_PAIRED', {
    sensor: newSensor,
    device_profile: matchedProfile,
    ble_packet: decoded.intro_packet_hex,
    detected_sensor_type: decoded.sensor_type,
    parent_link_type: parentType,
    parent_node_id: parentId
  });

  res.status(201).json({
    message: `Intro Packet [${decoded.intro_packet_hex}] decoded -> Auto-detected single-sensor type: ${decoded.sensor_type} (Profile: ${matchedProfile.code}) via ${parentType} (${parentId})`,
    decoded_intro: decoded,
    device_profile: matchedProfile,
    sensor: newSensor
  });
};

// ============================================================================
// 4. THINGSBOARD PATTERNS: DEVICE PROFILES, 3-SCOPE ATTRIBUTES & RPC QUEUE
// ============================================================================
export const getDeviceProfiles = (_req: Request, res: Response): void => {
  res.json({
    profiles: dbStore.deviceProfiles
  });
};

export const updateDeviceProfile = (req: Request, res: Response): void => {
  const { code } = req.params;
  const {
    default_beacon_interval_sec,
    inactivity_timeout_sec,
    warning_threshold,
    critical_threshold,
    low_battery_threshold_pct,
    apply_to_existing_fleet
  } = req.body as {
    default_beacon_interval_sec?: number;
    inactivity_timeout_sec?: number;
    warning_threshold?: number;
    critical_threshold?: number;
    low_battery_threshold_pct?: number;
    apply_to_existing_fleet?: boolean;
  };

  const profile = dbStore.deviceProfiles.find((p) => p.code === code);
  if (!profile) {
    res.status(404).json({ error: `Device Profile ${code} not found` });
    return;
  }

  if (default_beacon_interval_sec !== undefined) {
    profile.default_beacon_interval_sec = Number(default_beacon_interval_sec);
  }
  if (inactivity_timeout_sec !== undefined) {
    profile.inactivity_timeout_sec = Number(inactivity_timeout_sec);
  }
  if (warning_threshold !== undefined) {
    profile.warning_threshold = Number(warning_threshold);
  }
  if (critical_threshold !== undefined) {
    profile.critical_threshold = Number(critical_threshold);
  }
  if (low_battery_threshold_pct !== undefined) {
    profile.low_battery_threshold_pct = Number(low_battery_threshold_pct);
  }
  profile.updated_at = new Date().toISOString();

  let updatedDevicesCount = 0;
  if (apply_to_existing_fleet !== false) {
    for (const s of dbStore.sensors) {
      if (s.profile_code === profile.code) {
        s.beacon_interval_seconds = profile.default_beacon_interval_sec;
        if (profile.sensor_type === 'SMOKE_MQ2' && profile.critical_threshold) {
          s.smoke_threshold_ppm = profile.critical_threshold;
        }
        if (profile.sensor_type === 'TEMP_DS18B20' && profile.critical_threshold) {
          s.temp_threshold_c = profile.critical_threshold;
        }
        s.attributes.shared_desired.beacon_interval_seconds = profile.default_beacon_interval_sec;
        s.attributes.server.inactivity_timeout_sec = profile.inactivity_timeout_sec;
        s.attributes.sync_status = 'PENDING_WAKEUP';
        updatedDevicesCount++;
      }
    }
  }

  res.json({
    message: `Device Profile ${profile.code} updated (${updatedDevicesCount} devices queued for Shared Attribute sync on next wakeup)`,
    profile,
    updated_devices_count: updatedDevicesCount
  });
};

export const getDeviceAttributes = (req: Request, res: Response): void => {
  const sensorId = Number(req.params.id);
  const sensor = dbStore.sensors.find((s) => s.id === sensorId);
  if (!sensor) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  const profile = dbStore.deviceProfiles.find((p) => p.code === sensor.profile_code) || null;
  const recentRpc = dbStore.rpcCommands
    .filter((r) => r.target_id === sensor.chip_id)
    .slice(0, 10);

  res.json({
    device_id: sensor.id,
    chip_id: sensor.chip_id,
    profile_code: sensor.profile_code,
    device_profile: profile,
    attributes: sensor.attributes,
    rpc_history: recentRpc
  });
};

export const updateDeviceSharedAttributes = (
  req: AuthenticatedRequest,
  res: Response
): void => {
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
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  if (beacon_interval_seconds !== undefined) {
    sensor.attributes.shared_desired.beacon_interval_seconds = Number(beacon_interval_seconds);
    sensor.beacon_interval_seconds = Number(beacon_interval_seconds);
  }
  if (smoke_threshold_ppm !== undefined) {
    sensor.attributes.shared_desired.smoke_threshold_ppm = Number(smoke_threshold_ppm);
    sensor.smoke_threshold_ppm = Number(smoke_threshold_ppm);
  }
  if (temp_threshold_c !== undefined) {
    sensor.attributes.shared_desired.temp_threshold_c = Number(temp_threshold_c);
    sensor.temp_threshold_c = Number(temp_threshold_c);
  }
  if (arm_perimeter !== undefined) {
    sensor.attributes.shared_desired.arm_perimeter = Boolean(arm_perimeter);
    sensor.arm_perimeter = Boolean(arm_perimeter);
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
    initiated_by_user_id: req.user?.id || 1,
    immediateAck: Boolean(simulate_immediate_wakeup)
  });

  socketService.emitGlobal('DEVICE_ATTRIBUTES_UPDATED', {
    sensor_id: sensor.id,
    chip_id: sensor.chip_id,
    attributes: sensor.attributes,
    rpc_command: rpcCmd
  });

  res.json({
    message: simulate_immediate_wakeup
      ? `Shared attributes pushed and ACKed by ${sensor.chip_id} (SYNCED)`
      : `Shared attributes saved as Desired State (PENDING_WAKEUP on next ${sensor.beacon_interval_seconds}s beacon)`,
    attributes: sensor.attributes,
    rpc_command: rpcCmd
  });
};

export const getRpcCommands = (req: Request, res: Response): void => {
  const buildingId = req.query.building_id ? Number(req.query.building_id) : undefined;
  const targetId = req.query.target_id ? String(req.query.target_id) : undefined;

  let list = dbStore.rpcCommands;
  if (buildingId) {
    list = list.filter((r) => r.building_id === buildingId);
  }
  if (targetId) {
    list = list.filter((r) => r.target_id === targetId);
  }

  res.json({ rpc_commands: list.slice(0, 50) });
};

export const sendRpcCommand = (req: AuthenticatedRequest, res: Response): void => {
  const { building_id, target_type, target_id, method, params, immediate_ack } = req.body as {
    building_id?: number;
    target_type: 'CENTRAL_GATEWAY' | 'FLOOR_HUB' | 'END_DEVICE';
    target_id: string;
    method: string;
    params?: Record<string, unknown>;
    immediate_ack?: boolean;
  };

  if (!target_type || !target_id || !method) {
    res.status(400).json({ error: 'target_type, target_id, and method are required' });
    return;
  }

  const rpcCmd = dbStore.enqueueRpcCommand({
    building_id: Number(building_id || 1),
    target_type,
    target_id,
    method,
    payload: params || {},
    initiated_by_user_id: req.user?.id || 1,
    immediateAck: immediate_ack
  });

  // If this RPC isWAKEUP_AND_SYNC for an END_DEVICE, sync its shared attributes immediately
  if (target_type === 'END_DEVICE') {
    const sensor = dbStore.sensors.find((s) => s.chip_id === target_id);
    if (sensor && (method === 'WAKEUP_AND_SYNC' || immediate_ack)) {
      sensor.attributes.shared_reported = { ...sensor.attributes.shared_desired };
      sensor.attributes.sync_status = 'SYNCED';
      sensor.attributes.last_synced_at = new Date().toISOString();
      rpcCmd.status = 'ACKED';
      rpcCmd.ack_at = new Date().toISOString();
    }
  }

  socketService.emitGlobal('RPC_COMMAND_DISPATCHED', { rpc_command: rpcCmd });

  res.status(201).json({
    message: `RPC [${method}] dispatched to ${target_type} (${target_id}) -> Status: ${rpcCmd.status}`,
    rpc_command: rpcCmd
  });
};

export const getTopologyRollup = (req: Request, res: Response): void => {
  const buildingId = req.query.building_id ? Number(req.query.building_id) : undefined;
  const rollup = dbStore.computeAssetHealthRollup(buildingId);
  res.json(rollup);
};

// ============================================================================
// 5. FULL CRUD UPDATE & DELETE HANDLERS (BUILDINGS, FLOORS, APTS, USERS, DEVICES)
// ============================================================================

export const updateBuilding = (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  const bld = dbStore.buildings.find((b) => b.id === id);
  if (!bld) {
    res.status(404).json({ error: 'Building not found' });
    return;
  }

  const { name, code, address, city, tenant_user_id } = req.body as {
    name?: string;
    code?: string;
    address?: string;
    city?: string;
    tenant_user_id?: number | null;
  };

  if (name !== undefined) bld.name = name;
  if (code !== undefined) bld.code = code;
  if (address !== undefined) bld.address = address;
  if (city !== undefined) bld.city = city;
  if (tenant_user_id !== undefined) {
    const tenant = tenant_user_id
      ? dbStore.users.find((u) => u.id === Number(tenant_user_id))
      : null;
    bld.tenant_user_id = tenant ? tenant.id : null;
    bld.tenant_name = tenant?.name || null;
    bld.tenant_email = tenant?.email || null;
    bld.tenant_phone = tenant?.phone_number || null;
  }

  // Sync building_name on floors and gateways
  for (const fl of dbStore.floors) {
    if (fl.building_id === bld.id) fl.building_name = bld.name;
  }
  for (const gw of dbStore.gateways) {
    if (gw.building_id === bld.id) gw.building_name = bld.name;
  }

  res.json({ message: `Building ${bld.name} updated`, building: bld });
};

export const deleteBuilding = (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  const idx = dbStore.buildings.findIndex((b) => b.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Building not found' });
    return;
  }

  const removed = dbStore.buildings.splice(idx, 1)[0];
  dbStore.floors = dbStore.floors.filter((f) => f.building_id !== id);
  dbStore.rooms = dbStore.rooms.filter((r) => r.building_id !== id);
  dbStore.sensors = dbStore.sensors.filter((s) => s.building_id !== id);
  for (const gw of dbStore.gateways) {
    if (gw.building_id === id) {
      gw.building_id = null;
      gw.building_name = null;
    }
  }

  res.json({ message: `Building "${removed.name}" deleted`, deleted_id: id });
};

export const updateFloor = (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  const floor = dbStore.floors.find((f) => f.id === id);
  if (!floor) {
    res.status(404).json({ error: 'Floor not found' });
    return;
  }

  const { name, floor_number, has_sub_hub, hub_mac, dip_switch_address } = req.body as {
    name?: string;
    floor_number?: number;
    has_sub_hub?: boolean;
    hub_mac?: string;
    dip_switch_address?: number;
  };

  if (name !== undefined) floor.name = name;
  if (floor_number !== undefined) floor.floor_number = Number(floor_number);
  if (has_sub_hub !== undefined) {
    floor.has_sub_hub = Boolean(has_sub_hub);
    floor.hub_status = floor.has_sub_hub ? 'online' : 'none';
    floor.hub_id = floor.has_sub_hub
      ? `HUB-B${floor.building_id}-FL0${floor.floor_number}`
      : `GW-DIRECT-B${floor.building_id}`;
  }
  if (hub_mac !== undefined) floor.hub_mac = hub_mac;
  if (dip_switch_address !== undefined) {
    floor.dip_switch_address = Number(dip_switch_address);
    floor.dip_binary = formatDipBinary(floor.dip_switch_address);
  }

  res.json({ message: `Floor #${floor.floor_number} updated`, floor });
};

export const deleteFloor = (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  const idx = dbStore.floors.findIndex((f) => f.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Floor not found' });
    return;
  }

  const removed = dbStore.floors.splice(idx, 1)[0];
  dbStore.rooms = dbStore.rooms.filter((r) => r.floor_id !== id);
  dbStore.sensors = dbStore.sensors.filter((s) => s.floor_id !== id);

  const bld = dbStore.buildings.find((b) => b.id === removed.building_id);
  if (bld) {
    bld.total_floors = dbStore.floors.filter((f) => f.building_id === bld.id).length;
  }

  res.json({ message: `Floor ${removed.name} deleted`, deleted_id: id });
};

export const updateApartment = (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  const apt = dbStore.rooms.find((r) => r.id === id);
  if (!apt) {
    res.status(404).json({ error: 'Apartment not found' });
    return;
  }

  const { room_number, owner_user_id, perimeter_security_status } = req.body as {
    room_number?: string;
    owner_user_id?: number | null;
    perimeter_security_status?: 'disarmed' | 'armed_home' | 'armed_away';
  };

  if (room_number !== undefined) {
    apt.room_number = room_number;
    if (apt.bounds) apt.bounds.label = room_number;
    for (const s of dbStore.sensors) {
      if (s.room_id === apt.id) s.room_number = room_number;
    }
  }
  if (owner_user_id !== undefined) {
    const owner = owner_user_id
      ? dbStore.users.find((u) => u.id === Number(owner_user_id))
      : null;
    apt.owner_user_id = owner ? owner.id : null;
    apt.owner_name = owner?.name || null;
    apt.owner_email = owner?.email || null;
    apt.owner_phone = owner?.phone_number || null;
  }
  if (perimeter_security_status !== undefined) {
    apt.perimeter_security_status = perimeter_security_status;
  }

  res.json({ message: `Apartment ${apt.room_number} updated`, apartment: apt });
};

export const deleteApartment = (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  const idx = dbStore.rooms.findIndex((r) => r.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Apartment not found' });
    return;
  }

  const removed = dbStore.rooms.splice(idx, 1)[0];
  dbStore.sensors = dbStore.sensors.filter((s) => s.room_id !== id);

  res.json({ message: `Apartment ${removed.room_number} deleted`, deleted_id: id });
};

export const updateUserAccount = (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  const user = dbStore.users.find((u) => u.id === id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const { name, email, role, phone_number } = req.body as {
    name?: string;
    email?: string;
    role?: UserRole;
    phone_number?: string;
  };

  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (role !== undefined) user.role = role;
  if (phone_number !== undefined) user.phone_number = phone_number;
  user.updated_at = new Date().toISOString();

  // Propagate updated user info to buildings and rooms
  for (const b of dbStore.buildings) {
    if (b.tenant_user_id === user.id) {
      b.tenant_name = user.name;
      b.tenant_email = user.email;
      b.tenant_phone = user.phone_number;
    }
  }
  for (const r of dbStore.rooms) {
    if (r.owner_user_id === user.id) {
      r.owner_name = user.name;
      r.owner_email = user.email;
      r.owner_phone = user.phone_number;
    }
  }

  res.json({ message: `User ${user.name} updated`, user });
};

export const deleteUserAccount = (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  const idx = dbStore.users.findIndex((u) => u.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const removed = dbStore.users.splice(idx, 1)[0];
  for (const b of dbStore.buildings) {
    if (b.tenant_user_id === id) {
      b.tenant_user_id = null;
      b.tenant_name = null;
      b.tenant_email = null;
      b.tenant_phone = null;
    }
  }
  for (const r of dbStore.rooms) {
    if (r.owner_user_id === id) {
      r.owner_user_id = null;
      r.owner_name = null;
      r.owner_email = null;
      r.owner_phone = null;
    }
  }

  res.json({ message: `User ${removed.name} deleted`, deleted_id: id });
};

export const updateCentralGateway = (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  const gw = dbStore.gateways.find((g) => g.id === id);
  if (!gw) {
    res.status(404).json({ error: 'Central Gateway not found' });
    return;
  }

  const { serial_number, imei, sim_operator, building_id, status } = req.body as {
    serial_number?: string;
    imei?: string;
    sim_operator?: string;
    building_id?: number | null;
    status?: 'online' | 'offline' | 'pairing_mode';
  };

  if (serial_number !== undefined) gw.serial_number = serial_number;
  if (imei !== undefined) gw.imei = imei;
  if (sim_operator !== undefined) gw.sim_operator = sim_operator;
  if (status !== undefined) gw.status = status;
  if (building_id !== undefined) {
    const bld = building_id
      ? dbStore.buildings.find((b) => b.id === Number(building_id))
      : null;
    gw.building_id = bld ? bld.id : null;
    gw.building_name = bld ? bld.name : null;
    if (bld) bld.gateway_id = gw.id;
  }

  res.json({ message: `Gateway ${gw.serial_number} updated`, gateway: gw });
};

export const deleteCentralGateway = (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  const idx = dbStore.gateways.findIndex((g) => g.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Central Gateway not found' });
    return;
  }

  const removed = dbStore.gateways.splice(idx, 1)[0];
  for (const b of dbStore.buildings) {
    if (b.gateway_id === id) b.gateway_id = null;
  }

  res.json({ message: `Gateway ${removed.serial_number} deleted`, deleted_id: id });
};

export const deleteFloorHub = (req: Request, res: Response): void => {
  const floorId = Number(req.params.id);
  const floor = dbStore.floors.find((f) => f.id === floorId);
  if (!floor) {
    res.status(404).json({ error: 'Floor Hub not found' });
    return;
  }

  floor.has_sub_hub = false;
  floor.hub_status = 'none';
  floor.hub_battery_pct = 0;
  floor.hub_id = `GW-DIRECT-B${floor.building_id}`;
  floor.hub_mac = `DIRECT-TO-GW-B${floor.building_id}`;

  res.json({
    message: `Floor Sub-Hub removed from Floor ${floor.floor_number} (switched to Direct Gateway mode)`,
    floor
  });
};

export const updateEndDevice = (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  const sensor = dbStore.sensors.find((s) => s.id === id);
  if (!sensor) {
    res.status(404).json({ error: 'End-Device not found' });
    return;
  }

  const {
    chip_id,
    room_id,
    coord_x,
    coord_y,
    beacon_interval_seconds,
    smoke_threshold_ppm,
    status
  } = req.body as {
    chip_id?: string;
    room_id?: number;
    coord_x?: number;
    coord_y?: number;
    beacon_interval_seconds?: number;
    smoke_threshold_ppm?: number;
    status?: 'online' | 'offline' | 'alarm' | 'warning' | 'pairing';
  };

  if (chip_id !== undefined) {
    sensor.chip_id = chip_id;
    if (sensor.attributes?.client) sensor.attributes.client.chip_id = chip_id;
  }
  if (room_id !== undefined) {
    const rm = dbStore.rooms.find((r) => r.id === Number(room_id));
    if (rm) {
      sensor.room_id = rm.id;
      sensor.room_number = rm.room_number;
      sensor.floor_id = rm.floor_id;
      sensor.floor_number = rm.floor_number;
      sensor.building_id = rm.building_id;
    }
  }
  if (coord_x !== undefined) sensor.coord_x = Number(coord_x);
  if (coord_y !== undefined) sensor.coord_y = Number(coord_y);
  if (beacon_interval_seconds !== undefined) {
    sensor.beacon_interval_seconds = Number(beacon_interval_seconds);
    if (sensor.attributes) {
      sensor.attributes.shared_desired.beacon_interval_seconds = Number(beacon_interval_seconds);
      sensor.attributes.sync_status = 'PENDING_WAKEUP';
    }
  }
  if (smoke_threshold_ppm !== undefined) {
    sensor.smoke_threshold_ppm = Number(smoke_threshold_ppm);
    if (sensor.attributes) {
      sensor.attributes.shared_desired.smoke_threshold_ppm = Number(smoke_threshold_ppm);
      sensor.attributes.sync_status = 'PENDING_WAKEUP';
    }
  }
  if (status !== undefined) sensor.status = status;

  res.json({ message: `End-Device ${sensor.chip_id} updated`, sensor });
};

export const deleteEndDevice = (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  const idx = dbStore.sensors.findIndex((s) => s.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'End-Device not found' });
    return;
  }

  const removed = dbStore.sensors.splice(idx, 1)[0];
  res.json({ message: `End-Device ${removed.chip_id} deleted`, deleted_id: id });
};

