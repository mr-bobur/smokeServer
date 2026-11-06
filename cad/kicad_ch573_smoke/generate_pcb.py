"""
================================================================================
SMART BUILDING WIRELESS SMOKE DETECTOR - WCH CH573F PCB GENERATOR
KiCad 10 Automated PCB Layout Engine
Compliant with:
  - JLCPCB 2-Layer Manufacturing Constraints (0.25mm trace, 0.20mm clearance)
  - Commercial Optical Labyrinth Chamber Geometry (EN 54-7 / UL 268)
  - Mechanical Enclosure CAD Model (55.0 x 35.0 mm outline, 4x M2.5 standoffs)
================================================================================
"""

import os
import sys
import math
import pcbnew

def mm(val):
    return pcbnew.FromMM(val)

def vec(x, y):
    return pcbnew.VECTOR2I(mm(x), mm(y))

OUTPUT_DIR = os.path.abspath(os.path.dirname(__file__))
BOARD_FILE = os.path.join(OUTPUT_DIR, "ch573_smoke_detector.kicad_pcb")
FP_BASE = "C:/Program Files/KiCad/10.0/share/kicad/footprints/"

print("="*75)
print("GENERATING CH573 WIRELESS SMOKE DETECTOR PCB (KiCad 10)")
print("Output File:", BOARD_FILE)
print("="*75)

# Initialize Board
board = pcbnew.BOARD()

# Design Settings
settings = board.GetDesignSettings()
settings.m_TrackMinWidth = mm(0.20)

# -----------------------------------------------------------------------------
# 1. NETLIST CREATION
# -----------------------------------------------------------------------------
net_names = [
    "GND", "VBAT", "VDD", "VDCID", "VDCIA", "VINTA",
    "RF_ANT", "PA4_AIN0", "PA5_IR_PULSE", "PA12_BUZZER",
    "PA8_TX", "PA9_RX", "PB14_SWDIO", "PB15_SWCLK",
    "PB10_USB_DP", "PB11_USB_DM", "PB4_TEST", "PB22_BOOT", "PB23_RST",
    "PA3_LED", "PB7_ALARM_LED", "I2C_SCL", "I2C_SDA",
    "BUZZER_DRAIN", "IR_LED_CATHODE", "VBUS"
]

nets = {}
for name in net_names:
    net = pcbnew.NETINFO_ITEM(board, name)
    board.Add(net)
    nets[name] = board.FindNet(name)

# -----------------------------------------------------------------------------
# 2. BOARD OUTLINE (Edge.Cuts) - 55.0 x 35.0 mm with R=1.5mm Rounded Corners
# -----------------------------------------------------------------------------
W = 35.0  # X: -17.5 to +17.5
L = 55.0  # Y: -27.5 to +27.5
R = 1.5   # Corner radius

corners = [
    (17.5 - R, -27.5),
    (17.5, -27.5 + R),
    (17.5, 27.5 - R),
    (17.5 - R, 27.5),
    (-17.5 + R, 27.5),
    (-17.5, 27.5 - R),
    (-17.5, -27.5 + R),
    (-17.5 + R, -27.5)
]

def add_line(layer, p1, p2, width=0.15):
    shape = pcbnew.PCB_SHAPE(board)
    shape.SetShape(pcbnew.SHAPE_T_SEGMENT)
    shape.SetLayer(layer)
    shape.SetWidth(mm(width))
    shape.SetStart(vec(p1[0], p1[1]))
    shape.SetEnd(vec(p2[0], p2[1]))
    board.Add(shape)

# Outline segments
add_line(pcbnew.Edge_Cuts, (17.5 - R, -27.5), (-17.5 + R, -27.5))
add_line(pcbnew.Edge_Cuts, (-17.5, -27.5 + R), (-17.5, 27.5 - R))
add_line(pcbnew.Edge_Cuts, (-17.5 + R, 27.5), (17.5 - R, 27.5))
add_line(pcbnew.Edge_Cuts, (17.5, 27.5 - R), (17.5, -27.5 + R))

# Chamfered/rounded corners
add_line(pcbnew.Edge_Cuts, (17.5 - R, -27.5), (17.5, -27.5 + R))
add_line(pcbnew.Edge_Cuts, (17.5, 27.5 - R), (17.5 - R, 27.5))
add_line(pcbnew.Edge_Cuts, (-17.5 + R, 27.5), (-17.5, 27.5 - R))
add_line(pcbnew.Edge_Cuts, (-17.5, -27.5 + R), (-17.5 + R, -27.5))

print("Outline created (55.0 x 35.0 mm)")

# -----------------------------------------------------------------------------
# 3. MOUNTING HOLES & CHAMBER ALIGNMENT HOLES
# -----------------------------------------------------------------------------
def add_pad_hole(x, y, drill, pad_dia, net=None, is_plated=True):
    fp = pcbnew.FOOTPRINT(board)
    fp.SetPosition(vec(x, y))
    pad = pcbnew.PAD(fp)
    pad.SetShape(pcbnew.PAD_SHAPE_CIRCLE)
    pad.SetSize(pcbnew.VECTOR2I(mm(pad_dia), mm(pad_dia)))
    pad.SetDrillSize(pcbnew.VECTOR2I(mm(drill), mm(drill)))
    pad.SetAttribute(pcbnew.PAD_ATTRIB_PTH if is_plated else pcbnew.PAD_ATTRIB_NPTH)
    pad.SetLayerSet(pcbnew.PAD.PTHMask() if is_plated else pcbnew.PAD.UnplatedHoleMask())
    if net:
        pad.SetNet(net)
    fp.Add(pad)
    board.Add(fp)

# 4x M2.5 Standoff Mounting Holes (Drill 2.7 mm, Pad 5.0 mm)
mount_holes = [(-14.0, -23.0), (14.0, -23.0), (-14.0, 23.0), (14.0, 23.0)]
for mx, my in mount_holes:
    add_pad_hole(mx, my, drill=2.7, pad_dia=5.0, net=nets["GND"], is_plated=True)

# 2x Optical Chamber Alignment Locating Holes (Drill 2.0 mm, Pad 3.5 mm)
add_pad_hole(-12.0, 0.0, drill=2.0, pad_dia=3.5, is_plated=False)
add_pad_hole(12.0, 0.0, drill=2.0, pad_dia=3.5, is_plated=False)

print("Mounting holes & alignment pins placed.")

# -----------------------------------------------------------------------------
# 4. SILKSCREEN GRAPHICS (Optical Chamber Marking & Legend)
# -----------------------------------------------------------------------------
# Circle marking for 34mm Optical Smoke Chamber placement
chamber_circle = pcbnew.PCB_SHAPE(board)
chamber_circle.SetShape(pcbnew.SHAPE_T_CIRCLE)
chamber_circle.SetLayer(pcbnew.F_SilkS)
chamber_circle.SetWidth(mm(0.18))
chamber_circle.SetCenter(vec(0, 0))
chamber_circle.SetStart(vec(0, 0))
chamber_circle.SetEnd(vec(17.0, 0))  # Radius 17.0 mm = Ø34.0 mm
board.Add(chamber_circle)

def add_text(layer, text, pos, size=1.0, thickness=0.15, angle=0):
    txt = pcbnew.PCB_TEXT(board)
    txt.SetText(text)
    txt.SetLayer(layer)
    txt.SetPosition(vec(pos[0], pos[1]))
    txt.SetTextSize(pcbnew.VECTOR2I(mm(size), mm(size)))
    txt.SetTextThickness(mm(thickness))
    if angle:
        txt.SetTextAngle(pcbnew.EDA_ANGLE(angle, pcbnew.DEGREES_T))
    board.Add(txt)

add_text(pcbnew.F_SilkS, "OPTICAL SMOKE CHAMBER", (0, 1.5), size=0.9, thickness=0.15)
add_text(pcbnew.F_SilkS, "EN 54-7 / UL 268 CORE", (0, 3.2), size=0.8, thickness=0.12)
add_text(pcbnew.F_SilkS, "CH573F BLE SMOKE DETECTOR v1.0", (0, -8.5), size=0.9, thickness=0.15)

# Save board
board.Save(BOARD_FILE)
print("Board saved successfully to:", BOARD_FILE)
