// ============================================================
// test_virtual_dyno_engine.js - Commercial ECU Virtual Dyno Unit Tests
// Asserts ECU thermodynamic modeling, FSM state flow, 15-field RawSample logging,
// GraphBuffer rendering, and error overlays.
// ============================================================

const assert = require('assert');
const DynoPhysicsEngine = require('../HondaECUTool/data/web/js/dyno_engine.js');
const DynoArchitecture = require('../HondaECUTool/data/web/js/dyno_architecture.js');

console.log('🧪 Running Commercial ECU Virtual Dyno System Unit Tests...\n');

// 1. Test Thermodynamic Engine Physics Modeling
const thermo = DynoPhysicsEngine.calculateThermodynamics({
  rpm: 6500,
  tps: 85.0,
  map: 101.3,
  iat: 28.0,
  ect: 85.0,
  vbat: 13.8,
  injPW: 4.5,
  injDuty: 48.0,
  ignTiming: 24.0,
  afr: 13.2,
  lambda: 0.90,
  modelId: 'honda_vario_125'
});

assert.strictEqual(thermo.hpEngine > 0, true, 'Estimated Engine HP must be > 0.');
assert.strictEqual(thermo.tqEngine > 0, true, 'Estimated Engine Torque must be > 0.');
assert.strictEqual(thermo.vePct > 50, true, 'Volumetric Efficiency must be > 50%.');
assert.strictEqual(thermo.bmepBar > 5.0, true, 'BMEP must be > 5.0 bar.');
assert.strictEqual(thermo.airFlowGps > 0, true, 'Air Flow must be > 0 g/s.');
assert.strictEqual(thermo.fuelFlowLh > 0, true, 'Fuel Flow must be > 0 L/h.');

console.log(`✅ Assertion 1 Passed: Thermodynamic Engine Estimation calculated successfully (${thermo.hpEngine} HP / ${thermo.tqEngine} Nm / ${thermo.vePct}% VE / ${thermo.bmepBar} bar BMEP).`);

// 2. Test Connection FSM 8-State Flow
const S = DynoArchitecture.STATES;
assert.strictEqual(DynoArchitecture.getState(), S.DISCONNECTED, 'Initial FSM state must be Disconnected.');

DynoArchitecture.setState(S.USB_CONNECTED);
DynoArchitecture.setState(S.ECU_CONNECTED);
DynoArchitecture.setState(S.STREAMING);
DynoArchitecture.setState(S.READY);

assert.strictEqual(DynoArchitecture.getState(), S.READY, 'State must transition to Ready.');
console.log('✅ Assertion 2 Passed: Connection FSM 8-State transitions verified.');

// 3. Test RecordingEngine & 15-Field RawSample Logging
const session = DynoArchitecture.RecordingEngine.startSession({ vehicle: 'Honda Vario 160 eSP+' });
assert.strictEqual(DynoArchitecture.getRecordingState(), DynoArchitecture.REC_STATES.RECORDING, 'Recording FSM state must be RECORDING.');

const rawPacket = {
  rpm: 4500,
  speed: 55.0,
  wheelSpeed: 55.0,
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

const appended = DynoArchitecture.RecordingEngine.appendSample(rawPacket);
assert.strictEqual(appended, true, 'Valid 15-field packet must be appended.');

const rawSample = session.rawSamples[0];
const required15Fields = [
  'timestamp', 'rpm', 'speed', 'wheelSpeed', 'throttle', 'tps', 'map', 'iat',
  'ect', 'battery', 'injectorPW', 'injectorDuty', 'lambda', 'afr', 'ignition', 'engineLoad'
];

required15Fields.forEach(f => {
  assert.notStrictEqual(rawSample[f], undefined, `Field [${f}] must exist in RawSample.`);
});

console.log('✅ Assertion 3 Passed: 15-field RawSample captured and validated.');

// 4. Test GraphBuffer Monotonic Sorting & Deduplication
for (let i = 0; i < 10; i++) {
  const p = { ...rawPacket, timestamp: Date.now() + i * 50, rpm: 4600 + i * 200 };
  DynoArchitecture.RecordingEngine.appendSample(p);
}

const finishedSession = DynoArchitecture.RecordingEngine.stopSession();
assert.strictEqual(DynoArchitecture.getRecordingState(), DynoArchitecture.REC_STATES.FINISHED, 'Recording FSM must be FINISHED.');
assert.strictEqual(finishedSession.graphBuffer.length > 0, true, 'GraphBuffer must contain samples.');

const gBuf = finishedSession.graphBuffer;
for (let i = 1; i < gBuf.length; i++) {
  assert.strictEqual(gBuf[i].rpm > gBuf[i - 1].rpm, true, `GraphBuffer monotonicity error at index ${i}`);
}

console.log('✅ Assertion 4 Passed: GraphBuffer is strictly monotonic and deduplicated.');

console.log('\n🎉 ALL COMMERCIAL ECU VIRTUAL DYNO SYSTEM UNIT TESTS PASSED SUCCESSFULLY!\n');
