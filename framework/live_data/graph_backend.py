"""
Module 9: Real-Time Graph Engine Backend
Multi-channel circular buffer plotting backend supporting CSV export, pause, resume, and zoom windowing.
"""

import os
import csv
import datetime
from typing import Dict, List, Any, Optional
from framework.core.models import LiveParameter

class RealtimeGraphEngine:
    """Multi-channel real-time graphing data engine with history buffer."""

    def __init__(self, capacity: int = 5000):
        self.capacity = capacity
        self._is_paused = False
        self._timestamps: List[float] = []
        self._channels: Dict[str, List[float]] = {}

    def add_channel(self, channel_name: str):
        """Register a new graphing channel."""
        if channel_name not in self._channels:
            self._channels[channel_name] = []

    def pause(self):
        """Pause data acquisition."""
        self._is_paused = True

    def resume(self):
        """Resume data acquisition."""
        self._is_paused = False

    def push_sample(self, timestamp: float, parameters: Dict[str, LiveParameter]):
        """Push a synchronized multi-channel sample into circular buffer."""
        if self._is_paused:
            return

        self._timestamps.append(timestamp)
        if len(self._timestamps) > self.capacity:
            self._timestamps.pop(0)

        for key, param in parameters.items():
            if key not in self._channels:
                self._channels[key] = []
            buf = self._channels[key]
            buf.append(param.converted_value)
            if len(buf) > self.capacity:
                buf.pop(0)

    def get_window_data(self, channel: str, window_samples: int = 200) -> Dict[str, List[Any]]:
        """Get windowed time-series data for rendering graph."""
        if channel not in self._channels:
            return {"timestamps": [], "values": []}

        ts = self._timestamps[-window_samples:]
        vals = self._channels[channel][-window_samples:]
        return {"timestamps": ts, "values": vals}

    def export_csv(self, filepath: str) -> str:
        """Export history buffer to CSV file."""
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        headers = ["Timestamp"] + list(self._channels.keys())
        
        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            
            for i in range(len(self._timestamps)):
                ts_str = datetime.datetime.fromtimestamp(self._timestamps[i]).strftime("%H:%M:%S.%f")[:-3]
                row = [ts_str]
                for ch in self._channels.keys():
                    row.append(self._channels[ch][i] if i < len(self._channels[ch]) else 0.0)
                writer.writerow(row)
                
        return filepath
