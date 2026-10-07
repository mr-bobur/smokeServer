import os
import time
from build123d import *

MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))
PRINT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "for_3d_print"))

def create_hexagonal_mesh(rows=3, N_per_row=42, hex_r=1.05, wall_t=1.0, D_outer=45.0, height=8.0, z_base=0.0):
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

if __name__ == "__main__":
    t0 = time.time()
    mesh3 = create_hexagonal_mesh(rows=3, N_per_row=42, hex_r=1.05, wall_t=1.0)
    p_step = os.path.join(PRINT_DIR, "Smoke_Mesh_Hexagonal_for_3D_print.step")
    p_stl = os.path.join(PRINT_DIR, "Smoke_Mesh_Hexagonal_for_3D_print.stl")
    if os.path.exists(p_step): os.remove(p_step)
    if os.path.exists(p_stl): os.remove(p_stl)
    export_step(mesh3, p_step)
    export_stl(mesh3, p_stl)
    print(f"Exported Smoke_Mesh_Hexagonal_for_3D_print (126 hex holes) in {time.time()-t0:.2f}s")
