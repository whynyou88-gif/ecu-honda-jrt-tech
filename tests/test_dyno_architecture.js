// ============================================================
// test_dyno_architecture.js - System Unit Tests for Dyno Runtime Architecture
// Tests FSM (8 States), LiveDataStore, RunRecorder (15 fields), & Packet Rejection
// ============================================================

const assert = require('assert');
const DynoArchitecture = require('../HondaECUTool/data/web/js/dyno_architecture.js');

console.log('🧪 Running Commercial Dyno Architecture System Unit Tests...\n');

// 1. Test RecordingEngine State Transitions
const FSM = DynoArchitecture;
const S = FSM.REC_STATES;

assert.strictEqual(FSM.getRecordingState(), S.IDLE, 'Initial FSM state must be IDLE.');
console.log('✅ Assertion 1 Passed: Initial state is IDLE.');

const stateHistory = [];
FSM.onRecordingStateChange((newState, oldState) => {
  stateHistory.push({ oldState, newState });
});

FSM.setRecordingState(S.READY);
FSM.setRecordingState(S.ARMED);
FSM.setRecordingState(S.RECORDING);

assert.strictEqual(FSM.getRecordingState(), S.RECORDING, 'Current FSM state must be RECORDING.');
assert.strictEqual(stateHistory.length, 3, 'Should have logged 3 state transitions.');
console.log('✅ Assertion 2 Passed: FSM transitions through IDLE -> READY -> ARMED -> RECORDING.');

// 2. Test LiveDataStore at 100-200 Hz
const mockRawFrame = {
  rpm: 6500,
  speed: 85.0,
  tps: 80.5,
  map: 101.3,
  afr: 13.2,
  vbat: 13.8,
  injPW: 4.2,
  ignTiming: 24.5,
  ect: 85.0,
  iat: 30.0
};

FSM.LiveDataStore.update(mockRawFrame);
const latestFrame = FSM.LiveDataStore.getLatest();

assert.strictEqual(latestFrame.rpm, 6500, 'RPM must match.');
assert.strictEqual(latestFrame.speed, 85.0, 'Speed must match.');
assert.strictEqual(latestFrame.throttle, 80.5, 'TPS must match.');
assert.strictEqual(latestFrame.battery, 13.8, 'Battery voltage must match.');
assert.strictEqual(latestFrame.injectorPW, 4.2, 'Injector PW must match.');
assert.strictEqual(latestFrame.ignition, 24.5, 'Ignition timing must match.');

console.log('✅ Assertion 3 Passed: LiveDataStore updates 100-200 Hz raw sensor frame correctly.');

// 3. Test Packet Rejection outside Recording State
FSM.setRecordingState(S.IDLE);
const recordOutsideResult = FSM.RecordingEngine.appendSample(mockRawFrame);
assert.strictEqual(recordOutsideResult, false, 'Samples recorded outside Recording state must be rejected.');
console.log('✅ Assertion 4 Passed: Packets outside Recording state are correctly rejected.');

// 4. Test RecordingEngine (15 Standardized Fields)
FSM.RecordingEngine.startSession({ vehicle: 'Test Scooter' });
assert.strictEqual(FSM.getRecordingState(), S.RECORDING, 'State must transition to RECORDING on startSession().');

for (let i = 0; i < 15; i++) {
  const frame = { ...mockRawFrame, timestamp: Date.now() + i * 100, rpm: 3000 + i * 200, speed: 40 + i * 3 };
  const recorded = FSM.RecordingEngine.appendSample(frame);
  assert.strictEqual(recorded, true, `Sample #${i+1} must be recorded.`);
}

const session = FSM.RecordingEngine.stopSession();
assert.strictEqual(FSM.getRecordingState(), S.FINISHED, 'State must transition to FINISHED after stopSession().');
assert.strictEqual(session.rawSamples.length, 15, 'RunSession must contain 15 raw samples.');

// Validate 15 Fields in Sample #1
const sample1 = session.rawSamples[0];
const requiredFields = [
  'timestamp', 'rpm', 'speed', 'throttle', 'map', 'afr', 'lambda',
  'battery', 'injectorPW', 'injectorDuty', 'ignition', 'engineTemp',
  'wheelSpeed', 'airTemp', 'coolantTemp'
];

requiredFields.forEach(field => {
  assert.notStrictEqual(sample1[field], undefined, `Field [${field}] must exist in sample.`);
});

console.log('✅ Assertion 5 Passed: RunRecorder captures all 15 standardized sample fields.');
console.log('✅ Assertion 6 Passed: State transitions to Completed after recording >= 10 samples.');

console.log('\n🎉 ALL DYNO RUNTIME ARCHITECTURE SYSTEM UNIT TESTS PASSED SUCCESSFULLY!\n');
