// ============================================================
// dyno_engine.js - Commercial ECU Virtual Dyno Engine
// Thermodynamic Engine Modeling & Air/Fuel Mass Physics Estimation
// Computes Volumetric Efficiency (VE), Cylinder Air Filling (m_air),
// Fuel Mass (m_fuel), BMEP, Combustion Efficiency, Estimated Torque & HP.
// Configurable per motorcycle model calibrations without hardcoded rigid equations.
// ============================================================

const DynoPhysicsEngine = (function() {

  const R_SPECIFIC_AIR = 287.058; // J/(kg*K)
  const Q_LOWER_HEATING_VALUE = 44000.0; // kJ/kg for commercial gasoline
  const GASOLINE_DENSITY_G_PER_L = 740.0; // g/L

  // Configurable Calibration Coefficients per Scooter Model
  const SCOOTER_CALIBRATIONS = {
    'honda_vario_125':   { name: 'Honda Vario 125 eSP', displacementCc: 124.8, veMax: 0.88, injFlowGpm: 100, boreMm: 52.4, strokeMm: 57.9, mechEff: 0.88 },
    'honda_beat_110':    { name: 'Honda BeAT 110 eSP / FI', displacementCc: 108.2, veMax: 0.85, injFlowGpm: 85,  boreMm: 50.0, strokeMm: 55.1, mechEff: 0.87 },
    'honda_vario_150':   { name: 'Honda Vario 150 eSP', displacementCc: 149.3, veMax: 0.90, injFlowGpm: 120, boreMm: 57.3, strokeMm: 57.9, mechEff: 0.89 },
    'honda_vario_160':   { name: 'Honda Vario 160 eSP+', displacementCc: 156.9, veMax: 0.92, injFlowGpm: 140, boreMm: 60.0, strokeMm: 55.5, mechEff: 0.90 },
    'honda_scoopy_110':  { name: 'Honda Scoopy 110 eSP', displacementCc: 109.5, veMax: 0.85, injFlowGpm: 85,  boreMm: 47.0, strokeMm: 63.1, mechEff: 0.87 },
    'honda_genio_110':   { name: 'Honda Genio 110 eSP', displacementCc: 109.5, veMax: 0.85, injFlowGpm: 85,  boreMm: 47.0, strokeMm: 63.1, mechEff: 0.87 },
    'honda_stylo_160':   { name: 'Honda Stylo 160 eSP+', displacementCc: 156.9, veMax: 0.92, injFlowGpm: 140, boreMm: 60.0, strokeMm: 55.5, mechEff: 0.90 },
    'honda_pcx_150':     { name: 'Honda PCX 150', displacementCc: 149.3, veMax: 0.90, injFlowGpm: 120, boreMm: 57.3, strokeMm: 57.9, mechEff: 0.89 },
    'honda_pcx_160':     { name: 'Honda PCX 160 eSP+', displacementCc: 156.9, veMax: 0.92, injFlowGpm: 140, boreMm: 60.0, strokeMm: 55.5, mechEff: 0.90 },
    'honda_adv_160':     { name: 'Honda ADV 160 eSP+', displacementCc: 156.9, veMax: 0.92, injFlowGpm: 140, boreMm: 60.0, strokeMm: 55.5, mechEff: 0.90 },
    'yamaha_mio_series': { name: 'Yamaha Mio Series', displacementCc: 124.9, veMax: 0.86, injFlowGpm: 95,  boreMm: 52.4, strokeMm: 57.9, mechEff: 0.87 },
    'yamaha_fino_125':   { name: 'Yamaha Fino 125', displacementCc: 125.0, veMax: 0.86, injFlowGpm: 95,  boreMm: 52.4, strokeMm: 57.9, mechEff: 0.87 },
    'yamaha_gear_125':   { name: 'Yamaha Gear 125', displacementCc: 124.9, veMax: 0.86, injFlowGpm: 95,  boreMm: 52.4, strokeMm: 57.9, mechEff: 0.87 },
    'yamaha_freego_125': { name: 'Yamaha Freego 125', displacementCc: 125.0, veMax: 0.86, injFlowGpm: 95,  boreMm: 52.4, strokeMm: 57.9, mechEff: 0.87 },
    'yamaha_lexi_125':   { name: 'Yamaha Lexi 125 / LX 155', displacementCc: 124.7, veMax: 0.89, injFlowGpm: 110, boreMm: 52.0, strokeMm: 58.7, mechEff: 0.88 },
    'yamaha_aerox_155':  { name: 'Yamaha Aerox 155 VVA', displacementCc: 155.1, veMax: 0.93, injFlowGpm: 150, boreMm: 58.0, strokeMm: 58.7, mechEff: 0.90 },
    'yamaha_nmax_155':   { name: 'Yamaha NMAX 155 VVA', displacementCc: 155.1, veMax: 0.93, injFlowGpm: 150, boreMm: 58.0, strokeMm: 58.7, mechEff: 0.90 },
    'yamaha_xmax_250':   { name: 'Yamaha XMAX 250', displacementCc: 249.8, veMax: 0.94, injFlowGpm: 180, boreMm: 70.0, strokeMm: 64.9, mechEff: 0.91 },
    'suzuki_nex_2':      { name: 'Suzuki Nex II 115', displacementCc: 113.0, veMax: 0.85, injFlowGpm: 88,  boreMm: 51.0, strokeMm: 55.2, mechEff: 0.87 },
    'suzuki_address_115':{ name: 'Suzuki Address 115', displacementCc: 113.0, veMax: 0.85, injFlowGpm: 88,  boreMm: 51.0, strokeMm: 55.2, mechEff: 0.87 },
    'suzuki_burgman_125':{ name: 'Suzuki Burgman 125', displacementCc: 124.0, veMax: 0.87, injFlowGpm: 100, boreMm: 52.5, strokeMm: 57.4, mechEff: 0.88 },
    'custom_racing_cvt': { name: 'Custom Racing CVT Scooter', displacementCc: 180.0, veMax: 0.98, injFlowGpm: 220, boreMm: 63.0, strokeMm: 57.9, mechEff: 0.92 }
  };

  function getCalibration(modelId) {
    return SCOOTER_CALIBRATIONS[modelId] || SCOOTER_CALIBRATIONS['honda_vario_125'];
  }

  /**
   * Main ECU Thermodynamics Power & Torque Estimator
   */
  function calculateThermodynamics(params) {
    const {
      rpm = 0,
      tps = 0.0,
      map = 101.3,
      iat = 25.0,
      ect = 35.0,
      vbat = 12.4,
      injPW = 0.0,
      injDuty = 0.0,
      ignTiming = 10.0,
      afr = 14.7,
      lambda = 1.0,
      engineLoad = 0.0,
      modelId = 'honda_vario_125',
      customCalib = null
    } = params;

    const calib = customCalib || getCalibration(modelId);

    if (rpm < 500) {
      return {
        vePct: 0.0,
        airMassMg: 0.0,
        airFlowGps: 0.0,
        fuelMassMg: 0.0,
        fuelFlowLh: 0.0,
        bmepKpa: 0.0,
        bmepBar: 0.0,
        combustionEffPct: 0.0,
        engineEfficiencyPct: 0.0,
        tqEngine: 0.0,
        hpEngine: 0.0,
        hpWheel: 0.0,
        powerBand: '0 - 0 RPM',
        statusText: 'Waiting for engine start...'
      };
    }

    const dispM3 = (calib.displacementCc || 124.8) * 1e-6;
    const tempK = Math.max(250.0, iat + 273.15);
    const mapKpa = Math.max(20.0, Math.min(250.0, map));

    // 1. Volumetric Efficiency (VE) Model
    const fMap = Math.pow(mapKpa / 101.325, 0.92);
    const fIat = Math.sqrt(298.15 / tempK);
    const fEct = ect < 70.0 ? 0.92 + (ect / 70.0) * 0.08 : 1.0;
    const fTps = 0.35 + 0.65 * Math.pow(Math.min(100.0, tps) / 100.0, 0.75);

    let ve = (calib.veMax || 0.88) * fMap * fIat * fEct * fTps;
    ve = Math.max(0.20, Math.min(1.15, ve));

    // 2. Cylinder Air Filling (m_air in mg per 4-stroke cycle)
    const pPa = mapKpa * 1000.0;
    const mAirKg = (pPa * dispM3 * ve) / (R_SPECIFIC_AIR * tempK);
    const airMassMg = Math.max(0.0, mAirKg * 1e6);

    // Air Flow Rate (g/s)
    const cyclesPerSec = (rpm / 60.0) / 2.0;
    const airFlowGps = Math.max(0.0, (airMassMg * cyclesPerSec) / 1000.0);

    // 3. Fuel Mass (m_fuel in mg per cycle)
    const effectiveAfr = afr > 5.0 ? afr : (lambda > 0.0 ? lambda * 14.7 : 14.7);
    const fuelMassMg = Math.max(0.0, airMassMg / Math.max(8.0, effectiveAfr));

    // Fuel Flow Rate (L/h)
    const fuelMassGps = (fuelMassMg * cyclesPerSec) / 1000.0;
    const fuelFlowLh = Math.max(0.0, (fuelMassGps * 3600.0) / GASOLINE_DENSITY_G_PER_L);

    // 4. Combustion Efficiency (eta_comb) & Ignition Advance Correction
    const ignDelta = Math.abs(ignTiming - 28.0);
    const fIgn = Math.max(0.70, 1.0 - (ignDelta / 100.0));
    const fAfrDelta = Math.abs(effectiveAfr - 13.2);
    const fAfr = Math.max(0.75, 1.0 - (fAfrDelta / 30.0));
    const vbatComp = vbat >= 12.0 ? 1.0 : Math.max(0.85, vbat / 12.0);

    const combustionEff = Math.max(0.65, Math.min(0.98, 0.95 * fIgn * fAfr * vbatComp));

    // 5. Brake Mean Effective Pressure (BMEP in kPa)
    const energyPerCycleJ = (fuelMassMg / 1e6) * (Q_LOWER_HEATING_VALUE * 1000.0) * combustionEff * 0.32;
    const bmepKpa = Math.max(0.0, (energyPerCycleJ / dispM3) / 1000.0);
    const bmepBar = bmepKpa / 100.0;

    // 6. Estimated Engine Torque (Nm) & Horsepower (HP)
    const mechEff = calib.mechEff || 0.88;
    const tqEngineRaw = ((bmepKpa * 1000.0) * dispM3) / (4.0 * Math.PI);
    const tqEngine = Math.max(0.0, tqEngineRaw * mechEff);
    const hpEngine = Math.max(0.0, (tqEngine * rpm) / 7127.0);
    const hpWheel = Math.max(0.0, hpEngine * 0.85); // ~15% CVT belt/clutch loss

    // Overall Engine Thermal Efficiency %
    const engineEfficiency = Math.max(0.0, Math.min(45.0, (hpEngine * 745.7 / Math.max(1.0, fuelMassGps * (Q_LOWER_HEATING_VALUE * 1000.0))) * 100.0));

    // Power Band Determination
    const lowerBand = Math.round(Math.max(1000, rpm * 0.7));
    const upperBand = Math.round(Math.min(12000, rpm * 1.25));
    const powerBand = `${lowerBand.toLocaleString()} - ${upperBand.toLocaleString()} RPM`;

    return {
      vePct: parseFloat((ve * 100.0).toFixed(1)),
      airMassMg: parseFloat(airMassMg.toFixed(1)),
      airFlowGps: parseFloat(airFlowGps.toFixed(2)),
      fuelMassMg: parseFloat(fuelMassMg.toFixed(2)),
      fuelFlowLh: parseFloat(fuelFlowLh.toFixed(2)),
      bmepKpa: parseFloat(bmepKpa.toFixed(1)),
      bmepBar: parseFloat(bmepBar.toFixed(2)),
      combustionEffPct: parseFloat((combustionEff * 100.0).toFixed(1)),
      engineEfficiencyPct: parseFloat(engineEfficiency.toFixed(1)),
      tqEngine: parseFloat(tqEngine.toFixed(2)),
      hpEngine: parseFloat(hpEngine.toFixed(2)),
      hpWheel: parseFloat(hpWheel.toFixed(2)),
      powerBand: powerBand,
      statusText: tps > 5.0 && rpm > 1500 ? 'CALCULATING' : 'Waiting for acceleration...'
    };
  }

  return {
    SCOOTER_CALIBRATIONS,
    getCalibration,
    calculateThermodynamics,
    // Alias for backward compatibility
    computePowerAndTorque: function(params) {
      const thermo = calculateThermodynamics(params);
      return {
        hpEngine: thermo.hpEngine,
        hpWheel: thermo.hpWheel,
        tqEngine: thermo.tqEngine,
        tqWheel: thermo.tqEngine * 1.2,
        speedKmh: params.speedKmhInput || (params.rpm ? (params.rpm / 100.0) : 0),
        cvtRatio: 2.60,
        pulleyShiftPct: 0.0,
        isBeltSlipping: false,
        cvtEfficiencyPct: 85.0,
        thermo: thermo
      };
    }
  };

})();

if (typeof window !== 'undefined') window.DynoPhysicsEngine = DynoPhysicsEngine;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DynoPhysicsEngine;
}
