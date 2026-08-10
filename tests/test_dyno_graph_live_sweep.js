// ============================================================
// test_dyno_graph_live_sweep.js - Unit Test for Live 1000 RPM Sweep Dyno Graph Plotting
// Asserts live samples starting from 1000 RPM populate processedBuffer with positive HP and Torque.
// ============================================================

const assert = require('assert');
const DynoArchitecture = require('../HondaECUTool/data/web/js/dyno_architecture.js');

console.log('🧪 Running Live Dyno Graph Sweep Unit Tests...\n');

// 1. Start Recording Session
DynoArchitecture.RecordingEngine.startSession({ vehicle: 'Honda Vario 125 eSP' });

// 2. Append live samples starting from 1000 RPM up to 7000 RPM
const sampleData = [
  { rpm: 1000, speed: 10, tps: 20, map: 101.3, vbat: 12.4, hpEngine: 1.2, tqEngine: 8.5 },
  { rpm: 1200, speed: 15, tps: 35, map: 101.3, vbat: 12.4, hpEngine: 2.1, tqEngine: 9.8 },
  { rpm: 1500, speed: 22, tps: 50, map: 101.3, vbat: 12.4, hpEngine: 3.5, tqEngine: 11.2 },
  { rpm: 2000, speed: 30, tps: 70, map: 101.3, vbat: 12.4, hpEngine: 5.4, tqEngine: 13.1 },
  { rpm: 3000, speed: 45, tps: 100, map: 101.3, vbat: 12.4, hpEngine: 8.8, tqEngine: 15.6 },
  { rpm: 5000, speed: 70, tps: 100, map: 101.3, vbat: 12.4, hpEngine: 12.4, tqEngine: 14.8 }
];

sampleData.forEach((d, idx) => {
  const phys = { hpEngine: d.hpEngine, tqEngine: d.tqEngine };
  const ok = DynoArchitecture.RecordingEngine.appendSample(d, phys);
  assert.strictEqual(ok, true, `Sample #${idx+1} at ${d.rpm} RPM must be appended.`);
});

const activeSession = DynoArchitecture.RecordingEngine.getActiveSession();
const procBuf = activeSession.processedBuffer;

assert.strictEqual(procBuf.length, 6, 'Processed buffer must contain 6 samples.');
assert.strictEqual(procBuf[0].rpm, 1000, 'First sample RPM must be 1000 RPM.');
assert.strictEqual(procBuf[0].hp > 0, true, 'First sample HP must be > 0 (1.2 HP).');
assert.strictEqual(procBuf[0].tq > 0, true, 'First sample TQ must be > 0 (8.5 Nm).');

console.log('✅ Assertion 1 Passed: Low RPM sweep (1000 RPM+) preserves positive HP & Torque in processedBuffer.');

// 3. Verify monotonic RPM ordering and valid X-axis bounds
for (let i = 1; i < procBuf.length; i++) {
  assert.strictEqual(procBuf[i].rpm > procBuf[i-1].rpm, true, `Strict monotonicity error at sample #${i+1}`);
}

console.log('✅ Assertion 2 Passed: Processed buffer is strictly monotonic (RPM_i < RPM_{i+1}).');

console.log('\n🎉 ALL LIVE DYNO GRAPH SWEEP UNIT TESTS PASSED SUCCESSFULLY!\n');
