import type { Metadata } from 'next';
import './globals.css';
import { AppSettingsProvider } from '../context/AppSettingsContext';

export const metadata: Metadata = {
  title: 'Smart Building SaaS Digital Twin | Wireless Smoke & Security Ecosystem',
  description:
    'Multi-Building SaaS Wireless Smoke & Security Monitoring Ecosystem (ESP32-C3 Single-Sensor Intro Packet Auto-Detection, RS485 Floor Sub-Hubs, SIM7670 4G Gateways, 112 Dispatcher)'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <AppSettingsProvider>{children}</AppSettingsProvider>
      </body>
    </html>
  );
}
