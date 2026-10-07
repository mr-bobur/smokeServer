import time
import math
from build123d import *

# Test 3 rows vs 2 rows
def generate_mesh_variant(rows=2, N_per_row=36, hex_r=1.4, wall_t=1.0):
    D_outer = 45.0
    D_inner = D_outer - 2 * wall_t
    Height = 8.0
    Z_start = 34.0

    with BuildPart() as mesh:
        with Locations((0, 0, Z_start)):
            Cylinder(radius=D_outer/2, height=Height, align=(Align.CENTER, Align.CENTER, Align.MIN))
            Cylinder(radius=D_inner/2, height=Height + 2.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

    cutter_len = 10.0
    cutters = []

    if rows == 2:
        z_offsets = [Z_start + 2.5, Z_start + 5.5]
    elif rows == 3:
        z_offsets = [Z_start + 1.8, Z_start + 4.0, Z_start + 6.2]

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

t0 = time.time()
m2 = generate_mesh_variant(rows=2, N_per_row=36, hex_r=1.4, wall_t=1.0)
print(f"2-row (72 hex holes): vol = {m2.volume:.1f} mm3, time = {time.time()-t0:.2f}s")

t1 = time.time()
m3 = generate_mesh_variant(rows=3, N_per_row=36, hex_r=1.0, wall_t=1.0)
print(f"3-row (108 hex holes): vol = {m3.volume:.1f} mm3, time = {time.time()-t1:.2f}s")
