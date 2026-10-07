"""
================================================================================
LOW-COST MASS PRODUCTION PARAMETRIC 3D CAD GENERATOR (V2.1 - SMOOTH ROUNDED)
Commercial Wireless Smoke Detector Endpoint (CH573 BLE / 2x AA Cartridge)
Features the Elevated Central "Mushroom Turret" with Smooth Rounded Fillets:
  - Outer shoulder fillet: R = 5.0 mm
  - Mushroom cap top fillet: R = 1.8 mm
3 Injection-Molded Plastic Bodies:
  1. 01_Outer_Cover (With Central Raised Smoke Turret & Smooth Fillets)
  2. 02_Inner_Chassis (Integrated Battery Channels + Optical Chamber + Labyrinth)
  3. 03_Ceiling_Base (Universal Mount + 20° Bayonet Cam Tracks)
Non-Plastic Components:
  - 04_PCB (55 x 35 x 1.6 mm)
  - 05_AA_Battery_1
  - 06_AA_Battery_2
  - 07_Battery_Contacts
  - 08_Insect_Mesh (Central Turret Screen Ring)
================================================================================
"""

import os
import math
import sys
from build123d import *

# -----------------------------------------------------------------------------
# 1. PARAMETRIC DESIGN SPECIFICATIONS
# -----------------------------------------------------------------------------
OuterDiameter = 115.0          # Outer Cover diameter (mm)
TotalHeight = 46.0             # Overall assembled height to top of central turret (mm)
DeckHeight = 31.0              # Main housing deck height (mm)
OuterFilletRadius = 5.0        # Smooth rounded shoulder fillet (mm)
TurretDiameter = 48.0          # Central elevated mushroom cap diameter (mm)
TurretWindowHeight = 8.0       # Open window height for 360° smoke flow (mm)
TurretCapThickness = 3.0       # Top cap thickness (mm)
TurretFilletRadius = 1.8       # Smooth mushroom cap top fillet (mm)
TurretPillarCount = 6          # Number of structural support pillars
TurretPillarWidth = 4.0        # Width of each vertical pillar (mm)

WallThickness = 2.0            # Nominal injection molding wall thickness (mm)
DraftAngle = 1.5               # Mold draft angle (deg)

BaseDiameter = 110.0           # Ceiling Base plate diameter (mm)
BaseThickness = 2.5            # Ceiling Base structural thickness (mm)
TwistAngle = 20.0              # Bayonet twist-lock rotation travel (deg)

PCB_Length = 55.0              # Mainboard length (Y-axis) (mm)
PCB_Width = 35.0               # Mainboard width (X-axis) (mm)
PCB_Thickness = 1.6            # Standard FR4 PCB thickness (mm)

BatteryDiameter = 14.5         # AA cylindrical cell diameter (mm)
BatteryLength = 50.5           # AA cell length including positive pip (mm)
BatteryClearance = 1.0         # Cartridge slide-in clearance (mm)

MeshThickness = 0.4            # SUS304 woven screen gauge (mm)
OpticalChamberDiameter = 34.0  # Integrated optical chamber diameter (mm)
OpticalChamberHeight = 18.0    # Optical chamber height (mm)
LightTrapDepth = 6.0           # Labyrinth baffle depth (mm)

ScrewDiameter = 4.0            # Ceiling mount screw clearance (mm)
RibThickness = 1.2             # Nominal stiffening rib thickness (mm)

OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))
os.makedirs(OUTPUT_DIR, exist_ok=True)

print("="*75)
print("MASS PRODUCTION COMMERCIAL WIRELESS SMOKE DETECTOR - CAD V2.1")
print("Target Output Directory:", OUTPUT_DIR)
print("="*75)

# -----------------------------------------------------------------------------
# BODY 3: CEILING MOUNTING BASE (Plastic Body #3)
# -----------------------------------------------------------------------------
def create_ceiling_base():
    print("Building 03_Ceiling_Base (Plastic Part 3 - Ceiling Flange)...")
    with BuildPart() as base:
        # 1. Main ceiling mounting disc
        Cylinder(radius=BaseDiameter/2, height=BaseThickness, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 2. Central cable & ceiling anchor pass-through
        Cylinder(radius=25.0/2, height=BaseThickness*3, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 3. 3x Direct ceiling drywall screw counterbored holes (120 deg on dia 85 mm)
        with PolarLocations(radius=85.0/2, count=3):
            Cylinder(radius=ScrewDiameter/2 + 0.25, height=BaseThickness*3, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
            with Locations((0, 0, BaseThickness - 1.5)):
                Cylinder(radius=8.5/2, height=3.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 4. Universal Junction Box Arc Slots (European 60mm & US 83.5mm)
        with Locations((0, 0, BaseThickness/2)):
            for angle in [45, 225]:
                with Locations(Rotation(0, 0, angle)):
                    with Locations((30.0, 0, 0)):
                        Box(length=8.0, width=5.0, height=BaseThickness*2, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
            for angle in [135, 315]:
                with Locations(Rotation(0, 0, angle)):
                    with Locations((41.75, 0, 0)):
                        Box(length=9.0, width=5.0, height=BaseThickness*2, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 5. Integrated Female Bayonet Twist-Lock Tracks (20 deg ramp + end stop + detent)
        with Locations((0, 0, BaseThickness)):
            Cylinder(radius=94.0/2, height=5.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
            Cylinder(radius=86.0/2, height=6.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

            # 3x Bayonet entrance insertion pockets (15 deg arc at 0, 120, 240 deg)
            with PolarLocations(radius=90.0/2, count=3):
                Box(length=8.0, width=12.0, height=7.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

            # 3x 20-degree helical cam ramps with tactile locking detent and rigid shear stops
            for ang in [0, 120, 240]:
                with Locations(Rotation(0, 0, ang + 10)):
                    with Locations((44.0, 0, 2.5)):
                        Box(length=3.5, width=8.5, height=2.5, align=(Align.CENTER, Align.CENTER, Align.CENTER))
                    with Locations((44.0, 3.5, 3.5)):
                        Cylinder(radius=0.7, height=1.5, align=(Align.CENTER, Align.CENTER, Align.CENTER))
                    with Locations((44.0, 5.5, 2.5)):
                        Box(length=4.0, width=2.5, height=3.0, align=(Align.CENTER, Align.CENTER, Align.CENTER))

    return base.part

# -----------------------------------------------------------------------------
# BODY 2: INNER CHASSIS (Monolithic Plastic Body #2)
# -----------------------------------------------------------------------------
def create_inner_chassis():
    print("Building 02_Inner_Chassis (Plastic Part 2 - Monolithic Structural Core)...")
    chassis_dia = 111.0
    chassis_z = BaseThickness

    with BuildPart() as chassis:
        with Locations((0, 0, chassis_z)):
            # 1. Structural base platform floor (thickness 2.0 mm)
            Cylinder(radius=chassis_dia/2, height=WallThickness, align=(Align.CENTER, Align.CENTER, Align.MIN))

            # 2. Structural outer rim wall (height 28.0 mm)
            Cylinder(radius=chassis_dia/2, height=28.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
            Cylinder(radius=(chassis_dia - WallThickness*2)/2, height=29.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

            # Battery Channels
            with Locations((-30.0, 0, 2.0)):
                Cylinder(radius=15.5/2, height=52.5, rotation=(90, 0, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
                with Locations((0, -26.0, 0)):
                    Box(length=12.0, width=4.0, height=14.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
                with Locations((0, 26.0, 0)):
                    Box(length=12.0, width=4.0, height=14.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
                with Locations((-10.0, 0, 8.0)):
                    Cylinder(radius=9.0, height=16.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
                with Locations((0, 23.0, 0.5)):
                    Box(length=3.5, width=1.0, height=0.8, align=(Align.CENTER, Align.CENTER, Align.CENTER))
                    Box(length=1.0, width=3.5, height=0.8, align=(Align.CENTER, Align.CENTER, Align.CENTER))

            with Locations((30.0, 0, 2.0)):
                Cylinder(radius=15.5/2, height=52.5, rotation=(90, 0, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
                with Locations((0, -26.0, 0)):
                    Box(length=12.0, width=4.0, height=14.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
                with Locations((0, 26.0, 0)):
                    Box(length=12.0, width=4.0, height=14.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
                with Locations((10.0, 0, 8.0)):
                    Cylinder(radius=9.0, height=16.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
                with Locations((0, -23.0, 0.5)):
                    Box(length=3.5, width=1.0, height=0.8, align=(Align.CENTER, Align.CENTER, Align.CENTER))

            # Optical Chamber
            Cylinder(radius=OpticalChamberDiameter/2, height=OpticalChamberHeight + 10.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
            Cylinder(radius=14.0/2, height=OpticalChamberHeight + 14.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

            opt_center_z = OpticalChamberHeight/2 + 6.0
            with Locations((10.0, 0, opt_center_z)):
                Cylinder(radius=4.5/2, height=14.0, rotation=(0, 90, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
            with Locations((0, 10.0, opt_center_z)):
                Cylinder(radius=4.5/2, height=14.0, rotation=(90, 0, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
            
            with Locations((-11.0, 0, opt_center_z)):
                Cone(bottom_radius=5.5/2, top_radius=1.0/2, height=7.0, rotation=(0, -90, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
            with Locations((0, -11.0, opt_center_z)):
                Cone(bottom_radius=5.5/2, top_radius=1.0/2, height=7.0, rotation=(-90, 0, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

            for i in range(12):
                ang = i * (360.0 / 12.0)
                with Locations(Rotation(0, 0, ang)):
                    with Locations((12.0, 1.8, 6.0)):
                        Box(length=7.5, width=RibThickness, height=18.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
                    with Locations((15.0, 4.5, 6.0)):
                        Box(length=4.0, width=1.0, height=18.0, rotation=(0, 0, 35), align=(Align.CENTER, Align.CENTER, Align.MIN))

            pcb_support_z = 20.0
            for px in [-14.0, 14.0]:
                for py in [-23.0, 23.0]:
                    with Locations((px, py, 2.0)):
                        Cylinder(radius=5.0/2, height=pcb_support_z - 2.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
                        with Locations((0, 0, pcb_support_z - 7.0)):
                            Cylinder(radius=2.1/2, height=7.5, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

            with Locations((-14.0, 23.0, pcb_support_z)):
                Cylinder(radius=2.0/2, height=2.2, align=(Align.CENTER, Align.CENTER, Align.MIN))
            with Locations((14.0, -23.0, pcb_support_z)):
                Cylinder(radius=2.6/2, height=2.2, align=(Align.CENTER, Align.CENTER, Align.MIN))

        with Locations((0, 0, chassis_z - 3.0)):
            for ang in [0, 120, 240]:
                with Locations(Rotation(0, 0, ang)):
                    with Locations((44.0, 0, 0)):
                        Box(length=3.0, width=8.0, height=3.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
                        with Locations((0, 3.2, 0.8)):
                            Cylinder(radius=0.7, height=1.4, align=(Align.CENTER, Align.CENTER, Align.CENTER))

    return chassis.part

# -----------------------------------------------------------------------------
# BODY 1: OUTER COVER (Plastic Body #1 - With Smooth Rounded Fillets)
# -----------------------------------------------------------------------------
def create_outer_cover():
    print("Building 01_Outer_Cover (With Smooth Rounded Fillets)...")
    with BuildPart() as cover:
        # 1. Main outer cylinder
        Cylinder(radius=OuterDiameter/2, height=DeckHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))
        
        # 2. Smooth rounded outer shoulder fillet (R = 5.0 mm)
        top_edge = cover.faces().sort_by(Axis.Z)[-1].edges()
        fillet(top_edge, radius=OuterFilletRadius)

        # 3. Sloped aerodynamic shoulder transition
        with Locations((0, 0, DeckHeight)):
            Cone(bottom_radius=(OuterDiameter/2) - OuterFilletRadius, top_radius=28.0, height=4.0, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 4. Central Mushroom Turret Base Collar
        turret_base_z = DeckHeight + 4.0
        with Locations((0, 0, turret_base_z - 0.5)):
            Cylinder(radius=26.0, height=1.0, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 5. 6x Support Pillars
        for i in range(TurretPillarCount):
            ang = i * (360.0 / TurretPillarCount)
            with Locations(Rotation(0, 0, ang)):
                with Locations((TurretDiameter/2 - 1.5, 0, turret_base_z)):
                    Box(length=3.0, width=TurretPillarWidth, height=TurretWindowHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 6. Central Mushroom Turret Cap
        turret_cap_z = turret_base_z + TurretWindowHeight
        with Locations((0, 0, turret_cap_z)):
            Cylinder(radius=TurretDiameter/2, height=TurretCapThickness, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 7. Smooth rounded fillet on mushroom cap top edge (R = 1.8 mm)
        cap_top_edges = cover.faces().sort_by(Axis.Z)[-1].edges()
        fillet(cap_top_edges, radius=TurretFilletRadius)

        # 8. Concentric styling circle
        with Locations((0, 0, turret_cap_z + TurretCapThickness - 0.8)):
            Cylinder(radius=12.0, height=1.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 9. Dual LED indicator apertures
        for angle in [75, 255]:
            with Locations(Rotation(0, 0, angle)):
                with Locations((38.0, 0, DeckHeight + 1.2)):
                    Cylinder(radius=2.0, height=6.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 10. Hollow out main housing
        Cylinder(radius=(OuterDiameter - WallThickness*2)/2, height=DeckHeight - 1.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))
        with Locations((0, 0, DeckHeight - 2.0)):
            Cylinder(radius=20.0, height=TurretWindowHeight + 2.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 11. Internal Chassis Snaps
        with Locations((0, 0, 4.0)):
            with PolarLocations(radius=(OuterDiameter - WallThickness*2)/2, count=4):
                Box(length=2.2, width=9.0, height=4.0, align=(Align.CENTER, Align.CENTER, Align.CENTER))

    return cover.part

# -----------------------------------------------------------------------------
# NON-PLASTIC COMPONENTS
# -----------------------------------------------------------------------------
def create_pcb():
    pcb_z = BaseThickness + 20.0
    with BuildPart() as pcb:
        with Locations((0, 0, pcb_z)):
            Box(length=PCB_Width, width=PCB_Length, height=PCB_Thickness, align=(Align.CENTER, Align.CENTER, Align.MIN))
            Cylinder(radius=32.0/2, height=PCB_Thickness*2, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
            for px in [-14.0, 14.0]:
                for py in [-23.0, 23.0]:
                    with Locations((px, py, 0)):
                        Cylinder(radius=2.6/2, height=PCB_Thickness*2, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
        comp_z = pcb_z + PCB_Thickness
        with Locations((-12.0, -20.0, comp_z)):
            Box(length=4.0, width=4.0, height=0.8, align=(Align.CENTER, Align.CENTER, Align.MIN))
        with Locations((-12.0, -25.5, comp_z)):
            Box(length=12.0, width=2.0, height=0.1, align=(Align.CENTER, Align.CENTER, Align.MIN))
        with Locations((12.5, 0, comp_z)):
            Box(length=3.2, width=2.8, height=1.9, align=(Align.CENTER, Align.CENTER, Align.MIN))
        with Locations((0, 12.5, comp_z)):
            Box(length=2.8, width=3.2, height=1.9, align=(Align.CENTER, Align.CENTER, Align.MIN))
    return pcb.part

def create_battery(x_pos, is_inverted=False):
    bat_z = BaseThickness + 9.0
    with BuildPart() as bat:
        with Locations((x_pos, 0, bat_z)):
            Cylinder(radius=BatteryDiameter/2, height=49.0, rotation=(90, 0, 0), align=(Align.CENTER, Align.CENTER, Align.CENTER))
            pip_y = -25.25 if is_inverted else 25.25
            with Locations((0, pip_y, 0)):
                Cylinder(radius=5.0/2, height=1.5, rotation=(90, 0, 0), align=(Align.CENTER, Align.CENTER, Align.CENTER))
    return bat.part

def create_battery_contacts():
    cont_z = BaseThickness + 9.0
    with BuildPart() as cont:
        with Locations((-30.0, -26.0, cont_z)):
            Box(length=10.0, width=0.8, height=12.0, align=(Align.CENTER, Align.CENTER, Align.CENTER))
        with Locations((-30.0, 26.0, cont_z)):
            Box(length=10.0, width=0.8, height=12.0, align=(Align.CENTER, Align.CENTER, Align.CENTER))
        with Locations((30.0, -26.0, cont_z)):
            Box(length=10.0, width=0.8, height=12.0, align=(Align.CENTER, Align.CENTER, Align.CENTER))
        with Locations((30.0, 26.0, cont_z)):
            Box(length=10.0, width=0.8, height=12.0, align=(Align.CENTER, Align.CENTER, Align.CENTER))
    return cont.part

def create_insect_mesh():
    mesh_z = DeckHeight + 4.0
    wall_t = 1.0
    D_outer = 45.0
    D_inner = D_outer - 2 * wall_t
    with BuildPart() as mesh:
        with Locations((0, 0, mesh_z)):
            Cylinder(radius=D_outer/2, height=TurretWindowHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))
            Cylinder(radius=D_inner/2, height=TurretWindowHeight + 2.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

    cutter_len = 10.0
    cutters = []
    N_per_row = 36
    hex_r = 1.0
    z_offsets = [mesh_z + 1.8, mesh_z + 4.0, mesh_z + 6.2]

    for r_idx, z_pos in enumerate(z_offsets):
        ang_offset = (360.0 / N_per_row / 2.0) if (r_idx % 2 == 1) else 0.0
        for i in range(N_per_row):
            ang = i * (360.0 / N_per_row) + ang_offset
            with BuildPart() as c:
                with BuildSketch(Plane.YZ.offset(D_outer/2 - 2.0)):
                    with Locations((0, z_pos)):
                        RegularPolygon(radius=hex_r, side_count=6)
                extrude(amount=cutter_len)
            cutter_solid = c.part.rotate(Axis.Z, ang)
            cutters.append(cutter_solid)

    cutter_compound = Compound(cutters)
    res = mesh.part - cutter_compound
    return res

# -----------------------------------------------------------------------------
# MASTER CAD PIPELINE: BUILD, VALIDATE & EXPORT
# -----------------------------------------------------------------------------
def main():
    parts = {
        "01_Outer_Cover": create_outer_cover(),
        "02_Inner_Chassis": create_inner_chassis(),
        "03_Ceiling_Base": create_ceiling_base(),
        "04_PCB": create_pcb(),
        "05_AA_Battery_1": create_battery(-30.0, is_inverted=False),
        "06_AA_Battery_2": create_battery(30.0, is_inverted=True),
        "07_Battery_Contacts": create_battery_contacts(),
        "08_Insect_Mesh": create_insect_mesh()
    }

    print("\nExporting Production STEP and STL Models...")
    for name, part in parts.items():
        step_file = os.path.join(OUTPUT_DIR, f"{name}.step")
        stl_file = os.path.join(OUTPUT_DIR, f"{name}.stl")
        if os.path.exists(step_file): os.remove(step_file)
        if os.path.exists(stl_file): os.remove(stl_file)
        export_step(part, step_file)
        export_stl(part, stl_file)
        vol = part.volume
        bbox = part.bounding_box()
        print(f" -> {name:25s} | Vol: {vol:10.1f} mm³ | BBox: ({bbox.size.X:5.1f} × {bbox.size.Y:5.1f} × {bbox.size.Z:5.1f}) mm")

    print("\nAssembling Master Complete Solid...")
    complete_assembly = Compound(children=list(parts.values()))
    full_step = os.path.join(OUTPUT_DIR, "SmokeDetector_CompleteAssembly.step")
    full_stl = os.path.join(OUTPUT_DIR, "SmokeDetector_FullAssembly.stl")
    if os.path.exists(full_step): os.remove(full_step)
    if os.path.exists(full_stl): os.remove(full_stl)
    export_step(complete_assembly, full_step)
    export_stl(complete_assembly, full_stl)

    print("="*75)
    print("SUCCESS: V2.1 CAD PACKAGE WITH SMOOTH ROUNDED FILLETS EXPORTED")
    print(f"Master Assembly STEP: {full_step}")
    print(f"Master Assembly STL:  {full_stl}")
    print("="*75)

if __name__ == "__main__":
    main()
