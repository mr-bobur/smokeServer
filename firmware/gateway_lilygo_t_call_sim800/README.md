# LilyGO T-Call (ESP32 + SIMCOM SIM800L 2G GPRS) Central Gateway

Ushbu mikrodastur **LilyGO T-Call (SIM800L)** platasini aqlli bino xavfsizlik va tutun datchiklari ekotizimi uchun **Markaziy Shlyuz (Central Gateway)** sifatida ishlatish uchun yaratildi.

---

## 1. Apparat Ta'minoti va Pinout

LilyGO T-Call platasida ESP32, SIMCOM SIM800L GSM modemi va IP5306 quvvat boshqaruv mikrosxemasi (PMU) mavjud.

| Funksiya | ESP32 GPIO | Vazifasi |
| :--- | :--- | :--- |
| **MODEM_RX** | `GPIO 26` | ESP32 UART RX <- SIM800L TX |
| **MODEM_TX** | `GPIO 27` | ESP32 UART TX -> SIM800L RX |
| **MODEM_PWRKEY** | `GPIO 4` | Modemni yoqish (Active LOW impuls > 1 soniya) |
| **MODEM_POWER_ON** | `GPIO 23` | SIM800L LDO regulyatorini yoqish (`HIGH`) |
| **MODEM_RST** | `GPIO 5` | Modem Reset pini (`HIGH`) |
| **MODEM_DTR** | `GPIO 32` | Sleep rejimi boshqaruvi (`LOW` = Faol) |
| **I2C SDA** | `GPIO 21` | IP5306 Power Management IC |
| **I2C SCL** | `GPIO 22` | IP5306 Power Management IC |
| **LED** | `GPIO 13` | Platadagi foydalanuvchi ko'k svetodiodi |

> [!IMPORTANT]
> **IP5306 Quvvat Boshqaruvi (Keep-On):**
> LilyGO T-Call platasidagi IP5306 chipi kichik tok sarflanganda platani avtomatik o'chirib qo'ymasligi uchun, dastur ishga tushishi bilan I2C orqali `0x75` manzilidagi `0x00` registriga `0x37` qiymati yoziladi. Bu batareya va USB quvvatini uzluksiz ushlab turadi.

---

## 2. Dastur Arxitekturasi (FreeRTOS Dual-Core)

* **Core 0 — BLE Central Scanner:**
  * Bluetooth LE 5.0 orqali atrofdagi Xiao ESP32-C3 va boshqa simsiz datchiklardan kelayotgan Manufacturer beacon paketlarini uzluksiz ushlaydi.
  * Paketdan Sensor ID (`C3-XXXXXX`), tutun PPM qiymati, batareya foizi va signal kuchini (RSSI) ajratib oladi.
  * O'lchovlarni xavfsiz FreeRTOS navbati (`telemetryQueue`) orqali Core 1 ga uzatadi.

* **Core 1 — SIM800L Cellular & MQTT Engine:**
  * SIM800L ni quvvatlaydi, `internet` APN orqali 2G GPRS ulanishini o'rnatadi.
  * Masofaviy serveringizdagi Mosquitto brokeriga (`170.168.60.245:1883`) ulanadi.
  * BLE navbatidan kelgan telemetriyani quyidagi MQTT mavzulariga yuboradi:
    * Oddiy telemetriya: `smartbuilding/floor_1/hub_HUB-B1-FL01/sensor_{chip_id}/telemetry`
    * Yong'in signali: `smartbuilding/floor_1/hub_HUB-B1-FL01/sensor_{chip_id}/alarm`
  * Har 60 soniyada gateway holati (Heartbeat, CSQ signal, operator) haqida hisobot beradi.

---

## 3. Server Parametrlari

* **MQTT Broker:** `170.168.60.245:1883`
* **Login:** `public`
* **Parol:** `Acdb@2026`
* **APN:** `internet`

---

## 4. Plataga Dasturni Yozish (Upload)

LilyGO T-Call platasini USB orqali ulang va quyidagi buyruqlarni bajaring:

```bash
cd D:\Projects\WirelessSmoke\firmware\gateway_lilygo_t_call_sim800
pio run --target upload
pio device monitor -b 115200
```
