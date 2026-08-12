// ============================================================
// flash/mod.rs — Flash Operation State Machine & Types
// ============================================================

pub mod read;
pub mod write;
pub mod safety_guard;

use serde::{Deserialize, Serialize};

/// Flash operation state
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FlashState {
    #[serde(rename = "IDLE")]
    Idle,
    #[serde(rename = "READING")]
    Reading,
    #[serde(rename = "ERASING")]
    Erasing,
    #[serde(rename = "WRITING")]
    Writing,
    #[serde(rename = "VERIFYING")]
    Verifying,
    #[serde(rename = "BACKUP")]
    Backup,
    #[serde(rename = "DONE")]
    Done,
    #[serde(rename = "ERROR")]
    Error,
}

/// Flash progress event payload — sent to frontend via Tauri events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlashProgress {
    #[serde(rename = "type")]
    pub event_type: String,
    pub percent: u32,
    pub msg: String,
    pub speed: u32,
    pub eta: u32,
    pub state: FlashState,
    #[serde(rename = "flashCount", skip_serializing_if = "Option::is_none")]
    pub flash_count: Option<u32>,
}

impl FlashProgress {
    pub fn new(percent: u32, msg: &str, state: FlashState) -> Self {
        FlashProgress {
            event_type: "flash_progress".to_string(),
            percent,
            msg: msg.to_string(),
            speed: 0,
            eta: 0,
            state,
            flash_count: None,
        }
    }

    pub fn with_speed(mut self, speed: u32, eta: u32) -> Self {
        self.speed = speed;
        self.eta = eta;
        self
    }

    pub fn with_flash_count(mut self, count: u32) -> Self {
        self.flash_count = Some(count);
        self
    }
}

/// Allowed flash read sizes in KB
pub const ALLOWED_READ_SIZES_KB: &[u32] = &[48, 96, 128, 256, 512, 1024];

/// Flash write block size in bytes
pub const WRITE_BLOCK_SIZE: usize = 128;

/// Maximum retries per block write
pub const BLOCK_WRITE_MAX_RETRIES: u32 = 4;

/// Minimum battery voltage for flash write (volts)
pub const MIN_VBAT_FOR_FLASH: f64 = 11.5;

/// Flash counter file path (relative to app data)
pub const FLASH_COUNTER_FILENAME: &str = "flash_counter.json";
