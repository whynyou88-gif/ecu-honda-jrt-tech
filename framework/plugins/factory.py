"""
Plugin Factory Engine
Matches ECU family and firmware identification strings to registered protocol & flash plugins.
"""

from typing import Optional, Dict, Tuple
from framework.plugins.base_protocol import AbstractProtocolPlugin
from framework.plugins.keihin_kline import KeihinKLineProtocol
from framework.flash.base_flash import AbstractFlashEngine
from framework.flash.keihin_flash import KeihinFlashEngine
from framework.transport.base import AbstractTransport

class PluginFactory:
    """Factory for selecting and instantiating protocol and flash engines per ECU family."""

    @staticmethod
    def get_plugin_for_ecu(ecu_id: str, transport: AbstractTransport) -> Tuple[AbstractProtocolPlugin, AbstractFlashEngine]:
        """Return protocol plugin and flash engine matching the detected ECU ID."""
        q = ecu_id.upper()
        
        # Keihin K-Line Family (Vario, Beat, Scoopy, PCX, ADV, Stylo, Genio)
        if any(k in q for k in ["K60A", "K25", "KZRA", "K97", "K0W", "K1A", "K2F", "K3V", "K3VN", "K2S"]):
            return KeihinKLineProtocol(transport=transport), KeihinFlashEngine(transport=transport)

        # Fallback for unrecognized ECU family
        return KeihinKLineProtocol(transport=transport), KeihinFlashEngine(transport=transport)
