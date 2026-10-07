'use client';

import React from 'react';
import { Layers, AlertTriangle, BatteryWarning, CheckCircle2 } from 'lucide-react';
import { FloorData } from '../../types';

interface FloorSelectorProps {
  floors: FloorData[];
  selectedFloor: number;
  onSelectFloor: (floorNumber: number) => void;
}

export const FloorSelector: React.FC<FloorSelectorProps> = ({
  floors,
  selectedFloor,
  onSelectFloor
}) => {
  const sortedFloors = [...floors].sort((a, b) => b.floor_number - a.floor_number);

  return (
    <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3 containment-panel">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            9-Story Isometric Stack
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400">RS485 Trunk</span>
      </div>

      <div className="space-y-1.5">
        {sortedFloors.map((fl) => {
          const isSelected = fl.floor_number === selectedFloor;
          const hasAlarm = (fl.stats?.alarm_sensors || 0) > 0 || (fl.stats?.active_alarms_count || 0) > 0;
          const hasWarn =
            fl.hub_status === 'battery_warning' || (fl.stats?.warning_sensors || 0) > 0;

          return (
            <button
              key={fl.floor_number}
              type="button"
              onClick={() => onSelectFloor(fl.floor_number)}
              className={`w-full px-3 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                hasAlarm
                  ? 'bg-red-950/60 border-red-500/80 text-white animate-pulse'
                  : isSelected
                    ? 'bg-sky-600/20 border-sky-400 text-white shadow-lg shadow-sky-500/10'
                    : 'bg-slate-950/70 border-slate-800/80 text-slate-300 hover:bg-slate-800/70 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-7 h-7 rounded-lg font-mono text-xs font-bold flex items-center justify-center shrink-0 ${
                    hasAlarm
                      ? 'bg-red-600 text-white'
                      : isSelected
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  F{fl.floor_number}
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold truncate">{fl.name}</div>
                  <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2">
                    <span>DIP:{fl.dip_binary}</span>
                    <span>•</span>
                    <span>{fl.rs485_latency_ms}ms</span>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-1.5 shrink-0">
                {hasAlarm ? (
                  <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> ALARM
                  </span>
                ) : hasWarn ? (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono flex items-center gap-1">
                    <BatteryWarning className="w-3 h-3" /> WARN
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {fl.stats?.total_sensors || 9}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
