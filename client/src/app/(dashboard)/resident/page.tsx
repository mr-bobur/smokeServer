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
  ShieldAlert
} from 'lucide-react';
import { useFloorData } from '../../../hooks/useFloorData';
import { BlueprintViewer } from '../../../components/map/BlueprintViewer';
import { SensorModal } from '../../../components/map/SensorModal';
import { TelemetryChart } from '../../../components/charts/TelemetryChart';
import {
  PerimeterSecurityStatus,
  SensorEndpointData,
  SensorType
} from '../../../types';
import { useAppSettings } from '../../../context/AppSettingsContext';

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
    activePairingSession,
    setActivePairingSession,
    startDragDropPairing,
    cancelPairingSession,
    completePairingWithIntroPacket,
    saveSensorCoordinates,
    updateSensorConfig,
    calibrateSensor,
    setApartmentPerimeter,
    triggerTestAlarm
  } = useFloorData(4, 'user');

  const [selectedSensor, setSelectedSensor] = useState<SensorEndpointData | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // New Device Pairing authorization options
  const [targetReceiver, setTargetReceiver] = useState<'FLOOR_HUB' | 'CENTRAL_GATEWAY'>('FLOOR_HUB');
  const [selectedIntroPreset, setSelectedIntroPreset] = useState(INTRO_PACKET_PRESETS[0]);
  const [customIntroHex, setCustomIntroHex] = useState<string>(INTRO_PACKET_PRESETS[0].sampleHex);
  const [pairingBusy, setPairingBusy] = useState<boolean>(false);

  const myApartment = useMemo(() => {
    return rooms.find((r) => r.room_number === 'Apt 42') || rooms[1] || rooms[0];
  }, [rooms]);

  const mySensors = useMemo(() => {
    if (!myApartment) return sensors;
    return sensors.filter((s) => s.room_id === myApartment.id);
  }, [sensors, myApartment]);

  const smokeSensor = mySensors.find((s) => s.sensor_type === 'SMOKE_MQ2');
  const tempSensor = mySensors.find((s) => s.sensor_type === 'TEMP_DS18B20');
  const doorSensor = mySensors.find((s) => s.sensor_type === 'DOOR_REED');
  const glassSensor = mySensors.find((s) => s.sensor_type === 'GLASS_BREAK');
  const coSensor = mySensors.find((s) => s.sensor_type === 'CO_MQ7');

  const smokePpm = smokeSensor?.smoke_ppm ?? 45.2;
  const tempC = tempSensor?.temperature ?? 24.6;
  const isDoorOpen = Boolean(doorSensor?.reed_switch_open);
  const isGlassBroken = Boolean(glassSensor?.glass_break_detected);

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
          name: 'Tutun datchigi (MQ-2)',
          icon: Flame,
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/30'
        };
      case 'TEMP_DS18B20':
        return {
          name: 'Harorat datchigi (DS18B20)',
          icon: Thermometer,
          color: 'text-sky-400 bg-sky-500/10 border-sky-500/30'
        };
      case 'DOOR_REED':
        return {
          name: 'Eshik datchigi (Reed)',
          icon: DoorOpen,
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
        };
      case 'CO_MQ7':
        return {
          name: 'Is gazi datchigi (MQ-7 CO)',
          icon: Wind,
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/30'
        };
      case 'GLASS_BREAK':
        return {
          name: 'Oyna sinish datchigi (Piezo)',
          icon: ShieldAlert,
          color: 'text-purple-400 bg-purple-500/10 border-purple-500/30'
        };
      default:
        return {
          name: 'Sensor',
          icon: Radio,
          color: 'text-slate-400 bg-slate-800 border-slate-700'
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* =====================================================================
          1. HEADER & APARTMENT OVERVIEW
         ===================================================================== */}
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
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
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
              <span className="text-emerald-400 font-semibold">Tizim holati: Barcha sensorlar aloqada</span>
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
          className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-red-600/30"
        >
          <Flame className="w-4 h-4" /> {t('simulate_alarm')}
        </button>
      </div>

      {statusFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{statusFeedback}</span>
        </div>
      )}

      {/* =====================================================================
          2. DASTLAB: PERIMETR XAVFSIZLIGI VA MUHIT KARTALARI
         ===================================================================== */}
      {/* Perimeter Security Control Buttons */}
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

      {/* Environmental Live KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-400" /> {t('type_SMOKE_MQ2')}
            </span>
            <span className="font-mono text-[11px] text-slate-400">{smokeSensor?.chip_id || 'C3-9A4F22B8'}</span>
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
            <span className="font-mono text-[11px] text-slate-400">{tempSensor?.chip_id || 'C3-TEMP'}</span>
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
            <span className="font-mono text-[11px] text-slate-400">{doorSensor?.chip_id || 'C3-DOOR'}</span>
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

      {/* =====================================================================
          2. DASTLAB: XONADONDAGI QURILMALAR RO'YXATI VA HOLATI (TABLE / CARDS)
         ===================================================================== */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-sky-400" />
              Xonadondagi Qurilmalar va Datchiklar Reestri ({mySensors.length} ta)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Har bir datchikning aloqa holati, batareyka zaryad darajasi va jonli ko‘rsatkichlari
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400">
            1 Qurilma = 1 Sensor (BLE 5.0 / RS485)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mySensors.map((s) => {
            const meta = getSensorTypeMeta(s.sensor_type);
            const Icon = meta.icon;
            const isLowBat =
              (s.battery_level !== undefined && s.battery_level <= 20) || s.status === 'warning';
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
          })}
        </div>
      </div>

      {/* =====================================================================
          3. PASTDA: UY PLANI VA UNDAGI QURILMALAR JOYLASHUVI (BLUEPRINT)
         ===================================================================== */}
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

        {/* Telemetry Chart for the selected or default smoke sensor */}
        <TelemetryChart sensor={selectedSensor || smokeSensor || mySensors[0]} />
      </div>

      {/* =====================================================================
          4. KEYIN: YANGI QURILMA QO'SHISH & GATEWAY / ETAJ MCU GA RUXSAT BERISH
         ===================================================================== */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0">
              <Radio className="w-6 h-6 text-sky-400" />
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

          <div className="flex items-center gap-2">
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
        </div>

        {/* Step 1: Select Target Receiver (Etaj Sub-Hub MCU or Central Gateway) */}
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
                Tugmani bosganingizda tanlangan {targetReceiver === 'FLOOR_HUB' ? 'Etaj Sub-Hub' : 'Markaziy Gateway'} MCU 120 soniyaga ulanish rejimiga o‘tadi (Pairing Mode).
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
                    QABUL QILUVCHI: {activePairingSession.target_receiver_id} ({activePairingSession.target_receiver_type})
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
              Datchikdagi <strong>BOOT / SETUP</strong> tugmasini 3 soniya bosib turing yoki batareyasini joylashtiring. Hub kirish tanishtiruv paketini (Intro Packet) qabul qilgach, datchik turi avtomatik aniqlanadi.
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
                Obyekt: <strong className="text-white">{myApartment?.room_number}</strong> (4-qavat)
              </div>

              <button
                type="button"
                disabled={pairingBusy}
                onClick={handleConfirmPairing}
                className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition"
              >
                <Check className="w-4 h-4" />
                <span>
                  {pairingBusy ? 'Ulanmoqda...' : 'Tanishtiruv Paketini Qabul Qilish va O‘rnatish'}
                </span>
              </button>
            </div>
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
