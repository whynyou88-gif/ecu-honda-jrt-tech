// ============================================================
// kline/mod.rs — Honda K-Line ECU Communication Driver
// Port of HondaECU_Serial.py (PySerial backend) to Rust
// Protocol: Honda PGM-FI KWP2000 Fast-Init over K-Line
// Baud: 10400, 8N1
// ============================================================

pub mod protocol;

use std::time::{Duration, Instant};
use serialport::{SerialPort, SerialPortType};
use log::{info, warn};

use protocol::{checksum8bit_honda, format_message};

/// Honda ECU K-Line driver using serialport crate
pub struct HondaECU {
    port: Option<Box<dyn SerialPort>>,
    port_name: String,
    pub active_table: u8,
    pub error_count: u32,
    pub resets: u32,
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

        info!("[SERIAL] Opened port {} at 10400 baud (timeout=20ms)", port_name);

        Ok(HondaECU {
            port: Some(port),
            port_name,
            active_table: 0x17,
            error_count: 0,
            resets: 0,
        })
    }

    pub fn port_name(&self) -> &str {
        &self.port_name
    }

    pub fn close(&mut self) {
        self.port = None;
        info!("[SERIAL] Port {} closed", self.port_name);
    }

    pub fn setup(&mut self) -> Result<(), String> {
        if self.port.is_none() {
            return Err("Serial port not open".to_string());
        }
        let port = self.port.as_mut().unwrap();

        // Set DTR/RTS HIGH to supply 5V VCC power rail to FTDI active level shifter
        let _ = port.write_data_terminal_ready(true);
        let _ = port.write_request_to_send(true);
        info!("[SERIAL] DTR/RTS set to HIGH (5V VCC Transceiver Power)");

        // Flush buffers
        let _ = port.clear(serialport::ClearBuffer::All);
        info!("[SERIAL] Setup complete on {}", self.port_name);
        Ok(())
    }

    /// Send exact Honda K-Line Fast-Init break pulse (70ms LOW, 120ms HIGH)
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

    /// Send raw byte sequence over single-wire K-Line, handle echo, return ECU response
    pub fn send_raw_kline(&mut self, msg: &[u8], timeout_ms: u64) -> Option<Vec<u8>> {
        let port = self.port.as_mut()?;
        let _ = port.clear(serialport::ClearBuffer::Input);
        if port.write_all(msg).is_err() {
            return None;
        }
        let _ = port.flush();

        let start = Instant::now();
        let timeout = Duration::from_millis(timeout_ms);
        let mut raw_buf: Vec<u8> = Vec::with_capacity(256);

        while start.elapsed() < timeout {
            let mut chunk = [0u8; 128];
            match port.read(&mut chunk) {
                Ok(n) if n > 0 => {
                    raw_buf.extend_from_slice(&chunk[..n]);

                    // Case A: TX echo present at beginning
                    if raw_buf.len() >= msg.len() && raw_buf.starts_with(msg) {
                        let payload = &raw_buf[msg.len()..];
                        if payload.len() >= 3 {
                            let expected_len = payload[1] as usize;
                            if (3..=100).contains(&expected_len) && payload.len() >= expected_len {
                                return Some(payload[..expected_len].to_vec());
                            }
                        }
                    }
                    // Case B: Echo suppressed by hardware
                    else if raw_buf.len() >= 3 && (msg.is_empty() || raw_buf[0] != msg[0]) {
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

        // Final extraction attempt
        if raw_buf.len() >= msg.len() && raw_buf.starts_with(msg) {
            let payload = &raw_buf[msg.len()..];
            if payload.len() >= 3 {
                return Some(payload.to_vec());
            }
        } else if raw_buf.len() >= 3 {
            return Some(raw_buf);
        }

        None
    }

    /// Initialize Honda K-Line communication using ISO 14230 / Honda Fast-Init
    pub fn init(&mut self, _debug: bool) -> bool {
        // 1. DIRECT AWAKE PROBE — if ECU is already awake
        for tbl in [0x17u8, 0x11, 0x67] {
            let (msg, _, _) = format_message(&[0x72], &[0x71, tbl]);
            if let Some(rx) = self.send_raw_kline(&msg, 100) {
                if rx.len() >= 5 && rx[rx.len() - 1] == checksum8bit_honda(&rx[..rx.len() - 1]) {
                    self.active_table = tbl;
                    info!("[HONDA K-LINE] ECU already awake! Direct probe Table 0x{:02X}", tbl);
                    return true;
                }
            }
        }

        // 2. FAST-INIT BREAK PULSE (70ms LOW, 120ms HIGH)
        if self.send_break(70).is_ok() {
            let _ = self.port.as_mut().map(|p| p.clear(serialport::ClearBuffer::All));

            // Wake Up: FE 04 72 8C
            let wakeup = [0xFEu8, 0x04, 0x72, 0x8C];
            let _rx_wakeup = self.send_raw_kline(&wakeup, 200);

            // Session Init: 72 05 00 F0 99
            let init_cmd = [0x72u8, 0x05, 0x00, 0xF0, 0x99];
            if let Some(rx_init) = self.send_raw_kline(&init_cmd, 200) {
                if rx_init.len() >= 3
                    && rx_init[rx_init.len() - 1] == checksum8bit_honda(&rx_init[..rx_init.len() - 1])
                {
                    self.active_table = 0x17;
                    info!("[HONDA K-LINE] Fast-Init Handshake OK!");
                    return true;
                }
            }
        }

        // 3. Fallback direct telemetry probe
        for tbl in [0x17u8, 0x11, 0x67, 0x10, 0x00] {
            let (msg, _, _) = format_message(&[0x72], &[0x71, tbl]);
            if let Some(rx) = self.send_raw_kline(&msg, 150) {
                if rx.len() >= 5 && rx[rx.len() - 1] == checksum8bit_honda(&rx[..rx.len() - 1]) {
                    self.active_table = tbl;
                    info!("[HONDA K-LINE] Fallback probe connected Table 0x{:02X}", tbl);
                    return true;
                }
            }
        }

        false
    }

    /// Send command to ECU with strict Honda 8-bit checksum validation
    /// Returns (rmtype, rml_byte, rdata, rdl)
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

        for attempt in 1..=max_attempts {
            if debug {
                let hex_str: String = msg.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join("");
                info!("> [TX] [{}]", hex_str);
            }

            // Send and receive
            let port = self.port.as_mut()?;
            let _ = port.clear(serialport::ClearBuffer::Input);
            if port.write_all(&msg).is_err() {
                continue;
            }
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

                        // Case A: TX echo present
                        if raw_buf.starts_with(msg_bytes) {
                            let payload = &raw_buf[msg_bytes.len()..];
                            if payload.len() > ml {
                                let expected_len = payload[ml] as usize;
                                if (3..=100).contains(&expected_len) && payload.len() >= expected_len {
                                    let resp = &payload[..expected_len];
                                    // Checksum validation
                                    if mtype == [0xFE] || mtype == [0xfe] {
                                        // Wakeup — skip checksum
                                    } else {
                                        let expected_cksum = checksum8bit_honda(&resp[..resp.len() - 1]);
                                        if resp[resp.len() - 1] != expected_cksum {
                                            if debug {
                                                warn!(" ! Checksum Error attempt {}/{}", attempt, max_attempts);
                                            }
                                            break; // retry
                                        }
                                    }
                                    let rmtype = resp[..ml].to_vec();
                                    let rml = resp[ml];
                                    let rdl = (rml as usize).saturating_sub(2 + ml);
                                    let rdata = resp[ml + 1..resp.len() - 1].to_vec();

                                    if debug {
                                        let hex_str: String = resp.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join("");
                                        info!("< [RX] [{}]", hex_str);
                                    }
                                    return Some((rmtype, rml, rdata, rdl));
                                }
                            }
                        }
                        // Case B: No echo
                        else if raw_buf.len() > ml && (msg_bytes.is_empty() || raw_buf[0] != msg_bytes[0]) {
                            let expected_len = raw_buf[ml] as usize;
                            if (3..=100).contains(&expected_len) && raw_buf.len() >= expected_len {
                                let resp = &raw_buf[..expected_len];
                                if mtype != [0xFE] && mtype != [0xfe] {
                                    let expected_cksum = checksum8bit_honda(&resp[..resp.len() - 1]);
                                    if resp[resp.len() - 1] != expected_cksum {
                                        break;
                                    }
                                }
                                let rmtype = resp[..ml].to_vec();
                                let rml = resp[ml];
                                let rdl = (rml as usize).saturating_sub(2 + ml);
                                let rdata = resp[ml + 1..resp.len() - 1].to_vec();
                                return Some((rmtype, rml, rdata, rdl));
                            }
                        }
                    }
                    _ => {
                        std::thread::sleep(Duration::from_millis(1));
                    }
                }
            }

            let _ = self.port.as_mut().map(|p| p.clear(serialport::ClearBuffer::Input));
            std::thread::sleep(Duration::from_millis(5));
        }

        None
    }

    // Flash programming init sequences — ported exactly from Python

    pub fn do_init_recover(&mut self, debug: bool) {
        self.send_command(&[0x7b], &[0x00, 0x01, 0x03], 1, debug, None);
        self.send_command(&[0x7b], &[0x00, 0x01, 0x01], 1, debug, None);
        self.send_command(&[0x7b], &[0x00, 0x01, 0x02], 1, debug, None);
        self.send_command(&[0x7b], &[0x00, 0x01, 0x03], 1, debug, None);
        self.send_command(&[0x7b], &[0x00, 0x02, 0x76, 0x03, 0x17], 1, debug, None);
        self.send_command(&[0x7b], &[0x00, 0x03, 0x75, 0x05, 0x13], 1, debug, None);
    }

    pub fn do_init_write(&mut self, debug: bool) {
        self.send_command(&[0x7d], &[0x01, 0x01, 0x00], 1, debug, None);
        self.send_command(&[0x7d], &[0x01, 0x01, 0x01], 1, debug, None);
        self.send_command(&[0x7d], &[0x01, 0x01, 0x02], 1, debug, None);
        self.send_command(&[0x7d], &[0x01, 0x01, 0x03], 1, debug, None);
        self.send_command(&[0x7d], &[0x01, 0x02, 0x50, 0x47, 0x4d], 1, debug, None);
        self.send_command(&[0x7d], &[0x01, 0x03, 0x2d, 0x46, 0x49], 1, debug, None);
    }

    pub fn do_pre_write(&mut self, debug: bool) {
        self.send_command(&[0x7e], &[0x01, 0x01, 0x00], 1, debug, None);
        std::thread::sleep(Duration::from_secs(11));
        self.send_command(&[0x7e], &[0x01, 0x02], 1, debug, None);
        self.send_command(&[0x7e], &[0x01, 0x03, 0x00, 0x00], 1, debug, None);
        self.send_command(&[0x7e], &[0x01, 0x01, 0x00], 1, debug, None);
        self.send_command(&[0x7e], &[0x01, 0x0b, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff], 1, debug, None);
        self.send_command(&[0x7e], &[0x01, 0x01, 0x00], 1, debug, None);
        self.send_command(&[0x7e], &[0x01, 0x0e, 0x01, 0x90], 1, debug, None);
        self.send_command(&[0x7e], &[0x01, 0x01, 0x01], 1, debug, None);
        self.send_command(&[0x7e], &[0x01, 0x04, 0xff], 1, debug, None);
        self.send_command(&[0x7e], &[0x01, 0x01, 0x00], 1, debug, None);
    }

    pub fn do_pre_write_wait(&mut self, debug: bool) {
        loop {
            if let Some((_rmtype, _rml, rdata, _rdl)) = self.send_command(&[0x7e], &[0x01, 0x05], 1, debug, None) {
                if rdata.len() > 1 && rdata[1] == 0x00 {
                    break;
                }
            }
        }
        self.send_command(&[0x7e], &[0x01, 0x01, 0x00], 1, debug, None);
    }
}

/// Auto-detect USB serial port (FTDI, CH340, CP2102, PL2303) on macOS/Linux/Windows
pub fn find_ftdi_serial_port() -> Option<String> {
    // 1. Search via glob on Unix
    #[cfg(unix)]
    {
        for pattern in &[
            "/dev/cu.usbserial*",
            "/dev/cu.usbmodem*",
            "/dev/cu.wchusbserial*",
            "/dev/cu.SLAB_USBtoUART*",
            "/dev/cu.usb*",
            "/dev/tty.usbserial*",
            "/dev/tty.usbmodem*",
        ] {
            if let Ok(paths) = glob::glob(pattern) {
                for entry in paths.flatten() {
                    return Some(entry.to_string_lossy().to_string());
                }
            }
        }
    }

    // 2. Search via serialport listing
    if let Ok(ports) = serialport::available_ports() {
        for p in &ports {
            let name_lower = p.port_name.to_lowercase();
            match &p.port_type {
                SerialPortType::UsbPort(info) => {
                    // FTDI=0x0403, CH340=0x1a86, CP210x=0x10c4, PL2303=0x067b
                    if matches!(info.vid, 0x0403 | 0x1a86 | 0x10c4 | 0x067b) {
                        return Some(p.port_name.clone());
                    }
                    let desc = info.product.as_deref().unwrap_or("").to_lowercase();
                    let mfr = info.manufacturer.as_deref().unwrap_or("").to_lowercase();
                    if desc.contains("ftdi") || desc.contains("ch340") || desc.contains("cp210")
                        || mfr.contains("ftdi") || name_lower.contains("usbserial")
                        || name_lower.contains("usbmodem")
                    {
                        return Some(p.port_name.clone());
                    }
                }
                _ => {
                    if name_lower.contains("usbserial") || name_lower.contains("usbmodem") {
                        return Some(p.port_name.clone());
                    }
                }
            }
        }
    }

    None
}

/// List all available serial ports with descriptions
pub fn list_serial_ports() -> Vec<(String, String)> {
    let mut result = Vec::new();
    if let Ok(ports) = serialport::available_ports() {
        for p in &ports {
            let desc = match &p.port_type {
                SerialPortType::UsbPort(info) => {
                    format!(
                        "{} ({})",
                        info.product.as_deref().unwrap_or("USB Serial"),
                        info.manufacturer.as_deref().unwrap_or("Unknown")
                    )
                }
                _ => "Serial Port".to_string(),
            };
            result.push((p.port_name.clone(), desc));
        }
    }
    result
}

unsafe impl Send for HondaECU {}
