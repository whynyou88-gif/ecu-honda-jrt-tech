"""
Factory Pattern for Transport Layer Selection
Dynamically creates SerialTransport or SimulatedTransport instances.
"""

from typing import Optional
from framework.transport.base import AbstractTransport
from framework.transport.serial_transport import SerialTransport
from framework.transport.simulated_transport import SimulatedTransport

class TransportFactory:
    """Factory for instantiating transport implementations."""

    @staticmethod
    def create_transport(
        transport_type: str = "serial",
        port_name: Optional[str] = None,
        baudrate: int = 10400,
        serial_driver=None,
        ecu_model: str = "K60A-B01"
    ) -> AbstractTransport:
        """Create and return a transport instance."""
        t_type = transport_type.lower()
        if t_type == "simulated" or t_type == "virtual" or t_type == "simulation":
            return SimulatedTransport(ecu_model=ecu_model)
        elif t_type == "serial":
            return SerialTransport(port_name=port_name, baudrate=baudrate, serial_driver=serial_driver)
        else:
            raise ValueError(f"Unknown transport type '{transport_type}'. Supported: 'serial', 'simulated'.")
