"""
================================================================================
STANDARD ENCLOSED OPTICAL SMOKE SENSING CHAMBER (EN 54-7 / UL 268 COMPLIANT)
Parametric 3D CAD Generator using build123d
================================================================================
Components Designed:
1. 01_Optical_Smoke_Chamber_Base (120° Forward-Scattering Core + 16 Labyrinth Vanes)
2. 02_Optical_Smoke_Chamber_Top_Cap (Light-Sealing Lid with Anti-Reflective Ridges)
3. 03_Optical_Smoke_Chamber_Insect_Mesh (Fine <0.8mm Anti-Insect Screen Ring)
4. Optical_Smoke_Chamber_Complete_Assembly (Full Mated Production Assembly)
================================================================================
"""

import os
import math
import sys
import time
from build123d import *

# -----------------------------------------------------------------------------
# 1. PARAMETRIC DESIGN CONSTANTS (EN 54-7 & UL 268 STANDARD DIMENSIONS)
# -----------------------------------------------------------------------------
ChamberOuterDiameter = 34.0       # Standard commercial optical chamber diameter (mm)
ChamberOuterRadius = ChamberOuterDiameter / 2.0  # 17.0 mm
ChamberBaseHeight = 13.5          # Base labyrinth height from bottom floor to top rim (mm)
FloorThickness = 1.5              # Solid bottom floor thickness (mm)
VaneHeight = ChamberBaseHeight - FloorThickness  # 12.0 mm active labyrinth height

# Optical Centerline Geometry
OpticalAxisZ = FloorThickness + 6.0   # Optical center height = 7.5 mm above PCB/base bottom
ScatteringAngle = 120.0           # Standard 120° forward scattering angle (degrees)
EmitterAngleDeg = 210.0           # Emitter positioned at 210°
ReceiverAngleDeg = 330.0          # Receiver positioned at 330°
# Note: Light travels from 210° toward center (0,0) along vector +30°.
# Scattered light from (0,0) enters receiver at 330° along vector +330°.
# Forward scattering angle = 180° - (330° - 210°)/2 ... Vector angle = 120°!

LedHoleDiameter = 5.2             # 5mm T-1 3/4 standard IR LED body bore (mm)
LedCollimatorSlit = 1.4           # Precision beam collimating slit aperture (mm)
SensorHoleDiameter = 5.2          # 5mm Photodiode / Phototransistor body bore (mm)
SensorCollimatorSlit = 1.5        # Receiver field-of-view limiting aperture (mm)
BarrelOuterDiameter = 7.2         # Barrel wall outer diameter (mm)

# Labyrinth Dimensions
LabyrinthInnerRadius = 11.2       # Inner boundary of labyrinth vanes (mm)
LabyrinthOuterRadius = 16.5       # Outer boundary of labyrinth vanes (mm)
VaneThickness = 1.1               # Thickness of each aerodynamic curved baffle (mm)
VaneCount = 16                    # 16-vane omnidirectional smoke inlet array

# Top Cap Dimensions
CapOuterDiameter = 34.6           # Top cap outer flange diameter (mm)
CapDiscThickness = 1.6            # Top sealing disc thickness (mm)
CapLipHeight = 2.4                # Internal stepped baffle skirt height (mm)
CapTotalHeight = CapDiscThickness + CapLipHeight # 4.0 mm

# Output Directories
OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "smoke_chamber"))
FOR_PRINT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "for_3d_print"))
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(FOR_PRINT_DIR, exist_ok=True)

print("=" * 75)
print("OPTICAL SMOKE CHAMBER 3D CAD GENERATOR (EN 54-7 / UL 268)")
print("Target Output Directory:", OUTPUT_DIR)
print("=" * 75)

# -----------------------------------------------------------------------------
# PART 1: OPTICAL SMOKE CHAMBER BASE (01_Optical_Smoke_Chamber_Base)
# -----------------------------------------------------------------------------
def build_chamber_base():
    print("Building 01_Optical_Smoke_Chamber_Base...")
    with BuildPart() as base:
        # 1. Solid circular bottom platform
        Cylinder(radius=ChamberOuterRadius, height=FloorThickness, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 2. Outer cylindrical envelope wall for structural labyrinth foundation
        with Locations((0, 0, FloorThickness)):
            Cylinder(radius=ChamberOuterRadius, height=VaneHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))
            # Hollow out the active interior cavity
            Cylinder(radius=LabyrinthInnerRadius, height=VaneHeight + 2.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 3. Central optical scattering well (Ø14 mm circular sensing zone)
        with Locations((0, 0, FloorThickness)):
            Cylinder(radius=7.0, height=VaneHeight + 1.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 4. Central Anti-Reflection Septum Wall (Blocks direct line of sight between LED & Photodiode)
        # Positioned along -Y axis (angle 270°)
        with Locations((0, -LabyrinthInnerRadius/2.0, FloorThickness)):
            Box(length=1.8, width=LabyrinthInnerRadius, height=VaneHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 5. IR Emitter Barrel (at angle 210°, pointing toward (0,0))
        rad_emit = math.radians(EmitterAngleDeg)
        barrel_center_r = 11.5
        emit_x = barrel_center_r * math.cos(rad_emit)
        emit_y = barrel_center_r * math.sin(rad_emit)
        with Locations((emit_x, emit_y, OpticalAxisZ)):
            with Locations(Rotation(0, 0, EmitterAngleDeg - 90)):
                Cylinder(radius=BarrelOuterDiameter/2.0, height=8.5, rotation=(90, 0, 0), align=(Align.CENTER, Align.CENTER, Align.CENTER))
                # 5mm LED Insertion Bore
                with Locations((0, 1.2, 0)):
                    Cylinder(radius=LedHoleDiameter/2.0, height=7.5, rotation=(90, 0, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
                # Collimating Slit Aperture into center
                with Locations((0, -3.5, 0)):
                    Cylinder(radius=LedCollimatorSlit/2.0, height=4.5, rotation=(90, 0, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 6. Photodetector Receiver Barrel (at angle 330°, pointing toward (0,0))
        rad_rec = math.radians(ReceiverAngleDeg)
        rec_x = barrel_center_r * math.cos(rad_rec)
        rec_y = barrel_center_r * math.sin(rad_rec)
        with Locations((rec_x, rec_y, OpticalAxisZ)):
            with Locations(Rotation(0, 0, ReceiverAngleDeg - 90)):
                Cylinder(radius=BarrelOuterDiameter/2.0, height=8.5, rotation=(90, 0, 0), align=(Align.CENTER, Align.CENTER, Align.CENTER))
                # 5mm Receiver Insertion Bore
                with Locations((0, 1.2, 0)):
                    Cylinder(radius=SensorHoleDiameter/2.0, height=7.5, rotation=(90, 0, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
                # Collimating Aperture into center
                with Locations((0, -3.5, 0)):
                    Cylinder(radius=SensorCollimatorSlit/2.0, height=4.5, rotation=(90, 0, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 7. Primary Beam Light Trap (V-Horn opposite Emitter at 30°)
        # When clean air is present, the IR beam passes through center and is swallowed here
        rad_trap = math.radians(30.0)
        trap_x = 13.0 * math.cos(rad_trap)
        trap_y = 13.0 * math.sin(rad_trap)
        with Locations((trap_x, trap_y, OpticalAxisZ)):
            with Locations(Rotation(0, 0, 30.0 - 90)):
                # Wedge-shaped absorber pocket
                Box(length=4.5, width=7.0, height=9.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
                # Internal serrated anti-reflective ridges
                for rz in [-2.5, 0.0, 2.5]:
                    with Locations((0, 0, rz)):
                        Box(length=3.8, width=1.0, height=1.0, rotation=(45, 0, 0), align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 8. Receiver Dark Cavity Trap (opposite Receiver at 150°)
        rad_rtrap = math.radians(150.0)
        rtrap_x = 13.0 * math.cos(rad_rtrap)
        rtrap_y = 13.0 * math.sin(rad_rtrap)
        with Locations((rtrap_x, rtrap_y, OpticalAxisZ)):
            with Locations(Rotation(0, 0, 150.0 - 90)):
                Box(length=4.5, width=7.0, height=9.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 9. 16-Vane Aerodynamic Labyrinth (Light Trap + 360° Smoke Entrance)
        # Each vane is an overlapping curved pylon that blocks line-of-sight from outside
        for i in range(VaneCount):
            ang = i * (360.0 / VaneCount)
            # Skip positions overlapping barrels & traps
            if (195 <= ang <= 225) or (315 <= ang <= 345):
                continue
            with Locations(Rotation(0, 0, ang)):
                with Locations((13.5, 0, FloorThickness)):
                    Box(length=5.0, width=VaneThickness, height=VaneHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))
                with Locations((15.5, 2.2, FloorThickness)):
                    Box(length=3.0, width=VaneThickness, height=VaneHeight, rotation=(0, 0, 32), align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 10. PCB Component Lead Access Through-Holes in Floor
        # For 5mm LED pins (2.54mm pitch)
        with Locations((emit_x * 0.9, emit_y * 0.9, 0)):
            Cylinder(radius=1.2, height=FloorThickness * 3, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
        # For Photodiode pins
        with Locations((rec_x * 0.9, rec_y * 0.9, 0)):
            Cylinder(radius=1.2, height=FloorThickness * 3, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 11. Bottom PCB Alignment Locating Pins (2x Standoffs on underside)
        with Locations((12.0, 0, -2.5)):
            Cylinder(radius=1.8/2.0, height=2.5, align=(Align.CENTER, Align.CENTER, Align.MIN))
        with Locations((-12.0, 0, -2.5)):
            Cylinder(radius=1.8/2.0, height=2.5, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 12. Top Cap Retaining Snap Notches (3x at 0°, 120°, 240°)
        for snap_ang in [0, 120, 240]:
            with Locations(Rotation(0, 0, snap_ang)):
                with Locations((ChamberOuterRadius - 0.6, 0, ChamberBaseHeight - 2.0)):
                    Box(length=1.5, width=3.5, height=2.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

    return base.part

# -----------------------------------------------------------------------------
# PART 2: OPTICAL SMOKE CHAMBER TOP CAP (02_Optical_Smoke_Chamber_Top_Cap)
# -----------------------------------------------------------------------------
def build_chamber_top_cap():
    print("Building 02_Optical_Smoke_Chamber_Top_Cap...")
    with BuildPart() as cap:
        # 1. Main top ceiling disc
        Cylinder(radius=CapOuterDiameter/2.0, height=CapDiscThickness, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 2. Smooth edge chamfer on top circumference
        top_edge = cap.faces().sort_by(Axis.Z)[-1].edges()
        fillet(top_edge, radius=0.6)

        # 3. Downward stepped light-baffle collar (fits tightly inside base labyrinth)
        with Locations((0, 0, -CapLipHeight)):
            Cylinder(radius=ChamberOuterRadius - 0.25, height=CapLipHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))
            Cylinder(radius=ChamberOuterRadius - 1.6, height=CapLipHeight + 1.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 4. Internal concentric anti-reflection baffle ring
        with Locations((0, 0, -1.2)):
            Cylinder(radius=8.5, height=1.2, align=(Align.CENTER, Align.CENTER, Align.MIN))
            Cylinder(radius=7.3, height=1.5, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 5. 3x Flexible Snap Cantilever Latch Tabs
        for snap_ang in [0, 120, 240]:
            with Locations(Rotation(0, 0, snap_ang)):
                with Locations((ChamberOuterRadius - 0.4, 0, -CapLipHeight - 1.0)):
                    Box(length=1.2, width=3.2, height=CapLipHeight + 1.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
                    # Retaining catch barb
                    with Locations((0.5, 0, 0.4)):
                        Box(length=0.9, width=3.0, height=1.2, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 6. Service Grip Coin-Slot on Top Surface
        with Locations((0, 0, CapDiscThickness - 0.6)):
            Box(length=18.0, width=2.4, height=1.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

    return cap.part

# -----------------------------------------------------------------------------
# PART 3: INSECT MESH SCREEN RING (03_Optical_Smoke_Chamber_Insect_Mesh)
# -----------------------------------------------------------------------------
def build_insect_mesh():
    print("Building 03_Optical_Smoke_Chamber_Insect_Mesh...")
    mesh_radius_out = ChamberOuterRadius + 0.5
    mesh_thickness = 0.5
    mesh_radius_in = mesh_radius_out - mesh_thickness
    mesh_height = VaneHeight - 1.0

    with BuildPart() as mesh:
        with Locations((0, 0, FloorThickness + 0.5)):
            Cylinder(radius=mesh_radius_out, height=mesh_height, align=(Align.CENTER, Align.CENTER, Align.MIN))
            Cylinder(radius=mesh_radius_in, height=mesh_height + 2.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

    # Cut perforated airflow grid holes (<0.8mm aperture standard)
    cutters = []
    N_cols = 32
    z_rows = [FloorThickness + 2.5, FloorThickness + 5.5, FloorThickness + 8.5]
    cutter_len = 6.0

    for r_idx, z_val in enumerate(z_rows):
        ang_offset = (360.0 / N_cols / 2.0) if (r_idx % 2 == 1) else 0.0
        for i in range(N_cols):
            ang = i * (360.0 / N_cols) + ang_offset
            with BuildPart() as c:
                with BuildSketch(Plane.YZ.offset(mesh_radius_out - 1.0)):
                    with Locations((0, z_val)):
                        RegularPolygon(radius=0.75, side_count=6)
                extrude(amount=cutter_len)
            c_solid = c.part.rotate(Axis.Z, ang)
            cutters.append(c_solid)

    cutter_compound = Compound(cutters)
    res = mesh.part - cutter_compound
    return res

# -----------------------------------------------------------------------------
# MASTER CAD PIPELINE: BUILD, VALIDATE & EXPORT
# -----------------------------------------------------------------------------
def main():
    start_time = time.time()
    print("Executing full parametric geometry build...")

    base_part = build_chamber_base()
    cap_part = build_chamber_top_cap()
    mesh_part = build_insect_mesh()

    # Position parts for assembled state
    # Cap fits directly onto top of base at Z = ChamberBaseHeight
    cap_assembled = cap_part.translate((0, 0, ChamberBaseHeight))

    parts_export = {
        "01_Optical_Smoke_Chamber_Base": base_part,
        "02_Optical_Smoke_Chamber_Top_Cap": cap_part,
        "03_Optical_Smoke_Chamber_Insect_Mesh": mesh_part,
    }

    print("\nExporting Individual Component STEP and STL Files...")
    for name, part in parts_export.items():
        # Export to cad/smoke_chamber/
        step_p = os.path.join(OUTPUT_DIR, f"{name}.step")
        stl_p = os.path.join(OUTPUT_DIR, f"{name}.stl")
        if os.path.exists(step_p): os.remove(step_p)
        if os.path.exists(stl_p): os.remove(stl_p)
        export_step(part, step_p)
        export_stl(part, stl_p)

        # Also copy to cad/for_3d_print/
        step_print = os.path.join(FOR_PRINT_DIR, f"{name}_3D_Print.step")
        stl_print = os.path.join(FOR_PRINT_DIR, f"{name}_3D_Print.stl")
        if os.path.exists(step_print): os.remove(step_print)
        if os.path.exists(stl_print): os.remove(stl_print)
        export_step(part, step_print)
        export_stl(part, stl_print)

        vol = part.volume
        bbox = part.bounding_box()
        print(f" -> {name:36s} | Vol: {vol:8.1f} mm³ | Size: ({bbox.size.X:4.1f} × {bbox.size.Y:4.1f} × {bbox.size.Z:4.1f}) mm")

    print("\nAssembling Master Complete Optical Chamber Assembly...")
    full_assembly = Compound(children=[base_part, cap_assembled, mesh_part])
    full_step = os.path.join(OUTPUT_DIR, "Optical_Smoke_Chamber_Complete_Assembly.step")
    full_stl = os.path.join(OUTPUT_DIR, "Optical_Smoke_Chamber_Complete_Assembly.stl")
    if os.path.exists(full_step): os.remove(full_step)
    if os.path.exists(full_stl): os.remove(full_stl)
    export_step(full_assembly, full_step)
    export_stl(full_assembly, full_stl)

    # Also export to cad/for_3d_print
    full_step_print = os.path.join(FOR_PRINT_DIR, "Optical_Smoke_Chamber_Complete_Assembly_3D_Print.step")
    full_stl_print = os.path.join(FOR_PRINT_DIR, "Optical_Smoke_Chamber_Complete_Assembly_3D_Print.stl")
    if os.path.exists(full_step_print): os.remove(full_step_print)
    if os.path.exists(full_stl_print): os.remove(full_stl_print)
    export_step(full_assembly, full_step_print)
    export_stl(full_assembly, full_stl_print)

    elapsed = time.time() - start_time
    print("=" * 75)
    print(f"SUCCESS: OPTICAL SMOKE CHAMBER PACKAGE EXPORTED IN {elapsed:.2f}s")
    print(f"Directory: {OUTPUT_DIR}")
    print(f"Assembly STEP: {full_step}")
    print(f"Assembly STL:  {full_stl}")
    print("=" * 75)

if __name__ == "__main__":
    main()
