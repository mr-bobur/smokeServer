'use client';

import React from 'react';
import Link from 'next/link';
import {
  Building2,
  ShieldCheck,
  Radio,
  Flame,
  Cpu,
  ArrowRight,
  PhoneCall,
  Layers,
  Lock
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[420px] bg-sky-500/10 blur-[130px] pointer-events-none" />

      {/* Top Navigation */}
      <header className="max-w-7xl w-full mx-auto px-6 py-6 flex items-center justify-between border-b border-slate-800/80 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center shadow-lg shadow-sky-500/25">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-base font-extrabold tracking-tight block">
              SMART BUILDING DIGITAL TWIN
            </span>
            <span className="text-[11px] font-mono text-sky-400 block">
              ESP32-C3 BLE 5.0 • RS485 TRUNK • SIM7670 4G • 112 DISPATCH
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold border border-slate-700 transition"
          >
            Google SSO Login
          </Link>
          <Link
            href="/admin"
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-sky-600/30 transition"
          >
            Launch Digital Twin <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl w-full mx-auto px-6 py-12 space-y-12 z-10">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-mono">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            BUILDING ID: SMART-BLD-TASHKENT-09 • 9 FLOORS ONLINE
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
            Enterprise Wireless Smoke &amp; Perimeter Security{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-400">
              Digital Twin Ecosystem
            </span>
          </h1>
          <p className="text-base text-slate-400 leading-relaxed">
            Real-time 9-story residential and commercial monitoring powered by modular ESP32-C3 BLE 5.0 endpoints, RS485 half-duplex industrial trunk sub-hubs (DIP 0001–1001), SIM7670 4G LTE Cat 1 backhaul, and automated 60-second escalation to the Uzbekistan 112 State Emergency API.
          </p>
        </div>

        {/* 3 Role Portals Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Super Admin Card */}
          <Link
            href="/admin"
            className="group p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-sky-500/60 transition-all shadow-xl flex flex-col justify-between space-y-6"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/40 flex items-center justify-center">
                <Cpu className="w-6 h-6 text-sky-400" />
              </div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">1. Super Admin Portal</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/20 text-sky-300">
                  role: super_admin
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                9-floor isometric selector, interactive topological map with drag-and-drop sensor coordinates, RS485 trunk line health matrix, BLE 5-10s pairing commissioning, and SIM7670 4G LTE AT terminal.
              </p>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-sky-400 group-hover:translate-x-1 transition-transform">
              <span>Open Engineering Console (/admin)</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>

          {/* Tenant / Shirkat Manager Card */}
          <Link
            href="/tenant"
            className="group p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/60 transition-all shadow-xl flex flex-col justify-between space-y-6"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">2. Shirkat Manager Portal</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300">
                  role: tenant
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                9-story aggregated health matrix (alarms, low batteries, offline nodes), mass building announcement &amp; evacuation siren trigger, and resident-to-apartment assignment drawer.
              </p>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-amber-400 group-hover:translate-x-1 transition-transform">
              <span>Open Shirkat Dashboard (/tenant)</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>

          {/* Resident Portal Card */}
          <Link
            href="/resident"
            className="group p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/60 transition-all shadow-xl flex flex-col justify-between space-y-6"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">3. Resident User Portal</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300">
                  role: user (Apt 42)
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Dedicated apartment view (Floor 4, Apt 42), tactile perimeter security controls (Arm Away, Arm Home, Disarm), indoor air quality badges, room temperature, and door reed status.
              </p>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
              <span>Open Resident Portal (/resident)</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>
        </div>

        {/* Architecture Highlights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <Layers className="w-5 h-5 text-sky-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-white">BLE 5.0 + RS485 Bus</div>
              <div className="text-[11px] text-slate-400">DIP 0001–1001 CRC16 Trunk</div>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <PhoneCall className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-white">60s → 112 Escalation</div>
              <div className="text-[11px] text-slate-400">State Fire API + SIM7670 Voice</div>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <Flame className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-white">1-Year Partitioned DB</div>
              <div className="text-[11px] text-slate-400">MySQL RANGE UNIX_TIMESTAMP</div>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <Lock className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-white">Google OAuth + RBAC</div>
              <div className="text-[11px] text-slate-400">7-Day JWT Role Enforcement</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl w-full mx-auto px-6 py-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-500">
        <span>Smart Building Wireless Smoke &amp; Security Ecosystem • Digital Twin v1.0</span>
        <span className="font-mono">Amir Timur Avenue 108, Block B • Tashkent</span>
      </footer>
    </div>
  );
}
