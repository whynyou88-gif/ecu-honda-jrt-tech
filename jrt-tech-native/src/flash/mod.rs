// ============================================================
// flash/mod.rs — Flash Flasher Constants & Types
// ============================================================

pub mod read;
pub mod write;
pub mod safety_guard;

#[derive(Debug, Clone, PartialEq)]
pub enum FlashState {
    Idle,
    Reading,
    Erasing,
    Writing,
    Verifying,
    Backup,
    Done,
    Error,
}

impl FlashState {
    pub fn as_str(&self) -> &'static str {
        match self {
            FlashState::Idle => "IDLE",
            FlashState::Reading => "READING",
            FlashState::Erasing => "ERASING",
            FlashState::Writing => "WRITING",
            FlashState::Verifying => "VERIFYING",
            FlashState::Backup => "BACKUP",
            FlashState::Done => "DONE",
            FlashState::Error => "ERROR",
        }
    }
}

pub struct FlashProgress {
    pub percent: u32,
    pub msg: String,
    pub state: FlashState,
}
