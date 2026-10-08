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
| **D1 / A1** | `GPIO3` | **Fotodiod / Qabul qiluvchi (RX)** | Analog kirish (`ADC1_CH3`). D0 (GPIO2) strapping pin xatoligini oldini olish uchun D1 ga o'tkazildi. |
| **D2 / A2** | `GPIO4` | **IR LED Transmit (TX)** | Tranzistor yoki to'g'ridan-to'g'ri IR LED katod/anodini strob bilan yoqadi. |
| **D3 / A3** | `GPIO5` | **Buzzer / Pyezo Siren** | Tranzistor orqali aktiv buzzer boshqaruvi (**Teskari logika: LOW = Ovoz, HIGH = Jimlik**). |
| **D4** | `GPIO6` | **Status Indikator LED** | Platadagi svetodiod (**Teskari logika: LOW = Yoniq, HIGH = O'chiq**). |
| **D9** | `GPIO9` | **Test / Calibrate Tugmasi** | XIAO platasidagi tayyor BOOT tugmasi (yoki platadagi Test tugma). |
| **D0 / A0** | `GPIO2` | *Bo'sh (Ulangan emas)* | ESP32-C3 yuklash (upload/strapping) mojaroni bartaraf etish uchun bo'sh qoldirildi. |
| **3V3** | `3.3V` | **VCC (Quvvat)** | Datchik platasidagi 3.3V quvvat liniyasi. |
| **GND** | `GND` | **GND (Umumiy yer)** | Batareya minus va umumiy yer. |

> [!TIP]
> **8-oyoqli platani tekshirish bo'yicha maslahat:**
> 1. Qora optik qabul qiluvchi (fotodiod) oyoqlaridan birini kuzating — u mikrosxemaning analog oyog'iga boradi. Shu oyoqni XIAO ning **D1** ga ulang.
> 2. Multimetrning uzluksizlik (prozvonka) rejimida datchikning **IR LED** oyoqlarini toping. Bir oyog'i qarshilik orqali VCC/GND ga, ikkinchi oyog'i mikrosxema oyoqlaridan biriga (yoki tranzistor orqali) ulangan bo'ladi. Shu oyoqni XIAO ning **D2** ga ulang.
> 3. Aktiv buzzer tranzistorining boshqaruv oyoqchasini XIAO ning **D3** ga ulang (kodda tranzistor uchun LOW signali beriladi).
> 4. Indikator svetodiodni XIAO ning **D4** ga ulang (kodda teskari logika: LOW = Yoniq, HIGH = O'chiq).

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
* **`1`** : Buzzer rejimini **2.7 kHz PWM Chastotaga** o'tkazish (Standart pyezo tutun datchiklari uchun rezonans ovozi).
* **`2`** : Buzzer rejimini **4.0 kHz PWM Chastotaga** o'tkazish (Yuqori tonli o'tkir ovoz).
* **`3`** : Buzzer rejimini **Aktiv DC (HIGH = Yoniq, LOW = Jimlik)** ga o'tkazish.
* **`4`** : Buzzer rejimini **Aktiv DC (LOW = Yoniq, HIGH = Jimlik)** ga o'tkazish.
* **`c`** : Toza havoda nol bazasini kalibratsiyalash (`Clean Air Baseline`).
* **`+`** / **`-`** : Tutun chegarasini (threshold) 50 birlikka oshirish / kamaytirish.
* **`t`** : Buzzer va svetodiodni qisqa chiyillatib tekshirish (100% millis orqali, qotmaydi).
* **`h`** : Yordam menyusini ko'rish.

### Indikator LED va Buzzer Ishlash Mantig'i:
* **100% `millis()` asosida ishlaydi:** Dasturda birorta ham qotiruvchi `delay()` yo'q.
* **Normal rejimda:** Har safar datchik havodan o'lchov olganda (har 800ms) LED qisqa 25ms miltillab "yurak urishi" (heartbeat) belgisini beradi.
* **Jim turgan holatda:** Buzzer tranzistorining bazasi to'liq 0V (LOW) ga tushirib qo'yiladi. Bu IR LED yonganda tok o'zgarishi hisobiga chiquvchi ortiqcha "tqq" (chertish) shovqinini 100% yo'qotadi!
* **Xavf (Alarm) rejimida:** ISO 8201 / T3 standarti bo'yicha uzluksiz va jarangdor 3 qisqa signal va tanaffus bilan chalinadi.

### BOOT tugmasi vazifalari (XIAO platasidagi):
* **Qisqa bosish (< 2.5 soniya):** Buzzer va LED test signali (Test Chirp).
* **Uzoq bosish (> 3 soniya):** Kamerani toza havoda avtomatik kalibratsiya qiladi va toza havo qiymatini xotiraga (NVS flash) saqlaydi.

---

## 5. Gateway va Server Bilan Integratsiya

* XIAO ESP32-C3 o'zining noyob MAC manziliga (`C3-XXXXXX`) asoslangan BLE 5.0 Manufacturer paketlarini tarqatadi.
* Tutun aniqlanganda va signal chalinganda (`ALARM CRITICAL`), platadagi buzzer ISO 8201 (T3 — 3 qisqa signal, tanaffus) yong'in standarti bo'yicha chalinadi.
* Shu zahoti BLE orqali yuqori chastotada yong'in signali uzatiladi.
* Biz avval tayyorlagan **LilyGO T-SIM7600 Gateway** (yoki Floor Hub) ushbu BLE paketni havoda ushlab, `170.168.60.245:1883` dagi serveringizga yetkazadi va veb-panelda favqulodda xavf oynasini ochadi!
