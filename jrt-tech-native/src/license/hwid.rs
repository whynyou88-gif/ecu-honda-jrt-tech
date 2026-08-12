// ============================================================
// license/hwid.rs — Unique Machine Hardware ID (HWID) Generator
// Generates persistent, hardware-bound HWID fingerprint for license lock
// ============================================================

use sha2::{Sha256, Digest};
use std::process::Command;

pub fn get_machine_hwid() -> String {
    let raw_hwid = get_raw_system_identifiers();
    let mut hasher = Sha256::new();
    hasher.update(raw_hwid.as_bytes());
    let hash_bytes = hasher.finalize();
    let hex_str = hex::encode(hash_bytes).to_uppercase();

    // Format as JRT-XXXX-XXXX-XXXX-XXXX
    format!(
        "JRT-{}-{}-{}-{}",
        &hex_str[0..4],
        &hex_str[4..8],
        &hex_str[8..12],
        &hex_str[12..16]
    )
}

fn get_raw_system_identifiers() -> String {
    #[cfg(target_os = "windows")]
    {
        // Try reading Windows MachineGuid from Registry first
        if let Ok(output) = Command::new("cmd")
            .args(["/C", "reg query HKLM\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Some(guid_line) = stdout.lines().find(|l| l.contains("MachineGuid")) {
                if let Some(guid) = guid_line.split_whitespace().last() {
                    if !guid.is_empty() {
                        return format!("WIN-MACHINEGUID-{}", guid);
                    }
                }
            }
        }

        // Fallback to WMIC csproduct UUID
        if let Ok(output) = Command::new("wmic")
            .args(["csproduct", "get", "UUID"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let uuid = stdout.lines().nth(1).unwrap_or("").trim();
            if !uuid.is_empty() && uuid != "UUID" {
                return format!("WIN-WMIC-UUID-{}", uuid);
            }
        }

        format!("WIN-DEFAULT-{}", std::env::var("COMPUTERNAME").unwrap_or_else(|_| "JRT-PC".into()))
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = Command::new("ioreg")
            .args(["-rd1", "-c", "IOPlatformExpertDevice"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if line.contains("IOPlatformUUID") {
                    if let Some(val) = line.split('=').nth(1) {
                        let uuid = val.trim().trim_matches('"');
                        return format!("MAC-IOUUID-{}", uuid);
                    }
                }
            }
        }
        format!("MAC-DEFAULT-{}", std::env::var("USER").unwrap_or_else(|_| "JRT-MAC".into()))
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        "GENERIC-LINUX-MACHINE".into()
    }
}
