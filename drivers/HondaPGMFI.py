import time
import math
from struct import unpack
from drivers.ecu_driver_base import BaseECUDriver
from drivers.hardware_adapter import crc8_honda

class HondaPGMFIDriver(BaseECUDriver):
    def __init__(self, adapter):
        super().__init__(adapter)
        self.brand = "HONDA"
        self.model = "PGM-FI"
        self.detected_ect_index = None

    def _send_command(self, mtype, data=None, retries=2):
        if not data:
            data = []
        msgsize = 0x02 + len(mtype) + len(data)
        msg = bytearray(mtype + [msgsize] + data)
        msg.append(crc8_honda(msg))
        
        for _ in range(retries):
            self.adapter.flush()
            start_t = time.time()
            self.adapter.write(msg)
            
            # Echo cancellation
            echo = self.adapter.read(len(msg), timeout_sec=0.1)
            if not echo:
                continue
                
            # Read header
            hdr = self.adapter.read(len(mtype) + 1, timeout_sec=0.1)
            if not hdr or len(hdr) < len(mtype) + 1:
                continue
                
            total_len = hdr[-1]
            payload_len = total_len - len(mtype) - 1
            if payload_len <= 0:
                continue
                
            payload = self.adapter.read(payload_len, timeout_sec=0.1)
            if not payload or len(payload) < payload_len:
                continue
                
            full_resp = hdr + payload
            if full_resp[-1] == crc8_honda(full_resp[:-1]):
                latency_ms = (time.time() - start_t) * 1000.0
                self.adapter.stats.record_packet(len(msg), len(full_resp), latency_ms, success=True)
                return full_resp[len(mtype)+1:-1]
                
        self.adapter.stats.record_packet(len(msg), 0, 0.0, success=False)
        return None

    def connect(self) -> bool:
        if not self.adapter.open():
            return False
        
        # Session probe: Table 0x72
        resp = self._send_command([0x72], [0x00, 0xf0], retries=2)
        if resp is not None:
            self.connected = True
            return True

        # Fast-init pulse if needed
        self.adapter.flush()
        resp = self._send_command([0xfe], [0x72], retries=2)
        if resp is not None or self._send_command([0x72], [0x00, 0xf0], retries=2) is not None:
            self.connected = True
            return True

        self.connected = False
        return False

    def disconnect(self):
        self.connected = False
        self.adapter.close()

    def read_id(self) -> str:
        resp = self._send_command([0x72], [0x00, 0xf0], retries=2)
        if resp and len(resp) >= 8:
            self.ecu_id = "".join([f"{b:02X}" for b in resp[:8]])
            return self.ecu_id
        return "UNKNOWN_ECU"

    def read_realtime(self) -> dict:
        t = time.time()
        resp = self._send_command([0x72], [0x71, 0x17], retries=1)
        
        if not resp or len(resp) < 12:
            tele = self.default_telemetry()
            tele["connected"] = self.connected
            return tele

        b2, b3, b4, b5 = resp[2], resp[3], resp[4], resp[5]

        # Lock detected ECT index persistently per session
        if self.detected_ect_index is None:
            if b3 < 70 and b4 > 70:
                self.detected_ect_index = 4  # Shindengen Vario/Beat ESP
            elif b4 < 70 and b3 > 70:
                self.detected_ect_index = 3  # Keihin Sport CBR150R
            else:
                self.detected_ect_index = 4

        # Adaptive TPS scaling from raw ADC (0-255)
        raw_tps = float(b2)
        min_adc = 35.0
        pct = (raw_tps - min_adc) * 100.0 / (255.0 - min_adc)
        norm_tps = max(0.0, min(100.0, pct)) if raw_tps >= min_adc else 0.0

        map_val = float(resp[3]) if self.detected_ect_index == 4 else float(resp[5])
        ect_raw = float(resp[self.detected_ect_index])
        ect_val = float(ect_raw - 40.0) if (10 <= ect_raw <= 220) else 0.0

        iat_raw = float(resp[5]) if self.detected_ect_index == 4 else float(resp[4])
        iat_val = float(iat_raw - 40.0) if (10 <= iat_raw <= 220) else 0.0

        rpm = (resp[6] << 8) | resp[7]
        spd = resp[11] if len(resp) > 11 else 0

        vbat = float(resp[0]) / 10.0 if resp[0] > 0 else 0.0
        inj_raw = (resp[8] << 8) | resp[9] if len(resp) > 9 else 0
        inj_pw = float(inj_raw) / 256.0 if inj_raw > 0 else 0.0
        inj_duty = min(100.0, (rpm * inj_pw) / 1200.0) if (rpm > 0 and inj_pw > 0) else 0.0
        ign_raw = resp[10] if len(resp) > 10 else 0
        ign_val = float(ign_raw / 2.0) if ign_raw > 0 else 0.0

        o2_raw = resp[6] if (len(resp) > 12 and self.detected_ect_index == 4) else 0
        o2_mv = float(o2_raw * 5) if o2_raw > 0 else 0.0

        self.last_telemetry = {
            "connected": True,
            "brand": self.brand,
            "model": self.model,
            "ecu_id": self.ecu_id,
            "timestamp": t,
            "rpm": rpm,
            "tps": round(norm_tps, 1),
            "map": round(map_val, 1),
            "iat": round(iat_val, 1),
            "ect": round(ect_val, 1),
            "oiltemp": round(ect_val, 1),
            "vbat": round(vbat, 1),
            "injPW": round(inj_pw, 2),
            "injDuty": round(inj_duty, 1),
            "ignTiming": round(ign_val, 1),
            "lambda": round(o2_mv / 450.0, 2) if o2_mv > 0 else 0.0,
            "afr": 0.0,  # Narrowband O2 cannot provide linear AFR without wideband sensor
            "knock": 0,
            "speed": spd,
            "gear": 0,
            "fuelPress": 0.0,
            "oilPress": 0.0,
            "boost": 0.0,
            "wheelSpeed": spd,
            "engineLoad": round((map_val / 101.3) * 100.0, 1) if map_val > 0 else 0.0,
            "manifoldPress": round(map_val, 1),
            "idleControl": 0.0,
            "revLimiterStatus": rpm > 10500,
            "closedLoopStatus": o2_mv > 100
        }
        return self.last_telemetry

    def read_dtc(self) -> list:
        resp = self._send_command([0x72], [0x71, 0x11], retries=2)
        if resp and len(resp) >= 2:
            codes = []
            for i in range(0, len(resp)-1, 2):
                if resp[i] != 0:
                    codes.append({"code": f"{resp[i]:02d}-{resp[i+1]:02d}", "milOn": True})
            return codes
        return []

    def clear_dtc(self) -> bool:
        resp = self._send_command([0x72], [0x71, 0x12], retries=2)
        return resp is not None

