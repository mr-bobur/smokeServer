'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Filter,
  Flame,
  History,
  Layers,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Thermometer,
  User,
  Wind,
  X
} from 'lucide-react';
import {
  AlarmEventData,
  AlarmManagedStatus,
  AlarmStatusHistoryItem,
  BuildingData,
  FloorData,
  SensorEndpointData
} from '../../types';

interface AlarmManagementSectionProps {
  alarms: AlarmEventData[];
  buildings?: BuildingData[];
  floors?: FloorData[];
  selectedBuildingId?: number;
  onUpdateAlarmStatus: (params: {
    alarmId: number;
    status: AlarmManagedStatus;
    resolution_outcome?: string;
    comment?: string;
  }) => Promise<AlarmEventData | null>;
  onTriggerTestAlarm?: (params: {
    event_type?: string;
    severity?: 'warning' | 'critical' | 'emergency';
    smoke_val?: number;
    temp_val?: number;
    floor?: number;
  }) => Promise<AlarmEventData | null>;
  onRefreshAlarms?: () => Promise<void>;
  userRole?: 'super_admin' | 'tenant' | 'user';
}

const RESOLUTION_TEMPLATES = [
  "Xavf to'liq bartaraf etildi, datchik normaga qaytdi",
  "Soxta signal (ovqat/tutun), tekshirildi va bekor qilindi",
  "112 FVV brigadasi jalb qilindi, voqea bartaraf etildi",
  "Xonadon shamollatildi, datchik ko'rsatkichi pasaydi",
  "Datchik texnik ko'rikdan o'tkazildi va qayta sozlandi"
];

export const AlarmManagementSection: React.FC<AlarmManagementSectionProps> = ({
  alarms,
  buildings = [],
  floors = [],
  selectedBuildingId,
  onUpdateAlarmStatus,
  onTriggerTestAlarm,
  onRefreshAlarms,
  userRole = 'tenant'
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | AlarmManagedStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [floorFilter, setFloorFilter] = useState<number | 'all'>('all');
  const [buildingFilter, setBuildingFilter] = useState<number | 'all'>(
    selectedBuildingId || 'all'
  );
  const [busyAlarmId, setBusyAlarmId] = useState<number | null>(null);

  // Modals state
  const [statusModalAlarm, setStatusModalAlarm] = useState<AlarmEventData | null>(null);
  const [selectedNewStatus, setSelectedNewStatus] = useState<AlarmManagedStatus>('seen_alarm');
  const [resolutionOutcome, setResolutionOutcome] = useState('');
  const [statusComment, setStatusComment] = useState('');

  const [historyModalAlarm, setHistoryModalAlarm] = useState<AlarmEventData | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testSmokeVal, setTestSmokeVal] = useState(720);
  const [testTempVal, setTestTempVal] = useState(64);
  const [testFloor, setTestFloor] = useState(1);
  const [testEventType, setTestEventType] = useState('SMOKE_CRITICAL');

  // Compute normalized status for any alarm
  const getNormalizedStatus = (alm: AlarmEventData): AlarmManagedStatus => {
    if (alm.managed_status) return alm.managed_status;
    if (alm.status === 'resolved') return 'managed_alarm';
    if (alm.status === 'acknowledged') return 'seen_alarm';
    return 'new_alarm';
  };

  // Counts for 3 states
  const counts = useMemo(() => {
    let newCount = 0;
    let seenCount = 0;
    let managedCount = 0;

    for (const a of alarms) {
      const st = getNormalizedStatus(a);
      if (st === 'new_alarm') newCount++;
      else if (st === 'seen_alarm') seenCount++;
      else if (st === 'managed_alarm') managedCount++;
    }

    return {
      all: alarms.length,
      new_alarm: newCount,
      seen_alarm: seenCount,
      managed_alarm: managedCount
    };
  }, [alarms]);

  // Filtered alarms list
  const filteredAlarms = useMemo(() => {
    return alarms.filter((alm) => {
      const st = getNormalizedStatus(alm);
      if (filterStatus !== 'all' && st !== filterStatus) return false;
      if (floorFilter !== 'all' && alm.floor_number !== floorFilter) return false;
      if (buildingFilter !== 'all' && alm.building_id && alm.building_id !== buildingFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = alm.alarm_code.toLowerCase().includes(q);
        const matchesChip = alm.chip_id.toLowerCase().includes(q);
        const matchesRoom = alm.room_number.toLowerCase().includes(q);
        const matchesEvent = alm.event_type.toLowerCase().includes(q);
        const matchesOutcome = (alm.resolution_outcome || '').toLowerCase().includes(q);
        return matchesCode || matchesChip || matchesRoom || matchesEvent || matchesOutcome;
      }

      return true;
    });
  }, [alarms, filterStatus, floorFilter, buildingFilter, searchQuery]);

  const openStatusModal = (alm: AlarmEventData, targetStatus?: AlarmManagedStatus) => {
    setStatusModalAlarm(alm);
    const curr = getNormalizedStatus(alm);
    setSelectedNewStatus(targetStatus || (curr === 'new_alarm' ? 'seen_alarm' : curr === 'seen_alarm' ? 'managed_alarm' : 'managed_alarm'));
    setResolutionOutcome(alm.resolution_outcome || (targetStatus === 'managed_alarm' ? RESOLUTION_TEMPLATES[0] : ''));
    setStatusComment('');
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalAlarm) return;

    setBusyAlarmId(statusModalAlarm.id);
    try {
      await onUpdateAlarmStatus({
        alarmId: statusModalAlarm.id,
        status: selectedNewStatus,
        resolution_outcome: resolutionOutcome.trim() || undefined,
        comment: statusComment.trim() || undefined
      });
      setStatusModalAlarm(null);
    } finally {
      setBusyAlarmId(null);
    }
  };

  const handleQuickStatusChange = async (
    alm: AlarmEventData,
    newStatus: AlarmManagedStatus,
    outcome: string
  ) => {
    setBusyAlarmId(alm.id);
    try {
      await onUpdateAlarmStatus({
        alarmId: alm.id,
        status: newStatus,
        resolution_outcome: outcome,
        comment: `Tezkor o'zgartirish: ${newStatus}`
      });
    } finally {
      setBusyAlarmId(null);
    }
  };

  const handleRunTestSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onTriggerTestAlarm) return;
    setBusyAlarmId(-1);
    try {
      await onTriggerTestAlarm({
        event_type: testEventType,
        severity: 'critical',
        smoke_val: Number(testSmokeVal),
        temp_val: Number(testTempVal),
        floor: Number(testFloor)
      });
      setTestModalOpen(false);
      if (onRefreshAlarms) {
        await onRefreshAlarms();
      }
    } finally {
      setBusyAlarmId(null);
    }
  };

  const getStatusBadge = (status: AlarmManagedStatus) => {
    switch (status) {
      case 'new_alarm':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-950 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Yangi signal (New Alarm)
          </span>
        );
      case 'seen_alarm':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-950">
            <Eye className="w-3 h-3 text-amber-400" />
            Ko‘rilgan signal (Seen Alarm)
          </span>
        );
      case 'managed_alarm':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-950">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Boshqarilgan / Hal qilingan
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Metric Summary */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-tight">
                  Alarmlarni Boshqarish va Tarix Jurnali
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {userRole === 'super_admin'
                    ? 'ADMIN NAZORATI'
                    : userRole === 'user'
                      ? 'XONADON XAVFSIZLIGI (USER)'
                      : 'SHIRKAT BOSHQARUVI'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Har bir signalning kelib tushishi, ko‘rilishi va qanday yakunlangani bo‘yicha to‘liq tarixi va 3 bosqichli status boshqaruvi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onRefreshAlarms && (
              <button
                type="button"
                onClick={() => onRefreshAlarms()}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                title="Ro'yxatni yangilash"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Yangilash
              </button>
            )}
            {onTriggerTestAlarm && (
              <button
                type="button"
                onClick={() => setTestModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-900/30 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Test Signalini Ishga Tushirish
              </button>
            )}
          </div>
        </div>

        {/* 3 Core Status Tabs (Filter Pills) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {/* 1. All */}
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`p-3.5 rounded-xl border text-left transition ${
              filterStatus === 'all'
                ? 'bg-sky-500/15 border-sky-400 text-white shadow-lg shadow-sky-950'
                : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Barcha Signallar
              </span>
              <Layers className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-xl font-mono font-black text-white">{counts.all}</div>
            <span className="text-[10px] text-slate-500 block mt-0.5">Umumiy ro‘yxat</span>
          </button>

          {/* 2. New Alarm */}
          <button
            type="button"
            onClick={() => setFilterStatus('new_alarm')}
            className={`p-3.5 rounded-xl border text-left transition relative overflow-hidden ${
              filterStatus === 'new_alarm'
                ? 'bg-rose-500/20 border-rose-500 text-white shadow-lg shadow-rose-950'
                : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            {counts.new_alarm > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300">
                Yangi Signallar
              </span>
              <AlertOctagon className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-xl font-mono font-black text-rose-400">{counts.new_alarm}</div>
            <span className="text-[10px] text-rose-300/80 block mt-0.5">
              Hali ko‘rilmagan (New Alarm)
            </span>
          </button>

          {/* 3. Seen Alarm */}
          <button
            type="button"
            onClick={() => setFilterStatus('seen_alarm')}
            className={`p-3.5 rounded-xl border text-left transition ${
              filterStatus === 'seen_alarm'
                ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg shadow-amber-950'
                : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                Ko‘rilgan Signallar
              </span>
              <Eye className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-mono font-black text-amber-400">{counts.seen_alarm}</div>
            <span className="text-[10px] text-amber-300/80 block mt-0.5">
              Tekshirilmoqda (Seen Alarm)
            </span>
          </button>

          {/* 4. Managed Alarm */}
          <button
            type="button"
            onClick={() => setFilterStatus('managed_alarm')}
            className={`p-3.5 rounded-xl border text-left transition ${
              filterStatus === 'managed_alarm'
                ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-lg shadow-emerald-950'
                : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                Hal Qilingan Signallar
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-mono font-black text-emerald-400">
              {counts.managed_alarm}
            </div>
            <span className="text-[10px] text-emerald-300/80 block mt-0.5">
              Yakunlangan (Managed Alarm)
            </span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Alarm kodi, xonadon, qavat, datchik chip ID yoki xulosa bo'yicha qidirish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-xs"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-2 py-1.5 text-slate-400 hover:text-white"
            >
              Tozalash
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {buildings.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Bino:</span>
              <select
                value={buildingFilter}
                onChange={(e) =>
                  setBuildingFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
                }
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs"
              >
                <option value="all">Barcha binolar</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Qavat:</span>
            <select
              value={floorFilter}
              onChange={(e) =>
                setFloorFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs"
            >
              <option value="all">Barcha qavatlar</option>
              {floors.map((f) => (
                <option key={f.id} value={f.floor_number}>
                  {f.floor_number}-qavat ({f.name})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Alarms Cards List */}
      <div className="space-y-4">
        {filteredAlarms.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto opacity-70" />
            <div className="text-base font-bold text-white">
              Tanlangan mezon bo‘yicha signallar topilmadi
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Hozirda barcha datchiklar xavfsiz holatda. Yangi signal tushganda avtomatik ushbu ro‘yxatda aks etadi va ovozli ogohlantirish beriladi.
            </p>
          </div>
        ) : (
          filteredAlarms.map((alm) => {
            const currentStatus = getNormalizedStatus(alm);
            const isBusy = busyAlarmId === alm.id;
            const historyCount = alm.status_history?.length || 1;

            return (
              <div
                key={alm.id}
                className={`p-5 rounded-2xl border transition-all ${
                  currentStatus === 'new_alarm'
                    ? 'bg-slate-900/95 border-rose-500/50 shadow-lg shadow-rose-950/20'
                    : currentStatus === 'seen_alarm'
                    ? 'bg-slate-900/90 border-amber-500/40 shadow-md shadow-amber-950/10'
                    : 'bg-slate-900/75 border-slate-800'
                }`}
              >
                {/* Header row: code, status badge, timestamp */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3 mb-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-sm font-black text-white px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">
                      {alm.alarm_code}
                    </span>
                    {getStatusBadge(currentStatus)}
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-800 text-slate-300 border border-slate-700">
                      {alm.event_type}
                    </span>
                    {(alm.trigger_count || 1) > 1 && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-950 text-rose-300 border border-rose-500/40">
                        Takrorlangan: {alm.trigger_count}x
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      Kelgan vaqti: {new Date(alm.created_at).toLocaleString('uz-UZ')}
                    </span>
                  </div>
                </div>

                {/* Body Row: Location, Sensor Telemetry snapshot, Resolution info */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                  {/* Location & Node info */}
                  <div className="lg:col-span-3 space-y-1">
                    <div className="text-xs text-slate-400">Joylashuv va Qurilma:</div>
                    <div className="text-sm font-bold text-white">
                      {alm.floor_number}-qavat • {alm.room_number}
                    </div>
                    <div className="text-xs font-mono text-slate-400">
                      Chip: <span className="text-sky-400 font-bold">{alm.chip_id}</span>
                    </div>
                  </div>

                  {/* Telemetry Sensor Metrics */}
                  <div className="lg:col-span-4 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex-1">
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-0.5">
                        <Flame className="w-3 h-3 text-rose-400" /> Tutun
                      </div>
                      <div className="font-mono text-sm font-bold text-rose-400">
                        {alm.smoke_val ?? 0} PPM
                      </div>
                      <div className="text-[9px] text-slate-500">Chegara: 400 PPM</div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex-1">
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-0.5">
                        <Thermometer className="w-3 h-3 text-amber-400" /> Harorat
                      </div>
                      <div className="font-mono text-sm font-bold text-amber-400">
                        {alm.temp_val ?? 0} °C
                      </div>
                      <div className="text-[9px] text-slate-500">Chegara: 60 °C</div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex-1">
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-0.5">
                        <Wind className="w-3 h-3 text-sky-400" /> Cho‘qqi
                      </div>
                      <div className="font-mono text-sm font-bold text-slate-200">
                        {alm.peak_value ?? alm.smoke_val ?? 0}
                      </div>
                      <div className="text-[9px] text-slate-500">Maksimal qayd</div>
                    </div>
                  </div>

                  {/* Resolution Outcome & Status Summary */}
                  <div className="lg:col-span-5 p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-sky-400" />
                        Qanday Yakunlangani / Natija:
                      </span>
                      {alm.status === 'escalated_to_112' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-red-950 text-red-300 border border-red-500/40">
                          112 ga uzatilgan
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-200 font-medium">
                      {alm.resolution_outcome ? (
                        <span className="text-emerald-300">{alm.resolution_outcome}</span>
                      ) : currentStatus === 'managed_alarm' ? (
                        <span className="text-emerald-400">Xavf bartaraf etilgan va holat me’yorda.</span>
                      ) : currentStatus === 'seen_alarm' ? (
                        <span className="text-amber-300">
                          Mas’ul xodim tomonidan ko‘rildi, joyida tekshirish olib borilmoqda.
                        </span>
                      ) : (
                        <span className="text-rose-400 animate-pulse">
                          Yangi signal tushdi! Ko‘rib chiqish va chora ko‘rish kutilmoqda.
                        </span>
                      )}
                    </div>
                    {alm.acknowledged_by_name && (
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 pt-1 border-t border-slate-800/60 font-mono">
                        <User className="w-3 h-3 text-slate-500" /> Mas’ul: {alm.acknowledged_by_name}
                        {alm.acknowledged_at && (
                          <span>({new Date(alm.acknowledged_at).toLocaleTimeString('uz-UZ')})</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t border-slate-800/80">
                  {/* Left: Quick transitions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {currentStatus === 'new_alarm' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleQuickStatusChange(
                            alm,
                            'seen_alarm',
                            "Mas'ul xodim signalni qabul qildi va tekshiruv boshladi"
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                      >
                        <Eye className="w-3.5 h-3.5" /> Ko‘rildi deb belgilash (Seen)
                      </button>
                    )}

                    {currentStatus !== 'managed_alarm' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openStatusModal(alm, 'managed_alarm')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Hal qilindi deb yopish (Managed)
                      </button>
                    )}

                    {currentStatus === 'managed_alarm' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openStatusModal(alm, 'seen_alarm')}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                      >
                        <Eye className="w-3.5 h-3.5" /> Qayta ko‘rib chiqishga ochish
                      </button>
                    )}
                  </div>

                  {/* Right: Modals open buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openStatusModal(alm)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition"
                    >
                      Statusni O‘zgartirish
                    </button>

                    <button
                      type="button"
                      onClick={() => setHistoryModalAlarm(alm)}
                      className="px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <History className="w-3.5 h-3.5" /> To‘liq Tarix ({historyCount})
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* =====================================================================
          1. STATUS CHANGE MODAL
         ===================================================================== */}
      {statusModalAlarm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-sky-400" />
                  Alarm Statusini O‘zgartirish
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  {statusModalAlarm.alarm_code} • {statusModalAlarm.floor_number}-qavat, {statusModalAlarm.room_number}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalAlarm(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStatus} className="space-y-4 text-xs">
              {/* 3 Status Selection */}
              <div>
                <label className="text-slate-300 font-bold block mb-2">
                  Yangi Statusni Tanlang (3 ta holat):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* new_alarm */}
                  <button
                    type="button"
                    onClick={() => setSelectedNewStatus('new_alarm')}
                    className={`p-3 rounded-xl border text-left transition ${
                      selectedNewStatus === 'new_alarm'
                        ? 'bg-rose-500/20 border-rose-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs text-rose-300 mb-1">new_alarm</div>
                    <div className="text-[11px] text-slate-300 font-semibold">Yangi signal</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Ko‘rilmagan holat</div>
                  </button>

                  {/* seen_alarm */}
                  <button
                    type="button"
                    onClick={() => setSelectedNewStatus('seen_alarm')}
                    className={`p-3 rounded-xl border text-left transition ${
                      selectedNewStatus === 'seen_alarm'
                        ? 'bg-amber-500/20 border-amber-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs text-amber-300 mb-1">seen_alarm</div>
                    <div className="text-[11px] text-slate-300 font-semibold">Ko‘rilgan signal</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Nazoratga olindi</div>
                  </button>

                  {/* managed_alarm */}
                  <button
                    type="button"
                    onClick={() => setSelectedNewStatus('managed_alarm')}
                    className={`p-3 rounded-xl border text-left transition ${
                      selectedNewStatus === 'managed_alarm'
                        ? 'bg-emerald-500/20 border-emerald-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs text-emerald-300 mb-1">managed_alarm</div>
                    <div className="text-[11px] text-slate-300 font-semibold">Hal qilingan</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Xavf bartaraf etildi</div>
                  </button>
                </div>
              </div>

              {/* Resolution Outcome Input */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold block">
                  Qanday Yakunlangani / Natija (Resolution Outcome):
                </label>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {RESOLUTION_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl}
                      type="button"
                      onClick={() => setResolutionOutcome(tmpl)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition text-left"
                    >
                      {tmpl}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Xavf to'liq bartaraf etildi, datchik normaga qaytdi"
                  value={resolutionOutcome}
                  onChange={(e) => setResolutionOutcome(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Comment / Operator Note */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold block">
                  Qo‘shimcha Izoh yoki Mas’ul Xodim Qaydi:
                </label>
                <textarea
                  rows={3}
                  placeholder="Masalan: Xonadon egasi bilan bog'lanildi, chora ko'rildi..."
                  value={statusComment}
                  onChange={(e) => setStatusComment(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setStatusModalAlarm(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={busyAlarmId !== null}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-lg shadow-sky-600/30 disabled:opacity-50"
                >
                  Statusni Saqlash va Yangilash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. DETAILED HISTORY & AUDIT MODAL
         ===================================================================== */}
      {historyModalAlarm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-sky-400" />
                  Signalning To‘liq Tarixi va Yakunlanish Audit Jurnali
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  {historyModalAlarm.alarm_code} • {historyModalAlarm.floor_number}-qavat, {historyModalAlarm.room_number} • Chip: {historyModalAlarm.chip_id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalAlarm(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Summary Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[10px]">JORIY STATUS:</span>
                <span className="font-bold text-white">
                  {getNormalizedStatus(historyModalAlarm)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">TUTUN DARAJASI:</span>
                <span className="font-bold text-rose-400">
                  {historyModalAlarm.smoke_val ?? 0} PPM
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">HARORAT:</span>
                <span className="font-bold text-amber-400">
                  {historyModalAlarm.temp_val ?? 0} °C
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">TAKRORLANISH:</span>
                <span className="font-bold text-sky-400">
                  {historyModalAlarm.trigger_count || 1} marta
                </span>
              </div>
            </div>

            {/* Chronological Timeline */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400" />
                Statuslar O‘zgarishi va Voqealar Xronologiyasi
              </h4>

              <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800 pl-8">
                {/* 1. Initial Arrival Entry */}
                <div className="relative">
                  <div className="absolute -left-8 top-1.5 w-4 h-4 rounded-full bg-rose-500 border-2 border-slate-900 flex items-center justify-center" />
                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-400">
                        Yangi Favqulodda Signal Keldi (new_alarm)
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(historyModalAlarm.created_at).toLocaleString('uz-UZ')}
                      </span>
                    </div>
                    <p className="text-slate-300">
                      Datchik <strong className="text-white">{historyModalAlarm.chip_id}</strong> xavfli darajani qayd etdi: Tutun {historyModalAlarm.smoke_val} PPM, Harorat {historyModalAlarm.temp_val} °C. Tizim avtomatik SMS va ovozli ogohlantirish yubordi.
                    </p>
                  </div>
                </div>

                {/* 2. Status History Items */}
                {historyModalAlarm.status_history?.map((hist, idx) => (
                  <div key={hist.id || idx} className="relative">
                    <div
                      className={`absolute -left-8 top-1.5 w-4 h-4 rounded-full border-2 border-slate-900 ${
                        hist.to_status === 'managed_alarm'
                          ? 'bg-emerald-500'
                          : hist.to_status === 'seen_alarm'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                    />
                    <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold ${
                              hist.to_status === 'managed_alarm'
                                ? 'text-emerald-400'
                                : hist.to_status === 'seen_alarm'
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            Status: {hist.from_status ? `${hist.from_status} ➔ ` : ''}
                            {hist.to_status}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            • {hist.user_name} ({hist.user_role || 'mas’ul'})
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(hist.timestamp).toLocaleString('uz-UZ')}
                        </span>
                      </div>

                      {hist.resolution_outcome && (
                        <div className="text-emerald-300 font-medium">
                          Natija / Xulosa: {hist.resolution_outcome}
                        </div>
                      )}

                      {hist.comment && (
                        <p className="text-slate-400 text-[11px]">{hist.comment}</p>
                      )}
                    </div>
                  </div>
                ))}

                {/* 3. 112 State Escalation Log (if dispatched) */}
                {historyModalAlarm.emergency_112_dispatched_at && (
                  <div className="relative">
                    <div className="absolute -left-8 top-1.5 w-4 h-4 rounded-full bg-red-600 border-2 border-slate-900" />
                    <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-red-300 flex items-center gap-1.5">
                          <PhoneCall className="w-3.5 h-3.5" /> 112 FVV Davlat Favqulodda Xizmati
                        </span>
                        <span className="text-[10px] font-mono text-red-300">
                          {new Date(historyModalAlarm.emergency_112_dispatched_at).toLocaleString('uz-UZ')}
                        </span>
                      </div>
                      <p className="text-slate-300">
                        Signal 112 FVV dispetcherlik tizimiga yuborildi. Yong‘in xavfsizligi koordinatalari va xonadon manzili uzatildi.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setHistoryModalAlarm(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          3. SIMULATE TEST ALARM MODAL
         ===================================================================== */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-500" />
                Test Alarm Chaqirish (Simulyatsiya)
              </h3>
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRunTestSimulation} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 block font-bold mb-1">Signal Turi:</label>
                <select
                  value={testEventType}
                  onChange={(e) => setTestEventType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                >
                  <option value="SMOKE_CRITICAL">Tutun xavfi (SMOKE_CRITICAL)</option>
                  <option value="TEMP_THRESHOLD">Yuqori harorat (TEMP_THRESHOLD)</option>
                  <option value="CO_DANGER">Is gazi xavfi (CO_DANGER)</option>
                  <option value="UNAUTHORIZED_ENTRY">Ruxsatsiz kirish (DOOR REED)</option>
                  <option value="GLASS_BREAK">Oyna sinishi (GLASS BREAK)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block font-bold mb-1">Tutun (PPM):</label>
                  <input
                    type="number"
                    value={testSmokeVal}
                    onChange={(e) => setTestSmokeVal(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block font-bold mb-1">Harorat (°C):</label>
                  <input
                    type="number"
                    value={testTempVal}
                    onChange={(e) => setTestTempVal(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block font-bold mb-1">Qavat:</label>
                <select
                  value={testFloor}
                  onChange={(e) => setTestFloor(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                >
                  {(floors.length ? floors : [{ id: 1, floor_number: 1, name: '1-qavat' }]).map((f) => (
                    <option key={f.id} value={f.floor_number}>
                      {f.floor_number}-qavat ({f.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-[11px] text-rose-200">
                Ushbu test signal tushishi bilanoq yangi holatda (<strong>new_alarm</strong>) ro‘yxatda ko‘rinadi, audio sirena yangraydi va 60 soniyalik 112 FVV hisoblagichi ishga tushadi.
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setTestModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={busyAlarmId !== null}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 disabled:opacity-50"
                >
                  Signalni Ishga Tushirish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
