'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
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
  Volume2,
  Settings,
  User,
  Sun,
  Moon,
  Globe,
  MapPin,
  ChevronDown,
  Info,
  LogOut
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
import { LanguageCode, useAppSettings } from '../../../context/AppSettingsContext';

type ResidentMenuTab = 'home' | 'devices' | 'alarms' | 'system';
type DevicesSubTab = 'list' | 'add';
type HomeViewMode = 'rooms' | 'map';

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
  const { lang, setLang, theme, toggleTheme, t } = useAppSettings();
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

  // Active Tab: 'home' | 'devices' | 'alarms' | 'system'
  const [activeTab, setActiveTab] = useState<ResidentMenuTab>('home');

  // Home View Mode (Rooms List vs Architectural Blueprint Map)
  const [homeViewMode, setHomeViewMode] = useState<HomeViewMode>('rooms');

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

  // Emergency safety accordion open/close
  const [safetyGuideOpen, setSafetyGuideOpen] = useState<boolean>(false);

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
      `${myApartment.room_number}-xonadon perimetri ${modeLabel} holatiga o‘tkazildi.`
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
          ? `Etaj Sub-Hub MCU (${currentFloor?.hub_id || 'HUB-B1-FL04'}) da ulanish rejimi yoqildi. Datchikni yoqing.`
          : 'Markaziy Gatewayda to‘g‘ridan-to‘g‘ri ulanish rejimi yoqildi. Datchikni yoqing.'
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
        `Yangi datchik (${selectedIntroPreset.name}) muvaffaqiyatli tanildi va o‘rnatildi!`
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
          zone: 'Oshxona (Kitchen)',
          icon: Flame,
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/30'
        };
      case 'TEMP_DS18B20':
        return {
          name: 'Harorat Datchigi (DS18B20)',
          shortName: 'Harorat',
          zone: 'Mehmonxona (Living Room)',
          icon: Thermometer,
          color: 'text-sky-400 bg-sky-500/10 border-sky-500/30'
        };
      case 'DOOR_REED':
        return {
          name: 'Eshik Datchigi (Reed)',
          shortName: 'Eshik',
          zone: 'Kirish Eshigi (Front Door)',
          icon: DoorOpen,
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
        };
      case 'CO_MQ7':
        return {
          name: 'Is Gazi Datchigi (MQ-7 CO)',
          shortName: 'Is Gazi',
          zone: 'Qozonxona / Oshxona (Boiler)',
          icon: Wind,
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/30'
        };
      case 'GLASS_BREAK':
        return {
          name: 'Oyna Sinish Datchigi (Piezo)',
          shortName: 'Oyna Sinish',
          zone: 'Balkon / Deraza (Window)',
          icon: ShieldAlert,
          color: 'text-purple-400 bg-purple-500/10 border-purple-500/30'
        };
      default:
        return {
          name: 'Sensor',
          shortName: 'Sensor',
          zone: 'Umumiy hudud',
          icon: Radio,
          color: 'text-slate-400 bg-slate-800 border-slate-700'
        };
    }
  };

  const languages: Array<{ code: LanguageCode; label: string }> = [
    { code: 'uz', label: 'O‘zbekcha' },
    { code: 'en', label: 'English' },
    { code: 'ru', label: 'Русский' }
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 pb-28 lg:pb-6">
      {/* =====================================================================
          1. MOBIL TELEFON UCHUN YUQORI QISQA HEADER (MOBILE TOP BAR - lg:hidden)
         ===================================================================== */}
      <div className="lg:hidden -mt-1 space-y-2">
        <div className="p-3 rounded-2xl bg-slate-900/95 border border-slate-800 flex items-center justify-between gap-2 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-white truncate">
                  {myApartment?.room_number || 'Apt 42'}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              </div>
              <span className="text-[11px] text-slate-400 truncate block">
                4-qavat • Aziza Rustamova
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick perimeter mode badge */}
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase border transition active:scale-95 ${
                currentPerimeter === 'armed_away'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : currentPerimeter === 'armed_home'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm'
              }`}
            >
              {currentPerimeter === 'armed_away'
                ? 'ARM AWAY'
                : currentPerimeter === 'armed_home'
                  ? 'ARM HOME'
                  : 'DISARMED'}
            </button>

            {/* Quick SOS Simulate / Test Alarm button */}
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
              title="Test signalini berish"
              className="w-8 h-8 rounded-lg bg-rose-600/30 text-rose-400 border border-rose-500/40 flex items-center justify-center active:scale-95 transition"
            >
              <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
            </button>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {statusFeedback && (
          <div className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center justify-between gap-2 shadow-md animate-in fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="truncate">{statusFeedback}</span>
            </div>
            <button
              onClick={() => setStatusFeedback(null)}
              className="text-emerald-400/80 hover:text-emerald-200 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* =====================================================================
          2. DESKTOP UCHUN CHAP MENYU (DESKTOP SIDEBAR - hidden lg:flex)
         ===================================================================== */}
      <aside className="hidden lg:flex lg:w-72 shrink-0 rounded-2xl bg-slate-900/95 border border-slate-800 p-4 flex-col justify-between shadow-xl h-fit lg:sticky lg:top-20 space-y-5">
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

          {/* Main Desktop Menu Buttons */}
          <nav className="space-y-1.5">
            {/* 1. HOME */}
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

            {/* 2. DEVICES */}
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

            {/* 3. ALARMS */}
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

            {/* 4. SYSTEM & PROFILE */}
            <button
              type="button"
              onClick={() => setActiveTab('system')}
              className={`w-full px-3.5 py-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                activeTab === 'system'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-1 ring-purple-400'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <div className="text-xs font-bold leading-tight">4. Tizim &amp; Profil</div>
                  <div className="text-[10px] font-normal opacity-80 mt-0.5">
                    Sub-Hub, Til &amp; Mavzu
                  </div>
                </div>
              </div>
            </button>
          </nav>
        </div>

        {/* Quick System Health Widget at Desktop Sidebar Bottom */}
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
          3. ASOSIY KONTENT SOHASI (RESPONSIVE CONTENT AREA)
         ===================================================================== */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* ===================================================================
            TAB 1: HOME — ASOSIY BOSHQARUV (XONADON HOLATI, PERIMETR, MUHIT)
           =================================================================== */}
        {activeTab === 'home' && (
          <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-150">
            {/* Desktop Overview Banner (lg:block) */}
            <div className="hidden lg:flex p-5 rounded-2xl bg-slate-900/90 border border-slate-800 items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
                  <Home className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-black text-white">
                      {myApartment?.room_number || 'Apt 42'} — Mening Xonadonim
                    </h1>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold">
                      4-qavat • Aziza Rustamova
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Nest One Residence - Block B • Tizim: Barcha {mySensors.length} ta datchik aloqada
                  </p>
                </div>
              </div>

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
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-red-600/30"
              >
                <Flame className="w-4 h-4" /> {t('simulate_alarm')}
              </button>
            </div>

            {/* Xonadon Perimetri Xavfsizlik Rejimi (Mobile Tactile 3-Cards / Segmented Controls) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-sky-400" />
                    Perimetr Xavfsizlik Rejimi
                  </h2>
                  <span className="text-[11px] text-slate-400 block sm:hidden">
                    Eshik va datchiklar holati
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] sm:text-xs font-mono text-sky-400 font-bold">
                  {currentPerimeter === 'armed_away'
                    ? 'ARM AWAY'
                    : currentPerimeter === 'armed_home'
                      ? 'ARM HOME'
                      : 'DISARMED'}
                </span>
              </div>

              {/* 3 Touch-Friendly Tactile Cards */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {/* 1. ARM AWAY */}
                <button
                  type="button"
                  onClick={() => handlePerimeterChange('armed_away')}
                  className={`p-3 sm:p-4 rounded-xl border-2 text-left transition-all active:scale-95 flex flex-col justify-between min-h-[90px] sm:min-h-[110px] ${
                    currentPerimeter === 'armed_away'
                      ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/50'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <Shield className="w-5 h-5 text-amber-400" />
                    {currentPerimeter === 'armed_away' && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-white leading-tight">
                      Uydan Chiqdim
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5 hidden sm:block">
                      Eshik/deraza to‘liq qo‘riqda
                    </p>
                    <span className="text-[9px] font-mono font-bold text-amber-400 uppercase sm:hidden block mt-0.5">
                      ARM AWAY
                    </span>
                  </div>
                </button>

                {/* 2. ARM HOME */}
                <button
                  type="button"
                  onClick={() => handlePerimeterChange('armed_home')}
                  className={`p-3 sm:p-4 rounded-xl border-2 text-left transition-all active:scale-95 flex flex-col justify-between min-h-[90px] sm:min-h-[110px] ${
                    currentPerimeter === 'armed_home'
                      ? 'bg-emerald-500/20 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)] ring-1 ring-emerald-400/50'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    {currentPerimeter === 'armed_home' && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-white leading-tight">
                      Uydaman / Tun
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5 hidden sm:block">
                      Tashqi perimetr qo‘riqda
                    </p>
                    <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase sm:hidden block mt-0.5">
                      ARM HOME
                    </span>
                  </div>
                </button>

                {/* 3. DISARM */}
                <button
                  type="button"
                  onClick={() => handlePerimeterChange('disarmed')}
                  className={`p-3 sm:p-4 rounded-xl border-2 text-left transition-all active:scale-95 flex flex-col justify-between min-h-[90px] sm:min-h-[110px] ${
                    currentPerimeter === 'disarmed'
                      ? 'bg-sky-500/20 border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.25)] ring-1 ring-sky-400/50'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <ShieldOff className="w-5 h-5 text-slate-300" />
                    {currentPerimeter === 'disarmed' && (
                      <span className="w-2 h-2 rounded-full bg-sky-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-white leading-tight">
                      Ochiq / Erkin
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5 hidden sm:block">
                      Tutun 24/7 faol qoladi
                    </p>
                    <span className="text-[9px] font-mono font-bold text-sky-400 uppercase sm:hidden block mt-0.5">
                      DISARM
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Environmental Live KPI Metric Badges (2x2 Touch Grid on Mobile) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              {/* Tutun MQ-2 */}
              <div
                onClick={() => smokeSensor && setSelectedSensor(smokeSensor)}
                className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1 shadow cursor-pointer active:scale-95 transition"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 font-bold text-orange-400">
                    <Flame className="w-3.5 h-3.5" /> Tutun
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 hidden sm:inline">
                    MQ-2
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-white font-mono leading-tight">
                  {smokePpm} <span className="text-xs font-normal text-slate-400">PPM</span>
                </div>
                <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium truncate">
                  <CheckCircle2 className="w-3 h-3 shrink-0" /> Xavfsiz (&lt;400)
                </div>
              </div>

              {/* Harorat DS18B20 */}
              <div
                onClick={() => tempSensor && setSelectedSensor(tempSensor)}
                className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1 shadow cursor-pointer active:scale-95 transition"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 font-bold text-rose-400">
                    <Thermometer className="w-3.5 h-3.5" /> Harorat
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 hidden sm:inline">
                    DS18B20
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-white font-mono leading-tight">
                  {tempC} <span className="text-xs font-normal text-slate-400">°C</span>
                </div>
                <div className="text-[10px] text-sky-400 flex items-center gap-1 font-medium truncate">
                  <CheckCircle2 className="w-3 h-3 shrink-0" /> Qulay norma
                </div>
              </div>

              {/* Kirish Eshigi Reed */}
              <div
                onClick={() => doorSensor && setSelectedSensor(doorSensor)}
                className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1 shadow cursor-pointer active:scale-95 transition"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 font-bold text-sky-400">
                    <DoorOpen className="w-3.5 h-3.5" /> Kirish Eshigi
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 hidden sm:inline">
                    Reed
                  </span>
                </div>
                <div
                  className={`text-xl sm:text-2xl font-black font-mono leading-tight ${
                    isDoorOpen ? 'text-red-400 animate-pulse' : 'text-emerald-400'
                  }`}
                >
                  {isDoorOpen ? 'OCHIQ' : 'YOPIQ'}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {isDoorOpen ? '⚠️ Eshik ochiq' : '✓ Qulflangan'}
                </div>
              </div>

              {/* Oyna Sinish / CO */}
              <div
                onClick={() =>
                  (glassSensor || coSensor) && setSelectedSensor(glassSensor || coSensor || null)
                }
                className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1 shadow cursor-pointer active:scale-95 transition"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 font-bold text-amber-400">
                    <Wind className="w-3.5 h-3.5" /> Oyna / CO
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 hidden sm:inline">
                    Piezo
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 leading-tight">
                  {isGlassBroken ? 'SINISH!' : 'XAVFSIZ'}
                </div>
                <div className="text-[10px] text-emerald-400 truncate">
                  {isGlassBroken ? '⚠️ Oyna sinishi!' : '✓ Butun, CO 0 PPM'}
                </div>
              </div>
            </div>

            {/* Xonadon Uy Plani & Xonalar Ko'rinishi (Mobile View Toggle) */}
            <div className="space-y-3">
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Xonadon Xaritasi va Hududlari</span>
                  </h2>
                  <span className="text-[11px] text-slate-400 hidden sm:block">
                    {myApartment?.room_number} datchiklari joylashuvi
                  </span>
                </div>

                {/* View Switcher: Room Cards vs Map Blueprint */}
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => setHomeViewMode('rooms')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      homeViewMode === 'rooms'
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>📋 Hududlar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHomeViewMode('map')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      homeViewMode === 'map'
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>📐 Chizma</span>
                  </button>
                </div>
              </div>

              {/* Mode A: Room by Room Cards View (Default for Mobile) */}
              {homeViewMode === 'rooms' && (
                <div className="space-y-2.5 animate-in fade-in duration-150">
                  {mySensors.map((s) => {
                    const meta = getSensorTypeMeta(s.sensor_type);
                    const Icon = meta.icon;
                    const isLowBat = s.battery_level !== undefined && s.battery_level <= 20;
                    const isAlarm = s.status === 'alarm';

                    return (
                      <div
                        key={s.id}
                        onClick={() => setSelectedSensor(s)}
                        className={`p-3.5 rounded-2xl border transition active:scale-[0.98] cursor-pointer flex items-center justify-between gap-3 ${
                          selectedSensor?.id === s.id
                            ? 'bg-sky-500/15 border-sky-400'
                            : isAlarm
                              ? 'bg-rose-950/40 border-rose-500/60 animate-pulse'
                              : isLowBat
                                ? 'bg-amber-950/20 border-amber-500/40'
                                : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${meta.color}`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white truncate">
                                {meta.zone}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                                • {s.chip_id}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 block truncate">
                              {meta.name}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0 space-y-1">
                          <div className="text-xs font-mono font-bold text-white">
                            {s.sensor_type === 'SMOKE_MQ2' && `${s.smoke_ppm} PPM`}
                            {s.sensor_type === 'TEMP_DS18B20' && `${s.temperature} °C`}
                            {s.sensor_type === 'DOOR_REED' &&
                              (s.reed_switch_open ? 'OCHIQ' : 'YOPIQ')}
                            {s.sensor_type === 'CO_MQ7' && `${s.co_ppm} PPM`}
                            {s.sensor_type === 'GLASS_BREAK' &&
                              (s.glass_break_detected ? 'SINISH!' : 'BUTUN')}
                          </div>
                          <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-mono">
                            <Battery
                              className={`w-3 h-3 ${isLowBat ? 'text-rose-400' : 'text-emerald-400'}`}
                            />
                            <span>{s.battery_level}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Mode B: Full Architectural Blueprint Map */}
              {homeViewMode === 'map' && (
                <div className="animate-in fade-in duration-150 space-y-2">
                  <div className="text-[11px] text-slate-400 px-1 flex items-center justify-between">
                    <span>Xaritadagi belgini bosib datchik telemetriyasini ko‘ring</span>
                    <span className="font-mono text-sky-400">4-qavat • {myApartment?.room_number}</span>
                  </div>

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
                </div>
              )}

              {/* Live Telemetry Trend Chart */}
              <TelemetryChart sensor={selectedSensor || smokeSensor || mySensors[0]} />
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 2: DEVICES — QURILMALAR REESTRI VA YANGI DATCHIK QO'SHISH
           =================================================================== */}
        {activeTab === 'devices' && (
          <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-150">
            {/* Sub-navigation pill switcher: List vs Add Device Wizard */}
            <div className="p-1 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-1 shadow-md">
              <button
                type="button"
                onClick={() => setDevicesSubTab('list')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  devicesSubTab === 'list'
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Mening Datchiklarim ({mySensors.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setDevicesSubTab('add')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  devicesSubTab === 'add'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Yangi Ulash</span>
              </button>
            </div>

            {/* Sub-Tab A: Device List */}
            {devicesSubTab === 'list' && (
              <div className="space-y-3.5">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Chip ID yoki datchik turi bo‘yicha qidirish..."
                    value={deviceSearch}
                    onChange={(e) => setDeviceSearch(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-xs shadow-inner"
                  />
                  {deviceSearch && (
                    <button
                      onClick={() => setDeviceSearch('')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Horizontal Swipeable Category Chips (no-scrollbar) */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
                  {[
                    { key: 'ALL', label: `Barchasi (${mySensors.length})` },
                    { key: 'SMOKE_MQ2', label: '🔥 Tutun' },
                    { key: 'TEMP_DS18B20', label: '🌡️ Harorat' },
                    { key: 'DOOR_REED', label: '🚪 Eshik' },
                    { key: 'CO_MQ7', label: '💨 Is gazi' },
                    { key: 'GLASS_BREAK', label: '🪟 Oyna' }
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setDeviceFilter(f.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
                        deviceFilter === f.key
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Device Cards List */}
                <div className="space-y-3">
                  {filteredSensors.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                      <Cpu className="w-8 h-8 text-slate-500 mx-auto" />
                      <div className="text-xs font-bold text-white">Datchiklar topilmadi</div>
                      <p className="text-[11px] text-slate-400">
                        Qidiruv so‘zini o‘zgartiring yoki yangi datchik ulang.
                      </p>
                    </div>
                  ) : (
                    filteredSensors.map((s) => {
                      const meta = getSensorTypeMeta(s.sensor_type);
                      const Icon = meta.icon;
                      const isLowBat = s.battery_level !== undefined && s.battery_level <= 20;
                      const isAlarm = s.status === 'alarm';
                      const isOffline = s.status === 'offline';

                      let batColor = 'bg-emerald-500';
                      if (s.battery_level <= 20) batColor = 'bg-rose-500';
                      else if (s.battery_level <= 45) batColor = 'bg-amber-500';

                      return (
                        <div
                          key={s.id}
                          onClick={() => setSelectedSensor(s)}
                          className={`p-4 rounded-2xl border transition active:scale-[0.99] cursor-pointer space-y-3 shadow-lg ${
                            selectedSensor?.id === s.id
                              ? 'bg-sky-500/10 border-sky-400'
                              : isAlarm
                                ? 'bg-rose-950/30 border-rose-500/60 animate-pulse'
                                : isLowBat
                                  ? 'bg-amber-950/20 border-amber-500/40'
                                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {/* Top Row: Device icon, name & status pill */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${meta.color}`}
                              >
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-white block truncate">
                                  {meta.name}
                                </span>
                                <span className="text-[11px] font-mono text-slate-400 block truncate">
                                  ID: <strong className="text-sky-400">{s.chip_id}</strong> • {meta.zone}
                                </span>
                              </div>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border shrink-0 ${
                                isAlarm
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
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

                          {/* Battery Bar with Visual Meter */}
                          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                                {isLowBat ? (
                                  <BatteryWarning className="w-3.5 h-3.5 text-amber-400" />
                                ) : (
                                  <Battery className="w-3.5 h-3.5 text-emerald-400" />
                                )}
                                Batareyka quvvati:
                              </span>
                              <span
                                className={`font-mono text-xs font-bold ${
                                  isLowBat ? 'text-amber-400' : 'text-emerald-400'
                                }`}
                              >
                                {s.battery_level}%{' '}
                                {isLowBat && (
                                  <span className="text-[10px] font-bold text-rose-400">
                                    (CR123A almashtiring)
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
                          </div>

                          {/* Live Reading & Signal info */}
                          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                              <span className="text-[10px] text-slate-500 block uppercase font-sans">
                                Jonli Ko‘rsatkich
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

                            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                              <span className="text-[10px] text-slate-500 block uppercase font-sans">
                                Aloqa &amp; Signal
                              </span>
                              <div className="flex items-center gap-1 text-xs text-sky-400 font-bold">
                                <Signal className="w-3 h-3" />
                                <span>{s.rssi_dbm} dBm</span>
                              </div>
                              <span className="text-[10px] text-slate-400 truncate block">
                                {s.parent_node_id}
                              </span>
                            </div>
                          </div>

                          {/* One-touch inspect button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSensor(s);
                            }}
                            className="w-full py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95"
                          >
                            <Sliders className="w-3.5 h-3.5 text-sky-400" />
                            <span>Sozlamalar va Telemetriya (Inspect)</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Sub-Tab B: Add New Device Wizard */}
            {devicesSubTab === 'add' && (
              <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                      <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">
                        Yangi Datchik Qo‘shish (Pairing)
                      </h2>
                      <span className="text-[11px] text-slate-400">
                        {myApartment?.room_number} • 4-qavat
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                      activePairingSession
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 animate-pulse'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    {activePairingSession ? 'ULANISH REJIMI' : 'KUTILMOQDA'}
                  </span>
                </div>

                {/* Step 1: Select Receiver MCU */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block uppercase">
                    1. Qabul qiluvchi apparatni tanlang:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={Boolean(activePairingSession)}
                      onClick={() => setTargetReceiver('FLOOR_HUB')}
                      className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 active:scale-95 ${
                        targetReceiver === 'FLOOR_HUB'
                          ? 'bg-sky-500/15 border-sky-400 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Layers className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">Etaj Hubi MCU</div>
                        <div className="text-[10px] text-sky-300 font-mono">
                          {currentFloor?.hub_id || 'HUB-B1-FL04'} (RS485 + BLE)
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(activePairingSession)}
                      onClick={() => setTargetReceiver('CENTRAL_GATEWAY')}
                      className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 active:scale-95 ${
                        targetReceiver === 'CENTRAL_GATEWAY'
                          ? 'bg-amber-500/15 border-amber-400 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Radio className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">Markaziy Gateway MCU</div>
                        <div className="text-[10px] text-amber-300 font-mono">
                          GW-LILYGO-TCALL-SIM800
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Step 2: Grant Permission / Enable Pairing Mode */}
                {!activePairingSession ? (
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div>
                      <span className="text-xs font-bold text-white block">
                        2. MCU Ulanish Rejimiga Ruxsat Berish
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Tugmani bosganingizda MCU 120 soniyaga ulanish rejimiga o‘tadi (Pairing Mode).
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={pairingBusy}
                      onClick={handleAuthorizeMcuPairing}
                      className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30 active:scale-95 transition"
                    >
                      <Radio className="w-4 h-4 animate-pulse" />
                      <span>
                        {pairingBusy
                          ? 'MCU Rejimi Yoqilmoqda...'
                          : `${targetReceiver === 'FLOOR_HUB' ? 'Etaj Hubi' : 'Gateway'}ga Ulanishga Ruxsat Berish`}
                      </span>
                    </button>
                  </div>
                ) : (
                  /* Step 3: Active Pairing Session UI with Incoming Handshake Auto-Detection */
                  <div className="p-4 rounded-2xl bg-sky-950/40 border-2 border-sky-500 shadow-[0_0_30px_rgba(14,165,233,0.3)] space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-sky-500/30 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Radio className="w-4 h-4 text-sky-400 animate-pulse" />
                        <span className="text-xs font-black text-white">
                          MCU DATCHIKNI KUTMOQDA
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCancelMcuPairing}
                        className="py-1 px-2.5 rounded-lg bg-slate-800 text-rose-400 text-xs font-bold transition flex items-center gap-1 active:scale-95"
                      >
                        <X className="w-3.5 h-3.5" /> Bekor qilish
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Datchikdagi <strong>BOOT/SETUP</strong> tugmasini 3s bosib turing. Kiruvchi Intro Packet orqali datchik turi avtomatik aniqlanadi.
                    </p>

                    {/* Presets Selector */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-300 block">
                        Kiruvchi Intro Paketi turi:
                      </label>
                      <div className="grid grid-cols-1 gap-2">
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
                              className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between active:scale-95 ${
                                isSel
                                  ? 'bg-sky-500/25 border-sky-400 text-white'
                                  : 'bg-slate-950 border-slate-800 text-slate-300'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-bold flex items-center gap-1.5 truncate">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-900 font-mono text-sky-400 text-[10px]">
                                    {preset.typeByte}
                                  </span>
                                  <span className="truncate">{preset.name}</span>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono text-emerald-400 shrink-0">
                                {preset.sampleHex.slice(0, 11)}...
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={pairingBusy}
                      onClick={handleConfirmPairing}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95 transition"
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {pairingBusy
                          ? 'Ulanmoqda...'
                          : 'Intro Packetni Qabul Qilish va O‘rnatish'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            TAB 3: ALARMS — ALARMLAR, 112 FVV VA OGOHLANTIRISH FUNKSIYALARI
           =================================================================== */}
        {activeTab === 'alarms' && (
          <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-150">
            {/* Mobile Emergency SOS Call 112 Card */}
            <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-rose-950/60 via-slate-900 to-slate-900 border border-rose-500/40 shadow-xl space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0 shadow-md">
                    <ShieldAlert className="w-6 h-6 text-rose-400 animate-pulse" />
                  </div>
                  <div>
                    <h1 className="text-sm sm:text-base font-black text-white">
                      Xavfsizlik &amp; Alarmlar Markazi
                    </h1>
                    <span className="text-[10px] font-mono text-rose-300 font-bold">
                      112 FVV INTEGRATSIYASI FAOL
                    </span>
                  </div>
                </div>

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
                  className="px-3 py-1.5 rounded-xl bg-red-600/30 text-red-300 border border-red-500/40 text-[11px] font-bold flex items-center gap-1.5 active:scale-95 transition shrink-0"
                >
                  <Flame className="w-3.5 h-3.5" /> Test Signal
                </button>
              </div>

              {/* Direct Call 112 Mobile Button */}
              <a
                href="tel:112"
                className="w-full py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-red-600/40 active:scale-95 transition"
              >
                <PhoneCall className="w-4 h-4 animate-bounce" />
                <span>112 FVV DISPETCHERGA TEZKOR QO‘NG‘IROQ</span>
              </a>

              {/* 60s Escalation Rule Info */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-400" /> 60 Soniyali Avtomatik Eskalatsiya:
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Tutun datchigi signal berganda, tizim 60s kutiladi. Agar soxta signal deb bekor qilinmasa, SIM7670 4G orqali O‘zbekiston 112 xizmatiga manzil va datchik koordinatalari avtomatik uzatiladi.
                </p>
              </div>

              {/* Collapsible Mobile Safety Instructions */}
              <div className="border-t border-slate-800/80 pt-2">
                <button
                  type="button"
                  onClick={() => setSafetyGuideOpen(!safetyGuideOpen)}
                  className="w-full py-1 text-xs font-bold text-slate-300 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-400" />
                    Favqulodda vaziyat yo‘riqnomasi
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${safetyGuideOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {safetyGuideOpen && (
                  <div className="pt-2 space-y-2 text-[11px] text-slate-300 animate-in fade-in">
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                      <div className="font-bold text-amber-300">1. Vahimaga tushmang</div>
                      <p className="text-slate-400">
                        Xonadondagi barcha oila a’zolarini ogohlantiring va tezda eshik tomon harakatlaning.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                      <div className="font-bold text-amber-300">2. Liftlardan foydalanmang</div>
                      <p className="text-slate-400">
                        Faqat tutunsiz favqulodda zinapoyalar orqali pastga tushing.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                      <div className="font-bold text-amber-300">3. Eshikni yopib keting</div>
                      <p className="text-slate-400">
                        Kislorod oqimini cheklash uchun chiqishda xonadon eshigini yopib qo‘ying.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Comprehensive Alarm Management Section (Filtered for Resident) */}
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

        {/* ===================================================================
            TAB 4: SYSTEM — TIZIM SALOMATLIGI, PROFIL VA SOZLAMALAR
           =================================================================== */}
        {activeTab === 'system' && (
          <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-150">
            {/* Resident & Apartment Profile Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
                  <User className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-black text-white truncate">
                    Aziza Rustamova
                  </h2>
                  <p className="text-xs text-slate-400 truncate">
                    {myApartment?.room_number || 'Apt 42'} • 4-qavat, Block B
                  </p>
                  <span className="text-[10px] font-mono text-emerald-400 block mt-0.5">
                    Nest One Residence • Toshkent
                  </span>
                </div>
              </div>
            </div>

            {/* Hardware & Connectivity Status */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-xl space-y-3">
              <h3 className="text-xs font-bold uppercase text-slate-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                Apparat Uskunalari va Tarmoq Holati
              </h3>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Etaj Sub-Hub MCU:</span>
                  <span className="font-mono text-white font-bold">
                    {currentFloor?.hub_id || 'HUB-B1-FL04'} (DIP: 04)
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Markaziy Gateway:</span>
                  <span className="font-mono text-white font-bold">
                    GW-SIM800 / SIM7670 (4G LTE)
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Datchiklar Aloqasi:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {mySensors.length} ta ONLINE (BLE 5.0)
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">112 FVV Dispetcher Aloqasi:</span>
                  <span className="font-mono text-emerald-400 font-bold">FAOL (Tayyor)</span>
                </div>
              </div>
            </div>

            {/* Language Selection (Multi-Language) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-xl space-y-3">
              <h3 className="text-xs font-bold uppercase text-slate-300 flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-400" />
                Tizim Tili (Language)
              </h3>

              <div className="grid grid-cols-3 gap-2">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setLang(l.code)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition active:scale-95 ${
                      lang === l.code
                        ? 'bg-sky-600 text-white shadow-md'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Toggle (Dark / Light) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-xl space-y-3">
              <h3 className="text-xs font-bold uppercase text-slate-300 flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-400" />
                Interfeys Mavzusi
              </h3>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => theme === 'light' && toggleTheme()}
                  className={`py-3 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 ${
                    theme === 'dark'
                      ? 'bg-slate-800 text-white border border-slate-700 shadow'
                      : 'bg-slate-950 text-slate-400 border border-slate-800'
                  }`}
                >
                  <Moon className="w-4 h-4 text-sky-400" />
                  <span>Qorong‘i (Dark)</span>
                </button>

                <button
                  type="button"
                  onClick={() => theme === 'dark' && toggleTheme()}
                  className={`py-3 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 ${
                    theme === 'light'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'bg-slate-950 text-slate-400 border border-slate-800'
                  }`}
                >
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>Yorug‘ (Light)</span>
                </button>
              </div>
            </div>

            {/* Logout / Switch Role Link */}
            <div className="pt-2">
              <Link
                href="/login"
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('switch_role')} (Tizimdan Chiqish)</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          4. MOBIL TELEFON PASTKI NAVIGATSIYA PANEL (FIXED BOTTOM BAR - lg:hidden)
         ===================================================================== */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/90 px-3 py-1.5 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.6)]">
        <div className="grid grid-cols-4 gap-1 max-w-md mx-auto">
          {/* 1. Home Button */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all active:scale-90 ${
              activeTab === 'home'
                ? 'text-emerald-400 bg-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <LayoutDashboard className="w-5 h-5" />
              {activeTab === 'home' && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400" />
              )}
            </div>
            <span className="text-[10px] font-bold mt-1 tracking-tight">Asosiy</span>
          </button>

          {/* 2. Devices Button */}
          <button
            type="button"
            onClick={() => setActiveTab('devices')}
            className={`py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all active:scale-90 relative ${
              activeTab === 'devices'
                ? 'text-sky-400 bg-sky-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Cpu className="w-5 h-5" />
              <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-sky-600 text-white font-mono text-[9px] font-bold">
                {mySensors.length}
              </span>
              {activeTab === 'devices' && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-sky-400" />
              )}
            </div>
            <span className="text-[10px] font-bold mt-1 tracking-tight">Qurilmalar</span>
          </button>

          {/* 3. Alarms Button */}
          <button
            type="button"
            onClick={() => setActiveTab('alarms')}
            className={`py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all active:scale-90 relative ${
              activeTab === 'alarms'
                ? 'text-rose-400 bg-rose-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Bell className="w-5 h-5" />
              {unreadAlarmsCount > 0 ? (
                <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              ) : null}
              {activeTab === 'alarms' && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-rose-400" />
              )}
            </div>
            <span className="text-[10px] font-bold mt-1 tracking-tight">Alarmlar</span>
          </button>

          {/* 4. System / Profile Button */}
          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all active:scale-90 ${
              activeTab === 'system'
                ? 'text-purple-400 bg-purple-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Settings className="w-5 h-5" />
              {activeTab === 'system' && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-purple-400" />
              )}
            </div>
            <span className="text-[10px] font-bold mt-1 tracking-tight">Tizim</span>
          </button>
        </div>
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
