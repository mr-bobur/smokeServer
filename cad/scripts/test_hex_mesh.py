import time
import math
from build123d import *

start_time = time.time()

# Cylinder parameters
D_outer = 45.0
Wall_thick = 1.0
D_inner = D_outer - 2 * Wall_thick
Height = 8.0
Z_start = 34.0

print(f"Creating base cylinder D={D_outer}, H={Height}, wall={Wall_thick}...")
with BuildPart() as mesh:
    with Locations((0, 0, Z_start)):
        Cylinder(radius=D_outer/2, height=Height, align=(Align.CENTER, Align.CENTER, Align.MIN))
        Cylinder(radius=D_inner/2, height=Height + 2.0, mode=Mode.SUBTRACT, align=(Align.CENTER, Align.CENTER, Align.MIN))

print(f"Base cylinder created in {time.time() - start_time:.2f}s. Volume: {mesh.part.volume:.1f} mm3")

# Let's test creating the hexagonal cutters
# We can make a single cutter oriented radially along X axis:
# In Y-Z plane, a regular hexagon with radius R_hex
hex_radius = 1.4  # flat-to-flat is 2 * R * cos(30) = 2.42 mm
cutter_len = 10.0 # extends through the wall

# Let's test how fast cutting 24 or 30 holes per row is
N_per_row = 24
rows = 2
z_spacing = 2.8
z_offsets = [Z_start + 2.6, Z_start + 5.4]

cutters = []
for r_idx, z_pos in enumerate(z_offsets):
    ang_offset = (360.0 / N_per_row / 2.0) if (r_idx % 2 == 1) else 0.0
    for i in range(N_per_row):
        ang = i * (360.0 / N_per_row) + ang_offset
        # Create cutter at (D_outer/2, 0, z_pos), oriented along radial direction
        # In build123d, we can create a prism
        with BuildPart() as c:
            with BuildSketch(Plane.YZ.offset(D_outer/2 - 2.0)):
                with Locations((0, z_pos)):
                    RegularPolygon(radius=hex_radius, side_count=6)
            extrude(amount=cutter_len)
        cutter_solid = c.part.rotate(Axis.Z, ang)
        cutters.append(cutter_solid)

print(f"Built {len(cutters)} cutters in {time.time() - start_time:.2f}s.")
cutter_compound = Compound(cutters)
print(f"Compound built in {time.time() - start_time:.2f}s. Performing boolean cut...")

t_cut = time.time()
result = mesh.part - cutter_compound
print(f"Boolean subtraction done in {time.time() - t_cut:.2f}s! Result volume: {result.volume:.1f} mm3")
