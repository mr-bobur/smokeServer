'use client';

import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import { Calendar, Database, Flame, Thermometer } from 'lucide-react';
import { API_BASE } from '../../hooks/useFloorData';
import { SensorEndpointData, TelemetryPoint } from '../../types';

interface TelemetryChartProps {
  sensor?: SensorEndpointData | null;
}

type RangeKey = '24h' | '7d' | '30d' | '1y';

export const TelemetryChart: React.FC<TelemetryChartProps> = ({ sensor }) => {
  const [range, setRange] = useState<RangeKey>('24h');
  const [series, setSeries] = useState<TelemetryPoint[]>([]);
  const [summary, setSummary] = useState<{
    max_smoke_ppm: number;
    avg_smoke_ppm: number;
    max_temp_c: number;
    avg_temp_c: number;
  }>({
    max_smoke_ppm: 64.2,
    avg_smoke_ppm: 34.1,
    max_temp_c: 27.5,
    avg_temp_c: 24.0
  });
  const [loading, setLoading] = useState<boolean>(false);

  const sensorId = sensor?.id || 3;

  useEffect(() => {
    let active = true;
    const loadSeries = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/telemetry?sensor_id=${sensorId}&range=${range}`);
        if (res.ok && active) {
          const data = await res.json();
          setSeries(data.series || []);
          if (data.summary) {
            setSummary(data.summary);
          }
        }
      } catch (err) {
        console.error('Error loading telemetry analytics:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSeries();
    return () => {
      active = false;
    };
  }, [sensorId, range]);

  const rangeButtons: Array<{ key: RangeKey; label: string }> = [
    { key: '24h', label: '24 Hours' },
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '1y', label: '1 Year (Partitioned)' }
  ];

  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 containment-panel">
      {/* Header & Range Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              1-Year Partitioned Historical Telemetry Analytics
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/15 text-sky-300 border border-sky-500/30">
              {sensor ? `${sensor.chip_id} (${sensor.room_number})` : 'C3-9A4F22B8 (Apt 42)'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            MySQL Range Partitioning (`p_2026_q1` .. `p_2026_q4`) • Dual-Axis Smoke PPM &amp; Ambient Temp (°C) with Critical Benchmark Thresholds
          </p>
        </div>

        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          {rangeButtons.map((btn) => (
            <button
              key={btn.key}
              type="button"
              onClick={() => setRange(btn.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                range === btn.key
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3 h-3" />
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block">Avg Smoke Level</span>
            <span className="text-base font-bold font-mono text-sky-300">
              {summary.avg_smoke_ppm} PPM
            </span>
          </div>
          <Flame className="w-5 h-5 text-sky-400/60" />
        </div>
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block">Peak Smoke Spike</span>
            <span
              className={`text-base font-bold font-mono ${
                summary.max_smoke_ppm >= 400 ? 'text-red-400' : 'text-amber-300'
              }`}
            >
              {summary.max_smoke_ppm} PPM
            </span>
          </div>
          <Flame className="w-5 h-5 text-red-400/70" />
        </div>
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block">Avg Temperature</span>
            <span className="text-base font-bold font-mono text-emerald-300">
              {summary.avg_temp_c} °C
            </span>
          </div>
          <Thermometer className="w-5 h-5 text-emerald-400/60" />
        </div>
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block">Peak Temperature</span>
            <span
              className={`text-base font-bold font-mono ${
                summary.max_temp_c >= 60 ? 'text-red-400' : 'text-rose-300'
              }`}
            >
              {summary.max_temp_c} °C
            </span>
          </div>
          <Thermometer className="w-5 h-5 text-rose-400/70" />
        </div>
      </div>

      {/* Dual-Axis Recharts Canvas */}
      <div className="w-full h-[310px] pt-2">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center text-xs font-mono text-slate-400">
            Querying partitioned telemetry_logs table...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="smokeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
              />
              <YAxis
                yAxisId="left"
                domain={[0, 500]}
                stroke="#38bdf8"
                tick={{ fill: '#38bdf8', fontSize: 11 }}
                label={{
                  value: 'Smoke (PPM)',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#38bdf8',
                  fontSize: 11
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 80]}
                stroke="#fb7185"
                tick={{ fill: '#fb7185', fontSize: 11 }}
                label={{
                  value: 'Temperature (°C)',
                  angle: 90,
                  position: 'insideRight',
                  fill: '#fb7185',
                  fontSize: 11
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '12px',
                  fontSize: '12px'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />

              {/* Benchmark Red Dashed Threshold Lines (400 PPM & 60°C) */}
              <ReferenceLine
                yAxisId="left"
                y={400}
                stroke="#ef4444"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{
                  value: 'CRITICAL SMOKE (400 PPM)',
                  fill: '#f87171',
                  fontSize: 10,
                  position: 'insideTopLeft'
                }}
              />
              <ReferenceLine
                yAxisId="right"
                y={60}
                stroke="#f97316"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: 'CRITICAL TEMP (60°C)',
                  fill: '#fb923c',
                  fontSize: 10,
                  position: 'insideTopRight'
                }}
              />

              <Area
                yAxisId="left"
                type="monotone"
                dataKey="smoke_ppm"
                name="Smoke Concentration (PPM)"
                stroke="#38bdf8"
                fill="url(#smokeGrad)"
                strokeWidth={2}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="temperature"
                name="Ambient Temp (°C)"
                stroke="#fb7185"
                strokeWidth={2.2}
                dot={{ r: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
