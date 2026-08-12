// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod kline;
mod flash;
mod seedkey;
mod ecu_db;
mod commands;

use commands::*;
use std::time::Duration;
use tauri::{Emitter, Manager};

fn main() {
    env_logger::init();
    log::info!("Starting JRT Tech ANALIST Pro Tauri App...");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_status,
            get_info,
            get_ports,
            connect_ecu,
            disconnect_ecu,
            sim_connect,
            sim_disconnect,
            read_dtc,
            clear_dtc,
            start_flash_read,
            start_flash_write,
            reset_flash_count
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Background telemetry streaming loop
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(Duration::from_millis(100));
                    let state = app_handle.state::<AppState>();
                    let is_connected = *state.is_connected.lock().unwrap();
                    let is_sim = *state.is_simulation.lock().unwrap();

                    if is_connected || is_sim {
                        let mut telemetry = LiveTelemetry::default();
                        telemetry.connected = true;
                        telemetry.ecu_connected = true;

                        if is_sim {
                            // Generate active telemetry variation for simulation
                            let now = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs_f64();
                            let rpm_var = (now.sin() * 500.0) as u32 + 1500;
                            telemetry.rpm = rpm_var;
                            telemetry.tps = ((now * 0.5).sin() * 20.0 + 20.0).round();
                            telemetry.ect = 85.0;
                            telemetry.iat = 32.0;
                            telemetry.map = 101.3;
                            telemetry.batt_voltage = 12.8;
                            telemetry.inj_pw = 2.5;
                            telemetry.ign_timing = 15.0;
                            telemetry.speed = (rpm_var / 100) as u32;
                            telemetry.o2 = 0.45;
                            telemetry.afr = 14.7;
                        } else {
                            // Fetch real data from ECU (using non-blocking try_lock)
                            if let Ok(mut ecu_guard) = state.ecu.try_lock() {
                                if let Some(ref mut ecu) = *ecu_guard {
                                    let (msg, _, _) = kline::protocol::format_message(&[0x72], &[0x71, 0x17]);
                                    if let Some(rx) = ecu.send_raw_kline(&msg, 50) {
                                        if rx.len() >= 8 {
                                            let payload = if rx.len() >= 3 && rx[0] == 0x71 {
                                                &rx[2..]
                                            } else {
                                                &rx[1..]
                                            };
                                            if payload.len() >= 2 {
                                                let rpm = ((payload[0] as u32) << 8) | (payload[1] as u32);
                                                if rpm < 18000 {
                                                    telemetry.rpm = rpm;
                                                }
                                            }
                                            if payload.len() > 2 {
                                                telemetry.tps = payload[2] as f64 * 0.4;
                                            }
                                            if payload.len() > 5 {
                                                telemetry.ect = (payload[5] as f64) - 40.0;
                                            }
                                            if payload.len() > 7 {
                                                telemetry.iat = (payload[7] as f64) - 40.0;
                                            }
                                            if payload.len() > 9 {
                                                telemetry.map = payload[9] as f64;
                                            }
                                            if payload.len() > 10 {
                                                telemetry.batt_voltage = payload[10] as f64 / 10.0;
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        let _ = app_handle.emit("live-telemetry", telemetry);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
