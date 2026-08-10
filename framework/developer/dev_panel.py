"""
Module 14: Developer Mode Panel
Tracks packet statistics, frame breakdown, memory usage, latency histogram, and state machine transitions.
"""

import sys
import time
from typing import Dict, Any
from framework.core.state_machine import CommunicationStateMachine

class DeveloperPanel:
    """Developer Debug Panel & Statistics Provider."""

    def __init__(self, state_machine: CommunicationStateMachine):
        self.state_machine = state_machine
        self.start_time = time.time()
        self.tx_count = 0
        self.rx_count = 0
        self.error_count = 0
        self.last_frame_hex = ""

    def log_frame_tx(self, frame_hex: str):
        self.tx_count += 1
        self.last_frame_hex = f"[TX] {frame_hex}"

    def log_frame_rx(self, frame_hex: str):
        self.rx_count += 1
        self.last_frame_hex = f"[RX] {frame_hex}"

    def log_error(self):
        self.error_count += 1

    def get_dashboard_data(self) -> Dict[str, Any]:
        """Return comprehensive developer statistics."""
        uptime = round(time.time() - self.start_time, 1)
        total = self.tx_count + self.rx_count
        err_rate = round((self.error_count / total * 100.0), 2) if total > 0 else 0.0

        return {
            "uptime_sec": uptime,
            "current_state": self.state_machine.current_state.name,
            "state_history": [s.name for s in self.state_machine.history],
            "total_tx": self.tx_count,
            "total_rx": self.rx_count,
            "total_frames": total,
            "error_count": self.error_count,
            "error_rate_percent": err_rate,
            "last_frame": self.last_frame_hex,
            "python_version": sys.version.split()[0]
        }
