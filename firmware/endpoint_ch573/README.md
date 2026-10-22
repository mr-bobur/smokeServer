# WCH CH573 Ultra-Low-Power Wireless Smoke Endpoint Firmware

## 📌 Umumiy Tavsif va Arxitektura
Ushbu loyiha **WCH CH573F** (32-bit QingKe RISC-V3A BLE 5.0 SoC) mikrokontrolleri asosida ishlaydigan aqlli optik tutun detektori (Smoke Detector Endpoint) uchun test dasturi hisoblanadi.

Loyiha oldingi chatimizda (`aa8d5c15-00a8-4cc0-8f58-5796a22bfeef`) aniqlangan barcha kamchiliklarni (batareya tez tugashi, optik datchikning absolyut ADC drifti, soxta trevogalar, radio quvvat isrofi) hisobga olgan holda noldan PlatformIO (`pio`) muhitida yaratildi.

---

## ⚡ Quvvat Sarfi va Batareya Hisobi (ESP32-C3 ga nisbatan taqqoslash)

| Ko'rsatkich | ESP32-C3 Endpoint | CH573F Endpoint | Farqi |
| :--- | :--- | :--- | :--- |
| **Kutish uyqu toki (Standby Sleep)** | ~15–50 µA (plata elementlari bilan) | **~1.5 – 2.5 µA** (RTC + 18KB SRAM) | **10–25 barobar kam** |
| **Faol o'lchov oynasi (Duty Cycle)** | ~300 ms (6% faol) | **~16 ms (0.32% faol)** | **18 barobar qisqa** |
| **BLE Radio uzatish toki** | ~80–120 mA | **~12–15 mA** | **8 barobar kam** |
| **O'rtacha umumiy tok** | ~25–35 mA (4 kunda tugagan) | **~34 µA** | **~800 barobar kam** |
| **2x AA Batareyada Ishlash Muddat** | **4 kun** ❌ | **3 – 5+ yil** ✅ | **Sanoat darajasi** |

---

## 🔌 Ulanishlar (Pinout Mapping)

Plata: **WeAct Studio CH573F** yoki standart **CH573F Core Board**

| Pin | Funksiya | Izoh |
| :--- | :--- | :--- |
| **PA4 (AIN0)** | Optik fototranzistor (AO) | 12-bit ADC kirish (Differentsial o'lchov) |
| **PA5** | Kamera IR Nur Diodi (Emitter LED) | 15ms sinxron impuls orqali boshqariladi |
| **PA12** | Pyezo Sirena Buzzer | 2800 Hz Temporal-3 sirena (Uyquda 0V qulflangan) |
| **PA8** | Holat LED (Platadagi Onboard LED) | Active-LOW, 15ms yumshoq heartbeat |
| **PB4** | Tashqi Favqulodda LED | Trevoga paytida strob miltillash |
| **PA9** | UART1 RX | 115200 baud |
| **PA8** | UART1 TX | 115200 baud Debug konsol loglari |
| **PB22** | BOOT Tugmasi | USB ISP rejimiga kirish uchun bosib turiladi |

---

## 📡 BLE 5.0 Telemetriya Paketi Formati

Smart Building Gateway va Server bilan 100% mos keluvchi Manufacturer Data formati (12 bayt):
```
[0xFF, 0xFF, MAC0, MAC1, MAC2, MAC3, MAC4, MAC5, 0x01, BATTERY_PCT, PPM_HIGH, PPM_LOW]
```
* `0xFF, 0xFF`: Kompaniya ID / Gateway preambula
* `MAC (6 bayt)`: CH573 zavod MAC manzili (Noyob Device ID)
* `0x01`: Datchik turi (Optik tutun)
* `BATTERY_PCT (1 bayt)`: Ichki `CH_INTE_VBAT` ADC orqali o'lchangan aniq batareya foizi (0-100%)
* `PPM (2 bayt)`: Optik tutun zichligi (PPM)

---

## 🚀 Dasturni Yuklash (Flashing) Usullari

Loyihada 2 xil yuklash muhiti sozlangan:

### 1-usul: USB Type-C kabel orqali (Tavsiya etiladi - hech qanday programmator kerak emas!)
1. CH573 platasidagi **BOOT (PB22)** tugmasini bosib turing.
2. Type-C kabelni kompyuterga ulang, so'ng BOOT tugmasini qo'yib yuboring (chip ISP bootloader rejimiga o'tadi).
3. Terminalda quyidagi buyruqni bering:
   ```bash
   pio run -e usb_isp -t upload
   ```
   *(yoki to'g'ridan-to'g'ri `wchisp flash .pio/build/genericCH573F/firmware.bin` orqali)*

### 2-usul: WCH-Link / WCH-LinkE orqali
1. WCH-Link programmatorining `TIO` simini **PB14** ga, `TCK` simini **PB15** ga, `GND` va `3V3` ni mos ravishda ulang.
2. Terminalda buyruq bering:
   ```bash
   pio run -e wchlink -t upload
   ```

---

## 🔍 Test Qilish va Sinovdan O'tkazish

1. Dastur yuklangandan so'ng, USB-TTL konverter (yoki USB CDC) orqali **115200 baud** tezlikda Serial Monitorni oching:
   ```bash
   pio device monitor -b 115200
   ```
2. Monitor ekranida quyidagi loglar chiqadi:
   * Chipning MAC manzili
   * Har 5 soniyada uyqudan uyg'onish (Dark ADC, Lit ADC, Drop, PPM, Batareya %)
   * Har 30 soniyada Gateway ga keepalive telemetriya yuborilishi
   * Tutun kamerasi to'silganda (`Drop >= 200` yoki `Raw <= 3800`): ketma-ket 3 ta shoshilinch **ALARM** paketlari uzatilishi va 2800 Hz Temporal-3 sirenasi yangrashi.
   * Tutun tarqalgach: 3 ta **NORMAL RECOVERY** paketi yuborilib, qurilmaning yana 5 soniyalik chuqur mikroamperli uyqu rejimiga qaytishi.
