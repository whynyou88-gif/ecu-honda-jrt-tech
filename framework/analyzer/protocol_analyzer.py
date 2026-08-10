"""
Module 3: Real-Time Protocol Analyzer
Streams and analyzes communication packets, computes timing statistics, and formats analyzer UI tables.
"""

from typing import List, Dict, Any
from framework.core.models import FramePacket, DecodedPacket
from framework.analyzer.packet_decoder import PacketDecoder

class ProtocolAnalyzer:
    """Real-Time Packet Stream Analyzer."""

    def __init__(self, max_buffer_size: int = 1000):
        self.max_buffer_size = max_buffer_size
        self._history: List[DecodedPacket] = []
        self._total_tx = 0
        self._total_rx = 0
        self._error_count = 0
        self._latencies: List[float] = []

    def process_packet(self, packet: FramePacket) -> DecodedPacket:
        """Process incoming packet, update statistics, and append to analyzer buffer."""
        decoded = PacketDecoder.decode(packet)
        
        if packet.direction == "TX":
            self._total_tx += 1
        else:
            self._total_rx += 1

        if not decoded.is_valid_checksum or "NRC" in decoded.meaning or "Error" in decoded.meaning:
            self._error_count += 1

        if packet.latency_ms > 0:
            self._latencies.append(packet.latency_ms)

        self._history.append(decoded)
        if len(self._history) > self.max_buffer_size:
            self._history.pop(0)

        return decoded

    def get_statistics(self) -> Dict[str, Any]:
        """Compute analyzer statistics."""
        avg_latency = (sum(self._latencies) / len(self._latencies)) if self._latencies else 0.0
        return {
            "total_packets": len(self._history),
            "total_tx": self._total_tx,
            "total_rx": self._total_rx,
            "error_count": self._error_count,
            "avg_latency_ms": round(avg_latency, 2),
            "buffer_capacity": self.max_buffer_size
        }

    def get_recent_packets(self, count: int = 50) -> List[Dict[str, Any]]:
        """Get formatted packet list for UI display."""
        recent = self._history[-count:]
        return [
            {
                "timestamp": p.timestamp_str,
                "direction": p.direction,
                "raw_hex": p.raw_hex,
                "length": p.length,
                "checksum_valid": p.is_valid_checksum,
                "meaning": p.meaning,
                "latency_ms": round(p.latency_ms, 1)
            }
            for p in recent
        ]
