import os
import sys
import time
import queue
import threading
import glob
from typing import Optional, List, Dict, Any, Tuple
from abc import ABC, abstractmethod

# Try importing pyserial
try:
    import serial
    import serial.tools.list_ports
    HAS_PYSERIAL = True
except ImportError:
    HAS_PYSERIAL = False

# Try importing pylibftdi
HAS_PYLIBFTDI = False
try:
    if sys.platform == 'darwin':
        import pylibftdi.driver
        for lib_name, search_names in [("libftdi", ["libftdi1.dylib", "libftdi.dylib"]), 
                                       ("libusb", ["libusb-1.0.dylib"])]:
            paths_to_add = []
            for base_path in ['/opt/homebrew/lib', '/usr/local/lib']:
                for s_name in search_names:
                    full_p = os.path.join(base_path, s_name)
                    if os.path.exists(full_p):
                        paths_to_add.append(full_p)
            if paths_to_add:
                pylibftdi.driver.Driver._lib_search[lib_name] = paths_to_add + pylibftdi.driver.Driver._lib_search[lib_name]
    from pylibftdi import Device, FtdiError
    HAS_PYLIBFTDI = True
except Exception:
    HAS_PYLIBFTDI = False

# ============================================================
# CRC & CHECKSUM UTILITIES
# ============================================================
def crc8_honda(data: bytes) -> int:
    """Standard Honda PGM-FI 8-bit checksum: 0xFF - (sum & 0xFF) + 1"""
    return ((sum(bytearray(data)) ^ 0xFF) + 1) & 0xFF

def checksum8bit(data: bytes) -> int:
    """Standard 8-bit sum modulo 256"""
    return sum(bytearray(data)) & 0xFF

def crc16_ccitt(data: bytes, poly=0x1021, init=0xFFFF) -> int:
    """CRC16-CCITT implementation for automotive CAN/K-Line protocols"""
    crc = init
    for byte in data:
        crc ^= (byte << 8)
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ poly) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return crc

# ============================================================
# HARDWARE COMMUNICATION STATS
# ============================================================
class ConnectionHealthStats:
    def __init__(self):
        self.connected = False
        self.port_name = "None"
        self.baudrate = 10400
        self.packets_tx = 0
        self.packets_rx = 0
        self.bytes_tx = 0
        self.bytes_rx = 0
        self.packet_loss_count = 0
        self.crc_errors = 0
        self.last_latency_ms = 0.0
        self.sample_rate_hz = 0.0
        self.last_packet_time = time.time()
        self._samples_window = []

    def record_packet(self, tx_bytes: int, rx_bytes: int, latency_ms: float, success: bool = True):
        now = time.time()
        self.packets_tx += 1
        self.bytes_tx += tx_bytes

        if success:
            self.packets_rx += 1
            self.bytes_rx += rx_bytes
            self.last_latency_ms = round(latency_ms, 2)
            self.last_packet_time = now
            self._samples_window.append(now)
            
            # Prune samples older than 1 second to calculate true Hz
            self._samples_window = [t for t in self._samples_window if now - t <= 1.0]
            self.sample_rate_hz = round(len(self._samples_window), 1)
        else:
            self.packet_loss_count += 1

    def to_dict(self):
        return {
            "connected": self.connected,
            "port": self.port_name,
            "baudrate": self.baudrate,
            "packets_tx": self.packets_tx,
            "packets_rx": self.packets_rx,
            "bytes_tx": self.bytes_tx,
            "bytes_rx": self.bytes_rx,
            "packet_loss_count": self.packet_loss_count,
            "crc_errors": self.crc_errors,
            "latency_ms": self.last_latency_ms,
            "sample_rate_hz": self.sample_rate_hz,
            "last_active_sec": round(time.time() - self.last_packet_time, 1)
        }

# ============================================================
# ABSTRACT SERIAL ADAPTER
# ============================================================
class BaseSerialAdapter(ABC):
    def __init__(self, port_identifier, baudrate=10400, timeout=0.2):
        self.port_identifier = port_identifier
        self.baudrate = baudrate
        self.timeout = timeout
        self.stats = ConnectionHealthStats()
        self.stats.port_name = str(port_identifier)
        self.stats.baudrate = baudrate
        self.rx_queue = queue.Queue(maxsize=1000)
        self.tx_queue = queue.Queue(maxsize=1000)
        self.is_open = False

    @abstractmethod
    def open(self) -> bool:
        pass

    @abstractmethod
    def close(self):
        pass

    @abstractmethod
    def write(self, data: bytes) -> int:
        pass

    @abstractmethod
    def read(self, length: int, timeout_sec: float = None) -> bytes:
        pass

    @abstractmethod
    def flush(self):
        pass

# ============================================================
# CONCRETE ADAPTER 1: STANDARD SERIAL (pyserial for CH340, CP2102, ST-Link, Bluetooth SPP)
# ============================================================
class StandardSerialAdapter(BaseSerialAdapter):
    def __init__(self, port_identifier, baudrate=10400, timeout=0.2):
        super().__init__(port_identifier, baudrate, timeout)
        self.ser = None

    def open(self) -> bool:
        if not HAS_PYSERIAL:
            return False
        try:
            self.ser = serial.Serial(
                port=self.port_identifier,
                baudrate=self.baudrate,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
                timeout=self.timeout,
                write_timeout=self.timeout
            )
            self.is_open = True
            self.stats.connected = True
            return True
        except Exception:
            self.is_open = False
            self.stats.connected = False
            return False

    def close(self):
        if self.ser and self.ser.is_open:
            try:
                self.ser.close()
            except Exception:
                pass
        self.is_open = False
        self.stats.connected = False
        self.ser = None

    def write(self, data: bytes) -> int:
        if not self.ser or not self.ser.is_open:
            return 0
        try:
            n = self.ser.write(data)
            self.ser.flush()
            return n
        except Exception:
            return 0

    def read(self, length: int, timeout_sec: float = None) -> bytes:
        if not self.ser or not self.ser.is_open:
            return b""
        if timeout_sec is not None:
            self.ser.timeout = timeout_sec
        try:
            return self.ser.read(length)
        except Exception:
            return b""

    def flush(self):
        if self.ser and self.ser.is_open:
            try:
                self.ser.reset_input_buffer()
                self.ser.reset_output_buffer()
            except Exception:
                pass

# ============================================================
# CONCRETE ADAPTER 2: FTDI DIRECT ADAPTER (pylibftdi for D2XX native chips)
# ============================================================
class FTDIDirectAdapter(BaseSerialAdapter):
    def __init__(self, device_id=None, baudrate=10400, timeout=0.2):
        super().__init__(device_id or "FTDI_DEFAULT", baudrate, timeout)
        self.device_id = device_id
        self.dev = None

    def open(self) -> bool:
        if not HAS_PYLIBFTDI:
            return False
        try:
            self.dev = Device(self.device_id)
            self.dev.baudrate = self.baudrate
            self.dev.ftdi_fn.ftdi_set_line_property(8, 1, 0)
            try:
                self.dev.ftdi_fn.ftdi_set_latency_timer(2)
                self.dev.ftdi_fn.ftdi_setdtr(0)
                self.dev.ftdi_fn.ftdi_setrts(0)
                self.dev.ftdi_fn.ftdi_setflowctrl(0)
            except Exception:
                pass
            self.is_open = True
            self.stats.connected = True
            return True
        except Exception:
            self.is_open = False
            self.stats.connected = False
            self.dev = None
            return False

    def close(self):
        if self.dev:
            try:
                self.dev.close()
            except Exception:
                pass
        self.is_open = False
        self.stats.connected = False
        self.dev = None

    def write(self, data: bytes) -> int:
        if not self.dev:
            return 0
        try:
            self.dev._write(data)
            return len(data)
        except Exception:
            return 0

    def read(self, length: int, timeout_sec: float = None) -> bytes:
        if not self.dev:
            return b""
        to = timeout_sec or self.timeout
        start = time.time()
        buf = bytearray()
        while len(buf) < length:
            tmp = self.dev._read(length - len(buf))
            if tmp:
                buf.extend(tmp)
            if time.time() - start > to:
                break
        return bytes(buf)

    def flush(self):
        if self.dev:
            try:
                self.dev.flush()
            except Exception:
                pass

# ============================================================
# HARDWARE MANAGER: AUTOMATIC COM PORT DETECTOR & FACTORY
# ============================================================
class HardwareManager:
    @staticmethod
    def list_available_ports():
        ports = []
        
        # 1. Check FTDI D2XX Devices (Skip on macOS to prevent detaching AppleUSBFTDI VCP driver)
        if HAS_PYLIBFTDI and sys.platform != 'darwin':
            try:
                from pylibftdi import Driver
                ftdi_devs = Driver().list_devices()
                for dev in ftdi_devs:
                    vendor, model, serial_num = dev
                    ports.append({
                        "name": f"FTDI Direct ({serial_num or 'FT232R'})",
                        "type": "FTDI_D2XX",
                        "id": serial_num or None,
                        "description": f"FTDI Direct D2XX USB Interface ({model})"
                    })
            except Exception:
                pass

        # 2. Check Standard Virtual COM Ports (CH340, CP2102, ST-Link, Bluetooth, FTDI VCP)
        if HAS_PYSERIAL:
            try:
                com_ports = serial.tools.list_ports.comports()
                for p in com_ports:
                    port_type = "USB_SERIAL"
                    desc = p.description or ""
                    if "CH340" in desc.upper() or "CH341" in desc.upper():
                        port_type = "CH340"
                    elif "CP210" in desc.upper() or "SILICON LABS" in desc.upper():
                        port_type = "CP2102"
                    elif "STLINK" in desc.upper() or "STM" in desc.upper():
                        port_type = "STLINK"
                    elif "BLUETOOTH" in desc.upper() or "BTHENUM" in desc.upper():
                        port_type = "BLUETOOTH_SPP"
                    elif "FTDI" in desc.upper():
                        port_type = "FTDI_VCP"

                    ports.append({
                        "name": p.device,
                        "type": port_type,
                        "id": p.device,
                        "description": f"{p.device} - {desc} ({p.hwid})"
                    })
            except Exception:
                pass

        # 3. Unix OS Path Fallbacks (/dev/tty.usb*, /dev/ttyUSB*)
        if sys.platform != 'win32':
            os_patterns = ['/dev/tty.usbserial*', '/dev/tty.usbmodem*', '/dev/ttyUSB*', '/dev/ttyACM*']
            existing_ids = set(p['id'] for p in ports)
            for pat in os_patterns:
                for match in glob.glob(pat):
                    if match not in existing_ids:
                        ports.append({
                            "name": match,
                            "type": "USB_SERIAL",
                            "id": match,
                            "description": f"Serial Device ({match})"
                        })

        return ports

    @staticmethod
    def create_adapter(port_info, baudrate=10400) -> BaseSerialAdapter:
        if isinstance(port_info, dict):
            port_type = port_info.get("type")
            port_id = port_info.get("id")
        else:
            port_type = "USB_SERIAL"
            port_id = str(port_info)

        if port_type == "FTDI_D2XX" and HAS_PYLIBFTDI:
            return FTDIDirectAdapter(device_id=port_id, baudrate=baudrate)
        else:
            return StandardSerialAdapter(port_identifier=port_id, baudrate=baudrate)


# ============================================================
# FTDI AUTO-CONNECTOR & HEALTH RECOVERY MANAGER
# ============================================================
class FTDIAutoConnector:
    """
    Robust Auto-Connector and Health Manager for Physical FTDI USB-to-K-Line Cables.
    Supports auto-detection, auto-reconnection on cable disconnects, and packet retry.
    """

    def __init__(self, target_baudrate: int = 10400, auto_reconnect: bool = True):
        self.target_baudrate = target_baudrate
        self.auto_reconnect = auto_reconnect
        self.adapter: Optional[BaseSerialAdapter] = None
        self._lock = threading.Lock()
        self.last_connected_port: Optional[str] = None

    def auto_connect(self) -> Optional[BaseSerialAdapter]:
        """Scan and automatically connect to available FTDI USB serial interface."""
        with self._lock:
            if self.adapter and self.adapter.is_open:
                return self.adapter

            ports = HardwareManager.list_available_ports()
            if not ports:
                return None

            # Prioritize FTDI interfaces (D2XX or FTDI VCP)
            ftdi_ports = [p for p in ports if "FTDI" in p.get("type", "") or "FTDI" in p.get("name", "").upper() or "usbserial" in p.get("id", "").lower()]
            candidate_ports = ftdi_ports if ftdi_ports else ports

            for p_info in candidate_ports:
                try:
                    ad = HardwareManager.create_adapter(p_info, baudrate=self.target_baudrate)
                    if ad.open():
                        self.adapter = ad
                        self.last_connected_port = str(p_info.get("id"))
                        return self.adapter
                except Exception:
                    continue

            return None

    def get_adapter(self) -> Optional[BaseSerialAdapter]:
        """Return active connected adapter or auto-reconnect if connection was dropped."""
        if self.adapter and self.adapter.is_open:
            return self.adapter
        if self.auto_reconnect:
            return self.auto_connect()
        return None

    def close(self):
        """Close physical adapter connection."""
        with self._lock:
            if self.adapter:
                self.adapter.close()
                self.adapter = None

