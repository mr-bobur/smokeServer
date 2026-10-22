'use client';

import React, { useMemo, useState } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Home,
  Thermometer,
  Wind,
  DoorOpen,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Lock,
  PlusCircle,
  Cpu,
  Radio,
  Battery,
  BatteryWarning,
  Signal,
  Clock,
  Sliders,
  X,
  Check,
  Building2,
  Layers,
  ShieldAlert,
  Bell,
  LayoutDashboard,
  Search,
  RefreshCw,
  Plus,
  AlertOctagon,
  ChevronRight,
  Eye,
  PhoneCall,
  History,
  FileText,
  Volume2
} from 'lucide-react';
import { useFloorData } from '../../../hooks/useFloorData';
import { BlueprintViewer } from '../../../components/map/BlueprintViewer';
import { SensorModal } from '../../../components/map/SensorModal';
import { TelemetryChart } from '../../../components/charts/TelemetryChart';
import { AlarmManagementSection } from '../../../components/common/AlarmManagementSection';
import {
  AlarmEventData,
  PerimeterSecurityStatus,
  SensorEndpointData,
  SensorType
} from '../../../types';
import { useAppSettings } from '../../../context/AppSettingsContext';

type ResidentMenuTab = 'home' | 'devices' | 'alarms';
type DevicesSubTab = 'list' | 'add';

const INTRO_PACKET_PRESETS = [
  {
    typeByte: '0x01',
    sensorType: 'SMOKE_MQ2' as SensorType,
    name: 'Optik Tutun Datchigi (MQ-2)',
    sampleHex: 'AA FF C38A9101 01 64 C4 9B 55',
    desc: 'Intro Byte 0x01 → MQ-2 Tutun datchigi sifatida avtomatik aniqlanadi'
  },
  {
    typeByte: '0x02',
    sensorType: 'TEMP_DS18B20' as SensorType,
    name: 'Raqamli Harorat Datchigi (DS18B20)',
    sampleHex: 'AA FF C38A9102 02 64 A2 1F 55',
    desc: 'Intro Byte 0x02 → DS18B20 Harorat datchigi sifatida avtomatik aniqlanadi'
  },
  {
    typeByte: '0x03',
    sensorType: 'DOOR_REED' as SensorType,
    name: 'Eshik/Deraza Germetik Datchigi (Reed)',
    sampleHex: 'AA FF C38A9103 03 64 7E 40 55',
    desc: 'Intro Byte 0x03 → Eshik/Deraza datchigi sifatida avtomatik aniqlanadi'
  },
  {
    typeByte: '0x04',
    sensorType: 'CO_MQ7' as SensorType,
    name: 'Is Gazi Datchigi (MQ-7 CO)',
    sampleHex: 'AA FF C38A9104 04 64 5B 88 55',
    desc: 'Intro Byte 0x04 → Is gazi (CO) datchigi sifatida avtomatik aniqlanadi'
  },
  {
    typeByte: '0x05',
    sensorType: 'GLASS_BREAK' as SensorType,
    name: 'Oyna Sinish Akustik Datchigi (Piezo)',
    sampleHex: 'AA FF C38A9105 05 64 39 D1 55',
    desc: 'Intro Byte 0x05 → Oyna sinish datchigi sifatida avtomatik aniqlanadi'
  }
];

export default function ResidentPortalPage() {
  const { t } = useAppSettings();
  const {
    currentFloor,
    rooms,
    sensors,
    alarms,
    refreshAlarms,
    updateAlarmStatus,
    activePairingSession,
    startDragDropPairing,
    cancelPairingSession,
    completePairingWithIntroPacket,
    saveSensorCoordinates,
    updateSensorConfig,
    calibrateSensor,
    setApartmentPerimeter,
    triggerTestAlarm
  } = useFloorData(4, 'user');

  // Left Menu Tab State
  const [activeTab, setActiveTab] = useState<ResidentMenuTab>('home');

  // Devices Sub-Tab & Filters
  const [devicesSubTab, setDevicesSubTab] = useState<DevicesSubTab>('list');
  const [deviceFilter, setDeviceFilter] = useState<string>('ALL');
  const [deviceSearch, setDeviceSearch] = useState<string>('');

  // Selected Sensor for modal inspection
  const [selectedSensor, setSelectedSensor] = useState<SensorEndpointData | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // New Device Pairing authorization options
  const [targetReceiver, setTargetReceiver] = useState<'FLOOR_HUB' | 'CENTRAL_GATEWAY'>('FLOOR_HUB');
  const [selectedIntroPreset, setSelectedIntroPreset] = useState(INTRO_PACKET_PRESETS[0]);
  const [customIntroHex, setCustomIntroHex] = useState<string>(INTRO_PACKET_PRESETS[0].sampleHex);
  const [pairingBusy, setPairingBusy] = useState<boolean>(false);

  // My Apartment (default Apt 42 on 4th floor)
  const myApartment = useMemo(() => {
    return rooms.find((r) => r.room_number === 'Apt 42') || rooms[1] || rooms[0];
  }, [rooms]);

  // Sensors in this apartment
  const mySensors = useMemo(() => {
    if (!myApartment) return sensors;
    return sensors.filter((s) => s.room_id === myApartment.id);
  }, [sensors, myApartment]);

  // Alarms associated with this apartment or floor
  const myAlarms = useMemo(() => {
    if (!myApartment) return alarms;
    return alarms.filter(
      (a) => a.room_number === myApartment.room_number || a.floor_number === 4
    );
  }, [alarms, myApartment]);

  // Count unhandled / new alarms
  const unreadAlarmsCount = useMemo(() => {
    return myAlarms.filter((a) => {
      const st =
        a.managed_status ||
        (a.status === 'resolved'
          ? 'managed_alarm'
          : a.status === 'acknowledged'
            ? 'seen_alarm'
            : 'new_alarm');
      return st === 'new_alarm';
    }).length;
  }, [myAlarms]);

  // Low battery devices
  const lowBatteryCount = useMemo(() => {
    return mySensors.filter((s) => s.battery_level !== undefined && s.battery_level <= 20).length;
  }, [mySensors]);

  // Key sensors for quick KPI display
  const smokeSensor = mySensors.find((s) => s.sensor_type === 'SMOKE_MQ2');
  const tempSensor = mySensors.find((s) => s.sensor_type === 'TEMP_DS18B20');
  const doorSensor = mySensors.find((s) => s.sensor_type === 'DOOR_REED');
  const glassSensor = mySensors.find((s) => s.sensor_type === 'GLASS_BREAK');
  const coSensor = mySensors.find((s) => s.sensor_type === 'CO_MQ7');

  const smokePpm = smokeSensor?.smoke_ppm ?? 45.2;
  const tempC = tempSensor?.temperature ?? 24.6;
  const isDoorOpen = Boolean(doorSensor?.reed_switch_open);
  const isGlassBroken = Boolean(glassSensor?.glass_break_detected);

  // Filtered devices list for the devices section
  const filteredSensors = useMemo(() => {
    return mySensors.filter((s) => {
      if (deviceFilter !== 'ALL' && s.sensor_type !== deviceFilter) return false;
      if (deviceSearch.trim()) {
        const q = deviceSearch.toLowerCase();
        const matchesChip = s.chip_id.toLowerCase().includes(q);
        const matchesType = s.sensor_type.toLowerCase().includes(q);
        return matchesChip || matchesType;
      }
      return true;
    });
  }, [mySensors, deviceFilter, deviceSearch]);

  const handlePerimeterChange = async (newMode: PerimeterSecurityStatus) => {
    if (!myApartment) return;
    await setApartmentPerimeter(myApartment.id, newMode);
    const modeLabel =
      newMode === 'armed_away'
        ? 'QO‘RIQLASH (UYDAN CHIQDIM)'
        : newMode === 'armed_home'
          ? 'QO‘RIQLASH (UYDAMAN)'
          : 'NOFAOL (OCHILGAN)';
    setStatusFeedback(
      `${myApartment.room_number}-xonadon perimetri xavfsizligi ${modeLabel} holatiga o‘tkazildi.`
    );
  };

  // Authorize MCU to start pairing mode
  const handleAuthorizeMcuPairing = async () => {
    setPairingBusy(true);
    try {
      await startDragDropPairing({
        building_id: myApartment?.building_id || 1,
        floor_id: currentFloor?.id,
        floor_number: 4,
        room_id: myApartment?.id,
        coord_x: 62.5,
        coord_y: 28.0,
        target_receiver_type: targetReceiver
      });
      setStatusFeedback(
        targetReceiver === 'FLOOR_HUB'
          ? `Etaj Sub-Hub MCU (${currentFloor?.hub_id || 'HUB-B1-FL04'}) da ulanish rejimiga ruxsat berildi. Datchikni yoqing.`
          : 'Markaziy Gatewayda to‘g‘ridan-to‘g‘ri ulanish rejimiga ruxsat berildi. Datchikni yoqing.'
      );
    } finally {
      setPairingBusy(false);
    }
  };

  // Complete pairing with selected intro packet
  const handleConfirmPairing = async () => {
    if (!activePairingSession) return;
    setPairingBusy(true);
    try {
      await completePairingWithIntroPacket({
        session_id: activePairingSession.session_id,
        intro_type_byte: selectedIntroPreset.typeByte,
        raw_intro_packet_hex: customIntroHex,
        building_id: myApartment?.building_id || 1,
        floor_number: 4,
        room_id: myApartment?.id
      });
      setStatusFeedback(
        `Yangi datchik (${selectedIntroPreset.name}) muvaffaqiyatli tanildi va xonadoningizga o‘rnatildi!`
      );
      setDevicesSubTab('list');
    } finally {
      setPairingBusy(false);
    }
  };

  // Cancel pairing mode on MCU
  const handleCancelMcuPairing = async () => {
    await cancelPairingSession();
    setStatusFeedback('MCU ulanish rejimi (Pairing mode) bekor qilindi.');
  };

  const currentPerimeter = myApartment?.perimeter_security_status || 'armed_home';

  const getSensorTypeMeta = (type: SensorType) => {
    switch (type) {
      case 'SMOKE_MQ2':
        return {
          name: 'Optik Tutun Datchigi (MQ-2)',
          shortName: 'Tutun',
          icon: Flame,
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/30'
        };
      case 'TEMP_DS18B20':
        return {
          name: 'Raqamli Harorat Datchigi (DS18B20)',
          shortName: 'Harorat',
          icon: Thermometer,
          color: 'text-sky-400 bg-sky-500/10 border-sky-500/30'
        };
      case 'DOOR_REED':
        return {
          name: 'Eshik/Deraza Germetik Datchigi (Reed)',
          shortName: 'Eshik',
          icon: DoorOpen,
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
        };
      case 'CO_MQ7':
        return {
          name: 'Is Gazi Datchigi (MQ-7 CO)',
          shortName: 'Is Gazi',
          icon: Wind,
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/30'
        };
      case 'GLASS_BREAK':
        return {
          name: 'Oyna Sinish Akustik Datchigi (Piezo)',
          shortName: 'Oyna Sinish',
          icon: ShieldAlert,
          color: 'text-purple-400 bg-purple-500/10 border-purple-500/30'
        };
      default:
        return {
          name: 'Standart Datchik',
          shortName: 'Sensor',
          icon: Radio,
          color: 'text-slate-400 bg-slate-800 border-slate-700'
        };
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* =====================================================================
          CHAP MENYU (LEFT SIDEBAR NAVIGATION FOR END USER / RESIDENT)
         ===================================================================== */}
      <aside className="w-full lg:w-72 shrink-0 rounded-2xl bg-slate-900/95 border border-slate-800 p-4 flex flex-col justify-between shadow-xl h-fit lg:sticky lg:top-20 space-y-5">
        <div className="space-y-4">
          {/* User Apartment Identity Card */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-md shadow-emerald-950">
                <Home className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider block">
                  Xonadon Portali
                </span>
                <span className="text-sm font-black text-white truncate block">
                  {myApartment?.room_number || 'Apt 42'} — Aziza R.
                </span>
                <span className="text-[11px] text-slate-400 truncate block">
                  Nest One • 4-qavat
                </span>
              </div>
            </div>

            {/* Perimeter status badge in sidebar */}
            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/80">
              <span className="text-slate-400">Perimetr holati:</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                  currentPerimeter === 'armed_away'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : currentPerimeter === 'armed_home'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                }`}
              >
                {currentPerimeter === 'armed_away'
                  ? 'ARM AWAY'
                  : currentPerimeter === 'armed_home'
                    ? 'ARM HOME'
                    : 'DISARMED'}
              </span>
            </div>
          </div>

          {/* 3 Main Menu Navigation Buttons */}
          <nav className="space-y-1.5">
            {/* 1. HOME MENU */}
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className={`w-full px-3.5 py-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                activeTab === 'home'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-1 ring-emerald-400'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <div className="text-xs font-bold leading-tight">1. Asosiy (Home)</div>
                  <div className="text-[10px] font-normal opacity-80 mt-0.5">
                    Plan, Perimetr &amp; Muhit
                  </div>
                </div>
              </div>
              <ChevronRight
                className={`w-4 h-4 transition-transform ${
                  activeTab === 'home' ? 'rotate-90 text-white' : 'text-slate-500'
                }`}
              />
            </button>

            {/* 2. DEVICES MENU */}
            <button
              type="button"
              onClick={() => setActiveTab('devices')}
              className={`w-full px-3.5 py-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                activeTab === 'devices'
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30 ring-1 ring-sky-400'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Cpu className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <div className="text-xs font-bold leading-tight">2. Qurilmalar (Devices)</div>
                  <div className="text-[10px] font-normal opacity-80 mt-0.5">
                    Reestr &amp; Yangi qo‘shish
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-black/30 font-mono text-[10px] font-bold">
                {mySensors.length} ta
              </span>
            </button>

            {/* 3. ALARM MENU */}
            <button
              type="button"
              onClick={() => setActiveTab('alarms')}
              className={`w-full px-3.5 py-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all relative ${
                activeTab === 'alarms'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 ring-1 ring-rose-400'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <div className="text-xs font-bold leading-tight">3. Alarmlar &amp; Xavfsizlik</div>
                  <div className="text-[10px] font-normal opacity-80 mt-0.5">
                    Ogohlantirish &amp; 112 FVV
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {unreadAlarmsCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                )}
                <span
                  className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                    unreadAlarmsCount > 0
                      ? 'bg-white text-rose-600'
                      : 'bg-black/30 text-slate-300'
                  }`}
                >
                  {myAlarms.length}
                </span>
              </div>
            </button>
          </nav>
        </div>

        {/* Quick System Health Widget at Sidebar Bottom */}
        <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span className="flex items-center gap-1.5 font-bold">
              <Layers className="w-3.5 h-3.5 text-sky-400" /> Etaj Sub-Hub
            </span>
            <span className="font-mono text-emerald-400 font-bold">ONLINE</span>
          </div>

          <div className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800/60 flex items-center justify-between">
            <span>{currentFloor?.hub_id || 'HUB-B1-FL04'}</span>
            <span className="text-sky-400">RS485 DIP: 04</span>
          </div>

          {lowBatteryCount > 0 ? (
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] flex items-center gap-1.5">
              <BatteryWarning className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>{lowBatteryCount} ta datchikda quvvat kam!</span>
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] flex items-center gap-1.5">
              <Battery className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span>Barcha batareyalar me’yorda</span>
            </div>
          )}

          <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <PhoneCall className="w-3 h-3 text-rose-400" /> 112 FVV Dispetcher
            </span>
            <span className="text-emerald-400 font-bold">Faol</span>
          </div>
        </div>
      </aside>

      {/* =====================================================================
          ASOSIY KONTENT SOHASI (MAIN CONTENT AREA)
         ===================================================================== */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Mobile Horizontal Menu Switcher (< lg screens) */}
        <div className="lg:hidden p-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
              activeTab === 'home'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Home</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('devices')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
              activeTab === 'devices'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Qurilmalar ({mySensors.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('alarms')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition relative ${
              activeTab === 'alarms'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Alarmlar ({myAlarms.length})</span>
            {unreadAlarmsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping ml-1" />
            )}
          </button>
        </div>

        {/* Global Feedback Banner */}
        {statusFeedback && (
          <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{statusFeedback}</span>
            </div>
            <button
              onClick={() => setStatusFeedback(null)}
              className="text-emerald-400/80 hover:text-emerald-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* =====================================================================
            1-BO'LIM: HOME — ASOSIY NARSALAR (UY PLANI, PERIMETR, MUHIT & JONLI GRAFIK)
           ===================================================================== */}
        {activeTab === 'home' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header: Overview Banner */}
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
                  <Home className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-black text-white">
                      {myApartment?.room_number || 'Apt 42'} — Mening Xonadonim
                    </h1>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold">
                      4-qavat • Aziza Rustamova
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-800 text-sky-400 border border-slate-700">
                      {mySensors.length} ta Datchik
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Nest One Residence - Block B • Toshkent</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-semibold">Tizim: Barcha datchiklar aloqada</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    triggerTestAlarm({
                      chip_id: smokeSensor?.chip_id || 'C3-9A4F22B8',
                      event_type: 'SMOKE_CRITICAL',
                      severity: 'critical',
                      smoke_val: 680.5,
                      temp_val: 62.4
                    })
                  }
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-red-600/30"
                >
                  <Flame className="w-4 h-4" /> {t('simulate_alarm')}
                </button>
              </div>
            </div>

            {/* Xonadon Perimetri Xavfsizlik Rejimi */}
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-sky-400" />
                    Xonadon Perimetri Xavfsizlik Rejimi
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {myApartment?.room_number || 'Apt 42'} xonadonidagi Eshik va Oyna datchiklarini boshqarish.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-sky-400 font-bold">
                  HOLAT: {currentPerimeter === 'armed_away' ? 'ARM AWAY (Qo‘riqda)' : currentPerimeter === 'armed_home' ? 'ARM HOME (Uydaman)' : 'DISARMED (O‘chiq)'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => handlePerimeterChange('armed_away')}
                  className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between space-y-3 ${
                    currentPerimeter === 'armed_away'
                      ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.2)]'
                      : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Shield className="w-6 h-6 text-amber-400" />
                    {currentPerimeter === 'armed_away' && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
                        FAOL REJIM
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">{t('arm_away')}</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      To‘liq qo‘riqlash. Eshik yoki deraza ochilishi bilan darhol signalizatsiya ishga tushadi.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handlePerimeterChange('armed_home')}
                  className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between space-y-3 ${
                    currentPerimeter === 'armed_home'
                      ? 'bg-emerald-500/20 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.2)]'
                      : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <ShieldCheck className="w-6 h-6 text-emerald-400" />
                    {currentPerimeter === 'armed_home' && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black">
                        FAOL REJIM
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">{t('arm_home')}</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Tungi / Uyda rejimi. Tashqi eshik va deraza datchiklari qo‘riqlashda.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handlePerimeterChange('disarmed')}
                  className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between space-y-3 ${
                    currentPerimeter === 'disarmed'
                      ? 'bg-sky-500/20 border-sky-400 shadow-[0_0_25px_rgba(56,189,248,0.2)]'
                      : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <ShieldOff className="w-6 h-6 text-slate-300" />
                    {currentPerimeter === 'disarmed' && (
                      <span className="px-2 py-0.5 rounded-full bg-sky-400 text-slate-950 text-[10px] font-black">
                        FAOL REJIM
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">{t('disarm')}</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Eshik/deraza qo‘riqdan olingan. Tutun datchigi (SMOKE) esa 24/7 doimiy faol qoladi.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Environmental Live KPI Metric Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5 shadow-md">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-orange-400" /> {t('type_SMOKE_MQ2')}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {smokeSensor?.chip_id || 'C3-9A4F22B8'}
                  </span>
                </div>
                <div className="text-2xl font-black text-white font-mono">{smokePpm} PPM</div>
                <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Xavfsiz konsentratsiya (&lt;400 PPM)
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5 shadow-md">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Thermometer className="w-4 h-4 text-rose-400" /> {t('type_TEMP_DS18B20')}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {tempSensor?.chip_id || 'C3-TEMP'}
                  </span>
                </div>
                <div className="text-2xl font-black text-white font-mono">{tempC} °C</div>
                <div className="text-[11px] text-sky-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Qulay harorat normasi
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5 shadow-md">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <DoorOpen className="w-4 h-4 text-sky-400" /> {t('type_DOOR_REED')}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {doorSensor?.chip_id || 'C3-DOOR'}
                  </span>
                </div>
                <div
                  className={`text-2xl font-black font-mono flex items-center gap-2 ${
                    isDoorOpen ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {isDoorOpen ? 'OCHIQ' : 'YOPIQ'}
                </div>
                <div className="text-[11px] text-slate-400">
                  {isDoorOpen ? '⚠️ Kirish eshigi ochiq' : '✓ Kirish eshigi qulflangan'}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5 shadow-md">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Wind className="w-4 h-4 text-amber-400" /> {t('type_GLASS_BREAK')} / CO
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {glassSensor?.chip_id || coSensor?.chip_id || 'C3-GLS'}
                  </span>
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  {isGlassBroken ? 'SINISH!' : 'XAVFSIZ'}
                </div>
                <div className="text-[11px] text-emerald-400">
                  {isGlassBroken ? '⚠️ Oyna sinishi aniqlandi' : '✓ Oynalar butun, CO 0 PPM'}
                </div>
              </div>
            </div>

            {/* Uy Plani (Digital Twin Blueprint Viewer) */}
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Layers className="w-5 h-5 text-amber-400" />
                      Mening Xonadonim Uy Plani va Qurilmalar Joylashuvi (Digital Twin)
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Xonadoningiz xonalaridagi barcha datchiklarning aniq joylashuvi (Oshxona, Mehmonxona, Yo‘lak, Kirish eshigi). Datchik belgisiga bosib jonli telemetriyasini ko‘rishingiz mumkin.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-amber-400">
                    Qavat: 4 • {myApartment?.room_number || 'Apt 42'}
                  </span>
                </div>
              </div>

              {/* Blueprint Viewer showing apartment rooms and sensor pins */}
              <BlueprintViewer
                floor={currentFloor}
                rooms={rooms}
                sensors={sensors}
                selectedSensor={selectedSensor}
                onSelectSensor={(s) => setSelectedSensor(s)}
                allowDragSensors={true}
                onSaveSensorCoords={saveSensorCoordinates}
                filterRoomId={myApartment?.id}
                activePairingSession={activePairingSession}
                onStartDragDropPairing={(p) =>
                  startDragDropPairing({
                    building_id: myApartment?.building_id || 1,
                    floor_id: currentFloor?.id,
                    floor_number: 4,
                    room_id: myApartment?.id,
                    coord_x: p.coord_x,
                    coord_y: p.coord_y,
                    target_receiver_type: targetReceiver
                  })
                }
                onCompleteIntroPacketPairing={completePairingWithIntroPacket}
                onCancelPairing={handleCancelMcuPairing}
              />

              {/* Telemetry Chart for selected sensor */}
              <TelemetryChart sensor={selectedSensor || smokeSensor || mySensors[0]} />
            </div>
          </div>
        )}

        {/* =====================================================================
            2-BO'LIM: QURILMALAR — BARCHA QURILMALAR VA YANGISINI QO'SHISH
           ===================================================================== */}
        {activeTab === 'devices' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top Sub-Navigation Bar for Devices */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-sky-500/15 border border-sky-500/40 flex items-center justify-center shrink-0">
                  <Cpu className="w-6 h-6 text-sky-400" />
                </div>
                <div>
                  <h1 className="text-lg font-black text-white">
                    Qurilmalar Boshqaruvi va Reestri
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {myApartment?.room_number || 'Apt 42'} xonadoniga o‘rnatilgan datchiklar va yangi qurilma ulash
                  </p>
                </div>
              </div>

              {/* Sub-tabs buttons */}
              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setDevicesSubTab('list')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                    devicesSubTab === 'list'
                      ? 'bg-sky-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Qurilmalar Ro‘yxati ({mySensors.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDevicesSubTab('add')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                    devicesSubTab === 'add'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Yangi Qurilma Qo‘shish</span>
                </button>
              </div>
            </div>

            {/* Sub-Tab 1: List of all devices */}
            {devicesSubTab === 'list' && (
              <div className="space-y-4">
                {/* Search & Filter Bar */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="relative flex-1 min-w-[240px] max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Chip ID yoki datchik turi bo‘yicha qidirish..."
                      value={deviceSearch}
                      onChange={(e) => setDeviceSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { key: 'ALL', label: 'Barchasi' },
                      { key: 'SMOKE_MQ2', label: 'Tutun' },
                      { key: 'TEMP_DS18B20', label: 'Harorat' },
                      { key: 'DOOR_REED', label: 'Eshik' },
                      { key: 'CO_MQ7', label: 'Is gazi (CO)' },
                      { key: 'GLASS_BREAK', label: 'Oyna sinishi' }
                    ].map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setDeviceFilter(f.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          deviceFilter === f.key
                            ? 'bg-sky-600 text-white shadow'
                            : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Devices Grid Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSensors.length === 0 ? (
                    <div className="col-span-full p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                      <Cpu className="w-10 h-10 text-slate-500 mx-auto" />
                      <div className="text-sm font-bold text-white">Qurilmalar topilmadi</div>
                      <p className="text-xs text-slate-400">
                        Qidiruv mezonini o‘zgartiring yoki yangi datchik qo‘shing.
                      </p>
                    </div>
                  ) : (
                    filteredSensors.map((s) => {
                      const meta = getSensorTypeMeta(s.sensor_type);
                      const Icon = meta.icon;
                      const isLowBat =
                        (s.battery_level !== undefined && s.battery_level <= 20) ||
                        s.status === 'warning';
                      const isAlarm = s.status === 'alarm';
                      const isOffline = s.status === 'offline';

                      let batColor = 'bg-emerald-500';
                      if (s.battery_level <= 20) batColor = 'bg-rose-500';
                      else if (s.battery_level <= 45) batColor = 'bg-amber-500';

                      return (
                        <div
                          key={s.id}
                          onClick={() => setSelectedSensor(s)}
                          className={`p-4 rounded-2xl border transition space-y-3 cursor-pointer ${
                            selectedSensor?.id === s.id
                              ? 'bg-sky-500/10 border-sky-400 shadow-lg shadow-sky-500/10'
                              : isAlarm
                                ? 'bg-rose-950/30 border-rose-500/60'
                                : isLowBat
                                  ? 'bg-amber-950/20 border-amber-500/40'
                                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {/* Device Title & Status Badge */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${meta.color}`}
                              >
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-white block truncate">
                                  {meta.name}
                                </span>
                                <span className="text-[11px] font-mono text-slate-400 block truncate">
                                  Chip ID: <strong className="text-sky-400">{s.chip_id}</strong>
                                </span>
                              </div>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border shrink-0 ${
                                isAlarm
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse'
                                  : isLowBat
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                    : isOffline
                                      ? 'bg-slate-800 text-slate-400 border-slate-700'
                                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              }`}
                            >
                              {isAlarm
                                ? 'YONG‘IN'
                                : isLowBat
                                  ? 'BATAREYKA KAM'
                                  : isOffline
                                    ? 'ALOQASIZ'
                                    : 'ONLINE'}
                            </span>
                          </div>

                          {/* Battery Status Bar */}
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400 flex items-center gap-1.5">
                                {isLowBat ? (
                                  <BatteryWarning className="w-4 h-4 text-amber-400" />
                                ) : (
                                  <Battery className="w-4 h-4 text-emerald-400" />
                                )}
                                Batareyka zaryadi:
                              </span>
                              <span
                                className={`font-mono font-bold ${
                                  isLowBat ? 'text-amber-400' : 'text-emerald-400'
                                }`}
                              >
                                {s.battery_level}%{' '}
                                {isLowBat && (
                                  <span className="text-[10px] font-sans font-bold text-rose-400">
                                    (KAM!)
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${batColor}`}
                                style={{ width: `${Math.max(5, s.battery_level)}%` }}
                              />
                            </div>
                            {isLowBat && (
                              <p className="text-[10px] text-amber-400/90 font-medium">
                                ⚠️ Batareyka kam. CR123A/LiPo batareyani yangilang.
                              </p>
                            )}
                          </div>

                          {/* Live Telemetry Value & Connection Info */}
                          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                            <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                              <span className="text-[10px] text-slate-500 block uppercase font-sans">
                                Jonli Qiymat
                              </span>
                              <span className="text-sm font-bold text-white">
                                {s.sensor_type === 'SMOKE_MQ2' && `${s.smoke_ppm} PPM`}
                                {s.sensor_type === 'TEMP_DS18B20' && `${s.temperature} °C`}
                                {s.sensor_type === 'DOOR_REED' &&
                                  (s.reed_switch_open ? 'OCHIQ' : 'YOPIQ')}
                                {s.sensor_type === 'CO_MQ7' && `${s.co_ppm} PPM`}
                                {s.sensor_type === 'GLASS_BREAK' &&
                                  (s.glass_break_detected ? 'SINISH!' : 'BUTUN')}
                              </span>
                            </div>

                            <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                              <span className="text-[10px] text-slate-500 block uppercase font-sans">
                                Signal &amp; Qabul qiluvchi
                              </span>
                              <span className="text-xs text-sky-400 font-bold block truncate">
                                {s.rssi_dbm} dBm
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                {s.parent_node_id}
                              </span>
                            </div>
                          </div>

                          {/* Inspect Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSensor(s);
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                          >
                            <Sliders className="w-3.5 h-3.5 text-sky-400" />
                            <span>Parametrlar va Telemetriya (Inspect)</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Sub-Tab 2: Add New Device Wizard */}
            {devicesSubTab === 'add' && (
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <Radio className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        Yangi Qurilma Qo‘shish &amp; MCU Ulanishiga Ruxsat Berish
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Yangi datchikni xonadoningizga ulash uchun markaziy Gateway yoki etaj Sub-Hub MCU siga ulanishga ruxsat bering (Pairing Mode).
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-mono font-bold uppercase border ${
                      activePairingSession
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 animate-pulse'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    {activePairingSession ? '🟢 ULANISH REJIMI YOQILGAN' : 'KUTILMOQDA (STANDBY)'}
                  </span>
                </div>

                {/* Step 1: Select Target Receiver (Floor Sub-Hub or Central Gateway) */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                    1. Yangi datchik qabul qiluvchi MCU apparatini tanlang:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={Boolean(activePairingSession)}
                      onClick={() => setTargetReceiver('FLOOR_HUB')}
                      className={`p-4 rounded-xl border text-left transition flex items-start gap-3 ${
                        targetReceiver === 'FLOOR_HUB'
                          ? 'bg-sky-500/15 border-sky-400 text-white shadow-md shadow-sky-500/10'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      } ${activePairingSession ? 'opacity-80 cursor-not-allowed' : ''}`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0">
                        <Layers className="w-5 h-5 text-sky-400" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">
                          Etaj Hubi MCU (RS485 + BLE Sub-Hub)
                        </div>
                        <div className="text-[11px] text-sky-300 font-mono mt-0.5">
                          {currentFloor?.hub_id || 'HUB-B1-FL04'} (DIP 00000100)
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Xonadon datchiklaridan paketlarni BLE 5.0 orqali qabul qilib, markazga RS485 magistrali orqali uzatadi.
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(activePairingSession)}
                      onClick={() => setTargetReceiver('CENTRAL_GATEWAY')}
                      className={`p-4 rounded-xl border text-left transition flex items-start gap-3 ${
                        targetReceiver === 'CENTRAL_GATEWAY'
                          ? 'bg-amber-500/15 border-amber-400 text-white shadow-md shadow-amber-500/10'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      } ${activePairingSession ? 'opacity-80 cursor-not-allowed' : ''}`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                        <Radio className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">
                          Markaziy Gateway MCU (SIM7670 / SIM800 4G LTE)
                        </div>
                        <div className="text-[11px] text-amber-300 font-mono mt-0.5">
                          GW-LILYGO-TCALL-SIM800
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Bino bo‘ylab markaziy 4G/LTE shlyuzi orqali to‘g‘ridan-to‘g‘ri ulanish rejimi.
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Step 2: Grant Permission / Authorize Pairing Mode */}
                {!activePairingSession ? (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-white block">
                        2. MCUga Ulanishga Ruxsat Berish:
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Tugmani bosganingizda tanlangan{' '}
                        {targetReceiver === 'FLOOR_HUB' ? 'Etaj Sub-Hub' : 'Markaziy Gateway'} MCU 120
                        soniyaga ulanish rejimiga o‘tadi (Pairing Mode).
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={pairingBusy}
                      onClick={handleAuthorizeMcuPairing}
                      className="py-2.5 px-5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-sky-600/30 transition shrink-0"
                    >
                      <Radio className="w-4 h-4 animate-pulse" />
                      <span>
                        {pairingBusy
                          ? 'MCU Rejimi Yoqilmoqda...'
                          : `${targetReceiver === 'FLOOR_HUB' ? 'Etaj Hubi MCU' : 'Gateway'}ga Ulanishga Ruxsat Berish`}
                      </span>
                    </button>
                  </div>
                ) : (
                  /* Step 3: Active Pairing Session UI with Incoming Handshake Auto-Detection */
                  <div className="p-5 rounded-2xl bg-sky-950/40 border-2 border-sky-500 shadow-[0_0_40px_rgba(14,165,233,0.3)] space-y-4 animate-in fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-500/30 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400 flex items-center justify-center">
                          <Radio className="w-5 h-5 text-sky-400 animate-pulse" />
                        </div>
                        <div>
                          <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono text-[10px] font-bold">
                            QABUL QILUVCHI: {activePairingSession.target_receiver_id} (
                            {activePairingSession.target_receiver_type})
                          </span>
                          <h4 className="text-sm font-black text-white mt-0.5">
                            MCU YANGI QURILMANI KUTMOQDA (PAIRING ACTIVE)
                          </h4>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleCancelMcuPairing}
                        className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Ruxsatni Bekor Qilish</span>
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      Datchikdagi <strong>BOOT / SETUP</strong> tugmasini 3 soniya bosib turing yoki
                      batareyasini joylashtiring. Hub kirish tanishtiruv paketini (Intro Packet)
                      qabul qilgach, datchik turi avtomatik aniqlanadi.
                    </p>

                    {/* Presets Selector for simulation / intro packet testing */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 block">
                        Kiruvchi Tanishtiruv Paketi (Intro Handshake Packet):
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {INTRO_PACKET_PRESETS.map((preset) => {
                          const isSel = selectedIntroPreset.typeByte === preset.typeByte;
                          return (
                            <button
                              key={preset.typeByte}
                              type="button"
                              onClick={() => {
                                setSelectedIntroPreset(preset);
                                setCustomIntroHex(preset.sampleHex);
                              }}
                              className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                                isSel
                                  ? 'bg-sky-500/20 border-sky-400 text-white shadow-sm'
                                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <div>
                                <div className="text-xs font-bold flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-900 font-mono text-sky-400 text-[10px]">
                                    {preset.typeByte}
                                  </span>
                                  <span>{preset.name}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {preset.desc}
                                </div>
                              </div>
                              <span className="text-[10px] font-mono text-emerald-400 hidden sm:inline">
                                {preset.sampleHex.slice(0, 14)}...
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="text-xs font-mono text-slate-400">
                        Obyekt: <strong className="text-white">{myApartment?.room_number}</strong>{' '}
                        (4-qavat)
                      </div>

                      <button
                        type="button"
                        disabled={pairingBusy}
                        onClick={handleConfirmPairing}
                        className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition"
                      >
                        <Check className="w-4 h-4" />
                        <span>
                          {pairingBusy
                            ? 'Ulanmoqda...'
                            : 'Tanishtiruv Paketini Qabul Qilish va O‘rnatish'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            3-BO'LIM: ALARM — ALARMLAR VA OGOHLANTIRISH FUNKSIYALARI
           ===================================================================== */}
        {activeTab === 'alarms' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top 112 Dispatch & Emergency Protection Overview Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/30 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-6 h-6 text-rose-400 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-lg font-black text-white">
                        Xonadon Xavfsizlik va Alarmlar Markazi
                      </h1>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        112 FVV INTEGRATSIYASI FAOL
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      Yong‘in, tutun, harorat keskin ko‘tarilishi yoki perimetr buzilishida 60 soniyali avtomatlashtirilgan eskalatsiya ishga tushadi. Agar soxta signal deb bekor qilinmasa, SIM7670 4G moduli orqali O‘zbekiston 112 FVV markaziga zudlik bilan koordinatalar uzatiladi.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      triggerTestAlarm({
                        chip_id: smokeSensor?.chip_id || 'C3-9A4F22B8',
                        event_type: 'SMOKE_CRITICAL',
                        severity: 'critical',
                        smoke_val: 680.5,
                        temp_val: 62.4
                      })
                    }
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-rose-600/30"
                  >
                    <Flame className="w-4 h-4" /> Test Signalini Berish
                  </button>
                </div>
              </div>

              {/* Safety Quick Tips */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs border-t border-slate-800">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">60 Soniyali Qoida</span>
                    <span className="text-[11px] text-slate-400">
                      Tutun datchigi signal bergan zahoti 60s vaqt ichida ko‘rib chiqish imkoni beriladi.
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
                  <Volume2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">Binodagi Ovozli Sirena</span>
                    <span className="text-[11px] text-slate-400">
                      Haqiqiy xavfda barcha etajlardagi sub-hublar va sirenalar ovoz chiqaradi.
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
                  <PhoneCall className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">To‘g‘ridan-to‘g‘ri FVV 112</span>
                    <span className="text-[11px] text-slate-400">
                      Toshkent shahar FVV dispetcherlik tizimiga GPS va xonadon raqami uzatiladi.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Comprehensive Alarm Management Section (Filtered to resident) */}
            <AlarmManagementSection
              alarms={myAlarms}
              selectedBuildingId={1}
              onUpdateAlarmStatus={updateAlarmStatus}
              onTriggerTestAlarm={triggerTestAlarm}
              onRefreshAlarms={refreshAlarms}
              userRole="user"
            />
          </div>
        )}
      </div>

      {/* Sensor Modal for Deep Inspection */}
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
