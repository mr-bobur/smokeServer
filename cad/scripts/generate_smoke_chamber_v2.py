"""
================================================================================
EXACT 2-BODY COMMERCIAL OPTICAL SMOKE CHAMBER (135° FORWARD SCATTERING)
Directly Modeled from Physical Hardware Images:
  - 135° Angle between IR LED and Photodetector
  - Central dividing septum wall
  - Full circular base with parallel anti-reflective floor serrations
  - 16-Segment perimeter labyrinth vanes (T-shaped overlapping baffles)
  - Matching Top Cap with underside serrations and 4 snap tabs
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
BaseOuterDiameter = 36.0          # Main circular base diameter (mm)
BaseOuterRadius = BaseOuterDiameter / 2.0  # 18.0 mm
FloorThickness = 1.4              # Base floor thickness (mm)
LabyrinthHeight = 8.8             # Height of perimeter vanes above floor (mm)
TotalBaseHeight = FloorThickness + LabyrinthHeight  # 10.2 mm

# Optical Geometry
ScatteringAngle = 135.0           # 135° angle between optical centerlines
OpticalAxisZ = FloorThickness + 4.2  # Optical centerline height = 5.6 mm above bottom
LeftSocketAngle = 180.0           # Receiver socket at 180° (-X axis)
RightSocketAngle = 315.0          # IR LED socket at 315° (-45° in quadrant 4)
# Angle between 180° and 315° is exactly 135°!

ApertureDiameter = 1.8            # Optical collimating aperture diameter (mm)
LedSocketWidth = 6.4              # Internal width for 5mm LED (mm)
LedSocketLength = 8.5             # Internal length for 5mm LED (mm)
LedSocketHeight = 6.6             # Internal height of socket (mm)

VaneCount = 16                    # 16-segment perimeter labyrinth
VaneWallThickness = 1.1           # Wall thickness of baffles (mm)

# Output Paths
OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "smoke_chamber"))
FOR_PRINT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "for_3d_print"))
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(FOR_PRINT_DIR, exist_ok=True)

# -----------------------------------------------------------------------------
# PART 1: CHAMBER BASE (01_Chamber_Base)
# -----------------------------------------------------------------------------
def build_chamber_base():
    print("Building 01_Chamber_Base (135° angle, 16 segments, central septum)...")
    with BuildPart() as base:
        # 1. Solid circular base floor
        Cylinder(radius=BaseOuterRadius, height=FloorThickness, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 2. Parallel anti-reflective serrated ribs across the floor
        # Grooves running parallel to Y axis across central region (radius 13mm)
        rib_pitch = 1.2
        rib_width = 0.5
        rib_h = 0.35
        for x_offset in [i * rib_pitch for i in range(-11, 12)]:
            half_len = math.sqrt(max(0.0, 13.0**2 - x_offset**2))
            if half_len > 2.0:
                with Locations((x_offset, 0, FloorThickness)):
                    Box(length=rib_width, width=half_len * 2.0, height=rib_h, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 3. 16-Segment Labyrinth Perimeter Vanes (T-shaped overlapping baffles)
        # 16 positions at 22.5° intervals
        for i in range(VaneCount):
            ang = i * (360.0 / VaneCount)
            # Skip sectors occupied by the two component sockets
            # Left socket is around 180° (165° to 195°)
            if (160.0 <= ang <= 200.0):
                continue
            # Right socket is around 315° (300° to 330°)
            if (300.0 <= ang <= 330.0):
                continue

            with Locations(Rotation(0, 0, ang)):
                # Radial stalk
                with Locations((15.5, 0, FloorThickness)):
                    Box(length=3.5, width=VaneWallThickness, height=LabyrinthHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))
                # Outer circumferential baffle wing
                with Locations((17.2, 1.6, FloorThickness)):
                    Box(length=VaneWallThickness, width=4.2, height=LabyrinthHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))
                # Inner angled baffle wing
                with Locations((13.8, -1.2, FloorThickness)):
                    Box(length=VaneWallThickness, width=3.2, height=LabyrinthHeight, rotation=(0, 0, 25), align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 4. Central Optical Septum Wall (Dividing Barrier between LED and Photodiode)
        # Positioned along angle 247.5° (bisector between 180° and 315°)
        bisect_ang = (180.0 + 315.0) / 2.0  # 247.5°
        with Locations(Rotation(0, 0, bisect_ang)):
            # Central dividing stalk extending from radius 3.5mm to 12.0mm
            with Locations((7.5, 0, FloorThickness)):
                Box(length=8.5, width=1.3, height=LabyrinthHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))
            # Angled light-deflecting wing on tip
            with Locations((4.0, 1.2, FloorThickness)):
                Box(length=1.2, width=3.2, height=LabyrinthHeight, rotation=(0, 0, 30), align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 5. Left Receiver Socket (at 180°, -X axis)
        with Locations(Rotation(0, 0, LeftSocketAngle)):
            # Outer rectangular housing
            with Locations((16.5, 0, FloorThickness)):
                Box(length=9.5, width=LedSocketWidth + 2.4, height=LabyrinthHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))
                # Internal component pocket
                with Locations((0.8, 0, 0)):
                    Box(length=LedSocketLength, width=LedSocketWidth, height=LabyrinthHeight + 1.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))
                # Optical aperture hole facing center (along -X in world)
                with Locations((-4.0, 0, OpticalAxisZ - FloorThickness)):
                    Cylinder(radius=ApertureDiameter / 2.0, height=3.0, rotation=(0, 90, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 6. Right IR LED Socket (at 315°, -45° South-East)
        # Has extended rounded hood as shown in user's image
        with Locations(Rotation(0, 0, RightSocketAngle)):
            # Outer rectangular housing + rounded extension
            with Locations((17.0, 0, FloorThickness)):
                Box(length=10.0, width=LedSocketWidth + 2.4, height=LabyrinthHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))
                # Internal pocket
                with Locations((0.5, 0, 0)):
                    Box(length=LedSocketLength, width=LedSocketWidth, height=LabyrinthHeight + 1.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))
                # Optical aperture hole facing center
                with Locations((-4.2, 0, OpticalAxisZ - FloorThickness)):
                    Cylinder(radius=ApertureDiameter / 2.0, height=3.0, rotation=(0, 90, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
            # Extended rounded hood on rear for LED bulb
            with Locations((22.0, 0, FloorThickness)):
                Cylinder(radius=(LedSocketWidth + 2.4) / 2.0, height=LabyrinthHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))
                with Locations((0, 0, 0)):
                    Cylinder(radius=LedSocketWidth / 2.0, height=LabyrinthHeight + 1.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 7. Wire Lead Through-Slots in floor for component pins
        # Left socket lead slot
        with Locations((-18.0, 0, 0)):
            Box(length=5.0, width=3.0, height=FloorThickness * 3, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
        # Right socket lead slot
        rad_r = math.radians(RightSocketAngle)
        with Locations((18.0 * math.cos(rad_r), 18.0 * math.sin(rad_r), 0)):
            Box(length=5.0, width=3.0, height=FloorThickness * 3, rotation=(0, 0, 45), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

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
    print("Building 02_Chamber_Cap (Matching lid with roof covers and snap clips)...")
    CapOuterRadius = BaseOuterRadius + 0.6  # 18.6 mm
    CapDiscThickness = 1.5
    CapSkirtHeight = 2.4
    TotalCapHeight = CapDiscThickness + CapSkirtHeight

    with BuildPart() as cap:
        # 1. Main top circular disc
        Cylinder(radius=CapOuterRadius, height=CapDiscThickness, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 2. Smooth edge fillet on top circumference
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
        # Left socket cover roof
        with Locations(Rotation(0, 0, LeftSocketAngle)):
            with Locations((16.5, 0, -CapSkirtHeight)):
                Box(length=10.0, width=LedSocketWidth + 3.0, height=CapSkirtHeight + CapDiscThickness, align=(Align.CENTER, Align.CENTER, Align.MIN))
                # Internal hollow to receive base socket rim
                with Locations((0.8, 0, 0)):
                    Box(length=LedSocketLength + 0.6, width=LedSocketWidth + 0.6, height=CapSkirtHeight + 0.5, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # Right socket cover roof with extended rounded hood (matches Image 1!)
        with Locations(Rotation(0, 0, RightSocketAngle)):
            with Locations((17.0, 0, -CapSkirtHeight)):
                Box(length=10.5, width=LedSocketWidth + 3.0, height=CapSkirtHeight + CapDiscThickness, align=(Align.CENTER, Align.CENTER, Align.MIN))
                with Locations((0.5, 0, 0)):
                    Box(length=LedSocketLength + 0.6, width=LedSocketWidth + 0.6, height=CapSkirtHeight + 0.5, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))
            # Rounded hood extension
            with Locations((22.0, 0, -CapSkirtHeight)):
                Cylinder(radius=(LedSocketWidth + 3.0) / 2.0, height=CapSkirtHeight + CapDiscThickness, align=(Align.CENTER, Align.CENTER, Align.MIN))
                with Locations((0, 0, 0)):
                    Cylinder(radius=(LedSocketWidth + 0.6) / 2.0, height=CapSkirtHeight + 0.5, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

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
    print("GENERATING 2-BODY ENCLOSED OPTICAL SMOKE CHAMBER (135° FORWARD SCATTERING)")
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
    print(f"SUCCESS: 2-BODY SMOKE CHAMBER GENERATED IN {elapsed:.2f}s")
    print(f"Output Directory: {OUTPUT_DIR}")
    print(f"Base STEP: {os.path.join(OUTPUT_DIR, '01_Chamber_Base.step')}")
    print(f"Cap STEP:  {os.path.join(OUTPUT_DIR, '02_Chamber_Cap.step')}")
    print(f"Full Assembly STEP: {asm_step}")
    print("=" * 75)

if __name__ == "__main__":
    main()
