"""
Pluggable Security Provider Architecture
Defines base interfaces and providers for ECU Security Access authentication.
Never assumes static keys are universal.
"""

from abc import ABC, abstractmethod
from typing import Optional, List
import time

from protocols.models import SecurityResult, ECUCapabilities
from protocols.exceptions import AuthenticationNotSupported, AuthenticationFailed
from protocols.constants import HEADER_SECURITY_FLASH, decode_nrc
from seed_key_provider import seed_key_provider

class BaseSecurityProvider(ABC):
    """Abstract base class for ECU security authentication providers."""
    
    @abstractmethod
    def name(self) -> str:
        """Return provider name."""
        pass

    @abstractmethod
    def supports(self, ecu_model: str, capabilities: ECUCapabilities) -> bool:
        """Check if this provider supports the given ECU model and capability set."""
        pass

    @abstractmethod
    def authenticate(self, transport, ecu_model: str, capabilities: ECUCapabilities) -> SecurityResult:
        """Execute security access authentication."""
        pass


class LegacyStaticKeyProvider(BaseSecurityProvider):
    """
    Legacy provider that uses fixed static passcode ONLY for explicitly whitelisted legacy ECUs.
    NEVER used as a blind default for unknown or modern ECUs.
    """
    
    # Explicit whitelist of legacy/test ECUs known to use fixed passcode
    WHITELIST_MODELS = {"KZRA_LEGACY_BENCH", "K25_LEGACY_BENCH"}
    
    def name(self) -> str:
        return "LegacyStaticKeyProvider"

    def supports(self, ecu_model: str, capabilities: ECUCapabilities) -> bool:
        if capabilities.supports_static_key and ecu_model.upper() in self.WHITELIST_MODELS:
            return True
        return False

    def authenticate(self, transport, ecu_model: str, capabilities: ECUCapabilities) -> SecurityResult:
        if not self.supports(ecu_model, capabilities):
            return SecurityResult(
                success=False,
                provider_name=self.name(),
                error_message=f"LegacyStaticKeyProvider does NOT support ECU model {ecu_model}."
            )

        # Fixed legacy passcode bytes
        passwd = [0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x48]
        key_bytes = bytes(passwd)
        
        # Send security key command frame
        resp = transport.send_command([HEADER_SECURITY_FLASH], [0x01, 0x0b] + passwd, debug=True)
        if not resp:
            return SecurityResult(
                success=False,
                provider_name=self.name(),
                key_used=key_bytes,
                error_message="ECU did not respond to Legacy Security Key command."
            )

        if resp[0] == 0x7F or (len(resp) >= 2 and resp[1] == 0x7F):
            nrc = resp[2] if len(resp) >= 3 else 0x00
            return SecurityResult(
                success=False,
                provider_name=self.name(),
                key_used=key_bytes,
                nrc_code=nrc,
                error_message=f"Security Key Rejected: {decode_nrc(nrc)} (NRC 0x{nrc:02X})"
            )

        return SecurityResult(
            success=True,
            provider_name=self.name(),
            key_used=key_bytes
        )


class SeedKeyStrategyProvider(BaseSecurityProvider):
    """
    Dynamic Seed-Key provider that captures ECU seed bytes and computes key via SeedKeyProvider registry.
    Aborts explicitly if no verified strategy exists for the target ECU model.
    """

    def name(self) -> str:
        return "SeedKeyStrategyProvider"

    def supports(self, ecu_model: str, capabilities: ECUCapabilities) -> bool:
        return seed_key_provider.is_supported(ecu_model)

    def authenticate(self, transport, ecu_model: str, capabilities: ECUCapabilities) -> SecurityResult:
        if not self.supports(ecu_model, capabilities):
            err_msg = f"AuthenticationNotSupported: Security unlock algorithm for ECU model '{ecu_model}' is not registered in seed_key_provider.py."
            return SecurityResult(
                success=False,
                provider_name=self.name(),
                error_message=err_msg
            )

        # 1. Request Seed from ECU
        seed_resp = transport.send_command([HEADER_SECURITY_FLASH], [0x01, 0x03, 0x00, 0x00], debug=True)
        if not seed_resp:
            return SecurityResult(
                success=False,
                provider_name=self.name(),
                error_message="ECU did not respond to Request Seed command."
            )

        # Extract seed bytes if present in response
        seed_bytes = b""
        if len(seed_resp) >= 3 and isinstance(seed_resp[2], (bytes, bytearray, list)):
            seed_bytes = bytes(seed_resp[2])
        elif len(seed_resp) > 3:
            seed_bytes = bytes(seed_resp[2:])

        # 2. Compute key via SeedKeyProvider registry
        computed_key = seed_key_provider.get_key(ecu_model, seed_bytes)
        if computed_key is None:
            return SecurityResult(
                success=False,
                provider_name=self.name(),
                seed_received=seed_bytes,
                error_message=f"SeedKeyProvider returned None for ECU model '{ecu_model}'. Unlock operation aborted."
            )

        # 3. Send computed key to ECU
        key_payload = [0x01, 0x0b] + list(computed_key)
        key_resp = transport.send_command([HEADER_SECURITY_FLASH], key_payload, debug=True)
        if not key_resp:
            return SecurityResult(
                success=False,
                provider_name=self.name(),
                seed_received=seed_bytes,
                key_used=computed_key,
                error_message="ECU did not respond to Send Security Key command."
            )

        if key_resp[0] == 0x7F or (len(key_resp) >= 2 and key_resp[1] == 0x7F):
            nrc = key_resp[2] if len(key_resp) >= 3 else 0x00
            return SecurityResult(
                success=False,
                provider_name=self.name(),
                seed_received=seed_bytes,
                key_used=computed_key,
                nrc_code=nrc,
                error_message=f"Security Access Denied by ECU: {decode_nrc(nrc)} (NRC 0x{nrc:02X})"
            )

        return SecurityResult(
            success=True,
            provider_name=self.name(),
            seed_received=seed_bytes,
            key_used=computed_key
        )


class SecurityProviderRegistry:
    """Registry that manages security providers and selects appropriate authentication strategy."""

    def __init__(self):
        self._providers: List[BaseSecurityProvider] = [
            SeedKeyStrategyProvider(),
            LegacyStaticKeyProvider()
        ]

    def register_provider(self, provider: BaseSecurityProvider):
        """Add custom security provider."""
        self._providers.insert(0, provider)

    def find_provider(self, ecu_model: str, capabilities: ECUCapabilities) -> Optional[BaseSecurityProvider]:
        """Find a supporting provider for an ECU model."""
        for provider in self._providers:
            if provider.supports(ecu_model, capabilities):
                return provider
        return None

    def authenticate_session(self, transport, ecu_model: str, capabilities: ECUCapabilities) -> SecurityResult:
        """Attempt authentication using the appropriate provider, or fail safely if unsupported."""
        provider = self.find_provider(ecu_model, capabilities)
        if not provider:
            msg = f"AuthenticationNotSupported: Security unlock strategy for ECU '{ecu_model}' is NOT implemented or supported."
            return SecurityResult(
                success=False,
                provider_name="None",
                error_message=msg
            )

        return provider.authenticate(transport, ecu_model, capabilities)
