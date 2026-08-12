// ============================================================
// seedkey/mod.rs — Seed-Key Security Access Provider
// Port of seed_key_provider.py — Strategy Registry Pattern
// NO ALGORITHMS IMPLEMENTED — placeholder only
// ============================================================

pub mod k60a;

use std::collections::HashMap;

/// Type alias for seed-key algorithm function
type SeedKeyAlgorithm = fn(&[u8]) -> Option<Vec<u8>>;

/// Registry for seed→key algorithms per ECU model
pub struct SeedKeyProvider {
    strategies: HashMap<String, SeedKeyAlgorithm>,
}

impl SeedKeyProvider {
    pub fn new() -> Self {
        let mut provider = SeedKeyProvider {
            strategies: HashMap::new(),
        };
        provider.register_known_strategies();
        provider
    }

    /// Register verified seed→key strategies
    /// === SLOT UNTUK ALGORITMA YANG SUDAH TERDOKUMENTASI / DITEMUKAN ===
    fn register_known_strategies(&mut self) {
        // Example format when algorithm is verified:
        // self.strategies.insert("K60A-B01".to_string(), k60a::algo_k60a_b01);
        //
        // Currently NO algorithms are registered — all return None
    }

    /// Dynamically register a strategy function for an ECU model
    pub fn register_strategy(&mut self, ecu_model: &str, strategy: SeedKeyAlgorithm) {
        self.strategies.insert(ecu_model.to_uppercase(), strategy);
    }

    /// Compute key bytes from seed, or None if algorithm is not registered
    pub fn get_key(&self, ecu_model: &str, seed_bytes: &[u8]) -> Option<Vec<u8>> {
        if ecu_model.is_empty() {
            return None;
        }

        let upper = ecu_model.to_uppercase();

        // Direct match
        if let Some(strategy) = self.strategies.get(&upper) {
            return strategy(seed_bytes);
        }

        // Prefix/substring matching
        for (model_key, strategy) in &self.strategies {
            if model_key.contains(&upper) || upper.contains(model_key.as_str()) {
                return strategy(seed_bytes);
            }
        }

        None
    }

    /// Check if an ECU model has a registered seed-key algorithm
    pub fn is_supported(&self, ecu_model: &str) -> bool {
        if ecu_model.is_empty() {
            return false;
        }
        let upper = ecu_model.to_uppercase();

        if self.strategies.contains_key(&upper) {
            return true;
        }
        for key in self.strategies.keys() {
            if key.contains(&upper) || upper.contains(key.as_str()) {
                return true;
            }
        }
        false
    }
}

impl Default for SeedKeyProvider {
    fn default() -> Self {
        Self::new()
    }
}
