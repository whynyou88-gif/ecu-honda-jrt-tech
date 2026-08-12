#!/usr/bin/env python3
# ============================================================
# jrt-keygen.py — JRT Tech Admin License Generator CLI
# Use this script to generate Activation Keys for customer HWIDs
# ============================================================

import sys
import hmac
import hashlib

MASTER_SECRET = b"JRT-TECH-PRO-MASTER-SECRET-2026-NATIVE-REMAP-STUDIO"

def generate_key_for_hwid(hwid: str) -> str:
    clean_hwid = hwid.strip().upper()
    h = hmac.new(MASTER_SECRET, clean_hwid.encode('utf-8'), hashlib.sha256)
    hex_str = h.hexdigest().upper()
    return f"KEY-{hex_str[0:4]}-{hex_str[4:8]}-{hex_str[8:12]}-{hex_str[12:16]}"

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("==================================================")
        print("      JRT TECH ANALIST PRO — LICENSE KEYGEN       ")
        print("==================================================")
        print("Usage   : python3 jrt-keygen.py <CUSTOMER_HWID>")
        print("Example : python3 jrt-keygen.py JRT-884A-99F1-33BC")
        sys.exit(1)
        
    target_hwid = sys.argv[1]
    key = generate_key_for_hwid(target_hwid)
    print("==================================================")
    print("      JRT TECH ANALIST PRO — LICENSE KEYGEN       ")
    print("==================================================")
    print(f"Customer HWID : {target_hwid}")
    print(f"Activation Key: {key}")
    print("==================================================")
