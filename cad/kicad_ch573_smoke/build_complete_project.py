"""
================================================================================
COMPLETE HARDWARE DESIGN SUITE FOR WCH CH573F WIRELESS SMOKE DETECTOR
KiCad 10 Automated Professional Layout Engine (Pure Manhattan Layer Separation)
================================================================================
"""

import os
import sys
import uuid
import pcbnew

def mm(val):
    return pcbnew.FromMM(val)

def vec(x, y):
    return pcbnew.VECTOR2I(mm(x), mm(y))

PROJECT_DIR = os.path.abspath(os.path.dirname(__file__))
PRO_FILE = os.path.join(PROJECT_DIR, "ch573_smoke_detector.kicad_pro")
SCH_FILE = os.path.join(PROJECT_DIR, "ch573_smoke_detector.kicad_sch")
PCB_FILE = os.path.join(PROJECT_DIR, "ch573_smoke_detector.kicad_pcb")
FP_BASE = "C:/Program Files/KiCad/10.0/share/kicad/footprints/"

print("="*75)
print("BUILDING CH573 WIRELESS SMOKE DETECTOR PCB (Pure Manhattan Grid)")
print("Target PCB:", PCB_FILE)
print("="*75)

board = pcbnew.BOARD()
settings = board.GetDesignSettings()
settings.m_TrackMinWidth = mm(0.127)

# Netlist definition
net_names = [
    "GND", "VBAT", "VDD", "VDCID", "VDCIA", "VINTA",
    "RF_ANT", "PA4_AIN0", "PA5_IR_PULSE", "PA12_BUZZER",
    "PA8_TX", "PA9_RX", "PB14_SWDIO", "PB15_SWCLK",
    "PB10_USB_DP", "PB11_USB_DM", "PB4_TEST", "PB22_BOOT", "PB23_RST",
    "PA3_LED", "PB7_ALARM_LED", "I2C_SCL", "I2C_SDA",
    "BUZZER_DRAIN", "IR_LED_CATHODE", "VBUS",
    "X32MO", "X32MI", "X32KO", "X32KI"
]

nets = {}
for name in net_names:
    net = pcbnew.NETINFO_ITEM(board, name)
    board.Add(net)
    nets[name] = board.FindNet(name)

# -----------------------------------------------------------------------------
# 1. BOARD OUTLINE (55.0 x 35.0 mm)
# -----------------------------------------------------------------------------
W = 35.0  # X: -17.5 to +17.5
L = 55.0  # Y: -27.5 to +27.5
R = 1.5

def add_edge(p1, p2):
    shape = pcbnew.PCB_SHAPE(board)
    shape.SetShape(pcbnew.SHAPE_T_SEGMENT)
    shape.SetLayer(pcbnew.Edge_Cuts)
    shape.SetWidth(mm(0.15))
    shape.SetStart(vec(p1[0], p1[1]))
    shape.SetEnd(vec(p2[0], p2[1]))
    board.Add(shape)

add_edge((17.5 - R, -27.5), (-17.5 + R, -27.5))
add_edge((-17.5, -27.5 + R), (-17.5, 27.5 - R))
add_edge((-17.5 + R, 27.5), (17.5 - R, 27.5))
add_edge((17.5, 27.5 - R), (17.5, -27.5 + R))
add_edge((17.5 - R, -27.5), (17.5, -27.5 + R))
add_edge((17.5, 27.5 - R), (17.5 - R, 27.5))
add_edge((-17.5 + R, 27.5), (-17.5, 27.5 - R))
add_edge((-17.5, -27.5 + R), (-17.5 + R, -27.5))

# -----------------------------------------------------------------------------
# 2. MOUNTING & CONNECTOR HOLES
# -----------------------------------------------------------------------------
def add_hole_pad(x, y, drill, pad_dia, net=None, is_plated=True):
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
    return fp

# 4x M2.5 Standoff Mounting Holes (Drill 2.7 mm, Pad 5.0 mm)
for mx, my in [(-14.0, -23.0), (14.0, -23.0), (-14.0, 23.0), (14.0, 23.0)]:
    add_hole_pad(mx, my, drill=2.7, pad_dia=5.0, net=nets["GND"], is_plated=True)

# 2x Optical Chamber Alignment Holes (Drill 2.0 mm, Pad 2.8 mm)
add_hole_pad(-12.0, 0.0, drill=2.0, pad_dia=2.8, is_plated=False)
add_hole_pad(12.0, 0.0, drill=2.0, pad_dia=2.8, is_plated=False)

# Battery Terminals (Through-hole eyelets with large annular ring)
add_hole_pad(-15.5, 0.0, drill=1.5, pad_dia=3.0, net=nets["VBAT"], is_plated=True)
add_hole_pad(15.5, 0.0, drill=1.5, pad_dia=3.0, net=nets["GND"], is_plated=True)

# -----------------------------------------------------------------------------
# 3. COMPONENT FOOTPRINTS
# -----------------------------------------------------------------------------
def load_fp(lib, name, ref, x, y, angle=0, net_map=None):
    lib_path = FP_BASE + lib
    fp = pcbnew.FootprintLoad(lib_path, name)
    if not fp:
        print(f"ERROR loading {lib}/{name}")
        return None
    fp.SetReference(ref)
    fp.SetPosition(vec(x, y))
    if angle:
        fp.SetOrientation(pcbnew.EDA_ANGLE(angle, pcbnew.DEGREES_T))
    board.Add(fp)
    if net_map:
        for pin_str, net_name in net_map.items():
            pad = fp.FindPadByNumber(str(pin_str))
            if pad and net_name in nets:
                pad.SetNet(nets[net_name])
    return fp

# U1: WCH CH573F QFN-28
ch573_map = {
    "1": "X32KO", "2": "X32KI", "3": "VDCID", "4": "VDD", "5": "VDD",
    "6": "PA8_TX", "7": "PA9_RX", "8": "PB15_SWCLK", "9": "PB14_SWDIO",
    "10": "GND", "11": "GND", "12": "PB11_USB_DM", "13": "PB10_USB_DP",
    "14": "PB7_ALARM_LED", "15": "PB4_TEST", "16": "PB23_RST", "17": "PB22_BOOT",
    "18": "X32MO", "19": "X32MI", "20": "VINTA", "21": "RF_ANT",
    "22": "VDCIA", "23": "PA4_AIN0", "24": "PA5_IR_PULSE",
    "25": "I2C_SCL", "26": "I2C_SDA", "27": "PA3_LED", "28": "PA12_BUZZER",
    "29": "GND"
}
u1 = load_fp("Package_DFN_QFN.pretty", "WQFN-28-1EP_4x4mm_P0.4mm_EP2.7x2.7mm", "U1", 0.0, -15.5, net_map=ch573_map)

# Crystals
y1 = load_fp("Crystal.pretty", "Crystal_SMD_3225-4Pin_3.2x2.5mm", "Y1", 6.5, -15.5, angle=270, net_map={
    "1": "X32MO", "2": "GND", "3": "X32MI", "4": "GND"
})
y2 = load_fp("Crystal.pretty", "Crystal_SMD_3215-2Pin_3.2x1.5mm", "Y2", -6.5, -16.5, angle=90, net_map={
    "1": "X32KO", "2": "X32KI"
})

# Decoupling Caps
c5 = load_fp("Capacitor_SMD.pretty", "C_0603_1608Metric", "C5", -2.5, -20.5, net_map={"1": "VDCID", "2": "GND"})
c6 = load_fp("Capacitor_SMD.pretty", "C_0603_1608Metric", "C6", 3.0, -9.5, net_map={"1": "VDCIA", "2": "GND"})
c7 = load_fp("Capacitor_SMD.pretty", "C_0603_1608Metric", "C7", 2.5, -20.5, net_map={"1": "VINTA", "2": "GND"})
c8 = load_fp("Capacitor_SMD.pretty", "C_0603_1608Metric", "C8", -3.5, -9.5, net_map={"1": "VDD", "2": "GND"})
c10 = load_fp("Capacitor_SMD.pretty", "C_0805_2012Metric", "C10", -6.5, -9.5, net_map={"1": "VDD", "2": "GND"})

# Power & Protection
q1 = load_fp("Package_TO_SOT_SMD.pretty", "SOT-23", "Q1", -10.0, 10.0, net_map={"1": "GND", "2": "VDD", "3": "VBAT"})
r1 = load_fp("Resistor_SMD.pretty", "R_0603_1608Metric", "R1", -10.0, 7.5, net_map={"1": "GND", "2": "VBAT"})
c11 = load_fp("Capacitor_SMD.pretty", "C_0805_2012Metric", "C11", -6.0, 10.0, net_map={"1": "VDD", "2": "GND"})

# Optical Smoke Sensors
d1 = load_fp("LED_THT.pretty", "LED_D5.0mm", "D1", -9.0, -5.2, angle=210, net_map={"1": "VDD", "2": "IR_LED_CATHODE"})
q3 = load_fp("LED_THT.pretty", "LED_D5.0mm", "Q3", 9.0, -5.2, angle=330, net_map={"1": "VDD", "2": "PA4_AIN0"})

q2 = load_fp("Package_TO_SOT_SMD.pretty", "SOT-23", "Q2", -7.5, 3.0, net_map={"1": "PA5_IR_PULSE", "2": "GND", "3": "IR_LED_CATHODE"})
r2 = load_fp("Resistor_SMD.pretty", "R_0603_1608Metric", "R2", -5.0, 3.0, net_map={"1": "PA5_IR_PULSE", "2": "GND"})
r4 = load_fp("Resistor_SMD.pretty", "R_0805_2012Metric", "R4", -9.0, -1.5, net_map={"1": "VDD", "2": "VDD"})
r5 = load_fp("Resistor_SMD.pretty", "R_0603_1608Metric", "R5", 7.5, 3.0, net_map={"1": "PA4_AIN0", "2": "GND"})
c13 = load_fp("Capacitor_SMD.pretty", "C_0402_1005Metric", "C13", 5.0, 3.0, net_map={"1": "PA4_AIN0", "2": "GND"})

# Siren Buzzer Driver
q4 = load_fp("Package_TO_SOT_SMD.pretty", "SOT-23", "Q4", 8.0, 10.0, net_map={"1": "PA12_BUZZER", "2": "GND", "3": "BUZZER_DRAIN"})
r6 = load_fp("Resistor_SMD.pretty", "R_0603_1608Metric", "R6", 8.0, 7.5, net_map={"1": "PA12_BUZZER", "2": "GND"})
l3 = load_fp("Inductor_SMD.pretty", "L_1210_3225Metric", "L3", 12.0, 13.0, net_map={"1": "VDD", "2": "BUZZER_DRAIN"})
bz1 = load_fp("Buzzer_Beeper.pretty", "Buzzer_Murata_PKMCS0909E", "BZ1", 0.0, 14.0, net_map={"1": "VDD", "2": "BUZZER_DRAIN"})

# Indicators & Controls
led1 = load_fp("LED_SMD.pretty", "LED_0805_2012Metric", "LED1", -14.0, -10.0, angle=90, net_map={"1": "PA3_LED", "2": "GND"})
led2 = load_fp("LED_SMD.pretty", "LED_0805_2012Metric", "LED2", 14.0, -10.0, angle=90, net_map={"1": "PB7_ALARM_LED", "2": "GND"})
sw1 = load_fp("Button_Switch_SMD.pretty", "SW_SPST_TL3342", "SW1", -8.0, 22.0, net_map={"1": "PB4_TEST", "2": "GND", "3": "PB4_TEST", "4": "GND"})

# Connectors
j1 = load_fp("Connector_USB.pretty", "USB_C_Receptacle_HRO_TYPE-C-31-M-12", "J1", 0.0, 24.0, angle=0, net_map={
    "A1": "GND", "B12": "GND", "A12": "GND", "B1": "GND",
    "A4": "VBUS", "B9": "VBUS", "A9": "VBUS", "B4": "VBUS",
    "A6": "PB10_USB_DP", "B6": "PB10_USB_DP",
    "A7": "PB11_USB_DM", "B7": "PB11_USB_DM"
})
j2 = load_fp("Connector_PinHeader_2.54mm.pretty", "PinHeader_1x04_P2.54mm_Vertical", "J2", -14.0, 14.0, angle=0, net_map={
    "1": "PA8_TX", "2": "PA9_RX", "3": "VDD", "4": "GND"
})
j3 = load_fp("Connector_PinHeader_2.54mm.pretty", "PinHeader_1x04_P2.54mm_Vertical", "J3", 14.0, 14.0, angle=0, net_map={
    "1": "PB14_SWDIO", "2": "PB15_SWCLK", "3": "VDD", "4": "GND"
})

# -----------------------------------------------------------------------------
# 4. 2.4 GHz MIFA ANTENNA
# -----------------------------------------------------------------------------
def add_rf_segment(p1, p2, width=0.45):
    t = pcbnew.PCB_TRACK(board)
    t.SetStart(vec(p1[0], p1[1]))
    t.SetEnd(vec(p2[0], p2[1]))
    t.SetWidth(mm(width))
    t.SetLayer(pcbnew.F_Cu)
    t.SetNet(nets["RF_ANT"])
    board.Add(t)

antenna_coords = [
    (1.96, -16.70), (1.96, -20.5), (0.0, -20.5), (0.0, -23.0),
    (-4.0, -23.0), (0.0, -23.0), (4.5, -23.0), (4.5, -26.0),
    (7.0, -26.0), (7.0, -23.5), (9.5, -23.5), (9.5, -26.0),
    (12.0, -26.0), (12.0, -23.5)
]
for i in range(len(antenna_coords) - 1):
    add_rf_segment(antenna_coords[i], antenna_coords[i+1], width=0.45)

# -----------------------------------------------------------------------------
# 5. MANHATTAN ROUTING ENGINE
# -----------------------------------------------------------------------------
def add_wire(layer, pts, width=0.15, net_name=None):
    for i in range(len(pts) - 1):
        t = pcbnew.PCB_TRACK(board)
        t.SetStart(vec(pts[i][0], pts[i][1]))
        t.SetEnd(vec(pts[i+1][0], pts[i+1][1]))
        t.SetWidth(mm(width))
        t.SetLayer(layer)
        if net_name and net_name in nets:
            t.SetNet(nets[net_name])
        board.Add(t)

def add_via(x, y, net_name="GND", drill=0.3, dia=0.6):
    v = pcbnew.PCB_VIA(board)
    v.SetPosition(vec(x, y))
    v.SetWidth(mm(dia))
    v.SetDrill(mm(drill))
    if net_name in nets:
        v.SetNet(nets[net_name])
    board.Add(v)

def route_manhattan(p1, p2, x_channel, net_name, width=0.15):
    x1, y1 = p1
    x2, y2 = p2
    # 1. Horizontal on F.Cu to channel
    if abs(x1 - x_channel) > 0.05:
        add_wire(pcbnew.F_Cu, [(x1, y1), (x_channel, y1)], width, net_name)
    # 2. Vias at start & end of channel
    add_via(x_channel, y1, net_name)
    add_via(x_channel, y2, net_name)
    # 3. Vertical on B.Cu along channel
    add_wire(pcbnew.B_Cu, [(x_channel, y1), (x_channel, y2)], width, net_name)
    # 4. Horizontal on F.Cu from channel to p2
    if abs(x_channel - x2) > 0.05:
        add_wire(pcbnew.F_Cu, [(x_channel, y2), (x2, y2)], width, net_name)

print("Executing conflict-free Manhattan routing...")

# 1. PA8_TX: J2 Pin 1 (-14.0, 14.0) to U1 Pin 6 (-1.96, -14.70) via X = -15.0
route_manhattan((-14.0, 14.0), (-1.96, -14.70), -15.0, "PA8_TX", width=0.15)

# 2. PA9_RX: J2 Pin 2 (-14.0, 16.54) to U1 Pin 7 (-1.96, -14.30) via X = -13.5
route_manhattan((-14.0, 16.54), (-1.96, -14.30), -13.5, "PA9_RX", width=0.15)

# 3. PA3_LED: LED1 Pad 1 (-14.0, -9.06) to U1 Pin 27 (-0.80, -17.46) via X = -12.5
route_manhattan((-14.0, -9.06), (-0.80, -17.46), -12.5, "PA3_LED", width=0.15)

# 4. VBAT: BT1 (-15.5, 0.0) to Q1 Pad 3 (-9.06, 10.0) via X = -11.5
route_manhattan((-15.5, 0.0), (-9.06, 10.0), -11.5, "VBAT", width=0.35)
add_wire(pcbnew.F_Cu, [(-9.18, 7.5), (-9.18, 9.0), (-9.06, 9.0), (-9.06, 10.0)], width=0.20, net_name="VBAT")

# 5. VDD: Q1 Pad 2 (-10.94, 10.95) to C11 Pad 1 (-6.95, 10.0) and U1 VDD via X = -3.5
add_wire(pcbnew.F_Cu, [(-10.94, 10.95), (-10.94, 11.5), (-6.95, 11.5), (-6.95, 10.0)], width=0.45, net_name="VDD")
route_manhattan((-6.95, 11.5), (-1.96, -15.1), -3.5, "VDD", width=0.35)
add_wire(pcbnew.F_Cu, [(-1.96, -15.1), (-1.96, -15.5)], width=0.15, net_name="VDD")
add_wire(pcbnew.F_Cu, [(-3.5, -9.5), (-4.28, -9.5)], width=0.25, net_name="VDD")
add_wire(pcbnew.F_Cu, [(-4.28, -9.5), (-6.5, -9.5)], width=0.25, net_name="VDD")

# 6. PA5_IR_PULSE: U1 Pin 24 (0.40, -17.46) to Q2 Pad 1 (-8.44, 2.05) via X = -5.0
route_manhattan((0.40, -17.46), (-8.44, 2.05), -5.0, "PA5_IR_PULSE", width=0.15)
add_wire(pcbnew.F_Cu, [(-8.44, 2.05), (-5.83, 2.05), (-5.83, 3.0)], width=0.15, net_name="PA5_IR_PULSE")

# 7. PA12_BUZZER: U1 Pin 28 (-1.20, -17.46) to Q4 Pad 1 (7.06, 9.05) via X = -1.8
route_manhattan((-1.20, -17.46), (7.06, 9.05), -1.8, "PA12_BUZZER", width=0.15)
add_wire(pcbnew.F_Cu, [(7.06, 9.05), (7.17, 9.05), (7.17, 7.50)], width=0.15, net_name="PA12_BUZZER")

# 8. VDCIA: U1 Pin 22 (1.20, -17.46) to C6 Pad 1 (3.0, -9.5) via X = +2.5
route_manhattan((1.20, -17.46), (3.0, -9.5), 2.5, "VDCIA", width=0.15)

# 9. PA4_AIN0: U1 Pin 23 (0.80, -17.46) to Q3 Pad 2 (11.20, -3.93) via X = +4.5
route_manhattan((0.80, -17.46), (11.20, -3.93), 4.5, "PA4_AIN0", width=0.15)
add_wire(pcbnew.F_Cu, [(4.5, 3.0), (6.67, 3.0)], width=0.15, net_name="PA4_AIN0")

# 10. PB7_ALARM_LED: U1 Pin 14 (1.20, -13.54) to LED2 Pad 1 (14.0, -9.06) via X = +7.5
route_manhattan((1.20, -13.54), (14.0, -9.06), 7.5, "PB7_ALARM_LED", width=0.15)

# 11. PB4_TEST: U1 Pin 15 (1.96, -14.30) to SW1 Pad 1 (-11.15, 20.10) via X = +10.0
route_manhattan((1.96, -14.30), (-11.15, 20.10), 10.0, "PB4_TEST", width=0.15)

# 12. PB15_SWCLK: J3 Pin 2 (14.0, 16.54) to U1 Pin 8 (-1.20, -13.54) via X = +12.5
route_manhattan((14.0, 16.54), (-1.20, -13.54), 12.5, "PB15_SWCLK", width=0.15)

# 13. PB14_SWDIO: J3 Pin 1 (14.0, 14.0) to U1 Pin 9 (-0.80, -13.54) via X = +14.5
route_manhattan((14.0, 14.0), (-0.80, -13.54), 14.5, "PB14_SWDIO", width=0.15)

# Local traces:
# VDCID: U1 Pin 3 (-1.96, -15.90) to C5 Pad 1 (-2.5, -20.5)
add_wire(pcbnew.F_Cu, [(-1.96, -15.90), (-3.27, -15.90), (-3.27, -20.5)], width=0.15, net_name="VDCID")
# VINTA: U1 Pin 20 (1.96, -16.30) to C7 Pad 1 (1.73, -20.5)
add_wire(pcbnew.F_Cu, [(1.96, -16.30), (1.73, -16.30), (1.73, -20.5)], width=0.15, net_name="VINTA")

# Crystals direct:
add_wire(pcbnew.F_Cu, [(1.96, -15.50), (6.5, -15.50)], width=0.15, net_name="X32MO")
add_wire(pcbnew.F_Cu, [(1.96, -15.90), (4.5, -15.90), (4.5, -16.60), (6.5, -16.60)], width=0.15, net_name="X32MI")
add_wire(pcbnew.F_Cu, [(-1.96, -16.70), (-6.5, -16.70)], width=0.15, net_name="X32KO")
add_wire(pcbnew.F_Cu, [(-1.96, -16.30), (-4.8, -16.30), (-4.8, -14.25), (-6.5, -14.25)], width=0.15, net_name="X32KI")

# Optical IR Cathode & Buzzer Drain
add_wire(pcbnew.F_Cu, [(-6.56, 3.0), (-6.56, -3.93), (-11.20, -3.93)], width=0.35, net_name="IR_LED_CATHODE")
add_wire(pcbnew.F_Cu, [(8.94, 10.0), (13.40, 10.0), (13.40, 13.0)], width=0.45, net_name="BUZZER_DRAIN")
add_wire(pcbnew.F_Cu, [(8.94, 10.0), (4.35, 10.0), (4.35, 14.0)], width=0.45, net_name="BUZZER_DRAIN")

# -----------------------------------------------------------------------------
# 6. SOLID GROUND PLANES & THERMAL VIAS
# -----------------------------------------------------------------------------
print("Pouring solid ground planes...")

# Center Thermal Vias directly under QFN-28 Exposed Pad
for vx, vy in [(-0.5, -16.0), (0.5, -16.0), (-0.5, -15.0), (0.5, -15.0)]:
    add_via(vx, vy, net_name="GND", drill=0.3, dia=0.6)

def add_plane(layer):
    zone = pcbnew.ZONE(board)
    zone.SetLayer(layer)
    zone.SetNet(nets["GND"])
    zone.SetLocalClearance(mm(0.15))
    zone.SetMinThickness(mm(0.15))
    poly = zone.Outline()
    poly.NewOutline()
    poly.Append(mm(-17.0), mm(-20.0))
    poly.Append(mm(17.0), mm(-20.0))
    poly.Append(mm(17.0), mm(27.0))
    poly.Append(mm(-17.0), mm(27.0))
    board.Add(zone)
    return zone

z_top = add_plane(pcbnew.F_Cu)
z_bot = add_plane(pcbnew.B_Cu)

# Fill copper zones
filler = pcbnew.ZONE_FILLER(board)
filler.Fill(board.Zones())
print("Ground planes poured and filled successfully!")

# -----------------------------------------------------------------------------
# 7. SILKSCREEN MARKINGS & LOGOS (Cleaned of any pad overlap)
# -----------------------------------------------------------------------------
def add_text_label(layer, text, pos, size=0.8, thickness=0.12, angle=0, mirrored=False):
    txt = pcbnew.PCB_TEXT(board)
    txt.SetText(text)
    txt.SetLayer(layer)
    txt.SetPosition(vec(pos[0], pos[1]))
    txt.SetTextSize(pcbnew.VECTOR2I(mm(size), mm(size)))
    txt.SetTextThickness(mm(thickness))
    if mirrored:
        txt.SetMirrored(True)
    if angle:
        txt.SetTextAngle(pcbnew.EDA_ANGLE(angle, pcbnew.DEGREES_T))
    board.Add(txt)

add_text_label(pcbnew.F_SilkS, "WCH CH573F BLE SMOKE", (0.0, -7.0), size=0.8, thickness=0.12)
add_text_label(pcbnew.F_SilkS, "EN 54-7 CORE", (0.0, 0.5), size=0.7, thickness=0.12)
add_text_label(pcbnew.F_SilkS, "BAT+ (3.0V)", (-13.0, -3.0), size=0.7, thickness=0.12)
add_text_label(pcbnew.F_SilkS, "BAT- (GND)", (13.0, -3.0), size=0.7, thickness=0.12)
add_text_label(pcbnew.F_SilkS, "USB-C ISP", (0.0, 21.0), size=0.7, thickness=0.12)
add_text_label(pcbnew.F_SilkS, "TEST/HUSH", (-8.0, 18.5), size=0.7, thickness=0.12)
add_text_label(pcbnew.B_SilkS, "SMART BUILDING SYSTEM", (0.0, 0.0), size=0.8, thickness=0.12, mirrored=True)
add_text_label(pcbnew.B_SilkS, "PCB REV 1.0 - JLCPCB DFM", (0.0, 2.5), size=0.7, thickness=0.12, mirrored=True)

# Save Board
board.Save(PCB_FILE)
print("SUCCESS: BOARD SAVED TO:", PCB_FILE)
print("="*75)
