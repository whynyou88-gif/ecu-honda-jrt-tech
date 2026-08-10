// ============================================================
// test_dyno_graph_live_run.js - System Unit Test for Rapid Sweep Dyno Graph Pipeline
// Asserts rapid RPM sweeps (1100 RPM to 7000 RPM) pass through pipeline without sample drops.
// ============================================================

const assert = require('assert');
const DynoGraphPipeline = require('../HondaECUTool/data/web/js/graph_pipeline.js');

console.log('🧪 Running Rapid Sweep Dyno Graph Pipeline Unit Tests...\n');

// 1. Rapid RPM sweep raw samples (1100 RPM -> 7000 RPM)
const rawSweepData = [
  { time: 0.1, rpm: 1100, hp: 1.2, tq: 7.8, afr: 14.5 },
  { time: 0.2, rpm: 2200, hp: 3.5, tq: 11.2, afr: 13.8 }, // Jump = 1100 RPM (> 800)
  { time: 0.3, rpm: 3800, hp: 6.8, tq: 14.1, afr: 13.2 }, // Jump = 1600 RPM (> 800)
  { time: 0.4, rpm: 5500, hp: 11.4, tq: 15.5, afr: 12.8 }, // Jump = 1700 RPM (> 800)
  { time: 0.5, rpm: 7000, hp: 14.2, tq: 13.9, afr: 12.5 }  // Jump = 1500 RPM (> 800)
];

const processedRun = DynoGraphPipeline.processRun(rawSweepData, 2);

console.log(`📊 Raw Input Samples: ${processedRun.rawCount}`);
console.log(`✅ Valid Samples Filtered: ${processedRun.validCount}`);
console.log(`🚫 Outliers Discarded: ${processedRun.outlierCount}`);
console.log(`🏆 Final Processed Points: ${processedRun.processed.length}`);

// Assertions
assert.strictEqual(processedRun.validCount, 5, 'All 5 raw sweep samples must be valid.');
assert.strictEqual(processedRun.outlierCount, 0, 'No valid rapid sweep points should be discarded as outliers.');
assert.strictEqual(processedRun.processed.length > 0, true, 'Processed dataset must contain plottable points.');
assert.strictEqual(processedRun.peakHp > 0, true, 'Peak HP must be calculated.');

console.log('✅ Assertion 1 Passed: Rapid RPM sweeps pass through validation and outlier filtering without drops.');
console.log('✅ Assertion 2 Passed: Processed dataset contains valid plottable points.');

console.log('\n🎉 ALL RAPID SWEEP DYNO GRAPH PIPELINE UNIT TESTS PASSED SUCCESSFULLY!\n');
