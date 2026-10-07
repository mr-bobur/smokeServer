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
  UserPlus
} from 'lucide-react';
import { API_BASE, getAuthHeaders, useFloorData } from '../../../hooks/useFloorData';
import { BlueprintViewer } from '../../../components/map/BlueprintViewer';
import { SensorModal } from '../../../components/map/SensorModal';
import { TelemetryChart } from '../../../components/charts/TelemetryChart';
import {
  RoomApartmentData,
  SensorEndpointData,
  UserProfile
} from '../../../types';
import { useAppSettings } from '../../../context/AppSettingsContext';

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
    activePairingSession,
    setActivePairingSession,
    addFloorToBuilding,
    addApartmentToFloor,
    registerNewUser,
    startDragDropPairing,
    completePairingWithIntroPacket,
    updateSensorConfig,
    calibrateSensor,
    triggerTestAlarm,
    refreshOverview,
    refreshFloor
  } = useFloorData(4, 'tenant');

  const [selectedSensor, setSelectedSensor] = useState<SensorEndpointData | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allApartments, setAllApartments] = useState<RoomApartmentData[]>([]);
  const [announcementText, setAnnouncementText] = useState<string>(
    'DIQQAT / ATTENTION: Scheduled fire alarm & smoke evacuation test on Floor 4.'
  );
  const [triggerSirenFlag, setTriggerSirenFlag] = useState<boolean>(false);
  const [broadcastFeedback, setBroadcastFeedback] = useState<string | null>(null);

  // Add Apartment & Resident User state
  const [newAptName, setNewAptName] = useState<string>('');
  const [newResidentName, setNewResidentName] = useState<string>('');
  const [newResidentEmail, setNewResidentEmail] = useState<string>('');
  const [newResidentPhone, setNewResidentPhone] = useState<string>('+99890');

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
      console.error('Failed to load tenant assignment data:', err);
    }
  };

  useEffect(() => {
    loadTenantAdminData(selectedBuildingId);
  }, [selectedBuildingId]);

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
          ? 'BUILDING-WIDE EVACUATION SIREN ACTIVATED!'
          : 'Push announcement dispatched to all registered residents!'
      );
    }
  };

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
      await refreshFloor();
      await refreshOverview();
    }
  };

  const handleCreateApartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAptName.trim()) return;
    await addApartmentToFloor({
      building_id: selectedBuildingId,
      floor_number: selectedFloor,
      room_number: newAptName
    });
    setNewAptName('');
    await loadTenantAdminData(selectedBuildingId);
  };

  const handleRegisterResident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResidentName.trim() || !newResidentEmail.trim()) return;
    await registerNewUser({
      name: newResidentName,
      email: newResidentEmail,
      role: 'user',
      phone_number: newResidentPhone
    });
    setNewResidentName('');
    setNewResidentEmail('');
    await loadTenantAdminData(selectedBuildingId);
  };

  const totalAlarms = floors.reduce((sum, f) => sum + (f.stats?.alarm_sensors || 0), 0);
  const totalLowBat = floors.reduce((sum, f) => sum + (f.stats?.warning_sensors || 0), 0);
  const totalOffline = floors.reduce((sum, f) => sum + (f.stats?.offline_sensors || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Shirkat Manager Summary & Building Selector Banner */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-white">{t('nav_tenant')}</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40">
                ROLE: TENANT
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-400">{t('select_building')}:</span>
              <select
                value={selectedBuildingId}
                onChange={(e) => {
                  setSelectedBuildingId(Number(e.target.value));
                  setSelectedFloor(1);
                }}
                className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs font-bold text-white"
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.total_floors} Floors)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-red-950/60 border border-red-500/40 text-xs font-mono">
            <span className="text-slate-400 block text-[10px]">ACTIVE ALARMS</span>
            <span className="text-red-400 font-bold text-sm">{totalAlarms} Nodes</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs font-mono">
            <span className="text-slate-400 block text-[10px]">LOW BAT / WARN</span>
            <span className="text-amber-300 font-bold text-sm">{totalLowBat} Nodes</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
            <span className="text-slate-400 block text-[10px]">OFFLINE NODES</span>
            <span className="text-slate-300 font-bold text-sm">{totalOffline} Nodes</span>
          </div>
        </div>
      </div>

      {/* Row 1: Aggregated Floor Health Matrix + Mass Announcement & Siren */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Building Floors Health Matrix
            </h2>
            <button
              type="button"
              onClick={() =>
                addFloorToBuilding({ building_id: selectedBuildingId, has_sub_hub: true })
              }
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 text-xs font-bold flex items-center gap-1 transition"
            >
              <PlusCircle className="w-3.5 h-3.5" /> {t('add_floor')}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {floors.map((fl) => {
              const isSelected = fl.floor_number === selectedFloor;
              const alarmsCount = fl.stats?.alarm_sensors || 0;
              const warnCount = fl.stats?.warning_sensors || 0;
              const offlineCount = fl.stats?.offline_sensors || 0;

              return (
                <button
                  key={fl.id}
                  type="button"
                  onClick={() => setSelectedFloor(fl.floor_number)}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-400 text-white'
                      : 'bg-slate-950/80 border-slate-800/90 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white">
                      Floor {fl.floor_number}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {fl.has_sub_hub ? `DIP ${fl.dip_binary}` : 'GW Direct'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mb-2">{fl.name}</div>
                  <div className="flex items-center justify-between text-[11px] font-mono pt-2 border-t border-slate-800/80">
                    <span className={alarmsCount > 0 ? 'text-red-400 font-bold' : 'text-slate-500'}>
                      <AlertTriangle className="w-3 h-3 inline mr-0.5" />
                      {alarmsCount}
                    </span>
                    <span className={warnCount > 0 ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                      <BatteryWarning className="w-3 h-3 inline mr-0.5" />
                      {warnCount}
                    </span>
                    <span className={offlineCount > 0 ? 'text-slate-300 font-bold' : 'text-slate-500'}>
                      <WifiOff className="w-3 h-3 inline mr-0.5" />
                      {offlineCount}
                    </span>
                    <span className="text-emerald-400">
                      <CheckCircle2 className="w-3 h-3 inline mr-0.5" />
                      {fl.stats?.online_sensors || 0}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Megaphone className="w-4 h-4" /> Mass Building Announcement &amp; Siren
            </h2>
            <form onSubmit={handleBroadcast} className="space-y-3">
              <textarea
                rows={3}
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              />
              <label className="flex items-center justify-between p-3 rounded-xl bg-red-950/30 border border-red-500/30 cursor-pointer">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-200">
                  <Volume2 className="w-4 h-4 text-red-400" />
                  <span>Trigger Building-Wide Acoustic Evacuation Sirens</span>
                </div>
                <input
                  type="checkbox"
                  checked={triggerSirenFlag}
                  onChange={(e) => setTriggerSirenFlag(e.target.checked)}
                  className="w-4 h-4 accent-red-600"
                />
              </label>
              <button
                type="submit"
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-lg ${
                  triggerSirenFlag
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                {triggerSirenFlag
                  ? 'TRIGGER BUILDING-WIDE EVACUATION SIRENS'
                  : 'Broadcast Announcement to Residents'}
              </button>
            </form>
            {broadcastFeedback && (
              <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                {broadcastFeedback}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floor Blueprint Viewer with Drag-and-Drop Intro Packet Pairing */}
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

      {/* Tenant User-to-Apartment Mapping & Resident Onboarding */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              Bind Residents (Users) to Building Apartments — Floor {selectedFloor}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Assign registered users to their corresponding apartments so they can manage their own unit &amp; install devices in `/resident`.
            </p>
          </div>

          {/* Add New Apartment on this Floor */}
          <form onSubmit={handleCreateApartment} className="flex items-center gap-2">
            <input
              type="text"
              value={newAptName}
              onChange={(e) => setNewAptName(e.target.value)}
              placeholder={`New Apt (e.g. Apt ${selectedFloor}5)`}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
            >
              + {t('add_apartment')}
            </button>
          </form>
        </div>

        {/* Register a New Resident User Quickly */}
        <form
          onSubmit={handleRegisterResident}
          className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
        >
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">
              New Resident Name *
            </label>
            <input
              type="text"
              required
              value={newResidentName}
              onChange={(e) => setNewResidentName(e.target.value)}
              placeholder="e.g. Kamola Karimova"
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">
              Resident Email *
            </label>
            <input
              type="email"
              required
              value={newResidentEmail}
              onChange={(e) => setNewResidentEmail(e.target.value)}
              placeholder="kamola@gmail.com"
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">
              Phone Number
            </label>
            <input
              type="text"
              value={newResidentPhone}
              onChange={(e) => setNewResidentPhone(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
            />
          </div>
          <button
            type="submit"
            className="py-1.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" /> {t('add_user')}
          </button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allApartments
            .filter((apt) => apt.floor_number === selectedFloor)
            .map((apt) => (
              <div
                key={apt.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-white block">
                      {apt.room_number}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Floor {apt.floor_number} • Perimeter: {apt.perimeter_security_status}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-sky-400">
                    {apt.sensors?.length || 0} Sensors
                  </span>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Assigned Resident Owner:
                  </label>
                  <select
                    value={apt.owner_user_id || ''}
                    onChange={(e) =>
                      handleAssignResident(
                        apt.id,
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  >
                    <option value="">-- {t('unassigned')} --</option>
                    {allUsers
                      .filter((u) => u.role === 'user' || u.role === 'tenant')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ))}
        </div>
      </div>

      <TelemetryChart sensor={selectedSensor} />

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
