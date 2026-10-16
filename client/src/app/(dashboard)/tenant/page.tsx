'use client';

import React, { useEffect, useState } from 'react';
import {
  Building2,
  Megaphone,
  Users,
  AlertTriangle,
  BatteryWarning,
  WifiOff,
  CheckCircle2,
  Volume2,
  PlusCircle,
  UserPlus,
  ShieldAlert,
  Layers,
  Bell,
  Eye,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Search,
  Shield,
  DoorOpen,
  Radio,
  Plus,
  X,
  Phone,
  Mail,
  Sliders,
  Flame,
  Thermometer,
  Wind
} from 'lucide-react';
import { API_BASE, getAuthHeaders, useFloorData } from '../../../hooks/useFloorData';
import { BlueprintViewer } from '../../../components/map/BlueprintViewer';
import { SensorModal } from '../../../components/map/SensorModal';
import { TelemetryChart } from '../../../components/charts/TelemetryChart';
import { AlarmManagementSection } from '../../../components/common/AlarmManagementSection';
import { ApartmentDetailsDrawer } from '../../../components/common/ApartmentDetailsDrawer';
import {
  FloorData,
  PerimeterSecurityStatus,
  RoomApartmentData,
  SensorEndpointData,
  UserProfile
} from '../../../types';
import { useAppSettings } from '../../../context/AppSettingsContext';

type TenantSection = 'apartments' | 'alarms' | 'broadcast' | 'residents';

export default function TenantManagerPage() {
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
    refreshAlarms,
    updateAlarmStatus,
    activePairingSession,
    setActivePairingSession,
    addFloorToBuilding,
    addApartmentToFloor,
    updateApartment,
    deleteApartment,
    registerNewUser,
    startDragDropPairing,
    completePairingWithIntroPacket,
    updateSensorConfig,
    calibrateSensor,
    triggerTestAlarm,
    refreshOverview,
    refreshFloor
  } = useFloorData(4, 'tenant');

  // Left Sidebar State
  const [activeSection, setActiveSection] = useState<TenantSection>('apartments');
  const [expandedBuildings, setExpandedBuildings] = useState<Record<number, boolean>>({});
  const [buildingFloorsMap, setBuildingFloorsMap] = useState<Record<number, FloorData[]>>({});

  // View Mode: 'list' (Ro'yxat jadvali) or 'map' (Chizma/Blueprint)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Selected apartment for right side drawer
  const [selectedApartment, setSelectedApartment] = useState<RoomApartmentData | null>(null);

  // Selected sensor for deep 3-scope inspection
  const [selectedSensor, setSelectedSensor] = useState<SensorEndpointData | null>(null);

  // Search filter for apartments table
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Loaded users and all apartments
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allApartments, setAllApartments] = useState<RoomApartmentData[]>([]);

  // Emergency announcement state
  const [announcementText, setAnnouncementText] = useState<string>(
    'DIQQAT: Bino datchiklari va yong‘in xavfsizligi tizimida rejali monitoring olib borilmoqda.'
  );
  const [triggerSirenFlag, setTriggerSirenFlag] = useState<boolean>(false);
  const [broadcastFeedback, setBroadcastFeedback] = useState<string | null>(null);

  // ============================================================================
  // MODAL STATES
  // ============================================================================
  // 1. Add Apartment Modal
  const [isAddAptModalOpen, setIsAddAptModalOpen] = useState<boolean>(false);
  const [newAptRoomNumber, setNewAptRoomNumber] = useState<string>('');
  const [newAptOwnerId, setNewAptOwnerId] = useState<string>('');

  // 2. Edit Apartment Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingApartment, setEditingApartment] = useState<RoomApartmentData | null>(null);
  const [editRoomNumber, setEditRoomNumber] = useState<string>('');
  const [editOwnerId, setEditOwnerId] = useState<string>('');
  const [editPerimeterStatus, setEditPerimeterStatus] =
    useState<PerimeterSecurityStatus>('disarmed');

  // 3. Register New Resident User Modal
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState<boolean>(false);
  const [newResidentName, setNewResidentName] = useState<string>('');
  const [newResidentEmail, setNewResidentEmail] = useState<string>('');
  const [newResidentPhone, setNewResidentPhone] = useState<string>('+99890');

  // Success / Status notice toast
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 3500);
  };

  const loadTenantAdminData = async (bId = selectedBuildingId) => {
    try {
      const [usersRes, aptsRes] = await Promise.all([
        fetch(`${API_BASE}/api/auth/users`, { headers: getAuthHeaders('tenant') }),
        fetch(`${API_BASE}/api/apartments?building_id=${bId}`, {
          headers: getAuthHeaders('tenant')
        })
      ]);
      if (usersRes.ok) {
        const uData = await usersRes.json();
        setAllUsers(uData.users || []);
      }
      if (aptsRes.ok) {
        const aData = await aptsRes.json();
        setAllApartments(aData.apartments || []);
      }
    } catch (err) {
      console.error('Failed to load tenant admin data:', err);
    }
  };

  useEffect(() => {
    loadTenantAdminData(selectedBuildingId);
  }, [selectedBuildingId]);

  // Expand selected building by default
  useEffect(() => {
    if (buildings.length > 0) {
      setExpandedBuildings((prev) => {
        if (Object.keys(prev).length === 0) {
          return { [selectedBuildingId]: true };
        }
        return prev;
      });
    }
  }, [buildings, selectedBuildingId]);

  // Prefetch floors for all buildings
  const fetchAllBuildingFloors = async () => {
    try {
      const results = await Promise.all(
        buildings.map(async (b) => {
          const res = await fetch(`${API_BASE}/api/floors?building_id=${b.id}`);
          if (res.ok) {
            const data = await res.json();
            return { id: b.id, floors: (data.floors || []) as FloorData[] };
          }
          return { id: b.id, floors: [] as FloorData[] };
        })
      );
      const map: Record<number, FloorData[]> = {};
      for (const item of results) {
        map[item.id] = item.floors;
      }
      setBuildingFloorsMap(map);
    } catch (err) {
      console.error('Failed to prefetch building floors:', err);
    }
  };

  useEffect(() => {
    if (buildings.length > 0) {
      fetchAllBuildingFloors();
    }
  }, [buildings]);

  // Handle floor selection from sidebar
  const handleSelectFloor = (bId: number, floorNum: number) => {
    if (selectedBuildingId !== bId) {
      setSelectedBuildingId(bId);
    }
    setSelectedFloor(floorNum);
    setActiveSection('apartments');
    setSelectedApartment(null);
  };

  // Mass Evacuation Announcement
  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastFeedback(null);
    const res = await fetch(`${API_BASE}/api/apartments/broadcast-evacuation`, {
      method: 'POST',
      headers: getAuthHeaders('tenant'),
      body: JSON.stringify({
        building_id: selectedBuildingId,
        message: announcementText,
        trigger_siren: triggerSirenFlag
      })
    });
    if (res.ok) {
      setBroadcastFeedback(
        triggerSirenFlag
          ? 'BINO BO‘YLAB EVAKUATSIYA SIRENASI ISHGA TUSHIRILDI!'
          : 'Aholiga xabarnoma muvaffaqiyatli yetkazildi!'
      );
    }
  };

  // Assign resident to apartment
  const handleAssignResident = async (roomId: number, ownerUserId: number | null) => {
    const res = await fetch(`${API_BASE}/api/apartments/${roomId}/assign-owner`, {
      method: 'PATCH',
      headers: getAuthHeaders('tenant'),
      body: JSON.stringify({ owner_user_id: ownerUserId })
    });
    if (res.ok) {
      const data = await res.json();
      setAllApartments((prev) =>
        prev.map((a) => (a.id === roomId ? { ...a, ...data.apartment } : a))
      );
      setSelectedApartment((prev) =>
        prev && prev.id === roomId ? { ...prev, ...data.apartment } : prev
      );
      await refreshFloor();
      await refreshOverview();
      showNotice('Xonadon egasi muvaffaqiyatli yangilandi!');
    }
  };

  // Update perimeter security
  const handleUpdatePerimeter = async (roomId: number, status: PerimeterSecurityStatus) => {
    const res = await fetch(`${API_BASE}/api/apartments/${roomId}/perimeter`, {
      method: 'PUT',
      headers: getAuthHeaders('tenant'),
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      setAllApartments((prev) =>
        prev.map((a) => (a.id === roomId ? { ...a, perimeter_security_status: status } : a))
      );
      setSelectedApartment((prev) =>
        prev && prev.id === roomId ? { ...prev, perimeter_security_status: status } : prev
      );
      await refreshFloor();
      showNotice(`Perimetr holati: ${status.toUpperCase()} ga o‘rnatildi.`);
    }
  };

  // Create Apartment Submit
  const handleCreateApartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAptRoomNumber.trim()) return;
    await addApartmentToFloor({
      building_id: selectedBuildingId,
      floor_number: selectedFloor,
      room_number: newAptRoomNumber.trim(),
      owner_user_id: newAptOwnerId ? Number(newAptOwnerId) : null
    });
    setNewAptRoomNumber('');
    setNewAptOwnerId('');
    setIsAddAptModalOpen(false);
    await loadTenantAdminData(selectedBuildingId);
    showNotice(`Yangi xonadon muvaffaqiyatli qo‘shildi!`);
  };

  // Open Edit Apartment Modal
  const openEditApartmentModal = (apt: RoomApartmentData) => {
    setEditingApartment(apt);
    setEditRoomNumber(apt.room_number);
    setEditOwnerId(apt.owner_user_id ? String(apt.owner_user_id) : '');
    setEditPerimeterStatus(apt.perimeter_security_status || 'disarmed');
    setIsEditModalOpen(true);
  };

  // Save Edited Apartment
  const handleSaveEditApartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingApartment) return;
    await updateApartment(editingApartment.id, {
      room_number: editRoomNumber.trim(),
      owner_user_id: editOwnerId ? Number(editOwnerId) : null,
      perimeter_security_status: editPerimeterStatus
    });
    setIsEditModalOpen(false);
    setEditingApartment(null);
    await loadTenantAdminData(selectedBuildingId);
    await refreshFloor();

    // If updated apartment is open in drawer, update drawer state
    setSelectedApartment((prev) =>
      prev && prev.id === editingApartment.id
        ? {
            ...prev,
            room_number: editRoomNumber.trim(),
            owner_user_id: editOwnerId ? Number(editOwnerId) : null,
            perimeter_security_status: editPerimeterStatus
          }
        : prev
    );
    showNotice(`Xonadon ma’lumotlari muvaffaqiyatli yangilandi!`);
  };

  // Delete Apartment
  const handleDeleteApartment = async (aptId: number) => {
    if (!confirm('Rostdan ham ushbu xonadonni tizimdan o‘chirmoqchimisiz?')) return;
    await deleteApartment(aptId);
    if (selectedApartment?.id === aptId) {
      setSelectedApartment(null);
    }
    await loadTenantAdminData(selectedBuildingId);
    await refreshFloor();
    await refreshOverview();
    showNotice(`Xonadon tizimdan o‘chirildi.`);
  };

  // Register New Resident User
  const handleRegisterResident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResidentName.trim() || !newResidentEmail.trim()) return;
    await registerNewUser({
      name: newResidentName.trim(),
      email: newResidentEmail.trim(),
      role: 'user',
      phone_number: newResidentPhone.trim()
    });
    setNewResidentName('');
    setNewResidentEmail('');
    setNewResidentPhone('+99890');
    setIsAddUserModalOpen(false);
    await loadTenantAdminData(selectedBuildingId);
    showNotice(`Yangi yashovchi muvaffaqiyatli ro‘yxatdan o‘tkazildi!`);
  };

  // Aggregate stats
  const totalAlarms = floors.reduce((sum, f) => sum + (f.stats?.alarm_sensors || 0), 0);
  const totalLowBat = floors.reduce((sum, f) => sum + (f.stats?.warning_sensors || 0), 0);
  const totalOffline = floors.reduce((sum, f) => sum + (f.stats?.offline_sensors || 0), 0);
  const newAlarmsCount = alarms.filter(
    (a) => (a.managed_status || (a.status === 'active' ? 'new_alarm' : '')) === 'new_alarm'
  ).length;

  const activeBuilding =
    buildings.find((b) => b.id === selectedBuildingId) || buildings[0];

  // Apartments on the selected floor
  const floorApartments = allApartments.filter(
    (apt) => apt.floor_number === selectedFloor
  );

  // Filtered by search query
  const filteredApartments = floorApartments.filter((apt) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesRoom = apt.room_number.toLowerCase().includes(q);
    const owner = allUsers.find((u) => u.id === apt.owner_user_id);
    const matchesOwner =
      owner?.name.toLowerCase().includes(q) ||
      owner?.email.toLowerCase().includes(q) ||
      owner?.phone_number?.includes(q);
    return matchesRoom || Boolean(matchesOwner);
  });

  // Helper to get sensors for a given apartment
  const getApartmentSensors = (aptId: number): SensorEndpointData[] => {
    const liveSensors = sensors.filter((s) => s.room_id === aptId);
    if (liveSensors.length > 0) return liveSensors;
    const apt = allApartments.find((a) => a.id === aptId);
    return apt?.sensors || [];
  };

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {statusNotice && (
        <div className="fixed top-20 right-6 z-50 p-3.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-2xl flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Main Container: Left Sidebar Menu + Right Content Area */}
      <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-110px)]">
        {/* =====================================================================
            LEFT SIDEBAR (CHAP MENYU) - SHIRKAT BOSHQARUVI
           ===================================================================== */}
        <aside className="w-full lg:w-72 shrink-0 rounded-2xl bg-slate-900/95 border border-slate-800 p-4 flex flex-col justify-between shadow-xl h-fit lg:sticky lg:top-20">
          <div className="space-y-4">
            {/* Sidebar Header */}
            <div className="px-3 py-2 border-b border-slate-800">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block">
                Shirkat (Tenant) Paneli
              </span>
              <span className="text-sm font-black text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" /> Binolar &amp; Qavatlar
              </span>
            </div>

            {/* 1. BUILDINGS LIST & EXPANDABLE FLOORS TREE */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-400 px-3 uppercase tracking-wider flex items-center justify-between">
                <span>Binolar Ro‘yxati ({buildings.length})</span>
                <span className="text-[10px] text-amber-400 font-mono">Etajni tanlang</span>
              </div>

              <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
                {buildings.map((bld) => {
                  const isExpanded =
                    expandedBuildings[bld.id] ?? bld.id === selectedBuildingId;
                  const isSelectedBld = bld.id === selectedBuildingId;

                  // Get floors for this building
                  const bldFloors: Array<{ floor_number: number; name?: string; stats?: any }> =
                    bld.id === selectedBuildingId && floors.length > 0
                      ? floors
                      : buildingFloorsMap[bld.id] && buildingFloorsMap[bld.id].length > 0
                        ? buildingFloorsMap[bld.id]
                        : Array.from({ length: bld.total_floors || 9 }, (_, idx) => ({
                            floor_number: idx + 1,
                            name: `${idx + 1}-qavat`
                          }));

                  return (
                    <div
                      key={bld.id}
                      className="rounded-xl border border-slate-800/80 bg-slate-950/60 overflow-hidden"
                    >
                      {/* Building Item Header */}
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedBuildings((prev) => ({
                            ...prev,
                            [bld.id]: !isExpanded
                          }));
                          if (selectedBuildingId !== bld.id) {
                            setSelectedBuildingId(bld.id);
                            setSelectedFloor(1);
                            setActiveSection('apartments');
                          }
                        }}
                        className={`w-full px-3 py-2.5 text-xs font-bold flex items-center justify-between transition ${
                          isSelectedBld
                            ? 'bg-amber-500/15 text-amber-300 border-l-2 border-amber-400'
                            : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <Building2
                            className={`w-4 h-4 shrink-0 ${
                              isSelectedBld ? 'text-amber-400' : 'text-slate-400'
                            }`}
                          />
                          <span className="truncate text-left">{bld.name}</span>
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-[10px] text-slate-400">
                            {bld.total_floors} qavat
                          </span>
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                      </button>

                      {/* Floors List when expanded */}
                      {isExpanded && (
                        <div className="p-1.5 bg-slate-950/90 border-t border-slate-800/60 space-y-1">
                          {bldFloors.map((fl) => {
                            const isCurrentFloorActive =
                              isSelectedBld &&
                              selectedFloor === fl.floor_number &&
                              activeSection === 'apartments';
                            const flAlarms = fl.stats?.alarm_sensors || 0;
                            const flWarns = fl.stats?.warning_sensors || 0;
                            const flOnline = fl.stats?.online_sensors;

                            return (
                              <button
                                key={fl.floor_number}
                                type="button"
                                onClick={() => handleSelectFloor(bld.id, fl.floor_number)}
                                className={`w-full px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition ${
                                  isCurrentFloorActive
                                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <Layers className="w-3.5 h-3.5" />
                                  <span>{fl.floor_number}-qavat</span>
                                </span>

                                <div className="flex items-center gap-1.5">
                                  {flAlarms > 0 && (
                                    <span
                                      className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"
                                      title="Yong‘in / Xavf"
                                    />
                                  )}
                                  {flWarns > 0 && (
                                    <span
                                      className="w-2 h-2 rounded-full bg-amber-400"
                                      title="Batareyka kam"
                                    />
                                  )}
                                  {flOnline !== undefined && (
                                    <span className="text-[10px] font-mono opacity-80">
                                      {flOnline} datchik
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. OTHER SHIRKAT SECTIONS */}
            <div className="space-y-1 pt-2 border-t border-slate-800">
              <div className="text-[11px] font-bold text-slate-400 px-3 uppercase tracking-wider mb-1">
                Umumiy Bo‘limlar
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveSection('alarms');
                  setSelectedApartment(null);
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition ${
                  activeSection === 'alarms'
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/25'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Alarmlar &amp; 112</span>
                </span>
                {newAlarmsCount > 0 ? (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-mono text-[10px] font-black animate-pulse">
                    {newAlarmsCount}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-black/20 font-mono text-[10px] text-slate-400">
                    {alarms.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveSection('broadcast');
                  setSelectedApartment(null);
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition ${
                  activeSection === 'broadcast'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Megaphone className="w-4 h-4 text-amber-400" />
                  <span>Xabarnoma &amp; Sirena</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveSection('residents');
                  setSelectedApartment(null);
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition ${
                  activeSection === 'residents'
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/25'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-sky-400" />
                  <span>Yashovchilar Reestri</span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-black/20 font-mono text-[10px] text-slate-400">
                  {allUsers.filter((u) => u.role === 'user').length}
                </span>
              </button>
            </div>
          </div>

          {/* Sidebar Footer Stats Summary */}
          <div className="pt-4 border-t border-slate-800 space-y-2 text-xs font-mono">
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Bino Alarmlari:</span>
                <span
                  className={totalAlarms > 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}
                >
                  {totalAlarms} ta
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Past Zaryad (&lt;20%):</span>
                <span
                  className={totalLowBat > 0 ? 'text-amber-300 font-bold' : 'text-slate-300'}
                >
                  {totalLowBat} datchik
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Aloqasiz:</span>
                <span
                  className={totalOffline > 0 ? 'text-slate-300 font-bold' : 'text-slate-500'}
                >
                  {totalOffline} qurilma
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* =====================================================================
            RIGHT MAIN CONTENT AREA
           ===================================================================== */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* SECTION 1: APARTMENTS & TOPOLOGY FOR SELECTED FLOOR */}
          {activeSection === 'apartments' && (
            <div className="space-y-6">
              {/* Floor Breadcrumbs & Summary Header Banner */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
                    <DoorOpen className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-lg font-black text-white">
                        {activeBuilding?.name || 'Bino'} — {selectedFloor}-qavat
                      </h1>
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {floorApartments.length} ta Xonadon
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {activeBuilding?.address}, {activeBuilding?.city} • Har bir xonadon datchiklari va holati
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* View Mode Toggle (Table / Blueprint) */}
                  <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        viewMode === 'list'
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>Ro‘yxat Jadvali</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('map')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        viewMode === 'map'
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Chizma (Blueprint)</span>
                    </button>
                  </div>

                  {/* Add Apartment Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setNewAptRoomNumber(`${selectedFloor}1`);
                      setIsAddAptModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-sky-600/25 transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Xonadon Qo‘shish</span>
                  </button>

                  {/* Add Floor Button */}
                  <button
                    type="button"
                    onClick={() =>
                      addFloorToBuilding({
                        building_id: selectedBuildingId,
                        has_sub_hub: true
                      })
                    }
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
                    title="Yangi qavat qo‘shish"
                  >
                    <PlusCircle className="w-4 h-4 text-amber-400" />
                    <span>+ Qavat</span>
                  </button>
                </div>
              </div>

              {/* Floor Health Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Jami Xonadonlar:</span>
                  <span className="text-lg font-black text-white font-mono">
                    {floorApartments.length} ta
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Faol Datchiklar:</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    {sensors.length} ta
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Past Zaryad (&lt;20%):</span>
                  <span
                    className={`text-lg font-black font-mono ${
                      sensors.filter((s) => s.battery_level <= 20).length > 0
                        ? 'text-amber-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {sensors.filter((s) => s.battery_level <= 20).length} datchik
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Aloqasiz / Offline:</span>
                  <span
                    className={`text-lg font-black font-mono ${
                      sensors.filter((s) => s.status === 'offline').length > 0
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {sensors.filter((s) => s.status === 'offline').length} ta
                  </span>
                </div>
              </div>

              {/* VIEW MODE 1: APARTMENTS LIST / TABLE VIEW (RO'YXAT JADVALI) */}
              {viewMode === 'list' && (
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                  {/* Table Search & Filter Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="relative w-full sm:w-72">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Xonadon raqami yoki egasi bo‘yicha qidirish..."
                        className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="text-xs text-slate-400">
                      Ko‘rsatilmoqda:{' '}
                      <strong className="text-white">{filteredApartments.length}</strong> /{' '}
                      {floorApartments.length} ta xonadon
                    </div>
                  </div>

                  {/* Responsive Apartments Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                          <th className="py-3 px-3">Xonadon</th>
                          <th className="py-3 px-3">Xonadon Egasi</th>
                          <th className="py-3 px-3">Datchiklar</th>
                          <th className="py-3 px-3">Holati &amp; Batareyka</th>
                          <th className="py-3 px-3">Perimetr</th>
                          <th className="py-3 px-3 text-right">Amallar (CRUD)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {filteredApartments.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-500 text-xs font-sans">
                              Ushbu qavatda xonadonlar topilmadi. Yangi xonadon qo‘shish uchun yuqoridagi tugmadan foydalaning.
                            </td>
                          </tr>
                        ) : (
                          filteredApartments.map((apt) => {
                            const aptSensors = getApartmentSensors(apt.id);
                            const owner = allUsers.find((u) => u.id === apt.owner_user_id);
                            const isSelected = selectedApartment?.id === apt.id;

                            // Health checks
                            const hasAlarm = aptSensors.some((s) => s.status === 'alarm');
                            const hasLowBat = aptSensors.some(
                              (s) =>
                                (s.battery_level !== undefined && s.battery_level <= 20) ||
                                s.status === 'warning'
                            );
                            const hasOffline = aptSensors.some((s) => s.status === 'offline');
                            const minBattery =
                              aptSensors.length > 0
                                ? Math.min(...aptSensors.map((s) => s.battery_level || 100))
                                : null;

                            return (
                              <tr
                                key={apt.id}
                                onClick={() => setSelectedApartment(apt)}
                                className={`text-slate-200 transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-amber-500/10 border-l-2 border-amber-400'
                                    : 'hover:bg-slate-800/40'
                                }`}
                              >
                                {/* 1. Room Number */}
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                                      <DoorOpen className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <div>
                                      <span className="font-sans font-bold text-white block">
                                        {apt.room_number}
                                      </span>
                                      <span className="text-[10px] text-slate-500 font-mono">
                                        ID: #{apt.id}
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                {/* 2. Owner Info */}
                                <td className="py-3 px-3">
                                  {owner ? (
                                    <div className="space-y-0.5 font-sans">
                                      <div className="font-bold text-slate-200 text-xs">
                                        {owner.name}
                                      </div>
                                      <div className="text-[11px] text-sky-400 font-mono flex items-center gap-1">
                                        <Phone className="w-3 h-3 text-sky-400" />
                                        <span>{owner.phone_number || owner.email}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-slate-800 text-slate-400 border border-slate-700">
                                      Biriktirilmagan
                                    </span>
                                  )}
                                </td>

                                {/* 3. Sensors / Devices */}
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px] font-bold text-sky-400">
                                      {aptSensors.length} ta
                                    </span>
                                    {aptSensors.map((s) => {
                                      if (s.sensor_type === 'SMOKE_MQ2') {
                                        return (
                                          <span
                                            key={s.id}
                                            title="Tutun datchigi (MQ-2)"
                                            className="p-1 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                          >
                                            <Flame className="w-3 h-3" />
                                          </span>
                                        );
                                      }
                                      if (s.sensor_type === 'TEMP_DS18B20') {
                                        return (
                                          <span
                                            key={s.id}
                                            title="Harorat datchigi"
                                            className="p-1 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30"
                                          >
                                            <Thermometer className="w-3 h-3" />
                                          </span>
                                        );
                                      }
                                      if (s.sensor_type === 'DOOR_REED') {
                                        return (
                                          <span
                                            key={s.id}
                                            title="Eshik datchigi"
                                            className="p-1 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                          >
                                            <DoorOpen className="w-3 h-3" />
                                          </span>
                                        );
                                      }
                                      if (s.sensor_type === 'CO_MQ7') {
                                        return (
                                          <span
                                            key={s.id}
                                            title="Is gazi datchigi"
                                            className="p-1 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                          >
                                            <Wind className="w-3 h-3" />
                                          </span>
                                        );
                                      }
                                      return (
                                        <span
                                          key={s.id}
                                          className="p-1 rounded bg-slate-800 text-slate-300"
                                        >
                                          <Radio className="w-3 h-3" />
                                        </span>
                                      );
                                    })}
                                  </div>
                                </td>

                                {/* 4. Status & Battery */}
                                <td className="py-3 px-3">
                                  <div className="flex flex-col gap-1 items-start">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                        hasAlarm
                                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse'
                                          : hasLowBat
                                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                            : hasOffline
                                              ? 'bg-slate-800 text-slate-400 border-slate-700'
                                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                      }`}
                                    >
                                      {hasAlarm
                                        ? 'YONG‘IN'
                                        : hasLowBat
                                          ? 'BATAREYKA KAM'
                                          : hasOffline
                                            ? 'ALOQASIZ'
                                            : 'NORMAL'}
                                    </span>
                                    {minBattery !== null && (
                                      <span
                                        className={`text-[10px] font-mono ${
                                          minBattery <= 20
                                            ? 'text-amber-400 font-bold'
                                            : 'text-slate-400'
                                        }`}
                                      >
                                        Zaryad: {minBattery}%
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* 5. Perimeter Mode */}
                                <td className="py-3 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold uppercase ${
                                      apt.perimeter_security_status === 'armed_away'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                        : apt.perimeter_security_status === 'armed_home'
                                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                          : 'bg-slate-800 text-slate-400'
                                    }`}
                                  >
                                    {apt.perimeter_security_status === 'armed_away'
                                      ? 'Uydan chiqdim'
                                      : apt.perimeter_security_status === 'armed_home'
                                        ? 'Uydaman'
                                        : 'O‘chiq'}
                                  </span>
                                </td>

                                {/* 6. Actions (CRUD) */}
                                <td
                                  className="py-3 px-3 text-right"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="inline-flex items-center gap-1.5">
                                    {/* View / Open Drawer */}
                                    <button
                                      type="button"
                                      onClick={() => setSelectedApartment(apt)}
                                      title="Batafsil ma’lumot va datchiklar (O‘ng panel)"
                                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-sky-500/20 text-sky-400 border border-slate-700 hover:border-sky-500/40 transition"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Edit Apartment */}
                                    <button
                                      type="button"
                                      onClick={() => openEditApartmentModal(apt)}
                                      title="Tahrirlash (Edit)"
                                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-amber-400 border border-slate-700 hover:border-amber-500/40 transition"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Delete Apartment */}
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteApartment(apt.id)}
                                      title="O‘chirish (Delete)"
                                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 border border-slate-700 hover:border-rose-500/40 transition"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* VIEW MODE 2: BLUEPRINT VIEWER WITH DRAG-AND-DROP PAIRING */}
              {viewMode === 'map' && (
                <div className="space-y-4">
                  <BlueprintViewer
                    floor={currentFloor}
                    rooms={rooms}
                    sensors={sensors}
                    selectedSensor={selectedSensor}
                    onSelectSensor={(s) => setSelectedSensor(s)}
                    allowDragSensors={true}
                    activePairingSession={activePairingSession}
                    onStartDragDropPairing={(p) =>
                      startDragDropPairing({
                        building_id: selectedBuildingId,
                        floor_id: currentFloor?.id,
                        floor_number: selectedFloor,
                        room_id: p.room_id,
                        coord_x: p.coord_x,
                        coord_y: p.coord_y
                      })
                    }
                    onCompleteIntroPacketPairing={completePairingWithIntroPacket}
                    onCancelPairing={() => setActivePairingSession(null)}
                  />
                  <TelemetryChart sensor={selectedSensor} />
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: ALARMS MANAGEMENT TAB */}
          {activeSection === 'alarms' && (
            <AlarmManagementSection
              alarms={alarms}
              buildings={buildings}
              floors={floors}
              selectedBuildingId={selectedBuildingId}
              onUpdateAlarmStatus={updateAlarmStatus}
              onTriggerTestAlarm={triggerTestAlarm}
              onRefreshAlarms={refreshAlarms}
              userRole="tenant"
            />
          )}

          {/* SECTION 3: BROADCAST ANNOUNCEMENT & SIREN */}
          {activeSection === 'broadcast' && (
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5 max-w-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
                  <Megaphone className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    Bino Bo‘ylab Umumiy Xabar va Sirena
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activeBuilding?.name} aholisiga umumiy bildirishnoma yoki evakuatsiya akustik signalini yuborish
                  </p>
                </div>
              </div>

              <form onSubmit={handleBroadcast} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-300 block mb-1.5 font-semibold">
                    Xabarnoma Matni:
                  </label>
                  <textarea
                    rows={4}
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <label className="flex items-center justify-between p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 cursor-pointer">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-rose-200">
                    <Volume2 className="w-5 h-5 text-rose-400 shrink-0" />
                    <span>Bino bo‘ylab umumiy akustik evakuatsiya sirenasini yoqish</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={triggerSirenFlag}
                    onChange={(e) => setTriggerSirenFlag(e.target.checked)}
                    className="w-5 h-5 accent-rose-600 rounded"
                  />
                </label>

                <button
                  type="submit"
                  className={`w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-lg ${
                    triggerSirenFlag
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  }`}
                >
                  {triggerSirenFlag
                    ? 'EVAKUATSIYA SIRENASINI ISHGA TUSHIRISH'
                    : 'Aholiga Xabarni Yuborish'}
                </button>
              </form>

              {broadcastFeedback && (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                  {broadcastFeedback}
                </div>
              )}
            </div>
          )}

          {/* SECTION 4: RESIDENTS REGISTRY */}
          {activeSection === 'residents' && (
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-sky-400" />
                    Ro‘yxatdan O‘tgan Yashovchilar Reestri
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Bino yashovchilarining shaxsiy kabinetlari va kontakt ma’lumotlari
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/25 transition"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Yangi Yashovchi Qo‘shish</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                      <th className="py-3 px-3">ID</th>
                      <th className="py-3 px-3">F.I.SH (NAME)</th>
                      <th className="py-3 px-3">EMAIL</th>
                      <th className="py-3 px-3">TELEFON</th>
                      <th className="py-3 px-3">BIRIKTIRILGAN XONADON</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {allUsers
                      .filter((u) => u.role === 'user')
                      .map((u) => {
                        const assignedRooms = allApartments.filter(
                          (a) => a.owner_user_id === u.id
                        );
                        return (
                          <tr key={u.id} className="text-slate-200 hover:bg-slate-800/40">
                            <td className="py-3 px-3 text-slate-500">#{u.id}</td>
                            <td className="py-3 px-3 font-sans font-bold text-white">
                              {u.name}
                            </td>
                            <td className="py-3 px-3 text-sky-400">{u.email}</td>
                            <td className="py-3 px-3 font-mono">{u.phone_number || '—'}</td>
                            <td className="py-3 px-3 font-sans text-slate-300">
                              {assignedRooms.length > 0 ? (
                                <span className="text-emerald-400 font-semibold">
                                  {assignedRooms
                                    .map((r) => `${r.room_number} (${r.floor_number}-qavat)`)
                                    .join(', ')}
                                </span>
                              ) : (
                                <span className="text-slate-500">Biriktirilmagan</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* =====================================================================
          SLIDE-OVER APARTMENT DETAILS RIGHT DRAWER
         ===================================================================== */}
      <ApartmentDetailsDrawer
        apartment={selectedApartment}
        building={activeBuilding}
        sensors={getApartmentSensors(selectedApartment?.id || 0)}
        users={allUsers}
        onClose={() => setSelectedApartment(null)}
        onAssignOwner={handleAssignResident}
        onUpdatePerimeter={handleUpdatePerimeter}
        onEditApartment={openEditApartmentModal}
        onDeleteApartment={handleDeleteApartment}
        onSelectSensor={(s) => setSelectedSensor(s)}
      />

      {/* =====================================================================
          SLIDE-OVER SENSOR DETAILS DRAWER (THINGSBOARD ATTRIBUTES / TELEMETRY)
         ===================================================================== */}
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

      {/* =====================================================================
          MODAL 1: ADD APARTMENT TO FLOOR
         ===================================================================== */}
      {isAddAptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DoorOpen className="w-5 h-5 text-amber-400" />
                Yangi Xonadon Qo‘shish ({selectedFloor}-qavat)
              </h3>
              <button
                type="button"
                onClick={() => setIsAddAptModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateApartment} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 block mb-1 font-semibold">
                  Xonadon Nomi / Raqami *
                </label>
                <input
                  type="text"
                  required
                  value={newAptRoomNumber}
                  onChange={(e) => setNewAptRoomNumber(e.target.value)}
                  placeholder={`Masalan: ${selectedFloor}1-xonadon yoki №${selectedFloor}1`}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1 font-semibold">
                  Biriktiriladigan Yashovchi (Ixtiyoriy)
                </label>
                <select
                  value={newAptOwnerId}
                  onChange={(e) => setNewAptOwnerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Hozircha biriktirilmasin --</option>
                  {allUsers
                    .filter((u) => u.role === 'user')
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddAptModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20"
                >
                  Xonadonni Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: EDIT APARTMENT
         ===================================================================== */}
      {isEditModalOpen && editingApartment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-amber-400" />
                Xonadonni Tahrirlash: {editingApartment.room_number}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditApartment} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 block mb-1 font-semibold">
                  Xonadon Raqami *
                </label>
                <input
                  type="text"
                  required
                  value={editRoomNumber}
                  onChange={(e) => setEditRoomNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1 font-semibold">
                  Xonadon Egasi
                </label>
                <select
                  value={editOwnerId}
                  onChange={(e) => setEditOwnerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Biriktirilmagan --</option>
                  {allUsers
                    .filter((u) => u.role === 'user' || u.role === 'tenant')
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1 font-semibold">
                  Perimetr Xavfsizlik Rejimi
                </label>
                <select
                  value={editPerimeterStatus}
                  onChange={(e) =>
                    setEditPerimeterStatus(e.target.value as PerimeterSecurityStatus)
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="disarmed">Himoya O‘chiq (Disarmed)</option>
                  <option value="armed_home">Kuzatuvda (Uydaman)</option>
                  <option value="armed_away">Kuzatuvda (Uydan chiqdim)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20"
                >
                  O‘zgarishlarni Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: REGISTER NEW RESIDENT USER
         ===================================================================== */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                Yangi Yashovchini Ro‘yxatdan O‘tkazish
              </h3>
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterResident} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 block mb-1 font-semibold">
                  Yashovchi F.I.Sh *
                </label>
                <input
                  type="text"
                  required
                  value={newResidentName}
                  onChange={(e) => setNewResidentName(e.target.value)}
                  placeholder="Masalan: Sardor Rahimov"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1 font-semibold">
                  Elektron Pochta *
                </label>
                <input
                  type="email"
                  required
                  value={newResidentEmail}
                  onChange={(e) => setNewResidentEmail(e.target.value)}
                  placeholder="sardor@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1 font-semibold">
                  Telefon Raqami
                </label>
                <input
                  type="text"
                  value={newResidentPhone}
                  onChange={(e) => setNewResidentPhone(e.target.value)}
                  placeholder="+998901234567"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25"
                >
                  Foydalanuvchini Yaratish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
