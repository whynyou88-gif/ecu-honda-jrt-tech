"""
Unit and Integration Test Suite for ECU Flash Framework & Recovery Manager
"""

import os
import sys
import tempfile
import asyncio

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))

from framework.flash.recovery import FlashRecoveryManager
from framework.flash.keihin_flash import KeihinFlashEngine
from framework.plugins.factory import PluginFactory
from framework.core.models import ECUInfo, ECUCapabilities
from framework.core.exceptions import AuthenticationNotSupported
from framework.transport.simulated_transport import SimulatedTransport

def test_flash_recovery_manager():
    print("\n[TEST Flash 1] Testing FlashRecoveryManager Auto-Backup & Listing...")
    with tempfile.TemporaryDirectory() as tmp_dir:
        rec = FlashRecoveryManager(backup_dir=tmp_dir)
        dummy_data = b"\x12\x34\x56\x78" * 100
        
        meta = rec.create_prewrite_backup(dummy_data, ecu_id="K60A")
        assert os.path.exists(meta["filepath"])
        assert meta["size_bytes"] == 400
        assert len(meta["crc32"]) == 8

        backups = rec.list_available_backups()
        assert len(backups) == 1
        assert backups[0]["filename"] == meta["filename"]

        loaded = rec.load_backup_file(meta["filepath"])
        assert loaded == dummy_data
    print("  Result: PASSED ✓")


def test_keihin_flash_engine_unsupported_ecu_guard():
    print("\n[TEST Flash 2] Testing KeihinFlashEngine Unsupported ECU Refusal Guard...")
    transport = SimulatedTransport()
    flash_engine = KeihinFlashEngine(transport=transport)

    # 1. Supported ECU check
    info_supported = ECUInfo(ecu_id="KZRA_LEGACY_BENCH")
    caps_supported = ECUCapabilities(supports_flash=True, supports_authentication=True)
    assert flash_engine.supports_ecu_family(info_supported, caps_supported) is True

    # 2. Unsupported ECU check (K60A without registered authentication strategy)
    info_unsupported = ECUInfo(ecu_id="K60A-B01")
    caps_unsupported = ECUCapabilities(supports_flash=True, supports_authentication=False)
    assert flash_engine.supports_ecu_family(info_unsupported, caps_unsupported) is False

    # 3. Attempting write on unsupported ECU MUST raise AuthenticationNotSupported
    async def run_write_test():
        caught = False
        try:
            await flash_engine.write_flash(
                info_unsupported,
                caps_unsupported,
                source_bytes=b"\xFF"*1000,
                auto_backup=True,
                dry_run=False
            )
        except AuthenticationNotSupported as e:
            print(f"  Caught expected exception: {e}")
            caught = True
        assert caught, "Attempting write on unsupported ECU MUST raise AuthenticationNotSupported!"

    asyncio.run(run_write_test())
    print("  Result: PASSED ✓")


def test_plugin_factory():
    print("\n[TEST Flash 3] Testing PluginFactory Driver Resolution...")
    transport = SimulatedTransport()
    proto, flash = PluginFactory.get_plugin_for_ecu("K60A-B01-11000", transport)
    assert proto.protocol_name == "Keihin K-Line KWP2000"
    assert flash.family_name == "Keihin V850 Flash Engine"
    print("  Result: PASSED ✓")


if __name__ == "__main__":
    test_flash_recovery_manager()
    test_keihin_flash_engine_unsupported_ecu_guard()
    test_plugin_factory()
    print("\n==================================================")
    print("✅ ALL FLASH FRAMEWORK TESTS PASSED SUCCESSFULLY!")
    print("==================================================")
