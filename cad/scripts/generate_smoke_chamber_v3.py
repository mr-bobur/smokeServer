"""
================================================================================
EXACT 2-BODY OPTICAL SMOKE CHAMBER v3 (135° FORWARD SCATTERING)
Directly Modeled from Physical Hardware Images:
  - 16 Perimeter Labyrinth Segments with 45° ANGLED BLADES (Light-Trapping Louvers)
  - Rectangular IR Detector Socket with Collimator Snout & Dual Lead Slots
  - Standard 5mm Round IR LED Socket with Horizontal Cradle & Rear Rounded Hood
  - Dual Locating/Alignment Pegs + Dual M2 Screw Mounting Tabs for PCB
  - Central Dividing Septum Wall (at 247.5° Bisector) with Angled Wing
  - Solid Circular Base Floor with Parallel Anti-Reflective Grooves
  - Matching Top Cap with Ceiling Grooves, Socket Covers & 4 Snap Clips
================================================================================
"""

import os
import math
import sys
import time
from build123d import *

# -----------------------------------------------------------------------------
# 1. PARAMETRIC DIMENSIONS
# -----------------------------------------------------------------------------
BaseOuterDiameter = 36.0                 # Main circular base diameter (mm)
BaseOuterRadius = BaseOuterDiameter / 2.0 # 18.0 mm
FloorThickness = 1.4                     # Base floor thickness (mm)
LabyrinthHeight = 8.8                    # Height of perimeter vanes above floor (mm)
TotalBaseHeight = FloorThickness + LabyrinthHeight  # 10.2 mm

# Optical Geometry
ScatteringAngle = 135.0                  # 135° forward scattering angle
OpticalAxisZ = FloorThickness + 4.2      # Optical centerline height = 5.6 mm above bottom
LeftSocketAngle = 180.0                  # Rectangular Detector socket at 180° (-X)
RightSocketAngle = 315.0                 # Standard 5mm Round LED socket at 315° (-45°)
# Exact angle: |315° - 180°| = 135.0°

ApertureDiameter = 1.8                   # Optical collimating aperture diameter (mm)

# Output Paths
OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "smoke_chamber"))
FOR_PRINT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "for_3d_print"))
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(FOR_PRINT_DIR, exist_ok=True)

# -----------------------------------------------------------------------------
# PART 1: CHAMBER BASE (01_Chamber_Base)
# -----------------------------------------------------------------------------
def build_chamber_base():
    print("Building 01_Chamber_Base (45° angled vanes, rectangular detector, 5mm LED, PCB mounts)...")
    with BuildPart() as base:
        # 1. Solid circular base floor
        Cylinder(radius=BaseOuterRadius, height=FloorThickness, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 2. Parallel anti-reflective serrated ribs across the floor
        rib_pitch = 1.2
        rib_width = 0.5
        rib_h = 0.35
        for x_offset in [i * rib_pitch for i in range(-11, 12)]:
            half_len = math.sqrt(max(0.0, 13.0**2 - x_offset**2))
            if half_len > 2.0:
                with Locations((x_offset, 0, FloorThickness)):
                    Box(length=rib_width, width=half_len * 2.0, height=rib_h, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 3. 16-Segment Labyrinth with 45° ANGLED BLADES (Light-Trapping Louvers)
        # 16 positions at 22.5° intervals
        vane_count = 16
        for i in range(vane_count):
            ang = i * (360.0 / vane_count)
            # Skip sectors occupied by the two component sockets
            if (155.0 <= ang <= 205.0):  # Left socket sector (180°)
                continue
            if (295.0 <= ang <= 335.0):  # Right socket sector (315°)
                continue

            with Locations(Rotation(0, 0, ang)):
                # Outer circumferential base stem (at R = 17.3 mm)
                with Locations((17.2, 0, FloorThickness)):
                    Box(length=1.4, width=3.4, height=LabyrinthHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))

                # 45° Angled Inward Vane Blade (Tilcha 45° burchak ostida)
                # Slanted at 45° so light entering radially strikes the blade surface
                with Locations((15.4, 1.4, FloorThickness)):
                    Box(length=1.1, width=5.2, height=LabyrinthHeight, rotation=(0, 0, 45), align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 4. Central Optical Septum Wall (Dividing Barrier at 247.5° bisector)
        bisect_ang = (LeftSocketAngle + RightSocketAngle) / 2.0  # 247.5°
        with Locations(Rotation(0, 0, bisect_ang)):
            # Main dividing stem extending from radius 3.5mm to 12.5mm
            with Locations((8.0, 0, FloorThickness)):
                Box(length=9.0, width=1.3, height=LabyrinthHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))
            # 45° Angled light-deflecting wing on inner tip (blocks direct LED rays)
            with Locations((4.2, 1.2, FloorThickness)):
                Box(length=1.2, width=3.4, height=LabyrinthHeight, rotation=(0, 0, 45), align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 5. Left Rectangular IR Detector Socket (at 180°, -X axis)
        with Locations(Rotation(0, 0, LeftSocketAngle)):
            # Outer rectangular housing
            with Locations((13.8, 0, FloorThickness)):
                Box(length=9.6, width=8.8, height=LabyrinthHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))
                # Internal rectangular pocket for rectangular detector (e.g. 5.0 x 4.2 x 7.5 mm)
                with Locations((0.8, 0, 0)):
                    Box(length=7.0, width=5.4, height=LabyrinthHeight + 1.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))
                # Optical aperture hole through front wall facing center
                with Locations((-4.0, 0, OpticalAxisZ - FloorThickness)):
                    Cylinder(radius=ApertureDiameter / 2.0, height=3.5, rotation=(0, 90, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

            # Protruding cylindrical collimator boss / snout facing chamber center
            with Locations((8.4, 0, FloorThickness)):
                with Locations((0, 0, OpticalAxisZ - FloorThickness)):
                    Cylinder(radius=1.8, height=1.4, rotation=(0, 90, 0), align=(Align.CENTER, Align.CENTER, Align.CENTER))
                    Cylinder(radius=ApertureDiameter / 2.0, height=1.6, rotation=(0, 90, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

            # Dual lead through-slots in floor with insulating plastic divider
            # Slot 1: pin A (-1.27mm), Slot 2: pin B (+1.27mm) - 2.54mm pitch
            with Locations((14.0, -1.27, 0)):
                Box(length=1.8, width=1.2, height=FloorThickness * 3, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
            with Locations((14.0, 1.27, 0)):
                Box(length=1.8, width=1.2, height=FloorThickness * 3, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 6. Right Standard 5mm Round LED Socket (at 315°, -45° South-East)
        with Locations(Rotation(0, 0, RightSocketAngle)):
            # Outer housing
            with Locations((14.0, 0, FloorThickness)):
                Box(length=10.0, width=8.8, height=LabyrinthHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))
                # Internal cavity: front aperture hole
                with Locations((-4.2, 0, OpticalAxisZ - FloorThickness)):
                    Cylinder(radius=ApertureDiameter / 2.0, height=3.5, rotation=(0, 90, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
                # Horizontal cylindrical cradle bed for 5mm round LED bulb (Ø5.4 mm bed)
                with Locations((0.5, 0, OpticalAxisZ - FloorThickness)):
                    Cylinder(radius=2.7, height=8.0, rotation=(0, 90, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
                # LED flange rim groove (Ø6.2 mm, width 1.3 mm)
                with Locations((4.2, 0, OpticalAxisZ - FloorThickness)):
                    Cylinder(radius=3.1, height=1.3, rotation=(0, 90, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

            # Extended rear rounded hood for the rear of the 5mm LED bulb
            with Locations((21.2, 0, FloorThickness)):
                Cylinder(radius=4.4, height=LabyrinthHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))
                with Locations((0, 0, OpticalAxisZ - FloorThickness)):
                    Cylinder(radius=3.0, height=LabyrinthHeight, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

            # Dual lead through-holes for LED leads (2.54mm pitch)
            with Locations((18.5, -1.27, 0)):
                Cylinder(radius=0.7, height=FloorThickness * 3, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
            with Locations((18.5, 1.27, 0)):
                Cylinder(radius=0.7, height=FloorThickness * 3, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 7. PCB MOUNTING FEATURES (PCB ustiga qotirishga qulay elementlar)
        # 7A. 2x Downward Locating / Alignment Pegs under the floor (at 90° and 270°)
        # Ø2.0 mm pins, length 2.5 mm, insert into PCB alignment holes
        with Locations((0, 14.5, -2.5)):
            Cylinder(radius=1.0, height=2.5, align=(Align.CENTER, Align.CENTER, Align.MIN))
            # Chamfered tip for smooth insertion
            with Locations((0, 0, 0)):
                Cone(bottom_radius=1.0, top_radius=0.7, height=0.6, align=(Align.CENTER, Align.CENTER, Align.MIN))

        with Locations((0, -14.5, -2.5)):
            Cylinder(radius=1.0, height=2.5, align=(Align.CENTER, Align.CENTER, Align.MIN))
            with Locations((0, 0, 0)):
                Cone(bottom_radius=1.0, top_radius=0.7, height=0.6, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 7B. 2x PCB Mounting Screw Tabs (at 45° and 225°)
        # For M2 screws (Ø2.2 mm hole), flush with bottom floor, width 7.0 mm
        for tab_ang in [45, 225]:
            with Locations(Rotation(0, 0, tab_ang)):
                with Locations((19.5, 0, 0)):
                    Box(length=3.4, width=6.8, height=FloorThickness + 0.6, align=(Align.CENTER, Align.CENTER, Align.MIN))
                    # M2 screw clearance hole
                    Cylinder(radius=1.15, height=FloorThickness * 4, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 8. 4x Snap Catch Notches around base rim for Top Cap retention (at 45°, 135°, 225°, 270°)
        for notch_ang in [45, 135, 225, 270]:
            with Locations(Rotation(0, 0, notch_ang)):
                with Locations((BaseOuterRadius - 0.4, 0, TotalBaseHeight - 1.5)):
                    Box(length=1.2, width=3.2, height=1.6, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

    return base.part

# -----------------------------------------------------------------------------
# PART 2: CHAMBER TOP CAP (02_Chamber_Cap)
# -----------------------------------------------------------------------------
def build_chamber_cap():
    print("Building 02_Chamber_Cap (Matching lid with serrations, socket covers & snap clips)...")
    CapOuterRadius = BaseOuterRadius + 0.6  # 18.6 mm
    CapDiscThickness = 1.5
    CapSkirtHeight = 2.4
    TotalCapHeight = CapDiscThickness + CapSkirtHeight

    with BuildPart() as cap:
        # 1. Main top circular disc
        Cylinder(radius=CapOuterRadius, height=CapDiscThickness, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 2. Smooth chamfer on top circumference
        top_edge = cap.faces().sort_by(Axis.Z)[-1].edges()
        fillet(top_edge, radius=0.5)

        # 3. Outer downward light-sealing skirt
        with Locations((0, 0, -CapSkirtHeight)):
            Cylinder(radius=CapOuterRadius, height=CapSkirtHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))
            Cylinder(radius=BaseOuterRadius - 0.3, height=CapSkirtHeight + 1.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 4. Underside parallel anti-reflective serrated grooves across the ceiling (matches Image 1!)
        rib_pitch = 1.2
        rib_width = 0.5
        rib_h = 0.35
        for x_offset in [i * rib_pitch for i in range(-11, 12)]:
            half_len = math.sqrt(max(0.0, 13.0**2 - x_offset**2))
            if half_len > 2.0:
                with Locations((x_offset, 0, -rib_h)):
                    Box(length=rib_width, width=half_len * 2.0, height=rib_h, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 5. Matching roof covers for the two component sockets
        # Left Rectangular Detector socket cover roof
        with Locations(Rotation(0, 0, LeftSocketAngle)):
            with Locations((13.8, 0, -CapSkirtHeight)):
                Box(length=10.0, width=9.2, height=CapSkirtHeight + CapDiscThickness, align=(Align.CENTER, Align.CENTER, Align.MIN))
                # Internal hollow to receive base socket rim
                with Locations((0.8, 0, 0)):
                    Box(length=7.4, width=5.8, height=CapSkirtHeight + 0.5, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # Right 5mm Round LED socket cover roof with extended rounded hood (matches Image 1!)
        with Locations(Rotation(0, 0, RightSocketAngle)):
            with Locations((14.0, 0, -CapSkirtHeight)):
                Box(length=10.5, width=9.2, height=CapSkirtHeight + CapDiscThickness, align=(Align.CENTER, Align.CENTER, Align.MIN))
                with Locations((0.5, 0, 0)):
                    Box(length=8.2, width=5.8, height=CapSkirtHeight + 0.5, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))
            # Rear rounded hood extension
            with Locations((21.2, 0, -CapSkirtHeight)):
                Cylinder(radius=4.6, height=CapSkirtHeight + CapDiscThickness, align=(Align.CENTER, Align.CENTER, Align.MIN))
                with Locations((0, 0, 0)):
                    Cylinder(radius=3.2, height=CapSkirtHeight + 0.5, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 6. 4x Snap Locking Retention Clips around perimeter (matches Image 1!)
        for clip_ang in [45, 135, 225, 270]:
            with Locations(Rotation(0, 0, clip_ang)):
                with Locations((BaseOuterRadius - 0.1, 0, -CapSkirtHeight - 1.2)):
                    Box(length=1.1, width=2.8, height=CapSkirtHeight + 1.2, align=(Align.CENTER, Align.CENTER, Align.MIN))
                    # Locking barb
                    with Locations((0.4, 0, 0.4)):
                        Box(length=0.7, width=2.6, height=1.0, align=(Align.CENTER, Align.CENTER, Align.CENTER))

    return cap.part

# -----------------------------------------------------------------------------
# MAIN PIPELINE
# -----------------------------------------------------------------------------
def main():
    start_time = time.time()
    print("=" * 75)
    print("GENERATING EXACT 2-BODY SMOKE CHAMBER v3 (45° VANES, 135° ANGLE, PCB MOUNT)")
    print("=" * 75)

    base = build_chamber_base()
    cap = build_chamber_cap()

    # Mated assembly: Cap sits right on top of Base at Z = TotalBaseHeight
    cap_mated = cap.translate((0, 0, TotalBaseHeight))

    parts = {
        "01_Chamber_Base": base,
        "02_Chamber_Cap": cap,
    }

    print("\nExporting STEP and STL files...")
    for name, part in parts.items():
        # Export to cad/smoke_chamber/
        s_step = os.path.join(OUTPUT_DIR, f"{name}.step")
        s_stl = os.path.join(OUTPUT_DIR, f"{name}.stl")
        if os.path.exists(s_step): os.remove(s_step)
        if os.path.exists(s_stl): os.remove(s_stl)
        export_step(part, s_step)
        export_stl(part, s_stl)

        # Export to cad/for_3d_print/
        p_step = os.path.join(FOR_PRINT_DIR, f"{name}_3D_Print.step")
        p_stl = os.path.join(FOR_PRINT_DIR, f"{name}_3D_Print.stl")
        if os.path.exists(p_step): os.remove(p_step)
        if os.path.exists(p_stl): os.remove(p_stl)
        export_step(part, p_step)
        export_stl(part, p_stl)

        vol = part.volume
        bbox = part.bounding_box()
        print(f" -> {name:20s} | Vol: {vol:8.1f} mm³ | BBox: ({bbox.size.X:4.1f} × {bbox.size.Y:4.1f} × {bbox.size.Z:4.1f}) mm")

    print("\nExporting Master Mated 2-Body Assembly...")
    assembly = Compound(children=[base, cap_mated])
    asm_step = os.path.join(OUTPUT_DIR, "Chamber_Complete_Assembly.step")
    asm_stl = os.path.join(OUTPUT_DIR, "Chamber_Complete_Assembly.stl")
    if os.path.exists(asm_step): os.remove(asm_step)
    if os.path.exists(asm_stl): os.remove(asm_stl)
    export_step(assembly, asm_step)
    export_stl(assembly, asm_stl)

    asm_p_step = os.path.join(FOR_PRINT_DIR, "Chamber_Complete_Assembly_3D_Print.step")
    asm_p_stl = os.path.join(FOR_PRINT_DIR, "Chamber_Complete_Assembly_3D_Print.stl")
    if os.path.exists(asm_p_step): os.remove(asm_p_step)
    if os.path.exists(asm_p_stl): os.remove(asm_p_stl)
    export_step(assembly, asm_p_step)
    export_stl(assembly, asm_p_stl)

    elapsed = time.time() - start_time
    print("=" * 75)
    print(f"SUCCESS: 2-BODY SMOKE CHAMBER v3 GENERATED IN {elapsed:.2f}s")
    print(f"Base STEP: {os.path.join(OUTPUT_DIR, '01_Chamber_Base.step')}")
    print(f"Cap STEP:  {os.path.join(OUTPUT_DIR, '02_Chamber_Cap.step')}")
    print(f"Assembly STEP: {asm_step}")
    print("=" * 75)

if __name__ == "__main__":
    main()
