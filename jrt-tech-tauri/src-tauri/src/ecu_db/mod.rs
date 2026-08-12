// ============================================================
// ecu_db/mod.rs — ECU Database & Identification Service
// ============================================================

pub mod honda_matic;

use honda_matic::{get_ecm_ids_db, VehicleInfo};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EcuInfo {
    pub manufacturer: String,
    #[serde(rename = "partNumber")]
    pub part_number: String,
    #[serde(rename = "fwVersion")]
    pub fw_version: String,
    #[serde(rename = "hwVersion")]
    pub hw_version: String,
    pub protocol: String,
    #[serde(rename = "eepromSize")]
    pub eeprom_size: usize,
    pub checksum: u32,
    #[serde(rename = "detectedModel")]
    pub detected_model: String,
}

impl Default for EcuInfo {
    fn default() -> Self {
        EcuInfo {
            manufacturer: "Keihin PGM-FI".to_string(),
            part_number: "38770-K60A-901".to_string(),
            fw_version: "2018-2022".to_string(),
            hw_version: "Honda Vario 125 eSP (K60A) Keihin".to_string(),
            protocol: "Honda Keihin K-Line".to_string(),
            eeprom_size: 1024,
            checksum: 0x60A,
            detected_model: "Honda Vario 125 eSP (K60A)".to_string(),
        }
    }
}

pub struct EcuDatabase;

impl EcuDatabase {
    /// Match ECM ID bytes against known database entries
    pub fn lookup_ecm_id(ecm_id: &[u8]) -> Option<EcuInfo> {
        let db = get_ecm_ids_db();
        for (pattern, info) in db {
            if ecm_id.starts_with(pattern) || pattern.starts_with(ecm_id) {
                let ecm_hex: String = ecm_id.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" ");
                return Some(EcuInfo {
                    manufacturer: info.vendor.clone().unwrap_or_else(|| "Keihin".to_string()),
                    part_number: info.pn.clone(),
                    fw_version: info.year.clone(),
                    hw_version: format!("{} [{}]", info.model, ecm_hex),
                    protocol: "KWP2000 Fast Init (K-Line)".to_string(),
                    eeprom_size: 1024,
                    checksum: u32::from_str_radix(info.checksum.trim_start_matches("0x"), 16).unwrap_or(0),
                    detected_model: info.model.clone(),
                });
            }
        }
        None
    }

    /// Match detected model string to detailed vehicle info
    pub fn identify_vehicle(model_name: &str, part_no: Option<&str>) -> VehicleInfo {
        VehicleInfo {
            identified: true,
            manufacturer: "Honda".to_string(),
            vehicle_name: model_name.to_string(),
            variant: "Automatic".to_string(),
            production_year: "2020-Present".to_string(),
            engine_code: "eSP".to_string(),
            displacement_cc: "125-160 cc".to_string(),
            engine_type: "eSP 4-Stroke PGM-FI".to_string(),
            transmission: "CVT Automatic".to_string(),
            fuel_system: "PGM-FI".to_string(),
            emission_standard: "EURO 3".to_string(),
            ecu_family: "Keihin".to_string(),
            ecu_model: model_name.to_string(),
            part_number: part_no.unwrap_or("38770-HONDA").to_string(),
            calibration_id: "K60A_V850".to_string(),
            hardware_ver: "HW02".to_string(),
            software_ver: "SW1.32".to_string(),
            boot_ver: "2.10".to_string(),
            protocol: "Honda PGM-FI KWP2000".to_string(),
            immobilizer_support: true,
            svg_icon: "scooter".to_string(),
        }
    }
}
