'use client';

import React from 'react';
import {
  Flame,
  PhoneCall,
  CheckCircle,
  ShieldAlert,
  Radio,
  Volume2,
  X
} from 'lucide-react';
import { AlarmEventData } from '../../types';

interface EmergencyBannerProps {
  alarm: AlarmEventData | null;
  onAcknowledgeFalseAlarm: (alarmId: number) => void;
  onDispatch112Immediately: (alarmId: number) => void;
  onDismissModal: () => void;
}

export const EmergencyBanner: React.FC<EmergencyBannerProps> = ({
  alarm,
  onAcknowledgeFalseAlarm,
  onDispatch112Immediately,
  onDismissModal
}) => {
  if (!alarm) return null;

  const isDispatched = alarm.status === 'escalated_to_112';
  const remaining = alarm.countdown_remaining_sec ?? 0;
  const pct = Math.max(0, Math.min(100, (remaining / 60) * 100));

  return (
    <div className="fixed inset-0 z-50 bg-red-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-950 border-2 border-red-500 shadow-[0_0_80px_rgba(239,68,68,0.75)] overflow-hidden">
        {/* Flashing Top Strobe Bar */}
        <div className="px-6 py-4 bg-gradient-to-r from-red-700 via-red-600 to-amber-600 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Flame className="w-6 h-6 text-white animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-black/40 text-white font-mono text-xs font-bold">
                  {alarm.alarm_code}
                </span>
                <span className="text-xs font-mono uppercase tracking-widest text-red-100">
                  QoS 2 PRIORITY ALARM • SIM7670 SMS &amp; VOICE TRIGGERED
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-white tracking-wide">
                {isDispatched
                  ? '112 STATE EMERGENCY API DISPATCHED (FVV UZBEKISTAN)'
                  : `CRITICAL HAZARD: ${alarm.event_type} — FLOOR ${alarm.floor_number}, ${alarm.room_number}`}
              </h2>
            </div>
          </div>

          <button
            onClick={onDismissModal}
            className="p-1.5 rounded-lg bg-black/30 text-white hover:bg-black/50 transition"
            title="Minimize Overlay"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {/* Sensor Telemetry Snapshot */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-red-500/40">
              <span className="text-xs text-slate-400 block">Location &amp; Node</span>
              <span className="text-base font-bold text-white">
                Floor {alarm.floor_number} • {alarm.room_number}
              </span>
              <span className="text-xs font-mono text-red-300 block mt-0.5">
                ESP32-C3: {alarm.chip_id}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-red-500/40">
              <span className="text-xs text-slate-400 block">MQ-2 Smoke Reading</span>
              <span className="text-2xl font-extrabold font-mono text-red-400">
                {alarm.smoke_val ?? 680.5} PPM
              </span>
              <span className="text-[11px] text-slate-400 block">Threshold: 400 PPM</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-red-500/40">
              <span className="text-xs text-slate-400 block">DS18B20 Temperature</span>
              <span className="text-2xl font-extrabold font-mono text-amber-400">
                {alarm.temp_val ?? 62.4} °C
              </span>
              <span className="text-[11px] text-slate-400 block">Threshold: 60.0 °C</span>
            </div>
          </div>

          {/* 60-Second Grace Period Countdown OR 112 Dispatch Confirmation */}
          {!isDispatched ? (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-red-200">
                  <Volume2 className="w-4 h-4 text-red-400 animate-ping" />
                  <span>Automated 112 State Emergency Escalation Countdown</span>
                </div>
                <span className="text-2xl font-mono font-black text-white bg-red-600 px-3 py-1 rounded-lg">
                  {remaining}s
                </span>
              </div>

              <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden border border-red-500/40">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <p className="text-xs text-slate-300">
                SIM7670 4G Gateway has transmitted emergency SMS (`AT+CMGS`) and initiated voice alert (`ATD+998712000000;`). If not acknowledged within{' '}
                <strong className="text-white">{remaining} seconds</strong>, the system will automatically dispatch fire brigade coordinates to the{' '}
                <strong className="text-amber-300">112 State Emergency API</strong>.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onAcknowledgeFalseAlarm(alarm.id)}
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition"
                >
                  <CheckCircle className="w-4 h-4" />
                  Acknowledge False Alarm (Cancel 112)
                </button>

                <button
                  type="button"
                  onClick={() => onDispatch112Immediately(alarm.id)}
                  className="py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/40 transition"
                >
                  <PhoneCall className="w-4 h-4" />
                  Dispatch 112 Fire Brigade Now
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
                  112 State Emergency API Payload Dispatched
                </span>
                <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono">
                  HTTP 200 • UNIT EN ROUTE (ETA 5 MIN)
                </span>
              </div>

              <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-sky-300 overflow-x-auto">
                {JSON.stringify(
                  alarm.emergency_112_payload || {
                    agency_code: 'EMERGENCY_UZ_112',
                    building_id: 'SMART-BLD-TASHKENT-09',
                    address: 'Amir Timur Avenue 108, Block B',
                    floor_number: alarm.floor_number,
                    room_number: alarm.room_number,
                    threat_type: 'FIRE_SMOKE_HAZARD'
                  },
                  null,
                  2
                )}
              </pre>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onAcknowledgeFalseAlarm(alarm.id)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <ShieldAlert className="w-4 h-4 text-emerald-400" /> Mark Incident Contained &amp; Reset Siren
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
