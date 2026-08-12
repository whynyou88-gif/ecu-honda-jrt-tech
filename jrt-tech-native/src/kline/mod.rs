// ============================================================
// kline/mod.rs — Honda K-Line Driver (serialport crate)
// ============================================================

pub mod protocol;

use std::time::{Duration, Instant};
use serialport::{SerialPort, SerialPortType};
use log::info;
use protocol::{checksum8bit_honda, format_message};

pub struct HondaECU {
    port: Option<Box<dyn SerialPort>>,
    port_name: String,
    pub active_table: u8,
}

impl HondaECU {
    pub fn new(device_id: Option<&str>) -> Result<Self, String> {
        let port_name = match device_id {
            Some(id) => id.to_string(),
            None => find_ftdi_serial_port().ok_or(
                "No FTDI USB serial port found. Check cable connection.".to_string()
            )?,
        };

        let port = serialport::new(&port_name, 10400)
            .data_bits(serialport::DataBits::Eight)
            .stop_bits(serialport::StopBits::One)
            .parity(serialport::Parity::None)
            .timeout(Duration::from_millis(20))
            .open()
            .map_err(|e| format!("Failed to open serial port {}: {}", port_name, e))?;

        info!("[SERIAL] Opened port {} at 10400 baud", port_name);

        Ok(HondaECU {
            port: Some(port),
            port_name,
            active_table: 0x17,
        })
    }

    pub fn close(&mut self) {
        self.port = None;
    }

    pub fn setup(&mut self) -> Result<(), String> {
        let port = self.port.as_mut().ok_or("Port not open".to_string())?;
        let _ = port.write_data_terminal_ready(true);
        let _ = port.write_request_to_send(true);
        let _ = port.clear(serialport::ClearBuffer::All);
        Ok(())
    }

    fn send_break(&mut self, duration_ms: u64) -> Result<(), String> {
        if let Some(port) = self.port.as_mut() {
            let _ = port.set_break();
            std::thread::sleep(Duration::from_millis(duration_ms));
            let _ = port.clear_break();
            std::thread::sleep(Duration::from_millis(120));
            let _ = port.clear(serialport::ClearBuffer::All);
            Ok(())
        } else {
            Err("Port not open".to_string())
        }
    }

    pub fn send_raw_kline(&mut self, msg: &[u8], timeout_ms: u64) -> Option<Vec<u8>> {
        let port = self.port.as_mut()?;
        let _ = port.clear(serialport::ClearBuffer::Input);
        if port.write_all(msg).is_err() { return None; }
        let _ = port.flush();

        let start = Instant::now();
        let timeout = Duration::from_millis(timeout_ms);
        let mut raw_buf: Vec<u8> = Vec::with_capacity(256);

        while start.elapsed() < timeout {
            let mut chunk = [0u8; 128];
            match port.read(&mut chunk) {
                Ok(n) if n > 0 => {
                    raw_buf.extend_from_slice(&chunk[..n]);
                    if raw_buf.len() >= msg.len() && raw_buf.starts_with(msg) {
                        let payload = &raw_buf[msg.len()..];
                        if payload.len() >= 3 {
                            let expected_len = payload[1] as usize;
                            if (3..=100).contains(&expected_len) && payload.len() >= expected_len {
                                return Some(payload[..expected_len].to_vec());
                            }
                        }
                    } else if raw_buf.len() >= 3 && (msg.is_empty() || raw_buf[0] != msg[0]) {
                        let expected_len = raw_buf[1] as usize;
                        if (3..=100).contains(&expected_len) && raw_buf.len() >= expected_len {
                            return Some(raw_buf[..expected_len].to_vec());
                        }
                    }
                }
                _ => {
                    std::thread::sleep(Duration::from_millis(2));
                }
            }
        }
        None
    }

    pub fn init(&mut self, _debug: bool) -> bool {
        for tbl in [0x17u8, 0x11, 0x67] {
            let (msg, _, _) = format_message(&[0x72], &[0x71, tbl]);
            if let Some(rx) = self.send_raw_kline(&msg, 100) {
                if rx.len() >= 5 && rx[rx.len() - 1] == checksum8bit_honda(&rx[..rx.len() - 1]) {
                    self.active_table = tbl;
                    return true;
                }
            }
        }

        if self.send_break(70).is_ok() {
            let wakeup = [0xFEu8, 0x04, 0x72, 0x8C];
            let _ = self.send_raw_kline(&wakeup, 200);

            let init_cmd = [0x72u8, 0x05, 0x00, 0xF0, 0x99];
            if let Some(rx_init) = self.send_raw_kline(&init_cmd, 200) {
                if rx_init.len() >= 3 && rx_init[rx_init.len() - 1] == checksum8bit_honda(&rx_init[..rx_init.len() - 1]) {
                    self.active_table = 0x17;
                    return true;
                }
            }
        }
        false
    }

    pub fn send_command(
        &mut self,
        mtype: &[u8],
        data: &[u8],
        retries: u32,
        debug: bool,
        timeout_ms: Option<u64>,
    ) -> Option<(Vec<u8>, u8, Vec<u8>, usize)> {
        let (msg, ml, _dl) = format_message(mtype, data);
        let max_attempts = if retries > 0 { retries } else { 1 };
        let t_out = timeout_ms.unwrap_or(350);

        for _attempt in 1..=max_attempts {
            let port = self.port.as_mut()?;
            let _ = port.clear(serialport::ClearBuffer::Input);
            if port.write_all(&msg).is_err() { continue; }
            let _ = port.flush();

            let start = Instant::now();
            let timeout = Duration::from_millis(t_out);
            let mut raw_buf: Vec<u8> = Vec::with_capacity(256);
            let msg_bytes = msg.as_slice();

            while start.elapsed() < timeout {
                let mut chunk = [0u8; 128];
                match port.read(&mut chunk) {
                    Ok(n) if n > 0 => {
                        raw_buf.extend_from_slice(&chunk[..n]);
                        if raw_buf.starts_with(msg_bytes) {
                            let payload = &raw_buf[msg_bytes.len()..];
                            if payload.len() > ml {
                                let expected_len = payload[ml] as usize;
                                if (3..=100).contains(&expected_len) && payload.len() >= expected_len {
                                    let resp = &payload[..expected_len];
                                    let rmtype = resp[..ml].to_vec();
                                    let rml = resp[ml];
                                    let rdl = (rml as usize).saturating_sub(2 + ml);
                                    let rdata = resp[ml + 1..resp.len() - 1].to_vec();
                                    return Some((rmtype, rml, rdata, rdl));
                                }
                            }
                        }
                    }
                    _ => { std::thread::sleep(Duration::from_millis(1)); }
                }
            }
        }
        None
    }
}

pub fn find_ftdi_serial_port() -> Option<String> {
    #[cfg(unix)]
    {
        for pattern in &[
            "/dev/cu.usbserial*",
            "/dev/cu.usbmodem*",
            "/dev/tty.usbserial*",
        ] {
            if let Ok(paths) = glob::glob(pattern) {
                for entry in paths.flatten() {
                    return Some(entry.to_string_lossy().to_string());
                }
            }
        }
    }

    if let Ok(ports) = serialport::available_ports() {
        for p in &ports {
            if matches!(p.port_type, SerialPortType::UsbPort(_)) {
                return Some(p.port_name.clone());
            }
        }
    }
    None
}

pub fn list_serial_ports() -> Vec<(String, String)> {
    let mut result = Vec::new();
    if let Ok(ports) = serialport::available_ports() {
        for p in &ports {
            result.push((p.port_name.clone(), "FTDI UART Serial Port".to_string()));
        }
    }
    result
}

unsafe impl Send for HondaECU {}
