'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Flame,
  ShieldCheck,
  Cpu,
  Building2,
  Lock,
  ArrowRight,
  Globe,
  Sun,
  Moon
} from 'lucide-react';
import { API_BASE } from '../../../hooks/useFloorData';
import { UserRole } from '../../../types';
import { useAppSettings, LanguageCode } from '../../../context/AppSettingsContext';

export default function LoginPage() {
  const router = useRouter();
  const { lang, setLang, theme, toggleTheme, t } = useAppSettings();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  const handleSsoLogin = async (role: UserRole, targetPath: string) => {
    setLoadingRole(role);
    try {
      const res = await fetch(`${API_BASE}/api/auth/sso-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('sb_jwt_token', data.token);
        localStorage.setItem('sb_user_role', data.user.role);
        localStorage.setItem('sb_user_profile', JSON.stringify(data.user));
      }
    } catch {
      localStorage.setItem('sb_user_role', role);
    } finally {
      setLoadingRole(null);
      router.push(targetPath);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-sky-500/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-xl rounded-3xl bg-slate-900/95 border border-slate-800 p-8 shadow-2xl space-y-6 z-10">
        {/* Top Bar with Language & Theme Switcher */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center shadow-lg shadow-sky-500/30">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight">
                {t('brandTitle')}
              </h1>
              <p className="text-xs text-slate-400 font-mono">
                {t('brandSub')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
              <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
              {(['uz', 'en', 'ru'] as LanguageCode[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold uppercase transition ${
                    lang === l
                      ? 'bg-sky-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white transition"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-sky-400" />
              )}
            </button>
          </div>
        </div>

        {/* Official Google OAuth 2.0 Redirect Button */}
        <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
          <a
            href={`${API_BASE}/api/auth/google`}
            className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm flex items-center justify-center gap-3 shadow transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
              />
            </svg>
            Google OAuth 2.0 SSO
          </a>
        </div>

        {/* Instant RBAC Role Selector Cards */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleSsoLogin('super_admin', '/admin')}
            disabled={loadingRole !== null}
            className="w-full p-4 rounded-2xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-sky-500/60 text-left transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/40 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  Sardor Alimov ({t('roleSuperAdmin')})
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/20 text-sky-300">
                    super_admin
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  {t('buildingsTab')} • {t('devicesRegistryTab')} (Gateway / Hub / 1-Sensor End-Device)
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-1 transition" />
          </button>

          <button
            type="button"
            onClick={() => handleSsoLogin('tenant', '/tenant')}
            disabled={loadingRole !== null}
            className="w-full p-4 rounded-2xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/60 text-left transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  Dilshod Karimov ({t('roleTenant')})
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300">
                    tenant
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  {t('tenantApartmentsTitle')} • {t('addFloorBtn')} • {t('addAptBtn')}
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition" />
          </button>

          <button
            type="button"
            onClick={() => handleSsoLogin('user', '/resident')}
            disabled={loadingRole !== null}
            className="w-full p-4 rounded-2xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/60 text-left transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  Aziza Rustamova ({t('roleResident')} • Apt 42)
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300">
                    user
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  {t('dragNewSensor')} • Intro Packet (0x01..0x05) • Hub/Gateway Pairing
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition" />
          </button>
        </div>

        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" /> Multi-Building SaaS RBAC
          </span>
          <span>UZ / EN / RU • Light / Dark</span>
        </div>
      </div>
    </div>
  );
}
