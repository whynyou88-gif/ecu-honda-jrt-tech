#!/usr/bin/env python3
import time
import glob
import sys

print("==================================================")
print("🔍 WRT Garage / JRT Tech — Live USB Port Monitor")
print("==================================================")
print("Memindai port serial USB di macOS secara real-time...")
print("Silakan cabut dan colokkan kembali adapter/converter USB FTDI Anda.\n")

last_ports = set()

while True:
    try:
        current_ports = set(glob.glob('/dev/cu.*'))
        added = current_ports - last_ports
        removed = last_ports - current_ports

        if added and len(last_ports) > 0:
            for p in added:
                print(f"\n✅ TERDETEKSI PORT BARU: {p}")
                if any(k in p.lower() for k in ['usb', 'wch', 'slab', 'ft']):
                    print(f"🎉 SUKSES! macOS berhasil menemukan port serial hardware: {p}")
                    print(f"👉 Sekarang Anda dapat menekan tombol CONNECT ECU di http://127.0.0.1:8080 !\n")

        if removed and len(last_ports) > 0:
            for p in removed:
                print(f"\n❌ PERANGKAT DICABUT: {p}")

        last_ports = current_ports
        time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nMonitoring dihentikan.")
        break
