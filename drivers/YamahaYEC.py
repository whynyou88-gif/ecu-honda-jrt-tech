import time
from drivers.ecu_driver_base import BaseECUDriver
from drivers.hardware_adapter import checksum8bit

class YamahaYECDriver(BaseECUDriver):
    def __init__(self, adapter):
        super().__init__(adapter)
        self.brand = "YAMAHA"
        self.model = "YEC-KLINE"

    def connect(self) -> bool:
        if not self.adapter.open():
            return False
        # Yamaha YEC Handshake
        msg = bytearray([0xf0, 0x02, 0x10, 0x00])
        msg.append(checksum8bit(msg))
        self.adapter.flush()
        self.adapter.write(msg)
        self.adapter.read(len(msg), timeout_sec=0.1) # echo
        resp = self.adapter.read(6, timeout_sec=0.2)
        if resp and len(resp) >= 5:
            self.connected = True
            return True
        self.connected = False
        return False

    def disconnect(self):
        self.connected = False
        self.adapter.close()

    def read_id(self) -> str:
        self.ecu_id = "2DP-E5407-00"
        return self.ecu_id

    def read_realtime(self) -> dict:
        tele = self.default_telemetry()
        if not self.connected:
            return tele
        msg = bytearray([0xf0, 0x02, 0x21, 0x00])
        msg.append(checksum8bit(msg))
        self.adapter.flush()
        self.adapter.write(msg)
        self.adapter.read(len(msg), timeout_sec=0.1)
        resp = self.adapter.read(16, timeout_sec=0.2)
        if resp and len(resp) >= 12:
            tele["rpm"] = (resp[2] << 8) | resp[3]
            tele["tps"] = round(float(resp[4]) / 2.55, 1)
            tele["map"] = round(float(resp[5]), 1)
            tele["ect"] = round(float(resp[6]) - 40.0, 1)
            tele["vbat"] = round(float(resp[7]) / 10.0, 1)
            tele["speed"] = resp[8]
            tele["connected"] = True
            self.last_telemetry = tele
        return self.last_telemetry

    def read_dtc(self) -> list:
        return []

    def clear_dtc(self) -> bool:
        return True
