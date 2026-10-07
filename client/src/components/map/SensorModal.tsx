'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Battery,
  Signal,
  Flame,
  Thermometer,
  Wind,
  Shield,
  RefreshCw,
  Sliders,
  AlertTriangle,
  Clock,
  Cpu,
  DoorOpen,
  ShieldAlert,
  Layers,
  Terminal,
  CheckCircle2,
  Hourglass
} from 'lucide-react';
import {
  DeviceAttributesBundleData,
  RpcCommandData,
  SensorEndpointData
} from '../../types';
import { useAppSettings } from '../../context/AppSettingsContext';
import { API_BASE, getAuthHeaders } from '../../hooks/useFloorData';

interface SensorModalProps {
  sensor: SensorEndpointData | null;
  onClose: () => void;
  onUpdateConfig: (
    sensorId: number,
    config: {
      beacon_interval_seconds?: number;
      smoke_threshold_ppm?: number;
      temp_threshold_c?: number;
      arm_perimeter?: boolean;
    }
  ) => Promise<unknown>;
  onCalibrate: (sensorId: number) => Promise<unknown>;
  onTriggerTestAlarm: (sensor: SensorEndpointData) => Promise<unknown>;
}

export const SensorModal: React.FC<SensorModalProps> = ({
  sensor,
  onClose,
  onUpdateConfig,
  onCalibrate,
  onTriggerTestAlarm
}) => {
  const { t } = useAppSettings();
  const [activeTab, setActiveTab] = useState<'telemetry' | 'attributes' | 'rpc'>('telemetry');
  const [beaconInterval, setBeaconInterval] = useState<number>(600);
  const [smokeThreshold, setSmokeThreshold] = useState<number>(400);
  const [armPerimeter, setArmPerimeter] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [attrs, setAttrs] = useState<DeviceAttributesBundleData | null>(null);
  const [rpcList, setRpcList] = useState<RpcCommandData[]>([]);

  const fetchThingsBoardDetails = async (sensorId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/devices/${sensorId}/attributes`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAttrs(data.attributes || null);
        setRpcList(data.rpc_history || []);
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    if (sensor) {
      setBeaconInterval(sensor.beacon_interval_seconds);
      setSmokeThreshold(sensor.smoke_threshold_ppm || 400);
      setArmPerimeter(sensor.arm_perimeter);
      setFeedback(null);
      if (sensor.attributes) {
        setAttrs(sensor.attributes);
      }
      fetchThingsBoardDetails(sensor.id);
    }
  }, [sensor]);

  if (!sensor) return null;

  const handleSaveConfig = async () => {
    setBusy(true);
    setFeedback(null);
    await onUpdateConfig(sensor.id, {
      beacon_interval_seconds: beaconInterval,
      smoke_threshold_ppm: smokeThreshold,
      arm_perimeter: armPerimeter
    });
    await fetchThingsBoardDetails(sensor.id);
    setBusy(false);
    setFeedback(
      'Shared Attributes saved as Desired State (PENDING_WAKEUP) & queued in Downlink RPC!'
    );
  };

  const handleImmediateWakeupSync = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/devices/${sensor.id}/attributes/shared`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          beacon_interval_seconds: beaconInterval,
          smoke_threshold_ppm: smokeThreshold,
          arm_perimeter: armPerimeter,
          simulate_immediate_wakeup: true
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAttrs(data.attributes);
        setFeedback(data.message);
      }
      await fetchThingsBoardDetails(sensor.id);
    } finally {
      setBusy(false);
    }
  };

  const handleDispatchRpc = async (method: string) => {
    setBusy(true);
    try {
      await fetch(`${API_BASE}/api/rpc/commands`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          building_id: sensor.building_id,
          target_type: 'END_DEVICE',
          target_id: sensor.chip_id,
          method,
          params: { profile: sensor.profile_code || `PROFILE_${sensor.sensor_type}` },
          immediate_ack: true
        })
      });
      await fetchThingsBoardDetails(sensor.id);
      setFeedback(`RPC [${method}] ACKed by ${sensor.chip_id}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCalibrate = async () => {
    setBusy(true);
    setFeedback(null);
    await onCalibrate(sensor.id);
    await fetchThingsBoardDetails(sensor.id);
    setBusy(false);
    setFeedback('Zero-point ADC baseline calibrated on ESP32-C3 sensor!');
  };

  const batColor =
    sensor.battery_level > 50
      ? 'bg-emerald-500'
      : sensor.battery_level > 20
        ? 'bg-amber-500'
        : 'bg-red-500';

  const profileCode = sensor.profile_code || `PROFILE_${sensor.sensor_type}`;
  const syncStatus = attrs?.sync_status || sensor.attributes?.sync_status || 'SYNCED';

  const renderDedicatedSensorCard = () => {
    switch (sensor.sensor_type) {
      case 'SMOKE_MQ2':
        return (
          <div className="p-4 rounded-xl bg-slate-950/90 border-2 border-orange-500/40 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-orange-400 font-bold uppercase">
                <Flame className="w-4 h-4" /> {t('type_SMOKE_MQ2')}
              </div>
              <div className="text-2xl font-black font-mono text-white mt-1">
                {sensor.smoke_ppm} <span className="text-xs font-normal text-slate-400">PPM</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Profile: <span className="text-sky-400 font-mono">{profileCode}</span> • Crit:{' '}
                {sensor.smoke_threshold_ppm || 400} PPM
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-orange-500/20 text-orange-300 font-mono text-xs font-bold">
              TYPE 0x01
            </span>
          </div>
        );
      case 'TEMP_DS18B20':
        return (
          <div className="p-4 rounded-xl bg-slate-950/90 border-2 border-rose-500/40 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-rose-400 font-bold uppercase">
                <Thermometer className="w-4 h-4" /> {t('type_TEMP_DS18B20')}
              </div>
              <div className="text-2xl font-black font-mono text-white mt-1">
                {sensor.temperature} <span className="text-xs font-normal text-slate-400">°C</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Profile: <span className="text-sky-400 font-mono">{profileCode}</span> • Crit:{' '}
                {sensor.temp_threshold_c || 60.0} °C
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 font-mono text-xs font-bold">
              TYPE 0x02
            </span>
          </div>
        );
      case 'DOOR_REED':
        return (
          <div className="p-4 rounded-xl bg-slate-950/90 border-2 border-sky-500/40 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-sky-400 font-bold uppercase">
                <DoorOpen className="w-4 h-4" /> {t('type_DOOR_REED')}
              </div>
              <div
                className={`text-xl font-black font-mono mt-1 ${
                  sensor.reed_switch_open ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {sensor.reed_switch_open ? 'DOOR OPEN (BREACH)' : 'DOOR CLOSED (SECURE)'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Profile: <span className="text-sky-400 font-mono">{profileCode}</span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 font-mono text-xs font-bold">
              TYPE 0x03
            </span>
          </div>
        );
      case 'CO_MQ7':
        return (
          <div className="p-4 rounded-xl bg-slate-950/90 border-2 border-amber-500/40 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold uppercase">
                <Wind className="w-4 h-4" /> {t('type_CO_MQ7')}
              </div>
              <div className="text-2xl font-black font-mono text-white mt-1">
                {sensor.co_ppm} <span className="text-xs font-normal text-slate-400">PPM</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Profile: <span className="text-sky-400 font-mono">{profileCode}</span> • Crit: 70 PPM
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 font-mono text-xs font-bold">
              TYPE 0x04
            </span>
          </div>
        );
      case 'GLASS_BREAK':
      default:
        return (
          <div className="p-4 rounded-xl bg-slate-950/90 border-2 border-purple-500/40 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-purple-400 font-bold uppercase">
                <ShieldAlert className="w-4 h-4" /> {t('type_GLASS_BREAK')}
              </div>
              <div
                className={`text-xl font-black font-mono mt-1 ${
                  sensor.glass_break_detected ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {sensor.glass_break_detected ? 'SHATTER DETECTED!' : 'WINDOW INTACT'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Profile: <span className="text-sky-400 font-mono">{profileCode}</span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 font-mono text-xs font-bold">
              TYPE 0x05
            </span>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-slate-900/95 border-l border-slate-700/80 backdrop-blur-xl shadow-2xl flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/40 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white font-mono">{sensor.chip_id}</h3>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                  sensor.status === 'alarm'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : sensor.status === 'warning'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : sensor.status === 'offline'
                        ? 'bg-slate-700 text-slate-300'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {sensor.status}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Fl {sensor.floor_number} • {sensor.room_number} • {profileCode}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ThingsBoard-Inspired Entity Navigation Tabs */}
      <div className="grid grid-cols-3 gap-1 p-2 bg-slate-950/90 border-b border-slate-800 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('telemetry')}
          className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
            activeTab === 'telemetry'
              ? 'bg-sky-500 text-slate-950'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" /> Telemetry
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('attributes')}
          className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
            activeTab === 'attributes'
              ? 'bg-sky-500 text-slate-950'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> 3-Scope Attrs
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rpc')}
          className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
            activeTab === 'rpc'
              ? 'bg-sky-500 text-slate-950'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" /> RPC Queue
        </button>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4 overflow-y-auto flex-1">
        {activeTab === 'telemetry' && (
          <>
            {renderDedicatedSensorCard()}

            {/* Intro Packet & Parent Hub/Gateway Metadata */}
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{t('parent_receiver')}:</span>
                <span className="text-sky-400 font-bold">
                  {sensor.parent_link_type}: {sensor.parent_node_id}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">{t('intro_packet')}:</span>
                <span className="text-emerald-400 text-[11px] break-all">
                  {sensor.intro_packet_hex || 'AA FF C39A4F22 01 64 C4 9B 55'}
                </span>
              </div>
            </div>

            {/* Battery & Signal Bar */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Battery className="w-4 h-4 text-emerald-400" /> CR123A / LiPo
                  </span>
                  <span className="font-mono font-bold text-white">{sensor.battery_level}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${batColor}`}
                    style={{ width: `${sensor.battery_level}%` }}
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Signal className="w-4 h-4 text-sky-400" /> BLE 5.0 RSSI
                  </span>
                  <span className="font-mono font-bold text-sky-300">{sensor.rssi_dbm} dBm</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono truncate">
                  Coords: ({sensor.coord_x}%, {sensor.coord_y}%)
                </div>
              </div>
            </div>

            {/* Downlink Configuration Controls */}
            <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" /> Shared Attributes Config
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 ${
                    syncStatus === 'SYNCED'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {syncStatus === 'SYNCED' ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <Hourglass className="w-3 h-3" />
                  )}
                  {syncStatus}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-800/80">
                <div>
                  <div className="text-sm font-medium text-white flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-emerald-400" /> Arm Sensor Alert
                  </div>
                  <div className="text-xs text-slate-400">
                    Active 24/7 monitoring &amp; threshold trigger
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setArmPerimeter(!armPerimeter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    armPerimeter
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {armPerimeter ? 'ARMED' : 'DISARMED'}
                </button>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300">Dynamic Beacon Sleep Interval</span>
                  <span className="font-mono font-bold text-sky-400">{beaconInterval}s</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={600}
                  value={beaconInterval}
                  onChange={(e) => setBeaconInterval(Number(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSaveConfig}
                  className="px-3 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition disabled:opacity-50"
                >
                  Save Desired State
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCalibrate}
                  className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Re-Calibrate
                </button>
              </div>

              {feedback && (
                <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs">
                  {feedback}
                </div>
              )}
            </div>

            {/* Hardware Fire / Smoke Simulation Trigger */}
            <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 space-y-2.5">
              <div className="text-xs font-bold text-red-300 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-400" /> Emergency Pipeline Stress Test
              </div>
              <button
                type="button"
                onClick={() => onTriggerTestAlarm(sensor)}
                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-red-600/30 transition"
              >
                {t('simulate_alarm')}
              </button>
            </div>
          </>
        )}

        {activeTab === 'attributes' && (
          <div className="space-y-4 text-xs font-mono">
            {/* Scope 1: CLIENT_SCOPE */}
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-sky-500/30 space-y-2">
              <div className="text-sky-400 font-bold uppercase flex items-center justify-between">
                <span>1. CLIENT_SCOPE (Device Reported)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15">Read-Only</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <span className="text-slate-400">chip_id:</span>
                <span className="text-white text-right">{sensor.chip_id}</span>
                <span className="text-slate-400">intro_type_byte:</span>
                <span className="text-emerald-400 text-right">{sensor.intro_type_byte}</span>
                <span className="text-slate-400">firmware_version:</span>
                <span className="text-white text-right">
                  {attrs?.client?.firmware_version || 'v2.4.0-ESP32C3-TB'}
                </span>
                <span className="text-slate-400">reset_reason:</span>
                <span className="text-amber-300 text-right">
                  {attrs?.client?.reset_reason || 'DEEP_SLEEP_TIMER_WAKEUP'}
                </span>
                <span className="text-slate-400">parent_node_id:</span>
                <span className="text-sky-300 text-right">{sensor.parent_node_id}</span>
              </div>
            </div>

            {/* Scope 2: SHARED_SCOPE (Desired vs Reported) */}
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-emerald-500/30 space-y-2.5">
              <div className="text-emerald-400 font-bold uppercase flex items-center justify-between">
                <span>2. SHARED_SCOPE (Desired vs Reported)</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded ${
                    syncStatus === 'SYNCED'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {syncStatus}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[11px] border-b border-slate-800 pb-1.5 text-slate-400">
                <span>Key</span>
                <span className="text-center">Desired</span>
                <span className="text-right">Reported</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <span className="text-slate-300">beacon_sec</span>
                <span className="text-center text-sky-300">
                  {attrs?.shared_desired?.beacon_interval_seconds ?? sensor.beacon_interval_seconds}s
                </span>
                <span className="text-right text-emerald-300">
                  {attrs?.shared_reported?.beacon_interval_seconds ?? sensor.beacon_interval_seconds}s
                </span>

                <span className="text-slate-300">smoke_crit</span>
                <span className="text-center text-sky-300">
                  {attrs?.shared_desired?.smoke_threshold_ppm ?? sensor.smoke_threshold_ppm}
                </span>
                <span className="text-right text-emerald-300">
                  {attrs?.shared_reported?.smoke_threshold_ppm ?? sensor.smoke_threshold_ppm}
                </span>

                <span className="text-slate-300">armed</span>
                <span className="text-center text-sky-300">
                  {String(attrs?.shared_desired?.arm_perimeter ?? sensor.arm_perimeter)}
                </span>
                <span className="text-right text-emerald-300">
                  {String(attrs?.shared_reported?.arm_perimeter ?? sensor.arm_perimeter)}
                </span>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleImmediateWakeupSync}
                className="w-full mt-2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-bold text-xs transition"
              >
                Simulate ESP32-C3 Wakeup &amp; Sync Shared Attributes Now
              </button>
            </div>

            {/* Scope 3: SERVER_SCOPE */}
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-purple-500/30 space-y-2">
              <div className="text-purple-400 font-bold uppercase">
                3. SERVER_SCOPE (Platform Internal)
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <span className="text-slate-400">coord_x / coord_y:</span>
                <span className="text-white text-right">
                  {sensor.coord_x}% / {sensor.coord_y}%
                </span>
                <span className="text-slate-400">inactivity_watchdog:</span>
                <span className="text-white text-right">
                  {attrs?.server?.inactivity_timeout_sec || 1800}s
                </span>
                <span className="text-slate-400">claimed_by_user_id:</span>
                <span className="text-emerald-300 text-right">
                  User #{attrs?.server?.claimed_by_user_id ?? sensor.claimed_by_user_id ?? 3}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rpc' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
              <div className="text-xs font-bold uppercase text-sky-400">
                Dispatch 2-Way RPC Command to {sensor.chip_id}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDispatchRpc('PING_HEARTBEAT')}
                  className="py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-sky-300 border border-slate-700"
                >
                  RPC: PING_HEARTBEAT
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDispatchRpc('WAKEUP_AND_SYNC')}
                  className="py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-emerald-300 border border-slate-700"
                >
                  RPC: WAKEUP_AND_SYNC
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold uppercase text-slate-400">
                Recent RPC Command Queue ({rpcList.length})
              </div>
              {rpcList.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 text-center">
                  No RPC commands recorded for this endpoint yet.
                </div>
              ) : (
                rpcList.map((rpc) => (
                  <div
                    key={rpc.id}
                    className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-mono space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{rpc.method}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          rpc.status === 'ACKED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {rpc.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {rpc.rpc_uid} • {new Date(rpc.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
