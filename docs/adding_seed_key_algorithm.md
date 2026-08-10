# 📖 Guide: Registering & Verifying Seed-Key Security Algorithms

This guide documents how to register and verify new ECU Seed-Key security access algorithms in the refactored architecture.

---

## 1. Overview of Security Architecture

The software employs a pluggable, Strategy-based Security Architecture:

```
                  +-------------------------------+
                  |    ECUSessionManager          |
                  +-------------------------------+
                                  |
                                  v
                  +-------------------------------+
                  |  SecurityProviderRegistry     |
                  +-------------------------------+
                    /                           \
                   v                             v
+-------------------------------+   +-------------------------------+
|  SeedKeyStrategyProvider      |   |  LegacyStaticKeyProvider      |
|  (Dynamic Seed-Key Registry)  |   |  (Whitelisted Legacy Test ECUs)|
+-------------------------------+   +-------------------------------+
               |
               v
  seed_key_provider.py
```

### Safety Principles:
1. **No Universal Assumptions**: Static keys (e.g. `"HelloH"`) are explicitly restricted to legacy whitelist test benches and **NEVER** used as a blind default.
2. **Explicit Refusal**: If an ECU model does not have a registered, verified algorithm strategy in `seed_key_provider.py`, the system returns `AuthenticationNotSupported` and **ABORTS BEFORE** executing any sector erase or flash write commands.

---

## 2. Step-by-Step: Adding a New ECU Seed-Key Strategy

### Step 1: Capture Seed Bytes First (Diagnostic Safety Mode)
Before attempting any write operations, use the **Diagnostic Seed Capture Mode** (or `seed_key_provider.py` test harness) to verify that the ECU returns seed bytes and that your parser extracts them cleanly:

```python
from protocols.transport import KLineTransport
from protocols.session import ECUSessionManager

# 1. Initialize transport and session
transport = KLineTransport(serial_driver)
session = ECUSessionManager(transport)

# 2. Identify ECU and capture seed bytes without triggering write/erase
identification = session.identify_ecu("K60A")
print(f"Captured Seed Response: {identification.raw_response.hex().upper()}")
```

---

### Step 2: Register Strategy in `seed_key_provider.py`

Open [`seed_key_provider.py`](file:///Users/ferdyvalentino/Downloads/remap-ecu-honda-main/seed_key_provider.py) and define your verified seed-to-key function:

```python
def algo_k60a_b01(seed_bytes: bytes) -> bytes:
    """
    Seed->Key algorithm for Honda Keihin K60A-B01 (Vario 125 eSP).
    Source: Verified diagnostic protocol documentation / disassembly analysis.
    Date: YYYY-MM-DD
    """
    if len(seed_bytes) < 4:
        raise ValueError("Invalid seed byte length")
        
    # Example transformation logic (replace with verified formula):
    # s1 = (seed_bytes[0] << 8) | seed_bytes[1]
    # k1 = (s1 ^ 0xA5A5) & 0xFFFF
    # return bytes([(k1 >> 8) & 0xFF, k1 & 0xFF])
    
    # Return computed key bytes (e.g. 6 bytes or 8 bytes)
    return computed_key_bytes

# Register the strategy inside SeedKeyProvider._register_known_strategies():
class SeedKeyProvider:
    def _register_known_strategies(self):
        self._strategies["K60A-B01"] = algo_k60a_b01
        self._strategies["K60A"] = algo_k60a_b01
```

---

## 3. Verifying Strategy via Unit Tests

Run the test suite to verify that the newly registered strategy is detected:

```bash
python3 scratch/test_refactored_architecture.py
```

Expected behavior:
- `seed_key_provider.is_supported("K60A-B01")` returns `True`.
- `ECUSessionManager` advances state machine from `SESSION_READY` -> `AUTHENTICATED`.
