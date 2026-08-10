// ============================================================
// graph_pipeline.js - Dyno Graph Data Pipeline Architecture
// Raw Samples -> Validation -> Outlier Removal -> Deduplication & Monotonic Sorting
// -> Linear Interpolation -> Savitzky-Golay Smoothing -> Immutable Processed Run
// ============================================================

const DynoGraphPipeline = (function() {

  /**
   * 1. Data Validation: Filter invalid numbers, NaNs, nulls, undefined, and post-STOP-RUN points.
   */
  function validateSamples(rawSamples) {
    if (!Array.isArray(rawSamples)) return [];
    
    const valid = [];
    for (let i = 0; i < rawSamples.length; i++) {
      const s = rawSamples[i];
      if (!s || s.isStopRunPoint) break; // Truncate post-STOP RUN samples

      const rpm = Number(s.rpm);
      if (Number.isNaN(rpm) || !Number.isFinite(rpm) || rpm < 500 || rpm > 18000) continue;

      const rawHp = Number(s.hp !== undefined ? s.hp : (s.hpEngine !== undefined ? s.hpEngine : (s.phys ? s.phys.hpEngine : 0)));
      const rawTq = Number(s.tq !== undefined ? s.tq : (s.tqEngine !== undefined ? s.tqEngine : (s.phys ? s.phys.tqEngine : 0)));
      const hp = Number.isFinite(rawHp) ? rawHp : 0.0;
      const tq = Number.isFinite(rawTq) ? rawTq : 0.0;

      valid.push({
        time: Number(s.time) || 0,
        rpm: Math.round(rpm),
        hp: parseFloat(hp.toFixed(2)),
        tq: parseFloat(tq.toFixed(2)),
        afr: Number.isFinite(Number(s.afr)) ? parseFloat(Number(s.afr).toFixed(2)) : 14.7,
        speed: Number.isFinite(Number(s.speed)) ? parseFloat(Number(s.speed).toFixed(1)) : 0,
        cvtRatio: Number.isFinite(Number(s.cvtRatio)) ? parseFloat(Number(s.cvtRatio).toFixed(2)) : 2.60
      });
    }

    return valid;
  }

  /**
   * 2. Outlier Detection & Removal:
   * Rejects extreme RPM jumps > 3000 RPM in 1 frame and Torque jumps > 30%.
   */
  function removeOutliers(validSamples) {
    if (validSamples.length < 2) return { clean: validSamples, outliers: [] };

    const clean = [validSamples[0]];
    const outliers = [];

    for (let i = 1; i < validSamples.length; i++) {
      const curr = validSamples[i];
      const prev = clean[clean.length - 1];

      const rpmDiff = Math.abs(curr.rpm - prev.rpm);
      const tqDiffAbs = Math.abs(curr.tq - prev.tq);

      // Discard point only on extreme hardware spikes (> 4000 RPM/frame or > 30 Nm instantaneous torque spike)
      const isExtremeSpike = (prev.tq > 2.0 && tqDiffAbs > 30.0) || rpmDiff > 4000;

      if (isExtremeSpike) {
        outliers.push(curr);
      } else {
        clean.push(curr);
      }
    }

    return { clean, outliers };
  }

  /**
   * 3. Deduplication & Monotonic Sorting:
   * Merges duplicate RPM samples using average values and sorts strictly monotonically (x_i < x_i+1).
   */
  function deduplicateAndSort(cleanSamples) {
    if (cleanSamples.length === 0) return [];

    const grouped = new Map();

    cleanSamples.forEach(s => {
      const rpmKey = s.rpm;
      if (!grouped.has(rpmKey)) {
        grouped.set(rpmKey, { hpSum: 0, tqSum: 0, afrSum: 0, spdSum: 0, cvtSum: 0, count: 0, time: s.time });
      }
      const g = grouped.get(rpmKey);
      g.hpSum += s.hp;
      g.tqSum += s.tq;
      g.afrSum += s.afr;
      g.spdSum += s.speed;
      g.cvtSum += s.cvtRatio;
      g.count += 1;
    });

    const merged = [];
    grouped.forEach((g, rpmKey) => {
      merged.push({
        time: g.time,
        rpm: rpmKey,
        hp: parseFloat((g.hpSum / g.count).toFixed(2)),
        tq: parseFloat((g.tqSum / g.count).toFixed(2)),
        afr: parseFloat((g.afrSum / g.count).toFixed(2)),
        speed: parseFloat((g.spdSum / g.count).toFixed(1)),
        cvtRatio: parseFloat((g.cvtSum / g.count).toFixed(2))
      });
    });

    // Sort strictly monotonically ascending by RPM
    merged.sort((a, b) => a.rpm - b.rpm);

    // Ensure strict monotonicity (x_i < x_{i+1})
    const strictMonotonic = [];
    let lastRpm = -1;

    for (let i = 0; i < merged.length; i++) {
      if (merged[i].rpm > lastRpm) {
        strictMonotonic.push(merged[i]);
        lastRpm = merged[i].rpm;
      }
    }

    return strictMonotonic;
  }

  /**
   * 4. Linear Interpolation for missing RPM steps (e.g. 100 RPM step grid).
   */
  function interpolateGaps(sortedSamples, stepRpm = 100) {
    if (sortedSamples.length < 2) return sortedSamples;

    const interpolated = [];
    const minRpm = Math.ceil(sortedSamples[0].rpm / stepRpm) * stepRpm;
    const maxRpm = Math.floor(sortedSamples[sortedSamples.length - 1].rpm / stepRpm) * stepRpm;

    let srcIdx = 0;

    for (let targetRpm = minRpm; targetRpm <= maxRpm; targetRpm += stepRpm) {
      while (srcIdx < sortedSamples.length - 2 && sortedSamples[srcIdx + 1].rpm <= targetRpm) {
        srcIdx++;
      }

      const p1 = sortedSamples[srcIdx];
      const p2 = sortedSamples[srcIdx + 1] || p1;

      if (p1.rpm === targetRpm) {
        interpolated.push(p1);
      } else if (p2.rpm > p1.rpm) {
        const factor = (targetRpm - p1.rpm) / (p2.rpm - p1.rpm);
        interpolated.push({
          time: parseFloat((p1.time + factor * (p2.time - p1.time)).toFixed(2)),
          rpm: targetRpm,
          hp: parseFloat((p1.hp + factor * (p2.hp - p1.hp)).toFixed(2)),
          tq: parseFloat((p1.tq + factor * (p2.tq - p1.tq)).toFixed(2)),
          afr: parseFloat((p1.afr + factor * (p2.afr - p1.afr)).toFixed(2)),
          speed: parseFloat((p1.speed + factor * (p2.speed - p1.speed)).toFixed(1)),
          cvtRatio: parseFloat((p1.cvtRatio + factor * (p2.cvtRatio - p1.cvtRatio)).toFixed(2)),
          isInterpolated: true
        });
      }
    }

    return interpolated.length > 0 ? interpolated : sortedSamples;
  }

  /**
   * 5. Savitzky-Golay 5-point Polynomial Smoothing Filter
   * Coefficients: [-3, 12, 17, 12, -3] / 35
   */
  function applySavitzkyGolay(points) {
    if (points.length < 5) return points;

    const coeffs = [-3, 12, 17, 12, -3];
    const norm = 35.0;
    const result = JSON.parse(JSON.stringify(points));

    for (let i = 2; i < points.length - 2; i++) {
      let hpSum = 0, tqSum = 0, afrSum = 0;
      for (let j = -2; j <= 2; j++) {
        hpSum += points[i + j].hp * coeffs[j + 2];
        tqSum += points[i + j].tq * coeffs[j + 2];
        afrSum += points[i + j].afr * coeffs[j + 2];
      }
      result[i].hp = Math.max(0, parseFloat((hpSum / norm).toFixed(2)));
      result[i].tq = Math.max(0, parseFloat((tqSum / norm).toFixed(2)));
      result[i].afr = parseFloat((afrSum / norm).toFixed(2));
    }

    return result;
  }

  /**
   * Moving Average Filter
   */
  function applyMovingAverage(points, windowSize = 3) {
    if (points.length < windowSize) return points;

    const half = Math.floor(windowSize / 2);
    const result = JSON.parse(JSON.stringify(points));

    for (let i = 0; i < points.length; i++) {
      let hpSum = 0, tqSum = 0, count = 0;
      for (let j = -half; j <= half; j++) {
        const idx = i + j;
        if (idx >= 0 && idx < points.length) {
          hpSum += points[idx].hp;
          tqSum += points[idx].tq;
          count++;
        }
      }
      result[i].hp = parseFloat((hpSum / count).toFixed(2));
      result[i].tq = parseFloat((tqSum / count).toFixed(2));
    }

    return result;
  }

  /**
   * Main Pipeline Entry Point: Transforms raw samples into an immutable processed run.
   */
  function processRun(rawSamples, smoothingLevel = 2) {
    // Step 1: Validation
    const valid = validateSamples(rawSamples);

    // Step 2: Outlier Removal
    const { clean, outliers } = removeOutliers(valid);

    // Step 3: Deduplication & Monotonic Sorting
    const deduplicated = deduplicateAndSort(clean);

    // Step 4: Linear Interpolation
    const interpolated = interpolateGaps(deduplicated, 100);

    // Step 5: Dual Smoothing (Moving Average + Savitzky-Golay)
    let processed = applyMovingAverage(interpolated, smoothingLevel > 0 ? smoothingLevel * 2 + 1 : 1);
    if (smoothingLevel >= 2) {
      processed = applySavitzkyGolay(processed);
    }

    // Step 6: Recalculate Peak HP & Peak Torque
    let peakHp = 0, peakHpRpm = 0;
    let peakTq = 0, peakTqRpm = 0;

    processed.forEach(p => {
      if (p.hp >= peakHp) { peakHp = p.hp; peakHpRpm = p.rpm; }
      if (p.tq >= peakTq) { peakTq = p.tq; peakTqRpm = p.rpm; }
    });

    // Return Immutable Processed Run Data Structure
    return Object.freeze({
      rawCount: rawSamples ? rawSamples.length : 0,
      validCount: valid.length,
      outlierCount: outliers.length,
      raw: Object.freeze([...(rawSamples || [])]),
      outliers: Object.freeze(outliers),
      interpolated: Object.freeze(interpolated),
      processed: Object.freeze(processed),
      peakHp: peakHp,
      peakHpRpm: peakHpRpm,
      peakTq: peakTq,
      peakTqRpm: peakTqRpm
    });
  }

  return {
    validateSamples,
    removeOutliers,
    deduplicateAndSort,
    interpolateGaps,
    applySavitzkyGolay,
    applyMovingAverage,
    processRun
  };

})();

if (typeof window !== 'undefined') window.DynoGraphPipeline = DynoGraphPipeline;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DynoGraphPipeline;
}
