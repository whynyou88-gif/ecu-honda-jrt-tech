"""
Module 12: Abstract Transport Layer
Transport interface decoupled completely from protocol parsing logic.
"""

from abc import ABC, abstractmethod
from typing import Optional, List, Callable
from framework.core.models import FramePacket

class AbstractTransport(ABC):
    """Abstract interface for all hardware and virtual transport mediums."""

    @abstractmethod
    def open(self):
        """Open physical port or initialize connection."""
        pass

    @abstractmethod
    def close(self):
        """Close connection and free resources."""
        pass

    @abstractmethod
    def is_open(self) -> bool:
        """Check connection state."""
        pass

    @abstractmethod
    def send_break_pulse(self, duration_sec: float = 0.070):
        """Transmit Fast Init break pulse."""
        pass

    @abstractmethod
    def send_frame(self, header: int, payload: bytes, timeout_sec: float = 0.5) -> FramePacket:
        """Format, calculate checksum, transmit frame, and return RX FramePacket."""
        pass
