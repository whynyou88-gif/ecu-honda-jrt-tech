"""
Module 1 & Module 10 Data Models: ECUInfo, ECUCapabilities, FramePacket, LiveParameter
Strongly typed dataclasses used across transport, detection, logging, and live data engine.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
import datetime

@dataclass
class ECUInfo:
    """
    Module 1: Complete ECU Identification Information
    Carries auto-detected hardware, firmware, and software metadata.
    """
    ecu_id: str = "UNKNOWN"
    firmware: str = "UNKNOWN"
    hardware: str = "UNKNOWN"
    vendor: str = "Keihin"
    model: str = "UNKNOWN"
    year: int = 0
    protocol: str = "Honda K-Line"
    bootloader_version: str = "UNKNOWN"
    supported_services: List[str] = field(default_factory=list)

@dataclass
class ECUCapabilities:
    """
    Module 10: Automatic Capability Detection Model
    Controls which diagnostic, live data, and tuning features are enabled in UI/Framework.
    """
    supports_live_data: bool = True
    supports_dtc: bool = True
    supports_clear_dtc: bool = True
    supports_eeprom: bool = False
    supports_flash: bool = False
    supports_bootloader: bool = False
    supports_authentication: bool = False
    supports_static_key: bool = False
    max_baudrate: int = 10400
    notes: str = ""

@dataclass
class FramePacket:
    """Raw transport frame representation."""
    header: int
    payload: bytes
    checksum: int
    raw_bytes: bytes
    timestamp: float = field(default_factory=lambda: datetime.datetime.now().timestamp())
    direction: str = "TX"  # "TX" or "RX"
    latency_ms: float = 0.0

@dataclass
class DecodedPacket:
    """
    Module 5: Decoded Protocol Packet
    Parsed representation of a raw frame for the Protocol Analyzer.
    """
    timestamp_str: str
    direction: str
    raw_hex: str
    length: int
    header_hex: str
    command_hex: str
    parameters_hex: str
    checksum_hex: str
    is_valid_checksum: bool
    meaning: str
    latency_ms: float = 0.0

@dataclass
class LiveParameter:
    """
    Module 8: Live Telemetry Parameter Definition & Reading
    Carries raw value, engineering unit conversion, min/max limits, and status.
    """
    name: str
    short_name: str
    raw_value: int
    converted_value: float
    unit: str
    min_limit: float
    max_limit: float
    description: str = ""
    status: str = "OK"  # "OK", "WARNING", "ALARM"

    def is_valid(self) -> bool:
        """Validate converted value against engineering boundaries."""
        if self.converted_value is None:
            return False
        return self.min_limit <= self.converted_value <= self.max_limit

