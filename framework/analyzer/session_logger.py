"""
Module 4: Session Logger & Replay Engine
Records full diagnostic communication sessions and exports to JSON, TXT, and Binary Session format.
Includes replay generator allowing recorded sessions to be played back offline.
"""

import os
import json
import struct
import datetime
from typing import List, Generator, Dict, Any, Optional
from framework.core.models import FramePacket, DecodedPacket
from framework.analyzer.packet_decoder import PacketDecoder

class SessionLogger:
    """Records diagnostic sessions and supports replaying packets offline."""

    def __init__(self, session_id: Optional[str] = None, output_dir: str = "logs"):
        if session_id is None:
            session_id = datetime.datetime.now().strftime("session_%Y%m%d_%H%M%S")
        self.session_id = session_id
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        self._packets: List[FramePacket] = []
        self._decoded: List[DecodedPacket] = []

    def log_packet(self, packet: FramePacket):
        """Record frame packet and auto-decode."""
        self._packets.append(packet)
        decoded = PacketDecoder.decode(packet)
        self._decoded.append(decoded)

    def export_json(self, filepath: Optional[str] = None) -> str:
        """Export session log as structured JSON."""
        if filepath is None:
            filepath = os.path.join(self.output_dir, f"{self.session_id}.json")
        data = {
            "session_id": self.session_id,
            "packet_count": len(self._decoded),
            "packets": [
                {
                    "timestamp": p.timestamp_str,
                    "direction": p.direction,
                    "raw_hex": p.raw_hex,
                    "length": p.length,
                    "header": p.header_hex,
                    "command": p.command_hex,
                    "parameters": p.parameters_hex,
                    "checksum": p.checksum_hex,
                    "checksum_valid": p.is_valid_checksum,
                    "meaning": p.meaning,
                    "latency_ms": p.latency_ms
                }
                for p in self._decoded
            ]
        }
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        return filepath

    def export_txt(self, filepath: Optional[str] = None) -> str:
        """Export session log as human-readable TXT."""
        if filepath is None:
            filepath = os.path.join(self.output_dir, f"{self.session_id}.txt")
        lines = [f"=== HONDA ECU DIAGNOSTIC SESSION LOG: {self.session_id} ===\n"]
        for p in self._decoded:
            lines.append(f"[{p.timestamp_str}] [{p.direction}] {p.raw_hex} | {p.meaning} (Latency: {p.latency_ms:.1f}ms)\n")
        with open(filepath, "w", encoding="utf-8") as f:
            f.writelines(lines)
        return filepath

    def export_binary_session(self, filepath: Optional[str] = None) -> str:
        """Export session as packed binary replay format (.binlog)."""
        if filepath is None:
            filepath = os.path.join(self.output_dir, f"{self.session_id}.binlog")
        with open(filepath, "wb") as f:
            # Header magic "HECU" + version 1
            f.write(b"HECU\x01\x00\x00\x00")
            for p in self._packets:
                dir_byte = 0x01 if p.direction == "TX" else 0x02
                raw = p.raw_bytes
                # Pack: double timestamp, float latency, byte direction, uint16 length, bytes raw
                buf = struct.pack(">dfBH", p.timestamp, p.latency_ms, dir_byte, len(raw)) + raw
                f.write(buf)
        return filepath

    @staticmethod
    def replay_binary_session(filepath: str) -> Generator[FramePacket, None, None]:
        """Replay recorded binary session file (.binlog)."""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Session binary log file '{filepath}' not found.")
        with open(filepath, "rb") as f:
            magic = f.read(8)
            if not magic.startswith(b"HECU"):
                raise ValueError("Invalid binary session log magic signature.")
            while True:
                header_buf = f.read(15)  # 8 (double) + 4 (float) + 1 (byte) + 2 (uint16)
                if not header_buf or len(header_buf) < 15:
                    break
                ts, latency, dir_b, length = struct.unpack(">dfBH", header_buf)
                raw_bytes = f.read(length)
                direction = "TX" if dir_b == 0x01 else "RX"
                hdr = raw_bytes[0] if len(raw_bytes) > 0 else 0x00
                cs = raw_bytes[-1] if len(raw_bytes) > 0 else 0x00
                payload = raw_bytes[1:-1] if len(raw_bytes) > 2 else b""
                yield FramePacket(
                    header=hdr,
                    payload=payload,
                    checksum=cs,
                    raw_bytes=raw_bytes,
                    timestamp=ts,
                    direction=direction,
                    latency_ms=latency
                )
