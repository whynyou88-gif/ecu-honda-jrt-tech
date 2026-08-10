"""
Module 11: Abstract Protocol Plugin Interface
Provides unified interface for diagnostic protocol plugins (Keihin K-Line, Keihin CAN, Denso, etc.).
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any
from framework.core.models import ECUInfo, ECUCapabilities, LiveParameter
from framework.transport.base import AbstractTransport

class AbstractProtocolPlugin(ABC):
    """Abstract interface for all protocol plugins."""

    def __init__(self, transport: AbstractTransport):
        self.transport = transport

    @property
    @abstractmethod
    def protocol_name(self) -> str:
        """Return protocol plugin name."""
        pass

    @abstractmethod
    def connect(self) -> bool:
        """Establish connection and execute Fast Init / Wake Up."""
        pass

    @abstractmethod
    def identify(self) -> ECUInfo:
        """Execute ECU Identification and return ECUInfo."""
        pass

    @abstractmethod
    def read_live(self) -> Dict[str, LiveParameter]:
        """Read and parse live telemetry data parameters."""
        pass

    @abstractmethod
    def read_dtc(self) -> List[Dict[str, Any]]:
        """Read active and stored Diagnostic Trouble Codes (DTCs)."""
        pass

    @abstractmethod
    def clear_dtc(self) -> bool:
        """Clear DTC fault codes from ECU memory."""
        pass

    @abstractmethod
    def disconnect(self) -> bool:
        """Gracefully close session and disconnect."""
        pass
