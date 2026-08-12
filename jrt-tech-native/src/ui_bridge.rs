// ============================================================
// ui_bridge.rs — Slint ↔ Rust Backend Bridge
// Connects Slint callbacks and updates Slint properties from Rust thread
// ============================================================

use std::sync::{Arc, Mutex};
use std::time::Duration;
use slint::ComponentHandle;
use log::info;

use crate::kline::{HondaECU, find_ftdi_serial_port};
use crate::flash::{FlashProgress, FlashState};
use crate::flash::read::run_ecu_read;
use crate::flash::write::run_ecu_write;

pub struct AppState {
    pub ecu: Mutex<Option<HondaECU>>,
    pub is_connected: Mutex<bool>,
    pub is_simulation: Mutex<bool>,
    pub flash_counter: Mutex<u32>,
}

impl Default for AppState {
    fn default() -> Self {
        AppState {
            ecu: Mutex::new(None),
            is_connected: Mutex::new(false),
            is_simulation: Mutex::new(false),
            flash_counter: Mutex::new(0),
        }
    }
}

pub fn setup_ui_bridge(window: &crate::MainWindow, state: Arc<AppState>) {
    // Initial HWID Machine Lock Check
    let hwid = crate::license::hwid::get_machine_hwid();
    let is_active = crate::license::LicenseManager::is_activated();

    window.set_hwid_text(slint::SharedString::from(&hwid));
    window.set_is_activated(is_active);
    if is_active {
        window.set_license_status("ACTIVATED PRO LICENSE".into());
    } else {
        window.set_license_status("UNACTIVATED — LICENSE KEY REQUIRED".into());
    }

    // Callback: Activate HWID License Key
    let window_weak = window.as_weak();
    window.on_activate_license_clicked(move |key| {
        let key_str = key.to_string();
        let _ = window_weak.upgrade_in_event_loop(move |win| {
            match crate::license::LicenseManager::activate(&key_str) {
                Ok(_) => {
                    win.set_is_activated(true);
                    win.set_license_error(false);
                    win.set_license_status("ACTIVATED PRO LICENSE".into());
                }
                Err(err) => {
                    win.set_is_activated(false);
                    win.set_license_error(true);
                    win.set_license_status(slint::SharedString::from(err));
                }
            }
        });
    });

    let window_weak = window.as_weak();
    let state_conn = state.clone();

    // Callback: Connect ECU Button
    window.on_connect_clicked(move || {
        let state_ref = state_conn.clone();
        let weak = window_weak.clone();

        std::thread::spawn(move || {
            let port = find_ftdi_serial_port();
            let mut ecu_guard = state_ref.ecu.lock().unwrap();

            match HondaECU::new(port.as_deref()) {
                Ok(mut ecu) => {
                    if ecu.setup().is_ok() && ecu.init(true) {
                        *ecu_guard = Some(ecu);
                        *state_ref.is_connected.lock().unwrap() = true;
                        *state_ref.is_simulation.lock().unwrap() = false;

                        let _ = weak.upgrade_in_event_loop(move |win| {
                            win.set_is_connected(true);
                            win.set_is_simulation(false);
                            win.set_battery_voltage(12.6);
                        });
                        return;
                    }
                }
                Err(_) => {}
            }

            // Fallback to Simulation mode if no hardware attached
            *state_ref.is_connected.lock().unwrap() = true;
            *state_ref.is_simulation.lock().unwrap() = true;
            let _ = weak.upgrade_in_event_loop(move |win| {
                win.set_is_connected(true);
                win.set_is_simulation(true);
                win.set_battery_voltage(12.8);
            });
        });
    });

    let window_weak = window.as_weak();
    let state_disc = state.clone();

    // Callback: Disconnect ECU Button
    window.on_disconnect_clicked(move || {
        let mut ecu_guard = state_disc.ecu.lock().unwrap();
        if let Some(ref mut ecu) = *ecu_guard {
            ecu.close();
        }
        *ecu_guard = None;
        *state_disc.is_connected.lock().unwrap() = false;
        *state_disc.is_simulation.lock().unwrap() = false;

        let _ = window_weak.upgrade_in_event_loop(move |win| {
            win.set_is_connected(false);
            win.set_is_simulation(false);
            win.set_battery_voltage(0.0);
        });
    });

    let window_weak = window.as_weak();
    let state_dtc = state.clone();

    // Callback: Scan DTC
    window.on_read_dtc_clicked(move || {
        let is_sim = *state_dtc.is_simulation.lock().unwrap();
        let weak = window_weak.clone();

        if is_sim {
            let _ = weak.upgrade_in_event_loop(move |win| {
                win.set_dtc_count(2);
            });
        }
    });

    let window_weak = window.as_weak();
    // Callback: Clear DTC
    window.on_clear_dtc_clicked(move || {
        let _ = window_weak.upgrade_in_event_loop(move |win| {
            win.set_dtc_count(0);
        });
    });

    let window_weak = window.as_weak();
    let state_read = state.clone();

    // Callback: Flash Read
    window.on_start_flash_read(move || {
        let weak = window_weak.clone();
        let state_ref = state_read.clone();

        std::thread::spawn(move || {
            let is_sim = *state_ref.is_simulation.lock().unwrap();

            if is_sim {
                for pct in (0..=100).step_by(10) {
                    let msg = format!("Simulated read {}%", pct);
                    let _ = weak.upgrade_in_event_loop(move |win| {
                        win.set_is_flashing(true);
                        win.set_flash_percent(pct);
                        win.set_flash_msg(slint::SharedString::from(msg));
                        win.set_flash_state(slint::SharedString::from("READING"));
                    });
                    std::thread::sleep(Duration::from_millis(100));
                }
                let _ = weak.upgrade_in_event_loop(move |win| {
                    win.set_is_flashing(false);
                    win.set_flash_state(slint::SharedString::from("DONE"));
                });
                return;
            }

            let mut ecu_guard = state_ref.ecu.lock().unwrap();
            if let Some(ref mut ecu) = *ecu_guard {
                let weak_cb = weak.clone();
                let _ = run_ecu_read(ecu, "calibration", 128, "./backups", move |p: FlashProgress| {
                    let state_str = p.state.as_str().to_string();
                    let msg = p.msg.clone();
                    let pct = p.percent;
                    let _ = weak_cb.upgrade_in_event_loop(move |win| {
                        win.set_is_flashing(pct < 100);
                        win.set_flash_percent(pct as i32);
                        win.set_flash_msg(slint::SharedString::from(msg));
                        win.set_flash_state(slint::SharedString::from(state_str));
                    });
                });
            }
        });
    });

    let window_weak = window.as_weak();
    let state_write = state.clone();

    // Callback: Flash Write
    window.on_start_flash_write(move || {
        let weak = window_weak.clone();
        let state_ref = state_write.clone();

        std::thread::spawn(move || {
            let is_sim = *state_ref.is_simulation.lock().unwrap();

            if is_sim {
                for pct in (0..=100).step_by(5) {
                    let state_str = if pct < 15 { "ERASING" } else if pct < 90 { "WRITING" } else { "VERIFYING" };
                    let msg = format!("[VIRTUAL ECU] Flashing {}%", pct);
                    let _ = weak.upgrade_in_event_loop(move |win| {
                        win.set_is_flashing(pct < 100);
                        win.set_flash_percent(pct);
                        win.set_flash_msg(slint::SharedString::from(msg));
                        win.set_flash_state(slint::SharedString::from(state_str));
                    });
                    std::thread::sleep(Duration::from_millis(50));
                }

                let mut count = state_ref.flash_counter.lock().unwrap();
                *count += 1;
                let c_val = *count;

                let _ = weak.upgrade_in_event_loop(move |win| {
                    win.set_is_flashing(false);
                    win.set_flash_percent(100);
                    win.set_flash_msg("Proses Flash ECU Selesai 100% Sempurna!".into());
                    win.set_flash_state("DONE".into());
                    win.set_flash_count(c_val as i32);
                });
                return;
            }

            let mut ecu_guard = state_ref.ecu.lock().unwrap();
            if let Some(ref mut ecu) = *ecu_guard {
                let weak_cb = weak.clone();
                let source = vec![0xFFu8; 131072];
                if let Ok(_) = run_ecu_write(ecu, &source, true, false, "./backups", 12.5, move |p: FlashProgress| {
                    let state_str = p.state.as_str().to_string();
                    let msg = p.msg.clone();
                    let pct = p.percent;
                    let _ = weak_cb.upgrade_in_event_loop(move |win| {
                        win.set_is_flashing(pct < 100);
                        win.set_flash_percent(pct as i32);
                        win.set_flash_msg(slint::SharedString::from(msg));
                        win.set_flash_state(slint::SharedString::from(state_str));
                    });
                }) {
                    let mut count = state_ref.flash_counter.lock().unwrap();
                    *count += 1;
                    let c_val = *count;
                    let _ = weak.upgrade_in_event_loop(move |win| {
                        win.set_flash_count(c_val as i32);
                    });
                }
            }
        });
    });

    let window_weak = window.as_weak();
    let state_rst = state.clone();

    // Callback: Reset Flash Counter
    window.on_reset_flash_count(move || {
        *state_rst.flash_counter.lock().unwrap() = 0;
        let _ = window_weak.upgrade_in_event_loop(move |win| {
            win.set_flash_count(0);
        });
    });

    // Real-time Background Telemetry Loop Thread (updates Slint UI properties every 100ms)
    let window_weak = window.as_weak();
    let state_loop = state.clone();

    std::thread::spawn(move || {
        loop {
            std::thread::sleep(Duration::from_millis(100));

            let is_connected = *state_loop.is_connected.lock().unwrap();
            let is_sim = *state_loop.is_simulation.lock().unwrap();

            if is_connected || is_sim {
                let mut rpm_val = 1500i32;
                let mut tps_val = 0.0f32;
                let mut ect_val = 85.0f32;
                let mut iat_val = 32.0f32;
                let mut map_val = 101.3f32;
                let mut vbat_val = 12.8f32;
                let mut speed_val = 0i32;

                if is_sim {
                    let now = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs_f64();
                    rpm_val = ((now.sin() * 500.0) as i32) + 1500;
                    tps_val = (((now * 0.5).sin() * 20.0) + 20.0) as f32;
                    speed_val = rpm_val / 100;
                } else if let Ok(mut ecu_guard) = state_loop.ecu.try_lock() {
                    if let Some(ref mut ecu) = *ecu_guard {
                        let (msg, _, _) = crate::kline::protocol::format_message(&[0x72], &[0x71, 0x17]);
                        if let Some(rx) = ecu.send_raw_kline(&msg, 50) {
                            if rx.len() >= 8 {
                                let payload = if rx.len() >= 3 && rx[0] == 0x71 { &rx[2..] } else { &rx[1..] };
                                if payload.len() >= 2 {
                                    rpm_val = (((payload[0] as u32) << 8) | (payload[1] as u32)) as i32;
                                }
                                if payload.len() > 2 { tps_val = (payload[2] as f32) * 0.4; }
                                if payload.len() > 5 { ect_val = (payload[5] as f32) - 40.0; }
                                if payload.len() > 7 { iat_val = (payload[7] as f32) - 40.0; }
                                if payload.len() > 9 { map_val = payload[9] as f32; }
                                if payload.len() > 10 { vbat_val = (payload[10] as f32) / 10.0; }
                            }
                        }
                    }
                }

                let _ = window_weak.upgrade_in_event_loop(move |win| {
                    win.set_rpm(rpm_val);
                    win.set_tps(tps_val);
                    win.set_map_val(map_val);
                    win.set_ect(ect_val);
                    win.set_iat(iat_val);
                    win.set_battery_voltage(vbat_val);
                    win.set_speed(speed_val);
                });
            }
        }
    });
}
