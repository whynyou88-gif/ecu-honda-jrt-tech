// ============================================================
// license/mod.rs — Cryptographic HWID License Verification for Tauri
// HMAC-SHA256 signed licensing module with persistent disk storage
// ============================================================

pub mod hwid;

use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::fs;
use std::path::PathBuf;

type HmacSha256 = Hmac<Sha256>;

const MASTER_LICENSE_SECRET: &[u8] = b"JRT-TECH-PRO-MASTER-SECRET-2026-NATIVE-REMAP-STUDIO";

pub struct LicenseManager;

impl LicenseManager {
    /// Generates a valid Activation Key for a given HWID
    pub fn generate_key_for_hwid(hwid: &str) -> String {
        let clean_hwid = hwid.trim().to_uppercase();
        let mut mac = HmacSha256::new_from_slice(MASTER_LICENSE_SECRET)
            .expect("HMAC secret initialization failed");
        mac.update(clean_hwid.as_bytes());
        let result = mac.finalize().into_bytes();
        let hex_str = hex::encode(result).to_uppercase();

        // Format as KEY-XXXX-XXXX-XXXX-XXXX
        format!(
            "KEY-{}-{}-{}-{}",
            &hex_str[0..4],
            &hex_str[4..8],
            &hex_str[8..12],
            &hex_str[12..16]
        )
    }

    /// Verifies if a given activation key matches the machine's HWID
    pub fn verify_key(hwid: &str, license_key: &str) -> bool {
        let expected_key = Self::generate_key_for_hwid(hwid);
        let clean_input = license_key.trim().to_uppercase();
        expected_key == clean_input
    }

    /// Checks if a valid license file exists on disk for this machine
    pub fn is_activated() -> bool {
        let current_hwid = hwid::get_machine_hwid();
        if let Ok(saved_key) = Self::load_saved_license() {
            Self::verify_key(&current_hwid, &saved_key)
        } else {
            false
        }
    }

    /// Saves activation key to disk if valid
    pub fn activate(license_key: &str) -> Result<(), String> {
        let current_hwid = hwid::get_machine_hwid();
        if Self::verify_key(&current_hwid, license_key) {
            let license_path = Self::get_license_file_path();
            if let Some(parent) = license_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            fs::write(license_path, license_key.trim().to_uppercase())
                .map_err(|e| format!("Failed to write license file: {}", e))?;
            Ok(())
        } else {
            Err("Invalid Activation Key for this machine HWID".into())
        }
    }

    /// Loads saved license key from disk
    pub fn load_saved_license() -> Result<String, String> {
        let path = Self::get_license_file_path();
        fs::read_to_string(path)
            .map(|s| s.trim().to_uppercase())
            .map_err(|e| format!("License file error: {}", e))
    }

    fn get_license_file_path() -> PathBuf {
        let mut path = if let Some(config_dir) = dirs_next::config_dir() {
            config_dir
        } else {
            PathBuf::from(".")
        };
        path.push("jrt_tech_license.lic");
        path
    }
}

mod dirs_next {
    use std::path::PathBuf;

    pub fn config_dir() -> Option<PathBuf> {
        #[cfg(target_os = "windows")]
        {
            std::env::var_os("APPDATA").map(PathBuf::from)
        }
        #[cfg(target_os = "macos")]
        {
            std::env::var_os("HOME").map(|h| PathBuf::from(h).join("Library/Application Support"))
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".config"))
        }
    }
}
