// ============================================================
// cvt_tuner.js - Automatic Scooter CVT Tuning Assistant
// Analyzes recorded dyno pull samples to automatically diagnose:
// Roller Weight (Too Heavy/Light), Contra Spring (Too Hard/Soft),
// Belt Slip, RPM Hunting, and calculates 20-40/40-60/60-100 Accel Splits.
// ============================================================

const CVTTuningAssistant = (function() {

  function analyzeCVTPull(samples, presetId = "honda_vario_125") {
    const preset = ScooterPresets.getPreset(presetId);
    const targetRpm = preset.targetShiftRpm || 8500;
    const stockRoller = preset.stockRollerWeightGrams || 15.0;

    if (!samples || samples.length < 5) {
      return {
        status: "INCOMPLETE",
        launchRpm: 0,
        peakRpm: 0,
        shiftRpm: 0,
        pulleyEfficiencyPct: 0,
        accel20_40: "-",
        accel40_60: "-",
        accel60_100: "-",
        rollerDiagnosis: "Data Tidak Cukup",
        springDiagnosis: "Data Tidak Cukup",
        beltDiagnosis: "Data Tidak Cukup",
        recommendations: ["Lakukan Dyno Pull gas pol (WOT) dari diam sampai top speed."]
      };
    }

    let launchRpm = 0;
    let peakRpm = 0;
    let maxSpeed = 0;
    let shiftRpmSum = 0;
    let shiftRpmCount = 0;
    let maxShiftPct = 0;
    let beltSlipDetected = false;
    let minShiftRpm = 99999;

    let t20 = null, t40 = null, t60 = null, t100 = null;

    samples.forEach(s => {
      const rpm = s.rpm || 0;
      const spd = s.speed || s.speedKmh || 0;
      const t = parseFloat(s.time) || 0;
      const shiftPct = s.pulleyShiftPct || 0;

      if (rpm > peakRpm) peakRpm = rpm;
      if (spd > maxSpeed) maxSpeed = spd;
      if (shiftPct > maxShiftPct) maxShiftPct = shiftPct;

      // Launch RPM detection (speed crosses 10 km/h)
      if (!launchRpm && spd >= 10.0 && rpm > 2000) {
        launchRpm = rpm;
      }

      // Shift phase RPM holding (between 25% and 80% pulley travel)
      if (shiftPct >= 25.0 && shiftPct <= 80.0 && rpm > 3000) {
        shiftRpmSum += rpm;
        shiftRpmCount++;
        if (rpm < minShiftRpm) minShiftRpm = rpm;
      }

      if (s.isBeltSlipping) beltSlipDetected = true;

      // Accel split timers
      if (spd >= 20.0 && t20 === null) t20 = t;
      if (spd >= 40.0 && t40 === null) t40 = t;
      if (spd >= 60.0 && t60 === null) t60 = t;
      if (spd >= 100.0 && t100 === null) t100 = t;
    });

    const avgShiftRpm = shiftRpmCount > 0 ? Math.round(shiftRpmSum / shiftRpmCount) : peakRpm;
    const rpmSag = (avgShiftRpm > 0 && minShiftRpm < 99999) ? (avgShiftRpm - minShiftRpm) : 0;

    // Split acceleration calculation
    const accel20_40 = (t40 !== null && t20 !== null) ? (t40 - t20).toFixed(2) + "s" : "-";
    const accel40_60 = (t60 !== null && t40 !== null) ? (t60 - t40).toFixed(2) + "s" : "-";
    const accel60_100 = (t100 !== null && t60 !== null) ? (t100 - t60).toFixed(2) + "s" : "-";

    const recommendations = [];

    // 1. Roller Weight Diagnosis
    let rollerStatus = "OPTIMAL";
    let rollerDiagText = "Roller Optimal (Pas di Powerband)";
    const rpmDiff = avgShiftRpm - targetRpm;

    if (rpmDiff < -600) {
      rollerStatus = "TOO_HEAVY";
      rollerDiagText = "Roller Terlalu Berat (RPM Ngempos / Drop)";
      const recGrams = Math.min(3.0, Math.max(1.0, Math.round(Math.abs(rpmDiff) / 400.0 * 10) / 10));
      recommendations.push(`⚠️ ROLLER TERLALU BERAT: RPM Shift tertahan di ${avgShiftRpm} RPM (Target ideal: ${targetRpm} RPM). Turunkan berat roller seberat ${recGrams}g (misal dari ${stockRoller}g ke ${(stockRoller - recGrams).toFixed(1)}g) agar napas akselerasi langsung berada di peak power.`);
    } else if (rpmDiff > 700) {
      rollerStatus = "TOO_LIGHT";
      rollerDiagText = "Roller Terlalu Ringan (RPM Meraung / Overrev)";
      const recGrams = Math.min(3.0, Math.max(1.0, Math.round(rpmDiff / 400.0 * 10) / 10));
      recommendations.push(`⚠️ ROLLER TERLALU RINGAN: RPM Shift meraung hingga ${avgShiftRpm} RPM melewati powerband. Naikkan berat roller seberat ${recGrams}g (misal dari ${stockRoller}g ke ${(stockRoller + recGrams).toFixed(1)}g) untuk meredam over-rev dan meningkatkan torsi dorong.`);
    } else {
      recommendations.push(`✅ ROLLER PROPER: RPM Holding terkunci sangat stabil di kisaran ${avgShiftRpm} RPM (Sangat dekat dengan target powerband ${targetRpm} RPM).`);
    }

    // 2. Contra Spring Diagnosis
    let springStatus = "OPTIMAL";
    let springDiagText = "Per CVT / Contra Spring Optimal";

    if (rpmSag > 800) {
      springStatus = "TOO_SOFT";
      springDiagText = "Per CVT Terlalu Lembek (RPM Drop Tengah Roll-on)";
      recommendations.push(`⚠️ PER CVT / CONTRA SPRING TERLALU LEMBEK: Terjadi penurunan RPM mendadak sebesar ${rpmSag} RPM pada kecepatan menengah (40-60 km/h). Ganti per CVT dengan yang lebih keras (+1000 RPM / +1500 RPM) agar pully belakang tidak langsung membuka mendadak.`);
    } else if (maxShiftPct < 85.0 && maxSpeed > 60.0) {
      springStatus = "TOO_HARD";
      springDiagText = "Per CVT Terlalu Keras (Gagal Top Overdrive)";
      recommendations.push(`⚠️ PER CVT TERLALU KERAS: Pully gagal mencapai pergeseran rasio tertinggi / overdrive (Pergeseran max hanya ${maxShiftPct.toFixed(1)}%). Gunakan per CVT yang lebih empuk agar mesin mampu meraih Top Speed secara optimal.`);
    } else {
      recommendations.push(`✅ PER CVT OPTIMAL: Rasio CVT bergeser mulus hingga ${maxShiftPct.toFixed(1)}% overdrive tanpa mengalami RPM sag signifikan.`);
    }

    // 3. V-Belt Slip & Pulley Health
    let beltDiagText = beltSlipDetected ? "Terdeteksi V-Belt Slip (Slip Vanbelt)" : "V-Belt Kencang & Sehat (Bebas Slip)";
    if (beltSlipDetected) {
      recommendations.push(`🛑 BELT SLIP DETECTED: Terdeteksi lonjakan RPM mendadak tanpa diimbangi pertambahan kecepatan roda. Periksa kebersihan pully CVT dari gemuk/oli dan pastikan V-belt tidak aus / mengeras.`);
    }

    const pulleyEfficiencyPct = parseFloat(Math.min(94.0, Math.max(70.0, 92.0 - (beltSlipDetected ? 18.0 : 0.0) - (rpmSag / 100.0))).toFixed(1));

    return {
      status: "SUCCESS",
      launchRpm: launchRpm || 3500,
      peakRpm: peakRpm || 0,
      shiftRpm: avgShiftRpm,
      pulleyEfficiencyPct: pulleyEfficiencyPct,
      accel20_40,
      accel40_60,
      accel60_100,
      rollerStatus,
      rollerDiagText,
      springStatus,
      springDiagText,
      beltDiagText,
      recommendations
    };
  }

  return {
    analyzeCVTPull
  };
})();
