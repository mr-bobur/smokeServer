import os
import time
from build123d import *
from generate_for_3d_print import create_outer_cover_3d_print, DeckHeight, TurretWindowHeight
from generate_hex_mesh import create_hexagonal_mesh

t0 = time.time()
cover = create_outer_cover_3d_print()
turret_base_z = DeckHeight + 4.0 # 34.0 mm
mesh = create_hexagonal_mesh(rows=3, N_per_row=42, hex_r=1.05, wall_t=1.0, D_outer=45.0, height=TurretWindowHeight, z_base=turret_base_z)

print(f"Cover vol: {cover.volume:.1f}, Mesh vol: {mesh.volume:.1f}")

# Test boolean union vs Compound
t_union = time.time()
try:
    merged = cover + mesh
    print(f"Boolean union succeeded in {time.time()-t_union:.2f}s! Vol: {merged.volume:.1f} mm3")
except Exception as e:
    print(f"Union failed: {e}")
    merged = Compound([cover, mesh])
    print(f"Created Compound in {time.time()-t_union:.2f}s! Vol: {merged.volume:.1f} mm3")
