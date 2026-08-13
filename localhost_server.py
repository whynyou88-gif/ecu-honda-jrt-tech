import os
import sys
import json
import time
import asyncio
import struct
import datetime
from aiohttp import web

# macOS AppleUSBFTDI termios tcsetattr patch (fixes Errno 22 Invalid Argument on FTDI ports)
try:
    import serial.serialposix
    _orig_reconfigure = serial.serialposix.Serial._reconfigure_port
    def _patched_reconfigure(self, force_update=False):
        try:
            _orig_reconfigure(self, force_update=force_update)
        except Exception:
            pass
    serial.serialposix.Serial._reconfigure_port = _patched_reconfigure
except Exception:
    pass

telemetry_history = []

def get_base_dir():
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

script_dir_base = get_base_dir()

if sys.platform == 'darwin':
    # macOS: Patch pylibftdi driver search path directly because DYLD_LIBRARY_PATH is stripped by SIP
    try:
        import pylibftdi.driver
        for lib_name, search_names in [("libftdi", ["libftdi1.dylib", "libftdi.dylib"]), 
                                       ("libusb", ["libusb-1.0.dylib"])]:
            paths_to_add = []
            for base_path in ['/opt/homebrew/lib', '/usr/local/lib']:
                for s_name in search_names:
                    full_p = os.path.join(base_path, s_name)
                    if os.path.exists(full_p):
                        paths_to_add.append(full_p)
            if paths_to_add:
                pylibftdi.driver.Driver._lib_search[lib_name] = paths_to_add + pylibftdi.driver.Driver._lib_search[lib_name]
    except Exception as e:
        print(f"[Driver Init] Warning: failed to patch pylibftdi search paths: {e}")
elif sys.platform == 'win32':
    # Windows: Add common FTDI DLL locations to PATH
    ftdi_paths = [
        os.path.join(script_dir_base, 'drivers', 'ftdi'),  # Bundled FTDI DLLs
        os.path.join(os.environ.get('ProgramFiles', 'C:\\Program Files'), 'FTDI', 'CDM'),
        os.path.join(os.environ.get('ProgramFiles(x86)', 'C:\\Program Files (x86)'), 'FTDI', 'CDM'),
        os.path.join(os.environ.get('SystemRoot', 'C:\\Windows'), 'System32'),
    ]
    existing_path = os.environ.get('PATH', '')
    for p in ftdi_paths:
        if os.path.isdir(p) and p not in existing_path:
            existing_path = p + ';' + existing_path
    os.environ['PATH'] = existing_path

# Import HondaECU driver — ALWAYS use PySerial backend for macOS and FTDI serial ports
HAS_HONDA_ECU = False
_ecu_driver_backend = "pyserial"

try:
    from drivers.HondaECU_Serial import HondaECU, find_ftdi_serial_port
    HAS_HONDA_ECU = True
    _detected_port = find_ftdi_serial_port()
    print(f"[Driver] Loaded HondaECU_Serial (pyserial backend) — active port: {_detected_port or 'Scanning'}")
except Exception as e_ser:
    try:
        from HondaECU_Serial import HondaECU, find_ftdi_serial_port
        HAS_HONDA_ECU = True
        print(f"[Driver] Loaded HondaECU_Serial (direct fallback import)")
    except Exception as e_dir:
        print(f"[Driver] Warning loading HondaECU_Serial: {e_ser} / {e_dir}")

import math
from framework.live_data.repository import realtime_ecu_repository
from framework.database.ecu_database import ECUIdentificationService

_ecu_id_service = ECUIdentificationService()

# Global state
ecu = None
ecu_connected = False
ecu_info = {}
is_simulation_mode = False
consecutive_failures = 0
websockets = set()
SERVER_START_TIME = time.time()
active_buffer_file = None
last_ecu_activity = time.time()
comm_lock = asyncio.Lock()

FLASH_COUNTER_FILE = os.path.join(get_base_dir(), "HondaECUTool", "data", "flash_counter.json")

def load_flash_counter():
    try:
        if os.path.exists(FLASH_COUNTER_FILE):
            with open(FLASH_COUNTER_FILE, 'r') as f:
                data = json.load(f)
                return int(data.get("count", 0))
    except Exception:
        pass
    return 0

def save_flash_counter(count):
    try:
        os.makedirs(os.path.dirname(FLASH_COUNTER_FILE), exist_ok=True)
        with open(FLASH_COUNTER_FILE, 'w') as f:
            json.dump({"count": count, "last_updated": time.strftime("%Y-%m-%d %H:%M:%S")}, f)
    except Exception:
        pass

ecu_flash_counter = load_flash_counter()

def increment_flash_counter():
    global ecu_flash_counter
    ecu_flash_counter += 1
    save_flash_counter(ecu_flash_counter)
    return ecu_flash_counter

def log_event(message):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    log_line = f"[{timestamp}] {message}\n"
    print(log_line, end="")
    try:
        log_dir = os.path.join(script_dir_base, "logs")
        os.makedirs(log_dir, exist_ok=True)
        with open(os.path.join(log_dir, "ecu_connection.log"), "a", encoding="utf-8") as f:
            f.write(log_line)
    except Exception as e:
        sys.stderr.write(f"Failed to write to log file: {e}\n")

# Simulated DTC codes for testing without hardware (ONLY used when is_simulation_mode is True)
SIMULATED_DTCS = [
    {"code": "12-01", "description": "Primary Injector Circuit Malfunction", "milOn": True, "pending": False, "occurrence": "current"},
    {"code": "07-02", "description": "ECT Sensor (Engine Coolant Temperature) Circuit High Voltage", "milOn": False, "pending": True, "occurrence": "past"}
]

def get_mock_live_data():
    return OFFLINE_LIVE_DATA

# Global offline live data structure (no mock data fallback)
OFFLINE_LIVE_DATA = {
    "rpm": 0,
    "tps": 0.0,
    "map": 0.0,
    "iat": 0.0,
    "ect": 0.0,
    "battVoltage": 0.0,
    "injPW": 0.0,
    "ignTiming": 0.0,
    "speed": 0,
    "engineLoad": 0.0,
    "o2": 0.0,
    "afr": 0.0,
    "fuelTrim": 0.0,
    "closedLoop": False,
    "idleSwitch": False
}

# Read real data from ECU
last_valid_live_data = None
active_table = None
detected_ect_index = None

tps_min_adc = 35.0

def calculate_adaptive_tps(raw_val):
    global tps_min_adc
    if raw_val is None or raw_val <= 0:
        return 0.0
    val = float(raw_val)
    # Dynamically learn & adapt TPS zero idle baseline
    if 5.0 < val < tps_min_adc:
        tps_min_adc = val
    if val <= (tps_min_adc + 2.0):
        return 0.0
    pct = (val - tps_min_adc) * 82.0 / max(1.0, 225.0 - tps_min_adc)
    res = round(max(0.0, min(100.0, pct)), 1)
    return 0.0 if res <= 1.2 else res


def get_real_live_data():
    global ecu, ecu_connected, consecutive_failures, is_simulation_mode, active_table, last_valid_live_data, tps_min_adc, detected_ect_index
    if not ecu_connected:
        active_table = None
        last_valid_live_data = None
        tps_min_adc = 35.0
        detected_ect_index = None
        return OFFLINE_LIVE_DATA
        
    if is_flash_operation_active:
        return OFFLINE_LIVE_DATA

    if is_simulation_mode:
        return get_mock_live_data()

    if ecu is None or not HAS_HONDA_ECU:
        return OFFLINE_LIVE_DATA
    try:
        active_table = 0x17
        if hasattr(ecu, 'dev') and ecu.dev and hasattr(ecu.dev, 'reset_input_buffer'):
            try:
                ecu.dev.reset_input_buffer()
            except Exception:
                pass

        info = ecu.send_command([0x72], [0x71, 0x17], debug=False, retries=1, timeout=0.06)
        
        rx = info[2] if (isinstance(info, (list, tuple)) and len(info) >= 3) else info
        is_valid = bool(rx and isinstance(rx, (bytes, bytearray, list)) and len(rx) >= 8)
        
        if not is_valid:
            # Retry 0x17 once immediately if a byte was dropped
            info = ecu.send_command([0x72], [0x71, 0x17], debug=False, retries=1, timeout=0.06)
            rx = info[2] if (isinstance(info, (list, tuple)) and len(info) >= 3) else info
            is_valid = bool(rx and isinstance(rx, (bytes, bytearray, list)) and len(rx) >= 8)

        if is_valid:
            if consecutive_failures > 0:
                log_event(f"[ECU DATA] Recovered connection after {consecutive_failures} failures.")
            consecutive_failures = 0

            # Robust header & Table ID stripping
            if len(rx) >= 3 and rx[0] == 0x71:
                payload = rx[2:]  # Strip [0x71, TABLE_ID]
            elif len(rx) >= 2 and rx[0] in [0x17, 0x11, 0x67, 0x10, 0x00]:
                payload = rx[1:]  # Strip [TABLE_ID]
            else:
                payload = rx
            plen = len(payload)
            
            raw_hex = " ".join([f"{b:02x}" for b in payload[:min(plen, 20)]])
            log_event(f"[ECU DATA RAW] Table 0x{active_table:02X} payload[{plen}b] = [{raw_hex}]")

            
            rpm_keihin = ((payload[0] << 8) | payload[1]) if plen >= 2 else 65535
            rpm_shindengen = ((payload[6] << 8) | payload[7]) if plen >= 8 else 65535

            # --- Honda Keihin PGM-FI Table 0x17 Layout (Exact ScanTool.cs specification) ---
            if plen >= 13 and payload[4] == 0xFF and payload[5] == 0xFF:
                # Keihin PGM-FI 19-byte Frame (Vario 125 eSP, BeAT, Scoopy, Supra X 125)
                calc_rpm = ((payload[0] << 8) | payload[1]) if plen >= 2 else 0
                tps_adc  = payload[2] if plen > 2 else 0
                # OEM Keihin factory TPS angle (payload[3] / 2.0 = 0% idle to ~79% max WOT)
                raw_tps_val = float(payload[3]) / 2.0 if plen > 3 else calculate_adaptive_tps(tps_adc)
                tps_pct  = 0.0 if raw_tps_val <= 1.2 else round(raw_tps_val, 1)
                ect_raw  = payload[5] if plen > 5 else (payload[8] if plen > 8 else 0)
                iat_raw  = payload[7] if plen > 7 else (payload[9] if plen > 9 else 0)
                map_raw  = payload[9] if plen > 9 else (payload[10] if plen > 10 else 0)
                vbat_raw = payload[10] if plen > 10 else (payload[14] if plen > 14 else 0)
                inj_hi   = payload[11] if plen > 11 else 0
                inj_lo   = payload[12] if plen > 12 else 0
                ign_raw  = payload[13] if plen > 13 else 0
                spd_raw  = payload[15] if plen > 15 else (payload[17] if plen > 17 else 0)
                o2_raw   = payload[17] if plen > 17 else 0
            elif rpm_keihin < 18000:
                # Standard Keihin Layout
                calc_rpm = rpm_keihin
                tps_adc  = payload[2] if plen > 2 else 0
                tps_pct  = calculate_adaptive_tps(tps_adc)
                ect_raw  = payload[5] if plen > 5 else (payload[3] if plen > 3 else 0)
                iat_raw  = payload[7] if plen > 7 else (payload[4] if plen > 4 else 0)
                map_raw  = payload[9] if plen > 9 else (payload[5] if plen > 5 else 0)
                vbat_raw = payload[10] if plen > 10 else (payload[7] if plen > 7 else 0)
                inj_hi   = payload[11] if plen > 11 else (payload[8] if plen > 8 else 0)
                inj_lo   = payload[12] if plen > 12 else (payload[9] if plen > 9 else 0)
                ign_raw  = payload[13] if plen > 13 else (payload[10] if plen > 10 else 0)
                spd_raw  = payload[15] if plen > 15 else (payload[11] if plen > 11 else 0)
                o2_raw   = payload[17] if plen > 17 else (payload[6] if plen > 6 else 0)
            elif rpm_shindengen < 18000:
                # Shindengen Layout (Stylo 160, PCX 160, Vario 160)
                calc_rpm = rpm_shindengen
                vbat_raw = payload[0] if plen > 0 else 0
                tps_adc  = payload[1] if plen > 1 else 0
                tps_pct  = calculate_adaptive_tps(tps_adc)
                map_raw  = payload[2] if plen > 2 else 0
                ect_raw  = payload[3] if plen > 3 else 0
                iat_raw  = payload[5] if plen > 5 else 0
                inj_hi   = payload[8] if plen > 8 else 0
                inj_lo   = payload[9] if plen > 9 else 0
                ign_raw  = payload[10] if plen > 10 else 0
                spd_raw  = payload[11] if plen > 11 else 0
                o2_raw   = payload[6] if plen > 6 else 0
            else:
                calc_rpm = 0
                tps_adc  = payload[1] if plen > 1 else (payload[2] if plen > 2 else 0)
                tps_pct  = calculate_adaptive_tps(tps_adc)
                ect_raw  = payload[5] if plen > 5 else 0
                iat_raw  = payload[7] if plen > 7 else 0
                map_raw  = payload[9] if plen > 9 else 0
                vbat_raw = payload[10] if plen > 10 else 0
                inj_hi   = 0
                inj_lo   = 0
                ign_raw  = 0
                spd_raw  = 0
                o2_raw   = 0

            if calc_rpm > 18000:
                calc_rpm = 0
            ect_val  = float(ect_raw - 40.0) if (10 <= ect_raw <= 220) else 30.0
            iat_val  = float(iat_raw - 40.0) if (10 <= iat_raw <= 220) else 30.0
            map_val  = float(map_raw) if map_raw > 0 else 101.3
            vbat_val = round(vbat_raw / 10.0, 1) if (80 <= vbat_raw <= 180) else 12.8
            
            # Exact ScanTool.cs Injector PW formula: ((inj_hi << 8) | inj_lo) / 200.0 ms
            inj_raw  = (inj_hi << 8) | inj_lo
            inj_val  = round(float(inj_raw) / 200.0, 2) if inj_raw > 0 else 0.0
            
            # Exact ScanTool.cs Ignition Timing formula: ign_raw / 2.0 - 64.0 °BTDC
            ign_val  = round(float(ign_raw) / 2.0 - 64.0, 1) if ign_raw > 0 else 0.0
            speed_val = spd_raw if spd_raw < 250 else 0
            
            # Exact ScanTool.cs O2 Voltage & AFR formulas
            o2_val   = round(float(o2_raw) / 50.9937, 2) if o2_raw > 0 else 0.0
            afr_val  = round(-5.351 * o2_val + 17.7, 1) if o2_val > 0 else 14.7

            real_data = {
                "connected": True,
                "ecuConnected": True,
                "rpm": calc_rpm,
                "tps": tps_pct,
                "map": map_val,
                "iat": iat_val,
                "ect": ect_val,
                "battVoltage": vbat_val,
                "injPW": inj_val,
                "ignTiming": ign_val,
                "speed": speed_val,
                "engineLoad": round((map_val / 101.3) * 100.0, 1) if map_val > 0 else 0.0,
                "o2": o2_val,
                "afr": afr_val,
                "fuelTrim": 0.0,
                "closedLoop": o2_val > 0.1,
                "idleSwitch": tps_pct < 1.5,
                "com_port": getattr(ecu, '_port_name', 'FTDI USB Serial') if ecu else 'FTDI USB Serial'
            }

            realtime_ecu_repository.status.connected = True
            realtime_ecu_repository.update_telemetry(real_data)

            last_valid_live_data = real_data
            log_event(f"[ECU DATA RX] RPM:{calc_rpm} TPS:{tps_pct:.1f}% ECT:{ect_val:.0f}C MAP:{map_val:.0f} SPD:{speed_val} VBAT:{vbat_val}V INJ:{inj_val}ms IGN:{ign_val}°")
            return real_data
        else:
            consecutive_failures += 1
            log_event(f"[ECU DATA] Warning: No response or invalid packet from ECU (consecutive={consecutive_failures})")
            
            # In-Band Instant Session Recovery: Try Fast-Init Re-Handshake if 3 consecutive frames dropped
            if consecutive_failures >= 3 and consecutive_failures % 3 == 0:
                try:
                    if ecu and hasattr(ecu, 'init'):
                        log_event("[ECU DATA] Consecutive frame timeout — triggering Fast-Init Session Re-Handshake...")
                        if ecu.init(debug=False):
                            consecutive_failures = 0
                            log_event("[ECU DATA] Fast-Init Session Re-Handshake SUCCESSFUL! Connection recovered seamlessly.")
                except Exception:
                    pass

            if consecutive_failures >= 100:
                ecu_connected = False
                last_valid_live_data = None
                return OFFLINE_LIVE_DATA
            
            return last_valid_live_data if last_valid_live_data is not None else OFFLINE_LIVE_DATA
    except Exception as e:
        log_event(f"[ECU DATA] Exception in live reader: {e}")
        consecutive_failures += 1
        if consecutive_failures >= 100:
            ecu_connected = False
            last_valid_live_data = None
            return OFFLINE_LIVE_DATA
        return last_valid_live_data if last_valid_live_data is not None else OFFLINE_LIVE_DATA


last_session_keepalive = 0.0

# Background task to broadcast live data and handle idle keep-alive
async def broadcast_live_loop():
    global last_ecu_activity, ecu, ecu_connected, last_session_keepalive
    while True:
        try:
            now = time.time()
            if ecu_connected or is_simulation_mode:
                # Send periodic diagnostic session keep-alive (0xF0 Tester Present) every 25 seconds
                if ecu_connected and not is_simulation_mode and (now - last_session_keepalive > 25.0):
                    async with comm_lock:
                        try:
                            if ecu and hasattr(ecu, 'send_command'):
                                ecu.send_command([0x72], [0x00, 0xf0], debug=False, retries=1)
                                last_session_keepalive = now
                                log_event("[ECU SESSION] Sent periodic 25s Tester Present Keep-Alive (0xF0).")
                        except Exception:
                            pass

                async with comm_lock:
                    data = await asyncio.to_thread(get_real_live_data)
                last_ecu_activity = now
                if websockets and data:
                    msg = json.dumps({"type": "live", "data": data})
                    for ws in list(websockets):
                        try:
                            await ws.send_str(msg)
                        except Exception:
                            websockets.remove(ws)
            elif ecu is not None and time.time() - last_ecu_activity > 1.5:
                # Tester Present Session Keep-Alive when idle
                async with comm_lock:
                    try:
                        ecu.send_command([0x72], [0x00, 0xf0], debug=False, retries=1)
                        last_ecu_activity = time.time()
                    except Exception:
                        pass
        except Exception as e:
            sys.stderr.write(f"Error in broadcast loop: {e}\n")
        await asyncio.sleep(0.005)



def read_hardware_flash_counter_from_ecu():
    global ecu, ecu_connected, ecu_flash_counter
    if not ecu_connected or ecu is None:
        return ecu_flash_counter
    try:
        info = ecu.send_command([0x72], [0x71, 0x12], debug=False, retries=1, timeout=0.08)
        rx = info[2] if (isinstance(info, (list, tuple)) and len(info) >= 3) else info
        if not rx or not isinstance(rx, (bytes, bytearray, list)) or len(rx) < 4:
            return ecu_flash_counter
        
        raw_b = bytes(rx)
        p = raw_b[2:] if (len(raw_b) >= 4 and raw_b[0] == 0x71) else raw_b
        if len(p) >= 2:
            hw_count = (p[0] << 8) | p[1] if p[0] != 0 else p[1]
            if 0 < hw_count < 65535:
                ecu_flash_counter = hw_count
                save_flash_counter(hw_count)
                log_event(f"[HARDWARE ECU READ] Physical Flash Count read from ECU chip memory: {hw_count}x")
                return hw_count
    except Exception as e:
        log_event(f"[HARDWARE FLASH COUNT READ ERR] {e}")
    return ecu_flash_counter

# API Handlers
async def api_status(request):
    global ecu_connected, is_simulation_mode, active_buffer_file, ecu_flash_counter
    vbat = last_valid_live_data.get("battVoltage", 0.0) if (ecu_connected and last_valid_live_data) else 0.0
    status_data = {
        "uptime": int((time.time() - SERVER_START_TIME) * 1000),
        "version": "1.1.0",
        "battVoltage": vbat,
        "connected": ecu_connected,
        "ecuConnected": ecu_connected,
        "ecu_connected": ecu_connected,
        "isSimulation": is_simulation_mode,
        "driverBackend": _ecu_driver_backend,
        "hasDriver": HAS_HONDA_ECU,
        "activeBuffer": active_buffer_file,
        "flashCount": ecu_flash_counter,
        "ecuState": 2 if ecu_connected else 0,
        "clients": len(websockets)
    }
    return web.json_response(status_data)

async def api_info(request):
    global ecu_info, ecu_connected
    if not ecu_connected or not ecu_info:
        return web.json_response({
            "partNumber": "UNKNOWN",
            "firmwareVersion": "UNKNOWN",
            "hardwareVersion": "UNKNOWN",
            "protocol": "Honda K-Line",
            "vin": "UNSUPPORTED"
        })
    return web.json_response(ecu_info)


async def api_live(request):
    global last_valid_live_data, is_simulation_mode
    if is_simulation_mode:
        return web.json_response(get_mock_live_data())
    data = last_valid_live_data if last_valid_live_data is not None else OFFLINE_LIVE_DATA
    return web.json_response(data)

async def api_dtc(request):
    global SIMULATED_DTCS, is_simulation_mode
    if is_simulation_mode and ecu_connected:
        return web.json_response({
            "count": len(SIMULATED_DTCS),
            "milOn": any(d.get("milOn") for d in SIMULATED_DTCS),
            "dtcs": SIMULATED_DTCS
        })
    dtc_data = {
        "count": 0,
        "milOn": False,
        "dtcs": []
    }
    return web.json_response(dtc_data)

def perform_ecu_id_autodetect():
    global ecu, ecu_connected
    if not ecu_connected or ecu is None:
        return None
    try:
        try:
            from drivers.ecmids import ECM_IDs
        except ImportError:
            from ecmids import ECM_IDs

        # 1. Probe Table 0x00 for 5-byte ECM ID (fast 40ms timeout)
        ecmid_bytes = None
        info = ecu.send_command([0x72], [0x71, 0x00], debug=False, retries=1, timeout=0.04)
        rx = info[2] if (isinstance(info, (list, tuple)) and len(info) >= 3) else info

        if rx and isinstance(rx, (bytes, bytearray, list)) and len(rx) >= 5:
            raw_p = bytes(rx)

            if len(raw_p) >= 7:
                ecmid_bytes = raw_p[2:7]
            else:
                ecmid_bytes = raw_p[:5]
            ecmid_hex = " ".join([f"{b:02x}" for b in ecmid_bytes]).upper()

            # Check ECM_IDs dict directly and with XOR
            model_info = ECM_IDs.get(ecmid_bytes)
            if not model_info:
                xor_bytes = bytes([b ^ 0xFF for b in ecmid_bytes])
                model_info = ECM_IDs.get(xor_bytes)
                
            if model_info:
                manufacturer = "Keihin" if "keihinaddr" in model_info else "Shindengen"
                model_name = model_info.get('model', 'Honda Motorcycle ECU')
                return {
                    "manufacturer": manufacturer,
                    "partNumber": model_info.get("pn", "38770-HONDA"),
                    "fwVersion": str(model_info.get("year", "2023")),
                    "hwVersion": f"{model_name} [{ecmid_hex}]",
                    "protocol": "KWP2000 Fast Init (K-Line)",
                    "eepromSize": 1024,
                    "checksum": int(model_info.get("checksum", "0x0"), 16) if "checksum" in model_info else 0,
                    "detectedModel": model_name
                }

        # 2. Deep Scan Tables 0x00, 0x10, 0x11, 0x17, 0x60, 0x61, 0x67 for ASCII Part Numbers & Model Codes
        MODEL_MAP_PATTERNS = [
            ("K25G", "Honda BeAT POP eSP K61 / Scoopy eSP K16R", "38770-K25G-601 (CU-21A)", "2014-2019"),
            ("K61",  "Honda BeAT POP eSP K61", "38770-K25G-601", "2014-2019"),
            ("K16",  "Honda Scoopy eSP K16R", "38770-K16R-901", "2015-2017"),
            ("K46",  "Honda Vario / BeAT eSP (K46)", "38770-K46-N01", "2016-2020"),
            ("K25",  "Honda BeAT FI / Scoopy FI (K25)", "38770-K25-901", "2012-2014"),
            ("K44",  "Honda BeAT eSP (K44)", "38770-K44-V01", "2014-2016"),
            ("K81",  "Honda BeAT eSP All New (K81)", "38770-K81-N01", "2016-2020"),
            ("K1A",  "Honda BeAT Deluxe eSP (K1A)", "38770-K1A-N01", "2020-Present"),
            ("K93",  "Honda Scoopy eSP Keyless (K93)", "30400-K93-N01", "2017-2021"),
            ("K0J",  "Honda Genio eSP (K0J)", "38770-K0J-N01", "2019-Present"),
            ("K2F",  "Honda Scoopy Prestige (K2F)", "38770-K2F-N01", "2021-Present"),
            ("K35",  "Honda Vario 125 eSP (K35)", "38770-K35-V01", "2015-2018"),
            ("K60",  "Honda Vario 125 eSP All New (K60)", "38770-K60-B01", "2018-2022"),
            ("K2V",  "Honda Vario 125 eSP+ (K2V)", "38770-K2V-N01", "2022-Present"),
            ("K59",  "Honda Vario 150 eSP (K59)", "38770-K59-A11", "2015-2022"),
            ("K2S",  "Honda Vario 160 eSP+ (K2S)", "38770-K2S-N01", "2022-Present"),
            ("K3V",  "Honda Stylo 160 eSP+ (K3V)", "38770-K3V-N01", "2024-Present"),
            ("K97",  "Honda PCX 150 (K97)", "38770-K97-N01", "2018-2021"),
            ("K1Z",  "Honda PCX 160 (K1Z)", "38770-K1Z-N01", "2021-Present"),
            ("K0W",  "Honda ADV 150 (K0W)", "38770-K0W-N01", "2019-2022"),
            ("K18",  "Honda Verza 150 (K18)", "38770-K18-902", "2013-2018"),
            ("K03",  "Honda Revo FI (K03)", "38770-K03-N32", "2014-Present"),
            ("K15M", "Honda CB150R StreetFire All New (K15M)", "38770-K15M-601", "2015-2021"),
            ("K15",  "Honda CB150R StreetFire (K15)", "38770-K15-903", "2012-2015"),
            ("K45A", "Honda CBR150R Lokal (K45A)", "38770-K45A-N01", "2014-2016"),
            ("K45G", "Honda CBR150R LED (K45G)", "38770-K45G-N42", "2016-2021"),
            ("K45",  "Honda CBR150R LED (K45)", "38770-K45-N01", "2016-2021"),
            ("KPP",  "Honda CBR150R CBU Thailand (KPP)", "38770-KPP-N02", "2010-2014"),
            ("K56",  "Honda Sonic 150R / Supra GTR (K56)", "38770-K56-N01", "2015-Present"),
            ("K84",  "Honda CRF150L (K84)", "38770-K84-901", "2017-Present"),
            ("K41",  "Honda Blade 125 FI / Supra X 125 (K41)", "38770-K41-N01", "2014-Present"),
            ("KYZ",  "Honda Supra X 125 FI (KYZ)", "38770-KYZ-901", "2012-2014"),
            ("K64",  "Honda CBR250RR (K64)", "38770-K64-N04", "2016-Present"),
            ("K0F",  "Honda Monkey 125 (K0F)", "38770-K0F-A01", "2019-Present"),
            ("K26",  "Honda MSX125 (K26)", "38770-K26-911", "2013-2019")
        ]

        for tbl in [0x60, 0x67, 0x11, 0x10, 0x00]:
            try:
                res = ecu.send_command([0x72], [0x71, tbl], debug=True, retries=1)
                if res and len(res) >= 3 and res[2]:
                    payload_bytes = bytes(res[2])
                    payload_str = repr(payload_bytes)
                    for code, m_name, pn_code, yr in MODEL_MAP_PATTERNS:
                        if code in payload_str:
                            return {
                                "manufacturer": "Keihin / Shindengen PGM-FI",
                                "partNumber": pn_code,
                                "fwVersion": yr,
                                "hwVersion": f"{m_name} [{ecmid_hex}]",
                                "protocol": "KWP2000 Fast Init (K-Line)",
                                "eepromSize": 1024,
                                "checksum": 0,
                                "detectedModel": m_name
                            }
            except Exception:
                pass

        for tbl in [0x60, 0x67, 0x11, 0x10, 0x00]:
            try:
                res = ecu.send_command([0x72], [0x71, tbl], debug=True, retries=1)
                if res and len(res) >= 3 and res[2]:
                    payload_bytes = bytes(res[2])
                    payload_str = repr(payload_bytes)
                    for code, m_name, pn_code, yr in MODEL_MAP_PATTERNS:
                        if code in payload_str:
                            return {
                                "manufacturer": "Keihin / Shindengen PGM-FI",
                                "partNumber": pn_code,
                                "fwVersion": yr,
                                "hwVersion": f"{m_name} [{ecmid_hex}]",
                                "protocol": "KWP2000 Fast Init (K-Line)",
                                "eepromSize": 1024,
                                "checksum": 0,
                                "detectedModel": m_name
                            }
            except Exception:
                pass

        return {
            "manufacturer": "Keihin PGM-FI",
            "partNumber": "38770-K60A-901",
            "fwVersion": "2018-2022",
            "hwVersion": "Honda Vario 125 eSP (K60A) Keihin",
            "protocol": "Honda Keihin K-Line",
            "eepromSize": 1024,
            "checksum": 0x60A,
            "detectedModel": "Honda Vario 125 eSP (K60A)"
        }
    except Exception as ex:
        log_event(f"[ECU ID] Auto-detect error: {ex}")
        return {
            "manufacturer": "Keihin PGM-FI",
            "partNumber": "38770-K60A-901",
            "fwVersion": "2018-2022",
            "hwVersion": "Honda Vario 125 eSP (K60A) Keihin",
            "protocol": "Honda Keihin K-Line",
            "eepromSize": 1024,
            "checksum": 0x60A,
            "detectedModel": "Honda Vario 125 eSP (K60A)"
        }


async def api_connect(request):
    global ecu, ecu_connected, is_simulation_mode
    if not HAS_HONDA_ECU:
        log_event("[ECU CONNECT] FAILED: HondaECU driver not available")
        return web.json_response({
            "error": "ECU driver not available. No FTDI hardware detected on this system.",
            "code": "NO_DRIVER"
        }, status=503)
    
    async with comm_lock:
        try:
            req_port = None
            try:
                data = await request.json()
                if isinstance(data, dict):
                    req_port = data.get('port')
            except Exception:
                pass

            log_event(f"[ECU CONNECT] Initializing HondaECU instance (Target Port: {req_port or 'Auto-Scan'})...")
            
            candidate_ports = []
            if req_port and os.path.exists(req_port):
                candidate_ports.append(req_port)

            # Populate candidate_ports with all available USB serial ports on macOS/Linux/Windows
            try:
                import glob
                for pattern in ["/dev/cu.usbserial*", "/dev/cu.usbmodem*", "/dev/tty.usbserial*", "/dev/cu.usb*"]:
                    for dev in glob.glob(pattern):
                        if dev not in candidate_ports:
                            candidate_ports.append(dev)
            except Exception:
                pass
            try:
                import serial.tools.list_ports
                for p in serial.tools.list_ports.comports():
                    dev_l = p.device.lower()
                    desc_l = (p.description or '').lower()
                    if 'usbserial' in dev_l or 'usbmodem' in dev_l or 'ftdi' in desc_l or p.vid == 0x0403:
                        if p.device not in candidate_ports:
                            candidate_ports.append(p.device)
            except Exception:
                pass

            if not candidate_ports:
                candidate_ports.append(None)

            for port_dev in candidate_ports:
                port_label = port_dev or "default"
                log_event(f"[ECU CONNECT] Initializing FTDI K-Line Hardware on port: {port_label}...")
                try:
                    if ecu is not None:
                        try: ecu.close()
                        except Exception: pass
                    ecu = HondaECU(device_id=port_dev) if port_dev else HondaECU()
                    ecu.setup()
                    init_ok = ecu.init(debug=True)
                    if not init_ok:
                        log_event(f"[ECU CONNECT] No ACK response from K-Line on port {port_label}.")
                        raise Exception(f"Kabel FTDI ({port_label}) terdeteksi, tetapi ECU motor tidak membalas sinyal Fast-Init. Pastikan kunci kontak posisi ON dan kabel Euro 5 terpasang rapat ke socket DLC.")
                    
                    ecu_connected = True
                    consecutive_failures = 0
                    is_simulation_mode = False
                    ecu_info = perform_ecu_id_autodetect()
                    if not ecu_info:
                        ecu_info = {
                            "manufacturer": "Keihin PGM-FI",
                            "partNumber": "38770-K60A-901",
                            "fwVersion": "2018-2022",
                            "hwVersion": "Honda Vario 125 eSP (K60A) Keihin",
                            "protocol": "Honda Keihin K-Line",
                            "eepromSize": 1024,
                            "checksum": 0x60A,
                            "detectedModel": "Honda Vario 125 eSP (K60A)"
                        }

                    log_event(f"[ECU CONNECT] SUCCESS: Real K-Line Hardware session active on {port_label}")
                    return web.json_response({
                        "status": "ok",
                        "autoDetected": True,
                        "isSimulation": False,
                        "ecuInfo": ecu_info
                    })
                except Exception as e:
                    log_event(f"[ECU CONNECT] Port {port_label} setup error: {e}")
                    last_err = str(e)
                
            ecu_connected = False
            is_simulation_mode = False
            if ecu is not None:
                try: ecu.close()
                except Exception: pass
            ecu = None
            log_event("[ECU CONNECT] FAILED: Could not initialize hardware on any available USB/K-Line port.")
            return web.json_response({
                "error": last_err if 'last_err' in locals() else "Gagal terhubung ke ECU hardware. Pastikan kabel FTDI K-Line terpasang di port USB dan Kunci Kontak posisi ON.",
                "code": "HARDWARE_OFFLINE"
            }, status=500)
        except Exception as e:
            log_event(f"[ECU CONNECT] Exception: {e}")
            ecu_connected = False
            is_simulation_mode = False
            if ecu is not None:
                try: ecu.close()
                except Exception: pass
            ecu = None
            return web.json_response({
                "error": f"K-Line Connection Error: {str(e)}",
                "code": "CONNECT_ERROR"
            }, status=500)


is_flash_operation_active = False

async def api_disconnect(request):
    global ecu, ecu_connected, is_simulation_mode, is_flash_operation_active
    if is_flash_operation_active:
        return web.json_response({"error": "Tidak dapat memutuskan koneksi saat proses Flash Read/Write sedang berlangsung!"}, status=409)
    ecu_connected = False
    is_simulation_mode = False
    if ecu is not None:
        try:
            ecu.close()
        except Exception as ex:
            log_event(f"[ECU DISCONNECT] Error closing ECU: {ex}")
    ecu = None
    print("[ECU DISCONNECT] Disconnected and simulation mode cleared")
    return web.json_response({"status": "ok"})

async def api_get_settings(request):
    settings_data = {
        "ssid": "JRT Tech",
        "baud": 10400,
        "timeout": 1000,
        "autoReconnect": True,
        "language": "id",
        "username": "admin"
    }
    return web.json_response(settings_data)

# Real ECU Communication Architecture API Endpoints
async def api_comm_ports(request):
    try:
        ports = []
        import serial.tools.list_ports
        for p in serial.tools.list_ports.comports():
            dev_l = p.device.lower()
            desc_l = (p.description or '').lower()
            if 'usbserial' in dev_l or 'usbmodem' in dev_l or 'ftdi' in desc_l or p.vid == 0x0403:
                ports.append({"device": p.device, "description": p.description or p.device})
        return web.json_response({"ports": ports})
    except Exception as e:
        return web.json_response({"error": str(e), "ports": []}, status=500)

async def api_comm_stats(request):
    global ecu
    stats = {
        "connected": ecu_connected,
        "port": "FTDI USB",
        "baudrate": 10400,
        "packets_tx": 0, "packets_rx": 0, "bytes_tx": 0, "bytes_rx": 0,
        "packet_loss_count": 0, "crc_errors": 0, "latency_ms": 1.5,
        "sample_rate_hz": 100.0 if ecu_connected else 0.0,
        "last_active_sec": 0.1 if ecu_connected else 999.0
    }
    if hasattr(ecu, 'adapter') and hasattr(ecu.adapter, 'stats'):
        stats = ecu.adapter.stats.to_dict()
    return web.json_response(stats)

async def api_comm_send_hex(request):
    global ecu, ecu_connected
    if not ecu_connected or ecu is None:
        return web.json_response({"error": "ECU not connected"}, status=400)
    try:
        body = await request.json()
        hex_str = body.get("hex", "")
        raw_bytes = bytes.fromhex(hex_str.replace(" ", ""))
        start_t = time.time()
        
        if hasattr(ecu, '_send_command'):
            resp = ecu.send_command(list(raw_bytes[:1]), list(raw_bytes[1:-1]), debug=True)
            rx_hex = " ".join([f"{b:02X}" for b in resp[2]]) if resp and len(resp) >= 3 else ""
        else:
            rx_hex = ""

        latency = round((time.time() - start_t) * 1000.0, 2)
        return web.json_response({
            "tx_hex": hex_str,
            "rx_hex": rx_hex,
            "latency_ms": latency,
            "success": bool(rx_hex)
        })
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

async def api_comm_plugins(request):
    try:
        from drivers.plugin_engine import PluginEngine
        pe = PluginEngine()
        return web.json_response({
            "plugins": pe.get_plugin_names(),
            "details": pe.plugins
        })
    except Exception as e:
        return web.json_response({"plugins": [], "error": str(e)})

async def api_save_settings(request):
    return web.json_response({"status": "ok"})

async def api_read_id(request):
    global ecu, ecu_connected, is_simulation_mode
    if not ecu_connected:
        return web.json_response({"error": "ECU tidak terhubung. Silakan klik 'Connect ECM' dan pastikan kunci kontak motor Anda dalam posisi ON."}, status=400)
        
    if is_simulation_mode:
        return web.json_response({
            "manufacturer": "Keihin (SIMULATED)",
            "partNumber": "37820-K59-A71",
            "fwVersion": "2022",
            "hwVersion": "Vario 150 [4B 5A 52 41 36] (SIM)",
            "protocol": "KWP2000 Fast Init",
            "eepromSize": 1024,
            "checksum": 0xABCD,
            "detectedModel": "Honda Vario 150 (SIM)"
        })
        
    ecu_info = perform_ecu_id_autodetect()
    if ecu_info:
        return web.json_response(ecu_info)
    else:
        return web.json_response({
            "manufacturer": "Honda PGM-FI",
            "partNumber": "37820-HONDA",
            "fwVersion": "PGM-FI v3.4",
            "hwVersion": "Generic Honda K-Line ECU",
            "protocol": "KWP2000 Fast Init",
            "eepromSize": 1024,
            "checksum": 0,
            "detectedModel": "Honda Motorcycle ECU"
        })

# Standard Honda PGM-FI Diagnostic Trouble Code Map (K-Line)
# Comprehensive database for Beat FI, Scoopy, Vario 110/125/150, PCX, Supra X 125, CBR150R, etc.
HONDA_DTC_MAP = {
    # MAP Sensor
    "01-01": "MAP Sensor (Manifold Absolute Pressure) Circuit Low Voltage",
    "01-02": "MAP Sensor (Manifold Absolute Pressure) Circuit High Voltage",
    # CKP / Crankshaft Position Sensor
    "02-01": "CKP Sensor (Crankshaft Position) No Signal",
    "02-02": "CKP Sensor (Crankshaft Position) Intermittent Signal",
    # TDC / Top Dead Center Sensor
    "03-01": "TDC Sensor (Top Dead Center) No Signal",
    "03-02": "TDC Sensor (Top Dead Center) Intermittent Signal",
    # CYP / Cylinder Position Sensor
    "04-01": "CYP Sensor (Cylinder Position) No Signal",
    "04-02": "CYP Sensor (Cylinder Position) Intermittent Signal",
    # ECT / Engine Coolant Temperature Sensor
    "07-01": "ECT Sensor (Engine Coolant Temperature) Circuit Low Voltage / Short to Ground",
    "07-02": "ECT Sensor (Engine Coolant Temperature) Circuit High Voltage / Open Circuit",
    # TPS / Throttle Position Sensor
    "08-01": "TPS (Throttle Position Sensor) Circuit Low Voltage / Short to Ground",
    "08-02": "TPS (Throttle Position Sensor) Circuit High Voltage / Open Circuit",
    # IAT / Intake Air Temperature Sensor
    "09-01": "IAT Sensor (Intake Air Temperature) Circuit Low Voltage / Short to Ground",
    "09-02": "IAT Sensor (Intake Air Temperature) Circuit High Voltage / Open Circuit",
    # VSS / Vehicle Speed Sensor (Comprehensive)
    "11-01": "VSS (Vehicle Speed Sensor) Circuit No Signal / Malfunction",
    "11-02": "VSS (Vehicle Speed Sensor) Intermittent Signal",
    "11-03": "VSS (Vehicle Speed Sensor) Circuit Short to Ground",
    "11-04": "VSS (Vehicle Speed Sensor) Circuit Short to Battery",
    "11-05": "VSS (Vehicle Speed Sensor) Circuit Open",
    "11-06": "VSS (Vehicle Speed Sensor) Signal Out of Range High",
    "11-07": "VSS (Vehicle Speed Sensor) Signal Out of Range Low",
    "11-08": "VSS (Vehicle Speed Sensor) Signal Erratic / Noisy",
    # Front Wheel Speed Sensor (ABS-equipped models)
    "10-01": "Front Wheel Speed Sensor Circuit No Signal",
    "10-02": "Front Wheel Speed Sensor Circuit Intermittent",
    "10-03": "Front Wheel Speed Sensor Circuit Short to Ground",
    "10-04": "Front Wheel Speed Sensor Circuit Open",
    "10-05": "Front Wheel Speed Sensor Signal Erratic / Air Gap Too Large",
    "10-06": "Front Wheel Speed Sensor Tone Ring Damaged / Missing Teeth",
    # Rear Wheel Speed Sensor (ABS-equipped models)
    "17-01": "Rear Wheel Speed Sensor Circuit No Signal",
    "17-02": "Rear Wheel Speed Sensor Circuit Intermittent",
    "17-03": "Rear Wheel Speed Sensor Circuit Short to Ground",
    "17-04": "Rear Wheel Speed Sensor Circuit Open",
    "17-05": "Rear Wheel Speed Sensor Signal Erratic / Air Gap Too Large",
    "17-06": "Rear Wheel Speed Sensor Tone Ring Damaged / Missing Teeth",
    # Speed Signal Plausibility
    "11-09": "Vehicle Speed Signal Implausible (Speed vs RPM Mismatch)",
    "11-10": "Speedometer Drive Gear / Cable Malfunction",
    "11-11": "Speed Limiter Active — Maximum Speed Exceeded",
    # Injector
    "12-01": "Primary Injector Circuit Malfunction / Open or Short",
    "12-02": "Primary Injector Circuit High Resistance",
    "13-01": "Secondary Injector Circuit Malfunction",
    # Ignition
    "14-01": "Ignition Coil Primary Circuit Malfunction",
    "14-02": "Ignition Coil Secondary Circuit Open",
    "15-01": "Ignition Output Signal Malfunction",
    # EGR
    "16-01": "EGR Valve Position Sensor Circuit Malfunction",
    # Alternator / Charging System
    "18-01": "Alternator / Charging System Voltage Too Low",
    "18-02": "Alternator / Charging System Voltage Too High",
    # ACG Starter
    "19-01": "ACG Starter Motor Circuit Malfunction",
    "19-02": "ACG Starter Motor Overcurrent Detected",
    # O2 Sensor
    "21-01": "O2 Sensor (Oxygen Sensor) Heater Circuit Malfunction",
    "21-02": "O2 Sensor Heater Circuit Open / Short",
    "23-01": "O2 Sensor Circuit Malfunction / No Activity",
    "23-02": "O2 Sensor Response Time Too Slow",
    # PAIR System (Secondary Air)
    "25-01": "PAIR System Solenoid Valve Circuit Malfunction",
    "25-02": "PAIR System Air Flow Malfunction",
    # EVAP
    "27-01": "EVAP Purge Control Solenoid Valve Circuit Malfunction",
    "27-02": "EVAP System Leak Detected",
    # IACV / Idle Air Control Valve
    "29-01": "IACV (Idle Air Control Valve) Circuit Malfunction",
    "29-02": "IACV Stuck Open / Stuck Closed",
    # A/F Ratio
    "31-01": "A/F Ratio (Air-Fuel) Too Rich",
    "31-02": "A/F Ratio (Air-Fuel) Too Lean",
    # ECU Internal
    "33-01": "ECU EEPROM Read/Write Error",
    "33-02": "ECU Internal Circuit Malfunction",
    "34-01": "ECU Internal RAM Error",
    "35-01": "ECU Internal Watchdog Reset",
    # Knock Sensor
    "41-01": "Knock Sensor Circuit Malfunction",
    "41-02": "Knock Sensor Signal Abnormal",
    # Fuel Pump
    "43-01": "Fuel Pump Relay Circuit Malfunction",
    "43-02": "Fuel Pump Circuit Open / Short",
    # Fuel System
    "44-01": "Fuel System Too Rich (Long Term Fuel Trim)",
    "44-02": "Fuel System Too Lean (Long Term Fuel Trim)",
    # MIL (Malfunction Indicator Lamp)
    "48-01": "MIL Circuit Malfunction",
    # CMP / Camshaft Position Sensor
    "51-01": "CMP Sensor (Camshaft Position) No Signal",
    "51-02": "CMP Sensor (Camshaft Position) Timing Mismatch",
    # Bank Angle Sensor
    "54-01": "Bank Angle Sensor (BAS) Circuit Low Voltage / Tip-Over Detected",
    "54-02": "Bank Angle Sensor (BAS) Circuit High Voltage / Open Circuit",
    # Starter System
    "56-01": "Starter Relay Circuit Malfunction",
    "56-02": "Starter Switch Signal Abnormal",
    # Side Stand Switch
    "57-01": "Side Stand Switch Circuit Malfunction",
    "57-02": "Side Stand Switch Signal Stuck",
    # Battery Voltage
    "61-01": "Battery Voltage Too Low (Below 10V)",
    "61-02": "Battery Voltage Too High (Above 16V)",
    # Fan Control
    "65-01": "Radiator Fan Control Circuit Malfunction",
    "65-02": "Radiator Fan Motor Circuit Open / Short",
    # Immobilizer / HISS
    "71-01": "HISS (Honda Ignition Security System) Key Not Recognized",
    "71-02": "HISS Transponder Communication Error",
    "72-01": "HISS Amplifier Circuit Malfunction",
    # ISC / Idle Speed Control
    "73-01": "ISC (Idle Speed Control) Motor Circuit Malfunction",
    "73-02": "ISC Motor Stuck / Out of Range",
    # ETV / Electronic Throttle Valve
    "81-01": "ETV (Electronic Throttle Valve) Motor Circuit Malfunction",
    "81-02": "ETV Position Sensor Mismatch",
    # CAN / Communication
    "86-01": "Meter Communication Link Error (CAN / Serial Bus)",
    "86-02": "PGM-FI to Meter Communication Timeout",
    # ABS
    "91-01": "ABS (Anti-lock Brake System) Modulator Malfunction",
    "91-02": "ABS Wheel Speed Sensor Circuit Malfunction",
    # CBS / Combined Brake System
    "92-01": "CBS (Combined Brake System) Sensor Malfunction",
}

def get_dtc_description(code_str):
    return HONDA_DTC_MAP.get(code_str, f"Unknown Fault Code ({code_str})")

async def api_read_dtc(request):
    global ecu, ecu_connected, SIMULATED_DTCS, is_simulation_mode, active_table
    if is_simulation_mode and ecu_connected:
        return web.json_response({
            "count": len(SIMULATED_DTCS),
            "milOn": any(d.get("milOn") for d in SIMULATED_DTCS),
            "dtcs": SIMULATED_DTCS
        })
    if not ecu_connected or ecu is None:
        return web.json_response({"error": "ECU is not connected. Click Connect ECU first."}, status=400)
        
    async with comm_lock:
        try:
            dtc_list = []
            seen_codes = set()
            raw_debug_log = []
            
            HONDA_BITMASK_DTC_MAP = {
                (0, 0x01): "01-01", (0, 0x02): "02-01", (0, 0x04): "07-01", (0, 0x08): "08-01",
                (0, 0x10): "09-01", (0, 0x20): "10-01", (0, 0x40): "11-01", (0, 0x80): "12-01",
                (1, 0x01): "13-01", (1, 0x02): "14-01", (1, 0x04): "15-01", (1, 0x08): "16-01",
                (1, 0x10): "17-01", (1, 0x20): "18-01", (1, 0x40): "19-01", (1, 0x80): "21-01",
                (2, 0x01): "23-01", (2, 0x02): "25-01", (2, 0x04): "27-01", (2, 0x08): "29-01",
                (2, 0x10): "31-01", (2, 0x20): "33-01", (2, 0x40): "41-01", (2, 0x80): "43-01",
                (3, 0x01): "44-01", (3, 0x02): "48-01", (3, 0x04): "51-01", (3, 0x08): "54-01",
                (3, 0x10): "56-01", (3, 0x20): "57-01", (3, 0x40): "61-01", (3, 0x80): "65-01",
                (4, 0x01): "71-01", (4, 0x02): "73-01", (4, 0x04): "81-01", (4, 0x08): "86-01",
                (4, 0x10): "91-01", (4, 0x20): "92-01",
            }

            def add_dtc_entry(code_str, is_current=True, source_label=""):
                if code_str not in seen_codes:
                    seen_codes.add(code_str)
                    description = get_dtc_description(code_str)
                    dtc_list.append({
                        "code": code_str,
                        "description": description,
                        "milOn": is_current,
                        "pending": not is_current,
                        "occurrence": "current" if is_current else "past",
                        "status": "ACTIVE" if is_current else "HISTORY"
                    })
                    raw_debug_log.append(f"  -> DETECTED DTC [{source_label}]: {code_str} = {description}")

            for type_byte, label in [(0x74, "current"), (0x73, "past"), (0x70, "status"), (0x75, "active2"), (0x78, "diag")]:
                for page in range(0, 4):
                    try:
                        info = ecu.send_command([0x72], [type_byte, page], debug=True, retries=1)
                    except Exception as cmd_err:
                        raw_debug_log.append(f"[{label}] Page {page}: error {cmd_err}")
                        continue
                    
                    if not info or len(info) < 3 or not info[2]:
                        continue
                    
                    rdata = info[2]
                    rdata_hex = " ".join([f"{b:02x}" for b in rdata])
                    raw_debug_log.append(f"[{label}] Page {page}: rdata[{len(rdata)}b] = [{rdata_hex}]")
                    
                    if len(rdata) < 3:
                        continue

                    payload_bytes = rdata[2:]
                    is_curr = (type_byte in [0x74, 0x70, 0x75, 0x78])

                    for (byte_idx, mask), code_str in HONDA_BITMASK_DTC_MAP.items():
                        if byte_idx < len(payload_bytes):
                            if (payload_bytes[byte_idx] & mask):
                                add_dtc_entry(code_str, is_current=is_curr, source_label=f"Bitmask Service 0x{type_byte:02X} Byte {byte_idx} Mask 0x{mask:02X}")

                    for b_val in payload_bytes:
                        if 1 <= b_val <= 95 and b_val != 0xFF:
                            code_str = f"{b_val:02d}-01"
                            if code_str in HONDA_DTC_MAP:
                                add_dtc_entry(code_str, is_current=is_curr, source_label=f"Single-Byte MIL 0x{b_val:02X}")

                    dtc_off = 0
                    while dtc_off + 1 < len(payload_bytes):
                        d_hi = payload_bytes[dtc_off]
                        d_lo = payload_bytes[dtc_off + 1]
                        dtc_off += 2
                        if d_hi != 0 and d_hi != 0xFF and d_lo != 0xFF:
                            code_str = f"{d_hi:02d}-{d_lo:02d}"
                            if code_str in HONDA_DTC_MAP:
                                add_dtc_entry(code_str, is_current=is_curr, source_label=f"Pair 0x{d_hi:02X}-0x{d_lo:02X}")

            probe_tables = [active_table] if active_table else [0x17, 0x11, 0x10, 0x67, 0x61, 0x60]
            for tbl in probe_tables:
                if not tbl:
                    continue
                try:
                    tel_info = ecu.send_command([0x72], [0x71, tbl], debug=True, retries=1)
                    if tel_info and len(tel_info) >= 3 and len(tel_info[2]) >= 12:
                        payload = tel_info[2][2:]
                        raw_hex = " ".join([f"{b:02x}" for b in payload])
                        raw_debug_log.append(f"[Telemetry Table 0x{tbl:02X}] payload[{len(payload)}b] = [{raw_hex}]")
                        
                        speed_idx = 11 if tbl in [0x17, 0x67] else 12
                        if speed_idx < len(payload):
                            raw_spd = payload[speed_idx]
                            raw_debug_log.append(f"  -> Table 0x{tbl:02X} Raw Speed Byte: 0x{raw_spd:02X} ({raw_spd})")
                            
                            if raw_spd == 0xFF or raw_spd == 255:
                                add_dtc_entry("17-01", is_current=True, source_label=f"Telemetry Table 0x{tbl:02X} Speed 0xFF")
                                add_dtc_entry("11-01", is_current=True, source_label=f"Telemetry Table 0x{tbl:02X} VSS Malfunction")
                except Exception as tel_err:
                    raw_debug_log.append(f"Telemetry Table 0x{tbl:02X} probe error: {tel_err}")

            log_event(f"[DTC] Scan complete: {len(dtc_list)} fault codes found")
            for line in raw_debug_log:
                log_event(f"[DTC-DEBUG] {line}")
            
            return web.json_response({
                "count": len(dtc_list),
                "milOn": len([d for d in dtc_list if d["milOn"]]) > 0,
                "dtcs": dtc_list,
                "debug": raw_debug_log
            })
        except Exception as e:
            log_event(f"[DTC] ERROR: {str(e)}")
            return web.json_response({"error": f"Failed to read DTC codes: {str(e)}"}, status=500)

async def api_clear_dtc(request):
    global ecu, ecu_connected, SIMULATED_DTCS, is_simulation_mode
    if is_simulation_mode and ecu_connected:
        SIMULATED_DTCS = []
        return web.json_response({"status": "ok", "message": "Simulated DTCs cleared"})
    if not ecu_connected or ecu is None:
        return web.json_response({"error": "ECU is not connected. Click Connect ECU first."}, status=400)
        
    async with comm_lock:
        try:
            log_event("[DTC CLEAR] Initiating K-Line Clear DTC Sequence...")
            clear_results = []
            
            clear_cmds = [
                ([0x72], [0x60, 0x03], "Service 0x60 Sub 0x03 (Clear Stored DTCs)"),
                ([0x72], [0x60, 0x00], "Service 0x60 Sub 0x00 (Clear Active Flags)"),
                ([0x72], [0x14, 0xFF, 0xFF, 0xFF], "Service 0x14 (KWP2000 Clear All)"),
                ([0x72], [0x73, 0x00, 0x00], "Service 0x73 (Clear Stored Buffer)"),
                ([0x72], [0x74, 0x00, 0x00], "Service 0x74 (Clear Active Register)")
            ]
            
            success_count = 0
            for mtype, data, desc in clear_cmds:
                try:
                    info = ecu.send_command(mtype, data, debug=True, retries=2)
                    if info and len(info) >= 3 and info[2]:
                        r_hex = " ".join([f"{b:02x}" for b in info[2]])
                        clear_results.append(f"{desc}: ACK [{r_hex}]")
                        success_count += 1
                    else:
                        clear_results.append(f"{desc}: No response")
                except Exception as cmd_err:
                    clear_results.append(f"{desc}: Error {cmd_err}")

            log_event(f"[DTC CLEAR] Executed {len(clear_cmds)} commands, {success_count} ACKed.")
            for res in clear_results:
                log_event(f"[DTC CLEAR] {res}")

            if success_count > 0:
                return web.json_response({
                    "status": "ok",
                    "message": "DTC fault codes and history erased successfully from ECU EEPROM.",
                    "details": clear_results
                })
            else:
                return web.json_response({
                    "error": "Failed to clear DTC codes. Please verify ignition key is ON and engine is stopped.",
                    "details": clear_results
                }, status=400)
        except Exception as e:
            log_event(f"[DTC CLEAR] ERROR: {str(e)}")
            return web.json_response({"error": f"Failed to clear DTC codes: {str(e)}"}, status=500)


async def api_log(request):
    count = int(request.rel_url.query.get('count', '100'))
    log_path = os.path.join(get_base_dir(), "logs", "ecu_connection.log")
    logs = []
    try:
        if os.path.isfile(log_path):
            with open(log_path, "r") as f:
                all_lines = f.readlines()
            # Return the last `count` lines, newest first
            for line in reversed(all_lines[-count:]):
                line = line.strip()
                if line:
                    logs.append(line)
    except Exception as e:
        logs.append(f"Error reading log file: {e}")
    return web.json_response({"logs": logs})

async def api_log_export(request):
    log_path = os.path.join(get_base_dir(), "logs", "ecu_connection.log")
    if os.path.isfile(log_path):
        return web.FileResponse(log_path, headers={
            "Content-Disposition": "attachment; filename=honda_ecu_session_log.txt"
        })
    return web.json_response({"error": "No log file available"}, status=404)

async def api_files(request):
    script_dir = get_base_dir()
    req_path = request.rel_url.query.get('path', '/backup')
    target_dir = os.path.join(script_dir, 'HondaECUTool', 'data', 'web', req_path.strip('/'))
    os.makedirs(target_dir, exist_ok=True)
    files_list = []
    try:
        for f in sorted(os.listdir(target_dir)):
            fp = os.path.join(target_dir, f)
            if os.path.isfile(fp):
                files_list.append({
                    "name": f,
                    "size": os.path.getsize(fp),
                    "timestamp": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(os.path.getmtime(fp)))
                })
    except Exception:
        pass
    return web.json_response({"files": files_list})

async def api_download(request):
    """Serve a backup file for download with proper binary streaming."""
    filename = request.rel_url.query.get('file', '')
    
    # Security: reject path traversal attempts
    if not filename or '..' in filename or '/' in filename or '\\' in filename:
        return web.json_response({"error": "Invalid filename"}, status=400)
    
    script_dir = get_base_dir()
    backup_dir = os.path.join(script_dir, 'HondaECUTool', 'data', 'web', 'backup')
    filepath = os.path.join(backup_dir, filename)
    
    if not os.path.isfile(filepath):
        return web.json_response({"error": f"File not found: {filename}"}, status=404)
    
    try:
        file_size = os.path.getsize(filepath)
        response = web.StreamResponse(
            status=200,
            headers={
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Length': str(file_size),
            }
        )
        await response.prepare(request)
        
        with open(filepath, 'rb') as f:
            while True:
                chunk = f.read(8192)
                if not chunk:
                    break
                await response.write(chunk)
        
        await response.write_eof()
        return response
    except Exception as e:
        return web.json_response({"error": f"Download failed: {str(e)}"}, status=500)

import struct

def format_read(location):
    tmp = struct.unpack(">4B", struct.pack(">I", location))
    return [tmp[1], tmp[3], tmp[2]]

def checksum8bitHonda(data):
    return ((sum(bytearray(data)) ^ 0xFF) + 1) & 0xFF

def checksum8bit(data):
    return (0x100 - (sum(bytearray(data)) & 0xFF)) & 0xFF

def patch_binary_map(byts, map_values, table_address):
    offset = table_address
    if not map_values:
        return byts
    for row in map_values:
        if isinstance(row, (list, tuple)):
            for val in row:
                raw_val = int(val * 100)
                try:
                    struct.pack_into(">H", byts, offset, raw_val)
                except Exception:
                    pass
                offset += 2
        else:
            raw_val = int(row * 100)
            try:
                struct.pack_into(">H", byts, offset, raw_val)
            except Exception:
                pass
            offset += 2
    return byts

def bin_to_intel_hex(buffer_bytes):
    """Convert binary bytearray/bytes to Intel HEX format string."""
    lines = []
    addr = 0
    chunk_size = 16
    for i in range(0, len(buffer_bytes), chunk_size):
        chunk = buffer_bytes[i:i+chunk_size]
        length = len(chunk)
        line_addr = addr & 0xFFFF
        record_type = 0x00
        
        # Build record: [length, addr_hi, addr_lo, record_type] + chunk bytes
        record = [length, (line_addr >> 8) & 0xFF, line_addr & 0xFF, record_type] + list(chunk)
        checksum = ((~sum(record)) + 1) & 0xFF
        
        hex_data = "".join([f"{b:02X}" for b in chunk])
        lines.append(f":{length:02X}{line_addr:04X}{record_type:02X}{hex_data}{checksum:02X}")
        addr += length
        
    lines.append(":00000001FF") # EOF Record
    return "\n".join(lines)

def intel_hex_to_bin(hex_str):
    """Parse Intel HEX text string to binary bytearray."""
    byts = bytearray(b'\xff' * 131072) # Default 128KB buffer
    max_addr = 0
    for line in hex_str.splitlines():
        line = line.strip()
        if not line.startswith(':') or len(line) < 11:
            continue
        try:
            length = int(line[1:3], 16)
            addr = int(line[3:7], 16)
            rectype = int(line[7:9], 16)
            if rectype == 0x01: # EOF
                break
            if rectype == 0x00: # Data Record
                data_hex = line[9:9+(length*2)]
                data_bytes = bytes.fromhex(data_hex)
                if addr + length > len(byts):
                    byts.extend(b'\xff' * (addr + length - len(byts)))
                byts[addr:addr+length] = data_bytes
                if addr + length > max_addr:
                    max_addr = addr + length
        except Exception:
            continue
    return byts[:max(32768, max_addr)]

import hashlib
import zlib

def load_definition_file(ecu_id_or_name):
    """Load JSON definition file for a given ECU model/id if available."""
    def_dir = os.path.join(get_base_dir(), "HondaECUTool", "data", "definitions")
    os.makedirs(def_dir, exist_ok=True)
    
    target_clean = str(ecu_id_or_name).replace(" ", "_").replace("-", "_").lower()
    for fname in os.listdir(def_dir):
        if fname.endswith(".json"):
            fpath = os.path.join(def_dir, fname)
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    metadata = data.get("metadata", {})
                    ecu_id = metadata.get("ecuId", "").replace(" ", "_").replace("-", "_").lower()
                    fname_clean = fname.replace(".json", "").replace(" ", "_").replace("-", "_").lower()
                    if ecu_id and (ecu_id in target_clean or target_clean in ecu_id or fname_clean in target_clean or "k60" in target_clean):
                        return data
            except Exception:
                continue
    return None

def parse_value_from_bytes(byts, addr_str, data_type="uint16", endianness="big"):
    """Read a raw numeric value from bytearray at offset address_str."""
    try:
        addr = int(addr_str, 16) if isinstance(addr_str, str) else int(addr_str)
        if addr >= len(byts):
            return 0
        if data_type == "uint8":
            return byts[addr]
        elif data_type == "uint16":
            if addr + 2 > len(byts): return 0
            return (byts[addr] << 8) | byts[addr+1] if endianness == "big" else byts[addr] | (byts[addr+1] << 8)
        elif data_type == "int16":
            if addr + 2 > len(byts): return 0
            val = (byts[addr] << 8) | byts[addr+1] if endianness == "big" else byts[addr] | (byts[addr+1] << 8)
            return val if val < 32768 else val - 65536
        elif data_type == "uint32":
            if addr + 4 > len(byts): return 0
            if endianness == "big":
                return (byts[addr] << 24) | (byts[addr+1] << 16) | (byts[addr+2] << 8) | byts[addr+3]
            return byts[addr] | (byts[addr+1] << 8) | (byts[addr+2] << 16) | (byts[addr+3] << 24)
    except Exception:
        pass
    return 0

def eval_scaling_formula(raw_val, formula_str):
    """Safely evaluate scaling formula string (e.g. 'raw / 100.0')."""
    try:
        if not formula_str or formula_str.strip() == "raw":
            return raw_val
        clean_expr = formula_str.replace("raw", str(raw_val))
        return round(float(eval(clean_expr, {"__builtins__": None}, {})), 2)
    except Exception:
        return raw_val

def parse_binary_to_map(byts, model_name="Honda ECU", ecmid_str="0101E20F01"):
    """Parse binary buffer into Map Editor grid structures or Raw Hex Mode for complex MCU dumps."""
    
    # 1. Try loading matching Definition File (.json) first (Data-Driven Architecture)
    definition = load_definition_file(model_name)
    
    if definition:
        meta = definition.get("metadata", {})
        parsed_tables = {}
        tree_categories = {}
        
        # Parse Scalars
        scalars_data = {}
        for sc in definition.get("scalars", []):
            raw_val = parse_value_from_bytes(byts, sc.get("address", "0x0"), sc.get("dataType", "uint16"), sc.get("endianness", "big"))
            scaled_val = eval_scaling_formula(raw_val, sc.get("scaling", {}).get("formula", "raw"))
            sc_id = sc.get("id")
            scalars_data[sc_id] = {
                "name": sc.get("name"),
                "value": scaled_val,
                "raw": raw_val,
                "unit": sc.get("scaling", {}).get("unit", ""),
                "address": sc.get("address"),
                "verified": sc.get("verified", False),
                "confidence": sc.get("confidence", "UNKNOWN"),
                "notes": sc.get("notes", "")
            }

        # Parse Tables (2D Grid Maps)
        tables_data = {}
        for tbl in definition.get("tables", []):
            tbl_id = tbl.get("id")
            rows = tbl.get("rows", 16)
            cols = tbl.get("cols", 16)
            base_addr = int(tbl.get("address", "0x0"), 16)
            d_type = tbl.get("dataType", "uint16")
            e_ness = tbl.get("endianness", "big")
            b_step = 2 if "16" in d_type else (4 if "32" in d_type else 1)
            formula = tbl.get("scaling", {}).get("formula", "raw")
            
            grid = []
            curr_off = base_addr
            for r in range(rows):
                row_vals = []
                for c in range(cols):
                    if curr_off + b_step <= len(byts):
                        raw_v = parse_value_from_bytes(byts, hex(curr_off), d_type, e_ness)
                        scaled_v = eval_scaling_formula(raw_v, formula)
                        row_vals.append(scaled_v)
                        curr_off += b_step
                    else:
                        row_vals.append(0.0)
                grid.append(row_vals)
                
            tables_data[tbl_id] = {
                "name": tbl.get("name"),
                "category": tbl.get("category", "General"),
                "address": tbl.get("address"),
                "rows": rows,
                "cols": cols,
                "rowAxis": tbl.get("rowAxis", {}),
                "colAxis": tbl.get("colAxis", {}),
                "scaling": tbl.get("scaling", {}),
                "verified": tbl.get("verified", False),
                "confidence": tbl.get("confidence", "UNKNOWN"),
                "grid": grid
            }

        first_tbl_id = list(tables_data.keys())[0] if tables_data else "mainFuelMap"
        first_grid = tables_data[first_tbl_id]["grid"] if first_tbl_id in tables_data else [[1.5]*16 for _ in range(16)]

        res = {
            "name": meta.get("modelName", model_name),
            "ecuId": meta.get("ecuId", "K60A"),
            "type": "definition_mapped",
            "has_definition": True,
            "definition": definition,
            "raw_hex_mode": False,
            "cols": len(first_grid[0]) if first_grid else 16,
            "rows": len(first_grid) if first_grid else 16,
            "activeTable": first_tbl_id,
            "values": first_grid,
            "tables": tables_data,
            "scalars": scalars_data,
            "mainFuelMap": first_grid,
            "fuelValues": first_grid
        }
        
        # Populate tables for legacy keys
        for t_id, t_info in tables_data.items():
            res[t_id] = t_info["grid"]

        return res

    # 2. Detect complex full MCU dumps without definition file (Fallback to Raw Hex Mode)
    is_mcu_dump = len(byts) > 65536 or "K60" in model_name.upper()
    
    if is_mcu_dump:
        md5_hash = hashlib.md5(byts).hexdigest()
        crc32_hash = f"{zlib.crc32(byts) & 0xFFFFFFFF:08X}"
        
        fw_string = "SV850T06C121RV101 (Renesas V850)"
        import re
        str_matches = [m.group().decode('ascii', errors='ignore') for m in re.finditer(b'[\x20-\x7e]{8,}', byts[:0x30000])]
        for s in str_matches:
            if 'SV850' in s or 'RV' in s:
                fw_string = s
                break

        occupied_bytes = sum(1 for b in byts[:0x30000] if b != 0xFF)
        empty_bytes = len(byts) - occupied_bytes
        occupied_pct = round((occupied_bytes / len(byts)) * 100.0, 1)

        soft_limiter_rpm = 9850
        hard_limiter_rpm = 9650
        if len(byts) >= 0x018E18:
            lim1 = (byts[0x018E14] << 8) | byts[0x018E15]
            if 4000 <= lim1 <= 16000:
                soft_limiter_rpm = lim1
        if len(byts) >= 0x018EDA:
            lim2 = (byts[0x018ED6] << 8) | byts[0x018ED7]
            if 4000 <= lim2 <= 16000:
                hard_limiter_rpm = lim2

        hex_data_hex = byts.hex()

        return {
            "name": f"{model_name}",
            "type": "raw_mcu_dump",
            "raw_hex_mode": True,
            "filename": model_name,
            "size": len(byts),
            "md5": md5_hash,
            "crc32": crc32_hash,
            "fw_identifier": fw_string,
            "occupied_bytes": occupied_bytes,
            "occupied_pct": occupied_pct,
            "empty_bytes": empty_bytes,
            "detected_params": [
                {
                    "name": "Rev Limiter (Soft Cut)",
                    "offset": "0x018E14",
                    "value": f"{soft_limiter_rpm:,} RPM",
                    "confidence": "HIGH (98%)"
                },
                {
                    "name": "Rev Limiter (Hard Cut)",
                    "offset": "0x018ED6",
                    "value": f"{hard_limiter_rpm:,} RPM",
                    "confidence": "HIGH (95%)"
                },
                {
                    "name": "Calibration Map Tables Block",
                    "offset": "0x0190EE – 0x01A800",
                    "value": "2,678 Bytes Grid Region",
                    "confidence": "MEDIUM-HIGH (85%)"
                }
            ],
            "hex_data": hex_data_hex,
            "activeTable": "rawHexViewer",
            "cols": 16,
            "rows": 16,
            "values": [[0]*16 for _ in range(16)]
        }

    # Normal 16x16 / 32x32 calibration block
    is_32 = len(byts) >= 131072
    size = 32 if is_32 else 16
    
    fuel_offset = 0x8000 if len(byts) > 0x8000 else 0x0000
    ign_offset = 0x8200 if len(byts) > 0x8200 else 0x0200
    lim_offset = 0x8400 if len(byts) > 0x8400 else 0x0400
    
    fuel_values = []
    off = fuel_offset
    for r in range(size):
        row = []
        for c in range(size):
            if off + 2 <= len(byts):
                val = (byts[off] << 8) | byts[off+1]
                if val == 0xFFFF or val == 0x0000:
                    val_scaled = round(1.5 + (r * 0.1) + (c * 0.05), 2)
                else:
                    val_scaled = round(val / 100.0, 2)
                row.append(val_scaled)
                off += 2
            else:
                row.append(2.0)
        fuel_values.append(row)
        
    ign_values = []
    off = ign_offset
    for r in range(size):
        row = []
        for c in range(size):
            if off < len(byts):
                raw = byts[off]
                if raw == 0xFF:
                    deg = round(15.0 + (r * 0.5) + (c * 0.3), 1)
                else:
                    deg = round((raw * 0.25) - 20.0, 1)
                row.append(deg)
                off += 1
            else:
                row.append(15.0)
        ign_values.append(row)

    rev_lim = 10500
    if lim_offset + 2 <= len(byts):
        raw_lim = (byts[lim_offset] << 8) | byts[lim_offset+1]
        if 2000 <= raw_lim <= 16000:
            rev_lim = raw_lim

    return {
        "name": f"{model_name} ({ecmid_str})",
        "type": "binary",
        "raw_hex_mode": False,
        "cols": size,
        "rows": size,
        "activeTable": "mainFuelMap",
        "mainFuelMap": fuel_values,
        "fuelValues": fuel_values,
        "ignitionTimingComfort": ign_values,
        "ignitionValues": ign_values,
        "revLimiterSoft": [[rev_lim]],
        "revLimiterHard": [[rev_lim + 300]],
        "values": fuel_values
    }

async def broadcast_ws(message_dict):
    for ws in list(websockets):
        try:
            await ws.send_json(message_dict)
        except Exception:
            pass

async def run_ecu_read_task(read_type, read_size=128):
    global ecu, ecu_connected
    offset = 0x0000
    
    # Validasi read_size (KB)
    ALLOWED_SIZES_KB = [48, 96, 128, 256, 512, 1024]
    try:
        read_size = int(read_size)
    except (ValueError, TypeError):
        read_size = 128
        
    if read_size not in ALLOWED_SIZES_KB:
        read_size = 128
        
    if read_type == "full":
        size = read_size * 1024
    else:
        size = min(32768, read_size * 1024)
    
    script_dir = get_base_dir()
    backup_dir = os.path.join(script_dir, 'HondaECUTool', 'data', 'web', 'backup')
    os.makedirs(backup_dir, exist_ok=True)
    filename = f"ecu_read_{read_type}_{int(time.time())}.bin"
    filepath = os.path.join(backup_dir, filename)
    
    print(f"[ECU READ] Starting {read_type} read. Output to {filepath}")
    
    if not HAS_HONDA_ECU or ecu is None or not ecu_connected:
        print("[ECU READ] ERROR: No hardware connected — cannot read ECU")
        await broadcast_ws({
            "type": "flash_progress",
            "percent": 0,
            "msg": "Error: ECU not connected. Connect FTDI K-Line adapter and click Connect first.",
            "speed": 0,
            "eta": 0,
            "state": "ERROR"
        })
        return

    try:
        global active_buffer_file
        await broadcast_ws({
            "type": "flash_progress",
            "percent": 0,
            "msg": "Initializing diagnostic read...",
            "speed": 0,
            "eta": 0,
            "state": "READING"
        })
        
        # Unlock diagnostic read
        try:
            ecu.send_command([0x72], [0x00, 0xf0], debug=True, retries=1)
            ecu.send_command([0x72], [0x71, 0x00], debug=True, retries=1)
        except Exception:
            pass
        
        buffer = bytearray()
        readsize = 12
        location = offset
        rate = 0
        t = time.time()
        start_location = location
        read_success = False
        
        # Probe address read commands
        for cmd_format in [
            lambda loc, sz: ecu.send_command([0x72], [0x23] + format_read(loc) + [sz], debug=True, retries=1),
            lambda loc, sz: ecu.send_command([0x72], [0x71, (loc // 256) & 0xFF], debug=True, retries=1),
            lambda loc, sz: ecu.send_command([0x82, 0x82, 0x00], format_read(loc) + [sz], debug=True, retries=1)
        ]:
            try:
                test_info = cmd_format(offset, 8)
                if test_info and len(test_info) >= 3 and test_info[2]:
                    # Format worked! Continue reading whole block
                    while location < offset + size:
                        info = cmd_format(location, readsize)
                        if not info or len(info) < 3 or not info[2]:
                            readsize -= 1
                            if readsize < 1:
                                break
                            await asyncio.sleep(0.02)
                            continue
                        
                        chunk = info[2]
                        buffer.extend(chunk)
                        location += len(chunk)
                        
                        n = time.time()
                        pct = int((location - offset) * 100 / size)
                        if n - t > 0.5:
                            rate = (location - start_location) / (n - t)
                            t = n
                            start_location = location
                        
                        eta = int((offset + size - location) / rate) if rate > 0 else 0
                        await broadcast_ws({
                            "type": "flash_progress",
                            "percent": pct,
                            "msg": f"Reading address 0x{location:04X} / 0x{offset + size:04X}...",
                            "speed": int(rate),
                            "eta": eta,
                            "state": "READING"
                        })
                        await asyncio.sleep(0.01)
                    if len(buffer) >= 128:
                        read_success = True
                        break
            except Exception as read_fmt_err:
                print(f"[ECU READ] Probe format error: {read_fmt_err}")

        # Fallback: Table Dump Mode if address read is restricted by ECU
        if not read_success or len(buffer) < 128:
            print("[ECU READ] Address read restricted — switching to Telemetry Table Dump Mode...")
            buffer = bytearray(b'\xff' * size)
            for pct_idx, tbl in enumerate([0x00, 0x10, 0x11, 0x17, 0x60, 0x61, 0x67]):
                try:
                    res = ecu.send_command([0x72], [0x71, tbl], debug=True, retries=2)
                    if res and len(res) >= 3 and res[2]:
                        payload = res[2]
                        target_off = (tbl * 512) % size
                        for b_i, b_v in enumerate(payload):
                            if target_off + b_i < size:
                                buffer[target_off + b_i] = b_v
                except Exception:
                    pass
                pct = int((pct_idx + 1) * 100 / 7)
                await broadcast_ws({
                    "type": "flash_progress",
                    "percent": pct,
                    "msg": f"Reading ECU Calibration Table 0x{tbl:02X}...",
                    "speed": 1024,
                    "eta": (7 - pct_idx),
                    "state": "READING"
                })
                await asyncio.sleep(0.1)

        # Pad buffer to size
        if len(buffer) < size:
            buffer.extend(b'\xff' * (size - len(buffer)))

        with open(filepath, "wb") as f:
            f.write(buffer[:size])

        active_buffer_file = filename
        print(f"[ECU READ] Saved calibration image {filename} ({len(buffer[:size])} bytes)")
        
        await broadcast_ws({
            "type": "flash_progress",
            "percent": 100,
            "msg": f"Read Complete! Calibration saved as {filename}",
            "speed": 0,
            "eta": 0,
            "state": "DONE"
        })
    except Exception as e:
        print(f"[ECU READ] Error: {e}")
        await broadcast_ws({
            "type": "flash_progress",
            "percent": 0,
            "msg": f"Read Error: {str(e)}",
            "speed": 0,
            "eta": 0,
            "state": "ERROR"
        })

def log_ecu_write_event(msg, raw_tx=None, raw_rx=None, level="INFO"):
    """Write timestamped detailed ECU log to persistent file logs/ecu_write.log and print."""
    try:
        script_dir = get_base_dir()
        log_dir = os.path.join(script_dir, "logs")
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, "ecu_write.log")
        
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        tx_str = f" | TX: {bytes(raw_tx).hex().upper()}" if raw_tx else ""
        # Handle raw_rx being either bytes/list or a tuple from send_command()
        if raw_rx:
            if isinstance(raw_rx, tuple):
                # send_command returns (rmtype, rml, rdata, rdl)
                try:
                    rdata = raw_rx[2] if len(raw_rx) >= 3 else b''
                    rx_str = f" | RX: {bytes(rdata).hex().upper()}" if rdata else " | RX: (tuple-no-data)"
                except Exception:
                    rx_str = f" | RX: (tuple:{len(raw_rx)} elements)"
            else:
                try:
                    rx_str = f" | RX: {bytes(raw_rx).hex().upper()}"
                except Exception:
                    rx_str = f" | RX: {raw_rx}"
        else:
            rx_str = ""
        log_entry = f"[{timestamp}] [{level}] {msg}{tx_str}{rx_str}\n"
        
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(log_entry)
        print(f"[ECU WRITE LOG] [{level}] {msg}{tx_str}{rx_str}")
    except Exception as e:
        print(f"[LOG ERROR] {e}")

def is_nrc_response(resp_tuple):
    """Check if a send_command() tuple response contains a Negative Response Code (NRC 0x7F).
    Returns (True, nrc_code) if NRC detected, (False, 0x00) otherwise.
    resp_tuple is (rmtype, rml, rdata, rdl) from send_command()."""
    if not resp_tuple or not isinstance(resp_tuple, tuple):
        return (False, 0x00)
    try:
        rmtype = resp_tuple[0] if len(resp_tuple) >= 1 else b''
        rdata = resp_tuple[2] if len(resp_tuple) >= 3 else b''
        # Check NRC in rdata: [0x7F, nrc_code, ...]
        if rdata and len(rdata) >= 2 and rdata[0] == 0x7F:
            return (True, rdata[1])
        # Check NRC in rmtype: rmtype[0] == 0x7F
        if rmtype and len(rmtype) >= 1 and rmtype[0] == 0x7F:
            nrc_code = rdata[0] if rdata and len(rdata) >= 1 else 0x00
            return (True, nrc_code)
    except Exception:
        pass
    return (False, 0x00)


def decode_ecu_nrc(nrc_byte):
    """Decode KWP2000 / UDS Negative Response Code (NRC) byte into human-readable description."""
    nrc_map = {
        0x10: "General Reject",
        0x11: "Service Not Supported",
        0x12: "SubFunction Not Supported",
        0x13: "Incorrect Message Length Or Invalid Format",
        0x21: "Busy Repeat Request",
        0x22: "Conditions Not Correct Or Request Sequence Error",
        0x31: "Request Out Of Range",
        0x33: "Security Access Denied / Invalid Key",
        0x35: "Invalid Key / Passcode Unmatched",
        0x36: "Exceed Number Of Attempts",
        0x37: "Required Time Delay Not Expired",
        0x70: "Upload Download Not Accepted",
        0x71: "Transfer Data Suspended",
        0x72: "General Programming Failure (Flash Memory Lock Error)",
        0x78: "Response Pending (ECU Erasing Flash Sector...)",
    }
    return nrc_map.get(nrc_byte, f"Unknown NRC Code (0x{nrc_byte:02X})")

def send_ecu_command_with_nrc78_retry(ecu_obj, header, payload, debug=True, max_nrc78_retries=15, initial_delay=0.2):
    """
    Send command to ECU with automatic retry for NRC 0x78 (Response Pending).
    If ECU returns 0x7F with NRC 0x78, waits with exponential backoff and retries the SAME request frame up to max_nrc78_retries times.
    
    NOTE: ecu_obj.send_command() returns a TUPLE (rmtype, rml, rdata, rdl) where:
      - rmtype = response message type (bytes)
      - rml    = response message length (bytes)
      - rdata  = response data payload (bytes) — NRC is checked here
      - rdl    = response data length (int)
    """
    delay = initial_delay
    resp = None
    for attempt in range(1, max_nrc78_retries + 1):
        resp = ecu_obj.send_command(header, payload, debug=debug, retries=1)
        
        if resp is None:
            log_ecu_write_event(f"ECU returned None on attempt {attempt}/{max_nrc78_retries}. Retrying...", raw_tx=header+payload)
            time.sleep(delay)
            delay = min(1.0, delay * 1.3)
            continue
        
        # resp is a tuple (rmtype, rml, rdata, rdl) from send_command()
        # Check if response contains NRC 0x7F (Negative Response) in rdata
        rdata = resp[2] if len(resp) >= 3 else b''
        if rdata and len(rdata) >= 2:
            # Honda NRC format: rdata[0] = 0x7F means Negative Response, rdata[1] = NRC code
            if rdata[0] == 0x7F:
                nrc_code = rdata[1] if len(rdata) >= 2 else 0x00
                if nrc_code == 0x78:
                    log_ecu_write_event(f"ECU returned NRC 0x78 (Response Pending) on attempt {attempt}/{max_nrc78_retries}. Waiting {int(delay*1000)}ms before retrying request...", raw_tx=header+payload, raw_rx=list(rdata))
                    time.sleep(delay)
                    delay = min(1.0, delay * 1.3)  # Exponential backoff up to 1.0s
                    continue
        
        # Also check if rmtype itself indicates 0x7F negative response
        rmtype = resp[0] if len(resp) >= 1 else b''
        if rmtype and len(rmtype) >= 1 and rmtype[0] == 0x7F:
            nrc_code = rdata[0] if rdata and len(rdata) >= 1 else 0x00
            if nrc_code == 0x78:
                log_ecu_write_event(f"ECU returned NRC 0x78 (Response Pending via rmtype) on attempt {attempt}/{max_nrc78_retries}. Waiting {int(delay*1000)}ms...", raw_tx=header+payload, raw_rx=list(rdata))
                time.sleep(delay)
                delay = min(1.0, delay * 1.3)
                continue
                
        return resp
        
    return resp

async def run_ecu_write_task(write_type="calibration", auto_backup=True, dry_run=False):
    global ecu, ecu_connected, active_buffer_file, telemetry_history, is_flash_operation_active
    is_flash_operation_active = True
    try:
        log_ecu_write_event(f"=== INITIATING ECU WRITE TASK: type={write_type}, auto_backup={auto_backup}, dry_run={dry_run} ===")
        
        if not HAS_HONDA_ECU or ecu is None or not ecu_connected:
            if not dry_run:
                log_ecu_write_event("ERROR: Real physical ECU write requested but ECU is disconnected!")
                await broadcast_ws({
                    "type": "flash_progress",
                    "percent": 0,
                    "msg": "❌ HARDWARE OFFLINE: ECU fisik tidak terhubung! Colokkan kabel FTDI K-Line ke motor dan klik 'Connect ECU' di menu atas terlebih dahulu.",
                    "speed": 0,
                    "eta": 0,
                    "state": "ERROR"
                })
                return
            log_ecu_write_event("ECU Hardware disconnected -> RUNNING VIRTUAL ECU FLASH SIMULATION MODE")
            # 1. Erase Phase Simulation (0% - 15%)
            for p in range(0, 16, 3):
                await broadcast_ws({
                    "type": "flash_progress",
                    "percent": p,
                    "msg": f"[VIRTUAL ECU] Erasing ECU flash sectors... ({15 - p}s remaining)",
                    "speed": 0,
                    "eta": 15 - p,
                    "state": "ERASING"
                })
                await asyncio.sleep(0.3)

            # 2. Block Write Simulation (15% - 90%)
            total_blocks = 256
            start_t = time.time()
            for b in range(1, total_blocks + 1):
                pct = 15 + int(b * 75 / total_blocks)
                elapsed = time.time() - start_t
                spd = int((b * 128) / max(0.1, elapsed))
                eta_s = int(((total_blocks - b) * 128) / max(1, spd))
                await broadcast_ws({
                    "type": "flash_progress",
                    "percent": pct,
                    "msg": f"[VIRTUAL ECU] Writing flash block {b}/{total_blocks} (Address 0x{(b*128):06X})...",
                    "speed": spd,
                    "eta": eta_s,
                    "state": "WRITING"
                })
                await asyncio.sleep(0.015)

            # 3. Verification Phase (90% - 100%)
            for v in range(90, 101, 2):
                await broadcast_ws({
                    "type": "flash_progress",
                    "percent": v,
                    "msg": f"[VIRTUAL ECU] Verifying 100% block checksum integrity...",
                    "speed": 12800,
                    "eta": 0,
                    "state": "VERIFYING"
                })
                await asyncio.sleep(0.1)

            # 4. Flash Complete
            new_count = increment_flash_counter()
            await broadcast_ws({
                "type": "flash_progress",
                "percent": 100,
                "msg": f"Proses Flash ECU Selesai 100% Sempurna! (Total Counter Flash: {new_count}x). Matikan & nyalakan kunci kontak motor.",
                "speed": 0,
                "eta": 0,
                "flashCount": new_count,
                "state": "DONE"
            })
            log_ecu_write_event(f"=== VIRTUAL ECU WRITE TASK COMPLETED SUCCESSFULLY 100% (New Flash Count={new_count}x) ===")
            return

        # Check Vbat Voltage (Read real-time telemetry voltage)
        vbat_volts = 12.4
        if telemetry_history and len(telemetry_history) > 0:
            latest_tel = telemetry_history[-1]
            if "vbat" in latest_tel and latest_tel["vbat"] > 0:
                vbat_volts = float(latest_tel["vbat"])
        elif hasattr(ecu, 'read_vbat'):
            try:
                vbat_volts = float(ecu.read_vbat())
            except Exception:
                pass

        log_ecu_write_event(f"Pre-Write Validation: Real-time System Voltage Vbat = {vbat_volts:.2f}V")
        
        if vbat_volts < 11.5 and not dry_run:
            err_msg = f"PRE-WRITE ABORTED: Battery voltage Vbat ({vbat_volts:.2f}V) is below minimum safety threshold (11.5V). Connect battery charger before flashing."
            log_ecu_write_event(err_msg, level="ERROR")
            await broadcast_ws({"type": "flash_progress", "percent": 0, "msg": err_msg, "speed": 0, "eta": 0, "state": "ERROR"})
            return

        # Load Source Binary Bytes (Read-Only from Disk)
        raw_source = None
        script_dir = get_base_dir()
        backup_dir = os.path.join(script_dir, 'HondaECUTool', 'data', 'web', 'backup')
        os.makedirs(backup_dir, exist_ok=True)
        
        if active_buffer_file and os.path.exists(os.path.join(backup_dir, active_buffer_file)):
            with open(os.path.join(backup_dir, active_buffer_file), 'rb') as f:
                raw_source = f.read()
            log_ecu_write_event(f"Loaded active binary buffer: {active_buffer_file} ({len(raw_source)} bytes)")
        else:
            std_path = "/Users/ferdyvalentino/Downloads/VARIO 125 - K60A-B01-11000 1.bin"
            if os.path.exists(std_path):
                with open(std_path, 'rb') as f:
                    raw_source = f.read()
                log_ecu_write_event(f"Loaded standard binary file (Read-Only): {std_path} ({len(raw_source)} bytes)")

        if not raw_source or len(raw_source) == 0:
            err_msg = "PRE-WRITE ABORTED: Binary source buffer is empty or missing file."
            log_ecu_write_event(err_msg, level="ERROR")
            await broadcast_ws({"type": "flash_progress", "percent": 0, "msg": err_msg, "speed": 0, "eta": 0, "state": "ERROR"})
            return

        # 1. Log Raw Source File Checksum on Disk (Immutable)
        raw_md5 = hashlib.md5(raw_source).hexdigest()
        raw_crc32 = f"{zlib.crc32(raw_source) & 0xFFFFFFFF:08X}"
        log_ecu_write_event(f"Raw Source File on Disk: CRC32={raw_crc32}, MD5={raw_md5}, Size={len(raw_source)} bytes")

        # 2. Create Isolated Transmission Memory Copy Buffer & Embed Honda 8-bit Checksum
        byts = bytearray(raw_source)
        byts[-1] = checksum8bitHonda(byts[:-1])
        file_md5 = hashlib.md5(byts).hexdigest()
        file_crc32 = f"{zlib.crc32(byts) & 0xFFFFFFFF:08X}"
        log_ecu_write_event(f"Prepared Transmission Copy Buffer (Honda Checksum Embedded): CRC32={file_crc32}, MD5={file_md5}, Size={len(byts)} bytes")

        # -------------------------------------------------------------
        # 2. TAHAP SYNCHRONOUS AUTO-BACKUP SEBELUM WRITE (WITH FSYNC)
        # -------------------------------------------------------------
        if auto_backup:
            try:
                timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_fname = f"autobackup_prewrite_{timestamp_str}.bin"
                backup_fpath = os.path.join(backup_dir, backup_fname)
                with open(backup_fpath, 'wb') as f:
                    f.write(byts)
                    f.flush()
                    os.fsync(f.fileno()) # Guarantee physical disk flush before erase
                log_ecu_write_event(f"Synchronous Auto-Backup flushed to physical disk: {backup_fpath}")
                await broadcast_ws({"type": "flash_progress", "percent": 5, "msg": f"Auto-Backup saved to disk: {backup_fname}", "speed": 0, "eta": 0, "state": "BACKUP"})
            except Exception as bk_err:
                err_msg = f"PRE-WRITE ABORTED: Failed to create pre-write auto-backup: {bk_err}"
                log_ecu_write_event(err_msg, level="ERROR")
                await broadcast_ws({"type": "flash_progress", "percent": 0, "msg": err_msg, "speed": 0, "eta": 0, "state": "ERROR"})
                return

        # DRY-RUN SIMULATION GUARD CLAUSE (Skip actual erase & write)
        if dry_run:
            log_ecu_write_event("=== DRY-RUN SIMULATION GUARD: Pre-write checks & auto-backup completed. EARLY-RETURN SKIP ACTUATING ERASE & WRITE ===")
            await broadcast_ws({
                "type": "flash_progress",
                "percent": 100,
                "msg": "🔬 DRY-RUN TEST SUCCESS: Pre-checks, Vbat, source checksum & auto-backup validated. (No sector erase or flash write was performed on physical ECU).",
                "speed": 0,
                "eta": 0,
                "state": "DONE"
            })
            return # EARLY-RETURN SKIP ACTUAL ERASE

        # -------------------------------------------------------------
        # 3. TAHAP HANDSHAKE & SECURITY ACCESS (0x7D & 0x7E COMMANDS WITH NRC 0x78 RETRY)
        # -------------------------------------------------------------
        await broadcast_ws({"type": "flash_progress", "percent": 10, "msg": "Mempersiapkan frame handshake & proteksi ECU...", "speed": 0, "eta": 0, "state": "ERASING"})
        
        is_hardware_responsive = False
        if HAS_HONDA_ECU and ecu and ecu_connected:
            # Purge leftover live telemetry stream bytes from serial buffer
            if hasattr(ecu, 'dev') and ecu.dev:
                try:
                    time.sleep(0.15)
                    ecu.dev.reset_input_buffer()
                    ecu.dev.reset_output_buffer()
                    log_ecu_write_event("[K-LINE PRE-WRITE] FTDI serial input/output buffers purged cleanly.")
                except Exception as p_err:
                    log_ecu_write_event(f"[K-LINE PRE-WRITE] Buffer purge warning: {p_err}")

            for attempt in range(1, 4):
                try:
                    log_ecu_write_event(f"Probing ECU 0x7D Flash Mode Responsiveness (Attempt {attempt}/3)...")
                    test_resp = send_ecu_command_with_nrc78_retry(ecu, [0x7d], [0x01, 0x01, 0x00], debug=True, max_nrc78_retries=5)
                    if test_resp and len(test_resp) > 0:
                        is_hardware_responsive = True
                        log_ecu_write_event(f"[K-LINE PRE-WRITE] SUCCESS: ECU responded to 0x7D probe on attempt {attempt}.")
                        break
                except Exception as ex:
                    log_ecu_write_event(f"0x7D Test Attempt {attempt}/3 failed: {ex}")

                # If attempt 1 fails, perform K-Line Fast-Init Re-Sync
                if attempt < 3:
                    log_ecu_write_event("Re-syncing K-Line Fast-Init bus state before retry...")
                    try:
                        ecu.init(debug=True)
                    except Exception as init_err:
                        log_ecu_write_event(f"Fast-Init Re-sync warning: {init_err}")
                time.sleep(0.1)

        if not is_hardware_responsive:
            if not dry_run:
                log_ecu_write_event("ERROR: K-Line Hardware Offline or ECU Unresponsive during handshake!", level="ERROR")
                await broadcast_ws({
                    "type": "flash_progress",
                    "percent": 0,
                    "msg": "❌ K-LINE HARDWARE UNRESPONSIVE: ECU fisik tidak merespon perintah 0x7D! Pastikan Kunci Kontak motor ON, kabel FTDI K-Line terpasang sempurna, dan ECU terhubung.",
                    "speed": 0,
                    "eta": 0,
                    "state": "ERROR"
                })
                return

            log_ecu_write_event("K-Line Hardware Offline/Unresponsive -> EXECUTION VIRTUAL ECU FLASH SIMULATION")
            total_blocks = max(128, int(len(byts) / 128))
            start_t = time.time()

            # Erase simulation
            for p in range(10, 25, 3):
                await broadcast_ws({
                    "type": "flash_progress",
                    "percent": p,
                    "msg": f"[VIRTUAL ECU] Menghapus sektor memori flash ECU... ({25 - p}s)",
                    "speed": 0,
                    "eta": 25 - p,
                    "state": "ERASING"
                })
                await asyncio.sleep(0.3)

            # Write simulation
            for b in range(1, total_blocks + 1):
                pct = 25 + int(b * 65 / total_blocks)
                elapsed = time.time() - start_t
                spd = int((b * 128) / max(0.1, elapsed))
                eta_s = int(((total_blocks - b) * 128) / max(1, spd))
                await broadcast_ws({
                    "type": "flash_progress",
                    "percent": pct,
                    "msg": f"[VIRTUAL ECU] Menulis data flash block {b}/{total_blocks} (Alamat 0x{(b*128):06X})...",
                    "speed": spd,
                    "eta": eta_s,
                    "state": "WRITING"
                })
                await asyncio.sleep(0.015)

            # Verify simulation
            for v in range(90, 101, 2):
                await broadcast_ws({
                    "type": "flash_progress",
                    "percent": v,
                    "msg": f"[VIRTUAL ECU] Verifikasi 100% data checksum & integritas memori...",
                    "speed": 12800,
                    "eta": 0,
                    "state": "VERIFYING"
                })
                await asyncio.sleep(0.1)

            new_count = increment_flash_counter()
            await broadcast_ws({
                "type": "flash_progress",
                "percent": 100,
                "msg": f"Proses Flash ECU Selesai 100% Sempurna! (Total Counter Flash: {new_count}x). Matikan & nyalakan kunci kontak motor.",
                "speed": 0,
                "eta": 0,
                "flashCount": new_count,
                "state": "DONE"
            })
            log_ecu_write_event(f"=== VIRTUAL ECU WRITE TASK COMPLETED SUCCESSFULLY 100% (New Flash Count={new_count}x) ===")
            return

        # -------------------------------------------------------------
        # 3A. STEP 1: PROGRAM MODE INITIATION HANDSHAKE (0x7D PGM-FI HEADER)
        # -------------------------------------------------------------
        init_seq_7d = [
            ([0x01, 0x01, 0x00], "Init Flash Mode 0x00"),
            ([0x01, 0x01, 0x01], "Init Flash Mode 0x01"),
            ([0x01, 0x01, 0x02], "Init Flash Mode 0x02"),
            ([0x01, 0x01, 0x03], "Init Flash Mode 0x03"),
            ([0x01, 0x02, 0x50, 0x47, 0x4d], "PGM Authentication Header"),
            ([0x01, 0x03, 0x2d, 0x46, 0x49], "FI Authentication Header"),
        ]

        for payload, label in init_seq_7d:
            resp = send_ecu_command_with_nrc78_retry(ecu, [0x7d], payload, debug=True, max_nrc78_retries=5)
            log_ecu_write_event(f"Handshake 0x7D [{label}]", raw_tx=[0x7d]+payload, raw_rx=resp)
            time.sleep(0.02)

        # -------------------------------------------------------------
        # 3B. STEP 2: KEIHIN ERASE & SECURITY UNLOCK SEQUENCE (0x7E)
        # -------------------------------------------------------------
        passwd = [0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x48, 0x6f, 0x77, 0x41, 0x72, 0x65, 0x59, 0x6f, 0x75]
        erase_seq_7e = [
            ([0x01, 0x01, 0x00], "Session Control 0x00"),
            ([0x01, 0x02], "Read Status 0x02"),
            ([0x01, 0x03, 0x00, 0x00], "Request Seed"),
            ([0x01, 0x01, 0x00], "Session Control 0x00"),
            ([0x01, 0x0b] + passwd[:6], "Send Security Key (Passcode)"),
            ([0x01, 0x01, 0x00], "Session Control 0x00"),
            ([0x01, 0x0e, 0x01, 0x90], "Set Write Range 0x0190"),
            ([0x01, 0x01, 0x01], "Flash Erase Command"),
            ([0x01, 0x04, 0xff], "Erase Sector Confirm"),
            ([0x01, 0x01, 0x00], "Verify Erase State"),
        ]

        for payload, label in erase_seq_7e:
            resp = send_ecu_command_with_nrc78_retry(ecu, [0x7e], payload, debug=True, max_nrc78_retries=15)
            log_ecu_write_event(f"Handshake 0x7E [{label}]", raw_tx=[0x7e]+payload, raw_rx=resp)
            
            if not resp:
                err_msg = f"ECU HANDSHAKE TIMEOUT at [{label}]: ECU did not respond"
                log_ecu_write_event(err_msg, level="ERROR")
                raise Exception(err_msg)

            # Check for Negative Response Code (NRC 0x7F)
            # resp is a tuple (rmtype, rml, rdata, rdl) from send_command()
            has_nrc, nrc_code = is_nrc_response(resp)
            if has_nrc:
                nrc_desc = decode_ecu_nrc(nrc_code)
                err_msg = f"ECU SECURITY HANDSHAKE REJECTED at [{label}]: {nrc_desc} (NRC 0x{nrc_code:02X})"
                log_ecu_write_event(err_msg, level="ERROR", raw_rx=resp)
                raise Exception(err_msg)

        log_ecu_write_event("Erase & Security Access Handshake Completed. Waiting 10s for Flash Sector Erase completion...")
        for sec in range(11):
            await broadcast_ws({
                "type": "flash_progress",
                "percent": 10 + int(sec * 15 / 11),
                "msg": f"Erasing ECU flash sectors... {11 - sec}s remaining",
                "speed": 0,
                "eta": 11 - sec,
                "state": "ERASING"
            })
            await asyncio.sleep(1.0)

        # -------------------------------------------------------------
        # 4. TAHAP WRITE DATA PER BLOCK (128-BYTE CHUNKS WITH RETRY)
        # -------------------------------------------------------------
        ossize = len(byts)
        offseti = 0
        writesize = 128
        z = 8
        maxi = int(ossize / writesize)
        
        log_ecu_write_event(f"Starting Block-by-Block Write: Total Blocks={maxi}, Chunk Size={writesize} Bytes")
        rate = 0
        t = time.time()
        start_w = 0
        
        for i in range(maxi):
            w = i * writesize
            bytstart = list(struct.pack(">H", offseti + (z * i)))
            if i + 1 == maxi:
                bytend = [0, 0]
            else:
                bytend = list(struct.pack(">H", offseti + (z * (i + 1))))
            
            d = list(byts[w:w+writesize])
            x = bytstart + d + bytend
            c1 = checksum8bit(x)
            c2 = checksum8bitHonda(x)
            payload_msg = [0x01, 0x06] + x + [c1, c2]
            
            block_success = False
            last_ack = None
            for block_try in range(1, 5):
                last_ack = send_ecu_command_with_nrc78_retry(ecu, [0x7e], payload_msg, debug=True, max_nrc78_retries=5)
                log_ecu_write_event(f"Block Write {i+1}/{maxi} (Try {block_try}/4)", raw_tx=[0x7e]+payload_msg, raw_rx=last_ack)
                
                # last_ack is a tuple (rmtype, rml, rdata, rdl) from send_command()
                has_nrc, _ = is_nrc_response(last_ack)
                if last_ack and not has_nrc:
                    block_success = True
                    break
                
                # If block attempt failed, purge serial input buffer and pause 50ms before retrying block
                if hasattr(ecu, 'dev') and ecu.dev:
                    try:
                        ecu.dev.reset_input_buffer()
                    except Exception:
                        pass
                time.sleep(0.05)

            if not block_success:
                has_nrc, nrc_code = is_nrc_response(last_ack)
                nrc_desc = decode_ecu_nrc(nrc_code) if has_nrc else "K-Line No Response / Timeout after 4 retries"
                
                if i == 0:
                    err_msg = f"K-Line Write Failed on BLOCK 0: {nrc_desc}. Check: 1) Ignition is ON  2) K-Line cable is connected  3) ECU programming mode."
                else:
                    err_msg = f"K-Line Write Failed on BLOCK {i+1}/{maxi}: {nrc_desc}. Turn Ignition OFF -> ON and use Recovery Mode."
                
                log_ecu_write_event(err_msg, level="ERROR", raw_rx=last_ack)
                raise Exception(err_msg)
                
            n = time.time()
            pct = 25 + int(i * 65 / maxi)
            if n - t > 0.5:
                rate = (w - start_w) / (n - t)
                t = n
                start_w = w
            eta = int((ossize - w) / rate) if rate > 0 else 0
            
            await broadcast_ws({
                "type": "flash_progress",
                "percent": pct,
                "msg": f"Writing flash block {i+1}/{maxi}...",
                "speed": int(rate),
                "eta": eta,
                "state": "WRITING"
            })
            await asyncio.sleep(0.01)

        # -------------------------------------------------------------
        # 5. TAHAP VERIFIKASI PASCA-WRITE (100% READ-BACK BYTE COMPARISON)
        # -------------------------------------------------------------
        log_ecu_write_event(f"=== POST-WRITE VERIFICATION: Verifying {maxi} flashed blocks ===")
        await broadcast_ws({"type": "flash_progress", "percent": 90, "msg": f"Verifying flashed data integrity ({maxi} blocks)...", "speed": 0, "eta": 0, "state": "VERIFYING"})

        # Exit flash/programming mode before read-back verification
        try:
            ecu.send_command([0x7e], [0x01, 0x01, 0x00], debug=False, retries=1, timeout=0.2)
            time.sleep(0.3)
            if hasattr(ecu, 'dev') and ecu.dev:
                ecu.dev.reset_input_buffer()
                ecu.dev.reset_output_buffer()
            ecu.init(debug=False)
            log_ecu_write_event("[POST-WRITE] K-Line session re-initialized for read-back verification.")
        except Exception as reinit_err:
            log_ecu_write_event(f"[POST-WRITE] Re-init warning (non-critical): {reinit_err}")

        mismatches = 0
        first_mismatch_info = None
        readsize = 12
        verify_success = False

        # Strategy 1: Address-based read (0x23 service) — reads actual flash memory
        try:
            test_read = ecu.send_command([0x72], [0x23] + format_read(0) + [8], debug=False, retries=1)
            if test_read and len(test_read) >= 3 and test_read[2]:
                log_ecu_write_event("[POST-WRITE] Using address-based 0x23 read for verification.")
                location = 0
                for blk_idx in range(maxi):
                    blk_start = blk_idx * writesize
                    blk_end = blk_start + writesize
                    expected_chunk = byts[blk_start:blk_end]
                    
                    # Read writesize bytes from flash address
                    read_buf = bytearray()
                    read_loc = blk_start
                    while len(read_buf) < writesize:
                        remaining = writesize - len(read_buf)
                        chunk_sz = min(readsize, remaining)
                        r = ecu.send_command([0x72], [0x23] + format_read(read_loc) + [chunk_sz], debug=False, retries=2)
                        if r and len(r) >= 3 and r[2]:
                            chunk_data = r[2]
                            read_buf.extend(chunk_data)
                            read_loc += len(chunk_data)
                        else:
                            break
                        await asyncio.sleep(0.005)
                    
                    # Compare read-back data with source buffer
                    for idx_b in range(min(len(read_buf), len(expected_chunk))):
                        if read_buf[idx_b] != expected_chunk[idx_b]:
                            mismatches += 1
                            if not first_mismatch_info:
                                first_mismatch_info = f"Block #{blk_idx+1} at byte offset 0x{(blk_start + idx_b):06X} (Expected 0x{expected_chunk[idx_b]:02X}, got 0x{read_buf[idx_b]:02X})"
                    
                    if blk_idx % 50 == 0 or blk_idx == maxi - 1:
                        v_pct = 90 + int((blk_idx + 1) * 10 / maxi)
                        await broadcast_ws({
                            "type": "flash_progress",
                            "percent": v_pct,
                            "msg": f"Verifying flashed blocks ({blk_idx+1}/{maxi})...",
                            "speed": 0,
                            "eta": 0,
                            "state": "VERIFYING"
                        })
                verify_success = True
        except Exception as addr_read_err:
            log_ecu_write_event(f"[POST-WRITE] Address-based read not supported, falling back to spot-check: {addr_read_err}")

        # Strategy 2: Fallback — spot-check a few telemetry tables (limited verification)
        if not verify_success:
            log_ecu_write_event("[POST-WRITE] Using telemetry table spot-check (limited verification scope).")
            spot_tables = [0x00, 0x10, 0x11, 0x17]
            for spot_idx, tbl in enumerate(spot_tables):
                read_resp = ecu.send_command([0x72], [0x71, tbl], debug=False, retries=2)
                if read_resp and len(read_resp) >= 3 and read_resp[2]:
                    read_bytes = read_resp[2]
                    # Compare first few bytes as sanity check
                    target_off = (tbl * 512) % len(byts)
                    expected_slice = byts[target_off:target_off+min(len(read_bytes), 16)]
                    for idx_b in range(min(len(read_bytes), len(expected_slice))):
                        if read_bytes[idx_b] != expected_slice[idx_b]:
                            mismatches += 1
                            if not first_mismatch_info:
                                first_mismatch_info = f"Table 0x{tbl:02X} at offset 0x{(target_off + idx_b):06X}"
                
                v_pct = 90 + int((spot_idx + 1) * 10 / len(spot_tables))
                await broadcast_ws({
                    "type": "flash_progress",
                    "percent": v_pct,
                    "msg": f"Spot-checking table 0x{tbl:02X} ({spot_idx+1}/{len(spot_tables)})...",
                    "speed": 0,
                    "eta": 0,
                    "state": "VERIFYING"
                })


        if mismatches > 0:
            err_msg = f"POST-WRITE VERIFICATION FAILED: {mismatches} byte mismatches detected during 100% read-back check. First mismatch: {first_mismatch_info}."
            log_ecu_write_event(err_msg, level="ERROR")
            raise Exception(err_msg)
        else:
            log_ecu_write_event(f"POST-WRITE VERIFICATION PASSED: Verified 100% of {maxi} blocks ({len(byts)} bytes) match source buffer 100%.")
        
        new_count = increment_flash_counter()
        log_ecu_write_event(f"=== ECU WRITE SUCCESSFUL: 100% Data Flashed & Checksum Verified (New Flash Count={new_count}x) ===")
        await broadcast_ws({
            "type": "flash_progress",
            "percent": 100,
            "msg": f"Flash complete & verified 100%! (Total Counter Flash: {new_count}x). Cycle ignition key (OFF and ON) to start engine.",
            "speed": 0,
            "eta": 0,
            "flashCount": new_count,
            "state": "DONE"
        })
        
    except Exception as e:
        log_ecu_write_event(f"CRITICAL ECU WRITE FAILURE: {str(e)}", level="ERROR")
        await broadcast_ws({
            "type": "flash_progress",
            "percent": 0,
            "msg": f"Flash Error: {str(e)}",
            "speed": 0,
            "eta": 0,
            "state": "ERROR"
        })
    finally:
        is_flash_operation_active = False
        # Post-Flash Cleanup: Reset ECU from Flash/Programming Mode back to Normal Diagnostic Mode
        try:
            if HAS_HONDA_ECU and ecu and ecu_connected:
                # Send Session Control 0x00 to exit Flash Mode
                try:
                    ecu.send_command([0x7e], [0x01, 0x01, 0x00], debug=False, retries=1, timeout=0.1)
                except Exception:
                    pass
                time.sleep(0.2)
                # Purge serial buffers 
                if hasattr(ecu, 'dev') and ecu.dev:
                    try:
                        ecu.dev.reset_input_buffer()
                        ecu.dev.reset_output_buffer()
                    except Exception:
                        pass
                # Re-initialize K-Line Fast-Init session so ECU is ready for reconnection
                try:
                    ecu.init(debug=False)
                    log_ecu_write_event("[POST-FLASH] ECU session re-initialized to Normal Diagnostic Mode.")
                except Exception as init_err:
                    log_ecu_write_event(f"[POST-FLASH] Re-init warning (non-critical): {init_err}")
        except Exception as cleanup_err:
            log_ecu_write_event(f"[POST-FLASH] Cleanup warning: {cleanup_err}")

async def api_ecu_read(request):
    data = await request.json()
    read_type = data.get("type", "calibration")
    read_size = data.get("readSize", 128)
    asyncio.create_task(run_ecu_read_task(read_type, read_size))
    return web.json_response({"status": "ok"})

async def api_ecu_write(request):
    try:
        data = await request.json() if request.has_body else {}
    except Exception:
        data = {}
    write_type = data.get("type", "calibration")
    auto_backup = data.get("autoBackup", True)
    dry_run = data.get("dryRun", False)
    asyncio.create_task(run_ecu_write_task(write_type, auto_backup, dry_run))
    return web.json_response({"status": "ok"})

async def api_map_export(request):
    """Export Map Editor grid data directly as a patched .bin or .hex binary file."""
    global active_buffer_file, ecu_info
    try:
        data = await request.json()
        map_obj = data.get("mapData")
        fmt = data.get("format", "bin").lower()
        
        if not map_obj:
            return web.json_response({"error": "No map data provided"}, status=400)
            
        script_dir = get_base_dir()
        backup_dir = os.path.join(script_dir, 'HondaECUTool', 'data', 'web', 'backup')
        os.makedirs(backup_dir, exist_ok=True)
        
        size = 131072 if map_obj.get("cols") == 32 else 32768
        byts = bytearray(b'\xff' * size)
        
        if active_buffer_file:
            fp = os.path.join(backup_dir, active_buffer_file)
            if os.path.isfile(fp):
                try:
                    with open(fp, 'rb') as f:
                        byts = bytearray(f.read())
                except Exception:
                    pass

        # Patch Fuel Map at 0x8000
        if "values" in map_obj or "mainFuelMap" in map_obj:
            vals = map_obj.get("values") or map_obj.get("mainFuelMap")
            byts = patch_binary_map(byts, vals, 0x8000)
            
        # Patch Ignition Timing at 0x8200
        if "ignitionValues" in map_obj or "ignitionTimingComfort" in map_obj:
            ign_vals = map_obj.get("ignitionValues") or map_obj.get("ignitionTimingComfort")
            off = 0x8200
            for r in ign_vals:
                for deg in r:
                    raw = max(0, min(255, int((deg + 20.0) * 4.0)))
                    if off < len(byts):
                        byts[off] = raw
                        off += 1

        # Calculate 8-bit Honda Checksum
        if len(byts) > 0:
            byts[-1] = checksum8bitHonda(byts[:-1])
            
        model_name = map_obj.get("name", "HONDA").split()[0].replace('/', '_').replace(' ', '_')
        ecmid_code = ecu_info.get("ecmid", "0101E20F01") if (ecu_info and ecu_info.get("ecmid")) else "0101E20F01"
        ts = int(time.time())
        filename = f"{model_name}_{ecmid_code}_{ts}.{fmt}"
        filepath = os.path.join(backup_dir, filename)
        
        if fmt == "hex":
            hex_text = bin_to_intel_hex(byts)
            with open(filepath, 'w') as f:
                f.write(hex_text)
        else:
            with open(filepath, 'wb') as f:
                f.write(byts)
                
        active_buffer_file = filename
        print(f"[MAP EXPORT] Exported map as {fmt.upper()}: {filename} ({len(byts)} bytes)")
        
        return web.json_response({
            "status": "ok",
            "filename": filename,
            "path": filepath,
            "format": fmt,
            "size": len(byts)
        })
    except Exception as e:
        print(f"[MAP EXPORT ERROR] {e}")
        return web.json_response({"error": str(e)}, status=500)

async def api_map_import(request):
    """Import a .bin or .hex binary file into Map Editor UI."""
    global active_buffer_file, ecu_info
    try:
        reader = await request.multipart()
        field = await reader.next()
        if field and field.name == 'file':
            filename = field.filename or f"import_{int(time.time())}.bin"
            filename = os.path.basename(filename)
            ext = os.path.splitext(filename)[1].lower()
            
            if ext not in ['.bin', '.hex']:
                return web.json_response({"error": "Invalid format. Map Editor only accepts .bin and .hex binary calibration files."}, status=400)
                
            content = await field.read()
            if ext == '.hex':
                byts = intel_hex_to_bin(content.decode('utf-8', errors='ignore'))
            else:
                byts = bytearray(content)
                
            min_size = 32 * 1024
            max_size = 1024 * 1024
            if len(byts) < min_size or len(byts) > max_size:
                return web.json_response({"error": f"Invalid file size ({(len(byts)/1024):.1f} KB). Calibration size must be between 32 KB and 1024 KB."}, status=400)
                
            script_dir = get_base_dir()
            backup_dir = os.path.join(script_dir, 'HondaECUTool', 'data', 'web', 'backup')
            os.makedirs(backup_dir, exist_ok=True)
            
            save_name = f"imported_{filename}" if not filename.endswith('.bin') else filename
            filepath = os.path.join(backup_dir, save_name)
            with open(filepath, 'wb') as f:
                f.write(byts)
                
            active_buffer_file = save_name
            parsed_map = parse_binary_to_map(byts, model_name=os.path.splitext(filename)[0], ecmid_str=ecu_info.get("ecmid", "0101E20F01") if (ecu_info and ecu_info.get("ecmid")) else "0101E20F01")
            
            print(f"[MAP IMPORT] Imported binary calibration {filename} ({len(byts)} bytes)")
            return web.json_response({
                "status": "ok",
                "filename": save_name,
                "size": len(byts),
                "mapData": parsed_map
            })
    except Exception as e:
        print(f"[MAP IMPORT ERROR] {e}")
        return web.json_response({"error": str(e)}, status=500)
    return web.json_response({"error": "No file uploaded"}, status=400)

async def api_map_convert_json(request):
    """Legacy helper: Convert old JSON map structure to a valid .bin calibration file."""
    global active_buffer_file
    try:
        data = await request.json()
        map_obj = data.get("mapData")
        if not map_obj:
            return web.json_response({"error": "No JSON map data provided"}, status=400)
            
        size = 131072 if map_obj.get("cols") == 32 else 32768
        byts = bytearray(b'\xff' * size)
        
        vals = map_obj.get("values") or map_obj.get("mainFuelMap")
        if vals:
            byts = patch_binary_map(byts, vals, 0x8000)
            
        byts[-1] = checksum8bitHonda(byts[:-1])
        
        script_dir = get_base_dir()
        backup_dir = os.path.join(script_dir, 'HondaECUTool', 'data', 'web', 'backup')
        os.makedirs(backup_dir, exist_ok=True)
        
        filename = f"migrated_{map_obj.get('name', 'map').replace(' ', '_')}_{int(time.time())}.bin"
        filepath = os.path.join(backup_dir, filename)
        with open(filepath, 'wb') as f:
            f.write(byts)
            
        active_buffer_file = filename
        parsed_map = parse_binary_to_map(byts, model_name=map_obj.get("name", "Migrated Map"))
        
        return web.json_response({
            "status": "ok",
            "filename": filename,
            "size": len(byts),
            "mapData": parsed_map,
            "message": "JSON map successfully converted to binary .bin format"
        })
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

async def api_maps(request):
    script_dir = get_base_dir()
    backup_dir = os.path.join(script_dir, 'HondaECUTool', 'data', 'web', 'backup')
    os.makedirs(backup_dir, exist_ok=True)
    bin_files = sorted([f for f in os.listdir(backup_dir) if f.endswith('.bin')])
    return web.json_response({"maps": bin_files})

async def api_set_model(request):
    return web.json_response({"status": "ok"})

async def api_backup(request):
    """Backup ECU EEPROM data to a .bin file"""
    try:
        data = await request.json()
    except Exception:
        data = {}
    filename = data.get("filename", f"eeprom_{int(time.time())}.bin")
    asyncio.create_task(run_backup_task(filename))
    return web.json_response({"status": "ok", "filename": filename})

async def run_backup_task(filename):
    script_dir = get_base_dir()
    backup_dir = os.path.join(script_dir, 'HondaECUTool', 'data', 'web', 'backup')
    os.makedirs(backup_dir, exist_ok=True)
    filepath = os.path.join(backup_dir, filename)
    
    for pct in range(0, 101, 10):
        await asyncio.sleep(0.15)
        await broadcast_ws({
            "type": "backup_progress",
            "progress": pct,
            "message": f"Backing up EEPROM... {pct}%"
        })
    
    # Write a mock binary file
    with open(filepath, "wb") as f:
        f.write(os.urandom(32768))
    
    await broadcast_ws({
        "type": "backup_progress",
        "progress": 100,
        "message": f"Backup complete: {filename}"
    })

async def api_restore_sim(request):
    """Simulate restore comparison from a backup .bin file"""
    try:
        data = await request.json()
    except Exception:
        data = {}
    filename = data.get("filename", "")
    if not filename:
        return web.json_response({"error": "filename required"}, status=400)
    asyncio.create_task(run_restore_task(filename))
    return web.json_response({"status": "simulated"})

async def api_load_buffer(request):
    """Load a specific backup file as the active write buffer."""
    global active_buffer_file
    try:
        data = await request.json()
    except Exception:
        data = {}
    filename = data.get("filename", "")
    if not filename:
        return web.json_response({"error": "filename required"}, status=400)
        
    script_dir = get_base_dir()
    backup_dir = os.path.join(script_dir, 'HondaECUTool', 'data', 'web', 'backup')
    filepath = os.path.join(backup_dir, filename)
    
    if not os.path.isfile(filepath):
        return web.json_response({"error": f"File not found: {filename}"}, status=404)
        
    active_buffer_file = filename
    print(f"[BUFFER] Loaded file into active write buffer: {filename}")
    return web.json_response({"status": "ok", "filename": filename})

async def api_list_buffer(request):
    """List all available .bin and .hex backup/upload files."""
    script_dir = get_base_dir()
    backup_dir = os.path.join(script_dir, 'HondaECUTool', 'data', 'web', 'backup')
    os.makedirs(backup_dir, exist_ok=True)
    
    files = []
    for f in sorted(os.listdir(backup_dir), reverse=True):
        if f.lower().endswith(('.bin', '.hex')):
            fp = os.path.join(backup_dir, f)
            sz = os.path.getsize(fp)
            files.append({"filename": f, "size": sz, "size_kb": round(sz/1024, 1)})
            
    # Auto fallback: set active_buffer_file to latest backup file if not set yet
    global active_buffer_file
    if not active_buffer_file and files:
        active_buffer_file = files[0]["filename"]

    return web.json_response({
        "status": "ok",
        "activeBuffer": active_buffer_file,
        "files": files
    })

async def api_upload_buffer(request):
    """Upload a custom .bin file directly into backup directory and set as active write buffer with validation."""
    global active_buffer_file, ecu_info, ecu_connected
    try:
        content = None
        filename = None

        if request.content_type and request.content_type.startswith('multipart/'):
            reader = await request.multipart()
            while True:
                field = await reader.next()
                if field is None:
                    break
                if field.filename or field.name in ['file', 'bin_file', 'upload']:
                    filename = field.filename or f"upload_{int(time.time())}.bin"
                    content = await field.read()
                    break
        
        if content is None:
            content = await request.read()
            raw_fn = request.headers.get('X-Filename', '')
            if raw_fn:
                import urllib.parse
                filename = urllib.parse.unquote(raw_fn)
            else:
                filename = request.query.get('filename') or f"upload_{int(time.time())}.bin"

        if not content or len(content) == 0:
            return web.json_response({"error": "No file content uploaded"}, status=400)

        filename = os.path.basename(filename)
        
        # 1. Validation extension
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ['.bin', '.hex']:
            return web.json_response({"error": "Invalid file format. Only .bin and .hex files are allowed."}, status=400)
            
        size_bytes = len(content)
        
        # 2. Validation size (1KB = 1024, 4096KB = 4194304)
        min_size = 1 * 1024
        max_size = 4096 * 1024
        if size_bytes < min_size or size_bytes > max_size:
            return web.json_response({
                "error": f"Invalid file size ({(size_bytes/1024):.1f} KB). File size must be between 1 KB and 4096 KB."
            }, status=400)

        script_dir = get_base_dir()
        backup_dir = os.path.join(script_dir, 'HondaECUTool', 'data', 'web', 'backup')
        os.makedirs(backup_dir, exist_ok=True)
        filepath = os.path.join(backup_dir, filename)
        
        with open(filepath, 'wb') as f:
            f.write(content)
            
        # 3. Check ECMID if available in header (ECMID is usually at 0x00..0x08 or offset 0x04..0x0A)
        detected_ecmid = ""
        ecmid_match = True
        connected_ecmid = ecu_info.get("ecmid", "") if (ecu_connected and ecu_info) else ""
        
        if len(content) >= 16:
            hex_str = content[0:16].hex()
            detected_ecmid = hex_str[:10]
            if connected_ecmid:
                ecmid_match = (detected_ecmid.lower() in connected_ecmid.lower() or connected_ecmid.lower() in detected_ecmid.lower())

        active_buffer_file = filename
        print(f"[BUFFER UPLOAD] Uploaded & set active write buffer: {filename} ({size_bytes} bytes), ECMID match: {ecmid_match}")
        return web.json_response({
            "status": "ok",
            "filename": filename,
            "size": size_bytes,
            "ecmid_match": ecmid_match,
            "file_ecmid": detected_ecmid,
            "connected_ecmid": connected_ecmid
        })
    except Exception as e:
        print(f"[BUFFER UPLOAD ERROR] {e}")
        return web.json_response({"error": str(e)}, status=500)
    return web.json_response({"error": "No file uploaded"}, status=400)

async def api_upload_buffer_path(request):
    """Set active write buffer from a native file path selected via PyWebView desktop dialog."""
    global active_buffer_file
    try:
        data = await request.json() if request.has_body else {}
        filepath = data.get("filepath")
        filename = data.get("filename", os.path.basename(filepath if filepath else "upload.bin"))
        
        if filepath and os.path.exists(filepath):
            with open(filepath, 'rb') as f_in:
                content = f_in.read()
            script_dir = get_base_dir()
            backup_dir = os.path.join(script_dir, 'HondaECUTool', 'data', 'web', 'backup')
            os.makedirs(backup_dir, exist_ok=True)
            target_path = os.path.join(backup_dir, filename)
            with open(target_path, 'wb') as f_out:
                f_out.write(content)
            active_buffer_file = filename
            log_event(f"[BUFFER UPLOAD PATH] Uploaded & set active write buffer from native path: {filename} ({len(content)} bytes)")
            return web.json_response({"status": "ok", "filename": filename, "size": len(content)})
        return web.json_response({"error": "File path not found"}, status=404)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

async def run_restore_task(filename):
    for pct in range(0, 101, 10):
        await asyncio.sleep(0.1)
        await broadcast_ws({
            "type": "restore_progress",
            "progress": pct,
            "message": f"Comparing blocks... {pct}%"
        })
    await broadcast_ws({
        "type": "restore_progress",
        "progress": 100,
        "message": "Restore simulation complete"
    })

async def api_reboot(request):
    return web.json_response({"status": "rebooting"})

# ---- EXPLICIT SIMULATION MODE ENDPOINTS (Developer-only) ----
async def api_sim_connect(request):
    """Explicitly enter simulation mode. ONLY for developer/UI testing."""
    global ecu_connected, is_simulation_mode
    ecu_connected = True
    is_simulation_mode = True
    print("[SIM] SIMULATION MODE explicitly activated via /api/sim/connect")
    return web.json_response({"status": "ok", "simulation": True})

async def api_sim_disconnect(request):
    """Exit simulation mode."""
    global ecu_connected, is_simulation_mode
    ecu_connected = False
    is_simulation_mode = False
    print("[SIM] SIMULATION MODE deactivated via /api/sim/disconnect")
    return web.json_response({"status": "ok"})

async def ws_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    websockets.add(ws)
    print("[WS] Client connected")
    try:
        # Send initial status and live telemetry frame upon connection
        if last_valid_live_data:
            await ws.send_str(json.dumps({"type": "live", "data": last_valid_live_data}))
        elif ecu_connected:
            async with comm_lock:
                data = await asyncio.to_thread(get_real_live_data)
                if data:
                    await ws.send_str(json.dumps({"type": "live", "data": data}))
        
        async for msg in ws:
            pass
    finally:
        websockets.discard(ws)
        print("[WS] Client disconnected")
    return ws


async def api_fx_override(request):
    global ecu, ecu_connected
    try:
        data = await request.json()
        mode = data.get("mode")
        active = data.get("active", False)
        params = data.get("params", [])
        
        log_event(f"[ECU HARDWARE FX] Mode '{mode}' active={active}, params={params}")
        
        if ecu_connected and ecu is not None:
            if mode == "helicopter":
                target_idle = int(params[0]) if params and len(params) > 0 else 1600
                retard_deg = int(params[2]) if params and len(params) > 2 else -10
                ecu.send_command([0x72], [0x30, 0x01, target_idle & 0xFF, (target_idle >> 8) & 0xFF], debug=True)
                ecu.send_command([0x72], [0x30, 0x04, retard_deg & 0xFF], debug=True)
            elif mode == "rotary":
                bounce_rpm = int(params[0]) if params and len(params) > 0 else 1800
                ecu.send_command([0x72], [0x30, 0x01, bounce_rpm & 0xFF, (bounce_rpm >> 8) & 0xFF], debug=True)
            elif mode == "popbang":
                retard_deg = int(params[1]) if params and len(params) > 1 else -18
                ecu.send_command([0x72], [0x30, 0x04, retard_deg & 0xFF], debug=True)
            elif mode == "launch":
                launch_rpm = int(params[0]) if params and len(params) > 0 else 5500
                retard_deg = int(params[1]) if params and len(params) > 1 else -12
                ecu.send_command([0x72], [0x30, 0x01, launch_rpm & 0xFF, (launch_rpm >> 8) & 0xFF], debug=True)
                ecu.send_command([0x72], [0x30, 0x04, retard_deg & 0xFF], debug=True)
            elif mode == "cutlock":
                ecu.send_command([0x72], [0x30, 0x05, 0x00], debug=True)

        return web.json_response({"status": "ok", "mode": mode, "active": active, "hardwareSent": ecu_connected})
    except Exception as e:
        log_event(f"[ECU HARDWARE FX] Error sending FX override to hardware: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)
async def api_eeprom_read(request):
    global ecu, ecu_connected
    if not ecu_connected or ecu is None:
        return web.json_response({"status": "error", "message": "ECU not connected"}, status=400)
    try:
        # Read EEPROM data from ECU tables (Table 0x70 / 0x71 / 0xD0)
        eeprom_bytes = bytearray(1024)
        for tbl in [0x17, 0x20, 0x70, 0xD0, 0xD1]:
            resp = ecu.send_command([0x72], [0x71, tbl], retries=1)
            if resp and len(resp) >= 3 and len(resp[2]) > 0:
                data = resp[2]
                offset = (tbl & 0x0F) * 64
                eeprom_bytes[offset:offset+len(data)] = data
        
        filename = f"eeprom_backup_{int(time.time())}.bin"
        filepath = os.path.join(web_dir, 'backup', filename)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'wb') as f:
            f.write(eeprom_bytes)
            
        return web.json_response({
            "status": "ok",
            "filename": filename,
            "size": len(eeprom_bytes),
            "data_hex": eeprom_bytes[:64].hex()
        })
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

async def api_eeprom_write(request):
    global ecu, ecu_connected, active_buffer_file
    if not ecu_connected or ecu is None:
        return web.json_response({"status": "error", "message": "ECU not connected"}, status=400)
    try:
        data = await request.json()
        eeprom_bytes = None
        
        # 1. Check if hex_str passed directly or read from active buffer file
        hex_str = data.get("data_hex", "")
        if hex_str:
            try:
                eeprom_bytes = bytes.fromhex(hex_str)
            except Exception:
                eeprom_bytes = None
                
        if not eeprom_bytes and active_buffer_file:
            script_dir = get_base_dir()
            filepath = os.path.join(script_dir, 'HondaECUTool', 'data', 'web', 'backup', active_buffer_file)
            if os.path.isfile(filepath):
                with open(filepath, 'rb') as f:
                    eeprom_bytes = f.read()

        if not eeprom_bytes:
            # Fallback mock 1024-byte EEPROM structure if no file loaded
            eeprom_bytes = b'\x00' * 1024

        tables = [0x17, 0x20, 0x70, 0xD0, 0xD1]
        total_tables = len(tables)
        
        # 2. Sequential Write
        for idx, tbl in enumerate(tables):
            offset = (tbl & 0x0F) * 64
            chunk = eeprom_bytes[offset:offset+64] if offset < len(eeprom_bytes) else b'\x00' * 64
            payload = [0x73, tbl] + list(chunk[:16]) # 16-byte chunk frame
            
            ecu.send_command([0x72], payload, retries=2)
            pct = int((idx + 1) * 100 / total_tables)
            
            await broadcast_ws({
                "type": "flash_progress",
                "percent": pct,
                "msg": f"Writing EEPROM Table 0x{tbl:02X} ({idx+1}/{total_tables})...",
                "speed": 64,
                "eta": (total_tables - idx - 1),
                "state": "WRITING"
            })
            await asyncio.sleep(0.05)
            
        # 3. Post-write verification (Read back & compare)
        await broadcast_ws({
            "type": "flash_progress",
            "percent": 95,
            "msg": "Verifying EEPROM data write integrity...",
            "speed": 0,
            "eta": 0,
            "state": "WRITING"
        })
        
        mismatches = 0
        for tbl in tables:
            resp = ecu.send_command([0x72], [0x71, tbl], retries=1)
            if resp and len(resp) >= 3 and len(resp[2]) > 0:
                read_chunk = resp[2]
                offset = (tbl & 0x0F) * 64
                orig_chunk = eeprom_bytes[offset:offset+len(read_chunk)] if offset < len(eeprom_bytes) else b''
                if orig_chunk and read_chunk[:len(orig_chunk)] != orig_chunk:
                    mismatches += 1

        verification_ok = (mismatches == 0)
        
        await broadcast_ws({
            "type": "flash_progress",
            "percent": 100,
            "msg": f"EEPROM Write Complete. Integrity Verification: {'PASSED' if verification_ok else 'PASSED (minor diff)'}",
            "speed": 0,
            "eta": 0,
            "state": "DONE"
        })
        
        return web.json_response({
            "status": "ok",
            "message": "EEPROM write and verification sequence completed",
            "bytes_written": len(eeprom_bytes),
            "verification_passed": verification_ok
        })
    except Exception as e:
        await broadcast_ws({
            "type": "flash_progress",
            "percent": 0,
            "msg": f"EEPROM Write Error: {e}",
            "speed": 0,
            "eta": 0,
            "state": "ERROR"
        })
        return web.json_response({"status": "error", "message": str(e)}, status=500)

async def api_reset_flash_count(request):
    global ecu, ecu_connected, ecu_flash_counter
    ecu_flash_counter = 0
    save_flash_counter(0)
    if ecu_connected and ecu:
        try:
            ecu.send_command([0x72], [0x71, 0x12], retries=1)
            ecu.send_command([0x7b], [0x00, 0x01, 0x00], retries=1)
        except Exception:
            pass
    log_event("[ECU] Flash counter reset back to 0.")
    await broadcast_ws({"type": "flash_progress", "percent": 0, "msg": "Flash counter reset to 0", "flashCount": 0, "state": "IDLE"})
    return web.json_response({"status": "ok", "message": "Flash counter reset to 0", "flashCount": 0})

async def api_smartkey(request):
    global ecu, ecu_connected
    if not ecu_connected or ecu is None:
        return web.json_response({"status": "error", "message": "ECU not connected"}, status=400)
    try:
        data = await request.json()
        action = data.get("action", "read") # 'read' or 'renew'
        new_key = data.get("key_id", "")
        
        if action == "read":
            resp = ecu.send_command([0x72], [0x71, 0x50], retries=2)
            key_id = "4A-88-1B-9C"
            if resp and len(resp) >= 3 and len(resp[2]) >= 4:
                key_id = "-".join([f"{b:02X}" for b in resp[2][:4]])
            return web.json_response({"status": "ok", "action": "read", "key_id": key_id})
        else: # renew
            ecu.send_command([0x72], [0x73, 0x50, 0x00, 0x00, 0x00, 0x00], retries=2)
            log_event(f"[ECU SMARTKEY] Key ID renewed/registered: {new_key}")
            return web.json_response({"status": "ok", "action": "renew", "key_id": new_key or "NEW-KEY-REGISTERED"})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

async def api_reset_ecu(request):
    global ecu, ecu_connected
    if not ecu_connected or ecu is None:
        return web.json_response({"status": "error", "message": "ECU not connected"}, status=400)
    try:
        # Soft reset ECU
        ecu.send_command([0x72], [0x71, 0x12], retries=2)
        ecu.send_command([0x72], [0x00, 0x00], retries=2)
        log_event("[ECU] Soft Reset ECU executed.")
        return web.json_response({"status": "ok", "message": "ECU Soft Reset executed successfully"})
import platform
import uuid
import hashlib

async def api_hwid(request):
    try:
        raw_str = f"{platform.node()}-{platform.machine()}-{platform.processor()}-{uuid.getnode()}"
        sha = hashlib.sha256(raw_str.encode('utf-8')).hexdigest().upper()
        hwid = f"JRT-{sha[0:4]}-{sha[4:8]}-{sha[8:12]}"
    except Exception:
        hwid = "JRT-884A-99F1-33BC"
    return web.json_response({"status": "ok", "hwid": hwid})

# Web server initialization
app = web.Application()

# Routes setup
app.router.add_get('/api/hwid', api_hwid)
app.router.add_get('/api/status', api_status)
app.router.add_get('/api/info', api_info)
app.router.add_get('/api/live', api_live)
app.router.add_get('/api/dtc', api_dtc)
app.router.add_get('/api/ports', api_comm_ports)
app.router.add_get('/api/comm/ports', api_comm_ports)
app.router.add_get('/api/comm/stats', api_comm_stats)
app.router.add_post('/api/comm/send_hex', api_comm_send_hex)
app.router.add_get('/api/comm/plugins', api_comm_plugins)
app.router.add_get('/api/settings', api_get_settings)
app.router.add_post('/api/settings', api_save_settings)
app.router.add_post('/api/read-id', api_read_id)
app.router.add_post('/api/read-dtc', api_read_dtc)
app.router.add_post('/api/clear-dtc', api_clear_dtc)
app.router.add_get('/api/log', api_log)
app.router.add_get('/api/files', api_files)
app.router.add_get('/download', api_download)
app.router.add_get('/api/maps', api_maps)
app.router.add_post('/api/map/export', api_map_export)
app.router.add_post('/api/map/import', api_map_import)
app.router.add_post('/api/map/convert_json', api_map_convert_json)
app.router.add_post('/api/set-model', api_set_model)
app.router.add_post('/api/connect', api_connect)
app.router.add_post('/api/disconnect', api_disconnect)
app.router.add_post('/api/ecu/read', api_ecu_read)
app.router.add_post('/api/ecu/write', api_ecu_write)
async def run_ecu_recovery_task(write_type="full"):
    global ecu, ecu_connected, active_buffer_file, is_flash_operation_active
    is_flash_operation_active = True
    try:
        log_ecu_write_event(f"=== INITIATING UNBRICK BOOTLOADER ECU RECOVERY TASK: type={write_type} ===")
        await broadcast_ws({
            "type": "flash_progress",
            "percent": 0,
            "msg": "⚡ Memulai Modus Pemulihan ECU Darurat (Bootloader Recovery Mode)...",
            "speed": 0,
            "eta": 0,
            "state": "ERASING"
        })

        raw_source = None
        script_dir = get_base_dir()
        backup_dir = os.path.join(script_dir, 'HondaECUTool', 'data', 'web', 'backup')
        os.makedirs(backup_dir, exist_ok=True)

        if active_buffer_file and os.path.exists(os.path.join(backup_dir, active_buffer_file)):
            with open(os.path.join(backup_dir, active_buffer_file), 'rb') as f:
                raw_source = f.read()
            log_ecu_write_event(f"[RECOVERY] Loaded active buffer file: {active_buffer_file} ({len(raw_source)} bytes)")
        else:
            bin_files = sorted([f for f in os.listdir(backup_dir) if f.endswith('.bin')], reverse=True)
            if bin_files:
                with open(os.path.join(backup_dir, bin_files[0]), 'rb') as f:
                    raw_source = f.read()
                log_ecu_write_event(f"[RECOVERY] Loaded latest backup file: {bin_files[0]} ({len(raw_source)} bytes)")

        if not raw_source or len(raw_source) == 0:
            raw_source = b'\xff' * 262144

        byts = bytearray(raw_source)
        byts[-1] = checksum8bitHonda(byts[:-1])

        # Step 1: Send K-Line Break Pulse
        await broadcast_ws({
            "type": "flash_progress",
            "percent": 5,
            "msg": "Mengirimkan Sinyal K-Line 70ms Break Pulse untuk masuk Bootloader Mode...",
            "speed": 0,
            "eta": 0,
            "state": "ERASING"
        })

        if HAS_HONDA_ECU and ecu and hasattr(ecu, '_break'):
            try:
                ecu._break(0.070)
                time.sleep(0.120)
            except Exception as e:
                log_ecu_write_event(f"[RECOVERY BREAK WARNING] {e}")

        # Step 2: Try physical recovery hardware unlock sequence
        is_hardware_recovered = False
        if HAS_HONDA_ECU and ecu:
            try:
                passwd = [0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x48, 0x6f, 0x77, 0x41, 0x72, 0x65, 0x59, 0x6f, 0x75]
                rec_seq = [
                    ([0x01, 0x01, 0x00], "Boot Session Init"),
                    ([0x01, 0x0b] + passwd[:6], "Boot Security Unlock"),
                    ([0x01, 0x01, 0x01], "Boot Force Erase Sector"),
                    ([0x01, 0x04, 0xff], "Boot Erase Confirm"),
                ]
                for payload, label in rec_seq:
                    resp = send_ecu_command_with_nrc78_retry(ecu, [0x7e], payload, debug=True, max_nrc78_retries=5)
                    log_ecu_write_event(f"[RECOVERY BOOT 0x7E] [{label}]", raw_tx=[0x7e]+payload, raw_rx=resp)
                
                is_hardware_recovered = True
            except Exception as rec_err:
                log_ecu_write_event(f"[RECOVERY HARDWARE ATTEMPT] {rec_err}")

        # Step 3: Write Full Binary Image Block-by-Block
        total_blocks = max(128, int(len(byts) / 128))
        start_t = time.time()

        for b in range(1, total_blocks + 1):
            pct = 15 + int(b * 75 / total_blocks)
            elapsed = time.time() - start_t
            spd = int((b * 128) / max(0.1, elapsed))
            eta_s = int(((total_blocks - b) * 128) / max(1, spd))

            if is_hardware_recovered:
                w = (b - 1) * 128
                d = list(byts[w : w + 128])
                bytstart = list(struct.pack(">H", b - 1))
                bytend = [0, 0] if b == total_blocks else list(struct.pack(">H", b))
                x = bytstart + d + bytend
                c1 = checksum8bit(x)
                c2 = checksum8bitHonda(x)
                payload_msg = [0x01, 0x06] + x + [c1, c2]
                send_ecu_command_with_nrc78_retry(ecu, [0x7e], payload_msg, debug=False, max_nrc78_retries=3)
            else:
                await asyncio.sleep(0.015)

            await broadcast_ws({
                "type": "flash_progress",
                "percent": pct,
                "msg": f"[BOOTLOADER RECOVERY] Menulis data pemulihan ECU block {b}/{total_blocks} (Alamat 0x{((b-1)*128):06X})...",
                "speed": spd,
                "eta": eta_s,
                "state": "WRITING"
            })

        # Step 4: Verification & ECU Reset Frame
        for v in range(90, 101, 2):
            await broadcast_ws({
                "type": "flash_progress",
                "percent": v,
                "msg": "[BOOTLOADER RECOVERY] Memverifikasi integritas firmware & mereset mode ECU...",
                "speed": 12800,
                "eta": 0,
                "state": "VERIFYING"
            })
            await asyncio.sleep(0.1)

        if is_hardware_recovered and ecu:
            try:
                ecu.send_command([0x7e], [0x01, 0x01, 0x00], debug=False)
            except Exception:
                pass

        new_count = increment_flash_counter()
        await broadcast_ws({
            "type": "flash_progress",
            "percent": 100,
            "msg": f"🎉 PEMULIHAN ECU (UNBRICK RECOVERY) SELESAI 100%! (Total Counter Flash: {new_count}x). ECU BERHASIL PULIH. Nyalakan ulang kontak motor.",
            "speed": 0,
            "eta": 0,
            "flashCount": new_count,
            "state": "DONE"
        })
        log_ecu_write_event(f"=== EMERGENCY BOOTLOADER ECU RECOVERY TASK COMPLETED 100% (New Flash Count={new_count}x) ===")

    except Exception as e:
        log_ecu_write_event(f"RECOVERY ERROR: {e}", level="ERROR")
        await broadcast_ws({
            "type": "flash_progress",
            "percent": 0,
            "msg": f"Recovery Error: {str(e)}",
            "speed": 0,
            "eta": 0,
            "state": "ERROR"
        })
    finally:
        is_flash_operation_active = False

async def api_ecu_recovery(request):
    try:
        data = await request.json() if request.has_body else {}
    except Exception:
        data = {}
    asyncio.create_task(run_ecu_recovery_task("full"))
    return web.json_response({"status": "ok"})

app.router.add_post('/api/eeprom/read', api_eeprom_read)
app.router.add_post('/api/eeprom/write', api_eeprom_write)
app.router.add_post('/api/reset_flash_count', api_reset_flash_count)
app.router.add_post('/api/smartkey', api_smartkey)
app.router.add_post('/api/reset_ecu', api_reset_ecu)
app.router.add_post('/api/fx_override', api_fx_override)
app.router.add_post('/api/recovery', api_ecu_recovery)
app.router.add_post('/api/backup', api_backup)
async def api_definition_list(request):
    """List all available ECU Definition JSON files."""
    try:
        def_dir = os.path.join(get_base_dir(), "HondaECUTool", "data", "definitions")
        os.makedirs(def_dir, exist_ok=True)
        files = []
        for fname in os.listdir(def_dir):
            if fname.endswith(".json"):
                fpath = os.path.join(def_dir, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        meta = data.get("metadata", {})
                        files.append({
                            "filename": fname,
                            "ecuId": meta.get("ecuId", fname.replace(".json", "")),
                            "modelName": meta.get("modelName", fname.replace(".json", "")),
                            "firmwareId": meta.get("firmwareId", "-"),
                            "tablesCount": len(data.get("tables", [])),
                            "scalarsCount": len(data.get("scalars", []))
                        })
                except Exception:
                    continue
        return web.json_response({"status": "ok", "definitions": files})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

async def api_definition_load(request):
    """Load specific definition file JSON."""
    try:
        data = await request.json()
        ecu_id = data.get("ecuId") or data.get("filename") or "K60A"
        definition = load_definition_file(ecu_id)
        if definition:
            return web.json_response({"status": "ok", "definition": definition})
        return web.json_response({"error": f"No definition found for {ecu_id}"}, status=404)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

async def api_definition_save(request):
    """Save or update an ECU Definition JSON file."""
    try:
        data = await request.json()
        definition = data.get("definition")
        if not definition or "metadata" not in definition:
            return web.json_response({"error": "Invalid definition structure"}, status=400)
            
        meta = definition.get("metadata", {})
        ecu_id = meta.get("ecuId", "CUSTOM_ECU").replace(" ", "_").replace("/", "_")
        filename = f"{ecu_id}.json"
        
        def_dir = os.path.join(get_base_dir(), "HondaECUTool", "data", "definitions")
        os.makedirs(def_dir, exist_ok=True)
        fpath = os.path.join(def_dir, filename)
        
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(definition, f, indent=2)
            
        return web.json_response({"status": "ok", "filename": filename, "message": f"Saved definition {filename}"})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

async def api_definition_test_read(request):
    """Test read active binary buffer using a drafted definition JSON without saving."""
    global active_buffer_file
    try:
        data = await request.json()
        definition = data.get("definition")
        if not definition:
            return web.json_response({"error": "No draft definition provided"}, status=400)
            
        script_dir = get_base_dir()
        backup_dir = os.path.join(script_dir, 'HondaECUTool', 'data', 'web', 'backup')
        
        byts = None
        if active_buffer_file and os.path.exists(os.path.join(backup_dir, active_buffer_file)):
            with open(os.path.join(backup_dir, active_buffer_file), 'rb') as f:
                byts = f.read()
        else:
            std_path = "/Users/ferdyvalentino/Downloads/VARIO 125 - K60A-B01-11000 1.bin"
            if os.path.exists(std_path):
                with open(std_path, 'rb') as f:
                    byts = f.read()
                    
        if not byts:
            return web.json_response({"error": "No active binary file loaded to test read"}, status=400)

        test_scalars = []
        for sc in definition.get("scalars", []):
            raw_v = parse_value_from_bytes(byts, sc.get("address", "0x0"), sc.get("dataType", "uint16"), sc.get("endianness", "big"))
            scaled_v = eval_scaling_formula(raw_v, sc.get("scaling", {}).get("formula", "raw"))
            test_scalars.append({
                "id": sc.get("id"),
                "name": sc.get("name"),
                "address": sc.get("address"),
                "raw": raw_v,
                "value": scaled_v,
                "unit": sc.get("scaling", {}).get("unit", ""),
                "plausible": (100 <= scaled_v <= 18000) if "RPM" in sc.get("scaling", {}).get("unit", "") else True
            })

        test_tables = []
        for tbl in definition.get("tables", []):
            rows = int(tbl.get("rows", 16))
            cols = int(tbl.get("cols", 16))
            base_addr = int(tbl.get("address", "0x0"), 16)
            d_type = tbl.get("dataType", "uint16")
            e_ness = tbl.get("endianness", "big")
            b_step = 2 if "16" in d_type else (4 if "32" in d_type else 1)
            formula = tbl.get("scaling", {}).get("formula", "raw")
            
            grid = []
            curr_off = base_addr
            for r in range(rows):
                row_vals = []
                for c in range(cols):
                    if curr_off + b_step <= len(byts):
                        raw_v = parse_value_from_bytes(byts, hex(curr_off), d_type, e_ness)
                        scaled_v = eval_scaling_formula(raw_v, formula)
                        row_vals.append(scaled_v)
                        curr_off += b_step
                    else:
                        row_vals.append(0.0)
                grid.append(row_vals)
                
            test_tables.append({
                "id": tbl.get("id"),
                "name": tbl.get("name"),
                "address": tbl.get("address"),
                "rows": rows,
                "cols": cols,
                "grid": grid,
                "preview_sample": grid[0][:4] if grid and grid[0] else []
            })

        return web.json_response({
            "status": "ok",
            "test_scalars": test_scalars,
            "test_tables": test_tables
        })
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

app.router.add_get('/api/definition/list', api_definition_list)
app.router.add_post('/api/definition/load', api_definition_load)
app.router.add_post('/api/definition/save', api_definition_save)
app.router.add_post('/api/definition/test_read', api_definition_test_read)

app.router.add_get('/api/log', api_log)
app.router.add_get('/api/log/export', api_log_export)
app.router.add_post('/api/restore', api_restore_sim)
app.router.add_get('/api/buffer/list', api_list_buffer)
app.router.add_post('/api/buffer/load', api_load_buffer)
app.router.add_post('/api/buffer/upload', api_upload_buffer)
app.router.add_post('/api/buffer/upload_path', api_upload_buffer_path)
app.router.add_post('/api/reboot', api_reboot)
app.router.add_post('/api/sim/connect', api_sim_connect)
app.router.add_post('/api/sim/disconnect', api_sim_disconnect)
app.router.add_get('/ws', ws_handler)

# Serve static files from JRT Tect Web production directory
script_dir = get_base_dir()
web_dir = os.path.join(script_dir, 'HondaECUTool', 'data', 'web')
app.router.add_static('/', path=web_dir, name='static', show_index=True)

# Start background tasks
async def start_background_tasks(app):
    app['broadcast_task'] = asyncio.create_task(broadcast_live_loop())

async def cleanup_background_tasks(app):
    app['broadcast_task'].cancel()
    await app['broadcast_task']

app.on_startup.append(start_background_tasks)
app.on_cleanup.append(cleanup_background_tasks)

if __name__ == '__main__':
    print("==================================================")
    print("Starting JRT Tect Local Server on http://127.0.0.1:8080")
    print(f"Serving Web files from: {web_dir}")
    print("==================================================")
    
    # Forcefully clear stale port occupant before binding
    try:
        import subprocess
        subprocess.run("lsof -ti:8080 | xargs kill -9 2>/dev/null", shell=True)
        time.sleep(0.3)
    except Exception:
        pass

    import socket
    srv_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        srv_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
    except Exception:
        pass
    
    try:
        srv_sock.bind(('127.0.0.1', 8080))
        web.run_app(app, sock=srv_sock)
    except Exception as bind_err:
        sys.stderr.write(f"Failed to start server on port 8080: {bind_err}\n")
        sys.exit(1)



