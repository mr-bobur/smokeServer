"""
================================================================================
HEXAGONAL HONEYCOMB SMOKE INTAKE MESH & UPDATED ENCLOSURES GENERATOR
Addresses User Request:
  "manashu tutun kiradigan qismini 6burchakli teshiklar bilan qoplash kerak"
  (Cover the smoke inlet part [COMPOUND (3):1] with hexagonal holes)

Generates:
1. cad/models/08_Insect_Mesh.step & .stl (Updated with 108 hexagonal holes)
2. cad/models/SmokeDetector_CompleteAssembly.step & .stl
3. cad/for_3d_print/Smoke_Mesh_Hexagonal_for_3D_print.step & .stl (108 hex holes)
4. cad/for_3d_print/Outer_Cover_with_Hex_Mesh_for_3D_print.step & .stl (Monolithic single-piece)
5. cad/for_3d_print/Outer_Cover_for_3D_print.step & .stl (Open window version)
6. cad/for_3d_print/Ceiling_Base_for_3D_print.step & .stl
7. cad/for_3d_print/Complete_Smoke_Detector_Shell_for_3D_print.step & .stl (With hex mesh)
================================================================================
"""

import os
import time
import math
from build123d import *

MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))
PRINT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "for_3d_print"))
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(PRINT_DIR, exist_ok=True)

# Master Parameters
OuterDiameter = 115.0
DeckHeight = 31.0
OuterFilletRadius = 5.0
TurretDiameter = 48.0
TurretWindowHeight = 8.0
TurretCapThickness = 3.0
TurretFilletRadius = 1.8
TurretPillarCount = 6
TurretPillarWidth = 4.0
WallThickness = 2.4
BaseDiameter = 115.0
BaseHeight = 5.0
Tolerance = 0.25

turret_base_z = DeckHeight + 4.0  # 35.0 mm

# -----------------------------------------------------------------------------
# 1. HEXAGONAL HONEYCOMB MESH RING FUNCTION
# -----------------------------------------------------------------------------
def build_hex_mesh(rows=3, N_per_row=36, hex_r=1.0, wall_t=1.0, D_outer=45.0, height=8.0, z_base=0.0):
    D_inner = D_outer - 2 * wall_t
    with BuildPart() as mesh:
        with Locations((0, 0, z_base)):
            Cylinder(radius=D_outer/2, height=height, align=(Align.CENTER, Align.CENTER, Align.MIN))
            Cylinder(radius=D_inner/2, height=height + 2.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

    cutter_len = 10.0
    cutters = []

    if rows == 2:
        z_offsets = [z_base + 2.5, z_base + 5.5]
    elif rows == 3:
        z_offsets = [z_base + 1.8, z_base + 4.0, z_base + 6.2]

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
# 2. OUTER COVER FOR 3D PRINTING (Open Windows)
# -----------------------------------------------------------------------------
def build_outer_cover(DeckH=31.0):
    with BuildPart() as cover:
        # Main cylinder
        Cylinder(radius=OuterDiameter/2, height=DeckH, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # R = 5.0 mm shoulder fillet
        top_edge = cover.faces().sort_by(Axis.Z)[-1].edges()
        fillet(top_edge, radius=OuterFilletRadius)

        # Aerodynamic cone to turret
        with Locations((0, 0, DeckH)):
            Cone(bottom_radius=(OuterDiameter/2) - OuterFilletRadius, top_radius=28.0, height=4.0, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # Turret base collar
        tb_z = DeckH + 4.0
        with Locations((0, 0, tb_z - 0.5)):
            Cylinder(radius=26.0, height=1.0, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # 6x Pillars
        for i in range(TurretPillarCount):
            ang = i * 60.0
            with Locations(Rotation(0, 0, ang)):
                with Locations((TurretDiameter/2 - 1.5, 0, tb_z)):
                    Box(length=3.0, width=TurretPillarWidth, height=TurretWindowHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # Turret Cap
        tc_z = tb_z + TurretWindowHeight
        with Locations((0, 0, tc_z)):
            Cylinder(radius=TurretDiameter/2, height=TurretCapThickness, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # R = 1.8 mm cap fillet
        cap_top_edges = cover.faces().sort_by(Axis.Z)[-1].edges()
        fillet(cap_top_edges, radius=TurretFilletRadius)

        # Styling circle
        with Locations((0, 0, tc_z + TurretCapThickness - 0.8)):
            Cylinder(radius=12.0, height=1.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # Dual status LED apertures
        for angle in [75, 255]:
            with Locations(Rotation(0, 0, angle)):
                with Locations((38.0, 0, DeckH + 1.2)):
                    Cylinder(radius=2.0, height=4.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        # Internal cavity hollowing
        Cylinder(radius=(OuterDiameter/2) - WallThickness, height=DeckH - 1.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))
        with Locations((0, 0, DeckH - 2.0)):
            Cylinder(radius=20.0, height=TurretWindowHeight + 2.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

        # Internal mating rebate
        with Locations((0, 0, 0)):
            Cylinder(radius=(OuterDiameter/2) - 1.2, height=3.5, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

    return cover.part

# -----------------------------------------------------------------------------
# 3. CEILING BASE FOR 3D PRINTING
# -----------------------------------------------------------------------------
def build_ceiling_base():
    with BuildPart() as base:
        Cylinder(radius=BaseDiameter/2, height=BaseHeight, align=(Align.CENTER, Align.CENTER, Align.MIN))
        Cylinder(radius=25.0/2, height=BaseHeight*3, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))

        with PolarLocations(radius=85.0/2, count=3):
            Cylinder(radius=4.5/2, height=BaseHeight*3, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.CENTER))
            with Locations((0, 0, BaseHeight - 2.5)):
                Cylinder(radius=8.5/2, height=3.5, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

        with Locations((0, 0, BaseHeight)):
            collar_radius = (OuterDiameter/2) - 1.2 - Tolerance
            Cylinder(radius=collar_radius, height=3.0, align=(Align.CENTER, Align.CENTER, Align.MIN))
            Cylinder(radius=collar_radius - 2.0, height=4.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

        bottom_outer_edge = base.edges().filter_by(Axis.Z, reverse=True).sort_by(SortBy.LENGTH)[-1]
        fillet(bottom_outer_edge, radius=1.5)

    return base.part

# -----------------------------------------------------------------------------
# MASTER EXPORT PIPELINE
# -----------------------------------------------------------------------------
def main():
    print("="*75)
    print("GENERATING UPDATED 3D PRINT AND PRODUCTION MODELS WITH HEX MESH")
    print("="*75)

    # 1. Standalone Hex Mesh (Z origin at 0 for easy 3D printing plate placement)
    t0 = time.time()
    mesh_flat = build_hex_mesh(rows=3, N_per_row=36, hex_r=1.0, wall_t=1.0, D_outer=45.0, height=8.0, z_base=0.0)
    p_mesh_step = os.path.join(PRINT_DIR, "Smoke_Mesh_Hexagonal_for_3D_print.step")
    p_mesh_stl = os.path.join(PRINT_DIR, "Smoke_Mesh_Hexagonal_for_3D_print.stl")
    if os.path.exists(p_mesh_step): os.remove(p_mesh_step)
    if os.path.exists(p_mesh_stl): os.remove(p_mesh_stl)
    export_step(mesh_flat, p_mesh_step)
    export_stl(mesh_flat, p_mesh_stl)
    print(f" -> Smoke_Mesh_Hexagonal_for_3D_print (.step & .stl) [108 holes] | {time.time()-t0:.2f}s")

    # 2. Hex Mesh in Assembly Position (Z = 35.0 mm)
    t1 = time.time()
    mesh_in_place = build_hex_mesh(rows=3, N_per_row=36, hex_r=1.0, wall_t=1.0, D_outer=45.0, height=8.0, z_base=turret_base_z)
    p_m08_step = os.path.join(MODELS_DIR, "08_Insect_Mesh.step")
    p_m08_stl = os.path.join(MODELS_DIR, "08_Insect_Mesh.stl")
    if os.path.exists(p_m08_step): os.remove(p_m08_step)
    if os.path.exists(p_m08_stl): os.remove(p_m08_stl)
    export_step(mesh_in_place, p_m08_step)
    export_stl(mesh_in_place, p_m08_stl)
    print(f" -> 08_Insect_Mesh (.step & .stl) updated with 108 hex holes    | {time.time()-t1:.2f}s")

    # 3. Outer Cover (Standard open window)
    t2 = time.time()
    cover_standard = build_outer_cover(DeckH=DeckHeight)
    p_cov_step = os.path.join(PRINT_DIR, "Outer_Cover_for_3D_print.step")
    p_cov_stl = os.path.join(PRINT_DIR, "Outer_Cover_for_3D_print.stl")
    if os.path.exists(p_cov_step): os.remove(p_cov_step)
    if os.path.exists(p_cov_stl): os.remove(p_cov_stl)
    export_step(cover_standard, p_cov_step)
    export_stl(cover_standard, p_cov_stl)
    print(f" -> Outer_Cover_for_3D_print (.step & .stl)                      | {time.time()-t2:.2f}s")

    # 4. Outer Cover with Hex Mesh Integrated (Monolithic single piece!)
    t3 = time.time()
    cover_merged = cover_standard + mesh_in_place
    p_merged_step = os.path.join(PRINT_DIR, "Outer_Cover_with_Hex_Mesh_for_3D_print.step")
    p_merged_stl = os.path.join(PRINT_DIR, "Outer_Cover_with_Hex_Mesh_for_3D_print.stl")
    if os.path.exists(p_merged_step): os.remove(p_merged_step)
    if os.path.exists(p_merged_stl): os.remove(p_merged_stl)
    export_step(cover_merged, p_merged_step)
    export_stl(cover_merged, p_merged_stl)
    print(f" -> Outer_Cover_with_Hex_Mesh_for_3D_print (Monolithic Single)   | {time.time()-t3:.2f}s")

    # 5. Ceiling Base
    t4 = time.time()
    base = build_ceiling_base()
    p_base_step = os.path.join(PRINT_DIR, "Ceiling_Base_for_3D_print.step")
    p_base_stl = os.path.join(PRINT_DIR, "Ceiling_Base_for_3D_print.stl")
    if os.path.exists(p_base_step): os.remove(p_base_step)
    if os.path.exists(p_base_stl): os.remove(p_base_stl)
    export_step(base, p_base_step)
    export_stl(base, p_base_stl)
    print(f" -> Ceiling_Base_for_3D_print (.step & .stl)                    | {time.time()-t4:.2f}s")

    # 6. Complete Assembled Shell for 3D Print (Cover + Hex Mesh + Base)
    t5 = time.time()
    c_inst = build_outer_cover(DeckH=DeckHeight)
    m_inst = build_hex_mesh(rows=3, N_per_row=36, hex_r=1.0, wall_t=1.0, D_outer=45.0, height=8.0, z_base=turret_base_z)
    b_inst = build_ceiling_base()
    comp_shell = Compound(children=[c_inst.moved(Location((0, 0, BaseHeight))), m_inst.moved(Location((0, 0, BaseHeight))), b_inst])
    p_comp_step = os.path.join(PRINT_DIR, "Complete_Smoke_Detector_Shell_for_3D_print.step")
    p_comp_stl = os.path.join(PRINT_DIR, "Complete_Smoke_Detector_Shell_for_3D_print.stl")
    if os.path.exists(p_comp_step): os.remove(p_comp_step)
    if os.path.exists(p_comp_stl): os.remove(p_comp_stl)
    export_step(comp_shell, p_comp_step)
    export_stl(comp_shell, p_comp_stl)
    print(f" -> Complete_Smoke_Detector_Shell_for_3D_print (Compound)       | {time.time()-t5:.2f}s")

    print("="*75)
    print("ALL MODELS SUCCESSFULLY GENERATED WITH HEXAGONAL HONEYCOMB MESH!")
    print("="*75)

if __name__ == "__main__":
    main()
