'use client';

import React, { useState } from 'react';
import {
  Cpu,
  Radio,
  Layers,
  Terminal,
  AlertOctagon,
  CheckCircle2,
  Send,
  Activity,
  Building2,
  Plus,
  Users,
  Signal,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Eye,
  Shield,
  Sliders,
  X
} from 'lucide-react';
import { API_BASE, getAuthHeaders, useFloorData } from '../../../hooks/useFloorData';
import { BlueprintViewer } from '../../../components/map/BlueprintViewer';
import { SensorModal } from '../../../components/map/SensorModal';
import { TelemetryChart } from '../../../components/charts/TelemetryChart';
import {
  BuildingData,
  FloorData,
  GatewayDeviceData,
  RoomApartmentData,
  SensorEndpointData,
  UserProfile,
  UserRole
} from '../../../types';
import { useAppSettings } from '../../../context/AppSettingsContext';

type MainSection =
  | 'buildings'
  | 'devices-gateways'
  | 'devices-hubs'
  | 'devices-endpoints'
  | 'users-tenants'
  | 'users-residents'
  | 'users-admins'
  | 'alarms';

export default function SuperAdminDashboardPage() {
  const { t } = useAppSettings();
  const {
    selectedBuildingId,
    setSelectedBuildingId,
    buildings,
    selectedFloor,
    setSelectedFloor,
    floors,
    currentFloor,
    rooms,
    sensors,
    alarms,
    sim7670,
    setSim7670,
    devicesInventory,
    usersList,
    activePairingSession,
    createBuilding,
    updateBuilding,
    deleteBuilding,
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
    triggerTestAlarm,
    refreshOverview,
    refreshFloor
  } = useFloorData(1, 'super_admin');

  // Left Sidebar Navigation State
  const [activeSection, setActiveSection] = useState<MainSection>('buildings');
  const [devicesMenuOpen, setDevicesMenuOpen] = useState<boolean>(true);
  const [usersMenuOpen, setUsersMenuOpen] = useState<boolean>(true);

  // Drill-down inside a Building: null = Buildings CRUD Table, number = Inside that Building (Floors + Map + Apartments)
  const [openedBuildingId, setOpenedBuildingId] = useState<number | null>(null);

  // Selected sensor for ThingsBoard 3-Scope Attributes & Telemetry drawer
  const [selectedSensor, setSelectedSensor] = useState<SensorEndpointData | null>(null);
  const [customAtCmd, setCustomAtCmd] = useState<string>('AT+CSQ');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // ============================================================================
  // CRUD MODAL STATES (+ Add / Pencil Edit)
  // ============================================================================

  // 1. Building CRUD Modal
  const [buildingModalOpen, setBuildingModalOpen] = useState<boolean>(false);
  const [editingBuilding, setEditingBuilding] = useState<BuildingData | null>(null);
  const [bldName, setBldName] = useState<string>('');
  const [bldCode, setBldCode] = useState<string>('');
  const [bldAddress, setBldAddress] = useState<string>('');
  const [bldCity, setBldCity] = useState<string>('Tashkent');
  const [bldFloors, setBldFloors] = useState<number>(9);
  const [bldTenantId, setBldTenantId] = useState<string>('');
  const [bldGwSerial, setBldGwSerial] = useState<string>('');

  // 2. Floor CRUD Modal
  const [floorModalOpen, setFloorModalOpen] = useState<boolean>(false);
  const [editingFloor, setEditingFloor] = useState<FloorData | null>(null);
  const [flNum, setFlNum] = useState<number>(10);
  const [flName, setFlName] = useState<string>('');
  const [flHasHub, setFlHasHub] = useState<boolean>(true);
  const [flHubMac, setFlHubMac] = useState<string>('');
  const [flDip, setFlDip] = useState<number>(1);

  // 3. Apartment CRUD Modal
  const [aptModalOpen, setAptModalOpen] = useState<boolean>(false);
  const [editingApt, setEditingApt] = useState<RoomApartmentData | null>(null);
  const [aptRoomNumber, setAptRoomNumber] = useState<string>('');
  const [aptOwnerId, setAptOwnerId] = useState<string>('');
  const [aptPerimeter, setAptPerimeter] = useState<'disarmed' | 'armed_home' | 'armed_away'>(
    'disarmed'
  );

  // 4. Gateway CRUD Modal
  const [gwModalOpen, setGwModalOpen] = useState<boolean>(false);
  const [editingGw, setEditingGw] = useState<GatewayDeviceData | null>(null);
  const [gwSerial, setGwSerial] = useState<string>('');
  const [gwImei, setGwImei] = useState<string>('');
  const [gwOperator, setGwOperator] = useState<string>('Uztelecom GSM / LTE');
  const [gwBuildingId, setGwBuildingId] = useState<string>('1');

  // 5. Floor Hub CRUD Modal
  const [hubModalOpen, setHubModalOpen] = useState<boolean>(false);
  const [hubBldId, setHubBldId] = useState<number>(1);
  const [hubFloorNum, setHubFloorNum] = useState<number>(1);
  const [hubMacAddr, setHubMacAddr] = useState<string>('');
  const [hubDipAddr, setHubDipAddr] = useState<number>(1);
  const [hubEnabled, setHubEnabled] = useState<boolean>(true);

  // 6. Endpoint (1-Sensor Device) CRUD Modal
  const [endpointModalOpen, setEndpointModalOpen] = useState<boolean>(false);
  const [editingEndpoint, setEditingEndpoint] = useState<SensorEndpointData | null>(null);
  const [epChipId, setEpChipId] = useState<string>('');
  const [epIntroByte, setEpIntroByte] = useState<string>('0x01');
  const [epBldId, setEpBldId] = useState<number>(1);
  const [epFloorNum, setEpFloorNum] = useState<number>(4);
  const [epRoomId, setEpRoomId] = useState<number>(16);
  const [epCoordX, setEpCoordX] = useState<number>(50);
  const [epCoordY, setEpCoordY] = useState<number>(50);
  const [epBeaconSec, setEpBeaconSec] = useState<number>(600);
  const [epSmokeThresh, setEpSmokeThresh] = useState<number>(400);

  // 7. User CRUD Modal (Tenants / Residents / Admins)
  const [userModalOpen, setUserModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [usrName, setUsrName] = useState<string>('');
  const [usrEmail, setUsrEmail] = useState<string>('');
  const [usrPhone, setUsrPhone] = useState<string>('+99890');
  const [usrRole, setUsrRole] = useState<UserRole>('tenant');

  const showNotice = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const tenantUsers = usersList.filter((u) => u.role === 'tenant');
  const residentUsers = usersList.filter((u) => u.role === 'user');
  const adminUsers = usersList.filter((u) => u.role === 'super_admin');

  const activeBuilding =
    buildings.find((b) => b.id === (openedBuildingId || selectedBuildingId)) || buildings[0];

  // ============================================================================
  // CRUD SUBMIT HANDLERS
  // ============================================================================

  // 1. Building Create / Update / Delete
  const openCreateBuildingModal = () => {
    setEditingBuilding(null);
    setBldName('');
    setBldCode('');
    setBldAddress('');
    setBldCity('Tashkent');
    setBldFloors(9);
    setBldTenantId('');
    setBldGwSerial('');
    setBuildingModalOpen(true);
  };

  const openEditBuildingModal = (bld: BuildingData) => {
    setEditingBuilding(bld);
    setBldName(bld.name);
    setBldCode(bld.code);
    setBldAddress(bld.address);
    setBldCity(bld.city);
    setBldFloors(bld.total_floors);
    setBldTenantId(bld.tenant_user_id ? String(bld.tenant_user_id) : '');
    setBldGwSerial(bld.gateway?.serial_number || '');
    setBuildingModalOpen(true);
  };

  const handleSaveBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBuilding) {
      await updateBuilding(editingBuilding.id, {
        name: bldName,
        code: bldCode,
        address: bldAddress,
        city: bldCity,
        tenant_user_id: bldTenantId ? Number(bldTenantId) : null
      });
      showNotice(`Bino "${bldName}" muvaffaqiyatli tahrirlandi!`);
    } else {
      await createBuilding({
        name: bldName,
        code: bldCode || undefined,
        address: bldAddress,
        city: bldCity,
        total_floors: bldFloors,
        tenant_user_id: bldTenantId ? Number(bldTenantId) : null,
        gateway_serial: bldGwSerial || undefined
      });
      showNotice(`Yangi bino "${bldName}" yaratildi!`);
    }
    setBuildingModalOpen(false);
  };

  const handleDeleteBuilding = async (bld: BuildingData) => {
    await deleteBuilding(bld.id);
    if (openedBuildingId === bld.id) {
      setOpenedBuildingId(null);
    }
    showNotice(`Bino "${bld.name}" o'chirildi.`);
  };

  const handleEnterBuilding = (bld: BuildingData) => {
    setSelectedBuildingId(bld.id);
    setSelectedFloor(1);
    setOpenedBuildingId(bld.id);
  };

  // 2. Floor Create / Update / Delete
  const openCreateFloorModal = () => {
    setEditingFloor(null);
    const nextNum = floors.reduce((m, f) => Math.max(m, f.floor_number), 0) + 1;
    setFlNum(nextNum);
    setFlName(`Floor ${nextNum} — Residential Apartments`);
    setFlHasHub(true);
    setFlHubMac(`EC:DA:3B:B${selectedBuildingId}:${String(nextNum).padStart(2, '0')}:A1`);
    setFlDip(nextNum);
    setFloorModalOpen(true);
  };

  const openEditFloorModal = (fl: FloorData) => {
    setEditingFloor(fl);
    setFlNum(fl.floor_number);
    setFlName(fl.name);
    setFlHasHub(fl.has_sub_hub);
    setFlHubMac(fl.hub_mac);
    setFlDip(fl.dip_switch_address);
    setFloorModalOpen(true);
  };

  const handleSaveFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingFloor) {
      await updateFloor(editingFloor.id, {
        floor_number: flNum,
        name: flName,
        has_sub_hub: flHasHub,
        hub_mac: flHubMac,
        dip_switch_address: flDip
      });
      showNotice(`Qavat #${flNum} tahrirlandi!`);
    } else {
      await addFloorToBuilding({
        building_id: selectedBuildingId,
        floor_number: flNum,
        name: flName,
        has_sub_hub: flHasHub
      });
      showNotice(`Yangi ${flNum}-qavat qo'shildi!`);
    }
    setFloorModalOpen(false);
  };

  // 3. Apartment Create / Update / Delete
  const openCreateAptModal = () => {
    setEditingApt(null);
    setAptRoomNumber(`Apt ${selectedFloor}0${rooms.length + 1}`);
    setAptOwnerId('');
    setAptPerimeter('disarmed');
    setAptModalOpen(true);
  };

  const openEditAptModal = (rm: RoomApartmentData) => {
    setEditingApt(rm);
    setAptRoomNumber(rm.room_number);
    setAptOwnerId(rm.owner_user_id ? String(rm.owner_user_id) : '');
    setAptPerimeter(rm.perimeter_security_status);
    setAptModalOpen(true);
  };

  const handleSaveApt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingApt) {
      await updateApartment(editingApt.id, {
        room_number: aptRoomNumber,
        owner_user_id: aptOwnerId ? Number(aptOwnerId) : null,
        perimeter_security_status: aptPerimeter
      });
      showNotice(`Xonadon "${aptRoomNumber}" yangilandi!`);
    } else {
      await addApartmentToFloor({
        building_id: selectedBuildingId,
        floor_number: selectedFloor,
        room_number: aptRoomNumber,
        owner_user_id: aptOwnerId ? Number(aptOwnerId) : null
      });
      showNotice(`Yangi xonadon "${aptRoomNumber}" qo'shildi!`);
    }
    setAptModalOpen(false);
  };

  // 4. Gateway Create / Update / Delete
  const openCreateGwModal = () => {
    setEditingGw(null);
    setGwSerial(`GW-SIM7670-TASH-0${(devicesInventory?.gateways.length || 3) + 1}`);
    setGwImei(`86948205911990${(devicesInventory?.gateways.length || 3) + 1}`);
    setGwOperator('Uztelecom GSM / LTE');
    setGwBuildingId(String(selectedBuildingId));
    setGwModalOpen(true);
  };

  const openEditGwModal = (gw: GatewayDeviceData) => {
    setEditingGw(gw);
    setGwSerial(gw.serial_number);
    setGwImei(gw.imei);
    setGwOperator(gw.sim_operator);
    setGwBuildingId(gw.building_id ? String(gw.building_id) : '');
    setGwModalOpen(true);
  };

  const handleSaveGw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGw) {
      await updateGatewayDevice(editingGw.id, {
        serial_number: gwSerial,
        imei: gwImei,
        sim_operator: gwOperator,
        building_id: gwBuildingId ? Number(gwBuildingId) : null
      });
      showNotice(`Gateway "${gwSerial}" yangilandi!`);
    } else {
      await registerGatewayDevice({
        building_id: gwBuildingId ? Number(gwBuildingId) : null,
        serial_number: gwSerial,
        imei: gwImei,
        sim_operator: gwOperator
      });
      showNotice(`Yangi Gateway "${gwSerial}" qo'shildi!`);
    }
    setGwModalOpen(false);
  };

  // 5. Floor Hub Create / Edit
  const openHubModal = (hubItem?: {
    building_id: number;
    floor_number: number;
    hub_mac: string;
    dip_switch_address: number;
    has_sub_hub: boolean;
  }) => {
    if (hubItem) {
      setHubBldId(hubItem.building_id);
      setHubFloorNum(hubItem.floor_number);
      setHubMacAddr(hubItem.hub_mac);
      setHubDipAddr(hubItem.dip_switch_address);
      setHubEnabled(hubItem.has_sub_hub);
    } else {
      setHubBldId(selectedBuildingId);
      setHubFloorNum(1);
      setHubMacAddr(`EC:DA:3B:B${selectedBuildingId}:01:FF`);
      setHubDipAddr(1);
      setHubEnabled(true);
    }
    setHubModalOpen(true);
  };

  const handleSaveHub = async (e: React.FormEvent) => {
    e.preventDefault();
    await configureFloorHubDevice({
      building_id: hubBldId,
      floor_number: hubFloorNum,
      hub_mac: hubMacAddr,
      dip_switch_address: hubDipAddr,
      has_sub_hub: hubEnabled
    });
    setHubModalOpen(false);
    showNotice(`Etaj Sub-Hub (Bino #${hubBldId}, ${hubFloorNum}-qavat) saqlandi!`);
  };

  // 6. Endpoint (1-Sensor Device) Create / Edit
  const openCreateEndpointModal = () => {
    setEditingEndpoint(null);
    setEpChipId('');
    setEpIntroByte('0x01');
    setEpBldId(selectedBuildingId);
    setEpFloorNum(selectedFloor);
    setEpRoomId(rooms[0]?.id || 16);
    setEpCoordX(50);
    setEpCoordY(50);
    setEpBeaconSec(600);
    setEpSmokeThresh(400);
    setEndpointModalOpen(true);
  };

  const openEditEndpointModal = (dev: SensorEndpointData) => {
    setEditingEndpoint(dev);
    setEpChipId(dev.chip_id);
    setEpIntroByte(dev.intro_type_byte);
    setEpBldId(dev.building_id);
    setEpFloorNum(dev.floor_number);
    setEpRoomId(dev.room_id);
    setEpCoordX(dev.coord_x);
    setEpCoordY(dev.coord_y);
    setEpBeaconSec(dev.beacon_interval_seconds);
    setEpSmokeThresh(dev.smoke_threshold_ppm || 400);
    setEndpointModalOpen(true);
  };

  const handleSaveEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEndpoint) {
      await updateEndpointDevice(editingEndpoint.id, {
        chip_id: epChipId,
        room_id: epRoomId,
        coord_x: epCoordX,
        coord_y: epCoordY,
        beacon_interval_seconds: epBeaconSec,
        smoke_threshold_ppm: epSmokeThresh
      });
      showNotice(`Endpoint "${epChipId}" yangilandi!`);
    } else {
      await completePairingWithIntroPacket({
        intro_type_byte: epIntroByte,
        chip_id: epChipId || undefined,
        building_id: epBldId,
        floor_number: epFloorNum,
        room_id: epRoomId
      });
      showNotice(`Yangi Endpoint (Intro Byte ${epIntroByte}) avtomatik aniqlandi va qo'shildi!`);
    }
    setEndpointModalOpen(false);
  };

  // 7. User Create / Edit (Tenant / Resident / Admin)
  const openCreateUserModal = (defaultRole: UserRole) => {
    setEditingUser(null);
    setUsrName('');
    setUsrEmail('');
    setUsrPhone('+99890');
    setUsrRole(defaultRole);
    setUserModalOpen(true);
  };

  const openEditUserModal = (u: UserProfile) => {
    setEditingUser(u);
    setUsrName(u.name);
    setUsrEmail(u.email);
    setUsrPhone(u.phone_number || '+99890');
    setUsrRole(u.role);
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      await updateUser(editingUser.id, {
        name: usrName,
        email: usrEmail,
        phone_number: usrPhone,
        role: usrRole
      });
      showNotice(`Foydalanuvchi "${usrName}" yangilandi!`);
    } else {
      await registerNewUser({
        name: usrName,
        email: usrEmail,
        phone_number: usrPhone,
        role: usrRole
      });
      showNotice(`Yangi foydalanuvchi "${usrName}" (${usrRole}) qo'shildi!`);
    }
    setUserModalOpen(false);
  };

  const handleSendAtCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAtCmd.trim()) return;
    const res = await fetch(`${API_BASE}/api/emergency/sim7670/at`, {
      method: 'POST',
      headers: getAuthHeaders('super_admin'),
      body: JSON.stringify({ command: customAtCmd })
    });
    if (res.ok) {
      const data = await res.json();
      setSim7670(data.gateway);
      setCustomAtCmd('');
    }
  };

  const handleResolveAlarm = async (alarmId: number) => {
    await fetch(`${API_BASE}/api/emergency/alarms/${alarmId}/resolve`, {
      method: 'POST',
      headers: getAuthHeaders('super_admin')
    });
    await refreshOverview();
    await refreshFloor();
  };

  // Helper to render User CRUD Table for a specific role
  const renderUsersCrudSection = (
    roleFilter: UserRole,
    title: string,
    subtitle: string,
    badgeColor: string,
    list: UserProfile[]
  ) => (
    <div className="space-y-5">
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-400" /> {title} ({list.length})
          </h2>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => openCreateUserModal(roleFilter)}
          className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-sky-600/25 transition"
        >
          <Plus className="w-4 h-4" /> + Qo‘shish ({roleFilter})
        </button>
      </div>

      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase">
              <th className="py-3 px-3">ID</th>
              <th className="py-3 px-3">F.I.SH (NAME)</th>
              <th className="py-3 px-3">EMAIL (GOOGLE SSO)</th>
              <th className="py-3 px-3">TELEFON</th>
              <th className="py-3 px-3">ROL</th>
              <th className="py-3 px-3">BIRIKTIRILGAN OBYEKT</th>
              <th className="py-3 px-3 text-right">CRUD AMALLAR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {list.map((u) => {
              const assignedBlds = buildings.filter((b) => b.tenant_user_id === u.id);
              const assignedRooms = rooms.filter((r) => r.owner_user_id === u.id);
              return (
                <tr key={u.id} className="text-slate-200 hover:bg-slate-800/40 transition">
                  <td className="py-3 px-3 text-slate-400">#{u.id}</td>
                  <td className="py-3 px-3 font-sans font-bold text-white">{u.name}</td>
                  <td className="py-3 px-3 text-sky-400">{u.email}</td>
                  <td className="py-3 px-3">{u.phone_number || '—'}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeColor}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-sans text-slate-300">
                    {u.role === 'tenant' &&
                      (assignedBlds.length > 0
                        ? assignedBlds.map((b) => b.name).join(', ')
                        : 'Biriktirilmagan')}
                    {u.role === 'user' &&
                      (assignedRooms.length > 0
                        ? assignedRooms.map((r) => `${r.room_number} (Fl ${r.floor_number})`).join(', ')
                        : 'Xonadon biriktirilmagan')}
                    {u.role === 'super_admin' && 'Tizim To‘liq Boshqaruvi (SaaS Root)'}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditUserModal(u)}
                        title="Tahrirlash (Edit)"
                        className="p-2 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-amber-400 border border-slate-700 hover:border-amber-500/40 transition"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteUser(u.id);
                          showNotice(`Foydalanuvchi "${u.name}" o'chirildi.`);
                        }}
                        title="O'chirish (Delete)"
                        className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 text-red-400 border border-slate-700 hover:border-red-500/40 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-110px)]">
      {/* =====================================================================
          LEFT SIDEBAR NAVIGATION MENU (CHAP MENYU)
         ===================================================================== */}
      <aside className="w-full lg:w-64 shrink-0 rounded-2xl bg-slate-900/95 border border-slate-800 p-4 flex flex-col justify-between shadow-xl h-fit lg:sticky lg:top-20">
        <div className="space-y-2">
          <div className="px-3 py-2 border-b border-slate-800 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-sky-400 font-bold block">
              SaaS Control Panel
            </span>
            <span className="text-sm font-black text-white">Boshqaruv Menyusi</span>
          </div>

          {/* 1. BINOLAR (BUILDINGS) */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('buildings');
              setOpenedBuildingId(null);
            }}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition ${
              activeSection === 'buildings'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/25'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4" />
              <span>Binolar (Buildings)</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-black/20 font-mono text-[10px]">
              {buildings.length}
            </span>
          </button>

          {/* 2. QURILMALAR (DEVICES) WITH SUB-MENUS */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setDevicesMenuOpen(!devicesMenuOpen)}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition ${
                activeSection.startsWith('devices-')
                  ? 'bg-slate-800 text-sky-400 border border-sky-500/30'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Cpu className="w-4 h-4 text-sky-400" />
                <span>Qurilmalar (Devices)</span>
              </span>
              {devicesMenuOpen ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {devicesMenuOpen && (
              <div className="mt-1 ml-4 pl-3 border-l border-slate-800 space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveSection('devices-gateways')}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition ${
                    activeSection === 'devices-gateways'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Signal className="w-3.5 h-3.5" /> Gatewaylar
                  </span>
                  <span className="font-mono text-[10px]">
                    {devicesInventory?.summary.total_gateways || 3}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('devices-hubs')}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition ${
                    activeSection === 'devices-hubs'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" /> Hublar (Etaj)
                  </span>
                  <span className="font-mono text-[10px]">
                    {devicesInventory?.summary.total_floor_hubs || 22}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('devices-endpoints')}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition ${
                    activeSection === 'devices-endpoints'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5" /> Endpointlar
                  </span>
                  <span className="font-mono text-[10px]">
                    {devicesInventory?.summary.total_end_devices || 0}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* 3. USERLAR (USERS) WITH SUB-MENUS */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setUsersMenuOpen(!usersMenuOpen)}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition ${
                activeSection.startsWith('users-')
                  ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Userlar (Users)</span>
              </span>
              {usersMenuOpen ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {usersMenuOpen && (
              <div className="mt-1 ml-4 pl-3 border-l border-slate-800 space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveSection('users-tenants')}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition ${
                    activeSection === 'users-tenants'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <span>Tenantlar (Shirkat)</span>
                  <span className="font-mono text-[10px]">{tenantUsers.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('users-residents')}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition ${
                    activeSection === 'users-residents'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <span>Oddiy Userlar</span>
                  <span className="font-mono text-[10px]">{residentUsers.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('users-admins')}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition ${
                    activeSection === 'users-admins'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <span>Adminlar</span>
                  <span className="font-mono text-[10px]">{adminUsers.length}</span>
                </button>
              </div>
            )}
          </div>

          {/* 4. TREVOQALAR & 112 (ALARMS & RPC) */}
          <button
            type="button"
            onClick={() => setActiveSection('alarms')}
            className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition ${
              activeSection === 'alarms'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <AlertOctagon className="w-4 h-4 text-red-400" />
              <span>Trevoqalar va 112</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-mono text-[10px]">
              {alarms.length}
            </span>
          </button>
        </div>

        {/* Bottom Hardware Status Summary */}
        <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
          <div className="flex items-center justify-between">
            <span>1-Sensor Rule:</span>
            <span className="text-emerald-400 font-bold">ACTIVE</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Intro Packet:</span>
            <span className="text-sky-400">0x01..0x05</span>
          </div>
        </div>
      </aside>

      {/* =====================================================================
          MAIN CONTENT AREA (RIGHT SIDE)
         ===================================================================== */}
      <div className="flex-1 min-w-0 space-y-6">
        {statusBanner && (
          <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center justify-between shadow-lg">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {statusBanner}
            </span>
            <button onClick={() => setStatusBanner(null)} className="text-emerald-400">
              ✕
            </button>
          </div>
        )}

        {/* ===================================================================
            SECTION 1: BINOLAR (BUILDINGS LIST CRUD -> DRILL-DOWN TO FLOORS)
           =================================================================== */}
        {activeSection === 'buildings' && openedBuildingId === null && (
          <div className="space-y-5">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-sky-400" />
                  Binolar Ro‘yxati (Buildings CRUD)
                </h2>
                <p className="text-xs text-slate-400">
                  Binoni tanlang (ichiga kirib qavatlar va xonadonlarni ko‘rish uchun) yoki standart CRUD (+ / ✏️ / 🗑️) amallaridan foydalaning.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateBuildingModal}
                className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-sky-600/25 transition"
              >
                <Plus className="w-4 h-4" /> + Yangi Bino Qo‘shish
              </button>
            </div>

            {/* Standard Buildings CRUD Table */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase">
                    <th className="py-3 px-3">ID / KOD</th>
                    <th className="py-3 px-3">BINO NOMI</th>
                    <th className="py-3 px-3">MANZIL / SHAHAR</th>
                    <th className="py-3 px-3">QAVATLAR / UYLAR</th>
                    <th className="py-3 px-3">TENANT (SHIRKAT)</th>
                    <th className="py-3 px-3">GATEWAY</th>
                    <th className="py-3 px-3">HOLATI</th>
                    <th className="py-3 px-3 text-right">CRUD AMALLAR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {buildings.map((bld) => (
                    <tr
                      key={bld.id}
                      className="text-slate-200 hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3 px-3 text-sky-400 font-bold">
                        #{bld.id} • {bld.code}
                      </td>
                      <td className="py-3 px-3 font-sans">
                        <button
                          type="button"
                          onClick={() => handleEnterBuilding(bld)}
                          className="font-black text-white hover:text-sky-400 underline decoration-dotted text-left"
                        >
                          {bld.name} →
                        </button>
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-300">
                        {bld.address}, {bld.city}
                      </td>
                      <td className="py-3 px-3">
                        {bld.total_floors} qavat • {bld.stats?.apartments_count || 0} xonadon •{' '}
                        {bld.stats?.sensors_count || 0} sensor
                      </td>
                      <td className="py-3 px-3 font-sans">
                        {bld.tenant_name ? (
                          <span className="text-amber-300 font-semibold">{bld.tenant_name}</span>
                        ) : (
                          <span className="text-slate-500">Biriktirilmagan</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-emerald-400">
                        {bld.gateway?.serial_number || '—'}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            bld.health_status === 'CRITICAL_ALARM'
                              ? 'bg-red-500/20 text-red-300'
                              : bld.health_status === 'WARNING'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {bld.health_status || 'HEALTHY'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEnterBuilding(bld)}
                            className="px-2.5 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/40 text-[11px] font-sans font-bold flex items-center gap-1 transition"
                            title="Bino ichiga kirish (Qavatlar)"
                          >
                            <Eye className="w-3.5 h-3.5" /> Qavatlar
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditBuildingModal(bld)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-amber-400 border border-slate-700 hover:border-amber-500/40 transition"
                            title="Tahrirlash (Ruchka)"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBuilding(bld)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 text-red-400 border border-slate-700 hover:border-red-500/40 transition"
                            title="O'chirish (Delete)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================================================================
            SECTION 1B: INSIDE SELECTED BUILDING (FLOORS CRUD + MAP + APARTMENTS CRUD)
           =================================================================== */}
        {activeSection === 'buildings' && openedBuildingId !== null && activeBuilding && (
          <div className="space-y-6">
            {/* Top Breadcrumb & Building Info Header */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOpenedBuildingId(null)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition"
                >
                  <ArrowLeft className="w-4 h-4" /> Binolar ro‘yxati
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-white">{activeBuilding.name}</h2>
                    <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono text-[10px] font-bold">
                      {activeBuilding.code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {activeBuilding.address}, {activeBuilding.city} • Tenant:{' '}
                    <span className="text-amber-300 font-semibold">
                      {activeBuilding.tenant_name || 'Biriktirilmagan'}
                    </span>{' '}
                    • Gateway:{' '}
                    <span className="text-emerald-400 font-mono">
                      {activeBuilding.gateway?.serial_number || '—'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openCreateFloorModal}
                  className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition"
                >
                  <Plus className="w-3.5 h-3.5" /> + Qavat Qo‘shish
                </button>
                <button
                  type="button"
                  onClick={openCreateAptModal}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition"
                >
                  <Plus className="w-3.5 h-3.5" /> + Xonadon Qo‘shish ({selectedFloor}-qavat)
                </button>
              </div>
            </div>

            {/* Floors CRUD Table inside this Building */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  Binodagi Qavatlar Ro‘yxati (Floors CRUD — {floors.length} ta qavat)
                </h3>
                <span className="text-xs text-slate-400">
                  Qavat qatorini bosib, uning topologik xaritasi va xonadonlarini boshqaring
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase">
                      <th className="py-2.5 px-3">QAVAT</th>
                      <th className="py-2.5 px-3">QAVAT NOMI</th>
                      <th className="py-2.5 px-3">ETAJ SUB-HUB / GATEWAY REJIMI</th>
                      <th className="py-2.5 px-3">DIP SWITCH</th>
                      <th className="py-2.5 px-3">SENSORLAR</th>
                      <th className="py-2.5 px-3 text-right">CRUD AMALLAR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {floors.map((fl) => {
                      const isSel = fl.floor_number === selectedFloor;
                      return (
                        <tr
                          key={fl.id}
                          onClick={() => setSelectedFloor(fl.floor_number)}
                          className={`cursor-pointer transition ${
                            isSel
                              ? 'bg-sky-500/15 text-white'
                              : 'text-slate-200 hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-bold text-sky-400">
                            #{fl.floor_number}-qavat
                          </td>
                          <td className="py-2.5 px-3 font-sans font-semibold text-white">
                            {fl.name}
                          </td>
                          <td className="py-2.5 px-3">
                            {fl.has_sub_hub ? (
                              <span className="text-emerald-400">
                                FLOOR_HUB: {fl.hub_id} ({fl.hub_mac})
                              </span>
                            ) : (
                              <span className="text-purple-400">DIRECT CENTRAL GATEWAY</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">{fl.dip_binary}</td>
                          <td className="py-2.5 px-3">
                            {fl.stats?.total_sensors ?? 0} ta sensor
                          </td>
                          <td
                            className="py-2.5 px-3 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditFloorModal(fl)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-amber-400 border border-slate-700"
                                title="Qavatni tahrirlash (Ruchka)"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteFloor(fl.id);
                                  showNotice(`Qavat #${fl.floor_number} o'chirildi.`);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-red-400 border border-slate-700"
                                title="Qavatni o'chirish (Delete)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Interactive Floor Blueprint Topology Map */}
            <BlueprintViewer
              floor={currentFloor}
              rooms={rooms}
              sensors={sensors}
              selectedSensor={selectedSensor}
              onSelectSensor={(s) => setSelectedSensor(s)}
              allowDragSensors={true}
              onSaveSensorCoords={saveSensorCoordinates}
              activePairingSession={activePairingSession}
              onStartDragDropPairing={startDragDropPairing}
              onCompleteIntroPacketPairing={completePairingWithIntroPacket}
              onCancelPairing={() => refreshFloor()}
            />

            {/* Apartments CRUD Table for the Selected Floor */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  {selectedFloor}-Qavatdagi Xonadonlar (Apartments CRUD — {rooms.length} ta)
                </h3>
                <button
                  type="button"
                  onClick={openCreateAptModal}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> + Xonadon Qo‘shish
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase">
                      <th className="py-2.5 px-3">ID</th>
                      <th className="py-2.5 px-3">XONADON RAQAMI</th>
                      <th className="py-2.5 px-3">BIRIKTIRILGAN USER (XONADON EGASI)</th>
                      <th className="py-2.5 px-3">QO‘RIQLASH HOLATI</th>
                      <th className="py-2.5 px-3">SENSORLAR SONI</th>
                      <th className="py-2.5 px-3 text-right">CRUD AMALLAR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {rooms.map((rm) => {
                      const aptSensors = sensors.filter((s) => s.room_id === rm.id);
                      return (
                        <tr key={rm.id} className="text-slate-200 hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 text-slate-400">#{rm.id}</td>
                          <td className="py-2.5 px-3 font-sans font-bold text-white">
                            {rm.room_number}
                          </td>
                          <td className="py-2.5 px-3 font-sans">
                            {rm.owner_name ? (
                              <span className="text-emerald-300 font-semibold">
                                {rm.owner_name} ({rm.owner_email})
                              </span>
                            ) : (
                              <span className="text-slate-500">User biriktirilmagan</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 text-[10px] font-bold uppercase">
                              {rm.perimeter_security_status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">{aptSensors.length} ta sensor</td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditAptModal(rm)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-amber-400 border border-slate-700"
                                title="Xonadonni tahrirlash (Ruchka)"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteApartment(rm.id);
                                  showNotice(`Xonadon "${rm.room_number}" o'chirildi.`);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-red-400 border border-slate-700"
                                title="Xonadonni o'chirish (Delete)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            SECTION 2.1: QURILMALAR -> GATEWAYLAR (CENTRAL GATEWAYS CRUD)
           =================================================================== */}
        {activeSection === 'devices-gateways' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Signal className="w-5 h-5 text-sky-400" />
                  Markaziy Gatewaylar (Central Gateways CRUD)
                </h2>
                <p className="text-xs text-slate-400">
                  SIM7670G 4G LTE / MQTT + RS485 Master shlyuzlarini qo‘shish, tahrirlash va binolarga biriktirish.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateGwModal}
                className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-sky-600/25 transition"
              >
                <Plus className="w-4 h-4" /> + Yangi Gateway Qo‘shish
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase">
                    <th className="py-3 px-3">ID</th>
                    <th className="py-3 px-3">SERIAL NUMBER</th>
                    <th className="py-3 px-3">BIRIKTIRILGAN BINO</th>
                    <th className="py-3 px-3">IMEI / MAC</th>
                    <th className="py-3 px-3">4G OPERATOR</th>
                    <th className="py-3 px-3">RSSI</th>
                    <th className="py-3 px-3">HOLATI</th>
                    <th className="py-3 px-3 text-right">CRUD AMALLAR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(devicesInventory?.gateways || []).map((gw) => (
                    <tr key={gw.id} className="text-slate-200 hover:bg-slate-800/40">
                      <td className="py-3 px-3 text-slate-400">#{gw.id}</td>
                      <td className="py-3 px-3 font-bold text-sky-400">{gw.serial_number}</td>
                      <td className="py-3 px-3 font-sans font-semibold text-white">
                        {gw.building_name || 'Biriktirilmagan'}
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        {gw.imei} / {gw.mac_address}
                      </td>
                      <td className="py-3 px-3">{gw.sim_operator}</td>
                      <td className="py-3 px-3 text-emerald-400">{gw.rssi_dbm} dBm</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase">
                          {gw.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditGwModal(gw)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-amber-400 border border-slate-700"
                            title="Tahrirlash (Ruchka)"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteGatewayDevice(gw.id);
                              showNotice(`Gateway "${gw.serial_number}" o'chirildi.`);
                            }}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 text-red-400 border border-slate-700"
                            title="O'chirish (Delete)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* SIM7670 AT Diagnostics Terminal */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  SIM7670G 4G LTE Modem AT-Command Console
                </h3>
                <span className="text-xs font-mono text-emerald-400">
                  IMEI: {sim7670?.imei} • {sim7670?.rssi_dbm} dBm
                </span>
              </div>
              <div className="h-36 rounded-xl bg-slate-950 border border-slate-800 p-3 font-mono text-[11px] overflow-y-auto space-y-1">
                {(sim7670?.at_logs || []).map((log, i) => (
                  <div key={i}>
                    <span className="text-sky-400">&gt; {log.tx}</span>{' '}
                    <span className="text-emerald-400">→ {log.rx}</span>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendAtCommand} className="flex gap-2">
                <input
                  type="text"
                  value={customAtCmd}
                  onChange={(e) => setCustomAtCmd(e.target.value)}
                  placeholder="AT+CSQ, AT+CMGS, ATD+998..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> SEND AT
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ===================================================================
            SECTION 2.2: QURILMALAR -> HUBLAR (FLOOR SUB-HUBS CRUD)
           =================================================================== */}
        {activeSection === 'devices-hubs' && (
          <div className="space-y-5">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-400" />
                  Etaj Sub-Hublari (Floor Sub-Hubs CRUD)
                </h2>
                <p className="text-xs text-slate-400">
                  Har bir qavatdagi ESP32-C3 + RS485 + 4-bit DIP Switch retranslator hublarini boshqarish.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openHubModal()}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition"
              >
                <Plus className="w-4 h-4" /> + Etaj Hub Qo‘shish / Sozlash
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase">
                    <th className="py-3 px-3">HUB ID</th>
                    <th className="py-3 px-3">BINO VA QAVAT</th>
                    <th className="py-3 px-3">DIP ADDRESS</th>
                    <th className="py-3 px-3">MAC ADDRESS</th>
                    <th className="py-3 px-3">ULANGAN ENDPOINTLAR</th>
                    <th className="py-3 px-3">HOLATI / LIPO</th>
                    <th className="py-3 px-3 text-right">CRUD AMALLAR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(devicesInventory?.floor_hubs || []).map((h) => (
                    <tr key={h.id} className="text-slate-200 hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-bold text-amber-400">{h.hub_id}</td>
                      <td className="py-3 px-3 font-sans">
                        {h.building_name} • <span className="font-bold">{h.floor_number}-qavat</span>
                      </td>
                      <td className="py-3 px-3">
                        {h.dip_binary} (#{h.dip_switch_address})
                      </td>
                      <td className="py-3 px-3 text-slate-400">{h.hub_mac}</td>
                      <td className="py-3 px-3 text-sky-400">
                        {h.connected_endpoints_count} ta sensor
                      </td>
                      <td className="py-3 px-3">
                        {h.has_sub_hub ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase">
                            {h.hub_status} ({h.hub_battery_pct}%)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase">
                            DIRECT GATEWAY
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openHubModal(h)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-amber-400 border border-slate-700"
                            title="Tahrirlash (Ruchka)"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteFloorHubDevice(h.id);
                              showNotice(`Floor #${h.floor_number} Sub-Hub o'chirildi (Direct Gateway rejimi).`);
                            }}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 text-red-400 border border-slate-700"
                            title="Hubni o'chirish (Delete)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================================================================
            SECTION 2.3: QURILMALAR -> ENDPOINTLAR (1-SENSOR END-DEVICES CRUD)
           =================================================================== */}
        {activeSection === 'devices-endpoints' && (
          <div className="space-y-5">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-emerald-400" />
                  Oxirgi Sensor Qurilmalari (1-Sensor Endpoints CRUD)
                </h2>
                <p className="text-xs text-slate-400">
                  Har bir qurilma faqat 1 ta sensorga ega (Intro Paket bayti 0x01..0x05 orqali tipi avtomatik aniqlanadi).
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateEndpointModal}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition"
              >
                <Plus className="w-4 h-4" /> + Yangi Endpoint Qo‘shish (Intro Packet)
              </button>
            </div>

            {/* 5 Specialized Safety Device Profiles */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {(devicesInventory?.device_profiles || []).map((prof) => (
                <div
                  key={prof.code}
                  className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1 font-mono text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                      INTRO {prof.intro_type_byte}
                    </span>
                    <span className="text-[10px] text-sky-400 font-bold">{prof.unit}</span>
                  </div>
                  <div className="font-sans font-bold text-white text-xs truncate">
                    {prof.name}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Crit: {prof.critical_threshold ?? 'STATE'} • Beacon: {prof.default_beacon_interval_sec}s
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase">
                    <th className="py-3 px-2">CHIP ID</th>
                    <th className="py-3 px-2">SENSOR TIPI (AVTO-ANIQLANGAN)</th>
                    <th className="py-3 px-2">INTRO PAKET HEX</th>
                    <th className="py-3 px-2">OTA TUGUN (HUB/GW)</th>
                    <th className="py-3 px-2">JOYLASHUV (BINO/QAVAT/UY)</th>
                    <th className="py-3 px-2">QIYMAT</th>
                    <th className="py-3 px-2">SYNC</th>
                    <th className="py-3 px-2 text-right">CRUD AMALLAR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(devicesInventory?.end_devices || []).slice(0, 80).map((dev) => (
                    <tr key={dev.id} className="text-slate-200 hover:bg-slate-800/40">
                      <td className="py-2.5 px-2 font-bold text-sky-400">{dev.chip_id}</td>
                      <td className="py-2.5 px-2">
                        <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-bold">
                          [{dev.intro_type_byte}] {t(`type_${dev.sensor_type}`)}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-emerald-400 text-[11px]">
                        {dev.intro_packet_hex}
                      </td>
                      <td className="py-2.5 px-2 text-amber-300">
                        {dev.parent_link_type}: {dev.parent_node_id}
                      </td>
                      <td className="py-2.5 px-2 text-slate-300">
                        Bld #{dev.building_id} • Fl {dev.floor_number} • {dev.room_number}
                      </td>
                      <td className="py-2.5 px-2 font-bold">
                        {dev.sensor_type === 'SMOKE_MQ2' && `${dev.smoke_ppm} PPM`}
                        {dev.sensor_type === 'TEMP_DS18B20' && `${dev.temperature} °C`}
                        {dev.sensor_type === 'CO_MQ7' && `${dev.co_ppm} PPM`}
                        {dev.sensor_type === 'DOOR_REED' &&
                          (dev.reed_switch_open ? 'OPEN' : 'CLOSED')}
                        {dev.sensor_type === 'GLASS_BREAK' &&
                          (dev.glass_break_detected ? 'SHATTER' : 'INTACT')}
                      </td>
                      <td className="py-2.5 px-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            dev.attributes?.sync_status === 'PENDING_WAKEUP'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {dev.attributes?.sync_status || 'SYNCED'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedSensor(dev)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-sky-500/20 text-sky-400 border border-slate-700"
                            title="3-Scope Atributlar & RPC (Inspect)"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditEndpointModal(dev)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-amber-400 border border-slate-700"
                            title="Tahrirlash (Ruchka)"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteEndpointDevice(dev.id);
                              showNotice(`Endpoint "${dev.chip_id}" o'chirildi.`);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-red-400 border border-slate-700"
                            title="O'chirish (Delete)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================================================================
            SECTION 3.1 / 3.2 / 3.3: USERLAR (TENANTS / RESIDENTS / ADMINS CRUD)
           =================================================================== */}
        {activeSection === 'users-tenants' &&
          renderUsersCrudSection(
            'tenant',
            'Tenantlar (Shirkat Rahbarlari CRUD)',
            'Binolarni boshqaruvchi shirkat rahbarlarini qo‘shish, tahrirlash va o‘chirish.',
            'bg-amber-500/20 text-amber-300',
            tenantUsers
          )}

        {activeSection === 'users-residents' &&
          renderUsersCrudSection(
            'user',
            'Oddiy Userlar (Xonadon Egalari CRUD)',
            'Xonadonlarda yashovchi foydalanuvchilarni qo‘shish, tahrirlash va o‘chirish.',
            'bg-emerald-500/20 text-emerald-300',
            residentUsers
          )}

        {activeSection === 'users-admins' &&
          renderUsersCrudSection(
            'super_admin',
            'Adminlar (Super Adminlar CRUD)',
            'Platforma bosh muhandislari va administratorlarini boshqarish.',
            'bg-sky-500/20 text-sky-300',
            adminUsers
          )}

        {/* ===================================================================
            SECTION 4: TREVOQALAR, 112 VA ANALITIKA (ALARMS & RPC)
           =================================================================== */}
        {activeSection === 'alarms' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <AlertOctagon className="w-5 h-5 text-red-400" />
                  Stateful Alarm Lifecycle &amp; 112 Dispatch Jurnali
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    triggerTestAlarm({
                      event_type: 'SMOKE_CRITICAL',
                      severity: 'critical',
                      smoke_val: 710,
                      temp_val: 64
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                >
                  + Simulate Fire Alarm
                </button>
              </div>

              <div className="space-y-2.5">
                {alarms.map((alm) => (
                  <div
                    key={alm.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">
                          {alm.alarm_code}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-mono text-[10px] font-bold">
                          {alm.lifecycle_state || alm.status.toUpperCase()}
                        </span>
                        <span className="text-xs font-mono text-amber-300">
                          Count: {alm.trigger_count || 1}x • Peak: {alm.peak_value || alm.smoke_val} PPM
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        Floor {alm.floor_number} • {alm.room_number} • Chip: {alm.chip_id}
                      </div>
                    </div>
                    {alm.status !== 'resolved' && (
                      <button
                        type="button"
                        onClick={() => handleResolveAlarm(alm.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold"
                      >
                        Clear &amp; Resolve
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <TelemetryChart sensor={selectedSensor} />
          </div>
        )}
      </div>

      {/* =====================================================================
          CRUD MODALS (+ ADD / PENCIL EDIT)
         ===================================================================== */}

      {/* 1. BUILDING ADD/EDIT MODAL */}
      {buildingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">
                {editingBuilding ? `Binoni Tahrirlash: ${editingBuilding.name}` : '+ Yangi Bino Yaratish'}
              </h3>
              <button onClick={() => setBuildingModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveBuilding} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Bino Nomi *</label>
                  <input
                    type="text"
                    required
                    value={bldName}
                    onChange={(e) => setBldName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Bino Kodi</label>
                  <input
                    type="text"
                    value={bldCode}
                    onChange={(e) => setBldCode(e.target.value)}
                    placeholder="SMART-BLD-04"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Manzil *</label>
                  <input
                    type="text"
                    required
                    value={bldAddress}
                    onChange={(e) => setBldAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Shahar</label>
                  <input
                    type="text"
                    value={bldCity}
                    onChange={(e) => setBldCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {!editingBuilding && (
                  <div>
                    <label className="text-slate-400 block mb-1">Qavatlar Soni</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={bldFloors}
                      onChange={(e) => setBldFloors(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                    />
                  </div>
                )}
                <div className={editingBuilding ? 'col-span-2' : ''}>
                  <label className="text-slate-400 block mb-1">Mas’ul Tenant (Shirkat)</label>
                  <select
                    value={bldTenantId}
                    onChange={(e) => setBldTenantId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  >
                    <option value="">-- Biriktirilmagan --</option>
                    {tenantUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setBuildingModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. FLOOR ADD/EDIT MODAL */}
      {floorModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">
                {editingFloor ? `Qavatni Tahrirlash (#${editingFloor.floor_number})` : '+ Yangi Qavat Qo‘shish'}
              </h3>
              <button onClick={() => setFloorModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveFloor} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Qavat Raqami *</label>
                <input
                  type="number"
                  required
                  value={flNum}
                  onChange={(e) => setFlNum(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Qavat Nomi *</label>
                <input
                  type="text"
                  required
                  value={flName}
                  onChange={(e) => setFlName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-300">Etaj Sub-Hub o‘rnatilganmi?</span>
                <input
                  type="checkbox"
                  checked={flHasHub}
                  onChange={(e) => setFlHasHub(e.target.checked)}
                  className="w-4 h-4 accent-sky-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setFloorModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. APARTMENT ADD/EDIT MODAL */}
      {aptModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">
                {editingApt ? `Xonadonni Tahrirlash: ${editingApt.room_number}` : '+ Yangi Xonadon Qo‘shish'}
              </h3>
              <button onClick={() => setAptModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveApt} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Xonadon Raqami / Nomi *</label>
                <input
                  type="text"
                  required
                  value={aptRoomNumber}
                  onChange={(e) => setAptRoomNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Xonadon Egasini Biriktirish (Resident User)</label>
                <select
                  value={aptOwnerId}
                  onChange={(e) => setAptOwnerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="">-- Biriktirilmagan --</option>
                  {residentUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAptModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. GATEWAY ADD/EDIT MODAL */}
      {gwModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">
                {editingGw ? `Gateway Tahrirlash: ${editingGw.serial_number}` : '+ Yangi Gateway Qo‘shish'}
              </h3>
              <button onClick={() => setGwModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveGw} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Gateway Serial Number *</label>
                <input
                  type="text"
                  required
                  value={gwSerial}
                  onChange={(e) => setGwSerial(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">SIM7670G IMEI *</label>
                <input
                  type="text"
                  required
                  value={gwImei}
                  onChange={(e) => setGwImei(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">4G LTE Operator</label>
                <input
                  type="text"
                  value={gwOperator}
                  onChange={(e) => setGwOperator(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Biriktirilgan Bino</label>
                <select
                  value={gwBuildingId}
                  onChange={(e) => setGwBuildingId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="">-- Biriktirilmagan --</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setGwModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. FLOOR HUB ADD/EDIT MODAL */}
      {hubModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">Etaj Sub-Hub Sozlash / Tahrirlash</h3>
              <button onClick={() => setHubModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveHub} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Bino</label>
                  <select
                    value={hubBldId}
                    onChange={(e) => setHubBldId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  >
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Qavat Raqami</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={hubFloorNum}
                    onChange={(e) => setHubFloorNum(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">MAC Address</label>
                  <input
                    type="text"
                    value={hubMacAddr}
                    onChange={(e) => setHubMacAddr(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">DIP Switch (1..15)</label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={hubDipAddr}
                    onChange={(e) => setHubDipAddr(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-300">Sub-Hub Aktiv (O‘chirilsa Direct Gateway bo‘ladi)</span>
                <input
                  type="checkbox"
                  checked={hubEnabled}
                  onChange={(e) => setHubEnabled(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setHubModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. ENDPOINT (1-SENSOR DEVICE) ADD/EDIT MODAL */}
      {endpointModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">
                {editingEndpoint
                  ? `Endpoint Tahrirlash: ${editingEndpoint.chip_id}`
                  : '+ Yangi 1-Sensorli Endpoint (Intro Paket)'}
              </h3>
              <button onClick={() => setEndpointModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEndpoint} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">ESP32-C3 Chip ID</label>
                <input
                  type="text"
                  value={epChipId}
                  onChange={(e) => setEpChipId(e.target.value)}
                  placeholder="C3-AUTO-HEX"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>
              {!editingEndpoint && (
                <div>
                  <label className="text-slate-400 block mb-1">
                    Kirish Tanishtiruv Paketi (Intro Packet Type Byte — 1 Qurilma = 1 Sensor)
                  </label>
                  <select
                    value={epIntroByte}
                    onChange={(e) => setEpIntroByte(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  >
                    <option value="0x01">0x01 → SMOKE_MQ2 (Tutun sensori)</option>
                    <option value="0x02">0x02 → TEMP_DS18B20 (Harorat sensori)</option>
                    <option value="0x03">0x03 → DOOR_REED (Eshik ochilishi gerkoni)</option>
                    <option value="0x04">0x04 → CO_MQ7 (Is gazi CO sensori)</option>
                    <option value="0x05">0x05 → GLASS_BREAK (Oyna sinishi sensori)</option>
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Koordinata X (%)</label>
                  <input
                    type="number"
                    value={epCoordX}
                    onChange={(e) => setEpCoordX(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Koordinata Y (%)</label>
                  <input
                    type="number"
                    value={epCoordY}
                    onChange={(e) => setEpCoordY(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEndpointModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. USER ADD/EDIT MODAL */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">
                {editingUser ? `Foydalanuvchini Tahrirlash: ${editingUser.name}` : `+ Yangi Foydalanuvchi (${usrRole})`}
              </h3>
              <button onClick={() => setUserModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">F.I.Sh (Full Name) *</label>
                <input
                  type="text"
                  required
                  value={usrName}
                  onChange={(e) => setUsrName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Google Email *</label>
                <input
                  type="email"
                  required
                  value={usrEmail}
                  onChange={(e) => setUsrEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Telefon Raqami</label>
                <input
                  type="text"
                  value={usrPhone}
                  onChange={(e) => setUsrPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Tizimdagi Roli</label>
                <select
                  value={usrRole}
                  onChange={(e) => setUsrRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="tenant">tenant (Shirkat rahbari)</option>
                  <option value="user">user (Oddiy xonadon egasi)</option>
                  <option value="super_admin">super_admin (Tizim administratori)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sliding Sensor Inspection, 3-Scope Attributes & RPC Drawer */}
      <SensorModal
        sensor={selectedSensor}
        onClose={() => setSelectedSensor(null)}
        onUpdateConfig={updateSensorConfig}
        onCalibrate={calibrateSensor}
        onTriggerTestAlarm={(s) =>
          triggerTestAlarm({
            sensor_id: s.id,
            chip_id: s.chip_id,
            event_type: 'SMOKE_CRITICAL',
            severity: 'critical',
            smoke_val: 680.5,
            temp_val: 62.4
          })
        }
      />
    </div>
  );
}
