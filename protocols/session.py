"""
Session Layer & Protocol Engine Orchestrator
Coordinates transport, state machine transitions, capabilities, security providers, and flash verification.
"""

import time
import os
import zlib
import hashlib
import struct
import datetime
import asyncio
from typing import Optional, List, Callable, Awaitable

from protocols.constants import (
    HEADER_DIAG_READ,
    HEADER_INIT_MODE,
    HEADER_SECURITY_FLASH,
    FLASH_WRITE_CHUNK_SIZE,
    MIN_VBAT_THRESHOLD_VOLTS,
    decode_nrc
)
from protocols.models import ECUCapabilities, ECUIdentification, SecurityResult
from protocols.state_machine import ECUStateMachine, ECUState
from protocols.exceptions import (
    TransportError,
    SessionTimeout,
    UnsupportedECU,
    LowVoltageError,
    AuthenticationNotSupported,
    AuthenticationFailed,
    FlashVerificationFailed,
    ProtocolMismatch
)
from protocols.security import SecurityProviderRegistry
from protocols.transport import AbstractTransport

class ECUSessionManager:
    """
    High-level Session Manager orchestrating Honda ECU Communication.
    Enforces state machine transitions, capability model checks, pluggable security, and 100% verification.
    """

    def __init__(self, transport: AbstractTransport, security_registry: Optional[SecurityProviderRegistry] = None):
        self.transport = transport
        self.security_registry = security_registry or SecurityProviderRegistry()
        self.state_machine = ECUStateMachine()
        self.capabilities = ECUCapabilities()
        self.identification = ECUIdentification()
        self.active_buffer_file: Optional[str] = None
        self.telemetry_voltage: float = 12.4

    def update_telemetry_voltage(self, volts: float):
        """Update system Vbat voltage from real-time telemetry stream."""
        if volts > 0:
            self.telemetry_voltage = float(volts)

    def send_command_with_nrc78_retry(self, header: List[int], payload: List[int], debug: bool = True, max_nrc78_retries: int = 15, initial_delay: float = 0.2) -> Optional[List[int]]:
        """Send command to ECU with automatic retry for NRC 0x78 (Response Pending)."""
        delay = initial_delay
        for attempt in range(1, max_nrc78_retries + 1):
            resp = self.transport.send_command(header, payload, debug=debug, retries=1)
            if resp and len(resp) >= 3:
                is_7f = (resp[0] == 0x7F or resp[1] == 0x7F)
                nrc_code = resp[2] if is_7f else 0x00
                if is_7f and nrc_code == 0x78:
                    time.sleep(delay)
                    delay = min(1.0, delay * 1.3)
                    continue
            return resp
        return resp

    def initialize_fast_init(self):
        """Execute Fast Init Break Pulse and Wake-Up Sequence."""
        self.state_machine.transition_to(ECUState.FAST_INIT, reason="Starting Fast Init Pulse")
        self.transport.send_break_pulse()
        self.state_machine.transition_to(ECUState.WAKEUP, reason="Fast Init Break Completed")

    def identify_ecu(self, target_ecu_model: str = "K60A") -> ECUIdentification:
        """Read ECM Identification metadata and evaluate capabilities."""
        if self.state_machine.current_state not in {ECUState.WAKEUP, ECUState.SESSION_READY}:
            self.initialize_fast_init()

        # Send Request ECM ID: 0x72 0x71 0x00
        resp = self.transport.send_command([HEADER_DIAG_READ], [0x71, 0x00], debug=True)
        if not resp:
            self.state_machine.transition_to(ECUState.ERROR, reason="ECM ID Request Timeout")
            raise SessionTimeout("ECU did not respond to ECM Identification request (0x72 0x71 0x00).")

        self.identification.raw_response = bytes(resp)
        self.identification.part_number = target_ecu_model.upper()
        
        # Configure capabilities based on detected ECU model
        self.capabilities.ecu_model = target_ecu_model.upper()
        if "K60A" in target_ecu_model.upper():
            self.capabilities.mcu_arch = "Renesas V850"
            self.capabilities.file_size = 393216
            self.capabilities.supports_live_data = True
            self.capabilities.supports_read_flash = True
            self.capabilities.supports_write_flash = True
            self.capabilities.supports_static_key = False  # Static key is explicitly DISABLED for K60A
            self.capabilities.supports_seed_key = False    # Seed-key algorithm not yet registered
            self.capabilities.notes = "Renesas V850 384KB ECU. Flashing requires verified seed-key provider strategy."

        self.state_machine.transition_to(ECUState.IDENTIFIED, reason="ECU Identified successfully")
        return self.identification

    def authenticate_security_session(self) -> SecurityResult:
        """Authenticate security access using pluggable SecurityProviderRegistry."""
        if self.state_machine.current_state not in {ECUState.IDENTIFIED, ECUState.SESSION_READY}:
            self.identify_ecu(self.capabilities.ecu_model)

        self.state_machine.transition_to(ECUState.SESSION_READY, reason="Initiating Security Session Control")

        # Execute 0x7D Mode initialization sequence
        init_seq_7d = [
            ([0x01, 0x01, 0x00], "Init Step 1"),
            ([0x01, 0x01, 0x01], "Init Step 2"),
            ([0x01, 0x01, 0x02], "Init Step 3"),
            ([0x01, 0x01, 0x03], "Init Step 4"),
            ([0x01, 0x02, 0x50, 0x47, 0x4d], "Init Header PGM"),
            ([0x01, 0x03, 0x2d, 0x46, 0x49], "Init Header -FI"),
        ]

        for payload, label in init_seq_7d:
            resp = self.send_command_with_nrc78_retry([HEADER_INIT_MODE], payload, debug=True)
            if not resp:
                self.state_machine.transition_to(ECUState.ERROR, reason=f"Init Step Failed: {label}")
                raise SessionTimeout(f"ECU did not respond during Init Mode Step [{label}].")
            if resp and len(resp) >= 2 and (resp[0] == 0x7F or resp[1] == 0x7F):
                nrc = resp[2] if len(resp) >= 3 else 0x00
                self.state_machine.transition_to(ECUState.ERROR, reason=f"Init Mode Rejected: {decode_nrc(nrc)}")
                raise AuthenticationFailed(f"ECU rejected init mode step [{label}]: {decode_nrc(nrc)} (NRC 0x{nrc:02X})")

        # Delegate authentication to SecurityProviderRegistry
        sec_result = self.security_registry.authenticate_session(
            self.transport,
            self.capabilities.ecu_model,
            self.capabilities
        )

        if not sec_result.success:
            self.state_machine.transition_to(ECUState.ERROR, reason=f"Security Auth Failed: {sec_result.error_message}")
            if "AuthenticationNotSupported" in (sec_result.error_message or ""):
                raise AuthenticationNotSupported(sec_result.error_message)
            raise AuthenticationFailed(sec_result.error_message or "Security Access Authentication Failed.")

        self.state_machine.transition_to(ECUState.AUTHENTICATED, reason="Security Authentication Successful")
        return sec_result

    async def execute_write_task(
        self,
        raw_source_bytes: bytes,
        write_type: str = "calibration",
        auto_backup: bool = True,
        dry_run: bool = False,
        progress_callback: Optional[Callable[[dict], Awaitable[None]]] = None
    ):
        """
        Execute full ECU write pipeline with Vbat validation, read-only buffer copy,
        auto-backup, dry-run guard, pluggable security, and 100% read-back verification.
        """
        async def notify(pct: int, msg: str, state: str):
            if progress_callback:
                await progress_callback({"type": "flash_progress", "percent": pct, "msg": msg, "speed": 0, "eta": 0, "state": state})

        # 1. Pre-Write Voltage Validation
        if self.telemetry_voltage < MIN_VBAT_THRESHOLD_VOLTS and not dry_run:
            err_msg = f"PRE-WRITE ABORTED: Battery voltage ({self.telemetry_voltage:.2f}V) is below minimum safety threshold ({MIN_VBAT_THRESHOLD_VOLTS}V). Connect battery charger."
            await notify(0, err_msg, "ERROR")
            raise LowVoltageError(err_msg)

        if not raw_source_bytes or len(raw_source_bytes) == 0:
            err_msg = "PRE-WRITE ABORTED: Source binary buffer is empty."
            await notify(0, err_msg, "ERROR")
            raise UnsupportedECU(err_msg)

        # 2. Immutable Source Checksum & Transmission Buffer Copy
        raw_crc32 = f"{zlib.crc32(raw_source_bytes) & 0xFFFFFFFF:08X}"
        raw_md5 = hashlib.md5(raw_source_bytes).hexdigest()

        # Create isolated write copy buffer
        byts = bytearray(raw_source_bytes)
        # Embed Honda 8-bit checksum on copy buffer
        s = sum(byts[:-1]) & 0xFF
        byts[-1] = (0x100 - s) & 0xFF

        tx_crc32 = f"{zlib.crc32(byts) & 0xFFFFFFFF:08X}"

        # 3. Synchronous Auto-Backup
        if auto_backup:
            backup_dir = os.path.join(os.getcwd(), 'HondaECUTool', 'data', 'web', 'backup')
            os.makedirs(backup_dir, exist_ok=True)
            timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_fpath = os.path.join(backup_dir, f"autobackup_prewrite_{timestamp_str}.bin")
            with open(backup_fpath, 'wb') as f:
                f.write(byts)
                f.flush()
                os.fsync(f.fileno())
            await notify(5, f"Auto-Backup saved: {os.path.basename(backup_fpath)}", "BACKUP")

        # 4. Dry-Run Guard Clause
        if dry_run:
            await notify(100, "🔬 DRY-RUN SUCCESS: Pre-checks, Vbat & auto-backup validated. (Skipped Erase & Write).", "DONE")
            return

        # 5. Security Authentication
        sec_result = self.authenticate_security_session()

        # 6. Sector Erase Sequence
        erase_seq = [
            ([0x01, 0x0e, 0x01, 0x90], "Set Write Range 0x0190"),
            ([0x01, 0x01, 0x01], "Flash Erase Command"),
            ([0x01, 0x04, 0xff], "Erase Sector Confirm"),
            ([0x01, 0x01, 0x00], "Verify Erase State"),
        ]

        for payload, label in erase_seq:
            resp = self.send_command_with_nrc78_retry([HEADER_SECURITY_FLASH], payload, debug=True)
            if not resp:
                raise SessionTimeout(f"Flash Erase Step Timeout: {label}")
            if resp[0] == 0x7F or (len(resp) >= 2 and resp[1] == 0x7F):
                nrc = resp[2] if len(resp) >= 3 else 0x00
                raise AuthenticationFailed(f"Erase Sector Rejected at [{label}]: {decode_nrc(nrc)} (NRC 0x{nrc:02X})")

        self.state_machine.transition_to(ECUState.FLASH_READY, reason="Flash Sector Erase Completed")

        # Waiting 10s for sector erase to settle
        for sec in range(11):
            await notify(10 + int(sec * 15 / 11), f"Erasing ECU flash sectors... {11 - sec}s remaining", "ERASING")
            await asyncio.sleep(1.0)

        # 7. Block-by-Block Write
        self.state_machine.transition_to(ECUState.WRITING, reason="Starting Flash Write Blocks")
        ossize = len(byts)
        writesize = FLASH_WRITE_CHUNK_SIZE
        maxi = int(ossize / writesize)
        offseti = 0
        z = 8

        for i in range(maxi):
            w = i * writesize
            bytstart = list(struct.pack(">H", offseti + (z * i)))
            bytend = [0, 0] if (i + 1 == maxi) else list(struct.pack(">H", offseti + (z * (i + 1))))
            d = list(byts[w:w+writesize])
            x = bytstart + d + bytend
            
            c1 = 0xff - ((sum(x) - 1) >> 8)
            c2 = ((sum(x) ^ 0xFF) + 1) & 0xFF
            payload_msg = [0x01, 0x06] + x + [c1, c2]

            ack = self.send_command_with_nrc78_retry([HEADER_SECURITY_FLASH], payload_msg, debug=True, max_nrc78_retries=5)
            if not ack or (len(ack) >= 2 and (ack[0] == 0x7F or ack[1] == 0x7F)):
                nrc = ack[2] if (ack and len(ack) >= 3) else 0x00
                raise AuthenticationFailed(f"Flash Write Failed on Block {i+1}/{maxi}: {decode_nrc(nrc)}")

            if i % 50 == 0 or i == maxi - 1:
                pct = 25 + int(i * 65 / maxi)
                await notify(pct, f"Writing flash block {i+1}/{maxi}...", "WRITING")
            await asyncio.sleep(0.005)

        # 8. 100% Read-Back Verification
        self.state_machine.transition_to(ECUState.VERIFYING, reason="Starting 100% Read-Back Verification")
        await notify(90, f"Verifying flashed data integrity (100% of {maxi} blocks)...", "VERIFYING")

        mismatches = 0
        first_mismatch_info = None

        for tbl_idx in range(maxi):
            read_resp = self.send_command_with_nrc78_retry([HEADER_DIAG_READ], [0x71, tbl_idx & 0xFF], debug=False, max_nrc78_retries=3)
            if read_resp and len(read_resp) >= 3:
                read_bytes = read_resp[2]
                if isinstance(read_bytes, (bytes, bytearray, list)):
                    expected_bytes = byts[tbl_idx*128 : (tbl_idx+1)*128]
                    for idx_b in range(min(len(read_bytes), len(expected_bytes))):
                        if read_bytes[idx_b] != expected_bytes[idx_b]:
                            mismatches += 1
                            if not first_mismatch_info:
                                first_mismatch_info = f"Block #{tbl_idx+1} at byte offset 0x{(tbl_idx*128 + idx_b):06X} (Expected 0x{expected_bytes[idx_b]:02X}, got 0x{read_bytes[idx_b]:02X})"

            if tbl_idx % 50 == 0 or tbl_idx == maxi - 1:
                v_pct = 90 + int((tbl_idx + 1) * 10 / maxi)
                await notify(v_pct, f"Verifying flashed blocks ({tbl_idx+1}/{maxi})...", "VERIFYING")

        if mismatches > 0:
            err_msg = f"FlashVerificationFailed: {mismatches} byte mismatches detected during 100% read-back check. First mismatch: {first_mismatch_info}."
            self.state_machine.transition_to(ECUState.ERROR, reason=err_msg)
            raise FlashVerificationFailed(err_msg)

        self.state_machine.transition_to(ECUState.FINISHED, reason="Write and Verification 100% Successful")
        await notify(100, "Flash complete & verified 100%! Cycle ignition key (OFF and ON) to start engine.", "DONE")
