"""
Framework Core Constants
Centralized definitions for K-Line, KWP2000, CAN, and diagnostic service IDs.
"""

from typing import Dict

# Transport Constants
DEFAULT_KLINE_BAUDRATE = 10400
DEFAULT_CAN_BAUDRATE = 500000
FAST_INIT_LOW_SEC = 0.070   # 70ms Low break pulse
FAST_INIT_HIGH_SEC = 0.130  # 130ms High idle pulse
DEFAULT_RESPONSE_TIMEOUT_SEC = 0.5
MIN_SAFETY_BATTERY_VOLTAGE = 11.5

# K-Line Protocol Frame Headers
HEADER_LIVE_DATA_READ = 0x72
HEADER_INIT_MODE = 0x7D
HEADER_SECURITY_FLASH = 0x7E
HEADER_NRC_MARKER = 0x7F

# Service Commands
CMD_READ_ECM_ID = 0x00
CMD_READ_LIVE_TABLE = 0x11
CMD_READ_DTC = 0x02
CMD_CLEAR_DTC = 0x03
CMD_REQUEST_SEED = 0x03
CMD_SEND_SECURITY_KEY = 0x0B
CMD_FLASH_ERASE = 0x01
CMD_WRITE_BLOCK = 0x06

# Negative Response Code (NRC) Map
NRC_DESCRIPTIONS: Dict[int, str] = {
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
    0x72: "General Programming Failure",
    0x78: "Response Pending (ECU Erasing / Processing)",
}

def decode_nrc_code(code: int) -> str:
    """Return descriptive text for an NRC code."""
    return NRC_DESCRIPTIONS.get(code, f"Unknown NRC Code (0x{code:02X})")
