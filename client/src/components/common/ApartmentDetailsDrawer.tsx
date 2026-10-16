'use client';

import React from 'react';
import {
  X,
  Building2,
  DoorOpen,
  Flame,
  Thermometer,
  Wind,
  ShieldAlert,
  Radio,
  Battery,
  BatteryWarning,
  Signal,
  User,
  Mail,
  Phone,
  Clock,
  Sliders,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Shield,
  WifiOff
} from 'lucide-react';
import {
  BuildingData,
  PerimeterSecurityStatus,
  RoomApartmentData,
  SensorEndpointData,
  SensorType,
  UserProfile
} from '../../types';

interface ApartmentDetailsDrawerProps {
  apartment: RoomApartmentData | null;
  building?: BuildingData;
  sensors: SensorEndpointData[];
  users: UserProfile[];
  onClose: () => void;
  onAssignOwner: (roomId: number, ownerUserId: number | null) => Promise<void>;
  onUpdatePerimeter: (roomId: number, status: PerimeterSecurityStatus) => Promise<void>;
  onEditApartment: (apt: RoomApartmentData) => void;
  onDeleteApartment: (aptId: number) => Promise<void>;
  onSelectSensor: (sensor: SensorEndpointData) => void;
}

export const ApartmentDetailsDrawer: React.FC<ApartmentDetailsDrawerProps> = ({
  apartment,
  building,
  sensors,
  users,
  onClose,
  onAssignOwner,
  onUpdatePerimeter,
  onEditApartment,
  onDeleteApartment,
  onSelectSensor
}) => {
  if (!apartment) return null;

  // Filter sensors belonging to this apartment
  const aptSensors = sensors.filter((s) => s.room_id === apartment.id);

  // Health / summary flags
  const hasAlarm = aptSensors.some((s) => s.status === 'alarm');
  const hasLowBattery = aptSensors.some(
    (s) => (s.battery_level !== undefined && s.battery_level <= 20) || s.status === 'warning'
  );
  const hasOffline = aptSensors.some((s) => s.status === 'offline');

  const getSensorTypeInfo = (type: SensorType) => {
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
          name: 'Eshik/Deraza datchigi (Reed)',
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

  const getPerimeterLabel = (status: PerimeterSecurityStatus) => {
    switch (status) {
      case 'armed_away':
        return {
          label: 'Kuzatuvda (Uydan chiqdim)',
          color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
        };
      case 'armed_home':
        return {
          label: 'Kuzatuvda (Uydaman)',
          color: 'bg-sky-500/20 text-sky-300 border-sky-500/40'
        };
      case 'disarmed':
      default:
        return {
          label: 'Himoya o‘chiq (Disarmed)',
          color: 'bg-slate-800 text-slate-400 border-slate-700'
        };
    }
  };

  const currentOwner = users.find((u) => u.id === apartment.owner_user_id);
  const perimeterInfo = getPerimeterLabel(apartment.perimeter_security_status);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Drawer Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-slate-900/95 border-l border-slate-800 backdrop-blur-2xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <DoorOpen className="w-6 h-6 text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white truncate">
                  {apartment.room_number}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                    hasAlarm
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse'
                      : hasLowBattery
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : hasOffline
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {hasAlarm
                    ? 'YONG‘IN XAVFI'
                    : hasLowBattery
                      ? 'BATAREYKA KAM'
                      : hasOffline
                        ? 'ALOQASIZ'
                        : 'NORMAL'}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{building?.name || 'Bino'}</span>
                <span>•</span>
                <span className="font-semibold text-slate-300">{apartment.floor_number}-qavat</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition shrink-0"
            title="Yopish (Close)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div className="p-4 sm:p-5 space-y-5 overflow-y-auto flex-1">
          {/* Quick Warning Banners if Any */}
          {hasAlarm && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2.5 shadow-lg shadow-rose-950/40 animate-pulse">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>Diqqat!</strong> Ushbu xonadondagi datchikda yong‘in yoki xavf aniqlandi!
              </span>
            </div>
          )}

          {hasLowBattery && (
            <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2.5">
              <BatteryWarning className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Ogohlantirish:</strong> Xonadondagi datchik batareyasi 20% dan kam qolgan.
              </span>
            </div>
          )}

          {/* 1. XONADON EGASI (APARTMENT OWNER) */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <User className="w-4 h-4 text-amber-400" />
                Xonadon Egasi
              </span>
              <span className="text-[10px] font-mono text-slate-500">ID: #{apartment.id}</span>
            </div>

            {currentOwner ? (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{currentOwner.name}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{currentOwner.email}</span>
                  </div>
                  {currentOwner.phone_number && (
                    <div className="text-xs text-sky-400 flex items-center gap-1.5 font-mono">
                      <Phone className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <a
                        href={`tel:${currentOwner.phone_number}`}
                        className="hover:underline hover:text-sky-300"
                      >
                        {currentOwner.phone_number}
                      </a>
                    </div>
                  )}
                </div>

                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                  Biriktirilgan
                </span>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-900/60 border border-dashed border-slate-800 text-center py-4">
                <p className="text-xs text-slate-400">Bu xonadonga hali yashovchi biriktirilmagan.</p>
              </div>
            )}

            {/* Change Owner Dropdown */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] text-slate-400 block font-semibold">
                Egasini almashtirish yoki tayinlash:
              </label>
              <select
                value={apartment.owner_user_id || ''}
                onChange={(e) =>
                  onAssignOwner(
                    apartment.id,
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500 transition"
              >
                <option value="">-- Egasi biriktirilmagan --</option>
                {users
                  .filter((u) => u.role === 'user' || u.role === 'tenant')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email}) {u.phone_number ? `• ${u.phone_number}` : ''}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* 2. PERIMETR XAVFSIZLIGI (PERIMETER SECURITY MODE) */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Shield className="w-4 h-4 text-sky-400" />
                Perimetr Xavfsizligi
              </span>
              <span
                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold uppercase border ${perimeterInfo.color}`}
              >
                {perimeterInfo.label}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onUpdatePerimeter(apartment.id, 'armed_away')}
                className={`py-2 px-2.5 rounded-xl text-[11px] font-bold border transition text-center ${
                  apartment.perimeter_security_status === 'armed_away'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-950/40'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                ARM AWAY
              </button>
              <button
                type="button"
                onClick={() => onUpdatePerimeter(apartment.id, 'armed_home')}
                className={`py-2 px-2.5 rounded-xl text-[11px] font-bold border transition text-center ${
                  apartment.perimeter_security_status === 'armed_home'
                    ? 'bg-sky-600 text-white border-sky-500 shadow-lg shadow-sky-950/40'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                ARM HOME
              </button>
              <button
                type="button"
                onClick={() => onUpdatePerimeter(apartment.id, 'disarmed')}
                className={`py-2 px-2.5 rounded-xl text-[11px] font-bold border transition text-center ${
                  apartment.perimeter_security_status === 'disarmed'
                    ? 'bg-slate-700 text-white border-slate-600'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                DISARM
              </button>
            </div>
          </div>

          {/* 3. XONADONDAGI DATCHIKLAR VA QURILMALAR RO'YXATI */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                Qurilmalar va Datchiklar ({aptSensors.length})
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                1 Qurilma = 1 Datchik
              </span>
            </div>

            {aptSensors.length === 0 ? (
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-2">
                <Radio className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  Ushbu xonadonda hali birorta ham datchik o‘rnatilmagan.
                </p>
                <p className="text-[11px] text-slate-500">
                  Qurilmani ulash uchun qavat chizmasi orqali drag-and-drop qiling.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {aptSensors.map((sensor) => {
                  const typeInfo = getSensorTypeInfo(sensor.sensor_type);
                  const Icon = typeInfo.icon;
                  const isLowBat =
                    (sensor.battery_level !== undefined && sensor.battery_level <= 20) ||
                    sensor.status === 'warning';
                  const isAlarm = sensor.status === 'alarm';
                  const isOffline = sensor.status === 'offline';

                  let batColor = 'bg-emerald-500';
                  if (sensor.battery_level <= 20) batColor = 'bg-rose-500';
                  else if (sensor.battery_level <= 45) batColor = 'bg-amber-500';

                  return (
                    <div
                      key={sensor.id}
                      className={`p-4 rounded-2xl border transition space-y-3 ${
                        isAlarm
                          ? 'bg-rose-950/30 border-rose-500/60 shadow-lg shadow-rose-950/20'
                          : isLowBat
                            ? 'bg-amber-950/20 border-amber-500/50'
                            : isOffline
                              ? 'bg-slate-950/90 border-slate-800/80 opacity-80'
                              : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Device Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${typeInfo.color}`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-white block truncate">
                              {typeInfo.name}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400 block truncate">
                              Chip: <strong className="text-sky-400">{sensor.chip_id}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
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
                      </div>

                      {/* Battery Indicator Bar */}
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                            {isLowBat ? (
                              <BatteryWarning className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Battery className="w-4 h-4 text-emerald-400" />
                            )}
                            Batareyka (CR123A/LiPo):
                          </span>
                          <span
                            className={`font-mono font-bold ${
                              isLowBat ? 'text-amber-300' : 'text-emerald-400'
                            }`}
                          >
                            {sensor.battery_level}%{' '}
                            {isLowBat && (
                              <span className="text-[10px] font-sans font-bold text-rose-400">
                                (KAM!)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${batColor}`}
                            style={{ width: `${Math.max(5, sensor.battery_level)}%` }}
                          />
                        </div>
                        {isLowBat && (
                          <p className="text-[10px] text-amber-400/90 font-medium">
                            ⚠️ Zaryad darajasi kam. Batareyani yangilash zarur.
                          </p>
                        )}
                      </div>

                      {/* Live Telemetry Value & Connection Info */}
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                          <span className="text-[10px] text-slate-500 block uppercase font-sans">
                            Jonli Ko‘rsatkich
                          </span>
                          <span className="text-sm font-bold text-white">
                            {sensor.sensor_type === 'SMOKE_MQ2' && (
                              <span
                                className={
                                  sensor.smoke_ppm > 300 ? 'text-rose-400' : 'text-emerald-400'
                                }
                              >
                                {sensor.smoke_ppm} PPM
                              </span>
                            )}
                            {sensor.sensor_type === 'TEMP_DS18B20' && (
                              <span
                                className={
                                  sensor.temperature > 50 ? 'text-rose-400' : 'text-sky-300'
                                }
                              >
                                {sensor.temperature} °C
                              </span>
                            )}
                            {sensor.sensor_type === 'DOOR_REED' && (
                              <span
                                className={
                                  sensor.reed_switch_open ? 'text-rose-400' : 'text-emerald-400'
                                }
                              >
                                {sensor.reed_switch_open ? 'OCHIQ' : 'YOPIQ'}
                              </span>
                            )}
                            {sensor.sensor_type === 'CO_MQ7' && (
                              <span
                                className={
                                  sensor.co_ppm > 50 ? 'text-rose-400' : 'text-amber-300'
                                }
                              >
                                {sensor.co_ppm} PPM
                              </span>
                            )}
                            {sensor.sensor_type === 'GLASS_BREAK' && (
                              <span
                                className={
                                  sensor.glass_break_detected ? 'text-rose-400' : 'text-emerald-400'
                                }
                              >
                                {sensor.glass_break_detected ? 'SINISH!' : 'BUTUN'}
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                          <span className="text-[10px] text-slate-500 block uppercase font-sans">
                            Aloqa &amp; Signal
                          </span>
                          <span className="text-xs text-sky-400 flex items-center gap-1 font-bold">
                            <Signal className="w-3 h-3 text-sky-400" />
                            {sensor.rssi_dbm} dBm
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                            {sensor.parent_node_id}
                          </span>
                        </div>
                      </div>

                      {/* Action to Inspect Sensor Modal */}
                      <button
                        type="button"
                        onClick={() => onSelectSensor(sensor)}
                        className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                      >
                        <Sliders className="w-3.5 h-3.5 text-amber-400" />
                        <span>Datchik Parametrlari &amp; Telemetriyasi (Inspect)</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onEditApartment(apartment)}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 transition"
          >
            <Pencil className="w-3.5 h-3.5 text-amber-400" />
            <span>Tahrirlash</span>
          </button>

          <button
            type="button"
            onClick={() => onDeleteApartment(apartment.id)}
            className="py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white text-xs font-bold flex items-center justify-center gap-2 border border-rose-500/30 hover:border-rose-500 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>O‘chirish</span>
          </button>
        </div>
      </div>
    </>
  );
};
