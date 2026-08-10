ECM_IDs = {
	# ============================================================
	# HONDA MATIC / SCOOTER SERIES (COMPREHENSIVE)
	# ============================================================

	# --- Honda BeAT Series ---
	b"\x01\x01\x25\x01\x02": {"model": "Honda BeAT FI / Scoopy FI (K25)", "year": "2012-2014", "pn": "38770-K25-901", "checksum": "0x3FFF8", "keihinaddr": "0x8000"},
	b"\x01\x01\x25\x02\x01": {"model": "Honda BeAT FI Non-ISS (K25)", "year": "2012-2014", "pn": "38770-K25-902", "checksum": "0x3FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x61\x01\x01": {"model": "Honda BeAT POP eSP K61", "year": "2014-2019", "pn": "38770-K25G-601", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x61\x05\x01": {"model": "Honda BeAT POP eSP K61 / Scoopy eSP K16R", "year": "2014-2019", "pn": "38770-K25G-601 (CU-21A)", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x44\x05\x01": {"model": "Honda BeAT eSP K44", "year": "2014-2016", "pn": "38770-K44-V01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x81\x05\x01": {"model": "Honda BeAT eSP All New K81", "year": "2016-2020", "pn": "38770-K81-N01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x03\x79\x0f\x01": {"model": "Honda BeAT eSP All New K81", "year": "2020-2023", "pn": "38770-K81-N01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x03\x1a\x05\x01": {"model": "Honda BeAT Deluxe eSP K1A", "year": "2020-Present", "pn": "38770-K1A-N01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x03\x79\x0f\x02": {"model": "Honda BeAT Deluxe eSP K1A", "year": "2020-2023", "pn": "38770-K1A-N01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x03\x79\x0f\x03": {"model": "Honda BeAT eSP / Deluxe K1A", "year": "2023-Present", "pn": "38770-K1A-N01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},

	# --- Honda Scoopy Series ---
	b"\x01\x02\x16\x05\x01": {"model": "Honda Scoopy eSP K16R", "year": "2015-2017", "pn": "38770-K16R-901", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x93\x05\x01": {"model": "Honda Scoopy eSP Keyless K93", "year": "2017-2021", "pn": "30400-K93-N01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x03\x2f\x05\x01": {"model": "Honda Scoopy Prestige eSP K2F", "year": "2021-Present", "pn": "38770-K2F-N01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},

	# --- Honda Spacy FI & Genio eSP ---
	b"\x01\x01\x7c\x01\x01": {"model": "Honda Spacy FI (KZL)", "year": "2011-2018", "pn": "38770-KZL-931", "checksum": "0x3FFF8", "keihinaddr": "0x8000"},
	b"\x01\x01\x7c\x05\x01": {"model": "Honda Spacy FI (KZL)", "year": "2011-2018", "pn": "38770-KZL-932", "checksum": "0x3FFF8", "keihinaddr": "0x8000"},
	b"\x01\x03\x00\x05\x01": {"model": "Honda Genio eSP K0J", "year": "2019-Present", "pn": "38770-K0J-N01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},

	# --- Honda Vario 110 Series ---
	b"\x01\x01\x46\x01\x01": {"model": "Honda Vario 110 FI (K46)", "year": "2014-2015", "pn": "38770-K46-N01", "checksum": "0x3FFF8", "keihinaddr": "0x8000"},
	b"\x01\x01\x46\x05\x01": {"model": "Honda Vario 110 FI (K46)", "year": "2014-2015", "pn": "38770-K46-N21", "checksum": "0x3FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x46\x05\x01": {"model": "Honda Vario 110 eSP (K46H)", "year": "2015-2019", "pn": "38770-K46-N81", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x01\xf8\x0f\x01": {"model": "Honda Vario 110 FI (K46-N31)", "year": "2015-2017", "pn": "30400-K46-N31", "vendor": "Keihin", "mcu": "MPC5602D", "checksum": "0x3EFF8", "size": 256},
	b"\x01\x01\xea\x0f\x01": {"model": "Honda Vario 110 FI (K46-N21)", "year": "2015-2017", "pn": "30400-K46-N21", "calId": "K46F204", "mcu": "SPC560", "checksum": "0x3EFF8", "size": 256},

	# --- Honda Vario 125 Series ---
	b"\x01\x01\xe2\x0f\x01": {"model": "Honda Vario 125 Old KZRA / KZR", "year": "2012-2015", "pn": "38770-KZRA-601", "checksum": "0x3FFF8", "keihinaddr": "0x8000"},
	b"\x01\x01\xe2\x0f\x02": {"model": "Honda Vario 125 Old KZR ISS", "year": "2013-2015", "pn": "38770-KZR-602", "checksum": "0x3FFF8", "keihinaddr": "0x8000"},
	b"\x01\x01\x47\x01\x01": {"model": "Honda Vario 125 Techno (KZR)", "year": "2012-2015", "pn": "38770-KZR-601", "checksum": "0x3FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x35\x05\x01": {"model": "Honda Vario 125 eSP K35", "year": "2015-2018", "pn": "38770-K35-V01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x35\x01\x01": {"model": "Honda Vario 125 eSP Non-ISS K35", "year": "2015-2018", "pn": "38770-K35-V02", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x60\x05\x01": {"model": "Honda Vario 125 eSP All New K60", "year": "2018-2022", "pn": "38770-K60-B01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x60\x07\x01": {"model": "Honda Vario 125 eSP All New K60R", "year": "2018-2022", "pn": "38770-K60-B31", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x03\x08\x0f\x01": {"model": "Honda Vario 125 ISS (K60R-B61)", "year": "2018-2019", "pn": "30400-K60R-B61", "vendor": "Shindengen", "mcu": "V850", "size": 384},
	b"\x01\x03\x09\x0f\x01": {"model": "Honda Vario 125 (K60R-B71)", "year": "2018-2019", "pn": "30400-K60R-B71", "vendor": "Shindengen", "mcu": "V850", "size": 384},
	b"\x01\x02\x46\x0f\x01": {"model": "Honda Vario 125 (K60K-B31)", "year": "2016-2017", "pn": "30400-K60K-B31", "vendor": "Shindengen", "mcu": "V850", "size": 256},
	b"\x01\x03\x20\x05\x01": {"model": "Honda Vario 125 eSP+ K2V", "year": "2022-Present", "pn": "38770-K2V-N01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},

	# --- Honda Vario 150 & Vario 160 Series ---
	b"\x01\x02\x59\x05\x01": {"model": "Honda Vario 150 eSP K59", "year": "2015-2022", "pn": "38770-K59-A11", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x59\x07\x01": {"model": "Honda Vario 150 eSP K59A", "year": "2018-2022", "pn": "38770-K59-A71", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x59\x08\x01": {"model": "Honda Vario 150 eSP K59J Keyless", "year": "2018-2022", "pn": "38770-K59-J01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x03\x06\x0f\x01": {"model": "Honda Vario 150 ISS (K59-JA71)", "year": "2018-2019", "pn": "30400-K59-JA71", "vendor": "Shindengen", "mcu": "V850", "size": 384},
	b"\x01\x02\x45\x0f\x01": {"model": "Honda Vario 150 (K59A-A11)", "year": "2018-2019", "pn": "30400-K59A-A11", "vendor": "Shindengen", "mcu": "V850", "size": 384},
	b"\x01\x02\x45\x0e\x01": {"model": "Honda Vario 150 (K59F-A01)", "year": "2016-2017", "pn": "30400-K59F-A01", "vendor": "Shindengen", "mcu": "V850", "size": 256},
	b"\x01\x03\x15\x18\x01": {"model": "Honda Vario 150 (K59-M01)", "year": "2019-2020", "pn": "30400-K59-M01", "vendor": "Shindengen", "mcu": "V850", "size": 384},
	b"\x01\x03\x25\x05\x01": {"model": "Honda Vario 160 eSP+ K2S", "year": "2022-Present", "pn": "38770-K2S-N01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},

	# --- Honda PCX & ADV & Stylo Series ---
	b"\x01\x00\x77\x01\x01": {"model": "Honda PCX 125 CBU (KWN)", "year": "2010-2012", "pn": "38770-KWN-901", "checksum": "0x3FFF8", "keihinaddr": "0x8000"},
	b"\x01\x01\x7a\x01\x01": {"model": "Honda PCX 150 CBU (KZY)", "year": "2012-2014", "pn": "38770-KZY-701", "checksum": "0x3FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x36\x05\x01": {"model": "Honda PCX 150 LED CBU (K36)", "year": "2014-2017", "pn": "38770-K36-T01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x97\x05\x01": {"model": "Honda PCX 150 K97", "year": "2018-2021", "pn": "38770-K97-N01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x03\x10\x05\x01": {"model": "Honda PCX 160 K1Z", "year": "2021-Present", "pn": "38770-K1Z-N01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x00\x05\x01": {"model": "Honda ADV 150 K0W", "year": "2019-2022", "pn": "38770-K0W-N01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x03\x28\x05\x01": {"model": "Honda ADV 160 K2W", "year": "2022-Present", "pn": "38770-K2W-N01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x03\x36\x05\x01": {"model": "Honda Stylo 160 eSP+ (K3V)", "year": "2024-Present", "pn": "38770-K3V-N01", "vendor": "Shindengen", "checksum": "0x38770", "keihinaddr": "0x8000"},
	b"\x01\x02\x40\x05\x01": {"model": "Honda Forza 250 (K40)", "year": "2018-Present", "pn": "38770-K40-N01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},

	# ============================================================
	# HONDA SPORT, CUB & BIG BIKE SERIES (EXTENDED)
	# ============================================================
	b"\x01\x02\xb9\x0d\x01": {"model": "Honda Wave 110i (K58-T81)", "year": "2016-2017", "pn": "38770-K58-T81", "mcu": "R8C", "size": 64, "offset": "0x8000"},
	b"\x01\x03\x4c\x0d\x01": {"model": "Honda Wave 110 (K58-TC2)", "year": "2019", "pn": "38770-K58-TC2", "calId": "K58M101", "mcu": "R8C", "size": 64, "offset": "0x8000"},
	b"\x01\x01\x88\x0d\x01": {"model": "Honda Wave 110 (K03-H01)", "year": "2013-2016", "pn": "38770-K03-H01", "calId": "K03S10A", "mcu": "R8C", "size": 64, "offset": "0x8000"},
	b"\x01\x00\xce\x0d\x02": {"model": "Honda Wave 110 (KWW643)", "year": "2011-2012", "pn": "38770-KWW-643", "calId": "KWWM30D", "mcu": "R8C", "checksum": "0x7600", "size": 48, "offset": "0x4000"},
	b"\x01\x03\x59\x11\x01": {"model": "Honda Supra GTR 150 (K56-V51)", "year": "2019-2020", "pn": "38770-K56-V51", "mcu": "R8C", "size": 64, "offset": "0x8000"},
	b"\x01\x01\xcb\x11\x01": {"model": "Honda RS150 / Supra GTR (K56-V01)", "year": "2017-2018", "pn": "38770-K56-V01", "calId": "K56A603", "mcu": "R8C", "size": 64, "offset": "0x8000"},
	b"\x01\x02\xad\x18\x01": {"model": "Honda Wave 125i (K73-M41)", "year": "2018", "pn": "38770-K73-M41", "mcu": "R8C", "size": 64, "offset": "0x8000"},
	b"\x01\x02\x68\x11\x01": {"model": "Honda Wave 110 (G90-V02)", "year": "2019-2020", "pn": "38770-G90-V02", "vendor": "Keihin", "size": 64, "offset": "0x8000"},
	b"\x01\x01\x20\x0e\x01": {"model": "Honda Verza 150 (K18-902)", "year": "2013-2014", "pn": "38770-K18-902", "calId": "KWWM404", "mcu": "R8C", "checksum": "0x7600", "size": 48, "offset": "0x4000"},
	b"\x01\x01\xf3\x0f\x01": {"model": "Honda Verza 150 (K18-941)", "year": "2018", "pn": "38770-K18-941", "calId": "K03S201", "mcu": "R8C", "size": 64, "offset": "0x8000"},

	b"\x01\x01\x18\x09\x02": {"model": "Honda Verza 150 K18", "year": "2013-2018", "pn": "38770-K18-902", "checksum": "0x3FFF8", "keihinaddr": "0x8000"},
	b"\x01\x01\x18\x09\x41": {"model": "Honda Verza / CB150 Verza K18", "year": "2018-Present", "pn": "38770-K18-941", "checksum": "0x3FFF8", "keihinaddr": "0x8000"},
	b"\x01\x01\x03\x05\x01": {"model": "Honda Revo FI K03", "year": "2014-Present", "pn": "38770-K03-N32", "checksum": "0x3FFF8", "keihinaddr": "0x8000"},
	b"\x01\x01\x15\x09\x03": {"model": "Honda CB150R StreetFire K15", "year": "2012-2015", "pn": "38770-K15-903", "checksum": "0x3FFF8", "keihinaddr": "0x8000"},
	b"\x01\x01\x15\x09\x21": {"model": "Honda CB150R StreetFire K15", "year": "2012-2015", "pn": "38770-K15-921", "checksum": "0x3FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x15\x06\x01": {"model": "Honda CB150R StreetFire All New K15M", "year": "2015-2021", "pn": "38770-K15M-601", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x01\x45\x01\x01": {"model": "Honda CBR150R Lokal K45A", "year": "2014-2016", "pn": "38770-K45A-N01", "checksum": "0x3FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x45\x05\x01": {"model": "Honda CBR150R LED K45G-N42", "year": "2016-2018", "pn": "38770-K45G-N42", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x45\x05\x02": {"model": "Honda CBR150R LED K45G-NA1", "year": "2018-2021", "pn": "38770-K45G-NA1", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x00\xfa\x10\x01": {"model": "Honda CBR150R CBU Thailand KPP", "year": "2010-2014", "pn": "38770-KPP-N02", "checksum": "0x3FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x56\x05\x01": {"model": "Honda Sonic 150R K56", "year": "2015-Present", "pn": "38770-K56-N01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x56\x05\x11": {"model": "Honda Supra GTR 150 K56", "year": "2016-Present", "pn": "38770-K56-N11", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x56\x0d\x01": {"model": "Honda RS150R Thai K56", "year": "2016-Present", "pn": "38770-K56-M01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x84\x05\x01": {"model": "Honda CRF150L K84", "year": "2017-Present", "pn": "38770-K84-901", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x01\x41\x05\x01": {"model": "Honda Blade 125 FI / Supra X 125 K41", "year": "2014-Present", "pn": "38770-K41-N01", "checksum": "0x3FFF8", "keihinaddr": "0x8000"},
	b"\x01\x01\x79\x7a\x05\x01": {"model": "Honda Supra X 125 FI KYZ", "year": "2012-2014", "pn": "38770-KYZ-901", "checksum": "0x3FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x64\x05\x04": {"model": "Honda CBR250RR K64-N04", "year": "2016-Present", "pn": "38770-K64-N04", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\x64\x05\x01": {"model": "Honda CBR250RR K64-N01", "year": "2016-Present", "pn": "38770-K64-N01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},
	b"\x01\x02\xca\x05\x01": {"model": "Honda Monkey 125 K0F", "year": "2019-Present", "pn": "38770-K0F-A01", "checksum": "0x7FFF8", "keihinaddr": "0x8000"},

	# --- Honda Flagship & VFR / X-ADV Series ---
	b"\x01\x01\x31\x08\x02": {"model": "Honda XRE 300 (KWT)", "year": "2014-2015", "pn": "38770-KWT-703", "mcu": "M16C", "checksum": "0xB000", "size": 128, "offset": "0xE0000"},
	b"\x08\x02\x4c\xff\xfe": {"model": "Honda X-ADV 750 35KW (MKHD42)", "year": "2018-2019", "pn": "38770-MKHD42", "calId": "MKHF204", "mcu": "MPC560", "checksum": "0x7FFF8", "size": 512, "pinout": "honda-spc560-type2"},
	b"\x80\x20\x00\x01\x02": {"model": "Honda X-ADV 750 (MKH-D23)", "year": "2020", "pn": "38770-MKH-D23", "vendor": "Keihin", "checksum": "0x7FFF8", "size": 512},
	b"\x80\x20\x00\x00\x00": {"model": "Honda X-ADV 750 (MKH-C03)", "year": "2018-2019", "pn": "38770-MKH-C03", "mcu": "MPC560", "checksum": "0x7FFF8", "size": 512},
	b"\x80\x20\x00\x00\x01": {"model": "Honda X-ADV 750 (MKH-C02)", "year": "2018-2019", "pn": "38770-MKH-C02", "mcu": "MPC560", "checksum": "0x7FFF8", "size": 512},
	b"\x08\x02\x4c\x01\x01": {"model": "Honda X-ADV 750 (MKH-D01)", "year": "2017-2018", "pn": "38770-MKH-D01", "mcu": "MPC560", "checksum": "0x7FFF8", "size": 512, "pinout": "honda-spc560-type2"},
	b"\x01\x00\x7b\x01\x01": {"model": "Honda VT 1300 (MFR-642)", "year": "2010-2019", "pn": "38770-MFR-642", "size": 256},
	b"\x08\x01\x07\x01\x01": {"model": "Honda VFR 1200 X DCT (MGHN12)", "year": "2014-2015", "pn": "38770-MGHN12", "calId": "MGHHA07", "mcu": "SH705", "checksum": "0x7FFF8", "size": 1024, "pinout": "honda-sh705x-ienis1"},
	b"\x08\x01\x04\x01\x01": {"model": "Honda VFR 1200 X DCT (MGHD21)", "year": "2012-2013", "pn": "38770-MGHD21", "calId": "MGHEA0H", "mcu": "SH705", "checksum": "0x7FFF8", "size": 1024, "pinout": "honda-sh705x-type1"},
	b"\x08\x01\x07\x03\x01": {"model": "Honda VFR 1200 X DCT (MGH-M12)", "year": "2014-2015", "pn": "38770-MGH-M12", "mcu": "SH705X", "checksum": "0x7FFF8", "size": 1024, "pinout": "honda-sh705x-type1"},
	b"\x08\x01\x04\x03\x01": {"model": "Honda VFR 1200 X DCT (MGHF21)", "year": "2012-2013", "pn": "38770-MGHF21", "calId": "MGHEA0H", "mcu": "SH705", "checksum": "0x7FFF8", "size": 1024, "pinout": "honda-sh705x-tipe1"},
	b"\x01\x00\xec\x01\x01": {"model": "Honda VFR 1200 X (MGH641)", "year": "2012", "pn": "38770-MGH641", "calId": "MGHE503", "mcu": "SH705", "checksum": "0x7FFF8", "size": 1024, "pinout": "honda-sh705x-tipe1"},
	b"\x08\x00\xab\x01\x01": {"model": "Honda VFR 1200 DCT (MGE-D02)", "year": "2010", "pn": "38770-MGE-D02", "mcu": "SH705X", "checksum": "0x7FFF8", "size": 1024, "pinout": "honda-sh705x-jenis1"},
	b"\x08\x00\xab\x03\x01": {"model": "Honda VFR 1200 DCT (MGE-F02)", "year": "2010", "pn": "38770-MGE-F02", "mcu": "SH705X", "checksum": "0x7FFF8", "size": 1024, "pinout": "honda-sh705x-tipe1"},
	b"\x01\x00\xaa\x03\x01": {"model": "Honda VFR 1200 (MGE623)", "year": "2010", "pn": "38770-MGE623", "calId": "MGEA30H", "mcu": "SH705X", "checksum": "0x7FFF8", "size": 1024, "pinout": "honda-sh705x-type1"},
	b"\x01\x01\x03\x01\x01": {"model": "Honda VFR 1200 (MGED01)", "year": "2011", "pn": "38770-MGED01", "calId": "MGEA401", "mcu": "SH705X", "checksum": "0x7FFF8", "size": 1024, "pinout": "honda-sh705x-tipe1"},
	b"\x01\x01\x03\x03\x01": {"model": "Honda VFR 1200 (MGEF11)", "year": "2011", "pn": "38770-MGEF11", "calId": "MGEA401", "mcu": "SH705X", "checksum": "0x7FFF8", "size": 1024, "pinout": "honda-sh705x-type1"},
	b"\x01\x01\x19\x01\x01": {"model": "Honda VFR 1200 (MGED41)", "year": "2012-2016", "pn": "38770-MGED41", "calId": "MGHE503", "mcu": "SH705X", "checksum": "0x7FFF8", "size": 1024, "pinout": "honda-sh705x-tipe1"},

	b"\x01\x01\x9c\x01\x01": {"model": "Honda CB650F", "year": "2014-2016", "pn": "38770-MJE-D41", "checksum": "0x3fff8", "ecmidaddr": "0x15F72", "keihinaddr": "0x37B98"},
	b"\x01\x00\x6a\x03\x01": {"model": "Honda CB1000R", "year": "2008-2017", "pn": "38770-MNF-F01", "checksum": "0x3fff8", "ecmidaddr": "0x21C92", "keihinaddr": "0x3FFDE"},
	b"\x01\x00\x6a\x01\x01": {"model": "Honda CB1000R", "year": "2008-2017", "pn": "38770-MNF-D01", "checksum": "0x3fff8", "ecmidaddr": "0x21C92", "keihinaddr": "0x3FFDE"},
	b"\x01\x00\xe0\x01\x01": {"model": "Honda CBR600F", "year": "2011-2012", "pn": "38770-MGM-D11", "checksum": "0x3fff8", "ecmidaddr": "0x2290F", "keihinaddr": "0x3FFDE"},
	b"\x01\x00\x33\x03\x02": {"model": "Honda CBR600RR", "year": "2007-2008", "pn": "38770-MFJ-F03", "checksum": "0x3fff8", "ecmidaddr": "0x280B5", "keihinaddr": "0x3FFDE"},
	b"\x01\x00\x2b\x01\x01": {"model": "Honda CBR1000RR", "year": "2006-2007", "pn": "38770-MEL-D21", "checksum": "0x3fff8", "ecmidaddr": "0x23381", "keihinaddr": "0x3FFDE"},
	b"\x01\x01\x25\x05\x01": {"model": "Honda CBR500R", "year": "2013-2016", "pn": "38770-MGZ-A03", "checksum": "0x3fff8", "ecmidaddr": "0x17FC7", "keihinaddr": "0x32D80"},
	b"\x01\x01\x35\x05\x01": {"model": "Honda MSX125", "year": "2013-2015", "pn": "38770-K26-911", "checksum": "0x9fff", "offset": "0x4000", "ecmidaddr": "0x97cd", "keihinaddr": "0x7601"},
	b"\x01\x02\x13\x05\x01": {"model": "Honda MSX125", "year": "2016-2019", "pn": "38770-K26-B13", "checksum": "0x0", "offset": "0x8000", "ecmidaddr": "0x23B8", "keihinaddr": "0x1"},
	b"\x01\x02\x57\x05\x01": {"model": "Honda MSX125", "year": "2016-2019", "pn": "38770-K26-C31", "checksum": "0x0", "offset": "0x8000", "ecmidaddr": "0x260C", "keihinaddr": "0x1"},
	b"\x01\x00\xb8\x05\x02": {"model": "Honda CBR250R", "year": "2011-2013", "pn": "38770-KYJ-922", "ecmidaddr": "0xC3EE", "checksum": "0xDFEF", "keihinaddr": "0xDFF0"},
}
