# LilyGO T-ZigBee (ESP32-C3) SHT21 Harorat va Namlik Endpoint Firmware

Ushbu mikrodastur **LilyGO T-ZigBee** platasidagi **ESP32-C3** mikrokontrolleri hamda **Sensirion SHT21** (I2C) moduli asosida ishlaydigan aqlli harorat va namlik sensori uchun mo'ljallangan. Mikrodastur arxitekturasi avvalgi optik tutun detektori (Optical Smoke Endpoint) tamoyillariga to'liq mos keladi va Gateway bilan 100% integratsiyalashgan.

---

## 1. Apparat Ulanishlari (Hardware Pinout)

| Funksiya / Qurilma | T-ZigBee ESP32-C3 Pin | Tavsif |
| :--- | :--- | :--- |
| **User KEY Button** | `GPIO 2` | Platadagi foydalanuvchi tugmasi (Active LOW, internal pull-up) |
| **Status LED (Ko'k)**| `GPIO 3` | Platadagi ko'k LED indikator (Active HIGH) |
| **Zigbee MCU Power** | `GPIO 0` | TLSR8258 Zigbee chipining quvvati (Quvvat tejash uchun doimiy LOW qilingan) |
| **SHT21 I2C SDA**   | `GPIO 4` | SHT21 modulining Serial Data (SDA) liniyasi |
| **SHT21 I2C SCL**   | `GPIO 5` | SHT21 modulining Serial Clock (SCL) liniyasi |
| **SHT21 VCC / GND** | `3.3V` va `GND` | Modulni 3.3V quvvat manbaiga ulash |

---

## 2. 5 Sekundlik KEY Tugmasi va Dastlabki Ulanish (Initial Connection / Pairing) Algoritmi

1. **5 Sekund bosib turish (Long Press Hold):**
   - Foydalanuvchi platadagi `KEY` (GPIO 2) tugmasini 5 soniya davomida bosib tursa:
   - LED 4-sekundda tez-tez miltillab ogohlantiradi.
   - 5-soniya to'lganda NVS (Non-Volatile Storage) dagi `is_paired = false` va `need_pairing_intro = true` holatiga o'tkaziladi.
   - Ko'k LED 10 marta tez miltillab tasdiqlaydi.
   - `ESP.restart()` orqali mikrokontroller avtomatik qayta yuklanadi (reboot).

2. **Dastlabki Ulanish Algoritmi (Boot-up Commissioning):**
   - Qayta yuklangach, qurilma NVS dagi pairing bayrog'ini ko'rib **Dastlabki ulanish (Pairing Mode)** rejimiga o'tadi.
   - Ko'k LED 100ms tezlikda doimiy miltillaydi (Ulanish kutilmoqda).
   - 30 soniya davomida BLE orqali Gateway va Server uchun **Kirish Tanishtiruv Paketi (Intro Handshake Packet)** hamda **Ekotizim Telemetriya Paketi** efirga uzatiladi:
     - **Intro Packet Formati:**
       `[0xAA, 0xFF, MAC(6B), 0x02, BAT(1B), TEMP_H, TEMP_L, HUM, 0x55]`
       * `0xAA 0xFF` : Kirish handshake identifikatori
       * `MAC (6B)`  : Qurilmaning unikal Chip ID'si (`C3-XXXXXX`)
       * `0x02`      : Qurilma turi (`TEMP_DS18B20 / SHT21 Harorat sensori`)
       * `BAT`       : Batareya quvvati foizi (98%)
       * `TEMP`      : Joriy harorat (10 ga ko'paytirilgan butun son, masalan 24.5°C = 245)
       * `HUM`       : Joriy namlik foizi (masalan 45%)
   - Gatewayda ulanishga ruxsat berilgan bo'lsa (yoki Web Dashboarddan "Pair" bosilganda), Gateway ushbu paketni tutib olib MQTT orqali Serverga uzatadi.
   - Server qurilmani xonaga biriktiradi va Web Dashboardda darhol aks ettiradi.
   - 30 soniyadan so'ng yoki jarayon yakunlangach, NVS'ga `is_paired = true` yoziladi va LED 3 marta sekin yonib-o'chib odatiy rejimga o'tadi.

---

## 3. Odatiy Ishlash va Kritik Harorat Signali (Alarm)

1. **Odatiy Rejim (Normal Monitoring):**
   - Har 5 soniyada SHT21 sensoridan harorat va namlik o'lchanadi.
   - Ko'k LED har bir o'lchovda qisqa (30ms) "heartbeat" miltillaydi.
   - Har 30 soniyada Gatewayga BLE keep-alive telemetriya uzatiladi (yoki harorat 0.5°C dan ko'proq o'zgarsa, darhol uzatiladi).

2. **Kritik Yuqori Harorat (Alarm Mode >= 50.0°C):**
   - Agar harorat **>= 50.0°C** ga yetsa (yong'in / haddan tashqari qizish xavfi):
   - Darhol ketma-ket **3 ta favqulodda ALARM paketi** uzatiladi (`isAlarm = true`).
   - Ko'k LED tez-tez stroboskop kabi miltillaydi.
   - Har 1 soniyada xavf xabari qayta uzatib turiladi.
   - Gateway buni zudlik bilan MQTT favqulodda mavzusi (`/alarm`) orqali Serverga yetkazadi.

3. **Normallashish (Recovery):**
   - Harorat gisterezis hisobiga **<= 48.0°C** ga tushganda:
   - Ketma-ket **3 ta NORMAL tiklanish paketi** uzatiladi.
   - Favqulodda strob to'xtatilib, odatiy 30 soniyalik ritmga qaytiladi.

---

## 4. Loyihani Kompilyatsiya va Yuklash (Flash)

PlatformIO orqali kompyuterdan to'g'ridan-to'g'ri yuklash:

```bash
# Kompilyatsiya qilish:
pio run -d firmware/endpoint_esp32c3_sht21_temperature

# T-ZigBee platasiga yuklash (T-U2T COM portini ko'rsatgan holda):
pio run -d firmware/endpoint_esp32c3_sht21_temperature -t upload --upload-port COMx

# Serial loglarni kuzatish (115200 baud):
pio device monitor -p COMx -b 115200
```
