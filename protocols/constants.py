"""
Protocol Constants & Protocol Code Definitions
Centralized constants for K-Line, KWP2000, and Honda PGM-FI Diagnostic Protocol.
"""

from typing import Dict

# Serial Transport & Timing Constants
KLINE_BAUDRATE = 10400
FAST_INIT_BREAK_MS = 0.070  # 70ms LOW break pulse
FAST_INIT_HIGH_MS = 0.130   # 130ms HIGH idle pulse
DEFAULT_READ_TIMEOUT_SEC = 0.5
FLASH_WRITE_CHUNK_SIZE = 128
MIN_VBAT_THRESHOLD_VOLTS = 11.5

# K-Line Frame Headers
HEADER_DIAG_READ = 0x72      # Live sensor data & table read
HEADER_INIT_MODE = 0x7D       # Mode initialization sequence
HEADER_SECURITY_FLASH = 0x7E # Session control, security access & sector write
HEADER_NRC = 0x7F            # Negative Response Marker

# Negative Response Code (NRC) Definitions
NRC_MAP: Dict[int, str] = {
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
    0x78: "Response Pending (ECU Erasing / Processing Flash)",
}

def decode_nrc(nrc_byte: int) -> str:
    """Return human-readable description for KWP2000/UDS Negative Response Code."""
    return NRC_MAP.get(nrc_byte, f"Unknown NRC Code (0x{nrc_byte:02X})")
