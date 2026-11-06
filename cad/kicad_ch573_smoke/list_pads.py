import pcbnew

board = pcbnew.LoadBoard("cad/kicad_ch573_smoke/ch573_smoke_detector.kicad_pcb")

print("Listing footprints and pad positions:")
for fp in board.Footprints():
    ref = fp.GetReference()
    pos = fp.GetPosition()
    print(f"\n{ref} at ({pcbnew.ToMM(pos.x):.2f}, {pcbnew.ToMM(pos.y):.2f}):")
    for pad in fp.Pads():
        num = pad.GetNumber()
        ppos = pad.GetPosition()
        net = pad.GetNetname()
        print(f"  Pad {num}: ({pcbnew.ToMM(ppos.x):.2f}, {pcbnew.ToMM(ppos.y):.2f}) Net: {net}")
