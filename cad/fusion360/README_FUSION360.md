# 🚀 Autodesk Fusion 360 Parametric Assembly Guide
## Commercial Smoke Detector with Elevated Central "Mushroom Turret"

This directory contains the automation script and engineering documentation to generate, view, and modify the **Commercial Wireless Smoke Detector Enclosure** featuring the iconic **elevated central mushroom smoke chamber turret** with 360° intake windows directly inside Autodesk Fusion 360.

---

## 📁 3-Body Architecture Structure

```
cad/
├── fusion360/
│   ├── smoke_detector_fusion360.py   # Native Fusion 360 Python API Automation Script
│   └── README_FUSION360.md           # Instructions and Parametric Reference
├── models/                           # Production B-Rep Solids (.step) and 3D Print (.stl)
│   ├── 01_Outer_Cover.step / .stl    # PLASTIC BODY 1: Central Mushroom Turret + 360° Windows
│   ├── 02_Inner_Chassis.step / .stl  # PLASTIC BODY 2: Cartridge Battery Channels + Optics + Labyrinth
│   ├── 03_Ceiling_Base.step / .stl   # PLASTIC BODY 3: Ceiling Flange + 20° Bayonet Cam Tracks
│   ├── 04_PCB.step / .stl            # NON-PLASTIC: 55x35 mm FR4 with CH573 BLE & Sensors
│   ├── 05_AA_Battery_1.step / .stl   # NON-PLASTIC: Primary AA Cell (Cartridge Slide-in)
│   ├── 06_AA_Battery_2.step / .stl   # NON-PLASTIC: Secondary AA Cell (Cartridge Slide-in)
│   ├── 07_Battery_Contacts.step/.stl # NON-PLASTIC: Stamped Nickel-Plated Spring Contacts
│   ├── 08_Insect_Mesh.step / .stl    # NON-PLASTIC: Central Turret Wire Screen Ring
│   ├── SmokeDetector_CompleteAssembly.step  # Full B-Rep Solid Assembly
│   └── SmokeDetector_FullAssembly.stl      # Complete Assembly Mesh
└── scripts/
    └── generate_cad.py               # Standalone OpenCASCADE Solid-Modeling Engine
```

---

## ⚡ Running the Automation Script in Fusion 360

1. Launch **Autodesk Fusion 360**.
2. Press **`Shift + S`** (or go to `UTILITIES` > `Add-Ins` > `Scripts and Add-Ins`).
3. Under the **Scripts** tab, click **`+`** (Add) and browse to:
   ```
   D:\Projects\WirelessSmoke\cad\fusion360\smoke_detector_fusion360.py
   ```
4. Select `smoke_detector_fusion360.py` and click **Run**.
5. Fusion 360 will automatically:
   - Create a new design document.
   - Inject all 24 named parameters into the **Change Parameters** table.
   - Create the component hierarchy for the 3 plastic bodies and non-plastic elements.
   - Import the exact solid CAD geometry with mate datums aligned.
   - Assign engineering materials:
     - **Matte White ABS/PC**: Outer Cover and Ceiling Base.
     - **High-Absorptance Matte Black ABS**: Inner Chassis (optical light extinction).
     - **FR4 & Copper/Gold**: Custom 55x35 mm PCB.
     - **Polished Nickel/Steel**: AA Batteries and stamped battery leaf contacts.
     - **Stainless Steel Mesh**: Central insect screen ring.

---

## 📐 Parametric Dimension Reference Table

To adjust any dimension in Fusion 360, navigate to `MODIFY` > `Change Parameters`:

| Parameter Name | Default Value | Unit | Engineering Function & Design Rationale |
| :--- | :--- | :--- | :--- |
| `OuterDiameter` | `115.0` | mm | Outer Cover main diameter |
| `TotalHeight` | `46.0` | mm | Overall assembled profile to peak of central mushroom turret |
| `DeckHeight` | `33.0` | mm | Main housing deck transition height |
| `TurretDiameter` | `48.0` | mm | Central elevated mushroom smoke turret cap diameter |
| `TurretWindowHeight` | `8.0` | mm | 360-degree smoke intake open window height |
| `TurretPillarCount` | `6` | — | Number of aerodynamic vertical support pillars |
| `TurretPillarWidth` | `4.0` | mm | Width of each vertical support pillar |
| `WallThickness` | `2.0` | mm | Nominal injection molded wall thickness (1.8–2.2 mm standard) |
| `DraftAngle` | `1.5` | deg | Standard mold ejection draft angle on all vertical surfaces |
| `BaseDiameter` | `110.0` | mm | Ceiling base flange diameter (provides shadow-gap ring) |
| `BaseThickness` | `2.5` | mm | Ceiling base plate structural thickness (2.0–2.5 mm standard) |
| `TwistAngle` | `20.0` | deg | Bayonet twist-lock rotation travel from entry to hard-stop |
| `PCB_Length` | `55.0` | mm | Mainboard length along Y-axis (User spec: ~55 mm) |
| `PCB_Width` | `35.0` | mm | Mainboard width along X-axis (User spec: ~35 mm) |
| `PCB_Thickness` | `1.6` | mm | 4-layer FR4 standard thickness |
| `BatteryDiameter` | `14.5` | mm | Standard cylindrical AA cell diameter |
| `BatteryLength` | `50.5` | mm | Standard AA cell length including positive terminal pip |
| `BatteryClearance` | `1.0` | mm | Toleranced clearance inside slide-in cartridge channels |
| `MeshThickness` | `0.4` | mm | Stainless steel insect protection screen gauge |
| `OpticalChamberDiameter` | `34.0` | mm | Outer diameter of the integrated optical smoke chamber |
| `OpticalChamberHeight` | `18.0` | mm | Internal height of the integrated optical cavity |
| `LightTrapDepth` | `6.0` | mm | Depth of overlapping optical extinction labyrinth vanes |
| `ScrewDiameter` | `4.0` | mm | Ceiling anchor screw clearance (drywall/concrete plugs) |
| `RibThickness` | `1.2` | mm | Nominal stiffening rib thickness (1.0–1.4 mm standard) |
