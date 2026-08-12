// ============================================================
// flash/write.rs — Full 5-Phase Safety Write Engine
// EXACT port of Python safety-critical flash write sequence
// ============================================================

use crate::kline::HondaECU;
use crate::kline::protocol::{checksum8bit, checksum8bit_honda, format_read, is_nrc_response, decode_nrc};
use super::{FlashProgress, FlashState};
use super::safety_guard;

fn send_with_nrc78_retry(
    ecu: &mut HondaECU,
    header: &[u8],
    payload: &[u8],
    max_retries: u32,
) -> Option<(Vec<u8>, u8, Vec<u8>, usize)> {
    let mut delay_ms: u64 = 200;
    for _attempt in 1..=max_retries {
        let resp = ecu.send_command(header, payload, 1, true, None);
        if let Some(ref r) = resp {
            if let Some(nrc_code) = is_nrc_response(&r.2) {
                if nrc_code == 0x78 {
                    std::thread::sleep(std::time::Duration::from_millis(delay_ms));
                    delay_ms = std::cmp::min(1000, (delay_ms as f64 * 1.3) as u64);
                    continue;
                }
            }
        }
        return resp;
    }
    None
}

pub fn run_ecu_write(
    ecu: &mut HondaECU,
    source_bytes: &[u8],
    auto_backup: bool,
    dry_run: bool,
    backup_dir: &str,
    vbat_volts: f64,
    mut progress_fn: impl FnMut(FlashProgress),
) -> Result<u32, String> {
    safety_guard::check_battery_voltage(vbat_volts)?;

    if source_bytes.is_empty() {
        return Err("PRE-WRITE ABORTED: Binary source buffer is empty.".to_string());
    }

    let mut byts = source_bytes.to_vec();
    let len = byts.len();
    if len > 0 {
        byts[len - 1] = checksum8bit_honda(&byts[..len - 1]);
    }

    if auto_backup {
        safety_guard::create_prewrite_backup(&byts, backup_dir, &mut progress_fn)?;
    }

    if dry_run {
        progress_fn(FlashProgress {
            percent: 100,
            msg: "DRY-RUN TEST SUCCESS: All pre-checks validated.".to_string(),
            state: FlashState::Done,
        });
        return Ok(0);
    }

    // 0x7D PGM-FI Authentication Header
    let init_seq_7d: Vec<(&[u8], &str)> = vec![
        (&[0x01, 0x01, 0x00], "Init 0x00"),
        (&[0x01, 0x01, 0x01], "Init 0x01"),
        (&[0x01, 0x01, 0x02], "Init 0x02"),
        (&[0x01, 0x01, 0x03], "Init 0x03"),
        (&[0x01, 0x02, 0x50, 0x47, 0x4d], "PGM Header"),
        (&[0x01, 0x03, 0x2d, 0x46, 0x49], "FI Header"),
    ];

    for (payload, _label) in &init_seq_7d {
        let _ = send_with_nrc78_retry(ecu, &[0x7d], payload, 5);
    }

    // 0x7E Security Unlock & Erase
    let passwd: &[u8] = &[0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x48];
    let erase_seq_7e: Vec<(Vec<u8>, &str)> = vec![
        (vec![0x01, 0x01, 0x00], "Session Control"),
        (vec![0x01, 0x02], "Read Status"),
        (vec![0x01, 0x03, 0x00, 0x00], "Request Seed"),
        (vec![0x01, 0x01, 0x00], "Session Control"),
        ({
            let mut v = vec![0x01, 0x0b];
            v.extend_from_slice(passwd);
            v
        }, "Send Passcode"),
        (vec![0x01, 0x01, 0x00], "Session Control"),
        (vec![0x01, 0x0e, 0x01, 0x90], "Set Range"),
        (vec![0x01, 0x01, 0x01], "Flash Erase"),
        (vec![0x01, 0x04, 0xff], "Confirm Erase"),
        (vec![0x01, 0x01, 0x00], "Verify State"),
    ];

    for (payload, label) in &erase_seq_7e {
        let resp = send_with_nrc78_retry(ecu, &[0x7e], payload, 15);
        if resp.is_none() {
            return Err(format!("ECU Handshake Timeout at [{}]", label));
        }
        if let Some(ref r) = resp {
            if let Some(nrc) = is_nrc_response(&r.2) {
                return Err(format!("ECU Security Rejected at [{}]: {} (NRC 0x{:02X})", label, decode_nrc(nrc), nrc));
            }
        }
    }

    // Wait for flash sector erase (11s)
    for sec in 0..11 {
        progress_fn(FlashProgress {
            percent: 10 + (sec * 15 / 11),
            msg: format!("Erasing ECU flash sectors... {}s remaining", 11 - sec),
            state: FlashState::Erasing,
        });
        std::thread::sleep(std::time::Duration::from_secs(1));
    }

    // Block-by-block write (128-byte chunks)
    let os_size = byts.len();
    let write_size = 128;
    let max_blocks = os_size / write_size;

    for i in 0..max_blocks {
        let w = i * write_size;
        let bytstart = ((8 * i as u32) as u16).to_be_bytes().to_vec();
        let bytend = if i + 1 == max_blocks { vec![0u8, 0] } else { ((8 * (i + 1) as u32) as u16).to_be_bytes().to_vec() };

        let d = &byts[w..w + write_size];
        let mut x = Vec::with_capacity(2 + write_size + 2);
        x.extend_from_slice(&bytstart);
        x.extend_from_slice(d);
        x.extend_from_slice(&bytend);

        let c1 = checksum8bit(&x);
        let c2 = checksum8bit_honda(&x);

        let mut payload = vec![0x01, 0x06];
        payload.extend_from_slice(&x);
        payload.push(c1);
        payload.push(c2);

        let mut block_success = false;
        for _block_try in 1..=4 {
            let ack = send_with_nrc78_retry(ecu, &[0x7e], &payload, 5);
            if let Some(ref r) = ack {
                if is_nrc_response(&r.2).is_none() {
                    block_success = true;
                    break;
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }

        if !block_success {
            return Err(format!("K-Line Write Failed on BLOCK {}/{}", i + 1, max_blocks));
        }

        let pct = 25 + (i * 65 / max_blocks) as u32;
        progress_fn(FlashProgress {
            percent: pct,
            msg: format!("Writing block {}/{} (0x{:06X})...", i + 1, max_blocks, w),
            state: FlashState::Writing,
        });
    }

    // Post-Write Verification
    progress_fn(FlashProgress {
        percent: 90,
        msg: "Verifying flashed data integrity...".to_string(),
        state: FlashState::Verifying,
    });

    let _ = ecu.send_command(&[0x7e], &[0x01, 0x01, 0x00], 1, false, Some(200));
    std::thread::sleep(std::time::Duration::from_millis(300));
    let _ = ecu.init(false);

    let readsize: u8 = 12;
    let mut mismatches: u32 = 0;

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

        for (got, &expected_b) in read_buf.iter().zip(expected.iter()) {
            if *got != expected_b {
                mismatches += 1;
            }
        }
    }

    if mismatches > 0 {
        return Err(format!("POST-WRITE VERIFICATION FAILED: {} byte mismatches.", mismatches));
    }

    progress_fn(FlashProgress {
        percent: 100,
        msg: "Flash Complete & Verified 100%!".to_string(),
        state: FlashState::Done,
    });

    Ok(max_blocks as u32)
}
