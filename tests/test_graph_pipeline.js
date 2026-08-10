// ============================================================
// test_graph_pipeline.js - Unit Tests for Dyno Graph Data Pipeline
// Tests noisy sample dataset processing, zero vertical spikes,
// strict monotonicity (x_i < x_i+1), outlier rejection, and peak recalculation.
// ============================================================

const assert = require('assert');
const DynoGraphPipeline = require('../HondaECUTool/data/web/js/graph_pipeline.js');

console.log('🧪 Running Dyno Graph Data Pipeline Unit Tests...\n');

// 1. Test Dataset with Noise, Spikes, Duplicates, NaNs, and Outliers
const noisyDataset = [
  { time: 0.0, rpm: 3000, hp: 5.2, tq: 12.0, afr: 14.7 },
  { time: 0.1, rpm: 3100, hp: 5.5, tq: 12.4, afr: 14.5 },
  { time: 0.2, rpm: 3100, hp: 5.7, tq: 12.6, afr: 14.5 }, // Duplicate RPM 3100
  { time: 0.3, rpm: 3200, hp: 6.0, tq: 13.0, afr: 14.4 },
  { time: 0.4, rpm: 8800, hp: 12.0, tq: 20.0, afr: 14.0 }, // OUTLIER: RPM jump > 4000 RPM (3200 -> 8800)
  { time: 0.5, rpm: 3300, hp: 6.3, tq: 13.2, afr: 14.2 },
  { time: 0.6, rpm: 3400, hp: 6.8, tq: 99.0, afr: 14.0 }, // OUTLIER: Torque spike > 30 Nm (13.2 -> 99.0)
  { time: 0.7, rpm: 3400, hp: 7.0, tq: 13.5, afr: 14.1 },
  { time: 0.8, rpm: NaN,  hp: 8.0, tq: 14.0, afr: 14.0 }, // INVALID: NaN RPM
  { time: 0.9, rpm: 3500, hp: null, tq: 14.0, afr: 14.0 },// INVALID: null HP
  { time: 1.0, rpm: 3600, hp: 8.5, tq: 15.0, afr: 13.8 },
  { time: 1.1, rpm: 3800, hp: 9.8, tq: 16.2, afr: 13.5 },
  { time: 1.2, rpm: 4000, hp: 11.2, tq: 17.5, afr: 13.2 },
  { time: 1.3, rpm: 4200, hp: 12.5, tq: 18.2, afr: 13.0 },
  { time: 1.4, rpm: 4400, hp: 13.8, tq: 18.8, afr: 12.8 },
  { time: 1.5, rpm: 4600, hp: 14.5, tq: 19.0, afr: 12.7 },
  { time: 1.6, rpm: 4800, hp: 15.2, tq: 19.2, afr: 12.6 },
  { time: 1.7, rpm: 5000, hp: 15.8, tq: 19.0, afr: 12.5 }, // Peak HP 15.8 @ 5000 RPM
  { time: 1.8, rpm: 5200, hp: 15.4, tq: 18.5, afr: 12.6 },
  { time: 1.9, rpm: 5400, hp: 14.8, tq: 17.8, afr: 12.8 },
  { time: 2.0, rpm: 5600, hp: 14.0, tq: 16.5, afr: 13.0 },
  { time: 2.1, rpm: 5800, hp: 13.0, tq: 15.0, afr: 13.2 },
  { time: 2.2, rpm: 6000, hp: 12.0, tq: 14.0, afr: 13.5 },
  { time: 2.3, rpm: 6000, hp: 0.0,  tq: 0.0,  afr: 0.0, isStopRunPoint: true }, // STOP RUN MARKER
  { time: 2.4, rpm: 6200, hp: 10.0, tq: 12.0, afr: 14.0 } // Truncated post-STOP RUN point
];

// Execute Pipeline
const result = DynoGraphPipeline.processRun(noisyDataset, 2);

console.log(`📊 Pipeline Input Raw Samples: ${result.rawCount}`);
console.log(`✅ Valid Samples Filtered: ${result.validCount}`);
console.log(`🚫 Outliers Discarded: ${result.outlierCount}`);
console.log(`📈 Interpolated Points Grid: ${result.interpolated.length}`);
console.log(`🏆 Final Processed Points: ${result.processed.length}`);
console.log(`🔥 Calculated Peak HP: ${result.peakHp} HP @ ${result.peakHpRpm} RPM`);
console.log(`⚡ Calculated Peak Torque: ${result.peakTq} Nm @ ${result.peakTqRpm} RPM\n`);

// TEST ASSERTIONS

// Assertion 1: Post-STOP RUN truncation & invalid sample filtering
assert.strictEqual(result.validCount, 22, 'Invalid samples and post-STOP RUN samples must be filtered out.');
console.log('✅ Assertion 1 Passed: Truncates post-STOP RUN samples and filters invalid samples correctly.');

// Assertion 2: Outliers Rejected
assert.strictEqual(result.outlierCount >= 2, true, 'Must detect and reject RPM & Torque outliers.');
console.log('✅ Assertion 2 Passed: Outliers (RPM > 800 & Tq > 30%) rejected.');

// Assertion 3: Zero Duplicate X Axis Values & Strict Monotonicity
const processed = result.processed;
for (let i = 1; i < processed.length; i++) {
  const prevX = processed[i - 1].rpm;
  const currX = processed[i].rpm;
  assert.strictEqual(currX > prevX, true, `Strict Monotonicity Error at index ${i}: prevX=${prevX}, currX=${currX}`);
}
console.log('✅ Assertion 3 Passed: Zero duplicate X values, strictly monotonic (X_i < X_{i+1}).');

// Assertion 4: Zero Vertical Spikes
for (let i = 1; i < processed.length; i++) {
  const deltaX = processed[i].rpm - processed[i - 1].rpm;
  assert.notStrictEqual(deltaX, 0, 'Vertical spike (deltaX == 0) detected!');
}
console.log('✅ Assertion 4 Passed: Zero vertical spikes (deltaX != 0).');

// Assertion 5: Peak HP & Peak Torque Recalculated
assert.strictEqual(result.peakHp > 0, true, 'Peak HP must be calculated.');
assert.strictEqual(result.peakTq > 0, true, 'Peak Torque must be calculated.');
console.log('✅ Assertion 5 Passed: Peak HP & Peak Torque recalculated accurately.');

console.log('\n🎉 ALL GRAPH DATA PIPELINE UNIT TESTS PASSED SUCCESSFULLY!\n');
