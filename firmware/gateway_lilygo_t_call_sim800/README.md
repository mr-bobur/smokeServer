# LilyGO T-Call (ESP32 + SIMCOM SIM800L 2G GPRS + RS485 Master + Alarm Buzzer) Central Gateway

Ushbu mikrodastur **LilyGO T-Call (SIM800L)** platasini aqlli bino xavfsizlik va tutun datchiklari ekotizimi uchun **Markaziy Shlyuz (Central Gateway)** sifatida ishlatish uchun yangilandi.

---

## 1. Apparat Ta'minoti va Pinout

LilyGO T-Call platasida ESP32, SIMCOM SIM800L GSM modemi, IP5306 quvvat boshqaruv mikrosxemasi (PMU), MAX485 sanoat interfeysi va to'g'ridan-to'g'ri ulangan Alarm Buzzer sirenasi mavjud.

| Funksiya | ESP32 GPIO | Vazifasi va Ulanishi |
| :--- | :--- | :--- |
| **MODEM_RX** | `GPIO 26` | ESP32 UART RX <- SIM800L TX |
| **MODEM_TX** | `GPIO 27` | ESP32 UART TX -> SIM800L RX |
| **MODEM_PWRKEY** | `GPIO 4` | Modemni yoqish (Active LOW impuls > 1 soniya) |
| **MODEM_POWER_ON** | `GPIO 23` | SIM800L LDO regulyatorini yoqish (`HIGH`) |
| **MODEM_RST** | `GPIO 5` | Modem Reset pini (`HIGH`) |
| **MODEM_DTR** | `GPIO 32` | Sleep rejimi boshqaruvi (`LOW` = Faol) |
| **I2C SDA** | `GPIO 21` | IP5306 Power Management IC |
| **I2C SCL** | `GPIO 22` | IP5306 Power Management IC |
| **LED** | `GPIO 13` | Platadagi ko'k foydalanuvchi svetodiodi |
| **BUZZER** | `GPIO 19` | **Tranzistorsiz to'g'ridan-to'g'ri ulanish:** Buzzer (+) -> GPIO 19, Buzzer (-) -> GND |
| **RS485_RO (RX)** | `GPIO 18` | ESP32 UART2 RX <- MAX485 RO |
| **RS485_DI (TX)** | `GPIO 25` | ESP32 UART2 TX -> MAX485 DI |
| **RS485_DE_RE** | `GPIO 14` | MAX485 DE & RE birgalikda (`HIGH` = TX, `LOW` = RX) |

> [!WARNING]
> **GPIO 10 va Buzzer haqida muhim eslatma:**
> ESP32 WROVER modulli LilyGO T-Call platasida `GPIO 6, 7, 8, 9, 10, 11` pinlari ichki SPI Flash xotiraga ulangan. Agar GPIO 10 ga tashqi detal ulansa yoki kuchlanish berilsa, plata darhol Flash xotira xatosi (Cache error) berib qotib qoladi. Shu sababli Buzzer xavfsiz va bo'sh bo'lgan **`GPIO 19`** ga ulandi (tranzistorsiz: bir oyog'i GND, ikkinchi oyog'i to'g'ridan-to'g'ri GPIO 19 ga).

---

## 2. Yangi Dasturiy Imkoniyatlar

### 🚨 2.1. Alarm Buzzer Sirenasi (Direct GPIO Drive)
- **Signal holati:** Agar BLE datchiklaridan yoki RS485 qavat MCU laridan yong'in/tutun signali (`alarm: true`) kelsa, Gateway sirena chalishni boshlaydi (2800Hz / 2200Hz o'zgaruvchan tezkor sirena kadansi).
- **Avto-o'chirish va Reset:** Serverdan `SILENCE_ALARM` buyrug'i kelganda yoki signal tozalanganda sirena avtomatik o'chadi.
- **Audio Feedback (Chirp):** Qurilma ulanganda (Pairing Mode boshlanganda 2 marta qisqa signal, yangi qurilma intro paketi ushlanganda 1 marta tasdiq signali).

### 🌐 2.2. Serverdan Yangi Qurilma Qo'shishni Eshitish (Pairing Mode RPC)
- Serverdagi so'nggi o'zgarishlar asosida shlyuz quyidagi MQTT mavzularini eshitib turadi:
  - `smartbuilding/gateway/GW-LILYGO-TCALL-SIM800/command`
  - `smartbuilding/gateway/+/command`
  - `smartbuilding/alarm/broadcast`
- **`ENABLE_PAIRING_MODE`**: Shlyuz BLE va RS485 orqali 60 soniyalik kutish rejimiga o'tadi va barcha qavat MCU lariga ham buyruqni RS485 orqali tarqatadi.
- Yangi qurilma intro paketi ushlanganda darhol `smartbuilding/gateway/GW-LILYGO-TCALL-SIM800/pairing` mavzusiga real-time uzatiladi.
- **`CANCEL_PAIRING_MODE`** / **`SILENCE_ALARM`** buyruqlari ham to'liq qabul qilinadi.

### 🔌 2.3. RS485 Magistrali orqali Qavat MCU lari Bilan Bog'lanish (3 dan 20 gacha Qavatlar)
- **Arxitektura:** Gateway = Master, Qavat MCU lari = Slaves (1 dan 20 gacha manzillar).
- **JSON Paket Almashinuvi va CRC-16:**
  - Har bir so'rov va javob JSON formatida uzatiladi:
    ```json
    {"cmd":"POLL","target":3,"sender":0,"seq":1024,"crc":"E4A1"}
    ```
    Qavat javobi:
    ```json
    {"sender":3,"target":0,"type":"TELEMETRY","seq":1024,"hub_id":"HUB-B1-FL03","status":"online","alarm":false,"sensors":[...],"crc":"A8B2"}
    ```
  - Har bir paket Modbus CRC-16 (polinom `0xA001`) tekshiruvidan o'tadi.
- **Qayta So'rov Mexanizmi (Retry Engine):**
  - Agar qavat javob bermasa (timeout > 250ms) yoki paketda CRC xatosi bo'lsa, Gateway **3 martagacha qayta so'raydi (Attempt 1..3)**.
  - Agar 3-urinishda ham javob kelmasa, qavat vaqtincha oflayn deb belgilanadi va navbatdagi qavatga o'tiladi.
- **Real-Time Uzatish:** Qavat MCU dan kelgan barcha tutun, harorat va signal ma'lumotlari darhol MQTT telemetriya va favqulodda alarm mavzulariga jo'natiladi.

---

## 3. FreeRTOS Uch Yadroli Arxitekturasi

- **Core 0 — Vazifa 1 (`BLE_Scanner`, prio 1):** Bluetooth LE 5.0 beacon paketlarini uzluksiz ushlaydi.
- **Core 0 — Vazifa 2 (`RS485_Master`, prio 2):** 1 dan 20 gacha qavat MCU larini ketma-ket so'rab, CRC16 tekshiradi va qayta so'rovlarni boshqaradi.
- **Core 1 — Vazifa 3 (`Cellular_MQTT`, prio 2):** SIM800L orqali 2G internet va Mosquitto brokeriga ulanadi, telemetriya va alarmlarni real-time uzatadi hamda server buyruqlarini tinglaydi.
- **Non-blocking Buzzer Watchdog:** FreeRTOS uzluksizligi buzilmagan holda GPIO 19 orqali sirena chaladi.

---

## 4. Plataga Dasturni Yozish (Upload)

LilyGO T-Call platasini USB orqali ulang:

```bash
cd D:\Projects\WirelessSmoke\firmware\gateway_lilygo_t_call_sim800
pio run --target upload
pio device monitor -b 115200
```

Qavat MCU (ESP32-C3) dasturi uchun:
```bash
cd D:\Projects\WirelessSmoke\firmware\floor_hub_esp32c3_rs485
pio run --target upload
```
