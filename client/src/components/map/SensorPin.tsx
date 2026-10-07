'use client';

import React from 'react';
import {
  Flame,
  ShieldAlert,
  Thermometer,
  Wind,
  WifiOff,
  DoorOpen,
  Radio
} from 'lucide-react';
import { SensorEndpointData } from '../../types';

interface SensorPinProps {
  sensor: SensorEndpointData;
  isSelected?: boolean;
  isDragMode?: boolean;
  onSelect: (sensor: SensorEndpointData) => void;
  onDragStart?: (e: React.MouseEvent, sensor: SensorEndpointData) => void;
}

export const SensorPin: React.FC<SensorPinProps> = ({
  sensor,
  isSelected,
  isDragMode,
  onSelect,
  onDragStart
}) => {
  const isLowBat = sensor.battery_level > 0 && sensor.battery_level < 25;
  const effectiveStatus =
    sensor.status === 'alarm'
      ? 'alarm'
      : sensor.status === 'offline'
        ? 'offline'
        : sensor.status === 'warning' ||
            isLowBat ||
            (sensor.sensor_type === 'SMOKE_MQ2' && sensor.smoke_ppm > 180) ||
            (sensor.sensor_type === 'TEMP_DS18B20' && sensor.temperature > 42)
          ? 'warning'
          : sensor.status === 'pairing'
            ? 'pairing'
            : 'online';

  // Strictly format the SINGLE sensor metric according to the device's dedicated type
  const getSingleSensorMetricLabel = (): string => {
    if (effectiveStatus === 'offline') return 'OFFLINE';
    if (isLowBat) return `BAT ${sensor.battery_level}%`;

    switch (sensor.sensor_type) {
      case 'SMOKE_MQ2':
        return `SMOKE: ${sensor.smoke_ppm} PPM`;
      case 'TEMP_DS18B20':
        return `TEMP: ${sensor.temperature} °C`;
      case 'DOOR_REED':
        return sensor.reed_switch_open ? 'DOOR: OPEN' : 'DOOR: CLOSED';
      case 'CO_MQ7':
        return `CO: ${sensor.co_ppm} PPM`;
      case 'GLASS_BREAK':
        return sensor.glass_break_detected ? 'GLASS: BROKEN' : 'GLASS: OK';
      default:
        return `${sensor.smoke_ppm} PPM`;
    }
  };

  const getVisualConfig = () => {
    const metricText = getSingleSensorMetricLabel();
    switch (effectiveStatus) {
      case 'alarm':
        return {
          ring: 'bg-red-500/40 border-red-400 animate-strobe-ring',
          core: 'bg-red-600 border-red-200 shadow-[0_0_24px_rgba(239,68,68,0.95)]',
          badge: 'bg-red-950/95 text-red-200 border-red-500/60',
          label: metricText
        };
      case 'warning':
        return {
          ring: 'bg-amber-500/35 border-amber-400 animate-ping-slow',
          core: 'bg-amber-500 border-amber-100 shadow-[0_0_16px_rgba(245,158,11,0.85)]',
          badge: 'bg-amber-950/95 text-amber-200 border-amber-500/60',
          label: metricText
        };
      case 'offline':
        return {
          ring: 'bg-slate-600/20 border-slate-500 opacity-50',
          core: 'bg-slate-700 border-slate-400 opacity-70',
          badge: 'bg-slate-900/95 text-slate-400 border-slate-600',
          label: 'OFFLINE'
        };
      case 'pairing':
        return {
          ring: 'bg-sky-500/40 border-sky-300 animate-ping',
          core: 'bg-sky-500 border-white shadow-[0_0_18px_rgba(14,165,233,0.9)]',
          badge: 'bg-sky-950/95 text-sky-200 border-sky-400',
          label: 'INTRO HANDSHAKE'
        };
      default:
        return {
          ring: 'bg-emerald-500/20 border-emerald-400/50',
          core: 'bg-emerald-500 border-emerald-100 shadow-[0_0_14px_rgba(16,185,129,0.75)]',
          badge: 'bg-slate-900/90 text-emerald-300 border-emerald-500/40',
          label: metricText
        };
    }
  };

  const renderIcon = () => {
    if (effectiveStatus === 'alarm') {
      return <Flame className="w-4 h-4 text-white animate-bounce" />;
    }
    if (effectiveStatus === 'offline') {
      return <WifiOff className="w-3.5 h-3.5 text-slate-300" />;
    }
    switch (sensor.sensor_type) {
      case 'SMOKE_MQ2':
        return <Flame className="w-3.5 h-3.5 text-white" />;
      case 'CO_MQ7':
        return <Wind className="w-3.5 h-3.5 text-white" />;
      case 'TEMP_DS18B20':
        return <Thermometer className="w-3.5 h-3.5 text-white" />;
      case 'DOOR_REED':
        return <DoorOpen className="w-3.5 h-3.5 text-white" />;
      case 'GLASS_BREAK':
        return <ShieldAlert className="w-3.5 h-3.5 text-white" />;
      default:
        return <Radio className="w-3.5 h-3.5 text-white" />;
    }
  };

  const cfg = getVisualConfig();

  return (
    <div
      style={{
        left: `${sensor.coord_x}%`,
        top: `${sensor.coord_y}%`
      }}
      onMouseDown={(e) => {
        if (isDragMode && onDragStart) {
          e.stopPropagation();
          onDragStart(e, sensor);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(sensor);
      }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 group select-none ${
        isDragMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      }`}
    >
      <div
        className={`absolute -inset-2.5 rounded-full border ${cfg.ring} pointer-events-none`}
      />

      {effectiveStatus === 'alarm' && (
        <div className="absolute -inset-5 rounded-full border-2 border-red-500/70 animate-ping pointer-events-none" />
      )}

      <div
        className={`relative w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform duration-150 ${
          cfg.core
        } ${isSelected ? 'scale-125 ring-4 ring-sky-400/70' : 'group-hover:scale-110'}`}
      >
        {renderIcon()}
      </div>

      <div
        className={`mt-1 px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap border backdrop-blur-md shadow-lg flex items-center gap-1.5 transition-all ${
          cfg.badge
        } ${isSelected ? 'ring-1 ring-sky-400' : ''}`}
      >
        <span className="font-bold">{sensor.chip_id.replace('C3-', '')}</span>
        <span className="opacity-80">|</span>
        <span>{cfg.label}</span>
      </div>
    </div>
  );
};
