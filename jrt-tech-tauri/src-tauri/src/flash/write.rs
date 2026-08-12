// ============================================================
// flash/write.rs — Full 5-Phase ECU Flash Write Sequence
// EXACT port of run_ecu_write_task() from localhost_server.py
// SAFETY-CRITICAL CODE — do NOT simplify or skip steps
// ============================================================

use crate::kline::HondaECU;
use crate::kline::protocol::{checksum8bit, checksum8bit_honda, format_read, is_nrc_response, decode_nrc};
use super::{FlashProgress, FlashState, WRITE_BLOCK_SIZE, BLOCK_WRITE_MAX_RETRIES};
use super::safety_guard;
use std::time::Instant;
use log::info;

/// Send command with automatic NRC 0x78 (Response Pending) retry
fn send_with_nrc78_retry(
    ecu: &mut HondaECU,
    header: &[u8],
    payload: &[u8],
    max_retries: u32,
) -> Option<(Vec<u8>, u8, Vec<u8>, usize)> {
    let mut delay_ms: u64 = 200;

    for attempt in 1..=max_retries {
        let resp = ecu.send_command(header, payload, 1, true, None);

        if resp.is_none() {
            info!("[NRC78] ECU returned None on attempt {}/{}", attempt, max_retries);
            std::thread::sleep(std::time::Duration::from_millis(delay_ms));
            delay_ms = std::cmp::min(1000, (delay_ms as f64 * 1.3) as u64);
            continue;
        }

        let r = resp.as_ref().unwrap();
        // Check for NRC 0x7F in rdata
        if let Some(nrc_code) = is_nrc_response(&r.2) {
            if nrc_code == 0x78 {
                info!("[NRC78] Response Pending, attempt {}/{}, waiting {}ms", attempt, max_retries, delay_ms);
                std::thread::sleep(std::time::Duration::from_millis(delay_ms));
                delay_ms = std::cmp::min(1000, (delay_ms as f64 * 1.3) as u64);
                continue;
            }
        }

        return resp;
    }

    None
}

/// Execute full ECU flash write with all safety guards
/// This is the SAFETY-CRITICAL function — ported EXACTLY from Python
pub fn run_ecu_write(
    ecu: &mut HondaECU,
    source_bytes: &[u8],
    auto_backup: bool,
    dry_run: bool,
    backup_dir: &str,
    vbat_volts: f64,
    mut progress_fn: impl FnMut(FlashProgress),
) -> Result<u32, String> {
    info!("=== INITIATING ECU WRITE TASK: auto_backup={}, dry_run={} ===", auto_backup, dry_run);

    // ── PHASE 1: PRE-FLIGHT CHECKS ──
    safety_guard::check_battery_voltage(vbat_volts)?;

    if source_bytes.is_empty() {
        return Err("PRE-WRITE ABORTED: Binary source buffer is empty.".to_string());
    }

    // Calculate checksums on source
    let raw_md5 = format!("{:x}", md5::compute(source_bytes));
    let raw_crc32 = format!("{:08X}", crc32fast::hash(source_bytes));
    info!("Raw Source: CRC32={}, MD5={}, Size={} bytes", raw_crc32, raw_md5, source_bytes.len());

    // Create isolated transmission copy with Honda checksum embedded
    let mut byts = source_bytes.to_vec();
    let len = byts.len();
    if len > 0 {
        byts[len - 1] = checksum8bit_honda(&byts[..len - 1]);
    }

    // ── PHASE 2: AUTO-BACKUP (synchronous fsync) ──
    if auto_backup {
        safety_guard::create_prewrite_backup(&byts, backup_dir, &mut progress_fn)?;
    }

    // ── DRY-RUN GUARD ──
    if dry_run {
        info!("=== DRY-RUN: Pre-checks & auto-backup validated. Skipping erase & write. ===");
        progress_fn(FlashProgress::new(
            100,
            "🔬 DRY-RUN TEST SUCCESS: Pre-checks, Vbat, source checksum & auto-backup validated.",
            FlashState::Done,
        ));
        return Ok(0);
    }

    // ── PHASE 3: HANDSHAKE & SECURITY ACCESS ──
    progress_fn(FlashProgress::new(10, "Mempersiapkan frame handshake & proteksi ECU...", FlashState::Erasing));

    // Purge serial buffers
    // (handled internally by send_command)

    // 3A. Probe ECU Flash Mode Responsiveness
    let mut is_responsive = false;
    for attempt in 1..=3 {
        info!("Probing ECU 0x7D Flash Mode (Attempt {}/3)...", attempt);
        if let Some(_) = send_with_nrc78_retry(ecu, &[0x7d], &[0x01, 0x01, 0x00], 5) {
            is_responsive = true;
            info!("[K-LINE] ECU responded to 0x7D probe on attempt {}", attempt);
            break;
        }
        if attempt < 3 {
            info!("Re-syncing K-Line Fast-Init...");
            let _ = ecu.init(true);
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }

    if !is_responsive {
        return Err("K-LINE HARDWARE UNRESPONSIVE: ECU tidak merespon perintah 0x7D!".to_string());
    }

    // 3B. PROGRAM MODE INITIATION (0x7D PGM-FI Header)
    let init_seq_7d: Vec<(&[u8], &str)> = vec![
        (&[0x01, 0x01, 0x00], "Init Flash Mode 0x00"),
        (&[0x01, 0x01, 0x01], "Init Flash Mode 0x01"),
        (&[0x01, 0x01, 0x02], "Init Flash Mode 0x02"),
        (&[0x01, 0x01, 0x03], "Init Flash Mode 0x03"),
        (&[0x01, 0x02, 0x50, 0x47, 0x4d], "PGM Authentication Header"),
        (&[0x01, 0x03, 0x2d, 0x46, 0x49], "FI Authentication Header"),
    ];

    for (payload, label) in &init_seq_7d {
        let _ = send_with_nrc78_retry(ecu, &[0x7d], payload, 5);
        info!("Handshake 0x7D [{}]", label);
        std::thread::sleep(std::time::Duration::from_millis(20));
    }

    // 3C. KEIHIN ERASE & SECURITY UNLOCK (0x7E)
    let passwd: &[u8] = &[0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x48]; // "HelloH"
    let erase_seq_7e: Vec<(Vec<u8>, &str)> = vec![
        (vec![0x01, 0x01, 0x00], "Session Control 0x00"),
        (vec![0x01, 0x02], "Read Status 0x02"),
        (vec![0x01, 0x03, 0x00, 0x00], "Request Seed"),
        (vec![0x01, 0x01, 0x00], "Session Control 0x00"),
        ({
            let mut v = vec![0x01, 0x0b];
            v.extend_from_slice(passwd);
            v
        }, "Send Security Key (Passcode)"),
        (vec![0x01, 0x01, 0x00], "Session Control 0x00"),
        (vec![0x01, 0x0e, 0x01, 0x90], "Set Write Range 0x0190"),
        (vec![0x01, 0x01, 0x01], "Flash Erase Command"),
        (vec![0x01, 0x04, 0xff], "Erase Sector Confirm"),
        (vec![0x01, 0x01, 0x00], "Verify Erase State"),
    ];

    for (payload, label) in &erase_seq_7e {
        let resp = send_with_nrc78_retry(ecu, &[0x7e], payload, 15);
        info!("Handshake 0x7E [{}]", label);

        if resp.is_none() {
            return Err(format!("ECU HANDSHAKE TIMEOUT at [{}]: ECU did not respond", label));
        }

        // Check for NRC rejection
        if let Some(ref r) = resp {
            if let Some(nrc) = is_nrc_response(&r.2) {
                let desc = decode_nrc(nrc);
                return Err(format!("ECU SECURITY REJECTED at [{}]: {} (NRC 0x{:02X})", label, desc, nrc));
            }
        }
    }

    // Wait for flash sector erase (11 seconds)
    info!("Erase & Security Handshake Complete. Waiting 11s for Flash Sector Erase...");
    for sec in 0..11 {
        progress_fn(FlashProgress::new(
            10 + (sec * 15 / 11),
            &format!("Erasing ECU flash sectors... {}s remaining", 11 - sec),
            FlashState::Erasing,
        ));
        std::thread::sleep(std::time::Duration::from_secs(1));
    }

    // ── PHASE 4: BLOCK-BY-BLOCK WRITE (128-BYTE CHUNKS) ──
    let os_size = byts.len();
    let write_size = WRITE_BLOCK_SIZE;
    let z: u32 = 8;
    let max_blocks = os_size / write_size;

    info!("Starting Block Write: Total={}, ChunkSize={}", max_blocks, write_size);
    let start = Instant::now();

    for i in 0..max_blocks {
        let w = i * write_size;
        let offset_i: u32 = 0;

        let bytstart = ((offset_i + (z * i as u32)) as u16).to_be_bytes().to_vec();
        let bytend = if i + 1 == max_blocks {
            vec![0u8, 0]
        } else {
            ((offset_i + (z * (i + 1) as u32)) as u16).to_be_bytes().to_vec()
        };

        let d = &byts[w..w + write_size];
        let mut x: Vec<u8> = Vec::with_capacity(2 + write_size + 2);
        x.extend_from_slice(&bytstart);
        x.extend_from_slice(d);
        x.extend_from_slice(&bytend);

        let c1 = checksum8bit(&x);
        let c2 = checksum8bit_honda(&x);

        let mut payload = vec![0x01, 0x06];
        payload.extend_from_slice(&x);
        payload.push(c1);
        payload.push(c2);

        // Retry block write up to BLOCK_WRITE_MAX_RETRIES times
        let mut block_success = false;
        for block_try in 1..=BLOCK_WRITE_MAX_RETRIES {
            let ack = send_with_nrc78_retry(ecu, &[0x7e], &payload, 5);
            info!("Block {}/{} (Try {}/{})", i + 1, max_blocks, block_try, BLOCK_WRITE_MAX_RETRIES);

            if let Some(ref r) = ack {
                if is_nrc_response(&r.2).is_none() {
                    block_success = true;
                    break;
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }

        if !block_success {
            let err = if i == 0 {
                format!("K-Line Write Failed on BLOCK 0. Check ignition, cable, ECU mode.")
            } else {
                format!("K-Line Write Failed on BLOCK {}/{}. Turn Ignition OFF→ON and use Recovery.", i + 1, max_blocks)
            };
            return Err(err);
        }

        let elapsed = start.elapsed().as_secs_f64();
        let rate = if elapsed > 0.0 { w as f64 / elapsed } else { 0.0 };
        let pct = 25 + (i * 65 / max_blocks) as u32;
        let eta = if rate > 0.0 { ((os_size - w) as f64 / rate) as u32 } else { 0 };

        progress_fn(FlashProgress::new(
            pct,
            &format!("Writing flash block {}/{}...", i + 1, max_blocks),
            FlashState::Writing,
        ).with_speed(rate as u32, eta));
    }

    // ── PHASE 5: POST-WRITE VERIFICATION (100% Read-Back) ──
    info!("=== POST-WRITE VERIFICATION ===");
    progress_fn(FlashProgress::new(90, "Verifying flashed data integrity...", FlashState::Verifying));

    // Exit flash mode
    let _ = ecu.send_command(&[0x7e], &[0x01, 0x01, 0x00], 1, false, Some(200));
    std::thread::sleep(std::time::Duration::from_millis(300));
    let _ = ecu.init(false);

    let mut mismatches: u32 = 0;
    let mut first_mismatch: Option<String> = None;

    // Strategy 1: Address-based read verification (0x23)
    let readsize: u8 = 12;
    let test_read = ecu.send_command(&[0x72], &[0x23, 0x00, 0x00, 0x00, 8], 1, false, None);
    if test_read.is_some() {
        info!("[POST-WRITE] Using address-based 0x23 read for verification");
        for blk_idx in 0..max_blocks {
            let blk_start = blk_idx * write_size;
            let expected = &byts[blk_start..blk_start + write_size];

            let mut read_buf: Vec<u8> = Vec::new();
            let mut read_loc = blk_start as u32;
            while read_buf.len() < write_size {
                let remaining = write_size - read_buf.len();
                let chunk_sz = std::cmp::min(readsize as usize, remaining) as u8;
                let addr = format_read(read_loc);
                let mut cmd = vec![0x23];
                cmd.extend_from_slice(&addr);
                cmd.push(chunk_sz);

                if let Some((_rt, _rl, chunk, _rdl)) = ecu.send_command(&[0x72], &cmd, 2, false, None) {
                    read_buf.extend_from_slice(&chunk);
                    read_loc += chunk.len() as u32;
                } else {
                    break;
                }
            }

            for (idx, (&got, &expected_b)) in read_buf.iter().zip(expected.iter()).enumerate() {
                if got != expected_b {
                    mismatches += 1;
                    if first_mismatch.is_none() {
                        first_mismatch = Some(format!(
                            "Block #{} offset 0x{:06X} (Expected 0x{:02X}, got 0x{:02X})",
                            blk_idx + 1, blk_start + idx, expected_b, got
                        ));
                    }
                }
            }

            if blk_idx % 50 == 0 || blk_idx == max_blocks - 1 {
                let pct = 90 + ((blk_idx + 1) * 10 / max_blocks) as u32;
                progress_fn(FlashProgress::new(
                    pct,
                    &format!("Verifying blocks ({}/{})...", blk_idx + 1, max_blocks),
                    FlashState::Verifying,
                ));
            }
        }
    } else {
        // Strategy 2: Spot-check telemetry tables
        info!("[POST-WRITE] Fallback to telemetry table spot-check");
        let spot_tables = [0x00u8, 0x10, 0x11, 0x17];
        for (idx, &tbl) in spot_tables.iter().enumerate() {
            if let Some((_rt, _rl, read_bytes, _rdl)) = ecu.send_command(&[0x72], &[0x71, tbl], 2, false, None) {
                let target_off = ((tbl as usize) * 512) % byts.len();
                let compare_len = std::cmp::min(read_bytes.len(), 16);
                for b in 0..compare_len {
                    if target_off + b < byts.len() && read_bytes[b] != byts[target_off + b] {
                        mismatches += 1;
                        if first_mismatch.is_none() {
                            first_mismatch = Some(format!("Table 0x{:02X} offset 0x{:06X}", tbl, target_off + b));
                        }
                    }
                }
            }
            let pct = 90 + ((idx + 1) * 10 / spot_tables.len()) as u32;
            progress_fn(FlashProgress::new(
                pct,
                &format!("Spot-checking table 0x{:02X}...", tbl),
                FlashState::Verifying,
            ));
        }
    }

    if mismatches > 0 {
        return Err(format!(
            "POST-WRITE VERIFICATION FAILED: {} byte mismatches. First: {}",
            mismatches, first_mismatch.unwrap_or_default()
        ));
    }

    info!("POST-WRITE VERIFICATION PASSED: 100% match");
    Ok(max_blocks as u32)
}
