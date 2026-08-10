# 🏛️ Professional Honda ECU Communication Framework Architecture

Version: `4.0.0`  
Compliance: ISO 14229 / ISO 14230 Layered Architecture

---

## 1. Overview of 15 Framework Modules

| Module ID | Module Name | Primary Location | Key Responsibilities |
| :--- | :--- | :--- | :--- |
| **Module 1** | ECU Detection Engine | `framework/core/models.py` | `ECUInfo` identification dataclass and detection parser. |
| **Module 2** | Local ECU Database | `framework/database/` | JSON database (`ecu_database.json`) & `ECUDatabase` auto-matcher. |
| **Module 3** | Protocol Analyzer | `framework/analyzer/protocol_analyzer.py` | Real-time packet stream analyzer with latency & error tracking. |
| **Module 4** | Session Logger | `framework/analyzer/session_logger.py` | Full session recorder with JSON, TXT, and Binary `.binlog` replay engine. |
| **Module 5** | Packet Decoder | `framework/analyzer/packet_decoder.py` | Protocol packet parser decoding raw hex to human-readable meanings. |
| **Module 6** | State Machine | `framework/core/state_machine.py` | 11-State lifecycle engine enforcing valid transitions. |
| **Module 7** | Error System | `framework/core/exceptions.py` | Rich diagnostic exceptions with packet dumps, cause, and recovery steps. |
| **Module 8** | Live Data Engine | `framework/live_data/engine.py` | Telemetry parameter converter (RPM, TPS, MAP, ECT, Vbat, Inj, Ign). |
| **Module 9** | Graph Engine | `framework/live_data/graph_backend.py` | Real-time multi-channel plotting backend with CSV export. |
| **Module 10** | ECU Capabilities | `framework/core/models.py` | `ECUCapabilities` model driving feature toggles. |
| **Module 11** | Plugin System | `framework/plugins/` | `AbstractProtocolPlugin` interface supporting Keihin K-Line & CAN. |
| **Module 12** | Transport Layer | `framework/transport/` | Decoupled transport interfaces (`SerialTransport`, `SimulatedTransport`). |
| **Module 13** | Virtual ECU Simulator | `framework/transport/simulated_transport.py` | Hardware simulator with fault injection (timeouts, bad checksums, NRCs). |
| **Module 14** | Developer Mode Panel | `framework/developer/dev_panel.py` | Statistics panel tracking TX/RX frame metrics and latency. |
| **Module 15** | Project Quality | Whole Package | Python typing, dataclasses, Enums, zero magic numbers, Factory pattern. |

---

## 2. Safety & Security Guarantees

1. **No Fabricated Security Access**:
   - The framework explicitly refuses to send hardcoded keys or guess security access routines for unsupported ECUs.
   - If an ECU model does not have a verified security provider registered, the framework returns:
     `AuthenticationNotSupported: Authentication method not implemented for this ECU.`
2. **Deterministic State Enforcement**:
   - Out-of-order execution (such as requesting sector erase before authentication) is blocked by `CommunicationStateMachine` and raises `ProtocolError`.
