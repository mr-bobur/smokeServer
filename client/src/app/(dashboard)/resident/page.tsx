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
  Cpu
} from 'lucide-react';
import { useFloorData } from '../../../hooks/useFloorData';
import { BlueprintViewer } from '../../../components/map/BlueprintViewer';
import { SensorModal } from '../../../components/map/SensorModal';
import { TelemetryChart } from '../../../components/charts/TelemetryChart';
import { PerimeterSecurityStatus, SensorEndpointData } from '../../../types';
import { useAppSettings } from '../../../context/AppSettingsContext';

export default function ResidentPortalPage() {
  const { t } = useAppSettings();
  const {
    currentFloor,
    rooms,
    sensors,
    activePairingSession,
    setActivePairingSession,
    startDragDropPairing,
    completePairingWithIntroPacket,
    saveSensorCoordinates,
    updateSensorConfig,
    calibrateSensor,
    setApartmentPerimeter,
    triggerTestAlarm
  } = useFloorData(4, 'user');

  const [selectedSensor, setSelectedSensor] = useState<SensorEndpointData | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

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
    setStatusFeedback(
      `Apartment ${myApartment.room_number} perimeter security transitioned to ${newMode
        .replace('_', ' ')
        .toUpperCase()} via MQTT Downlink.`
    );
  };

  const currentPerimeter = myApartment?.perimeter_security_status || 'armed_home';

  return (
    <div className="space-y-6">
      {/* Resident Portal Header */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
            <Home className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white">
                {myApartment?.room_number || 'Apt 42'} — {t('my_apartment')}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                Floor 4 • Aziza Rustamova
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('drag_hint')}
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

      {/* RESIDENT SELF-SERVICE TOPOLOGY PLAN: DRAG & DROP NEW DEVICE INSTALLATION */}
      <div className="space-y-3">
        <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <PlusCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-white">{t('buy_install_title')}</h2>
              <p className="text-xs text-slate-300">
                {t('drag_hint')}
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400">
            Receiver: {currentFloor?.has_sub_hub !== false ? `Floor Hub (${currentFloor?.hub_id || 'HUB-B1-FL04'})` : 'Central Gateway Direct'}
          </span>
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
              coord_y: p.coord_y
            })
          }
          onCompleteIntroPacketPairing={completePairingWithIntroPacket}
          onCancelPairing={() => setActivePairingSession(null)}
        />
      </div>

      {/* Tactile Perimeter Security Controls (Arm Away, Arm Home, Disarm) */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-sky-400" />
              Apartment Perimeter Security Controls
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Controls Door Reed (`DOOR_REED`) and Window Glass Break (`GLASS_BREAK`) endpoints in {myApartment?.room_number || 'Apt 42'}.
            </p>
          </div>
          <span className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-sky-400">
            STATE: {currentPerimeter.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => handlePerimeterChange('armed_away')}
            className={`p-5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between space-y-3 ${
              currentPerimeter === 'armed_away'
                ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.2)]'
                : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <Shield className="w-6 h-6 text-amber-400" />
              {currentPerimeter === 'armed_away' && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
                  ACTIVE
                </span>
              )}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">{t('arm_away')}</h3>
              <p className="text-xs text-slate-400 mt-1">
                Full perimeter lockdown. Instant critical alarm on Door Reed or Glass Break.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handlePerimeterChange('armed_home')}
            className={`p-5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between space-y-3 ${
              currentPerimeter === 'armed_home'
                ? 'bg-emerald-500/20 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.2)]'
                : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              {currentPerimeter === 'armed_home' && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black">
                  ACTIVE
                </span>
              )}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">{t('arm_home')}</h3>
              <p className="text-xs text-slate-400 mt-1">
                Night / Stay mode. Exterior Door &amp; Window Glass sensors armed.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handlePerimeterChange('disarmed')}
            className={`p-5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between space-y-3 ${
              currentPerimeter === 'disarmed'
                ? 'bg-sky-500/20 border-sky-400 shadow-[0_0_25px_rgba(56,189,248,0.2)]'
                : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <ShieldOff className="w-6 h-6 text-slate-300" />
              {currentPerimeter === 'disarmed' && (
                <span className="px-2 py-0.5 rounded-full bg-sky-400 text-slate-950 text-[10px] font-black">
                  ACTIVE
                </span>
              )}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">{t('disarm')}</h3>
              <p className="text-xs text-slate-400 mt-1">
                Entry/Exit unlocked. 24/7 Smoke (`SMOKE_MQ2`) protection stays active.
              </p>
            </div>
          </button>
        </div>

        {statusFeedback && (
          <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
            {statusFeedback}
          </div>
        )}
      </div>

      {/* Installed Single-Sensor Endpoints in Resident's Apartment */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sky-400" />
            Installed Single-Sensor Endpoints in {myApartment?.room_number || 'Apt 42'} ({mySensors.length} Devices)
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            1 Device = 1 Dedicated Sensor (Auto-Detected via Intro Packet)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {mySensors.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelectedSensor(s)}
              className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500/50 cursor-pointer transition space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-white">{s.chip_id}</span>
                <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 text-[10px] font-mono font-bold">
                  {s.intro_type_byte}
                </span>
              </div>
              <div className="text-xs font-bold text-emerald-400">
                {t(`type_${s.sensor_type}`)}
              </div>
              <div className="text-base font-black font-mono text-white">
                {s.sensor_type === 'SMOKE_MQ2' && `${s.smoke_ppm} PPM`}
                {s.sensor_type === 'TEMP_DS18B20' && `${s.temperature} °C`}
                {s.sensor_type === 'CO_MQ7' && `${s.co_ppm} PPM`}
                {s.sensor_type === 'DOOR_REED' &&
                  (s.reed_switch_open ? 'DOOR OPEN' : 'DOOR CLOSED')}
                {s.sensor_type === 'GLASS_BREAK' &&
                  (s.glass_break_detected ? 'SHATTER ALARM' : 'GLASS INTACT')}
              </div>
              <div className="text-[10px] font-mono text-slate-500 truncate">
                Via {s.parent_node_id} • Bat {s.battery_level}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Environmental Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-400" /> {t('type_SMOKE_MQ2')}
            </span>
            <span className="font-mono">{smokeSensor?.chip_id || 'C3-9A4F22B8'}</span>
          </div>
          <div className="text-2xl font-black text-white font-mono">{smokePpm} PPM</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-rose-400" /> {t('type_TEMP_DS18B20')}
            </span>
            <span className="font-mono">{tempSensor?.chip_id || 'C3-TEMP'}</span>
          </div>
          <div className="text-2xl font-black text-white font-mono">{tempC} °C</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <DoorOpen className="w-4 h-4 text-sky-400" /> {t('type_DOOR_REED')}
            </span>
            <span className="font-mono">{doorSensor?.chip_id || 'C3-DOOR'}</span>
          </div>
          <div
            className={`text-lg font-black flex items-center gap-2 ${
              isDoorOpen ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {isDoorOpen ? (
              <>
                <AlertTriangle className="w-5 h-5" /> OPEN
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" /> CLOSED
              </>
            )}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Wind className="w-4 h-4 text-amber-400" /> {t('type_GLASS_BREAK')} / CO
            </span>
            <span className="font-mono">{glassSensor?.chip_id || coSensor?.chip_id || 'C3-GLS'}</span>
          </div>
          <div className="text-lg font-black text-emerald-400">
            {isGlassBroken ? 'SHATTER ALARM' : 'INTACT & SECURE'}
          </div>
        </div>
      </div>

      <TelemetryChart sensor={smokeSensor || mySensors[0]} />

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
