// ============================================================
// flash/safety_guard.rs — ECU Pre-Flight Safety Checks
// Protects physical ECU from bricking / damage
// ============================================================

use super::{FlashProgress, FlashState};
use std::io::Write;

pub const MIN_VBAT_FOR_FLASH: f64 = 11.5;

pub fn check_battery_voltage(vbat_volts: f64) -> Result<(), String> {
    if vbat_volts < MIN_VBAT_FOR_FLASH {
        return Err(format!(
            "PRE-WRITE ABORTED: Battery voltage ({:.1}V) below minimum safety threshold ({:.1}V). Connect battery charger before flashing.",
            vbat_volts, MIN_VBAT_FOR_FLASH
        ));
    }
    Ok(())
}

pub fn create_prewrite_backup(
    data: &[u8],
    backup_dir: &str,
    progress_fn: &mut impl FnMut(FlashProgress),
) -> Result<String, String> {
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let filename = format!("autobackup_prewrite_{}.bin", timestamp);
    let filepath = format!("{}/{}", backup_dir, filename);

    std::fs::create_dir_all(backup_dir)
        .map_err(|e| format!("Failed to create backup dir: {}", e))?;

    let mut file = std::fs::File::create(&filepath)
        .map_err(|e| format!("Failed to create backup file: {}", e))?;

    file.write_all(data)
        .map_err(|e| format!("Failed to write backup data: {}", e))?;

    file.flush()
        .map_err(|e| format!("Failed to flush backup file: {}", e))?;

    file.sync_all()
        .map_err(|e| format!("Failed to fsync backup file: {}", e))?;

    progress_fn(FlashProgress {
        percent: 5,
        msg: format!("Auto-Backup saved to disk: {}", filename),
        state: FlashState::Backup,
    });

    Ok(filename)
}
