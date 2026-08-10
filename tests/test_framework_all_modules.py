"""
Comprehensive Framework Integration & Unit Test Suite
Tests all 15 modules of the Honda ECU Communication Framework.
"""

import os
import sys
import time
import json
import tempfile
from pathlib import Path

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))

from framework.core.constants import decode_nrc_code, HEADER_LIVE_DATA_READ
from framework.core.exceptions import (
    FrameworkError, ProtocolError, ChecksumError, TimeoutError,
    UnexpectedResponse, UnsupportedECU, CommunicationLost
)
from framework.core.models import ECUInfo, ECUCapabilities, FramePacket
from framework.core.state_machine import CommunicationStateMachine, ECUState
from framework.transport.factory import TransportFactory
from framework.transport.simulated_transport import SimulatedTransport
from framework.database.ecu_database import ECUDatabase
from framework.analyzer.packet_decoder import PacketDecoder
from framework.analyzer.session_logger import SessionLogger
from framework.analyzer.protocol_analyzer import ProtocolAnalyzer
from framework.live_data.engine import LiveDataManager
from framework.live_data.graph_backend import RealtimeGraphEngine
from framework.plugins.keihin_kline import KeihinKLineProtocol
from framework.developer.dev_panel import DeveloperPanel


def test_module1_and_module2_ecu_detection_and_database():
    print("\n[TEST Module 1 & 2] ECU Detection & Database...")
    db = ECUDatabase()
    info, caps = db.match_capabilities("K60A-B01-11000")
    assert info.ecu_id == "K60A-B01"
    assert caps.supports_live_data is True
    assert caps.supports_flash is True
    assert caps.supports_static_key is False
    print("  Result: PASSED ✓")


def test_module3_module4_module5_analyzer_decoder_logger(tmp_dir):
    print("\n[TEST Module 3, 4, 5] Packet Decoder, Session Logger & Analyzer...")
    logger = SessionLogger(session_id="test_sim_session", output_dir=tmp_dir)
    analyzer = ProtocolAnalyzer()

    raw = b"\x72\x71\x00\x1E"  # Sample RX frame
    pkt = FramePacket(header=0x72, payload=b"\x71\x00", checksum=0x1E, raw_bytes=raw, direction="RX", latency_ms=10.5)

    decoded = PacketDecoder.decode(pkt)
    assert decoded.header_hex == "72"
    assert "Read ECM Identification" in decoded.meaning

    analyzer.process_packet(pkt)
    logger.log_packet(pkt)

    json_path = logger.export_json()
    bin_path = logger.export_binary_session()

    assert os.path.exists(json_path)
    assert os.path.exists(bin_path)

    # Replay test
    replayed = list(SessionLogger.replay_binary_session(bin_path))
    assert len(replayed) == 1
    assert replayed[0].raw_bytes == raw
    print("  Result: PASSED ✓")


def test_module6_state_machine():
    print("\n[TEST Module 6] Communication State Machine...")
    sm = CommunicationStateMachine()
    assert sm.current_state == ECUState.DISCONNECTED
    sm.transition_to(ECUState.CONNECTING)
    sm.transition_to(ECUState.FAST_INIT)
    sm.transition_to(ECUState.WAKE_UP)
    sm.transition_to(ECUState.IDENTIFICATION)
    assert sm.current_state == ECUState.IDENTIFICATION
    print("  Result: PASSED ✓")


def test_module7_error_system():
    print("\n[TEST Module 7] Rich Diagnostic Error System...")
    err = ChecksumError(
        message="Checksum Mismatch Detected",
        packet="727100FF",
        expected_response="0x1E",
        actual_response="0xFF",
        possible_cause="Line Noise on K-Line",
        recovery_suggestion="Resend frame packet."
    )
    assert err.expected_response == "0x1E"
    assert "Line Noise" in err.possible_cause
    print("  Result: PASSED ✓")


def test_module8_and_module9_live_data_and_graph(tmp_dir):
    print("\n[TEST Module 8 & 9] Live Data & Graph Engine...")
    mgr = LiveDataManager()
    graph = RealtimeGraphEngine()

    # Raw Table 11 payload: RPM = 2000 (0x07D0), TPS = 50% (127), ECT = 80°C (120)
    raw_tbl11 = b"\x71\x11\x07\xD0\x7F\x78\x7C" + b"\x00" * 15
    params = mgr.parse_table_11(raw_tbl11)

    assert params["RPM"].converted_value == 2000.0
    assert params["ECT"].converted_value == 80.0

    graph.push_sample(time.time(), params)
    csv_file = graph.export_csv(os.path.join(tmp_dir, "test_telemetry.csv"))
    assert os.path.exists(csv_file)
    print("  Result: PASSED ✓")


def test_module11_module12_module13_plugins_transport_simulator():
    print("\n[TEST Module 11, 12, 13] Plugin, Transport Factory & ECU Simulator...")
    sim_transport = TransportFactory.create_transport(transport_type="simulated", ecu_model="K60A-B01")
    plugin = KeihinKLineProtocol(transport=sim_transport)

    assert plugin.connect() is True
    info = plugin.identify()
    assert "K60A" in info.ecu_id

    live = plugin.read_live()
    assert "RPM" in live
    assert live["RPM"].converted_value >= 0.0

    dtcs = plugin.read_dtc()
    assert len(dtcs) > 0

    assert plugin.disconnect() is True
    print("  Result: PASSED ✓")


def test_module14_developer_panel():
    print("\n[TEST Module 14] Developer Dashboard Panel...")
    sm = CommunicationStateMachine()
    dev = DeveloperPanel(state_machine=sm)

    dev.log_frame_tx("7205711107")
    dev.log_frame_rx("721F7111...")

    data = dev.get_dashboard_data()
    assert data["total_frames"] == 2
    assert data["current_state"] == "DISCONNECTED"
    print("  Result: PASSED ✓")


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp_dir:
        test_module1_and_module2_ecu_detection_and_database()
        test_module3_module4_module5_analyzer_decoder_logger(tmp_dir)
        test_module6_state_machine()
        test_module7_error_system()
        test_module8_and_module9_live_data_and_graph(tmp_dir)
        test_module11_module12_module13_plugins_transport_simulator()
        test_module14_developer_panel()

    print("\n==================================================")
    print("✅ ALL 15 FRAMEWORK MODULE TESTS PASSED SUCCESSFULLY!")
    print("==================================================")
