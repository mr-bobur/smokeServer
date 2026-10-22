import time
import subprocess
import serial.tools.list_ports
import sys

print("[AutoUpload] Waiting for LilyGO T-Call board to be connected via USB (timeout: 180s)...")
sys.stdout.flush()

start_time = time.time()
while time.time() - start_time < 180:
    ports = list(serial.tools.list_ports.comports())
    if ports:
        for p in ports:
            # Look for COM ports
            print(f"[AutoUpload] Found active port: {p.device} - {p.description}")
            sys.stdout.flush()
            cmd = [
                "pio", "run",
                "-d", "firmware/gateway_lilygo_t_call_sim800",
                "-e", "lilygo_t_call_sim800",
                "--target", "upload",
                "--upload-port", p.device
            ]
            print(f"[AutoUpload] Starting flash upload to {p.device}...")
            sys.stdout.flush()
            res = subprocess.run(cmd)
            if res.returncode == 0:
                print(f"[AutoUpload] SUCCESS: Firmware uploaded to {p.device}!")
                sys.stdout.flush()
                sys.exit(0)
            else:
                print(f"[AutoUpload] Flash failed on {p.device}, retrying...")
                sys.stdout.flush()
    time.sleep(2)

print("[AutoUpload] No COM port was detected within 180 seconds.")
sys.stdout.flush()
sys.exit(1)
