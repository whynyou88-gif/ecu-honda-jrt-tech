"""
Module 8: Live Data Manager
Parses Table 11 & Table 17 telemetry frames and calculates converted engineering parameters.
"""

from typing import Dict, Any, List
from framework.core.models import LiveParameter

class LiveDataManager:
    """Telemetry Parameter Converter and Manager."""

    def __init__(self):
        self._parameters: Dict[str, LiveParameter] = self._init_default_parameters()

    def _init_default_parameters(self) -> Dict[str, LiveParameter]:
        return {
            "RPM": LiveParameter("Engine Speed", "RPM", 0, 0.0, "RPM", 0.0, 14000.0, "Engine crankshaft rotational speed"),
            "TPS": LiveParameter("Throttle Position", "TPS", 0, 0.0, "%", 0.0, 100.0, "Throttle position angle"),
            "MAP": LiveParameter("Manifold Absolute Pressure", "MAP", 0, 0.0, "kPa", 0.0, 250.0, "Intake manifold pressure"),
            "ECT": LiveParameter("Engine Coolant Temp", "ECT", 0, 0.0, "°C", -40.0, 150.0, "Engine coolant temperature"),
            "IAT": LiveParameter("Intake Air Temp", "IAT", 0, 0.0, "°C", -40.0, 100.0, "Intake air temperature"),
            "VBAT": LiveParameter("Battery Voltage", "VBAT", 0, 0.0, "V", 0.0, 20.0, "ECU input supply voltage"),
            "INJ": LiveParameter("Injector Duration", "INJ", 0, 0.0, "ms", 0.0, 30.0, "Fuel injector pulse width"),
            "IGN": LiveParameter("Ignition Advance", "IGN", 0, 0.0, "°BTDC", -10.0, 60.0, "Spark ignition advance timing"),
            "SPD": LiveParameter("Vehicle Speed", "SPD", 0, 0.0, "km/h", 0.0, 300.0, "Vehicle wheel speed"),
            "O2": LiveParameter("Oxygen Sensor", "O2", 0, 0.0, "V", 0.0, 5.0, "Lambda O2 sensor voltage"),
            "STFT": LiveParameter("Short Term Fuel Trim", "STFT", 0, 1.0, "Lambda", 0.5, 1.5, "Short term fuel adjustment factor"),
            "LTFT": LiveParameter("Long Term Fuel Trim", "LTFT", 0, 1.0, "Lambda", 0.5, 1.5, "Long term fuel adjustment factor"),
        }

    def parse_telemetry_table(self, table_id: int, raw_bytes: bytes) -> Dict[str, LiveParameter]:
        """
        Parse raw Honda PGM-FI telemetry payload into LiveParameter objects based on Table ID.
        Table 0x17/0x67 layout:
        Byte 0: VBAT (0-255 -> /10 V)
        Byte 1: TPS ADC (35-255 -> 0-100%)
        Byte 2, 3: ECT / MAP
        Byte 4, 5: MAP / IAT
        Byte 6, 7: RPM (High, Low)
        Byte 8, 9: Injector Pulse Width (High, Low)
        Byte 10: Ignition Timing Advance (0-255 -> /2 °BTDC)
        Byte 11: Vehicle Speed (km/h)
        """
        if not raw_bytes or len(raw_bytes) < 6:
            return self._parameters

        # Strip echo/table ID header if present
        payload = raw_bytes[2:] if (len(raw_bytes) > 2 and raw_bytes[0] == 0x71) else raw_bytes
        plen = len(payload)

        # VBAT (Byte 0)
        if plen >= 1:
            raw_vbat = payload[0]
            vbat_val = round(raw_vbat / 10.0, 1) if raw_vbat > 0 else 0.0
            self._parameters["VBAT"].raw_value = raw_vbat
            self._parameters["VBAT"].converted_value = vbat_val

        # TPS (Byte 1)
        if plen >= 2:
            raw_tps = payload[1]
            min_adc = 35.0
            tps_pct = max(0.0, min(100.0, ((raw_tps - min_adc) / (255.0 - min_adc)) * 100.0)) if raw_tps >= min_adc else 0.0
            self._parameters["TPS"].raw_value = raw_tps
            self._parameters["TPS"].converted_value = round(tps_pct, 1)

        # Layout detection for ECT/MAP/IAT
        b2 = payload[2] if plen > 2 else 0
        b3 = payload[3] if plen > 3 else 0
        b4 = payload[4] if plen > 4 else 0
        b5 = payload[5] if plen > 5 else 0

        ect_raw = b3 if (b2 < 70 and b3 > 70) else b2
        map_raw = b2 if (b2 < 70 and b3 > 70) else b4
        iat_raw = b5 if (b2 < 70 and b3 > 70) else b3

        ect_val = float(ect_raw - 40.0) if (10 <= ect_raw <= 220) else 0.0
        iat_val = float(iat_raw - 40.0) if (10 <= iat_raw <= 220) else 0.0

        self._parameters["ECT"].raw_value = int(ect_raw)
        self._parameters["ECT"].converted_value = round(ect_val, 1)

        self._parameters["IAT"].raw_value = int(iat_raw)
        self._parameters["IAT"].converted_value = round(iat_val, 1)

        self._parameters["MAP"].raw_value = int(map_raw)
        self._parameters["MAP"].converted_value = float(map_raw)

        # RPM (Byte 6 & 7 for 0x17/0x67)
        if plen >= 8:
            raw_rpm = (payload[6] << 8) | payload[7]
            self._parameters["RPM"].raw_value = raw_rpm
            self._parameters["RPM"].converted_value = float(raw_rpm)

        # Injector PW (Byte 8 & 9)
        if plen >= 10:
            raw_inj = (payload[8] << 8) | payload[9]
            inj_ms = round(float(raw_inj) / 256.0, 2)
            self._parameters["INJ"].raw_value = raw_inj
            self._parameters["INJ"].converted_value = inj_ms

        # Ignition Timing (Byte 10)
        if plen >= 11:
            raw_ign = payload[10]
            ign_deg = round(float(raw_ign) / 2.0, 1)
            self._parameters["IGN"].raw_value = raw_ign
            self._parameters["IGN"].converted_value = ign_deg

        # Vehicle Speed (Byte 11)
        if plen >= 12:
            raw_spd = payload[11]
            self._parameters["SPD"].raw_value = raw_spd
            self._parameters["SPD"].converted_value = float(raw_spd)

        return self._parameters

    def parse_table_11(self, raw_bytes: bytes) -> Dict[str, LiveParameter]:
        """Backward compatible wrapper calling table-based telemetry parser."""
        return self.parse_telemetry_table(0x11, raw_bytes)

    def get_all_parameters(self) -> Dict[str, LiveParameter]:
        """Return dict of all active live parameters."""
        return self._parameters

