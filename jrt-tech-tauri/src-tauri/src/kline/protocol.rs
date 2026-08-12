// ============================================================
// kline/protocol.rs — Honda K-Line Protocol Utilities
// Exact port of Python checksum, framing, and address formatting
// ============================================================

/// Honda 8-bit checksum: ((sum(data) ^ 0xFF) + 1) & 0xFF
pub fn checksum8bit_honda(data: &[u8]) -> u8 {
    let sum: u32 = data.iter().map(|&b| b as u32).sum();
    ((sum ^ 0xFF).wrapping_add(1) & 0xFF) as u8
}

/// Standard 8-bit checksum: (0x100 - (sum(data) & 0xFF)) & 0xFF
pub fn checksum8bit(data: &[u8]) -> u8 {
    let sum: u32 = data.iter().map(|&b| b as u32).sum();
    (0x100u32.wrapping_sub(sum & 0xFF) & 0xFF) as u8
}

/// Format Honda K-Line message: mtype + [msgsize] + data + [checksum]
/// Returns (full_msg, mtype_len, data_len)
pub fn format_message(mtype: &[u8], data: &[u8]) -> (Vec<u8>, usize, usize) {
    let ml = mtype.len();
    let dl = data.len();
    let msgsize = (0x02 + ml + dl) as u8;

    let mut msg: Vec<u8> = Vec::with_capacity(ml + 1 + dl + 1);
    msg.extend_from_slice(mtype);
    msg.push(msgsize);
    msg.extend_from_slice(data);

    let cksum = checksum8bit_honda(&msg);
    msg.push(cksum);

    debug_assert_eq!(msg[ml] as usize, msg.len());

    (msg, ml, dl)
}

/// Format memory read address for Honda ECU read commands
/// Converts 32-bit location to [byte1, byte3, byte2] format
pub fn format_read(location: u32) -> Vec<u8> {
    let bytes = location.to_be_bytes(); // [b0, b1, b2, b3]
    vec![bytes[1], bytes[3], bytes[2]]
}

/// Validate Honda checksum on a message buffer.
/// Returns (data, found_checksum, calculated_checksum, was_fixed)
pub fn validate_checksum(data: &mut Vec<u8>, fix: bool) -> (u8, u8, bool) {
    if data.len() < 9 {
        return (0, 0, false);
    }
    let cksum_pos = data.len() - 8;
    let found = data[cksum_pos];

    // Calculate checksum over all bytes except the checksum byte itself
    let mut check_data = data[..cksum_pos].to_vec();
    check_data.extend_from_slice(&data[cksum_pos + 1..]);
    let calculated = checksum8bit_honda(&check_data);

    let mut fixed = false;
    if fix && found != calculated {
        data[cksum_pos] = calculated;
        fixed = true;
    }

    (found, calculated, fixed)
}

/// Convert binary bytes to Intel HEX format string
pub fn bin_to_intel_hex(buffer: &[u8]) -> String {
    let mut lines: Vec<String> = Vec::new();
    let chunk_size = 16;

    for (i, chunk) in buffer.chunks(chunk_size).enumerate() {
        let addr = (i * chunk_size) as u16;
        let length = chunk.len() as u8;
        let record_type: u8 = 0x00;

        let mut record = vec![length, (addr >> 8) as u8, addr as u8, record_type];
        record.extend_from_slice(chunk);
        let checksum = ((!record.iter().map(|&b| b as u32).sum::<u32>()).wrapping_add(1) & 0xFF) as u8;

        let hex_data: String = chunk.iter().map(|b| format!("{:02X}", b)).collect();
        lines.push(format!(":{:02X}{:04X}{:02X}{}{:02X}", length, addr, record_type, hex_data, checksum));
    }

    lines.push(":00000001FF".to_string()); // EOF
    lines.join("\n")
}

/// Parse Intel HEX text string to binary buffer
pub fn intel_hex_to_bin(hex_str: &str) -> Vec<u8> {
    let mut buffer = vec![0xFFu8; 131072]; // 128KB default
    let mut max_addr: usize = 0;

    for line in hex_str.lines() {
        let line = line.trim();
        if !line.starts_with(':') || line.len() < 11 {
            continue;
        }
        let length = u8::from_str_radix(&line[1..3], 16).unwrap_or(0) as usize;
        let addr = u16::from_str_radix(&line[3..7], 16).unwrap_or(0) as usize;
        let rectype = u8::from_str_radix(&line[7..9], 16).unwrap_or(0);

        if rectype == 0x01 {
            break; // EOF
        }
        if rectype == 0x00 {
            let data_hex = &line[9..9 + (length * 2)];
            for i in 0..length {
                if let Ok(byte) = u8::from_str_radix(&data_hex[i * 2..i * 2 + 2], 16) {
                    let pos = addr + i;
                    if pos < buffer.len() {
                        buffer[pos] = byte;
                    }
                    if pos + 1 > max_addr {
                        max_addr = pos + 1;
                    }
                }
            }
        }
    }

    buffer.truncate(max_addr.max(32768));
    buffer
}

/// Decode KWP2000 / UDS Negative Response Code
pub fn decode_nrc(nrc: u8) -> &'static str {
    match nrc {
        0x10 => "General Reject",
        0x11 => "Service Not Supported",
        0x12 => "SubFunction Not Supported",
        0x13 => "Incorrect Message Length Or Invalid Format",
        0x21 => "Busy Repeat Request",
        0x22 => "Conditions Not Correct Or Request Sequence Error",
        0x31 => "Request Out Of Range",
        0x33 => "Security Access Denied / Invalid Key",
        0x35 => "Invalid Key / Passcode Unmatched",
        0x36 => "Exceed Number Of Attempts",
        0x37 => "Required Time Delay Not Expired",
        0x70 => "Upload Download Not Accepted",
        0x71 => "Transfer Data Suspended",
        0x72 => "General Programming Failure (Flash Memory Lock Error)",
        0x78 => "Response Pending (ECU Erasing Flash Sector...)",
        _ => "Unknown NRC Code",
    }
}

/// Check if response data contains NRC (Negative Response Code 0x7F)
pub fn is_nrc_response(rdata: &[u8]) -> Option<u8> {
    if rdata.len() >= 2 && rdata[0] == 0x7F {
        Some(rdata[1])
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_checksum_honda() {
        // Known test: sum([0x72, 0x05, 0x00, 0xF0]) ^ 0xFF + 1 = 0x99
        assert_eq!(checksum8bit_honda(&[0x72, 0x05, 0x00, 0xF0]), 0x99);
    }

    #[test]
    fn test_format_message() {
        let (msg, ml, dl) = format_message(&[0x72], &[0x71, 0x17]);
        assert_eq!(ml, 1);
        assert_eq!(dl, 2);
        assert_eq!(msg[ml] as usize, msg.len()); // message length byte
        assert_eq!(msg[msg.len() - 1], checksum8bit_honda(&msg[..msg.len() - 1]));
    }

    #[test]
    fn test_format_read() {
        let result = format_read(0x00008000);
        assert_eq!(result, vec![0x00, 0x00, 0x80]);
    }
}
