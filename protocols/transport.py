"""
Transport Layer for K-Line Serial Communication
Handles hardware abstraction, Fast-Init break pulses, packet formatting, and structured logging.
"""

from abc import ABC, abstractmethod
import time
import datetime
import os
import sys
from typing import Optional, List, Tuple

from protocols.constants import (
    KLINE_BAUDRATE,
    FAST_INIT_BREAK_MS,
    FAST_INIT_HIGH_MS,
    HEADER_NRC,
    decode_nrc
)
from protocols.models import FramePacket
from protocols.exceptions import TransportError, SessionTimeout

def checksum8bitHonda(data: List[int]) -> int:
    """Honda 8-bit Checksum calculation."""
    return ((sum(data) ^ 0xFF) + 1) & 0xFF

class AbstractTransport(ABC):
    """Abstract interface for K-Line transport layer."""

    @abstractmethod
    def open(self):
        pass

    @abstractmethod
    def close(self):
        pass

    @abstractmethod
    def send_break_pulse(self):
        pass

    @abstractmethod
    def send_command(self, header: List[int], payload: List[int], debug: bool = True, retries: int = 1) -> Optional[List[int]]:
        pass


class KLineTransport(AbstractTransport):
    """
    Physical K-Line transport implementation using PySerial/pylibftdi backend.
    Includes structured logging for every packet.
    """

    def __init__(self, serial_driver=None, log_dir: str = "logs"):
        self.driver = serial_driver
        self.log_dir = log_dir
        os.makedirs(self.log_dir, exist_ok=True)
        self.log_file_path = os.path.join(self.log_dir, "ecu_communication.log")

    def _log_packet(self, direction: str, raw_bytes: bytes, meaning: str = "", response_time_ms: float = 0.0):
        """Structured packet logger with timestamp, direction, hex string, parsed meaning & latency."""
        timestamp_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        hex_str = raw_bytes.hex().upper()
        meaning_str = f" | Meaning: {meaning}" if meaning else ""
        latency_str = f" | Latency: {response_time_ms:.1f}ms" if response_time_ms > 0 else ""
        
        log_line = f"[{timestamp_str}] [{direction}] {hex_str}{meaning_str}{latency_str}\n"
        
        try:
            with open(self.log_file_path, "a", encoding="utf-8") as f:
                f.write(log_line)
                f.flush()
        except Exception as e:
            sys.stderr.write(f"[LOG ERROR] Failed to write transport log: {e}\n")

    def open(self):
        if self.driver and hasattr(self.driver, 'setup'):
            self.driver.setup()

    def close(self):
        if self.driver and hasattr(self.driver, 'close'):
            self.driver.close()

    def send_break_pulse(self):
        """Send exact 70ms LOW, 130ms HIGH K-Line Fast Init pulse."""
        if self.driver and hasattr(self.driver, '_break'):
            t0 = time.time()
            self.driver._break(duration_sec=FAST_INIT_BREAK_MS)
            elapsed_ms = (time.time() - t0) * 1000.0
            self._log_packet("TX_BREAK", b"\x00", "Fast-Init Break Pulse (70ms LOW)", elapsed_ms)

    def send_command(self, header: List[int], payload: List[int], debug: bool = True, retries: int = 1) -> Optional[List[int]]:
        """Format and send command frame, logging packet structure and latency."""
        if not self.driver:
            raise TransportError("Serial transport driver is not initialized.")

        t_start = time.time()
        tx_raw = bytes(header + payload)
        
        # Parse meaning for structured logger
        meaning = f"Header=0x{header[0]:02X}, SubFunction=0x{payload[0]:02X}" if payload else f"Header=0x{header[0]:02X}"
        if header[0] == 0x7E and payload and payload[0] == 0x0B:
            meaning = "Security Key Frame (Send Passcode)"
        elif header[0] == 0x7E and payload and payload[0] == 0x03:
            meaning = "Request Seed Frame"
        elif header[0] == 0x72 and payload and payload[0] == 0x71:
            meaning = f"Read Sensor Data Table ID {payload[1] if len(payload)>1 else 0}"

        self._log_packet("TX", tx_raw, meaning)

        # Transmit via underlying hardware driver
        resp = None
        try:
            resp = self.driver.send_command(header, payload, debug=debug, retries=retries)
        except Exception as err:
            self._log_packet("ERROR", tx_raw, f"Transport Send Exception: {err}")
            raise TransportError(f"Serial transmission failed: {err}")

        t_elapsed = (time.time() - t_start) * 1000.0

        if resp:
            rx_raw = bytes(resp)
            rx_meaning = "ACK OK"
            if len(resp) >= 2 and (resp[0] == HEADER_NRC or resp[1] == HEADER_NRC):
                nrc = resp[2] if len(resp) >= 3 else 0x00
                rx_meaning = f"NRC Response: {decode_nrc(nrc)} (NRC 0x{nrc:02X})"
            self._log_packet("RX", rx_raw, rx_meaning, t_elapsed)
        else:
            self._log_packet("RX_TIMEOUT", b"", "No Response / Frame Timeout", t_elapsed)

        return resp
