# 🚀 Guide: Extending Framework to New ECU Families (CAN Bus / Denso / Shindengen)

This guide documents how to extend the framework to support new ECU families and protocols.

---

## 1. Adding a New Protocol Plugin

To add support for a new ECU protocol (e.g., `KeihinCANProtocol` or `DensoKLineProtocol`), create a new plugin module under `framework/plugins/`:

```python
from framework.plugins.base_protocol import AbstractProtocolPlugin
from framework.core.models import ECUInfo, LiveParameter

class KeihinCANProtocol(AbstractProtocolPlugin):
    @property
    def protocol_name(self) -> str:
        return "Keihin ISO 15765 CAN"

    def connect(self) -> bool:
        self.transport.open()
        return True

    def identify(self) -> ECUInfo:
        # Transmit 29-bit CAN ID query
        pkt = self.transport.send_frame(0x18DA10F1, b"\x02\x10\x03")
        return ECUInfo(ecu_id="CAN-KEIHIN-01", protocol=self.protocol_name)

    def read_live(self) -> Dict[str, LiveParameter]:
        # Implement CAN PID polling
        pass
```

---

## 2. Registering New ECU Models in `ecu_database.json`

Add new ECU part numbers to [`framework/database/ecu_database.json`](file:///Users/ferdyvalentino/Downloads/remap-ecu-honda-main/framework/database/ecu_database.json):

```json
{
  "ecu_id": "38770-K25-901",
  "model": "Honda BeAT FI",
  "year": 2015,
  "vendor": "Keihin",
  "mcu_arch": "Renesas V850",
  "file_size": 393216,
  "protocol": "Honda K-Line KWP2000",
  "supports_live_data": true,
  "supports_dtc": true,
  "supports_clear_dtc": true,
  "supports_flash_read": true,
  "supports_flash_write": true,
  "supports_static_key": false,
  "supports_seed_key": true
}
```

---

## 3. Testing with ECU Hardware Simulator First

Always verify new plugins using `SimulatedTransport`:

```python
from framework.transport.factory import TransportFactory
from framework.plugins.keihin_kline import KeihinKLineProtocol

sim_transport = TransportFactory.create_transport("simulated", ecu_model="38770-K25-901")
plugin = KeihinKLineProtocol(transport=sim_transport)

assert plugin.connect() is True
print("Plugin verified with Virtual ECU Simulator!")
```
