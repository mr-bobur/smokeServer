# 🏢 Smart Building Wireless Smoke & Security Ecosystem (Digital Twin)

Enterprise 9-Story Residential & Commercial Wireless Smoke, CO, Thermal & Perimeter Security Monitoring System with 2D Topological Digital Twin, RS485 Trunk Diagnostics, SIM7670 4G LTE Backhaul, and Automated 60-Second 112 State Emergency Dispatch.

---

## 📐 System Architecture

1. **ESP32-C3 Modular Sensor Endpoints (`firmware/esp32c3_endpoint/`)**
   - Sensors: `SMOKE_MQ2`, `CO_MQ7`, `TEMP_DS18B20`, `DOOR_REED`, `GLASS_BREAK`, `MULTI_FIRE`.
   - **BLE 5.0 Commissioning:** 5–10s long-press on `GPIO 9` broadcasts `[0xFF, 0xFF, CHIP_ID, CAPABILITY_MASK, BATTERY_PCT]`, stores config in NVS, and flashes green status LED 3 times.
   - **Dynamic Beaconing FSM:** 600s deep-sleep standby vs. immediate 1000ms alarm burst + `GPIO 4` piezo siren latch when Smoke > 400 PPM or Temp > 60°C.
2. **ESP32-C3 Floor Sub-Hubs (`firmware/esp32c3_floor_hub/`)**
   - 4x DIP Switch binary floor addressing (`0001` = Floor 1 to `1001` = Floor 9) on `GPIO 1, 2, 3, 4`.
   - RS485 Half-Duplex (`MAX485` on `GPIO 5/6/7`) industrial bus framing with CRC-16 validation: `[0xAA, SRC_FLOOR, MSG_TYPE, LEN, PAYLOAD..., CRC16_H, CRC16_L, 0x55]`.
3. **Central Building Gateway (`firmware/esp32s3_central_gateway/`)**
   - `SIM7670` 4G LTE Cat 1 (`115200` baud AT command pipeline) with MQTT over TLS (`smartbuilding/floor_{floorId}/hub_{hubId}/sensor_{chipId}/telemetry` & `/alarm`).
   - Hardware emergency fallback via `AT+CMGS` (SMS) and `ATD+998...;` (automated voice call).
4. **Core Server (`server/`)**
   - Node.js, Express, TypeScript, Socket.io, MQTT.js, Passport Google OAuth 2.0 (`passport-google-oauth20`), JWT RBAC (`super_admin`, `tenant`, `user`), PM2 Cluster (`ecosystem.config.js`), and MySQL 8.0+ with 1-year `RANGE (UNIX_TIMESTAMP(recorded_at))` partitioning (`server/src/models/ddl.sql`).
5. **Digital Twin Frontend (`client/`)**
   - Next.js 14 App Router, Tailwind CSS, Recharts 1-Year Dual-Axis Analytics (`TelemetryChart.tsx`), Interactive 2D Floor Plan (`BlueprintViewer.tsx`, `SensorPin.tsx`, `SensorModal.tsx`), and 3 Role Portals (`/admin`, `/tenant`, `/resident`).

---

## 🚀 Quick Start

### 1. Start the Core Backend Server (Port 5000)
```bash
cd server
npm run dev
```

### 2. Start the Next.js Digital Twin Frontend (Port 3000)
```bash
cd client
npm run dev
```

Open **http://localhost:3000** in your browser:
- **Super Admin Console:** `http://localhost:3000/admin`
- **Shirkat (Building Manager) Dashboard:** `http://localhost:3000/tenant`
- **Resident User Portal (Floor 4, Apt 42):** `http://localhost:3000/resident`
- **Google OAuth 2.0 / Role Switcher Login:** `http://localhost:3000/login`
