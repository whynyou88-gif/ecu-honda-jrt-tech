"""
Data Models and Dataclasses for ECU Communication Engine
Provides strong typing and structured data representations.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
import datetime

@dataclass
class ECUCapabilities:
    """Explicit capabilities model for a detected ECU model/firmware."""
    protocol: str = "Honda K-Line KWP2000"
    ecu_model: str = "UNKNOWN"
    firmware_id: str = "UNKNOWN"
    mcu_arch: str = "Renesas V850"
    file_size: int = 393216
    supports_live_data: bool = True
    supports_read_flash: bool = True
    supports_write_flash: bool = False
    supports_static_key: bool = False
    supports_seed_key: bool = False
    supports_bootloader: bool = False
    notes: str = ""

@dataclass
class ECUIdentification:
    """Parsed ECU identification metadata."""
    part_number: str = ""
    firmware_id: str = ""
    checksum_md5: str = ""
    checksum_crc32: str = ""
    raw_response: bytes = b""

@dataclass
class FramePacket:
    """Structured representation of a sent or received K-Line frame."""
    header: int
    payload: bytes
    checksum: int
    raw_bytes: bytes
    timestamp: float = field(default_factory=lambda: datetime.datetime.now().timestamp())
    direction: str = "TX"  # "TX" or "RX"
    parsed_meaning: str = ""

@dataclass
class SecurityResult:
    """Result of a security access authentication attempt."""
    success: bool
    provider_name: str
    key_used: Optional[bytes] = None
    seed_received: Optional[bytes] = None
    error_message: Optional[str] = None
    nrc_code: Optional[int] = None
