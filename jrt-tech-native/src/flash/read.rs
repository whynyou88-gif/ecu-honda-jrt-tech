// ============================================================
// flash/read.rs — Flash Read Engine
// ============================================================

use crate::kline::HondaECU;
use crate::kline::protocol::format_read;
use super::{FlashProgress, FlashState};

pub fn run_ecu_read(
    ecu: &mut HondaECU,
    read_type: &str,
    read_size_kb: u32,
    backup_dir: &str,
    mut progress_fn: impl FnMut(FlashProgress),
) -> Result<String, String> {
    let size = (read_size_kb * 1024) as usize;
    let filename = format!("ecu_read_{}_{}.bin", read_type, chrono::Utc::now().timestamp());
    let filepath = format!("{}/{}", backup_dir, filename);

    progress_fn(FlashProgress {
        percent: 0,
        msg: "Initializing diagnostic read...".to_string(),
        state: FlashState::Reading,
    });

    let _ = ecu.send_command(&[0x72], &[0x00, 0xf0], 1, true, None);
    let _ = ecu.send_command(&[0x72], &[0x71, 0x00], 1, true, None);

    let mut buffer: Vec<u8> = Vec::with_capacity(size);
    let mut location: u32 = 0x0000;
    let readsize: u8 = 12;

    while buffer.len() < size {
        let addr_bytes = format_read(location);
        let mut cmd = vec![0x23];
        cmd.extend_from_slice(&addr_bytes);
        cmd.push(readsize);

        if let Some((_rt, _rl, chunk, _rdl)) = ecu.send_command(&[0x72], &cmd, 1, false, None) {
            if !chunk.is_empty() {
                buffer.extend_from_slice(&chunk);
                location += chunk.len() as u32;
            } else {
                break;
            }
        } else {
            break;
        }

        let pct = (buffer.len() * 100 / size).min(100) as u32;
        progress_fn(FlashProgress {
            percent: pct,
            msg: format!("Reading memory address 0x{:04X}...", location),
            state: FlashState::Reading,
        });

        std::thread::sleep(std::time::Duration::from_millis(5));
    }

    buffer.resize(size, 0xFF);

    std::fs::create_dir_all(backup_dir).map_err(|e| e.to_string())?;
    std::fs::write(&filepath, &buffer).map_err(|e| format!("Failed to save read binary: {}", e))?;

    progress_fn(FlashProgress {
        percent: 100,
        msg: format!("Read Complete! Saved to {}", filename),
        state: FlashState::Done,
    });

    Ok(filename)
}
