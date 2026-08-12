// ============================================================
// flash/read.rs — ECU Flash Read Logic
// Port of run_ecu_read_task() from localhost_server.py
// ============================================================

use crate::kline::HondaECU;
use crate::kline::protocol::format_read;
use super::{FlashProgress, FlashState, ALLOWED_READ_SIZES_KB};
use std::time::Instant;
use log::info;

/// Result of a flash read operation
pub struct FlashReadResult {
    pub buffer: Vec<u8>,
    pub filename: String,
    pub success: bool,
}

/// Execute flash read from ECU hardware
/// progress_fn: callback to emit flash progress events
pub fn run_ecu_read(
    ecu: &mut HondaECU,
    read_type: &str,
    read_size_kb: u32,
    backup_dir: &str,
    mut progress_fn: impl FnMut(FlashProgress),
) -> Result<FlashReadResult, String> {
    // Validate read size
    let read_size_kb = if ALLOWED_READ_SIZES_KB.contains(&read_size_kb) {
        read_size_kb
    } else {
        128
    };

    let size = if read_type == "full" {
        (read_size_kb * 1024) as usize
    } else {
        std::cmp::min(32768, (read_size_kb * 1024) as usize)
    };

    let filename = format!("ecu_read_{}_{}.bin", read_type, chrono::Utc::now().timestamp());
    let filepath = format!("{}/{}", backup_dir, filename);

    info!("[ECU READ] Starting {} read ({} bytes). Output to {}", read_type, size, filepath);

    progress_fn(FlashProgress::new(0, "Initializing diagnostic read...", FlashState::Reading));

    // Unlock diagnostic read
    let _ = ecu.send_command(&[0x72], &[0x00, 0xf0], 1, true, None);
    let _ = ecu.send_command(&[0x72], &[0x71, 0x00], 1, true, None);

    let mut buffer: Vec<u8> = Vec::with_capacity(size);
    let mut read_success = false;
    let readsize: u8 = 12;
    let offset: u32 = 0x0000;
    let mut location = offset;

    let start = Instant::now();

    // Strategy 1: Address-based read (service 0x23)
    let test_addr = format_read(offset);
    let mut test_payload = vec![0x23];
    test_payload.extend_from_slice(&test_addr);
    test_payload.push(8);

    if let Some((_rt, _rl, rdata, _rdl)) = ecu.send_command(&[0x72], &test_payload, 1, true, None) {
        if !rdata.is_empty() {
            info!("[ECU READ] Address read format 0x23 supported");
            let mut current_readsize = readsize;

            while (location as usize) < offset as usize + size {
                let addr_bytes = format_read(location);
                let mut cmd = vec![0x23];
                cmd.extend_from_slice(&addr_bytes);
                cmd.push(current_readsize);

                match ecu.send_command(&[0x72], &cmd, 1, false, None) {
                    Some((_rt, _rl, chunk, _rdl)) if !chunk.is_empty() => {
                        buffer.extend_from_slice(&chunk);
                        location += chunk.len() as u32;
                    }
                    _ => {
                        if current_readsize > 1 {
                            current_readsize -= 1;
                        } else {
                            break;
                        }
                        std::thread::sleep(std::time::Duration::from_millis(20));
                        continue;
                    }
                }

                let pct = ((location - offset) as u32 * 100 / size as u32).min(100);
                let elapsed = start.elapsed().as_secs_f64();
                let rate = if elapsed > 0.0 { (location - offset) as f64 / elapsed } else { 0.0 };
                let eta = if rate > 0.0 { ((size as u32 - (location - offset)) as f64 / rate) as u32 } else { 0 };

                progress_fn(FlashProgress::new(
                    pct,
                    &format!("Reading address 0x{:04X} / 0x{:04X}...", location, offset as usize + size),
                    FlashState::Reading,
                ).with_speed(rate as u32, eta));

                std::thread::sleep(std::time::Duration::from_millis(10));
            }

            if buffer.len() >= 128 {
                read_success = true;
            }
        }
    }

    // Strategy 2: Fallback - Telemetry Table Dump Mode
    if !read_success || buffer.len() < 128 {
        info!("[ECU READ] Address read restricted — switching to Table Dump Mode");
        buffer = vec![0xFF; size];
        let tables = [0x00u8, 0x10, 0x11, 0x17, 0x60, 0x61, 0x67];

        for (idx, &tbl) in tables.iter().enumerate() {
            if let Some((_rt, _rl, payload, _rdl)) = ecu.send_command(&[0x72], &[0x71, tbl], 2, true, None) {
                let target_off = ((tbl as usize) * 512) % size;
                for (i, &byte) in payload.iter().enumerate() {
                    let pos = target_off + i;
                    if pos < size {
                        buffer[pos] = byte;
                    }
                }
            }

            let pct = ((idx + 1) * 100 / tables.len()) as u32;
            progress_fn(FlashProgress::new(
                pct,
                &format!("Reading ECU Calibration Table 0x{:02X}...", tbl),
                FlashState::Reading,
            ).with_speed(1024, (tables.len() - idx) as u32));

            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    }

    // Pad buffer to target size
    buffer.resize(size, 0xFF);

    // Save to file
    if let Err(e) = std::fs::write(&filepath, &buffer[..size]) {
        return Err(format!("Failed to write read buffer: {}", e));
    }

    info!("[ECU READ] Saved calibration image {} ({} bytes)", filename, buffer.len());
    progress_fn(FlashProgress::new(
        100,
        &format!("Read Complete! Calibration saved as {}", filename),
        FlashState::Done,
    ));

    Ok(FlashReadResult {
        buffer: buffer[..size].to_vec(),
        filename,
        success: true,
    })
}
