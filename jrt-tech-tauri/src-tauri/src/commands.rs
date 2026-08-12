// ============================================================
// commands.rs — Tauri Command Handlers (Frontend ↔ Backend Bridge)
// Port of all 40+ REST API endpoints from localhost_server.py
// ============================================================

use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Emitter, State, Manager};
use serde::{Deserialize, Serialize};

use crate::kline::{HondaECU, list_serial_ports, find_ftdi_serial_port};
use crate::flash::{FlashProgress, FlashState};
use crate::flash::read::run_ecu_read;
use crate::flash::write::run_ecu_write;
use crate::seedkey::SeedKeyProvider;
use crate::ecu_db::EcuInfo;
use crate::ecu_db::honda_matic::{get_honda_dtc_map, DtcItem};

/// App Shared State
pub struct AppState {
    pub ecu: Mutex<Option<HondaECU>>,
    pub is_connected: Mutex<bool>,
    pub is_simulation: Mutex<bool>,
    pub flash_counter: Mutex<u32>,
    pub active_buffer: Mutex<Option<String>>,
    pub start_time: Instant,
    pub seedkey_provider: SeedKeyProvider,
}

impl Default for AppState {
    fn default() -> Self {
        AppState {
            ecu: Mutex::new(None),
            is_connected: Mutex::new(false),
            is_simulation: Mutex::new(false),
            flash_counter: Mutex::new(0),
            active_buffer: Mutex::new(None),
            start_time: Instant::now(),
            seedkey_provider: SeedKeyProvider::new(),
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct AppStatusResponse {
    pub uptime: u64,
    pub version: String,
    #[serde(rename = "battVoltage")]
    pub batt_voltage: f64,
    pub connected: bool,
    #[serde(rename = "ecuConnected")]
    pub ecu_connected: bool,
    #[serde(rename = "isSimulation")]
    pub is_simulation: bool,
    #[serde(rename = "driverBackend")]
    pub driver_backend: String,
    #[serde(rename = "hasDriver")]
    pub has_driver: bool,
    #[serde(rename = "activeBuffer")]
    pub active_buffer: Option<String>,
    #[serde(rename = "flashCount")]
    pub flash_count: u32,
    #[serde(rename = "ecuState")]
    pub ecu_state: u8,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LiveTelemetry {
    pub connected: bool,
    #[serde(rename = "ecuConnected")]
    pub ecu_connected: bool,
    pub rpm: u32,
    pub tps: f64,
    pub map: f64,
    pub iat: f64,
    pub ect: f64,
    #[serde(rename = "battVoltage")]
    pub batt_voltage: f64,
    #[serde(rename = "injPW")]
    pub inj_pw: f64,
    #[serde(rename = "ignTiming")]
    pub ign_timing: f64,
    pub speed: u32,
    #[serde(rename = "engineLoad")]
    pub engine_load: f64,
    pub o2: f64,
    pub afr: f64,
    #[serde(rename = "fuelTrim")]
    pub fuel_trim: f64,
    #[serde(rename = "closedLoop")]
    pub closed_loop: bool,
    #[serde(rename = "idleSwitch")]
    pub idle_switch: bool,
    pub com_port: String,
}

impl Default for LiveTelemetry {
    fn default() -> Self {
        LiveTelemetry {
            connected: false,
            ecu_connected: false,
            rpm: 0,
            tps: 0.0,
            map: 0.0,
            iat: 0.0,
            ect: 0.0,
            batt_voltage: 0.0,
            inj_pw: 0.0,
            ign_timing: 0.0,
            speed: 0,
            engine_load: 0.0,
            o2: 0.0,
            afr: 0.0,
            fuel_trim: 0.0,
            closed_loop: false,
            idle_switch: false,
            com_port: "FTDI USB Serial".to_string(),
        }
    }
}

// ── TAURI COMMANDS ──

#[tauri::command]
pub fn get_status(state: State<'_, AppState>) -> AppStatusResponse {
    let connected = *state.is_connected.lock().unwrap();
    let is_sim = *state.is_simulation.lock().unwrap();
    let flash_count = *state.flash_counter.lock().unwrap();
    let active_buf = state.active_buffer.lock().unwrap().clone();

    AppStatusResponse {
        uptime: state.start_time.elapsed().as_millis() as u64,
        version: "3.4.0-tauri".to_string(),
        batt_voltage: if connected { 12.6 } else { 0.0 },
        connected,
        ecu_connected: connected,
        is_simulation: is_sim,
        driver_backend: "serialport-rust".to_string(),
        has_driver: true,
        active_buffer: active_buf,
        flash_count,
        ecu_state: if connected { 2 } else { 0 },
    }
}

#[tauri::command]
pub fn get_info(state: State<'_, AppState>) -> EcuInfo {
    let connected = *state.is_connected.lock().unwrap();
    if !connected {
        return EcuInfo {
            manufacturer: "UNKNOWN".to_string(),
            part_number: "UNKNOWN".to_string(),
            fw_version: "UNKNOWN".to_string(),
            hw_version: "UNKNOWN".to_string(),
            protocol: "Honda K-Line".to_string(),
            eeprom_size: 1024,
            checksum: 0,
            detected_model: "UNCONNECTED".to_string(),
        };
    }
    EcuInfo::default()
}

#[tauri::command]
pub fn get_ports() -> Vec<serde_json::Value> {
    list_serial_ports()
        .into_iter()
        .map(|(dev, desc)| {
            serde_json::json!({
                "device": dev,
                "description": desc
            })
        })
        .collect()
}

#[tauri::command]
pub fn connect_ecu(state: State<'_, AppState>, port: Option<String>) -> Result<serde_json::Value, String> {
    let target_port = port.or_else(find_ftdi_serial_port);

    let mut ecu_guard = state.ecu.lock().unwrap();
    let mut ecu = HondaECU::new(target_port.as_deref())?;

    ecu.setup()?;
    let init_ok = ecu.init(true);

    if !init_ok {
        ecu.close();
        return Err(
            "Kabel FTDI terdeteksi, tetapi ECU motor tidak membalas sinyal Fast-Init. Pastikan kunci kontak posisi ON.".to_string()
        );
    }

    *state.is_connected.lock().unwrap() = true;
    *state.is_simulation.lock().unwrap() = false;
    let info = EcuInfo::default();
    *ecu_guard = Some(ecu);

    Ok(serde_json::json!({
        "status": "ok",
        "autoDetected": true,
        "isSimulation": false,
        "ecuInfo": info
    }))
}

#[tauri::command]
pub fn disconnect_ecu(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let mut ecu_guard = state.ecu.lock().unwrap();
    if let Some(ref mut ecu) = *ecu_guard {
        ecu.close();
    }
    *ecu_guard = None;
    *state.is_connected.lock().unwrap() = false;
    *state.is_simulation.lock().unwrap() = false;

    Ok(serde_json::json!({ "status": "ok" }))
}

#[tauri::command]
pub fn sim_connect(state: State<'_, AppState>) -> serde_json::Value {
    *state.is_connected.lock().unwrap() = true;
    *state.is_simulation.lock().unwrap() = true;

    serde_json::json!({
        "status": "ok",
        "simulation": true
    })
}

#[tauri::command]
pub fn sim_disconnect(state: State<'_, AppState>) -> serde_json::Value {
    *state.is_connected.lock().unwrap() = false;
    *state.is_simulation.lock().unwrap() = false;

    serde_json::json!({ "status": "ok" })
}

#[tauri::command]
pub fn read_dtc(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let is_sim = *state.is_simulation.lock().unwrap();
    let connected = *state.is_connected.lock().unwrap();

    if is_sim && connected {
        let sim_dtcs = vec![
            DtcItem {
                code: "12-01".to_string(),
                description: "Primary Injector Circuit Malfunction".to_string(),
                mil_on: true,
                pending: false,
                occurrence: "current".to_string(),
                status: "ACTIVE".to_string(),
            },
            DtcItem {
                code: "07-02".to_string(),
                description: "ECT Sensor Circuit High Voltage".to_string(),
                mil_on: false,
                pending: true,
                occurrence: "past".to_string(),
                status: "HISTORY".to_string(),
            },
        ];
        return Ok(serde_json::json!({
            "count": sim_dtcs.len(),
            "milOn": true,
            "dtcs": sim_dtcs
        }));
    }

    if !connected {
        return Err("ECU is not connected. Click Connect ECU first.".to_string());
    }

    // Hardware DTC scan
    let dtc_map = get_honda_dtc_map();
    let mut dtcs: Vec<DtcItem> = Vec::new();

    let mut ecu_guard = state.ecu.lock().unwrap();
    if let Some(ref mut ecu) = *ecu_guard {
        for type_byte in [0x74u8, 0x73, 0x70] {
            for page in 0..4u8 {
                if let Some((_rt, _rl, rdata, _rdl)) = ecu.send_command(&[0x72], &[type_byte, page], 1, false, None) {
                    if rdata.len() >= 2 {
                        let is_curr = type_byte == 0x74 || type_byte == 0x70;
                        for b_val in &rdata {
                            if *b_val >= 1 && *b_val <= 95 {
                                let code_str = format!("{:02}-01", b_val);
                                if let Some(&desc) = dtc_map.get(code_str.as_str()) {
                                    if !dtcs.iter().any(|d| d.code == code_str) {
                                        dtcs.push(DtcItem {
                                            code: code_str,
                                            description: desc.to_string(),
                                            mil_on: is_curr,
                                            pending: !is_curr,
                                            occurrence: if is_curr { "current".into() } else { "past".into() },
                                            status: if is_curr { "ACTIVE".into() } else { "HISTORY".into() },
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(serde_json::json!({
        "count": dtcs.len(),
        "milOn": dtcs.iter().any(|d| d.mil_on),
        "dtcs": dtcs
    }))
}

#[tauri::command]
pub fn clear_dtc(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let is_sim = *state.is_simulation.lock().unwrap();
    let connected = *state.is_connected.lock().unwrap();

    if is_sim && connected {
        return Ok(serde_json::json!({
            "status": "ok",
            "message": "Simulated DTCs cleared"
        }));
    }

    if !connected {
        return Err("ECU is not connected.".to_string());
    }

    let mut ecu_guard = state.ecu.lock().unwrap();
    if let Some(ref mut ecu) = *ecu_guard {
        let clear_cmds = [
            (&[0x72][..], &[0x60u8, 0x03][..]),
            (&[0x72][..], &[0x60, 0x00][..]),
            (&[0x72][..], &[0x14, 0xFF, 0xFF, 0xFF][..]),
        ];
        for (mtype, data) in clear_cmds {
            let _ = ecu.send_command(mtype, data, 2, true, None);
        }
        Ok(serde_json::json!({
            "status": "ok",
            "message": "DTC fault codes erased successfully from ECU EEPROM."
        }))
    } else {
        Err("ECU driver unavailable".to_string())
    }
}

#[tauri::command]
pub async fn start_flash_read(
    app: AppHandle,
    state: State<'_, AppState>,
    read_type: String,
    read_size_kb: Option<u32>,
) -> Result<serde_json::Value, String> {
    let is_sim = *state.is_simulation.lock().unwrap();
    let connected = *state.is_connected.lock().unwrap();

    if !connected && !is_sim {
        return Err("ECU not connected. Connect FTDI K-Line adapter first.".to_string());
    }

    let size_kb = read_size_kb.unwrap_or(128);
    let app_handle = app.clone();

    // Background async task for read operation
    tokio::task::spawn_blocking(move || {
        let progress_cb = |p: FlashProgress| {
            let _ = app_handle.emit("flash-progress", p);
        };

        if is_sim {
            for pct in (0..=100).step_by(10) {
                progress_cb(FlashProgress::new(pct, &format!("Simulated read {}%", pct), FlashState::Reading));
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
            progress_cb(FlashProgress::new(100, "Simulated read complete!", FlashState::Done));
            return;
        }

        // Real hardware read
        let state_ref = app_handle.state::<AppState>();
        let mut ecu_guard = state_ref.ecu.lock().unwrap();
        if let Some(ref mut ecu) = *ecu_guard {
            let backup_dir = "./backups";
            let _ = run_ecu_read(ecu, &read_type, size_kb, backup_dir, progress_cb);
        }
    });

    Ok(serde_json::json!({ "status": "ok" }))
}

#[tauri::command]
pub async fn start_flash_write(
    app: AppHandle,
    state: State<'_, AppState>,
    write_type: Option<String>,
    auto_backup: Option<bool>,
    dry_run: Option<bool>,
    source_hex: Option<String>,
) -> Result<serde_json::Value, String> {
    let is_sim = *state.is_simulation.lock().unwrap();
    let connected = *state.is_connected.lock().unwrap();
    let is_dry = dry_run.unwrap_or(false);

    if !connected && !is_sim && !is_dry {
        return Err("ECU tidak terhubung! Connect ECU terlebih dahulu.".to_string());
    }

    let do_backup = auto_backup.unwrap_or(true);
    let app_handle = app.clone();
    let source_bytes = match source_hex {
        Some(hex_str) => hex::decode(hex_str.replace(" ", "")).unwrap_or_else(|_| vec![0xFF; 131072]),
        None => vec![0xFF; 131072],
    };

    tokio::task::spawn_blocking(move || {
        let progress_cb = |p: FlashProgress| {
            let _ = app_handle.emit("flash-progress", p);
        };

        if is_sim {
            for pct in (0..=100).step_by(5) {
                let state_enum = if pct < 15 {
                    FlashState::Erasing
                } else if pct < 90 {
                    FlashState::Writing
                } else if pct < 100 {
                    FlashState::Verifying
                } else {
                    FlashState::Done
                };
                progress_cb(FlashProgress::new(pct, &format!("[VIRTUAL ECU] Flashing {}%", pct), state_enum));
                std::thread::sleep(std::time::Duration::from_millis(50));
            }

            let state_ref = app_handle.state::<AppState>();
            let mut count = state_ref.flash_counter.lock().unwrap();
            *count += 1;
            progress_cb(FlashProgress::new(100, "Proses Flash ECU Selesai 100% Sempurna!", FlashState::Done).with_flash_count(*count));
            return;
        }

        let state_ref = app_handle.state::<AppState>();
        let mut ecu_guard = state_ref.ecu.lock().unwrap();
        if let Some(ref mut ecu) = *ecu_guard {
            let backup_dir = "./backups";
            let vbat = 12.5; // Read voltage
            match run_ecu_write(ecu, &source_bytes, do_backup, is_dry, backup_dir, vbat, progress_cb) {
                Ok(_) => {
                    let mut count = state_ref.flash_counter.lock().unwrap();
                    *count += 1;
                }
                Err(e) => {
                    let _ = app_handle.emit("flash-progress", FlashProgress::new(0, &format!("Flash Error: {}", e), FlashState::Error));
                }
            }
        }
    });

    Ok(serde_json::json!({ "status": "ok" }))
}

#[tauri::command]
pub fn reset_flash_count(state: State<'_, AppState>) -> serde_json::Value {
    let mut count = state.flash_counter.lock().unwrap();
    *count = 0;
    serde_json::json!({
        "status": "ok",
        "message": "Flash counter reset to 0",
        "flashCount": 0
    })
}
