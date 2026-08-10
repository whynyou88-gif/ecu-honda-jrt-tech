"""
Abstract Flash Programming Engine Interface
Defines base contract for ECU family flash drivers.
"""

from abc import ABC, abstractmethod
from typing import Optional, Callable, Awaitable
from framework.core.models import ECUInfo, ECUCapabilities
from framework.transport.base import AbstractTransport
from framework.flash.recovery import FlashRecoveryManager

class AbstractFlashEngine(ABC):
    """Abstract interface for ECU family flash programming drivers."""

    def __init__(self, transport: AbstractTransport):
        self.transport = transport
        self.recovery_manager = FlashRecoveryManager()

    @property
    @abstractmethod
    def family_name(self) -> str:
        """Return target ECU family name."""
        pass

    @abstractmethod
    def supports_ecu_family(self, ecu_info: ECUInfo, capabilities: ECUCapabilities) -> bool:
        """Check if this flash engine explicitly supports the detected ECU family."""
        pass

    @abstractmethod
    async def write_flash(
        self,
        ecu_info: ECUInfo,
        capabilities: ECUCapabilities,
        source_bytes: bytes,
        auto_backup: bool = True,
        dry_run: bool = False,
        progress_callback: Optional[Callable[[dict], Awaitable[None]]] = None
    ):
        """Execute flash programming with backup, authentication, write, verification & rollback."""
        pass
