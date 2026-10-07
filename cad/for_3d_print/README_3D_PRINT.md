# 🖨️ 3D Pechat Uchun Tashqi Korpus Modellari (FOR_3D_PRINT)
## 3D Printing Prototype Guide for Wireless Smoke Detector Shell (With Hexagonal Honeycomb Mesh)

Ushbu papka tashqi korpusning ergonomikasi va vizual ko'rinishini real hayotda ko'rish uchun **maxsus 3D pechatga moslashtirilgan** fayllarni o'z ichiga oladi.

Foydalanuvchi talabi asosida kiritilgan eng so'nggi o'zgarishlar:
1. **Tutun kirish qismi (6 burchakli teshiklar):** Markaziy tutun kirish/chiqish qismiga **108 ta oltiburchakli (hexagonal honeycomb)** shamollatish teshiklari joylashtirildi. Teshiklar 3 qator bo'lib, o'zaro shaxmat usulida (staggered) joylashgan bo'lib, 3D pechatda (FDM/SLA) podderjkasiz toza chiqadi.
2. **Tashqi yuqori yelka:** $R = 5.0\text{ mm}$ li keng va silliq radius bilan yumaloqlandi.
3. **Markaziy qo'ziqorin qopqog'i:** $R = 1.8\text{ mm}$ li silliq yumaloq radius berildi.
4. **Pastki taglik qirrasi:** $R = 1.5\text{ mm}$ radius bilan yumaloqlandi.

---

## 📁 Fayllar Ro'yxati

| Fayl Nomi | Format | Tavsifi & Qo'llanishi | Havola |
| :--- | :---: | :--- | :---: |
| **`Outer_Cover_with_Hex_Mesh`** | **STL** | **(Tavsiya etiladi - Monolit)** 108 ta oltiburchakli teshiklari bilan bitta butun qilib 3D pechat qilinadigan yuqori korpus | [Outer_Cover_with_Hex_Mesh_for_3D_print.stl](file:///d:/Projects/WirelessSmoke/cad/for_3d_print/Outer_Cover_with_Hex_Mesh_for_3D_print.stl) |
| **`Outer_Cover_with_Hex_Mesh`** | **STEP** | Monolit oltiburchakli korpusning master STEP B-Rep modeli | [Outer_Cover_with_Hex_Mesh_for_3D_print.step](file:///d:/Projects/WirelessSmoke/cad/for_3d_print/Outer_Cover_with_Hex_Mesh_for_3D_print.step) |
| **`Smoke_Mesh_Hexagonal`** | **STL** | Alohida chiqariladigan 108 ta 6-burchakli teshikli to'r halqa (qora rangda pechat qilib, oq korpus ichiga kiygizish uchun) | [Smoke_Mesh_Hexagonal_for_3D_print.stl](file:///d:/Projects/WirelessSmoke/cad/for_3d_print/Smoke_Mesh_Hexagonal_for_3D_print.stl) |
| **`Smoke_Mesh_Hexagonal`** | **STEP** | 6-burchakli to'r halqaning STEP qattiq jism modeli | [Smoke_Mesh_Hexagonal_for_3D_print.step](file:///d:/Projects/WirelessSmoke/cad/for_3d_print/Smoke_Mesh_Hexagonal_for_3D_print.step) |
| **`Outer_Cover_for_3D_print`** | **STL** | Ochiq derazali yuqori qopqoq (agar to'rni alohida chiqarib ichiga kiydirmoqchi bo'lsangiz) | [Outer_Cover_for_3D_print.stl](file:///d:/Projects/WirelessSmoke/cad/for_3d_print/Outer_Cover_for_3D_print.stl) |
| **`Outer_Cover_for_3D_print`** | **STEP** | Ochiq derazali yuqori qopqoq STEP modeli | [Outer_Cover_for_3D_print.step](file:///d:/Projects/WirelessSmoke/cad/for_3d_print/Outer_Cover_for_3D_print.step) |
| **`Ceiling_Base_for_3D_print`** | **STL** | Pastki taglik qismi (yuqori qopqoqqa o'tiruvchi 0.25 mm toleransli yoqa bilan) | [Ceiling_Base_for_3D_print.stl](file:///d:/Projects/WirelessSmoke/cad/for_3d_print/Ceiling_Base_for_3D_print.stl) |
| **`Ceiling_Base_for_3D_print`** | **STEP** | Pastki taglikning B-Rep qattiq jism modeli | [Ceiling_Base_for_3D_print.step](file:///d:/Projects/WirelessSmoke/cad/for_3d_print/Ceiling_Base_for_3D_print.step) |
| **`Complete_Smoke_Detector_Shell`** | **STL** | Yig'ilgan butun korpus (qopqoq + 6 burchakli to'r + taglik) | [Complete_Smoke_Detector_Shell_for_3D_print.stl](file:///d:/Projects/WirelessSmoke/cad/for_3d_print/Complete_Smoke_Detector_Shell_for_3D_print.stl) |
| **`Complete_Smoke_Detector_Shell`** | **STEP** | Yig'ilgan tashqi korpusning master STEP modeli | [Complete_Smoke_Detector_Shell_for_3D_print.step](file:///d:/Projects/WirelessSmoke/cad/for_3d_print/Complete_Smoke_Detector_Shell_for_3D_print.step) |

---

## ⚙️ Tavsiya Etilgan Slicer Sozlamalari (Bambu Studio / PrusaSlicer / Cura / OrcaSlicer)

### Variant A: Eng Osoni — Bitta Butun Qilib Pechat Qilish (`Outer_Cover_with_Hex_Mesh_for_3D_print.stl`)
- **Joylashtirish (Orientation):** Pastki tekis gardishini stolga qo'ying (`Z = 0`).
- **Qatlam qalinligi (Layer Height):** `0.16 mm` yoki `0.20 mm` (Adaptive Layer Height tavsiya etiladi).
- **Oltiburchakli teshiklar (Hex Holes):** Oltiburchaklar uchi vertikal $30^\circ$ burchak ostida qilinganligi sababli teshiklarning o'ziga **umuman podderjka kerak emas (Self-supporting)!**
- **Podderjka (Supports):** Faqat markaziy qopqoqning eng ustki gorizontal chiqig'i tagiga `Tree Support` (Slim/Tree) bering.
- **Devorlar (Wall Loops):** 3 qator.
- **To'ldirish (Infill):** `15% – 20%` (Gyroid).

### Variant B: Ikki Xil Rangda Pechat Qilish (Zavod Ko'rinishi)
1. **`Smoke_Mesh_Hexagonal_for_3D_print.stl`:**
   - **Rang:** **Qora** (yoki to'q kulrang) PLA / PETG / ABS.
   - **Joylashtirish:** Pastki halqa qirrasini stolga qo'ying.
   - **Podderjka:** **UMUMAN KERAK EMAS (0 Supports)!**
   - **Qatlam:** `0.16 mm` (aniq va chiroyli chiqishi uchun).
2. **`Outer_Cover_for_3D_print.stl`:**
   - **Rang:** **Matte White (Oq)**.
3. **Yig'ish:** Oq qopqoq ichiga qora to'r halqasini kiygizasiz. Natijada xuddi original tijoriy datchiklardek oq korpus ortidan qora 6 burchakli to'r ko'rinib turadi!

---

## 📏 Geometrik Parametrlar

- **Tashqi diametr:** $115.0\text{ mm}$
- **Umumiy balandlik:** $46.0\text{ mm}$
- **Markaziy qo'ziqorin diametri:** $48.0\text{ mm}$
- **Tutun kirish darchasi balandligi:** $8.0\text{ mm}$
- **Oltiburchakli teshiklar soni:** **108 ta** (3 qator $\times$ 36 ta)
- **Oltiburchak o'lchami:** Kengligi $1.73\text{ mm}$, balandligi $2.0\text{ mm}$, oraliq qovurg'a $0.95\text{ mm}$ (FDM 0.4 mm soploda aniq 2 qator devor)
- **Tashqi yelka radiusi:** $R = 5.0\text{ mm}$ (smooth fillet)
- **Qopqoq tepa radiusi:** $R = 1.8\text{ mm}$ (smooth fillet)
- **Pastki taglik radiusi:** $R = 1.5\text{ mm}$ (smooth fillet)
