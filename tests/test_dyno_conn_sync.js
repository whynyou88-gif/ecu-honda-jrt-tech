// ============================================================
// test_dyno_conn_sync.js - Unit Test for Dyno Connection Synchronization
// Asserts FSM connection STATES and REC_STATES synchronization.
// ============================================================

const assert = require('assert');
const DynoArchitecture = require('../HondaECUTool/data/web/js/dyno_architecture.js');

console.log('🧪 Running Dyno Connection Synchronization Unit Tests...\n');

// 1. Verify Dual FSM Exposing
assert.notStrictEqual(DynoArchitecture.STATES, undefined, 'STATES enum must be exported.');
assert.notStrictEqual(DynoArchitecture.REC_STATES, undefined, 'REC_STATES enum must be exported.');

console.log('✅ Assertion 1 Passed: Both STATES and REC_STATES exported successfully.');

// 2. Verify Connection FSM state management
assert.strictEqual(DynoArchitecture.getState(), DynoArchitecture.STATES.DISCONNECTED, 'Initial state must be Disconnected.');

DynoArchitecture.setState(DynoArchitecture.STATES.ECU_CONNECTED);
assert.strictEqual(DynoArchitecture.getState(), DynoArchitecture.STATES.ECU_CONNECTED, 'State must transition to ECU Connected.');

console.log('✅ Assertion 2 Passed: Connection FSM transitions to ECU_CONNECTED.');

// 3. Verify Recording Engine FSM state management
assert.strictEqual(DynoArchitecture.getRecordingState(), DynoArchitecture.REC_STATES.IDLE, 'Initial recording state must be IDLE.');

DynoArchitecture.RecordingEngine.startSession({ vehicle: 'Vario 125' });
assert.strictEqual(DynoArchitecture.getRecordingState(), DynoArchitecture.REC_STATES.RECORDING, 'Recording state must transition to RECORDING.');

DynoArchitecture.RecordingEngine.stopSession();
assert.strictEqual(DynoArchitecture.getRecordingState(), DynoArchitecture.REC_STATES.FINISHED, 'Recording state must transition to FINISHED.');

console.log('✅ Assertion 3 Passed: Recording FSM transitions through RECORDING -> FINISHED.');

console.log('\n🎉 ALL DYNO CONNECTION SYNC UNIT TESTS PASSED SUCCESSFULLY!\n');
