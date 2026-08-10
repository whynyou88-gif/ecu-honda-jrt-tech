"""
Module 2: ECU Database Engine
Loads local ECU metadata database and automatically matches detected hardware/firmware strings to capability models.
"""

import os
import json
from typing import Optional, Dict, Any, List, Tuple
from framework.core.models import ECUInfo, ECUCapabilities

class ECUDatabase:
    """Local JSON ECU Database Manager and Auto-Matcher."""

    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            db_path = os.path.join(os.path.dirname(__file__), "ecu_database.json")
        self.db_path = db_path
        self._ecus: List[Dict[str, Any]] = []
        self.load_database()

    def load_database(self):
        """Load JSON database from disk."""
        if os.path.exists(self.db_path):
            with open(self.db_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self._ecus = data.get("ecus", [])

    def find_ecu(self, query_id: str) -> Optional[Dict[str, Any]]:
        """Match detected ECU ID/firmware string against database entries."""
        if not query_id:
            return None
        q = query_id.upper()
        for ecu in self._ecus:
            ecu_id = ecu.get("ecu_id", "").upper()
            if ecu_id in q or q in ecu_id:
                return ecu
        return None

    def match_capabilities(self, detected_id: str) -> Tuple[ECUInfo, ECUCapabilities]:
        """Create matched ECUInfo and ECUCapabilities for a detected ECU ID."""
        match = self.find_ecu(detected_id)
        if match:
            info = ECUInfo(
                ecu_id=match.get("ecu_id", detected_id),
                firmware="SV850T06C121RV101",
                hardware=match.get("mcu_arch", "Renesas V850"),
                vendor=match.get("vendor", "Keihin"),
                model=match.get("model", "Honda Motorcycle"),
                year=match.get("year", 2018),
                protocol=match.get("protocol", "Honda K-Line KWP2000"),
                bootloader_version="v1.2",
                supported_services=["Read ECM ID", "Live Data", "Read DTC", "Clear DTC", "Security Access"]
            )
            caps = ECUCapabilities(
                supports_live_data=match.get("supports_live_data", True),
                supports_dtc=match.get("supports_dtc", True),
                supports_clear_dtc=match.get("supports_clear_dtc", True),
                supports_eeprom=False,
                supports_flash=match.get("supports_flash_write", False),
                supports_bootloader=False,
                supports_authentication=match.get("supports_seed_key", False),
                notes=match.get("notes", "")
            )
            return info, caps

        # Fallback default for unknown ECU
        info = ECUInfo(ecu_id=detected_id, model="Generic / Unregistered Honda ECU")
        caps = ECUCapabilities(supports_flash=False, supports_authentication=False, notes="Unknown ECU model.")
        return info, caps


class ECUIdentificationService:
    """
    Automatic ECU & Vehicle Identification Engine.
    Matches ECU ID, Part Number, and Calibration ID against the physical Honda Database.
    """

    def __init__(self, honda_db_path: Optional[str] = None):
        if honda_db_path is None:
            honda_db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "HondaECUTool", "data", "honda_ecu_db.json")
        self.honda_db_path = honda_db_path
        self._mappings: List[Dict[str, Any]] = []
        self.load_database()

    def load_database(self):
        """Load Honda ECU Vehicle database from disk."""
        if os.path.exists(self.honda_db_path):
            try:
                with open(self.honda_db_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._mappings = data.get("ecu_mappings", [])
            except Exception as e:
                print(f"[ECUIdentificationService] Warning: Failed to load {self.honda_db_path}: {e}")

    def identify_vehicle(self, ecu_id: str, part_no: Optional[str] = None, cal_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Match detected ECU parameters against vehicle database.
        Returns detailed vehicle payload or 'Unknown' default if unrecognized.
        """
        search_keys = [k for k in [part_no, cal_id, ecu_id] if k]

        for key in search_keys:
            key_upper = str(key).upper()
            for m in self._mappings:
                if (m.get("part_number", "").upper() == key_upper or
                    m.get("calibration_id", "").upper() == key_upper or
                    m.get("ecu_id_pattern", "").upper() in key_upper or
                    key_upper in m.get("ecu_id_pattern", "").upper()):

                    return {
                        "identified": True,
                        "manufacturer": "Honda",
                        "vehicle_name": m.get("vehicle_name", "Unknown"),
                        "variant": m.get("variant", "Unknown"),
                        "production_year": m.get("production_year", "Unknown"),
                        "engine_code": m.get("engine_code", "Unknown"),
                        "displacement_cc": m.get("displacement_cc", "Unknown"),
                        "engine_type": m.get("engine_type", "Unknown"),
                        "transmission": m.get("transmission", "Unknown"),
                        "fuel_system": m.get("fuel_system", "Unknown"),
                        "emission_standard": m.get("emission_standard", "Unknown"),
                        "ecu_family": m.get("ecu_family", "Keihin"),
                        "ecu_model": m.get("ecu_id_pattern", "K60A"),
                        "part_number": m.get("part_number", part_no or "Unknown"),
                        "calibration_id": m.get("calibration_id", cal_id or "Unknown"),
                        "hardware_ver": m.get("hardware_ver", "HW02"),
                        "software_ver": m.get("software_ver", "SW1.32"),
                        "boot_ver": m.get("boot_ver", "2.10"),
                        "protocol": m.get("protocol", "Honda PGM-FI"),
                        "immobilizer_support": m.get("immobilizer_support", True),
                        "svg_icon": m.get("svg_icon", "scooter")
                    }

        # Return strict 'Unknown' fallback when ECU ID cannot be matched
        return {
            "identified": False,
            "manufacturer": "Honda",
            "vehicle_name": "Unknown Vehicle",
            "variant": "Unknown",
            "production_year": "Unknown",
            "engine_code": "Unknown",
            "displacement_cc": "Unknown",
            "engine_type": "Unknown",
            "transmission": "Unknown",
            "fuel_system": "PGM-FI",
            "emission_standard": "Unknown",
            "ecu_family": "Keihin",
            "ecu_model": ecu_id or "Unknown",
            "part_number": part_no or "Unknown",
            "calibration_id": cal_id or "Unknown",
            "hardware_ver": "Unknown",
            "software_ver": "Unknown",
            "boot_ver": "Unknown",
            "protocol": "Honda PGM-FI",
            "immobilizer_support": False,
            "svg_icon": "scooter"
        }

