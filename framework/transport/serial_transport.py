"""
Module 12: Serial Transport Implementation
Handles physical serial port communication, FTDI auto-detection, and K-Line break pulses.
"""

import time
import sys
from typing import Optional, List
from framework.transport.base import AbstractTransport
from framework.core.models import FramePacket
from framework.core.exceptions import CommunicationLost, TimeoutError

def checksum8bit_honda(data: bytes) -> int:
    """Calculate Honda 8-bit Checksum: (sum ^ 0xFF + 1) & 0xFF."""
    return ((sum(data) ^ 0xFF) + 1) & 0xFF

class SerialTransport(AbstractTransport):
    """Physical serial & FTDI transport implementation."""

    def __init__(self, port_name: Optional[str] = None, baudrate: int = 10400, serial_driver=None):
        self.port_name = port_name
        self.baudrate = baudrate
        self.driver = serial_driver
        self._is_connected = False

    def open(self):
        if self.driver and hasattr(self.driver, 'setup'):
            self.driver.setup()
        self._is_connected = True

    def close(self):
        if self.driver and hasattr(self.driver, 'close'):
            self.driver.close()
        self._is_connected = False

    def is_open(self) -> bool:
        return self._is_connected

    def send_break_pulse(self, duration_sec: float = 0.070):
        if self.driver and hasattr(self.driver, '_break'):
            self.driver._break(duration_sec=duration_sec)

    def send_frame(self, header: int, payload: bytes, timeout_sec: float = 0.5) -> FramePacket:
        if not self.driver:
            raise CommunicationLost("Physical serial port is not opened.")

        t0 = time.time()
        raw_tx = bytes([header]) + payload
        
        try:
            resp = self.driver.send_command([header], list(payload), debug=False, retries=1)
        except Exception as e:
            raise CommunicationLost(f"Physical transport write error: {e}")

        elapsed = (time.time() - t0) * 1000.0

        if not resp:
            raise TimeoutError("ECU serial response timeout.")

        raw_rx = bytes(resp)
        rx_header = raw_rx[0] if len(raw_rx) > 0 else 0x00
        rx_checksum = raw_rx[-1] if len(raw_rx) > 0 else 0x00
        rx_payload = raw_rx[1:-1] if len(raw_rx) > 2 else b""

        return FramePacket(
            header=rx_header,
            payload=rx_payload,
            checksum=rx_checksum,
            raw_bytes=raw_rx,
            direction="RX",
            latency_ms=elapsed
        )
