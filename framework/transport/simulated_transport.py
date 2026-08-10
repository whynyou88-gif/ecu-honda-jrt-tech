"""
Module 13: Test Mode / Virtual ECU Simulator Transport
Simulates ECU hardware responses (Wake Up, ID, Live Data, DTCs) with configurable fault injection.
Useful for offline testing and developer debugging without physical ECU hardware.
"""

import time
import random
import math
from typing import Optional
from framework.transport.base import AbstractTransport
from framework.core.models import FramePacket
from framework.core.exceptions import TimeoutError, ChecksumError

class SimulatedTransport(AbstractTransport):
    """
    Virtual ECU Hardware Simulator.
    Simulates Honda Keihin K60A ECU responses and supports fault injection.
    """

    def __init__(self, ecu_model: str = "K60A-B01", simulate_delay: bool = True):
        self.ecu_model = ecu_model
        self.simulate_delay = simulate_delay
        self._is_open = False
        self.simulate_fault: Optional[str] = None  # None, "timeout", "bad_checksum", "nrc_33"
        self._sim_time_step = 0

    def open(self):
        self._is_open = True

    def close(self):
        self._is_open = False

    def is_open(self) -> bool:
        return self._is_open

    def send_break_pulse(self, duration_sec: float = 0.070):
        if self.simulate_delay:
            time.sleep(duration_sec + 0.050)

    def send_frame(self, header: int, payload: bytes, timeout_sec: float = 0.5) -> FramePacket:
        t0 = time.time()

        if self.simulate_delay:
            time.sleep(random.uniform(0.005, 0.015))

        # Fault Injection Simulation
        if self.simulate_fault == "timeout":
            raise TimeoutError("Simulated ECU hardware timeout.")

        rx_payload = b""
        rx_header = 0x7E

        # 1. ECU Identification Query: 0x72 0x71 0x00
        if header == 0x72 and payload and payload[0] == 0x71 and payload[1] == 0x00:
            rx_header = 0x72
            # Return K60A Part Number
            rx_payload = b"\x71\x00K60A-B01-11000\x00\x01\x00"

        # 2. Live Data Table 11 Query: 0x72 0x71 0x11
        elif header == 0x72 and payload and payload[0] == 0x71 and payload[1] == 0x11:
            rx_header = 0x72
            self._sim_time_step += 1
            # Dynamic simulated telemetry
            sim_rpm = int(1800 + 400 * math.sin(self._sim_time_step * 0.2))
            sim_tps = int(15 + 10 * math.cos(self._sim_time_step * 0.1))
            sim_ect = int(82 + 2 * math.sin(self._sim_time_step * 0.05))
            sim_vbat = int(124 + math.sin(self._sim_time_step * 0.3) * 2)

            rpm_bytes = [(sim_rpm >> 8) & 0xFF, sim_rpm & 0xFF]
            rx_payload = bytes([0x71, 0x11, rpm_bytes[0], rpm_bytes[1], sim_tps, sim_ect, sim_vbat] + [0x00] * 18)

        # 3. Security Access Request (Handshake Simulation)
        elif header == 0x7E:
            rx_header = 0x7E
            if payload and payload[0] == 0x01 and payload[1] == 0x0B:
                if self.simulate_fault == "nrc_33":
                    rx_header = 0x7E
                    rx_payload = b"\x7F\x33"  # NRC 0x33 Security Access Denied
                else:
                    rx_payload = b"\x01\x00"  # ACK
            else:
                rx_payload = b"\x01\x00"

        else:
            rx_header = 0x7E
            rx_payload = b"\x01\x00"

        # Checksum calculation & optional bad checksum injection
        checksum = ((sum(bytes([rx_header]) + rx_payload) ^ 0xFF) + 1) & 0xFF
        if self.simulate_fault == "bad_checksum":
            checksum = (checksum + 1) & 0xFF

        raw_rx = bytes([rx_header]) + rx_payload + bytes([checksum])
        latency = (time.time() - t0) * 1000.0

        if self.simulate_fault == "bad_checksum":
            raise ChecksumError(
                message="Simulated Checksum Failure.",
                packet=raw_rx.hex().upper(),
                expected_response=f"Checksum 0x{(checksum-1)&0xFF:02X}",
                actual_response=f"Checksum 0x{checksum:02X}",
                possible_cause="Fault injected in simulator mode.",
                recovery_suggestion="Verify line noise or resend frame."
            )

        return FramePacket(
            header=rx_header,
            payload=rx_payload,
            checksum=checksum,
            raw_bytes=raw_rx,
            direction="RX",
            latency_ms=latency
        )
