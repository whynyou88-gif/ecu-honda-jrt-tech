// ============================================================
// ecu_db/mod.rs — ECU Database & Identification Service
// ============================================================

pub mod honda_matic;

use honda_matic::get_ecm_ids_db;

pub struct EcuDatabase;

impl EcuDatabase {
    pub fn lookup_ecm_id(ecm_id: &[u8]) -> Option<String> {
        let db = get_ecm_ids_db();
        for (pattern, info) in db {
            if ecm_id.starts_with(pattern) || pattern.starts_with(ecm_id) {
                return Some(format!("{} [{}]", info.model, info.pn));
            }
        }
        None
    }
}
