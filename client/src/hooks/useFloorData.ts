'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlarmEventData,
  BuildingData,
  DevicesInventoryData,
  FloorData,
  PairingSessionData,
  PerimeterSecurityStatus,
  RoomApartmentData,
  SensorEndpointData,
  Sim7670Status,
  UserProfile,
  UserRole
} from '../types';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const getAuthHeaders = (defaultRole: UserRole = 'super_admin'): HeadersInit => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('sb_jwt_token');
    const role = (localStorage.getItem('sb_user_role') as UserRole) || defaultRole;
    if (token) {
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-demo-role': role
      };
    }
  }
  return {
    'Content-Type': 'application/json',
    'x-demo-role': defaultRole
  };
};

export const useFloorData = (initialFloor = 4, role: UserRole = 'super_admin') => {
  const [selectedBuildingId, setSelectedBuildingId] = useState<number>(1);
  const [buildings, setBuildings] = useState<BuildingData[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<number>(initialFloor);
  const [floors, setFloors] = useState<FloorData[]>([]);
  const [currentFloor, setCurrentFloor] = useState<FloorData | null>(null);
  const [rooms, setRooms] = useState<RoomApartmentData[]>([]);
  const [sensors, setSensors] = useState<SensorEndpointData[]>([]);
  const [alarms, setAlarms] = useState<AlarmEventData[]>([]);
  const [sim7670, setSim7670] = useState<Sim7670Status | null>(null);
  const [devicesInventory, setDevicesInventory] = useState<DevicesInventoryData | null>(null);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [activePairingSession, setActivePairingSession] = useState<PairingSessionData | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(true);

  const fetchBuildingOverview = useCallback(
    async (bId = selectedBuildingId) => {
      try {
        const [bldsRes, floorsRes, alarmsRes, simRes, invRes, usrRes] = await Promise.all([
          fetch(`${API_BASE}/api/buildings`),
          fetch(`${API_BASE}/api/floors?building_id=${bId}`),
          fetch(`${API_BASE}/api/emergency/alarms`),
          fetch(`${API_BASE}/api/emergency/sim7670`),
          fetch(`${API_BASE}/api/devices/inventory`),
          fetch(`${API_BASE}/api/auth/users`, { headers: getAuthHeaders('super_admin') })
        ]);

        if (bldsRes.ok) {
          const bData = await bldsRes.json();
          setBuildings(bData.buildings || []);
        }
        if (floorsRes.ok) {
          const fData = await floorsRes.json();
          setFloors(fData.floors || []);
        }
        if (alarmsRes.ok) {
          const aData = await alarmsRes.json();
          setAlarms(aData.alarms || []);
        }
        if (simRes.ok) {
          const sData = await simRes.json();
          setSim7670(sData.gateway || null);
        }
        if (invRes.ok) {
          const iData = await invRes.json();
          setDevicesInventory(iData);
        }
        if (usrRes.ok) {
          const uData = await usrRes.json();
          setUsersList(uData.users || []);
        }
      } catch (err) {
        console.error('Failed to fetch SaaS building overview:', err);
      }
    },
    [selectedBuildingId]
  );

  const fetchFloorDetails = useCallback(
    async (floorNum: number, bId = selectedBuildingId) => {
      try {
        setLoading(true);
        const res = await fetch(
          `${API_BASE}/api/floors/${floorNum}?building_id=${bId}`
        );
        if (res.ok) {
          const data = await res.json();
          setCurrentFloor(data.floor);
          setRooms(data.rooms || []);
          setSensors(data.sensors || []);
        }
      } catch (err) {
        console.error(`Failed to fetch floor ${floorNum}:`, err);
      } finally {
        setLoading(false);
      }
    },
    [selectedBuildingId]
  );

  useEffect(() => {
    fetchBuildingOverview(selectedBuildingId);
  }, [selectedBuildingId, fetchBuildingOverview]);

  useEffect(() => {
    fetchFloorDetails(selectedFloor, selectedBuildingId);
  }, [selectedFloor, selectedBuildingId, fetchFloorDetails]);

  // ==========================================================================
  // 1. BUILDINGS CRUD (+ / Edit / Delete)
  // ==========================================================================
  const createBuilding = async (payload: {
    name: string;
    code?: string;
    address: string;
    city: string;
    total_floors: number;
    tenant_user_id: number | null;
    gateway_serial?: string;
  }) => {
    const res = await fetch(`${API_BASE}/api/buildings`, {
      method: 'POST',
      headers: getAuthHeaders('super_admin'),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      await fetchBuildingOverview(data.building.id);
      setSelectedBuildingId(data.building.id);
      setSelectedFloor(1);
      return data.building as BuildingData;
    }
    return null;
  };

  const updateBuilding = async (
    buildingId: number,
    payload: {
      name?: string;
      code?: string;
      address?: string;
      city?: string;
      tenant_user_id?: number | null;
    }
  ) => {
    const res = await fetch(`${API_BASE}/api/buildings/${buildingId}`, {
      method: 'PUT',
      headers: getAuthHeaders('super_admin'),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      await fetchBuildingOverview(selectedBuildingId);
      return true;
    }
    return false;
  };

  const deleteBuilding = async (buildingId: number) => {
    const res = await fetch(`${API_BASE}/api/buildings/${buildingId}`, {
      method: 'DELETE',
      headers: getAuthHeaders('super_admin')
    });
    if (res.ok) {
      await fetchBuildingOverview(1);
      return true;
    }
    return false;
  };

  const assignBuildingTenant = async (buildingId: number, tenant_user_id: number | null) => {
    const res = await fetch(`${API_BASE}/api/buildings/${buildingId}/assign-tenant`, {
      method: 'PATCH',
      headers: getAuthHeaders('super_admin'),
      body: JSON.stringify({ tenant_user_id })
    });
    if (res.ok) {
      await fetchBuildingOverview(selectedBuildingId);
    }
  };

  // ==========================================================================
  // 2. FLOORS & APARTMENTS CRUD (+ / Edit / Delete)
  // ==========================================================================
  const addFloorToBuilding = async (payload: {
    building_id: number;
    floor_number?: number;
    name?: string;
    has_sub_hub?: boolean;
  }) => {
    const res = await fetch(`${API_BASE}/api/buildings/${payload.building_id}/floors`, {
      method: 'POST',
      headers: getAuthHeaders(role),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      await fetchBuildingOverview(payload.building_id);
      setSelectedFloor(data.floor.floor_number);
      return data.floor as FloorData;
    }
    return null;
  };

  const updateFloor = async (
    floorId: number,
    payload: {
      name?: string;
      floor_number?: number;
      has_sub_hub?: boolean;
      hub_mac?: string;
      dip_switch_address?: number;
    }
  ) => {
    const res = await fetch(`${API_BASE}/api/floors/${floorId}`, {
      method: 'PUT',
      headers: getAuthHeaders(role),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      await fetchBuildingOverview(selectedBuildingId);
      await fetchFloorDetails(selectedFloor, selectedBuildingId);
      return true;
    }
    return false;
  };

  const deleteFloor = async (floorId: number) => {
    const res = await fetch(`${API_BASE}/api/floors/${floorId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(role)
    });
    if (res.ok) {
      await fetchBuildingOverview(selectedBuildingId);
      await fetchFloorDetails(1, selectedBuildingId);
      return true;
    }
    return false;
  };

  const addApartmentToFloor = async (payload: {
    building_id: number;
    floor_number: number;
    room_number: string;
    owner_user_id?: number | null;
  }) => {
    const res = await fetch(`${API_BASE}/api/buildings/${payload.building_id}/apartments`, {
      method: 'POST',
      headers: getAuthHeaders(role),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      await fetchFloorDetails(payload.floor_number, payload.building_id);
      await fetchBuildingOverview(payload.building_id);
      return true;
    }
    return false;
  };

  const updateApartment = async (
    aptId: number,
    payload: {
      room_number?: string;
      owner_user_id?: number | null;
      perimeter_security_status?: PerimeterSecurityStatus;
    }
  ) => {
    const res = await fetch(`${API_BASE}/api/apartments/${aptId}`, {
      method: 'PUT',
      headers: getAuthHeaders(role),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      await fetchFloorDetails(selectedFloor, selectedBuildingId);
      await fetchBuildingOverview(selectedBuildingId);
      return true;
    }
    return false;
  };

  const deleteApartment = async (aptId: number) => {
    const res = await fetch(`${API_BASE}/api/apartments/${aptId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(role)
    });
    if (res.ok) {
      await fetchFloorDetails(selectedFloor, selectedBuildingId);
      await fetchBuildingOverview(selectedBuildingId);
      return true;
    }
    return false;
  };

  // ==========================================================================
  // 3. USERS CRUD (TENANTS, RESIDENTS, ADMINS) (+ / Edit / Delete)
  // ==========================================================================
  const registerNewUser = async (payload: {
    name: string;
    email: string;
    role: UserRole;
    phone_number?: string;
  }) => {
    const res = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: getAuthHeaders(role),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      await fetchBuildingOverview(selectedBuildingId);
      return true;
    }
    return false;
  };

  const updateUser = async (
    userId: number,
    payload: {
      name?: string;
      email?: string;
      role?: UserRole;
      phone_number?: string;
    }
  ) => {
    const res = await fetch(`${API_BASE}/api/users/${userId}`, {
      method: 'PUT',
      headers: getAuthHeaders('super_admin'),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      await fetchBuildingOverview(selectedBuildingId);
      await fetchFloorDetails(selectedFloor, selectedBuildingId);
      return true;
    }
    return false;
  };

  const deleteUser = async (userId: number) => {
    const res = await fetch(`${API_BASE}/api/users/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders('super_admin')
    });
    if (res.ok) {
      await fetchBuildingOverview(selectedBuildingId);
      await fetchFloorDetails(selectedFloor, selectedBuildingId);
      return true;
    }
    return false;
  };

  // ==========================================================================
  // 4. DEVICES CRUD (GATEWAYS, FLOOR HUBS, ENDPOINTS) (+ / Edit / Delete)
  // ==========================================================================
  const registerGatewayDevice = async (payload: {
    building_id: number | null;
    serial_number: string;
    imei: string;
    sim_operator: string;
  }) => {
    const res = await fetch(`${API_BASE}/api/devices/gateways`, {
      method: 'POST',
      headers: getAuthHeaders('super_admin'),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      await fetchBuildingOverview(selectedBuildingId);
      return true;
    }
    return false;
  };

  const updateGatewayDevice = async (
    gwId: number,
    payload: {
      serial_number?: string;
      imei?: string;
      sim_operator?: string;
      building_id?: number | null;
      status?: 'online' | 'offline' | 'pairing_mode';
    }
  ) => {
    const res = await fetch(`${API_BASE}/api/devices/gateways/${gwId}`, {
      method: 'PUT',
      headers: getAuthHeaders('super_admin'),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      await fetchBuildingOverview(selectedBuildingId);
      return true;
    }
    return false;
  };

  const deleteGatewayDevice = async (gwId: number) => {
    const res = await fetch(`${API_BASE}/api/devices/gateways/${gwId}`, {
      method: 'DELETE',
      headers: getAuthHeaders('super_admin')
    });
    if (res.ok) {
      await fetchBuildingOverview(selectedBuildingId);
      return true;
    }
    return false;
  };

  const configureFloorHubDevice = async (payload: {
    building_id: number;
    floor_number: number;
    hub_mac?: string;
    dip_switch_address?: number;
    has_sub_hub: boolean;
  }) => {
    const res = await fetch(`${API_BASE}/api/devices/hubs`, {
      method: 'POST',
      headers: getAuthHeaders(role),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      await fetchBuildingOverview(selectedBuildingId);
      await fetchFloorDetails(selectedFloor, selectedBuildingId);
      return true;
    }
    return false;
  };

  const deleteFloorHubDevice = async (floorId: number) => {
    const res = await fetch(`${API_BASE}/api/devices/hubs/${floorId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(role)
    });
    if (res.ok) {
      await fetchBuildingOverview(selectedBuildingId);
      await fetchFloorDetails(selectedFloor, selectedBuildingId);
      return true;
    }
    return false;
  };

  const updateEndpointDevice = async (
    sensorId: number,
    payload: {
      chip_id?: string;
      room_id?: number;
      coord_x?: number;
      coord_y?: number;
      beacon_interval_seconds?: number;
      smoke_threshold_ppm?: number;
      status?: 'online' | 'offline' | 'alarm' | 'warning' | 'pairing';
    }
  ) => {
    const res = await fetch(`${API_BASE}/api/devices/endpoints/${sensorId}`, {
      method: 'PUT',
      headers: getAuthHeaders(role),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      await fetchBuildingOverview(selectedBuildingId);
      await fetchFloorDetails(selectedFloor, selectedBuildingId);
      return true;
    }
    return false;
  };

  const deleteEndpointDevice = async (sensorId: number) => {
    const res = await fetch(`${API_BASE}/api/devices/endpoints/${sensorId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(role)
    });
    if (res.ok) {
      await fetchBuildingOverview(selectedBuildingId);
      await fetchFloorDetails(selectedFloor, selectedBuildingId);
      return true;
    }
    return false;
  };

  // Drag & Drop Pairing Mode + Intro Packet Auto-Detection
  const startDragDropPairing = async (params: {
    building_id?: number;
    floor_id?: number;
    floor_number?: number;
    room_id?: number;
    coord_x: number;
    coord_y: number;
  }) => {
    const res = await fetch(`${API_BASE}/api/devices/pairing/start`, {
      method: 'POST',
      headers: getAuthHeaders(role),
      body: JSON.stringify({
        building_id: params.building_id || selectedBuildingId,
        floor_id: params.floor_id || currentFloor?.id,
        floor_number: params.floor_number || selectedFloor,
        room_id: params.room_id,
        coord_x: params.coord_x,
        coord_y: params.coord_y
      })
    });
    if (res.ok) {
      const data = await res.json();
      setActivePairingSession(data.session);
      return data.session as PairingSessionData;
    }
    return null;
  };

  const completePairingWithIntroPacket = async (params: {
    session_id?: string;
    intro_type_byte: string;
    raw_intro_packet_hex?: string;
    chip_id?: string;
    building_id?: number;
    floor_number?: number;
    room_id?: number;
  }) => {
    const res = await fetch(`${API_BASE}/api/devices/pairing/intro-packet`, {
      method: 'POST',
      headers: getAuthHeaders(role),
      body: JSON.stringify({
        session_id: params.session_id || activePairingSession?.session_id,
        intro_type_byte: params.intro_type_byte,
        raw_intro_packet_hex: params.raw_intro_packet_hex,
        chip_id: params.chip_id,
        building_id: params.building_id || selectedBuildingId,
        floor_number: params.floor_number || selectedFloor,
        room_id: params.room_id
      })
    });
    if (res.ok) {
      const data = await res.json();
      setActivePairingSession(null);
      await fetchFloorDetails(selectedFloor, selectedBuildingId);
      await fetchBuildingOverview(selectedBuildingId);
      return data;
    }
    return null;
  };

  const saveSensorCoordinates = async (sensorId: number, coord_x: number, coord_y: number) => {
    setSensors((prev) =>
      prev.map((s) => (s.id === sensorId ? { ...s, coord_x, coord_y } : s))
    );
    const res = await fetch(`${API_BASE}/api/sensors/${sensorId}/coordinates`, {
      method: 'PATCH',
      headers: getAuthHeaders(role),
      body: JSON.stringify({ coord_x, coord_y })
    });
    if (res.ok) {
      const data = await res.json();
      return data.sensor as SensorEndpointData;
    }
    return null;
  };

  const updateSensorConfig = async (
    sensorId: number,
    config: {
      beacon_interval_seconds?: number;
      smoke_threshold_ppm?: number;
      temp_threshold_c?: number;
      arm_perimeter?: boolean;
    }
  ) => {
    const res = await fetch(`${API_BASE}/api/sensors/${sensorId}/config`, {
      method: 'PATCH',
      headers: getAuthHeaders(role),
      body: JSON.stringify(config)
    });
    if (res.ok) {
      const data = await res.json();
      setSensors((prev) => prev.map((s) => (s.id === sensorId ? data.sensor : s)));
      return data;
    }
    return null;
  };

  const calibrateSensor = async (sensorId: number) => {
    const res = await fetch(`${API_BASE}/api/sensors/${sensorId}/calibrate`, {
      method: 'POST',
      headers: getAuthHeaders(role)
    });
    if (res.ok) {
      const data = await res.json();
      setSensors((prev) => prev.map((s) => (s.id === sensorId ? data.sensor : s)));
      return data;
    }
    return null;
  };

  const setApartmentPerimeter = async (roomId: number, status: PerimeterSecurityStatus) => {
    const res = await fetch(`${API_BASE}/api/apartments/${roomId}/perimeter`, {
      method: 'PATCH',
      headers: getAuthHeaders(role),
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      const data = await res.json();
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, perimeter_security_status: status } : r))
      );
      if (data.sensors) {
        setSensors((prev) =>
          prev.map((s) => {
            const updated = (data.sensors as SensorEndpointData[]).find((u) => u.id === s.id);
            return updated || s;
          })
        );
      }
      return data;
    }
    return null;
  };

  const triggerTestAlarm = async (params: {
    sensor_id?: number;
    chip_id?: string;
    event_type?: string;
    severity?: 'warning' | 'critical' | 'emergency';
    smoke_val?: number;
    temp_val?: number;
  }) => {
    const res = await fetch(`${API_BASE}/api/emergency/trigger`, {
      method: 'POST',
      headers: getAuthHeaders(role),
      body: JSON.stringify(params)
    });
    if (res.ok) {
      const data = await res.json();
      await fetchFloorDetails(selectedFloor, selectedBuildingId);
      await fetchBuildingOverview(selectedBuildingId);
      return data.alarm as AlarmEventData;
    }
    return null;
  };

  return {
    selectedBuildingId,
    setSelectedBuildingId,
    buildings,
    selectedFloor,
    setSelectedFloor,
    floors,
    setFloors,
    currentFloor,
    rooms,
    setRooms,
    sensors,
    setSensors,
    alarms,
    sim7670,
    setSim7670,
    devicesInventory,
    usersList,
    activePairingSession,
    setActivePairingSession,
    loading,
    refreshOverview: () => fetchBuildingOverview(selectedBuildingId),
    refreshFloor: () => fetchFloorDetails(selectedFloor, selectedBuildingId),
    createBuilding,
    updateBuilding,
    deleteBuilding,
    assignBuildingTenant,
    addFloorToBuilding,
    updateFloor,
    deleteFloor,
    addApartmentToFloor,
    updateApartment,
    deleteApartment,
    registerNewUser,
    updateUser,
    deleteUser,
    registerGatewayDevice,
    updateGatewayDevice,
    deleteGatewayDevice,
    configureFloorHubDevice,
    deleteFloorHubDevice,
    updateEndpointDevice,
    deleteEndpointDevice,
    startDragDropPairing,
    completePairingWithIntroPacket,
    saveSensorCoordinates,
    updateSensorConfig,
    calibrateSensor,
    setApartmentPerimeter,
    triggerTestAlarm
  };
};
