// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod kline;
mod flash;
mod seedkey;
mod ecu_db;
pub mod license;
mod ui_bridge;

use std::sync::Arc;
use ui_bridge::{AppState, setup_ui_bridge};

// Include generated Slint code from build.rs
slint::include_modules!();

fn main() -> Result<(), slint::PlatformError> {
    #[cfg(target_os = "windows")]
    if std::env::var("SLINT_BACKEND").is_err() {
        std::env::set_var("SLINT_BACKEND", "software");
    }

    env_logger::init();
    log::info!("Starting JRT Tech ANALIST Pro Pure Native Slint App with HWID Machine Lock...");

    let main_window = MainWindow::new()?;
    let app_state = Arc::new(AppState::default());

    setup_ui_bridge(&main_window, app_state);

    main_window.run()
}
