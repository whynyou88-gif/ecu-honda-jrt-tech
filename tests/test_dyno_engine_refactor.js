// ============================================================
// test_dyno_engine_refactor.js - System Unit Tests for Refactored Dyno Engine
// Tests RecordingEngine FSM, RunSession, RawSample 15-field validation,
// "Waiting for acceleration..." status calculation, and ProcessedRunBuffer.
// ============================================================

const assert = require('assert');
global.DynoPhysicsEngine = require('../HondaECUTool/data/web/js/dyno_engine.js');
const DynoArchitecture = require('../HondaECUTool/data/web/js/dyno_architecture.js');

console.log('🧪 Running Refactored Dyno Engine System Unit Tests...\n');

const Eng = DynoArchitecture;
const S = Eng.REC_STATES;

// 1. Test RecordingEngine Initial State
assert.strictEqual(Eng.getRecordingState(), S.IDLE, 'Initial RecordingEngine state must be IDLE.');
console.log('✅ Assertion 1 Passed: Initial RecordingEngine state is IDLE.');

// 2. Test RunSession Creation & Start Session
const session = Eng.RecordingEngine.startSession({ vehicle: 'Honda Vario 125 eSP' });
assert.strictEqual(Eng.getRecordingState(), S.RECORDING, 'State must transition to RECORDING.');
assert.strictEqual(session.vehicle, 'Honda Vario 125 eSP', 'Vehicle name must match.');
console.log('✅ Assertion 2 Passed: RecordingEngine startSession transitions to RECORDING.');

// 3. Test RawSample 15-field Validation and Rejection of Invalid Samples
const validPacket = {
  rpm: 4500,
  speed: 65.5,
  wheelSpeed: 65.5,
  tps: 75.0,
  map: 101.3,
  iat: 28.0,
  ect: 85.0,
  vbat: 13.8,
  injPW: 3.8,
  injDuty: 28.5,
  lambda: 0.90,
  afr: 13.2,
  ignTiming: 22.0,
  engineLoad: 80.0
};

// Append valid sample
const ok1 = Eng.RecordingEngine.appendSample(validPacket);
assert.strictEqual(ok1, true, 'Valid packet must be appended.');

// Try appending invalid sample (rpm <= 0)
const badRpmPacket = { ...validPacket, rpm: 0 };
const ok2 = Eng.RecordingEngine.appendSample(badRpmPacket);
assert.strictEqual(ok2, false, 'Packet with RPM <= 0 must be rejected.');

// Try appending invalid battery voltage
const badVbatPacket = { ...validPacket, rpm: 4600, vbat: 2.0 };
const ok3 = Eng.RecordingEngine.appendSample(badVbatPacket);
assert.strictEqual(ok3, false, 'Packet with invalid battery voltage must be rejected.');

console.log('✅ Assertion 3 Passed: RawSample validation filters out invalid packets correctly.');

// 4. Test "Waiting for acceleration..." Dyno Calculator Status
const staticCalc = Eng.DynoCalculator.calculatePowerAndTorque([
  { timestamp: 0.0, rpm: 3000, speed: 40.0 },
  { timestamp: 0.1, rpm: 3005, speed: 40.1 }
]);

assert.strictEqual(staticCalc.isReady, false, 'Static delta must return isReady = false.');
assert.strictEqual(staticCalc.statusText, 'Waiting for acceleration...', 'Must display "Waiting for acceleration...".');
console.log('✅ Assertion 4 Passed: DynoCalculator shows "Waiting for acceleration..." when static.');

// 5. Test Active Acceleration Power & Torque Calculation
const activeSamples = [];
for (let i = 0; i < 15; i++) {
  activeSamples.push({
    timestamp: parseFloat((i * 0.1).toFixed(2)),
    rpm: 3000 + i * 250,
    speed: 40 + i * 4
  });
}

const activeCalc = Eng.DynoCalculator.calculatePowerAndTorque(activeSamples, { weight: 110.0, wheelDiameter: 0.42 });
assert.strictEqual(activeCalc.isReady, true, 'Active acceleration must return isReady = true.');
assert.strictEqual(activeCalc.statusText, 'CALCULATING', 'Must display "CALCULATING".');
assert.strictEqual(activeCalc.hp > 0, true, 'Engine HP must be > 0.');
assert.strictEqual(activeCalc.tq > 0, true, 'Engine Torque must be > 0.');
console.log(`✅ Assertion 5 Passed: Active acceleration calculates power correctly (${activeCalc.hp} HP / ${activeCalc.tq} Nm).`);

// 6. Test ProcessedRunBuffer Monotonicity and Deduplication
for (let i = 0; i < 12; i++) {
  const p = { ...validPacket, rpm: 3000 + i * 200, speed: 40 + i * 3 };
  Eng.RecordingEngine.appendSample(p);
}

const finishedSession = Eng.RecordingEngine.stopSession();
assert.strictEqual(Eng.getRecordingState(), S.FINISHED, 'Recording state must be FINISHED.');
assert.strictEqual(finishedSession.processedBuffer.length > 0, true, 'Processed buffer must contain samples.');

const procBuf = finishedSession.processedBuffer;
for (let i = 1; i < procBuf.length; i++) {
  assert.strictEqual(procBuf[i].rpm > procBuf[i - 1].rpm, true, `Strict Monotonicity Error at index ${i}`);
}
console.log('✅ Assertion 6 Passed: ProcessedRunBuffer is strictly monotonic (RPM_i < RPM_{i+1}).');

console.log('\n🎉 ALL REFACTORED DYNO ENGINE SYSTEM UNIT TESTS PASSED SUCCESSFULLY!\n');
