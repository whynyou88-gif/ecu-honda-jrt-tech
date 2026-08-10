"""
Module 11: Keihin K-Line Protocol Plugin
Concrete diagnostic plugin for Honda Keihin K-Line ECUs.
"""

from typing import Dict, List, Any
from framework.plugins.base_protocol import AbstractProtocolPlugin
from framework.core.models import ECUInfo, LiveParameter
from framework.core.constants import HEADER_LIVE_DATA_READ
from framework.live_data.engine import LiveDataManager

class KeihinKLineProtocol(AbstractProtocolPlugin):
    """Keihin K-Line Diagnostic Protocol Plugin."""

    def __init__(self, transport):
        super().__init__(transport)
        self.live_manager = LiveDataManager()

    @property
    def protocol_name(self) -> str:
        return "Keihin K-Line KWP2000"

    def connect(self) -> bool:
        self.transport.open()
        self.transport.send_break_pulse(0.070)
        return True

    def identify(self) -> ECUInfo:
        pkt = self.transport.send_frame(HEADER_LIVE_DATA_READ, b"\x71\x00")
        raw = pkt.payload
        part_no = "UNKNOWN"
        if len(raw) >= 5:
            part_no = "".join([f"{b:02X}" for b in raw[:5]])
        return ECUInfo(
            ecu_id=part_no,
            model="Honda Motorcycle ECU",
            vendor="Keihin / Shindengen",
            protocol=self.protocol_name
        )

    def read_live(self) -> Dict[str, LiveParameter]:
        pkt = self.transport.send_frame(HEADER_LIVE_DATA_READ, b"\x71\x17")
        return self.live_manager.parse_telemetry_table(0x17, pkt.payload)

    def read_dtc(self) -> List[Dict[str, Any]]:
        pkt = self.transport.send_frame(HEADER_LIVE_DATA_READ, b"\x74\x00")
        raw = pkt.payload
        codes = []
        if len(raw) >= 2:
            for i in range(0, len(raw) - 1, 2):
                if raw[i] != 0:
                    codes.append({"dtc_code": f"{raw[i]:02d}-{raw[i+1]:02d}", "status": "ACTIVE"})
        return codes

    def clear_dtc(self) -> bool:
        pkt = self.transport.send_frame(HEADER_LIVE_DATA_READ, b"\x60\x03")
        return pkt is not None and len(pkt.payload) > 0

    def disconnect(self) -> bool:
        self.transport.close()
        return True

