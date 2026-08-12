// ============================================================
// kline/protocol.rs — Honda K-Line Protocol Utilities
// Exact port of Python checksums, framing, and address formatting
// ============================================================

pub fn checksum8bit_honda(data: &[u8]) -> u8 {
    let sum: u32 = data.iter().map(|&b| b as u32).sum();
    ((sum ^ 0xFF).wrapping_add(1) & 0xFF) as u8
}

pub fn checksum8bit(data: &[u8]) -> u8 {
    let sum: u32 = data.iter().map(|&b| b as u32).sum();
    (0x100u32.wrapping_sub(sum & 0xFF) & 0xFF) as u8
}

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

    (msg, ml, dl)
}

pub fn format_read(location: u32) -> Vec<u8> {
    let bytes = location.to_be_bytes();
    vec![bytes[1], bytes[3], bytes[2]]
}

pub fn decode_nrc(nrc: u8) -> &'static str {
    match nrc {
        0x10 => "General Reject",
        0x11 => "Service Not Supported",
        0x12 => "SubFunction Not Supported",
        0x13 => "Incorrect Message Length",
        0x21 => "Busy Repeat Request",
        0x22 => "Conditions Not Correct",
        0x31 => "Request Out Of Range",
        0x33 => "Security Access Denied",
        0x35 => "Invalid Key",
        0x72 => "General Programming Failure",
        0x78 => "Response Pending (ECU Erasing Sector...)",
        _ => "Unknown NRC Code",
    }
}

pub fn is_nrc_response(rdata: &[u8]) -> Option<u8> {
    if rdata.len() >= 2 && rdata[0] == 0x7F {
        Some(rdata[1])
    } else {
        None
    }
}
