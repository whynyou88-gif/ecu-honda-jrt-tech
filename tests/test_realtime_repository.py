"""
Unit & Integration Test Suite for RealtimeECUData Repository and Observer Pattern Engine
"""

import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))

from framework.live_data.repository import RealtimeECUData, realtime_ecu_repository

def test_observer_pattern_subscription_and_notification():
    print("\n[TEST Repository 1] Observer Pattern Subscription & Notification...")
    repo = RealtimeECUData()
    notification_count = [0]
    last_payload = [None]

    def observer_cb(payload):
        notification_count[0] += 1
        last_payload[0] = payload

    repo.subscribe(observer_cb)
    assert len(repo._observers) == 1

    # Simulate connection update
    repo.set_connection_status(connected=True, ecu_model="K60A-B01", port="/dev/tty.usbserial-FT123", latency_ms=8.5)
    assert notification_count[0] == 1
    assert last_payload[0]["status"]["connected"] is True
    assert last_payload[0]["status"]["ecu_model"] == "K60A-B01"

    # Simulate raw Table 11 ECU packet (RPM = 2000, TPS = 50%, ECT = 80°C, VBAT = 12.4V)
    raw_table_11 = b"\x71\x11\x07\xD0\x7F\x78\x7C" + b"\x00" * 15
    repo.update_from_ecu_frame(raw_table_11, latency_ms=7.2)

    assert notification_count[0] == 2
    telemetry = last_payload[0]["telemetry"]
    assert telemetry["RPM"] == 2000
    assert telemetry["ECT"] == 80.0
    assert telemetry["VBAT"] == 12.4

    # Unsubscribe test
    repo.unsubscribe(observer_cb)
    assert len(repo._observers) == 0
    print("  Result: PASSED ✓")


def test_zero_fake_data_on_disconnect():
    print("\n[TEST Repository 2] Zero Fake Data & Disconnect Reset...")
    repo = RealtimeECUData()
    
    # 1. Update with valid ECU telemetry first
    raw_table_11 = b"\x71\x11\x07\xD0\x7F\x78\x7C" + b"\x00" * 15
    repo.update_from_ecu_frame(raw_table_11, latency_ms=8.0)
    assert repo._telemetry["RPM"] == 2000

    # 2. Simulate cable disconnect
    repo.set_connection_status(connected=False)
    assert repo.status.connected is False
    assert repo.status.ecu_model == "NOT CONNECTED"
    assert repo.status.to_dict()["status_str"] == "ECU OFFLINE"
    assert repo._telemetry["RPM"] is None, "Telemetry values MUST be None/offline on disconnect!"
    print("  Result: PASSED ✓")


if __name__ == "__main__":
    test_observer_pattern_subscription_and_notification()
    test_zero_fake_data_on_disconnect()
    print("\n==================================================")
    print("✅ ALL REALTIME REPOSITORY TESTS PASSED SUCCESSFULLY!")
    print("==================================================")
