# Seeed Studio XIAO ESP32-C3 - Optik Tutun Datchigi Test Mikrodasturi

Ushbu mikrodastur 8-oyoqli noma'lum/standart mikrokontroller bilan ishlaydigan tayyor optik (infraqizil kamera + fotodiod + buzzer) tutun datchigini **Seeed Studio XIAO ESP32-C3** yordamida qayta jonlantirish va aqlli bino BLE 5.0 ekotizimiga ulash uchun maxsus tayyorlandi.

---

## 1. Optik Kamera Qanday Ishlaydi? (Mie Scattering printsipi)

Oddiy tutun datchiklarida qora labirint kamera (smoke optical chamber) bo'ladi:
1. **Toza havoda:** IR transmitter LED va Qabul qiluvchi Fotodiod bir-biriga 135° burchak ostida joylashgan bo'lib, to'g'ridan-to'g'ri ko'rmaydi. Fotodiodga deyarli nur tushmaydi.
2. **Tutun kirganda:** Tutun zarrachalari infraqizil nurni har tomonga sochadi (**Mie scattering**). Sochilgan nur fotodiodga tushadi va uning analog qarshiligi/kuchlanishi keskin o'zgaradi.
3. **Differensial pulsli o'lchash (Differential Strobe):**
   * **1-qadam:** IR LED o'chiq paytda fotodiod o'lchanadi (`Ambient ADC`).
   * **2-qadam:** IR LED 120-350 mikrosekundga yoqiladi (strob) va fotodiod qayta o'lchanadi (`Pulse ADC`).
   * **3-qadam:** Farq hisoblanadi: `Delta = |Pulse ADC - Ambient ADC|`.
   * Toza havoda `Delta` kichik (20-100), tutun kirganda esa `Delta` keskin oshadi (500 - 2500+).

---

## 2. 8-Oyoqli MCU Oyoqlarini Aniqlash va XIAO C3 ga Ulash (Pinout)

8-oyoqli datchik platasidagi mikrosxemani (odatda PIC12, PT8A2511, BA6411 yoki Xitoy klonlari) kavsharlab olib tashlaganingizdan so'ng, uning o'rniga XIAO ESP32-C3 oyoqlarini quyidagicha ulang:

| XIAO ESP32-C3 Oyog'i | GPIO | 8-Oyoqli Plata / Sensor Vazifasi | Izoh |
| :--- | :--- | :--- | :--- |
| **D0 / A0** | `GPIO2` | **Fotodiod / Qabul qiluvchi (RX)** | Analog kirish (ADC1_CH2). Fotodiod kuchlanishini o'qiydi. |
| **D1 / A1** | `GPIO3` | **IR LED Transmit (TX)** | Tranzistor yoki to'g'ridan-to'g'ri IR LED katod/anodini boshqaradi. |
| **D2 / A2** | `GPIO4` | **Buzzer / Pyezo Siren** | Ovozli signalizator (tranzistor bazasiga yoki pyezo ga). |
| **D3 / A3** | `GPIO5` | **Status LED** | Platadagi qizil/ko'k miltillovchi svetodiod. |
| **D9** | `GPIO9` | **Test / Calibrate Tugmasi** | XIAO platasidagi tayyor BOOT tugmasi (yoki platadagi Test tugma). |
| **3V3** | `3.3V` | **VCC (Quvvat)** | Datchik platasidagi 3.3V quvvat liniyasi. |
| **GND** | `GND` | **GND (Umumiy yer)** | Batareya minus va umumiy yer. |

> [!TIP]
> **8-oyoqli platani tekshirish bo'yicha maslahat:**
> 1. Multimetrning uzluksizlik (prozvonka) rejimida datchikning **IR LED** oyoqlarini toping. Bir oyog'i qarshilik orqali VCC/GND ga, ikkinchi oyog'i mikrosxema oyoqlaridan biriga (yoki tranzistor orqali) ulangan bo'ladi. Shu oyoqni XIAO ning **D1** ga ulang.
> 2. Qora optik qabul qiluvchi (fotodiod) oyoqlaridan birini kuzating — u mikrosxemaning analog oyog'iga boradi. Shu oyoqni XIAO ning **D0** ga ulang.
> 3. Buzzerning ikkita simidan biri mikrosxema oyog'iga (yoki S8050 tranzistor bazasiga) boradi. Shu oyoqni XIAO ning **D2** ga ulang.

---

## 3. Loyihani Kompilyatsiya va Plataga Yuklash

PlatformIO o'rnatilgan terminalda:

```bash
# Loyiha papkasiga o'tish
cd D:\Projects\WirelessSmoke\firmware\xiao_esp32c3_optical_smoke

# Kompilyatsiya qilish
pio run

# Xiao ESP32-C3 platani USB-C orqali ulab, dasturni yozish:
pio run --target upload

# Serial monitorni ochish (115200 baud):
pio device monitor -b 115200
```

---

## 4. Serial Monitor va Jonli Kalibratsiyalash

Dastur ishga tushganda har 800ms da quyidagicha o'lchov hisobotini chiqaradi:
```text
[OPTICAL] Amb:   85 | Pls:  210 | RawΔ:  125 | NetSmoke:   65 | PPM:  70.3 | Thresh:  350 | OK (Normal)
[OPTICAL] Amb:   85 | Pls:  850 | RawΔ:  765 | NetSmoke:  705 | PPM: 614.2 | Thresh:  350 | >>> ALARM CRITICAL! <<<
```

### Klaviatura buyruqlari (Serial monitor oynasida yozish mumkin):
* **`c`** : Toza havoda nol bazasini kalibratsiyalash (`Clean Air Baseline`).
* **`+`** : Tutun chegarasini 50 birlikka oshirish (sezuvchanlikni kamaytirish, soxta signallarning oldini olish).
* **`-`** : Tutun chegarasini 50 birlikka kamaytirish (sezuvchanlikni oshirish).
* **`t`** : Buzzer va svetodiodni qisqa chiyillatib tekshirish.
* **`h`** : Yordam menyusini ko'rish.

### BOOT tugmasi vazifalari (XIAO platasidagi):
* **Qisqa bosish (< 1 soniya):** Buzzer va LED test signali beradi.
* **Uzoq bosish (> 3 soniya):** Kamerani avtomatik kalibratsiya qiladi va toza havo qiymatini xotiraga (NVS flash) saqlaydi.

---

## 5. Gateway va Server Bilan Integratsiya

* XIAO ESP32-C3 o'zining noyob MAC manziliga (`C3-XXXXXX`) asoslangan BLE 5.0 Manufacturer paketlarini tarqatadi.
* Tutun aniqlanganda va signal chalinganda (`ALARM CRITICAL`), platadagi buzzer ISO 8201 (T3 — 3 qisqa signal, tanaffus) yong'in standarti bo'yicha chalinadi.
* Shu zahoti BLE orqali yuqori chastotada yong'in signali uzatiladi.
* Biz avval tayyorlagan **LilyGO T-SIM7600 Gateway** (yoki Floor Hub) ushbu BLE paketni havoda ushlab, `170.168.60.245:1883` dagi serveringizga yetkazadi va veb-panelda favqulodda xavf oynasini ochadi!
