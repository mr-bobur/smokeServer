# 📡 LilyGO T-SIM7600 Central Gateway (PlatformIO)

Smart Building Wireless Smoke & Security ekotizimi uchun **LilyGO T-SIM7600 (4G LTE + BLE)** markaziy shlyuz (gateway) dasturiy ta'minoti.

---

## 🚀 Texnik Xususiyatlari

- **Platforma:** PlatformIO (`espressif32`)
- **Modem Drayveri:** `TinyGSM` (`TINY_GSM_MODEM_SIM7600`)
- **Cellular Internet:** 4G LTE Cat 1/4
- **APN:** `"internet"` (O'zbekiston uyali aloqa operatorlari: Ucell, Beeline, Mobiuz, Uztelecom uchun)
- **Protokol:** `MQTT` (`PubSubClient`)
- **Mahalliy Tarmoq:** `ESP32 BLE Central Scanner` (tutun datchiklari va sensorlarni simsiz qabul qiluvchi)
- **Arxitektura:** **FreeRTOS Dual-Core Multi-Tasking**:
  - **Core 0:** `BLE_Scanner` vazifasi — uzluksiz fonda tutun datchiklaridan kelgan paketlarni eshitib turadi (hech qachon bloklanmaydi).
  - **Core 1:** `Cellular_MQTT` vazifasi — TinyGSM orqali 4G internetga ulanadi va navbatdagi telemetriya ma'lumotlarini MQTT serverga jo'natadi.

---

## 📋 Qo'llab-quvvatlanadigan Platalar (`platformio.ini`)

1. **`lilygo_t_sim7600_s3` (Standart / Default):**
   - Chip: **ESP32-S3** (8MB Flash + PSRAM)
   - Native USB CDC / JTAG
   - Pins: `TX=5`, `RX=4`, `PWRKEY=12`, `DTR=42`
2. **`lilygo_t_sim7600`:**
   - Chip: **ESP32-WROVER-B**
   - Pins: `TX=27`, `RX=26`, `PWRKEY=4`, `DTR=25`

---

## ⚡ Qurilmaga Yuklash (Flashing)

Plata kompyuterga ulanganda (masalan, `COM21`):

```bash
# S3 versiyasi uchun kompilatsiya va mikrodasturni yuklash:
pio run -d firmware/gateway_lilygo_sim7600 -e lilygo_t_sim7600_s3 -t upload --upload-port COM21

# Serial monitorni ochish (115200 baud):
pio device monitor -p COM21 -b 115200
```

Klassik ESP32 platalari uchun:
```bash
pio run -d firmware/gateway_lilygo_sim7600 -e lilygo_t_sim7600 -t upload --upload-port COM21
```

---

## 🌐 MQTT Topiklar Tuzilishi

- **Sensor Telemetriyasi:** `smartbuilding/floor_1/hub_HUB-B1-FL01/sensor_{chip_id}/telemetry`
- **Favqulodda Signal (Alarm):** `smartbuilding/floor_1/hub_HUB-B1-FL01/sensor_{chip_id}/alarm`
- **Gateway Holati (Heartbeat):** `smartbuilding/gateway/GATEWAY-CENTRAL-01/status`
- **Pastga Buyruqlar (Downlink RPC):** `smartbuilding/gateway/GATEWAY-CENTRAL-01/cmd`
