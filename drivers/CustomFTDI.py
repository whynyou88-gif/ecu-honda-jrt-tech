import time
from drivers.ecu_driver_base import BaseECUDriver

class CustomFTDIDriver(BaseECUDriver):
    def __init__(self, adapter):
        super().__init__(adapter)
        self.brand = "CUSTOM"
        self.model = "FTDI-GENERIC"

    def connect(self) -> bool:
        if not self.adapter.open():
            return False
        self.connected = True
        return True

    def disconnect(self):
        self.connected = False
        self.adapter.close()

    def read_id(self) -> str:
        self.ecu_id = "UNKNOWN_FTDI"
        return self.ecu_id


    def read_realtime(self) -> dict:
        tele = self.default_telemetry()
        tele["connected"] = self.connected
        return tele

    def read_dtc(self) -> list:
        return []

    def clear_dtc(self) -> bool:
        return True
