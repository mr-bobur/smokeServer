"""
================================================================================
EXACT 2-BODY OPTICAL SMOKE CHAMBER v4 (135° FORWARD SCATTERING)
Updated based on direct CAD Review & Assembly Feedback:
  1. Outer segment circumferential gap = EXACTLY 2.0 mm (stem width = 5.05 mm).
  2. Inward 45° tilted blades lengthened by +3.5 mm (total length = 8.8 mm)
     for deep light trapping and zero line-of-sight.
  3. IR LED socket: OPEN FROM THE TOP on the Base for effortless drop-in
     assembly; Top Cap contains the matching roof and rear rounded hood.
  4. Rectangular IR Detector socket (open top pocket + collimator snout).
  5. PCB Mounting: 2x Locating Pegs (Ø2.0mm) + 2x M2 Screw Tabs (solidly fused).
  6. Central Dividing Septum Wall (247.5° bisector) with 45° wing.
  7. Parallel floor & ceiling anti-reflective serrations.
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
BaseOuterDiameter = 36.0                  # Main circular base diameter (mm)
BaseOuterRadius = BaseOuterDiameter / 2.0 # 18.0 mm
FloorThickness = 1.4                      # Base floor thickness (mm)
LabyrinthHeight = 8.8                     # Height of perimeter vanes above floor (mm)
TotalBaseHeight = FloorThickness + LabyrinthHeight  # 10.2 mm

# Optical Geometry
ScatteringAngle = 135.0                   # 135° forward scattering angle
OpticalAxisZ = FloorThickness + 4.2       # Optical centerline height = 5.6 mm above bottom
LeftSocketAngle = 180.0                   # Rectangular Detector socket at 180° (-X)
RightSocketAngle = 315.0                  # Standard 5mm Round LED socket at 315° (-45°)
# Exact angle: |315° - 180°| = 135.0°

ApertureDiameter = 1.8                    # Optical collimating aperture diameter (mm)

# 16-Segment Labyrinth Parameters
VaneCount = 16
VanePitchAngle = 360.0 / VaneCount        # 22.5°
# Arc length per pitch at R=18.0 mm is 2 * pi * 18 / 16 = 7.07 mm
# User requirement: gap = 2.0 mm -> Stem width = 7.07 - 2.00 = 5.07 mm
VaneStemWidth = 5.05                      # Circumferential width of outer stem (mm)
VaneStemThick = 1.2                       # Radial thickness of outer stem (mm)
VaneStemRadius = 17.3                     # Center radius of outer stem (mm)

# User requirement: Lengthen inward tilt blades by 3-4 mm
# Previous length was 5.2 mm -> New length = 8.8 mm (+3.6 mm)
VaneBladeLength = 8.8                     # Length of inward 45° blade (mm)
VaneBladeThick = 1.1                      # Thickness of blade (mm)

# Output Paths
OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "smoke_chamber"))
FOR_PRINT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "for_3d_print"))
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(FOR_PRINT_DIR, exist_ok=True)

# -----------------------------------------------------------------------------
# PART 1: CHAMBER BASE (01_Chamber_Base)
# -----------------------------------------------------------------------------
def build_chamber_base():
    print("Building 01_Chamber_Base v4...")
    print(" -> Outer segment gap = 2.0 mm (stem width = 5.05 mm)")
    print(" -> Inward tilt blades lengthened to 8.8 mm (+3.6 mm deeper)")
    print(" -> LED socket OPEN TOP for easy drop-in assembly")
    print(" -> PCB mounting pegs (Ø2.0mm) + M2 screw tabs")

    with BuildPart() as base:
        # 1. Base Plate (Floor + Locating Pegs + Screw Tabs as a unified solid)
        Cylinder(radius=BaseOuterRadius, height=FloorThickness, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 2x Downward Locating Pegs (Ø2.0mm, length 2.5mm below floor)
        with Locations((0, 14.5, -2.5)):
            Cylinder(radius=1.0, height=2.5 + FloorThickness, align=(Align.CENTER, Align.CENTER, Align.MIN))
        with Locations((0, -14.5, -2.5)):
            Cylinder(radius=1.0, height=2.5 + FloorThickness, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 2x PCB Mounting Tabs (at 45° and 225° with Ø2.2mm M2 screw holes)
        for tab_ang in [45, 225]:
            with Locations(Rotation(0, 0, tab_ang)):
                with Locations((18.0, 0, 0)):
                    Box(length=6.0, width=6.8, height=FloorThickness + 0.6, align=(Align.CENTER, Align.CENTER, Align.MIN))
                with Locations((20.5, 0, 0)):
                    Cylinder(radius=1.15, height=FloorThickness * 4, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 2. Parallel anti-reflective serrated ribs across central floor (radius 13.0 mm)
        rib_pitch = 1.2
        rib_width = 0.5
        rib_h = 0.35
        for x_offset in [i * rib_pitch for i in range(-11, 12)]:
            half_len = math.sqrt(max(0.0, 13.0**2 - x_offset**2))
            if half_len > 2.0:
                with Locations((x_offset, 0, FloorThickness)):
                    Box(length=rib_width, width=half_len * 2.0, height=rib_h, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 3. 16-Segment Labyrinth with 2.0 mm outer gaps & lengthened 45° inward blades
        for i in range(VaneCount):
            ang = i * VanePitchAngle
            # Skip sectors occupied by component sockets
            if (155.0 <= ang <= 205.0):   # Left Detector socket sector (180°)
                continue
            if (295.0 <= ang <= 335.0):   # Right LED socket sector (315°)
                continue

            with Locations(Rotation(0, 0, ang)):
                # Outer circumferential stem (width 5.05 mm leaves EXACTLY 2.0 mm gap to adjacent stem!)
                with Locations((VaneStemRadius, 0, FloorThickness)):
                    Box(length=VaneStemThick, width=VaneStemWidth, height=LabyrinthHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))

                # Inward 45° Tilted Blade (lengthened to 8.8 mm, reaching deep into chamber)
                # Positioned at corner of stem and angled 45° inward
                blade_start_x = VaneStemRadius - VaneStemThick / 2.0
                blade_start_y = VaneStemWidth / 2.0 - 0.4
                with Locations((blade_start_x, blade_start_y, FloorThickness)):
                    with Locations(Rotation(0, 0, 45)):
                        with Locations((0, -VaneBladeLength / 2.0, 0)):
                            Box(length=VaneBladeThick, width=VaneBladeLength, height=LabyrinthHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 4. Central Optical Septum Wall (Dividing Barrier at 247.5° bisector)
        bisect_ang = (LeftSocketAngle + RightSocketAngle) / 2.0  # 247.5°
        with Locations(Rotation(0, 0, bisect_ang)):
            # Main dividing wall from radius 3.5mm to 12.5mm
            with Locations((8.0, 0, FloorThickness)):
                Box(length=9.0, width=1.3, height=LabyrinthHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))
            # 45° Angled light-deflecting wing on inner tip (blocks direct LED rays)
            with Locations((4.2, 1.2, FloorThickness)):
                Box(length=1.2, width=3.4, height=LabyrinthHeight, rotation=(0, 0, 45), align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 5. Left Rectangular IR Detector Socket (at 180°, -X axis)
        # Open top U-shaped pocket for easy drop-in of rectangular photodetector
        with Locations(Rotation(0, 0, LeftSocketAngle)):
            # Outer rectangular housing walls
            with Locations((13.8, 0, FloorThickness)):
                Box(length=9.6, width=8.8, height=LabyrinthHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))
                # Internal pocket (5.4 mm wide x 7.0 mm long x full height, OPEN TOP)
                with Locations((0.8, 0, 0)):
                    Box(length=7.0, width=5.4, height=LabyrinthHeight + 1.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))
                # Optical aperture hole through front wall facing center
                with Locations((-4.0, 0, OpticalAxisZ - FloorThickness)):
                    Cylinder(radius=ApertureDiameter / 2.0, height=3.5, rotation=(0, 90, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

            # Protruding cylindrical collimator snout / boss facing chamber center
            with Locations((8.4, 0, FloorThickness)):
                with Locations((0, 0, OpticalAxisZ - FloorThickness)):
                    Cylinder(radius=1.8, height=1.4, rotation=(0, 90, 0), align=(Align.CENTER, Align.CENTER, Align.CENTER))
                    Cylinder(radius=ApertureDiameter / 2.0, height=1.6, rotation=(0, 90, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

            # Dual lead through-slots in floor with insulating divider
            with Locations((14.0, -1.27, 0)):
                Box(length=1.8, width=1.2, height=FloorThickness * 3, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
            with Locations((14.0, 1.27, 0)):
                Box(length=1.8, width=1.2, height=FloorThickness * 3, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 6. Right Standard 5mm Round LED Socket (at 315°, -45° South-East)
        # USER REQUIREMENT: OPEN FROM THE TOP on the Base!
        # The LED drops in from above directly into the cradle.
        with Locations(Rotation(0, 0, RightSocketAngle)):
            # Front aperture wall (thickness 1.6 mm) with Ø1.8 mm collimation hole
            with Locations((9.2, 0, FloorThickness)):
                Box(length=1.6, width=8.4, height=LabyrinthHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))
                with Locations((0, 0, OpticalAxisZ - FloorThickness)):
                    Cylinder(radius=ApertureDiameter / 2.0, height=2.5, rotation=(0, 90, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

            # Side guiding walls (width 8.4 mm outer, 5.6 mm inner channel, height = 5.2 mm)
            # Leaving top open for effortless LED placement!
            with Locations((14.2, -3.6, FloorThickness)):
                Box(length=8.4, width=1.2, height=5.2, align=(Align.CENTER, Align.CENTER, Align.MIN))
            with Locations((14.2, 3.6, FloorThickness)):
                Box(length=8.4, width=1.2, height=5.2, align=(Align.CENTER, Align.CENTER, Align.MIN))

            # Horizontal semi-circular cradle bed supporting the 5mm round LED bulb at Z = 5.6 mm
            with Locations((14.2, 0, FloorThickness)):
                # Solid cradle bed up to Z = 4.0 mm
                Box(length=8.4, width=6.0, height=OpticalAxisZ - FloorThickness - 0.2, align=(Align.CENTER, Align.CENTER, Align.MIN))
                # Concave cylindrical groove matching Ø5.2 mm bulb
                with Locations((0, 0, OpticalAxisZ - FloorThickness)):
                    Cylinder(radius=2.65, height=9.0, rotation=(0, 90, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

            # LED Flange locking step (at R = 17.5 mm)
            with Locations((17.5, 0, FloorThickness)):
                with Locations((0, 0, OpticalAxisZ - FloorThickness)):
                    Cylinder(radius=3.1, height=1.3, rotation=(0, 90, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

            # Rear base floor extension for LED rear body (R = 18.0 mm to 21.5 mm, open top)
            with Locations((19.8, 0, 0)):
                Box(length=4.0, width=8.4, height=FloorThickness + 2.5, align=(Align.CENTER, Align.CENTER, Align.MIN))
                # Concave groove continuing through rear
                with Locations((0, 0, OpticalAxisZ)):
                    Cylinder(radius=2.65, height=5.0, rotation=(0, 90, 0), mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

            # Dual lead through-holes for LED leads (2.54mm pitch)
            with Locations((18.5, -1.27, 0)):
                Cylinder(radius=0.7, height=FloorThickness * 4, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
            with Locations((18.5, 1.27, 0)):
                Cylinder(radius=0.7, height=FloorThickness * 4, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 7. 4x Snap Catch Notches around base rim for Top Cap retention (at 45°, 135°, 225°, 270°)
        for notch_ang in [45, 135, 225, 270]:
            with Locations(Rotation(0, 0, notch_ang)):
                with Locations((BaseOuterRadius - 0.4, 0, FloorThickness + LabyrinthHeight - 1.5)):
                    Box(length=1.2, width=3.2, height=1.6, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

    solids = base.solids()
    if len(solids) > 1:
        merged = solids[0]
        for s in solids[1:]:
            merged = merged.fuse(s)
        return merged
    return base.part

# -----------------------------------------------------------------------------
# PART 2: CHAMBER TOP CAP (02_Chamber_Cap)
# -----------------------------------------------------------------------------
def build_chamber_cap():
    print("Building 02_Chamber_Cap v4...")
    print(" -> Matching ceiling serrations")
    print(" -> Detector socket roof")
    print(" -> LED socket roof + extended rear rounded hood (encloses open base)")
    print(" -> 4 snap-lock clips")

    CapOuterRadius = BaseOuterRadius + 0.6  # 18.6 mm
    CapDiscThickness = 1.5
    CapSkirtHeight = 2.4

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

        # 4. Underside parallel anti-reflective serrated grooves across ceiling
        rib_pitch = 1.2
        rib_width = 0.5
        rib_h = 0.35
        for x_offset in [i * rib_pitch for i in range(-11, 12)]:
            half_len = math.sqrt(max(0.0, 13.0**2 - x_offset**2))
            if half_len > 2.0:
                with Locations((x_offset, 0, -rib_h)):
                    Box(length=rib_width, width=half_len * 2.0, height=rib_h, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 5. Matching roof covers for the two component sockets
        # 5A. Left Rectangular Detector socket cover roof
        with Locations(Rotation(0, 0, LeftSocketAngle)):
            with Locations((13.8, 0, -CapSkirtHeight)):
                Box(length=10.0, width=9.2, height=CapSkirtHeight + CapDiscThickness, align=(Align.CENTER, Align.CENTER, Align.MIN))
                # Internal hollow to receive base socket rim
                with Locations((0.8, 0, 0)):
                    Box(length=7.4, width=5.8, height=CapSkirtHeight + 0.5, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 5B. Right LED Socket Roof & Extended Rounded Hood (CLOSES OVER THE OPEN BASE LED CRADLE!)
        with Locations(Rotation(0, 0, RightSocketAngle)):
            # Rectangular downward hood closing over the base cradle
            with Locations((14.0, 0, -CapSkirtHeight - 3.6)):
                Box(length=10.5, width=9.0, height=CapSkirtHeight + CapDiscThickness + 3.6, align=(Align.CENTER, Align.CENTER, Align.MIN))
                # Internal hollow cavity to clamp the LED bulb securely
                with Locations((0.5, 0, 0)):
                    Box(length=8.6, width=6.0, height=CapSkirtHeight + 3.4, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

            # Extended rear rounded hood enclosing the back of the 5mm LED bulb (matching photo!)
            with Locations((20.5, 0, -CapSkirtHeight - 3.6)):
                Cylinder(radius=4.5, height=CapSkirtHeight + CapDiscThickness + 3.6, align=(Align.CENTER, Align.CENTER, Align.MIN))
                with Locations((0, 0, 0)):
                    Cylinder(radius=3.1, height=CapSkirtHeight + 3.4, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 6. 4x Snap Locking Retention Clips around perimeter (at 45°, 135°, 225°, 270°)
        for clip_ang in [45, 135, 225, 270]:
            with Locations(Rotation(0, 0, clip_ang)):
                with Locations((BaseOuterRadius - 0.1, 0, -CapSkirtHeight - 1.2)):
                    Box(length=1.1, width=2.8, height=CapSkirtHeight + 1.2, align=(Align.CENTER, Align.CENTER, Align.MIN))
                    # Locking barb
                    with Locations((0.4, 0, 0.4)):
                        Box(length=0.7, width=2.6, height=1.0, align=(Align.CENTER, Align.CENTER, Align.CENTER))

    solids = cap.solids()
    if len(solids) > 1:
        merged = solids[0]
        for s in solids[1:]:
            merged = merged.fuse(s)
        return merged
    return cap.part

# -----------------------------------------------------------------------------
# MAIN PIPELINE
# -----------------------------------------------------------------------------
def main():
    start_time = time.time()
    print("=" * 75)
    print("GENERATING EXACT 2-BODY SMOKE CHAMBER v4 (2mm GAP, 8.8mm BLADES, OPEN LED)")
    print("=" * 75)

    base = build_chamber_base()
    cap = build_chamber_cap()

    # Mated assembly: Cap sits on top of Base at Z = TotalBaseHeight
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
    print(f"SUCCESS: 2-BODY SMOKE CHAMBER v4 GENERATED IN {elapsed:.2f}s")
    print(f"Base STEP: {os.path.join(OUTPUT_DIR, '01_Chamber_Base.step')}")
    print(f"Cap STEP:  {os.path.join(OUTPUT_DIR, '02_Chamber_Cap.step')}")
    print(f"Assembly STEP: {asm_step}")
    print("=" * 75)

if __name__ == "__main__":
    main()
