'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Flame,
  Cpu,
  Building2,
  ShieldCheck,
  Radio,
  Bell,
  LogOut,
  Volume2,
  X,
  AlertOctagon,
  Sun,
  Moon,
  Globe
} from 'lucide-react';
import { useSocket } from '../../hooks/useSocket';
import { EmergencyBanner } from '../../components/common/EmergencyBanner';
import { API_BASE, getAuthHeaders } from '../../hooks/useFloorData';
import { LanguageCode, useAppSettings } from '../../context/AppSettingsContext';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { lang, setLang, theme, toggleTheme, t } = useAppSettings();
  const {
    connected,
    activeAlarm,
    setActiveAlarm,
    toasts,
    dismissToast,
    sirenBroadcast,
    setSirenBroadcast
  } = useSocket();

  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!activeAlarm || activeAlarm.status !== 'active') return;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Browser autoplay fallback
    }
  }, [activeAlarm?.id, activeAlarm?.countdown_remaining_sec, activeAlarm?.status]);

  const handleAcknowledgeGlobal = async (alarmId: number) => {
    await fetch(`${API_BASE}/api/emergency/alarms/${alarmId}/acknowledge`, {
      method: 'POST',
      headers: getAuthHeaders('super_admin')
    });
    setActiveAlarm(null);
  };

  const handleDispatch112Global = async (alarmId: number) => {
    const res = await fetch(`${API_BASE}/api/emergency/alarms/${alarmId}/dispatch-112`, {
      method: 'POST',
      headers: getAuthHeaders('super_admin')
    });
    if (res.ok) {
      const data = await res.json();
      setActiveAlarm(data.alarm);
    }
  };

  const navItems = [
    {
      href: '/admin',
      label: t('nav_admin'),
      icon: Cpu,
      activeColor: 'bg-sky-600/20 text-sky-400 border-sky-500/50'
    },
    {
      href: '/tenant',
      label: t('nav_tenant'),
      icon: Building2,
      activeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/50'
    },
    {
      href: '/resident',
      label: t('nav_resident'),
      icon: ShieldCheck,
      activeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
    }
  ];

  const languages: Array<{ code: LanguageCode; label: string }> = [
    { code: 'uz', label: 'O‘ZB' },
    { code: 'en', label: 'ENG' },
    { code: 'ru', label: 'РУС' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Global Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/90 px-4 lg:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-sm font-black tracking-tight text-white block">
                {t('app_title')}
              </span>
              <span className="text-[10px] font-mono text-slate-400 block">
                {t('app_subtitle')}
              </span>
            </div>
          </Link>

          {/* Portal Switcher */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-2 ${
                    isActive
                      ? item.activeColor
                      : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Controls: Language Switcher (UZ/EN/RU) + Theme Toggle (Light/Dark) + Live Status */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Multi-Language Switcher (UZB / ENG / RUS) */}
          <div className="flex items-center bg-slate-900 rounded-xl border border-slate-800 p-0.5">
            <Globe className="w-3.5 h-3.5 text-sky-400 ml-2 mr-1" />
            {languages.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  lang === l.code
                    ? 'bg-sky-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Light / Dark Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition"
            title="Toggle Light / Dark Mode"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('theme_light')}</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-sky-500" />
                <span>{t('theme_dark')}</span>
              </>
            )}
          </button>

          {/* Socket.io & MQTT Live Telemetry Link Badge */}
          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-2 ${
              connected
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                : 'bg-amber-950/60 border-amber-500/40 text-amber-400'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${connected ? 'animate-pulse text-emerald-400' : ''}`} />
            <span>{connected ? t('socket_live') : t('socket_reconnecting')}</span>
          </div>

          <Link
            href="/login"
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 flex items-center gap-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> {t('switch_role')}
          </Link>
        </div>
      </header>

      {/* Mobile Portal Switcher */}
      <div className="md:hidden px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap flex items-center gap-1.5 ${
                isActive ? item.activeColor : 'border-slate-800 text-slate-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Building-Wide Siren / Evacuation Broadcast Banner */}
      {sirenBroadcast && (
        <div
          className={`px-6 py-3 border-b flex items-center justify-between gap-4 ${
            sirenBroadcast.trigger_siren
              ? 'bg-red-600 text-white border-red-400 animate-pulse'
              : 'bg-amber-500/20 text-amber-200 border-amber-500/40'
          }`}
        >
          <div className="flex items-center gap-3 text-xs sm:text-sm font-bold">
            <Volume2 className="w-5 h-5 shrink-0" />
            <span>
              [{sirenBroadcast.issued_by}]: {sirenBroadcast.message}
            </span>
          </div>
          <button
            onClick={() => setSirenBroadcast(null)}
            className="p-1 rounded bg-black/20 hover:bg-black/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Portal Content */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 lg:px-6 py-5">
        {children}
      </main>

      {/* Real-time Notification Toaster */}
      <div className="fixed bottom-4 right-4 z-40 space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map((tItem) => (
          <div
            key={tItem.id}
            className={`p-3.5 rounded-xl border backdrop-blur-xl shadow-2xl pointer-events-auto flex items-start justify-between gap-3 transition-all ${
              tItem.type === 'critical'
                ? 'bg-red-950/95 border-red-500 text-red-100'
                : tItem.type === 'warning'
                  ? 'bg-amber-950/95 border-amber-500 text-amber-100'
                  : tItem.type === 'success'
                    ? 'bg-emerald-950/95 border-emerald-500 text-emerald-100'
                    : 'bg-slate-900/95 border-slate-700 text-slate-100'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {tItem.type === 'critical' ? (
                <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              ) : (
                <Bell className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="text-xs font-bold">{tItem.title}</div>
                <div className="text-[11px] opacity-90 mt-0.5">{tItem.message}</div>
              </div>
            </div>
            <button
              onClick={() => dismissToast(tItem.id)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Screen-wide Flashing Emergency Modal */}
      <EmergencyBanner
        alarm={activeAlarm}
        onAcknowledgeFalseAlarm={handleAcknowledgeGlobal}
        onDispatch112Immediately={handleDispatch112Global}
        onDismissModal={() => setActiveAlarm(null)}
      />
    </div>
  );
}
