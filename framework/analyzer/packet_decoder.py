"""
Module 5: Protocol Packet Decoder
Parses raw byte frames into structured DecodedPacket objects with human-readable meanings.
"""

import datetime
from framework.core.models import FramePacket, DecodedPacket
from framework.core.constants import (
    HEADER_LIVE_DATA_READ,
    HEADER_INIT_MODE,
    HEADER_SECURITY_FLASH,
    HEADER_NRC_MARKER,
    decode_nrc_code
)

class PacketDecoder:
    """Decodes raw hex byte frames into human-readable representations."""

    @staticmethod
    def decode(packet: FramePacket) -> DecodedPacket:
        raw = packet.raw_bytes
        dt_str = datetime.datetime.fromtimestamp(packet.timestamp).strftime("%H:%M:%S.%f")[:-3]

        if not raw or len(raw) == 0:
            return DecodedPacket(
                timestamp_str=dt_str,
                direction=packet.direction,
                raw_hex="",
                length=0,
                header_hex="00",
                command_hex="00",
                parameters_hex="",
                checksum_hex="00",
                is_valid_checksum=False,
                meaning="Empty Frame",
                latency_ms=packet.latency_ms
            )

        hdr = raw[0]
        length = len(raw)
        hdr_hex = f"{hdr:02X}"
        checksum = raw[-1]
        checksum_hex = f"{checksum:02X}"

        # Honda 8-bit checksum check
        expected_cs = ((sum(raw[:-1]) ^ 0xFF) + 1) & 0xFF
        is_valid_cs = (checksum == expected_cs)

        cmd_hex = "00"
        params_hex = ""
        meaning = "Unknown Frame Structure"

        if length >= 3:
            cmd = raw[1]
            cmd_hex = f"{cmd:02X}"
            params = raw[2:-1]
            params_hex = params.hex().upper()

            # Decode Header 0x72 (Diagnostic Live Data & ID)
            if hdr == HEADER_LIVE_DATA_READ:
                if cmd == 0x71:
                    sub_id = params[0] if len(params) > 0 else 0
                    if sub_id == 0x00:
                        meaning = f"Read ECM Identification Table (ID 0x00)"
                    elif sub_id == 0x11:
                        meaning = f"Read Sensor Telemetry Data (Table 11)"
                    else:
                        meaning = f"Read Sensor Data Table (Table ID 0x{sub_id:02X})"

            # Decode Header 0x7D (Mode Initialization)
            elif hdr == HEADER_INIT_MODE:
                meaning = f"Mode Init Frame: 0x{cmd_hex} {params_hex}"

            # Decode Header 0x7E (Security & Flash Control)
            elif hdr == HEADER_SECURITY_FLASH:
                if cmd == 0x01:
                    if len(params) > 0 and params[0] == 0x03:
                        meaning = "Request Security Seed Frame (SubFunction 0x03)"
                    elif len(params) > 0 and params[0] == 0x0B:
                        meaning = f"Send Security Key Frame (SubFunction 0x0B)"
                    elif len(params) > 0 and params[0] == 0x0E:
                        meaning = f"Set Write Flash Range 0x{params[1:].hex().upper()}"
                    elif len(params) > 0 and params[0] == 0x01:
                        meaning = "Flash Sector Erase Command"
                    elif len(params) > 0 and params[0] == 0x06:
                        meaning = "Write Flash Block Data Command"
                    else:
                        meaning = f"Security Session Command 0x{cmd_hex} {params_hex}"

            # Decode Header 0x7F or Negative Response
            elif hdr == HEADER_NRC_MARKER or cmd == HEADER_NRC_MARKER:
                nrc_byte = params[0] if len(params) > 0 else (raw[2] if len(raw) > 2 else 0x00)
                meaning = f"Negative Response Marker (NRC): {decode_nrc_code(nrc_byte)} (0x{nrc_byte:02X})"

        return DecodedPacket(
            timestamp_str=dt_str,
            direction=packet.direction,
            raw_hex=raw.hex().upper(),
            length=length,
            header_hex=hdr_hex,
            command_hex=cmd_hex,
            parameters_hex=params_hex,
            checksum_hex=checksum_hex,
            is_valid_checksum=is_valid_cs,
            meaning=meaning,
            latency_ms=packet.latency_ms
        )
