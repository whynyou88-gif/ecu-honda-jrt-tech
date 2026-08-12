// ============================================================
// seedkey/mod.rs — Seed-Key Strategy Registry
// Placeholder provider
// ============================================================

pub mod k60a;

use std::collections::HashMap;

type SeedKeyAlgorithm = fn(&[u8]) -> Option<Vec<u8>>;

pub struct SeedKeyProvider {
    strategies: HashMap<String, SeedKeyAlgorithm>,
}

impl SeedKeyProvider {
    pub fn new() -> Self {
        SeedKeyProvider {
            strategies: HashMap::new(),
        }
    }

    pub fn get_key(&self, ecu_model: &str, seed_bytes: &[u8]) -> Option<Vec<u8>> {
        let upper = ecu_model.to_uppercase();
        if let Some(strategy) = self.strategies.get(&upper) {
            return strategy(seed_bytes);
        }
        None
    }
}

impl Default for SeedKeyProvider {
    fn default() -> Self {
        Self::new()
    }
}
