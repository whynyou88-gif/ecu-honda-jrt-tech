// ============================================================
// ecu_db/honda_matic.rs — Honda ECU Models & DTC Database Catalog
// ============================================================

use std::collections::HashMap;

pub struct EcmIdInfo {
    pub model: String,
    pub year: String,
    pub pn: String,
}

pub fn get_honda_dtc_map() -> HashMap<&'static str, &'static str> {
    let mut m = HashMap::new();
    m.insert("01-01", "MAP Sensor Circuit Low Voltage");
    m.insert("01-02", "MAP Sensor Circuit High Voltage");
    m.insert("02-01", "CKP Sensor No Signal");
    m.insert("07-01", "ECT Sensor Circuit Low Voltage");
    m.insert("07-02", "ECT Sensor Circuit High Voltage");
    m.insert("08-01", "TPS Sensor Circuit Low Voltage");
    m.insert("08-02", "TPS Sensor Circuit High Voltage");
    m.insert("09-01", "IAT Sensor Circuit Low Voltage");
    m.insert("09-02", "IAT Sensor Circuit High Voltage");
    m.insert("12-01", "Primary Injector Circuit Malfunction");
    m.insert("14-01", "Ignition Coil Primary Circuit Malfunction");
    m.insert("21-01", "O2 Sensor Heater Circuit Malfunction");
    m.insert("33-01", "ECU EEPROM Read/Write Error");
    m.insert("54-01", "Bank Angle Sensor (BAS) Tip-Over Detected");
    m
}

pub fn get_ecm_ids_db() -> Vec<(&'static [u8], EcmIdInfo)> {
    vec![
        (b"\x01\x01\x25\x01\x02", EcmIdInfo { model: "Honda BeAT FI / Scoopy FI (K25)".into(), year: "2012-2014".into(), pn: "38770-K25-901".into() }),
        (b"\x01\x02\x61\x01\x01", EcmIdInfo { model: "Honda BeAT POP eSP K61".into(), year: "2014-2019".into(), pn: "38770-K25G-601".into() }),
        (b"\x01\x02\x44\x05\x01", EcmIdInfo { model: "Honda BeAT eSP K44".into(), year: "2014-2016".into(), pn: "38770-K44-V01".into() }),
        (b"\x01\x02\x81\x05\x01", EcmIdInfo { model: "Honda BeAT eSP All New K81".into(), year: "2016-2020".into(), pn: "38770-K81-N01".into() }),
        (b"\x01\x03\x1a\x05\x01", EcmIdInfo { model: "Honda BeAT Deluxe eSP K1A".into(), year: "2020-Present".into(), pn: "38770-K1A-N01".into() }),
        (b"\x01\x02\x16\x05\x01", EcmIdInfo { model: "Honda Scoopy eSP K16R".into(), year: "2015-2017".into(), pn: "38770-K16R-901".into() }),
        (b"\x01\x02\x93\x05\x01", EcmIdInfo { model: "Honda Scoopy eSP Keyless K93".into(), year: "2017-2021".into(), pn: "30400-K93-N01".into() }),
        (b"\x01\x03\x2f\x05\x01", EcmIdInfo { model: "Honda Scoopy Prestige eSP K2F".into(), year: "2021-Present".into(), pn: "38770-K2F-N01".into() }),
        (b"\x01\x03\x00\x05\x01", EcmIdInfo { model: "Honda Genio eSP K0J".into(), year: "2019-Present".into(), pn: "38770-K0J-N01".into() }),
        (b"\x01\x01\xe2\x0f\x01", EcmIdInfo { model: "Honda Vario 125 Old KZRA / KZR".into(), year: "2012-2015".into(), pn: "38770-KZRA-601".into() }),
        (b"\x01\x02\x35\x05\x01", EcmIdInfo { model: "Honda Vario 125 eSP K35".into(), year: "2015-2018".into(), pn: "38770-K35-V01".into() }),
        (b"\x01\x02\x60\x05\x01", EcmIdInfo { model: "Honda Vario 125 eSP All New K60".into(), year: "2018-2022".into(), pn: "38770-K60-B01".into() }),
        (b"\x01\x03\x20\x05\x01", EcmIdInfo { model: "Honda Vario 125 eSP+ K2V".into(), year: "2022-Present".into(), pn: "38770-K2V-N01".into() }),
        (b"\x01\x02\x59\x05\x01", EcmIdInfo { model: "Honda Vario 150 eSP K59".into(), year: "2015-2022".into(), pn: "38770-K59-A11".into() }),
        (b"\x01\x03\x25\x05\x01", EcmIdInfo { model: "Honda Vario 160 eSP+ K2S".into(), year: "2022-Present".into(), pn: "38770-K2S-N01".into() }),
        (b"\x01\x02\x97\x05\x01", EcmIdInfo { model: "Honda PCX 150 K97".into(), year: "2018-2021".into(), pn: "38770-K97-N01".into() }),
        (b"\x01\x03\x10\x05\x01", EcmIdInfo { model: "Honda PCX 160 K1Z".into(), year: "2021-Present".into(), pn: "38770-K1Z-N01".into() }),
        (b"\x01\x02\x00\x05\x01", EcmIdInfo { model: "Honda ADV 150 K0W".into(), year: "2019-2022".into(), pn: "38770-K0W-N01".into() }),
        (b"\x01\x03\x28\x05\x01", EcmIdInfo { model: "Honda ADV 160 K2W".into(), year: "2022-Present".into(), pn: "38770-K2W-N01".into() }),
        (b"\x01\x03\x36\x05\x01", EcmIdInfo { model: "Honda Stylo 160 eSP+ (K3V)".into(), year: "2024-Present".into(), pn: "38770-K3V-N01".into() }),
    ]
}
