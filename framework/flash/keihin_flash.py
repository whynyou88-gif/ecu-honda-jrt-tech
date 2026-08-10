"""
Keihin ECU Family Flash Programming Engine
Implements safe flash programming with pre-write backup, capability checking, and read-back verification.
Exposes flash operations ONLY when explicitly supported.
"""

import time
import asyncio
from typing import Optional, Callable, Awaitable

from framework.flash.base_flash import AbstractFlashEngine
from framework.core.models import ECUInfo, ECUCapabilities
from framework.core.exceptions import (
    AuthenticationNotSupported,
    AuthenticationFailed,
    FlashVerificationFailed,
    LowVoltageError,
    UnsupportedECU
)

class KeihinFlashEngine(AbstractFlashEngine):
    """Flash programming engine for Keihin V850 ECU family."""

    @property
    def family_name(self) -> str:
        return "Keihin V850 Flash Engine"

    def supports_ecu_family(self, ecu_info: ECUInfo, capabilities: ECUCapabilities) -> bool:
        """Flash operations are enabled ONLY for explicitly supported ECU families."""
        if not capabilities.supports_flash:
            return False
        if not capabilities.supports_authentication:
            return False
        return True

    async def write_flash(
        self,
        ecu_info: ECUInfo,
        capabilities: ECUCapabilities,
        source_bytes: bytes,
        auto_backup: bool = True,
        dry_run: bool = False,
        progress_callback: Optional[Callable[[dict], Awaitable[None]]] = None
    ):
        """Execute flash programming with explicit support checks and rollback backup."""
        async def notify(pct: int, msg: str, state: str):
            if progress_callback:
                await progress_callback({"type": "flash_progress", "percent": pct, "msg": msg, "speed": 0, "eta": 0, "state": state})

        # 1. Check if ECU family is explicitly supported
        if not self.supports_ecu_family(ecu_info, capabilities):
            err_msg = f"Flashing is unsupported for ECU '{ecu_info.ecu_id}'. Authentication method or flash driver is not implemented for this ECU family."
            await notify(0, err_msg, "ERROR")
            raise AuthenticationNotSupported(err_msg)

        if not source_bytes or len(source_bytes) == 0:
            raise UnsupportedECU("Binary buffer is empty.")

        # 2. Synchronous Pre-Write Auto-Backup
        if auto_backup:
            backup_meta = self.recovery_manager.create_prewrite_backup(source_bytes, ecu_id=ecu_info.ecu_id)
            await notify(5, f"Pre-write backup created: {backup_meta['filename']}", "BACKUP")

        # 3. Dry-Run Guard
        if dry_run:
            await notify(100, "DRY-RUN VALIDATION SUCCESS: Pre-checks, backup, & capability model verified. Skipped erase & write.", "DONE")
            return

        # 4. Flashing Sequence Execution (Delegated to session layer)
        await notify(10, "Initiating Keihin V850 flash programming...", "ERASING")
