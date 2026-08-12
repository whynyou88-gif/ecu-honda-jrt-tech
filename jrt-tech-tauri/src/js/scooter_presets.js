// ============================================================
// scooter_presets.js - Automatic Scooter CVT Model Presets Database
// Contains CVT Ratio ranges, Final Reduction Ratios, Wheel Diameters,
// Stock Roller Weights, and Target Powerband RPM for Automatic Scooters.
// ============================================================

const ScooterPresets = (function() {
  
  const PRESETS = {
    // ===== HONDA AUTOMATIC SCOOTERS =====
    "honda_beat_110": {
      id: "honda_beat_110",
      name: "Honda BeAT 110 eSP / FI",
      brand: "Honda",
      cc: 110,
      finalDriveRatio: 9.35,
      cvtLowRatio: 2.65,
      cvtHighRatio: 0.82,
      wheelDiameterMeters: 0.490, // 14-inch tire (100/90-14)
      stockRollerWeightGrams: 15.0,
      targetShiftRpm: 8200,
      maxRpm: 10500,
      massKg: 93.0
    },
    "honda_vario_110": {
      id: "honda_vario_110",
      name: "Honda Vario 110 FI / eSP",
      brand: "Honda",
      cc: 110,
      finalDriveRatio: 9.35,
      cvtLowRatio: 2.65,
      cvtHighRatio: 0.82,
      wheelDiameterMeters: 0.490,
      stockRollerWeightGrams: 13.0,
      targetShiftRpm: 8100,
      maxRpm: 10500,
      massKg: 96.0
    },
    "honda_vario_125": {
      id: "honda_vario_125",
      name: "Honda Vario 125 eSP (K35/K60/K2V)",
      brand: "Honda",
      cc: 125,
      finalDriveRatio: 9.15,
      cvtLowRatio: 2.60,
      cvtHighRatio: 0.78,
      wheelDiameterMeters: 0.495, // 90/90-14
      stockRollerWeightGrams: 18.0,
      targetShiftRpm: 8500,
      maxRpm: 11000,
      massKg: 111.0
    },
    "honda_vario_150": {
      id: "honda_vario_150",
      name: "Honda Vario 150 eSP (K59)",
      brand: "Honda",
      cc: 150,
      finalDriveRatio: 9.15,
      cvtLowRatio: 2.60,
      cvtHighRatio: 0.78,
      wheelDiameterMeters: 0.505, // 100/80-14
      stockRollerWeightGrams: 15.5,
      targetShiftRpm: 8700,
      maxRpm: 11500,
      massKg: 112.0
    },
    "honda_vario_160": {
      id: "honda_vario_160",
      name: "Honda Vario 160 eSP+ (K2S)",
      brand: "Honda",
      cc: 160,
      finalDriveRatio: 8.85,
      cvtLowRatio: 2.52,
      cvtHighRatio: 0.74,
      wheelDiameterMeters: 0.510, // 120/70-14
      stockRollerWeightGrams: 19.0,
      targetShiftRpm: 8800,
      maxRpm: 11800,
      massKg: 117.0
    },
    "honda_scoopy_110": {
      id: "honda_scoopy_110",
      name: "Honda Scoopy 110 eSP / Ring 12",
      brand: "Honda",
      cc: 110,
      finalDriveRatio: 9.35,
      cvtLowRatio: 2.65,
      cvtHighRatio: 0.82,
      wheelDiameterMeters: 0.450, // 100/90-12
      stockRollerWeightGrams: 15.0,
      targetShiftRpm: 8200,
      maxRpm: 10500,
      massKg: 95.0
    },
    "honda_genio_110": {
      id: "honda_genio_110",
      name: "Honda Genio 110 eSP (K0J)",
      brand: "Honda",
      cc: 110,
      finalDriveRatio: 9.35,
      cvtLowRatio: 2.65,
      cvtHighRatio: 0.82,
      wheelDiameterMeters: 0.450,
      stockRollerWeightGrams: 15.0,
      targetShiftRpm: 8200,
      maxRpm: 10500,
      massKg: 92.0
    },
    "honda_stylo_160": {
      id: "honda_stylo_160",
      name: "Honda Stylo 160 eSP+",
      brand: "Honda",
      cc: 160,
      finalDriveRatio: 8.85,
      cvtLowRatio: 2.52,
      cvtHighRatio: 0.74,
      wheelDiameterMeters: 0.470, // 130/70-12
      stockRollerWeightGrams: 19.0,
      targetShiftRpm: 8800,
      maxRpm: 11800,
      massKg: 118.0
    },
    "honda_pcx_150": {
      id: "honda_pcx_150",
      name: "Honda PCX 150 (K97)",
      brand: "Honda",
      cc: 150,
      finalDriveRatio: 8.92,
      cvtLowRatio: 2.60,
      cvtHighRatio: 0.76,
      wheelDiameterMeters: 0.515, // 120/70-14
      stockRollerWeightGrams: 17.0,
      targetShiftRpm: 8500,
      maxRpm: 11200,
      massKg: 131.0
    },
    "honda_pcx_160": {
      id: "honda_pcx_160",
      name: "Honda PCX 160 eSP+ (K1Z)",
      brand: "Honda",
      cc: 160,
      finalDriveRatio: 8.85,
      cvtLowRatio: 2.52,
      cvtHighRatio: 0.74,
      wheelDiameterMeters: 0.505, // 130/70-13
      stockRollerWeightGrams: 19.0,
      targetShiftRpm: 8800,
      maxRpm: 11800,
      massKg: 132.0
    },
    "honda_adv_160": {
      id: "honda_adv_160",
      name: "Honda ADV 160 eSP+",
      brand: "Honda",
      cc: 160,
      finalDriveRatio: 8.85,
      cvtLowRatio: 2.52,
      cvtHighRatio: 0.74,
      wheelDiameterMeters: 0.510, // 130/70-13
      stockRollerWeightGrams: 19.0,
      targetShiftRpm: 8800,
      maxRpm: 11800,
      massKg: 133.0
    },

    // ===== YAMAHA AUTOMATIC SCOOTERS =====
    "yamaha_mio_series": {
      id: "yamaha_mio_series",
      name: "Yamaha Mio Series (Sporty / J / GT / M3 125)",
      brand: "Yamaha",
      cc: 125,
      finalDriveRatio: 9.88,
      cvtLowRatio: 2.62,
      cvtHighRatio: 0.80,
      wheelDiameterMeters: 0.490,
      stockRollerWeightGrams: 12.0,
      targetShiftRpm: 8300,
      maxRpm: 10800,
      massKg: 94.0
    },
    "yamaha_fino_125": {
      id: "yamaha_fino_125",
      name: "Yamaha Fino 125 Blue Core",
      brand: "Yamaha",
      cc: 125,
      finalDriveRatio: 9.88,
      cvtLowRatio: 2.62,
      cvtHighRatio: 0.80,
      wheelDiameterMeters: 0.490,
      stockRollerWeightGrams: 12.0,
      targetShiftRpm: 8300,
      maxRpm: 10800,
      massKg: 98.0
    },
    "yamaha_gear_125": {
      id: "yamaha_gear_125",
      name: "Yamaha Gear 125",
      brand: "Yamaha",
      cc: 125,
      finalDriveRatio: 9.88,
      cvtLowRatio: 2.62,
      cvtHighRatio: 0.80,
      wheelDiameterMeters: 0.490,
      stockRollerWeightGrams: 11.0,
      targetShiftRpm: 8400,
      maxRpm: 10800,
      massKg: 95.0
    },
    "yamaha_freego_125": {
      id: "yamaha_freego_125",
      name: "Yamaha Freego 125 Connected",
      brand: "Yamaha",
      cc: 125,
      finalDriveRatio: 9.88,
      cvtLowRatio: 2.62,
      cvtHighRatio: 0.80,
      wheelDiameterMeters: 0.450, // 110/90-12
      stockRollerWeightGrams: 11.0,
      targetShiftRpm: 8400,
      maxRpm: 10800,
      massKg: 101.0
    },
    "yamaha_lexi_125": {
      id: "yamaha_lexi_125",
      name: "Yamaha Lexi 125 VVA / LX 155",
      brand: "Yamaha",
      cc: 125,
      finalDriveRatio: 9.08,
      cvtLowRatio: 2.58,
      cvtHighRatio: 0.76,
      wheelDiameterMeters: 0.500, // 100/90-14
      stockRollerWeightGrams: 11.0,
      targetShiftRpm: 8600,
      maxRpm: 11500,
      massKg: 113.0
    },
    "yamaha_aerox_155": {
      id: "yamaha_aerox_155",
      name: "Yamaha Aerox 155 VVA / Connected",
      brand: "Yamaha",
      cc: 155,
      finalDriveRatio: 8.85,
      cvtLowRatio: 2.56,
      cvtHighRatio: 0.74,
      wheelDiameterMeters: 0.515, // 140/70-14
      stockRollerWeightGrams: 13.0,
      targetShiftRpm: 8800,
      maxRpm: 12000,
      massKg: 125.0
    },
    "yamaha_nmax_155": {
      id: "yamaha_nmax_155",
      name: "Yamaha NMAX 155 VVA / Turbo Y-CVT",
      brand: "Yamaha",
      cc: 155,
      finalDriveRatio: 8.85,
      cvtLowRatio: 2.56,
      cvtHighRatio: 0.74,
      wheelDiameterMeters: 0.505, // 130/70-13
      stockRollerWeightGrams: 13.0,
      targetShiftRpm: 8800,
      maxRpm: 12000,
      massKg: 130.0
    },
    "yamaha_xmax_250": {
      id: "yamaha_xmax_250",
      name: "Yamaha XMAX 250 Tech MAX",
      brand: "Yamaha",
      cc: 250,
      finalDriveRatio: 7.82,
      cvtLowRatio: 2.45,
      cvtHighRatio: 0.70,
      wheelDiameterMeters: 0.535, // 140/70-14
      stockRollerWeightGrams: 17.0,
      targetShiftRpm: 7500,
      maxRpm: 9500,
      massKg: 179.0
    },

    // ===== SUZUKI AUTOMATIC SCOOTERS =====
    "suzuki_nex_2": {
      id: "suzuki_nex_2",
      name: "Suzuki Nex II 115 SEP",
      brand: "Suzuki",
      cc: 115,
      finalDriveRatio: 9.45,
      cvtLowRatio: 2.68,
      cvtHighRatio: 0.81,
      wheelDiameterMeters: 0.490,
      stockRollerWeightGrams: 10.0,
      targetShiftRpm: 8200,
      maxRpm: 10500,
      massKg: 93.0
    },
    "suzuki_address_115": {
      id: "suzuki_address_115",
      name: "Suzuki Address 115 FI",
      brand: "Suzuki",
      cc: 115,
      finalDriveRatio: 9.45,
      cvtLowRatio: 2.68,
      cvtHighRatio: 0.81,
      wheelDiameterMeters: 0.490,
      stockRollerWeightGrams: 11.0,
      targetShiftRpm: 8200,
      maxRpm: 10500,
      massKg: 97.0
    },
    "suzuki_burgman_125": {
      id: "suzuki_burgman_125",
      name: "Suzuki Burgman Street 125 EX",
      brand: "Suzuki",
      cc: 125,
      finalDriveRatio: 9.20,
      cvtLowRatio: 2.60,
      cvtHighRatio: 0.78,
      wheelDiameterMeters: 0.450, // 100/80-12
      stockRollerWeightGrams: 14.0,
      targetShiftRpm: 8000,
      maxRpm: 10200,
      massKg: 111.0
    },

    // ===== VESPA / PIAGGIO SCOOTERS =====
    "vespa_lx_125": {
      id: "vespa_lx_125",
      name: "Vespa LX 125 / S 125 i-Get",
      brand: "Vespa",
      cc: 125,
      finalDriveRatio: 9.25,
      cvtLowRatio: 2.65,
      cvtHighRatio: 0.80,
      wheelDiameterMeters: 0.460, // 110/70-11
      stockRollerWeightGrams: 14.0,
      targetShiftRpm: 7800,
      maxRpm: 9800,
      massKg: 114.0
    },
    "vespa_sprint_150": {
      id: "vespa_sprint_150",
      name: "Vespa Primavera / Sprint 150 i-Get",
      brand: "Vespa",
      cc: 154,
      finalDriveRatio: 8.90,
      cvtLowRatio: 2.58,
      cvtHighRatio: 0.76,
      wheelDiameterMeters: 0.480, // 120/70-12
      stockRollerWeightGrams: 15.5,
      targetShiftRpm: 8000,
      maxRpm: 10200,
      massKg: 120.0
    },
    "vespa_gts_150": {
      id: "vespa_gts_150",
      name: "Vespa GTS Super 150 / 300 HPE",
      brand: "Vespa",
      cc: 154,
      finalDriveRatio: 8.80,
      cvtLowRatio: 2.52,
      cvtHighRatio: 0.74,
      wheelDiameterMeters: 0.490, // 130/70-12
      stockRollerWeightGrams: 16.0,
      targetShiftRpm: 8200,
      maxRpm: 10500,
      massKg: 140.0
    },

    // ===== CUSTOM RACING CVT SCOOTER =====
    "custom_racing_cvt": {
      id: "custom_racing_cvt",
      name: "Custom Racing CVT Scooter (High Pulley / Stroker)",
      brand: "Custom",
      cc: 180,
      finalDriveRatio: 8.50,
      cvtLowRatio: 2.80,
      cvtHighRatio: 0.65,
      wheelDiameterMeters: 0.510,
      stockRollerWeightGrams: 10.0,
      targetShiftRpm: 9500,
      maxRpm: 13500,
      massKg: 105.0
    }
  };

  function getPreset(id) {
    return PRESETS[id] || PRESETS["honda_vario_125"];
  }

  function getAllPresets() {
    return Object.values(PRESETS);
  }

  return {
    getPreset,
    getAllPresets
  };
})();
