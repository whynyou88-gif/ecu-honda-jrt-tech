// ============================================================
// flash/safety_guard.rs — Flash Safety Guards
// These checks protect the physical ECU from damage
// DO NOT simplify or remove any check
// ============================================================

use super::{FlashProgress, FlashState, MIN_VBAT_FOR_FLASH};
use log::{info, error};
use std::io::Write;

/// Check battery voltage is above minimum threshold for flash operations
pub fn check_battery_voltage(vbat_volts: f64) -> Result<(), String> {
    info!("Pre-Write Validation: Vbat = {:.2}V (minimum: {:.1}V)", vbat_volts, MIN_VBAT_FOR_FLASH);

    if vbat_volts < MIN_VBAT_FOR_FLASH {
        let msg = format!(
            "PRE-WRITE ABORTED: Battery voltage ({:.2}V) below minimum safety threshold ({:.1}V). Connect battery charger before flashing.",
            vbat_volts, MIN_VBAT_FOR_FLASH
        );
        error!("{}", msg);
        return Err(msg);
    }
    Ok(())
}

/// Create synchronous pre-write auto-backup with fsync to physical disk
/// This MUST complete before any erase/write operation begins
pub fn create_prewrite_backup(
    data: &[u8],
    backup_dir: &str,
    progress_fn: &mut impl FnMut(FlashProgress),
) -> Result<String, String> {
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let filename = format!("autobackup_prewrite_{}.bin", timestamp);
    let filepath = format!("{}/{}", backup_dir, filename);

    // Ensure backup directory exists
    std::fs::create_dir_all(backup_dir)
        .map_err(|e| format!("Failed to create backup directory: {}", e))?;

    // Write with explicit fsync — guarantees physical disk flush before erase begins
    let mut file = std::fs::File::create(&filepath)
        .map_err(|e| format!("Failed to create backup file: {}", e))?;

    file.write_all(data)
        .map_err(|e| format!("Failed to write backup data: {}", e))?;

    file.flush()
        .map_err(|e| format!("Failed to flush backup file: {}", e))?;

    file.sync_all()
        .map_err(|e| format!("Failed to fsync backup file: {}", e))?;

    info!("Synchronous Auto-Backup flushed to disk: {}", filepath);
    progress_fn(FlashProgress::new(
        5,
        &format!("Auto-Backup saved to disk: {}", filename),
        FlashState::Backup,
    ));

    Ok(filename)
}

/// Validate source binary file size is within acceptable range
pub fn validate_source_size(data: &[u8]) -> Result<(), String> {
    let min_size = 1024; // 1KB minimum
    let max_size = 4 * 1024 * 1024; // 4MB maximum

    if data.is_empty() {
        return Err("Binary source buffer is empty.".to_string());
    }
    if data.len() < min_size {
        return Err(format!(
            "Binary file too small ({:.1} KB). Minimum is 1 KB.",
            data.len() as f64 / 1024.0
        ));
    }
    if data.len() > max_size {
        return Err(format!(
            "Binary file too large ({:.1} KB). Maximum is 4096 KB.",
            data.len() as f64 / 1024.0
        ));
    }
    Ok(())
}

/// Validate file extension is .bin or .hex
pub fn validate_file_extension(filename: &str) -> Result<(), String> {
    let lower = filename.to_lowercase();
    if lower.ends_with(".bin") || lower.ends_with(".hex") {
        Ok(())
    } else {
        Err("Invalid file format. Only .bin and .hex files are allowed.".to_string())
    }
}

/// Calculate integrity hashes for a binary buffer
pub struct IntegrityHashes {
    pub md5: String,
    pub crc32: String,
}

pub fn calculate_integrity(data: &[u8]) -> IntegrityHashes {
    IntegrityHashes {
        md5: format!("{:x}", md5::compute(data)),
        crc32: format!("{:08X}", crc32fast::hash(data)),
    }
}
