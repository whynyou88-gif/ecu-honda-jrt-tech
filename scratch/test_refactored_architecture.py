"""
Unit Tests for Refactored Layered ECU Protocol Architecture
Verifies safety guards, state transitions, pluggable security, and capability checks.
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))

from protocols.constants import HEADER_SECURITY_FLASH, HEADER_DIAG_READ
from protocols.models import ECUCapabilities, ECUIdentification, SecurityResult
from protocols.state_machine import ECUStateMachine, ECUState
from protocols.exceptions import (
    ProtocolMismatch,
    AuthenticationNotSupported,
    AuthenticationFailed,
    LowVoltageError,
    UnsupportedECU
)
from protocols.security import (
    LegacyStaticKeyProvider,
    SeedKeyStrategyProvider,
    SecurityProviderRegistry
)
from protocols.transport import AbstractTransport
from protocols.session import ECUSessionManager
from seed_key_provider import SeedKeyProvider


class MockTransport(AbstractTransport):
    """Mock transport layer simulating ECU serial responses."""
    def __init__(self, mode="normal"):
        self.mode = mode
        self.sent_frames = []

    def open(self):
        pass

    def close(self):
        pass

    def send_break_pulse(self):
        self.sent_frames.append(("BREAK", b"\x00"))

    def send_command(self, header, payload, debug=True, retries=1):
        frame = list(header) + list(payload)
        self.sent_frames.append(frame)

        if self.mode == "nack_passcode":
            if payload and len(payload) >= 2 and payload[0] == 0x01 and payload[1] == 0x0b:
                return [0x7E, 0x7F, 0x33] # NRC 0x33

        if self.mode == "seed_response":
            if payload and payload[0] == 0x01 and payload[1] == 0x03:
                return [0x7E, 0x01, [0xA5, 0x5A, 0x12, 0x34]] # Seed payload

        return [0x7E, 0x01, 0x00]


def run_all_tests():
    print("==================================================")
    print("🧪 RUNNING REFACTORED ARCHITECTURE UNIT TESTS")
    print("==================================================")

    # 1. Test Capabilities Model
    print("\n[TEST 1] Testing ECUCapabilities Model...")
    caps = ECUCapabilities(ecu_model="K60A-B01")
    assert caps.ecu_model == "K60A-B01"
    assert caps.supports_static_key is False
    assert caps.supports_seed_key is False
    print("  Result: PASSED ✓")

    # 2. Test State Machine Transitions
    print("\n[TEST 2] Testing ECUStateMachine Transitions...")
    sm = ECUStateMachine()
    assert sm.current_state == ECUState.DISCONNECTED
    sm.transition_to(ECUState.FAST_INIT)
    sm.transition_to(ECUState.WAKEUP)
    sm.transition_to(ECUState.IDENTIFIED)
    assert sm.current_state == ECUState.IDENTIFIED

    illegal_caught = False
    try:
        sm.transition_to(ECUState.FINISHED)
    except ProtocolMismatch:
        illegal_caught = True
    assert illegal_caught, "Illegal transition MUST raise ProtocolMismatch!"
    print("  Result: PASSED ✓")

    # 3. Test Legacy Static Key Provider Whitelist Enforcement
    print("\n[TEST 3] Testing LegacyStaticKeyProvider Whitelist Guard...")
    provider = LegacyStaticKeyProvider()
    k60a_caps = ECUCapabilities(ecu_model="K60A-B01", supports_static_key=False)
    assert provider.supports("K60A-B01", k60a_caps) is False, "LegacyStaticKeyProvider MUST NOT support K60A!"
    
    legacy_caps = ECUCapabilities(ecu_model="KZRA_LEGACY_BENCH", supports_static_key=True)
    assert provider.supports("KZRA_LEGACY_BENCH", legacy_caps) is True
    print("  Result: PASSED ✓")

    # 4. Test SeedKeyStrategyProvider Unsupported Strategy Guard
    print("\n[TEST 4] Testing SeedKeyStrategyProvider Fail-Safe Guard...")
    seed_provider = SeedKeyStrategyProvider()
    transport = MockTransport(mode="seed_response")
    assert seed_provider.supports("K60A-B01", k60a_caps) is False

    sec_res = seed_provider.authenticate(transport, "K60A-B01", k60a_caps)
    assert sec_res.success is False
    assert "AuthenticationNotSupported" in sec_res.error_message
    print("  Result: PASSED ✓")

    # 5. Test SecurityProviderRegistry Unsupported ECU Refusal
    print("\n[TEST 5] Testing SecurityProviderRegistry Refusal...")
    registry = SecurityProviderRegistry()
    sec_res = registry.authenticate_session(transport, "K60A-B01", k60a_caps)
    assert sec_res.success is False
    assert "NOT implemented or supported" in sec_res.error_message
    print("  Result: PASSED ✓")

    # 6. Test ECUSessionManager Safe Abort (No Write Command Sent)
    print("\n[TEST 6] Testing ECUSessionManager Safe Write Abort...")
    async def async_test_write():
        session_transport = MockTransport()
        session = ECUSessionManager(transport=session_transport)
        dummy_firmware = b"\xFF" * 393216

        auth_error_caught = False
        try:
            await session.execute_write_task(dummy_firmware, write_type="calibration", auto_backup=False, dry_run=False)
        except AuthenticationNotSupported as e:
            print(f"  Caught expected error: {e}")
            auth_error_caught = True

        assert auth_error_caught, "Write task MUST abort with AuthenticationNotSupported!"
        block_writes = [f for f in session_transport.sent_frames if isinstance(f, list) and len(f) > 2 and f[0:3] == [0x7E, 0x01, 0x06]]
        assert len(block_writes) == 0, "Zero flash write commands must be sent!"

    asyncio.run(async_test_write())
    print("  Result: PASSED ✓")

    print("\n==================================================")
    print("✅ ALL REFACTORED ARCHITECTURE UNIT TESTS PASSED!")
    print("==================================================")

if __name__ == '__main__':
    run_all_tests()
