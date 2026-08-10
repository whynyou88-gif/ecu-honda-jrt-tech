import os
import json
import time
from typing import Dict, Any, List
from drivers.ecu_driver_base import BaseECUDriver
from drivers.hardware_adapter import crc8_honda, checksum8bit, crc16_ccitt

class JSONPluginECUDriver(BaseECUDriver):
    def __init__(self, adapter, plugin_config: Dict[str, Any]):
        super().__init__(adapter)
        self.config = plugin_config
        self.brand = plugin_config.get("brand", "PLUGIN")
        self.model = plugin_config.get("model", "GENERIC")
        self.checksum_type = plugin_config.get("checksum_type", "crc8_honda")

    def _calc_checksum(self, data: bytes) -> int:
        if self.checksum_type == "checksum8bit":
            return checksum8bit(data)
        elif self.checksum_type == "crc16_ccitt":
            return crc16_ccitt(data)
        else:
            return crc8_honda(data)

    def connect(self) -> bool:
        if not self.adapter.open():
            return False
        init_hex = self.config.get("init_command")
        if init_hex:
            msg = bytearray(init_hex)
            msg.append(self._calc_checksum(msg))
            self.adapter.flush()
            self.adapter.write(msg)
            resp = self.adapter.read(6, timeout_sec=0.2)
            self.connected = resp is not None and len(resp) > 0
        else:
            self.connected = True
        return self.connected

    def disconnect(self):
        self.connected = False
        self.adapter.close()

    def read_id(self) -> str:
        self.ecu_id = self.config.get("ecu_id", "PLUGIN-001")
        return self.ecu_id

    def read_realtime(self) -> dict:
        tele = self.default_telemetry()
        if not self.connected:
            return tele

        cmd_hex = self.config.get("realtime_command")
        if not cmd_hex:
            return tele

        msg = bytearray(cmd_hex)
        msg.append(self._calc_checksum(msg))
        self.adapter.flush()
        self.adapter.write(msg)
        self.adapter.read(len(msg), timeout_sec=0.05) # echo
        resp = self.adapter.read(self.config.get("expected_payload_length", 16), timeout_sec=0.1)

        if resp and len(resp) >= 8:
            mapping = self.config.get("sensor_mapping", {})
            for sensor_name, cfg in mapping.items():
                offset = cfg.get("offset", 0)
                length = cfg.get("length", 1)
                scale = cfg.get("scale", 1.0)
                sub = cfg.get("subtract", 0.0)

                val = 0
                if offset + length <= len(resp):
                    if length == 1:
                        val = resp[offset]
                    elif length == 2:
                        val = (resp[offset] << 8) | resp[offset+1]

                    calc_val = (val * scale) - sub
                    tele[sensor_name] = calc_val

            tele["connected"] = True
            self.last_telemetry = tele

        return self.last_telemetry

    def read_dtc(self) -> list:
        return self.config.get("simulated_dtc", [])

    def clear_dtc(self) -> bool:
        return True


class PluginEngine:
    def __init__(self, plugin_dir="plugins"):
        self.plugin_dir = plugin_dir
        self.plugins = {}
        self.load_all_plugins()

    def load_all_plugins(self):
        self.plugins.clear()
        if not os.path.exists(self.plugin_dir):
            try:
                os.makedirs(self.plugin_dir, exist_ok=True)
            except Exception:
                pass
            return

        for fname in os.listdir(self.plugin_dir):
            if fname.endswith(".json"):
                fpath = os.path.join(self.plugin_dir, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        cfg = json.load(f)
                        plugin_name = cfg.get("name", fname.replace(".json", ""))
                        self.plugins[plugin_name] = cfg
                except Exception as e:
                    print(f"[PluginEngine] Error loading {fname}: {e}")

    def get_plugin_names(self) -> List[str]:
        return list(self.plugins.keys())

    def create_driver(self, plugin_name: str, adapter) -> BaseECUDriver:
        cfg = self.plugins.get(plugin_name)
        if not cfg:
            raise ValueError(f"Plugin '{plugin_name}' not found.")
        return JSONPluginECUDriver(adapter, cfg)
