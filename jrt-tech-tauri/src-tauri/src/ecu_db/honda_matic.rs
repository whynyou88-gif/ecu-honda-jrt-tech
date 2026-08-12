// ============================================================
// ecu_db/honda_matic.rs — Honda ECU Models & DTC Database
// Contains ECM ID mappings, vehicle database, and DTC fault code database
// ============================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EcmIdInfo {
    pub model: String,
    pub year: String,
    pub pn: String,
    pub checksum: String,
    pub keihinaddr: Option<String>,
    pub vendor: Option<String>,
    pub mcu: Option<String>,
    pub cal_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VehicleInfo {
    pub identified: bool,
    pub manufacturer: String,
    pub vehicle_name: String,
    pub variant: String,
    pub production_year: String,
    pub engine_code: String,
    pub displacement_cc: String,
    pub engine_type: String,
    pub transmission: String,
    pub fuel_system: String,
    pub emission_standard: String,
    pub ecu_family: String,
    pub ecu_model: String,
    pub part_number: String,
    pub calibration_id: String,
    pub hardware_ver: String,
    pub software_ver: String,
    pub boot_ver: String,
    pub protocol: String,
    pub immobilizer_support: bool,
    pub svg_icon: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DtcItem {
    pub code: String,
    pub description: String,
    #[serde(rename = "milOn")]
    pub mil_on: bool,
    pub pending: bool,
    pub occurrence: String,
    pub status: String,
}

pub fn get_honda_dtc_map() -> HashMap<&'static str, &'static str> {
    let mut m = HashMap::new();
    m.insert("01-01", "MAP Sensor (Manifold Absolute Pressure) Circuit Low Voltage");
    m.insert("01-02", "MAP Sensor (Manifold Absolute Pressure) Circuit High Voltage");
    m.insert("02-01", "CKP Sensor (Crankshaft Position) No Signal");
    m.insert("02-02", "CKP Sensor (Crankshaft Position) Intermittent Signal");
    m.insert("03-01", "TDC Sensor (Top Dead Center) No Signal");
    m.insert("03-02", "TDC Sensor (Top Dead Center) Intermittent Signal");
    m.insert("04-01", "CYP Sensor (Cylinder Position) No Signal");
    m.insert("04-02", "CYP Sensor (Cylinder Position) Intermittent Signal");
    m.insert("07-01", "ECT Sensor (Engine Coolant Temperature) Circuit Low Voltage / Short to Ground");
    m.insert("07-02", "ECT Sensor (Engine Coolant Temperature) Circuit High Voltage / Open Circuit");
    m.insert("08-01", "TPS (Throttle Position Sensor) Circuit Low Voltage / Short to Ground");
    m.insert("08-02", "TPS (Throttle Position Sensor) Circuit High Voltage / Open Circuit");
    m.insert("09-01", "IAT Sensor (Intake Air Temperature) Circuit Low Voltage / Short to Ground");
    m.insert("09-02", "IAT Sensor (Intake Air Temperature) Circuit High Voltage / Open Circuit");
    m.insert("10-01", "Front Wheel Speed Sensor Circuit No Signal");
    m.insert("10-02", "Front Wheel Speed Sensor Circuit Intermittent");
    m.insert("10-03", "Front Wheel Speed Sensor Circuit Short to Ground");
    m.insert("10-04", "Front Wheel Speed Sensor Circuit Open");
    m.insert("11-01", "VSS (Vehicle Speed Sensor) Circuit No Signal / Malfunction");
    m.insert("11-02", "VSS (Vehicle Speed Sensor) Intermittent Signal");
    m.insert("11-03", "VSS (Vehicle Speed Sensor) Circuit Short to Ground");
    m.insert("11-04", "VSS (Vehicle Speed Sensor) Circuit Short to Battery");
    m.insert("11-05", "VSS (Vehicle Speed Sensor) Circuit Open");
    m.insert("11-09", "Vehicle Speed Signal Implausible (Speed vs RPM Mismatch)");
    m.insert("12-01", "Primary Injector Circuit Malfunction / Open or Short");
    m.insert("12-02", "Primary Injector Circuit High Resistance");
    m.insert("13-01", "Secondary Injector Circuit Malfunction");
    m.insert("14-01", "Ignition Coil Primary Circuit Malfunction");
    m.insert("14-02", "Ignition Coil Secondary Circuit Open");
    m.insert("15-01", "Ignition Output Signal Malfunction");
    m.insert("16-01", "EGR Valve Position Sensor Circuit Malfunction");
    m.insert("17-01", "Rear Wheel Speed Sensor Circuit No Signal");
    m.insert("18-01", "Alternator / Charging System Voltage Too Low");
    m.insert("18-02", "Alternator / Charging System Voltage Too High");
    m.insert("19-01", "ACG Starter Motor Circuit Malfunction");
    m.insert("19-02", "ACG Starter Motor Overcurrent Detected");
    m.insert("21-01", "O2 Sensor (Oxygen Sensor) Heater Circuit Malfunction");
    m.insert("21-02", "O2 Sensor Heater Circuit Open / Short");
    m.insert("23-01", "O2 Sensor Circuit Malfunction / No Activity");
    m.insert("23-02", "O2 Sensor Response Time Too Slow");
    m.insert("25-01", "PAIR System Solenoid Valve Circuit Malfunction");
    m.insert("27-01", "EVAP Purge Control Solenoid Valve Circuit Malfunction");
    m.insert("29-01", "IACV (Idle Air Control Valve) Circuit Malfunction");
    m.insert("29-02", "IACV Stuck Open / Stuck Closed");
    m.insert("31-01", "A/F Ratio (Air-Fuel) Too Rich");
    m.insert("31-02", "A/F Ratio (Air-Fuel) Too Lean");
    m.insert("33-01", "ECU EEPROM Read/Write Error");
    m.insert("33-02", "ECU Internal Circuit Malfunction");
    m.insert("41-01", "Knock Sensor Circuit Malfunction");
    m.insert("43-01", "Fuel Pump Relay Circuit Malfunction");
    m.insert("44-01", "Fuel System Too Rich (Long Term Fuel Trim)");
    m.insert("44-02", "Fuel System Too Lean (Long Term Fuel Trim)");
    m.insert("48-01", "MIL Circuit Malfunction");
    m.insert("51-01", "CMP Sensor (Camshaft Position) No Signal");
    m.insert("54-01", "Bank Angle Sensor (BAS) Circuit Low Voltage / Tip-Over Detected");
    m.insert("54-02", "Bank Angle Sensor (BAS) Circuit High Voltage / Open Circuit");
    m.insert("56-01", "Starter Relay Circuit Malfunction");
    m.insert("57-01", "Side Stand Switch Circuit Malfunction");
    m.insert("61-01", "Battery Voltage Too Low (Below 10V)");
    m.insert("61-02", "Battery Voltage Too High (Above 16V)");
    m.insert("65-01", "Radiator Fan Control Circuit Malfunction");
    m.insert("71-01", "HISS (Honda Ignition Security System) Key Not Recognized");
    m.insert("73-01", "ISC (Idle Speed Control) Motor Circuit Malfunction");
    m.insert("81-01", "ETV (Electronic Throttle Valve) Motor Circuit Malfunction");
    m.insert("86-01", "Meter Communication Link Error (CAN / Serial Bus)");
    m.insert("91-01", "ABS (Anti-lock Brake System) Modulator Malfunction");
    m.insert("92-01", "CBS (Combined Brake System) Sensor Malfunction");
    m
}

pub fn get_ecm_ids_db() -> Vec<(&'static [u8], EcmIdInfo)> {
    vec![
        (b"\x01\x01\x25\x01\x02", EcmIdInfo { model: "Honda BeAT FI / Scoopy FI (K25)".into(), year: "2012-2014".into(), pn: "38770-K25-901".into(), checksum: "0x3FFF8".into(), keihinaddr: Some("0x8000".into()), vendor: None, mcu: None, cal_id: None }),
        (b"\x01\x02\x61\x01\x01", EcmIdInfo { model: "Honda BeAT POP eSP K61".into(), year: "2014-2019".into(), pn: "38770-K25G-601".into(), checksum: "0x7FFF8".into(), keihinaddr: Some("0x8000".into()), vendor: None, mcu: None, cal_id: None }),
        (b"\x01\x02\x44\x05\x01", EcmIdInfo { model: "Honda BeAT eSP K44".into(), year: "2014-2016".into(), pn: "38770-K44-V01".into(), checksum: "0x7FFF8".into(), keihinaddr: Some("0x8000".into()), vendor: None, mcu: None, cal_id: None }),
        (b"\x01\x02\x81\x05\x01", EcmIdInfo { model: "Honda BeAT eSP All New K81".into(), year: "2016-2020".into(), pn: "38770-K81-N01".into(), checksum: "0x7FFF8".into(), keihinaddr: Some("0x8000".into()), vendor: None, mcu: None, cal_id: None }),
        (b"\x01\x03\x1a\x05\x01", EcmIdInfo { model: "Honda BeAT Deluxe eSP K1A".into(), year: "2020-Present".into(), pn: "38770-K1A-N01".into(), checksum: "0x7FFF8".into(), keihinaddr: Some("0x8000".into()), vendor: None, mcu: None, cal_id: None }),
        (b"\x01\x02\x16\x05\x01", EcmIdInfo { model: "Honda Scoopy eSP K16R".into(), year: "2015-2017".into(), pn: "38770-K16R-901".into(), checksum: "0x7FFF8".into(), keihinaddr: Some("0x8000".into()), vendor: None, mcu: None, cal_id: None }),
        (b"\x01\x02\x93\x05\x01", EcmIdInfo { model: "Honda Scoopy eSP Keyless K93".into(), year: "2017-2021".into(), pn: "30400-K93-N01".into(), checksum: "0x7FFF8".into(), keihinaddr: Some("0x8000".into()), vendor: None, mcu: None, cal_id: None }),
        (b"\x01\x03\x2f\x05\x01", EcmIdInfo { model: "Honda Scoopy Prestige eSP K2F".into(), year: "2021-Present".into(), pn: "38770-K2F-N01".into(), checksum: "0x7FFF8".into(), keihinaddr: Some("0x8000".into()), vendor: None, mcu: None, cal_id: None }),
        (b"\x01\x03\x00\x05\x01", EcmIdInfo { model: "Honda Genio eSP K0J".into(), year: "2019-Present".into(), pn: "38770-K0J-N01".into(), checksum: "0x7FFF8".into(), keihinaddr: Some("0x8000".into()), vendor: None, mcu: None, cal_id: None }),
        (b"\x01\x01\xe2\x0f\x01", EcmIdInfo { model: "Honda Vario 125 Old KZRA / KZR".into(), year: "2012-2015".into(), pn: "38770-KZRA-601".into(), checksum: "0x3FFF8".into(), keihinaddr: Some("0x8000".into()), vendor: None, mcu: None, cal_id: None }),
        (b"\x01\x02\x35\x05\x01", EcmIdInfo { model: "Honda Vario 125 eSP K35".into(), year: "2015-2018".into(), pn: "38770-K35-V01".into(), checksum: "0x7FFF8".into(), keihinaddr: Some("0x8000".into()), vendor: None, mcu: None, cal_id: None }),
        (b"\x01\x02\x60\x05\x01", EcmIdInfo { model: "Honda Vario 125 eSP All New K60".into(), year: "2018-2022".into(), pn: "38770-K60-B01".into(), checksum: "0x7FFF8".into(), keihinaddr: Some("0x8000".into()), vendor: None, mcu: None, cal_id: None }),
        (b"\x01\x03\x20\x05\x01", EcmIdInfo { model: "Honda Vario 125 eSP+ K2V".into(), year: "2022-Present".into(), pn: "38770-K2V-N01".into(), checksum: "0x7FFF8".into(), keihinaddr: Some("0x8000".into()), vendor: None, mcu: None, cal_id: None }),
        (b"\x01\x02\x59\x05\x01", EcmIdInfo { model: "Honda Vario 150 eSP K59".into(), year: "2015-2022".into(), pn: "38770-K59-A11".into(), checksum: "0x7FFF8".into(), keihinaddr: Some("0x8000".into()), vendor: None, mcu: None, cal_id: None }),
        (b"\x01\x02\x59\x07\x01", EcmIdInfo { model: "Honda Vario 150 eSP K59A".into(), year: "2018-2022".into(), pn: "38770-K59-A71".into(), checksum: "0x7FFF8".into(), keihinaddr: Some("0x8000".into()), vendor: None, mcu: None, cal_id: None }),
        (b"\x01\x03\x25\x05\x01", EcmIdInfo { model: "Honda Vario 160 eSP+ K2S".into(), year: "2022-Present".into(), pn: "38770-K2S-N01".into(), checksum: "0x7FFF8".into(), keihinaddr: Some("0x8000".into()), vendor: None, mcu: None, cal_id: None }),
        (b"\x01\x02\x97\x05\x01", EcmIdInfo { model: "Honda PCX 150 K97".into(), year: "2018-2021".into(), pn: "38770-K97-N01".into(), checksum: "0x7FFF8".into(), keihinaddr: Some("0x8000".into()), vendor: None, mcu: None, cal_id: None }),
        (b"\x01\x03\x10\x05\x01", EcmIdInfo { model: "Honda PCX 160 K1Z".into(), year: "2021-Present".into(), pn: "38770-K1Z-N01".into(), checksum: "0x7FFF8".into(), keihinaddr: Some("0x8000".into()), vendor: None, mcu: None, cal_id: None }),
        (b"\x01\x02\x00\x05\x01", EcmIdInfo { model: "Honda ADV 150 K0W".into(), year: "2019-2022".into(), pn: "38770-K0W-N01".into(), checksum: "0x7FFF8".into(), keihinaddr: Some("0x8000".into()), vendor: None, mcu: None, cal_id: None }),
        (b"\x01\x03\x28\x05\x01", EcmIdInfo { model: "Honda ADV 160 K2W".into(), year: "2022-Present".into(), pn: "38770-K2W-N01".into(), checksum: "0x7FFF8".into(), keihinaddr: Some("0x8000".into()), vendor: None, mcu: None, cal_id: None }),
        (b"\x01\x03\x36\x05\x01", EcmIdInfo { model: "Honda Stylo 160 eSP+ (K3V)".into(), year: "2024-Present".into(), pn: "38770-K3V-N01".into(), checksum: "0x38770".into(), keihinaddr: Some("0x8000".into()), vendor: Some("Shindengen".into()), mcu: None, cal_id: None }),
    ]
}
