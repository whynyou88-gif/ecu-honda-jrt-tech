import time
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class BaseECUDriver(ABC):
    def __init__(self, adapter):
        self.adapter = adapter
        self.brand = "GENERIC"
        self.model = "UNKNOWN"
        self.ecu_id = "00000000"
        self.connected = False
        self.last_telemetry = self.default_telemetry()

    def default_telemetry(self) -> Dict[str, Any]:
        return {
            "connected": self.connected,
            "brand": self.brand,
            "model": self.model,
            "ecu_id": self.ecu_id,
            "timestamp": time.time(),
            "rpm": 0,
            "tps": 0.0,
            "map": 0.0,
            "iat": 0.0,
            "ect": 0.0,
            "oiltemp": 0.0,
            "vbat": 0.0,
            "injPW": 0.0,
            "injDuty": 0.0,
            "ignTiming": 0.0,
            "lambda": 0.0,
            "afr": 0.0,
            "knock": 0,
            "speed": 0.0,
            "gear": 0,
            "fuelPress": 0.0,
            "oilPress": 0.0,
            "boost": 0.00,
            "wheelSpeed": 0.0,
            "engineLoad": 0.0,
            "manifoldPress": 0.0,
            "idleControl": 0.0,
            "revLimiterStatus": False,
            "closedLoopStatus": False
        }


    @abstractmethod
    def connect(self) -> bool:
        pass

    @abstractmethod
    def disconnect(self):
        pass

    @abstractmethod
    def read_realtime(self) -> Dict[str, Any]:
        pass

    @abstractmethod
    def read_dtc(self) -> list:
        pass

    @abstractmethod
    def clear_dtc(self) -> bool:
        pass

    @abstractmethod
    def read_id(self) -> str:
        pass

    def write_map(self, map_data: bytes, address: int) -> bool:
        return False

    def flash_firmware(self, firmware_bytes: bytes) -> bool:
        return False
