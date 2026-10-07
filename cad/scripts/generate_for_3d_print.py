"""
================================================================================
AESTHETIC & ERGONOMIC PROTOTYPE GENERATOR FOR 3D PRINTING (FOR_3D_PRINT)
Wireless Smoke Detector Enclosure - Outer Shells with Smooth Rounded Fillets
Based on User Reference:
  - Left Red Circle: Smooth generous fillet (R = 5.0 mm) on outer top shoulder
  - Right Red Circle: Smooth rounded fillet (R = 1.8 mm) on central mushroom turret cap
Files Generated:
  1. Outer_Cover_for_3D_print.step / .stl
  2. Ceiling_Base_for_3D_print.step / .stl
  3. Complete_Smoke_Detector_Shell_for_3D_print.step / .stl
================================================================================
"""

import os
import math
from build123d import *

PRINT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "for_3d_print"))
os.makedirs(PRINT_DIR, exist_ok=True)

# Key Aesthetic Parameters
OuterDiameter = 115.0          # Outer main body diameter (mm)
DeckHeight = 30.0              # Height where outer fillet begins (mm)
OuterFilletRadius = 5.0        # Smooth generous round on outer shoulder (mm) - Left Red Circle
TurretDiameter = 48.0          # Central mushroom turret cap diameter (mm)
TurretWindowHeight = 8.0       # 360-degree open window height (mm)
TurretFilletRadius = 1.8       # Smooth round on mushroom turret cap (mm) - Right Red Circle
WallThickness = 2.4            # Uniform wall thickness optimized for 0.4mm nozzle 3D printing
BaseDiameter = 115.0           # Matching outer base diameter (mm)
BaseHeight = 5.0               # Base plate thickness (mm)
Tolerance = 0.25               # Slip-fit 3D printing tolerance (mm)

print("="*75)
print("GENERATING 3D PRINT PROTOTYPE HOUSINGS (FOR_3D_PRINT)")
print("Target Output Directory:", PRINT_DIR)
print("="*75)

# -----------------------------------------------------------------------------
# 1. OUTER COVER FOR 3D PRINTING (With Smooth Rounded Fillets)
# -----------------------------------------------------------------------------
def create_outer_cover_3d_print():
    print("Building Outer_Cover_for_3D_print...")
    with BuildPart() as cover:
        # 1. Main outer cylindrical body
        Cylinder(radius=OuterDiameter/2, height=DeckHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 2. Generous smooth fillet on outer top corner (R = 5.0 mm) - Left red circle!
        top_edge = cover.faces().sort_by(Axis.Z)[-1].edges()
        fillet(top_edge, radius=OuterFilletRadius)

        # 3. Sloped aerodynamic shoulder leading up to central turret
        with Locations((0, 0, DeckHeight)):
            Cone(bottom_radius=(OuterDiameter/2) - OuterFilletRadius, top_radius=28.0, height=4.0, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 4. Central Mushroom Turret Base Collar
        turret_base_z = DeckHeight + 4.0
        with Locations((0, 0, turret_base_z - 0.5)):
            Cylinder(radius=26.0, height=1.0, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 5. 6x Vertical Aerodynamic Support Pillars connecting base to cap
        for i in range(6):
            ang = i * 60.0
            with Locations(Rotation(0, 0, ang)):
                with Locations((TurretDiameter/2 - 1.5, 0, turret_base_z)):
                    Box(length=3.0, width=4.0, height=TurretWindowHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 6. Central Mushroom Turret Cap
        turret_cap_z = turret_base_z + TurretWindowHeight
        turret_cap_thick = 3.0
        with Locations((0, 0, turret_cap_z)):
            Cylinder(radius=TurretDiameter/2, height=turret_cap_thick, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 7. Smooth rounded fillet on mushroom cap top edge (R = 1.8 mm) - Right red circle!
        cap_top_edges = cover.faces().sort_by(Axis.Z)[-1].edges()
        fillet(cap_top_edges, radius=TurretFilletRadius)

        # 8. Concentric circular styling disc on top of mushroom cap
        with Locations((0, 0, turret_cap_z + turret_cap_thick - 0.8)):
            Cylinder(radius=12.0, height=1.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 9. Dual Status LED indicator recesses on the sloped shoulder
        for angle in [75, 255]:
            with Locations(Rotation(0, 0, angle)):
                with Locations((38.0, 0, DeckHeight + 1.2)):
                    Cylinder(radius=2.0, height=4.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 10. Clean internal cavity hollowing for 3D printing
        Cylinder(radius=(OuterDiameter/2) - WallThickness, height=DeckHeight - 1.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))
        
        # Central internal pass-through bore up to the turret windows
        with Locations((0, 0, DeckHeight - 2.0)):
            Cylinder(radius=20.0, height=TurretWindowHeight + 2.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 11. Internal mating rebate on bottom edge to slide onto the base
        with Locations((0, 0, 0)):
            Cylinder(radius=(OuterDiameter/2) - 1.2, height=3.5, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

    return cover.part

# -----------------------------------------------------------------------------
# 2. CEILING BASE FOR 3D PRINTING (Clean Mating Part)
# -----------------------------------------------------------------------------
def create_ceiling_base_3d_print():
    print("Building Ceiling_Base_for_3D_print...")
    with BuildPart() as base:
        # 1. Main ceiling mounting disc
        Cylinder(radius=BaseDiameter/2, height=BaseHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 2. Central wiring & ceiling anchor clearance hole
        Cylinder(radius=25.0/2, height=BaseHeight*3, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # 3. 3x Ceiling drywall screw counterbored holes (120 deg on dia 85 mm)
        with PolarLocations(radius=85.0/2, count=3):
            Cylinder(radius=4.5/2, height=BaseHeight*3, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
            with Locations((0, 0, BaseHeight - 2.5)):
                Cylinder(radius=8.5/2, height=3.5, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 4. Stepped mating collar to friction-fit into Outer Cover
        with Locations((0, 0, BaseHeight)):
            collar_radius = (OuterDiameter/2) - 1.2 - Tolerance
            Cylinder(radius=collar_radius, height=3.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
            Cylinder(radius=collar_radius - 2.0, height=4.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 5. Smooth rounded bottom outer fillet (R = 1.5 mm)
        bottom_outer_edge = base.edges().filter_by(Axis.Z, reverse=True).sort_by(SortBy.LENGTH)[-1]
        fillet(bottom_outer_edge, radius=1.5)

    return base.part

# -----------------------------------------------------------------------------
# PIPELINE EXECUTION
# -----------------------------------------------------------------------------
def main():
    p_cover = os.path.join(PRINT_DIR, "Outer_Cover_for_3D_print.step")
    p_base = os.path.join(PRINT_DIR, "Ceiling_Base_for_3D_print.step")
    p_comp = os.path.join(PRINT_DIR, "Complete_Smoke_Detector_Shell_for_3D_print.step")

    # 1. Export Outer Cover
    cover = create_outer_cover_3d_print()
    if os.path.exists(p_cover): os.remove(p_cover)
    if os.path.exists(p_cover.replace(".step", ".stl")): os.remove(p_cover.replace(".step", ".stl"))
    export_step(cover, p_cover)
    export_stl(cover, p_cover.replace(".step", ".stl"))
    print(f" -> Outer_Cover_for_3D_print                     | Vol: {cover.volume:10.1f} mm³")

    # 2. Export Ceiling Base
    base = create_ceiling_base_3d_print()
    if os.path.exists(p_base): os.remove(p_base)
    if os.path.exists(p_base.replace(".step", ".stl")): os.remove(p_base.replace(".step", ".stl"))
    export_step(base, p_base)
    export_stl(base, p_base.replace(".step", ".stl"))
    print(f" -> Ceiling_Base_for_3D_print                    | Vol: {base.volume:10.1f} mm³")

    # 3. Export Assembled Shell
    c2 = create_outer_cover_3d_print()
    b2 = create_ceiling_base_3d_print()
    comp = Compound(children=[c2.moved(Location((0, 0, BaseHeight))), b2])
    if os.path.exists(p_comp): os.remove(p_comp)
    if os.path.exists(p_comp.replace(".step", ".stl")): os.remove(p_comp.replace(".step", ".stl"))
    export_step(comp, p_comp)
    export_stl(comp, p_comp.replace(".step", ".stl"))
    print(f" -> Complete_Smoke_Detector_Shell_for_3D_print   | Vol: {comp.volume:10.1f} mm³")

    print("="*75)
    print("SUCCESS: ALL 3D PRINT PROTOTYPE MODELS EXPORTED TO:", PRINT_DIR)
    print("="*75)

if __name__ == "__main__":
    main()
