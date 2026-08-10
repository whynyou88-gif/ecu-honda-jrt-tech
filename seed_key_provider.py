"""
Seed-Key Provider Module — Strategy Registry for ECU Security Access
Provides a modular architecture for computing ECU-specific security unlock keys from seed bytes.
"""

from typing import Callable, Optional, Dict

class SeedKeyProvider:
    """
    Registry for seed->key algorithms per ECU model.
    Add new algorithm strategies here when reverse-engineered/verified.
    """
    
    def __init__(self):
        self._strategies: Dict[str, Callable[[bytes], bytes]] = {}
        self._register_known_strategies()
    
    def _register_known_strategies(self):
        """Register verified seed->key strategies."""
        # === SLOT UNTUK ALGORITMA YANG SUDAH TERDOKUMENTASI / DITEMUKAN ===
        # Example format when algorithm is verified:
        # self._strategies["K60A-B01"] = self._algo_k60a_b01
        pass
    
    def register_strategy(self, ecu_model: str, strategy_fn: Callable[[bytes], bytes]):
        """Dynamically register a strategy function for an ECU model."""
        self._strategies[ecu_model.upper()] = strategy_fn

    def get_key(self, ecu_model: str, seed_bytes: bytes) -> Optional[bytes]:
        """
        Return computed key bytes, or None if algorithm for this ECU model is not registered.
        Caller handles None by aborting with clear error message.
        """
        if not ecu_model:
            return None
            
        strategy = self._strategies.get(ecu_model.upper())
        if strategy is None:
            # Fallback check for prefix matching (e.g., K60A matching K60A-B01)
            for model_key, fn in self._strategies.items():
                if model_key in ecu_model.upper() or ecu_model.upper() in model_key:
                    strategy = fn
                    break

        if strategy is None:
            return None
            
        return strategy(seed_bytes)
    
    def is_supported(self, ecu_model: str) -> bool:
        """Check if an ECU model has a registered seed-key algorithm."""
        if not ecu_model:
            return False
        if ecu_model.upper() in self._strategies:
            return True
        for model_key in self._strategies.keys():
            if model_key in ecu_model.upper() or ecu_model.upper() in model_key:
                return True
        return False

    # === TEMPLATE ALGORITMA PLACEHOLDER (BELUM AKTIF / UNTUK REFERENSI DEVEL) ===
    # def _algo_k60a_b01(self, seed: bytes) -> bytes:
    #     """
    #     Seed->Key algorithm for Honda Keihin K60A-B01 (Vario 125).
    #     Source: [Disassembly / Sniffing details, Date, Verification status]
    #     """
    #     raise NotImplementedError("Algorithm for K60A-B01 is not yet reverse-engineered or verified.")


# Global instance
seed_key_provider = SeedKeyProvider()
