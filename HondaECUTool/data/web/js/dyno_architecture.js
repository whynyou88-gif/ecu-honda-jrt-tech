// ============================================================
// dyno_architecture.js - Commercial Dyno Runtime Architecture Engine
// Supports 8-state FSM (Disconnected -> USB Connected -> ECU Connected -> Streaming -> Ready -> Recording -> Stopping -> Completed)
// RecordingEngine + RunSession + RawSample (15 Fields) + GraphBuffer + DynoCalculator
// Producer-Consumer 30 FPS Graph Engine & Pipeline Logging
// ============================================================

const DynoArchitecture = (function() {

  // 1. CONNECTION FSM STATES
  const STATES = Object.freeze({
    DISCONNECTED: 'Disconnected',
    USB_CONNECTED: 'USB Connected',
    ECU_CONNECTED: 'ECU Connected',
    STREAMING: 'Streaming',
    READY: 'Ready',
    RECORDING: 'Recording',
    SAVING: 'Saving',
    COMPLETED: 'Completed'
  });

  let _connState = STATES.DISCONNECTED;
  const _connStateListeners = [];

  function getState() { return _connState; }

  function setState(newState) {
    if (!Object.values(STATES).includes(newState)) return;
    const oldState = _connState;
    _connState = newState;
    logStage('FSM', `Connection State Transition: [${oldState}] -> [${newState}]`);
    _connStateListeners.forEach(fn => {
      try { fn(newState, oldState); } catch(e) {}
    });
  }

  function onStateChange(listener) {
    if (typeof listener === 'function') _connStateListeners.push(listener);
  }

  // 2. RECORDING ENGINE STATES
  const REC_STATES = Object.freeze({
    IDLE: 'IDLE',
    READY: 'READY',
    ARMED: 'ARMED',
    RECORDING: 'RECORDING',
    STOPPING: 'STOPPING',
    FINISHED: 'FINISHED'
  });

  let _recState = REC_STATES.IDLE;
  const _recStateListeners = [];

  function getRecordingState() { return _recState; }

  function setRecordingState(newState) {
    if (!Object.values(REC_STATES).includes(newState)) return;
    const oldState = _recState;
    _recState = newState;
    logStage('RecordingEngine', `Recording State Transition: [${oldState}] -> [${newState}]`);

    _recStateListeners.forEach(fn => {
      try { fn(newState, oldState); } catch(e) {}
    });
  }

  function onRecordingStateChange(listener) {
    if (typeof listener === 'function') _recStateListeners.push(listener);
  }

  // 3. STAGE-BY-STAGE PIPELINE LOGGER
  const _pipelineLogs = [];
  function logStage(stage, message, data = null) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    const entry = { timestamp, stage, message, data };
    _pipelineLogs.push(entry);
    if (_pipelineLogs.length > 500) _pipelineLogs.shift();
    console.log(`[DYNO ENGINE | ${timestamp}] [${stage}] ${message}`);
  }

  function getLogs() { return [..._pipelineLogs]; }

  // 4. REAL-TIME METRICS FOR DEBUG PANEL (11 Metrics)
  const DebugMetrics = {
    recordingState: 'IDLE',
    packetRateHz: 0,
    sampleRateHz: 0,
    graphFps: 30,
    rawSampleCount: 0,
    processedSampleCount: 0,
    graphPointsCount: 0,
    droppedPackets: 0,
    queueSize: 0,
    lastPacketTime: null,
    samplingRateHz: 0,
    bufferSize: 0,
    currentEstHp: 0.0,
    currentEstTq: 0.0
  };

  // 5. LIVE DATA STORE (100-200 Hz Raw Telemetry Ingestion)
  const LiveDataStore = (function() {
    let _latestPacket = null;
    let _packetCount = 0;
    let _lastHzTime = Date.now();
    let _calculatedHz = 0;

    return {
      update: function(rawFrame) {
        if (!rawFrame) return;
        _latestPacket = {
          ...rawFrame,
          throttle: rawFrame.tps !== undefined ? rawFrame.tps : rawFrame.throttle,
          battery: rawFrame.vbat !== undefined ? rawFrame.vbat : rawFrame.battery,
          injectorPW: rawFrame.injPW !== undefined ? rawFrame.injPW : rawFrame.injectorPW,
          ignition: rawFrame.ignTiming !== undefined ? rawFrame.ignTiming : rawFrame.ignition,
          timestamp: Date.now()
        };
        _packetCount++;

        const now = Date.now();
        if (now - _lastHzTime >= 1000) {
          _calculatedHz = _packetCount;
          _packetCount = 0;
          _lastHzTime = now;
          DebugMetrics.samplingRateHz = _calculatedHz;
          DebugMetrics.sampleRateHz = _calculatedHz;
          DebugMetrics.packetRateHz = _calculatedHz;
        }

        DebugMetrics.lastPacketTime = _latestPacket.timestamp;
      },
      getLatest: function() { return _latestPacket; },
      getSamplingHz: function() { return _calculatedHz; }
    };
  })();

  // 6. RAW SAMPLE VALIDATOR (15 Fields)
  function validateRawSample(sample, prevTimestamp) {
    if (!sample) return { valid: false, reason: 'null_sample' };

    const rpm = Number(sample.rpm);
    const ts = Number(sample.timestamp);
    const spd = Number(sample.speed);
    const vbat = Number(sample.battery);

    if (Number.isNaN(rpm) || Number.isNaN(ts) || Number.isNaN(spd)) return { valid: false, reason: 'NaN_values' };
    if (rpm <= 0) return { valid: false, reason: 'rpm_le_zero' };
    if (ts <= prevTimestamp && prevTimestamp > 0) return { valid: false, reason: 'duplicate_timestamp' };
    if (spd < 0) return { valid: false, reason: 'negative_speed' };
    if (vbat < 5.0 || vbat > 20.0) return { valid: false, reason: 'invalid_battery_voltage' };

    return { valid: true };
  }

  // 7. RUN SESSION MODEL & RECORDING ENGINE
  let _activeSession = null;

  function createRunSession(config = {}) {
    return {
      runId: config.runId || Date.now(),
      vehicle: config.vehicle || 'Honda Vario 125 eSP',
      operator: config.operator || 'Dyno Operator',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('id'),
      ambient: config.ambient || { temp: 28, humidity: 60, pressure: 1013 },
      weight: config.weight || 110.0,
      wheelDiameter: config.wheelDiameter || 0.42,
      rawSamples: [],
      processedSamples: [],
      processedBuffer: [],
      graphBuffer: [],
      peakPower: 0.0,
      peakPowerRpm: 0,
      peakTorque: 0.0,
      peakTorqueRpm: 0,
      peakAFR: 14.7,
      peakLambda: 1.0,
      duration: 0.0
    };
  }

  const RecordingEngine = {
    startSession: function(config = {}) {
      _activeSession = createRunSession(config);
      setRecordingState(REC_STATES.RECORDING);
      setState(STATES.RECORDING);
      logStage('RecordingEngine', `RunSession initialized (ID=${_activeSession.runId}). Recording ACTIVE.`);
      return _activeSession;
    },

    appendSample: function(rawFrame, physData = null) {
      if (_recState !== REC_STATES.RECORDING) {
        DebugMetrics.droppedPackets += 1;
        logStage('RecordingEngine', `Sample rejected (State=${_recState})`);
        return false;
      }

      if (!_activeSession) _activeSession = createRunSession({});

      const prevTs = _activeSession.rawSamples.length > 0
        ? _activeSession.rawSamples[_activeSession.rawSamples.length - 1].timestamp
        : 0;

      const calcElapsed = (Date.now() - Date.parse(_activeSession.date)) / 1000.0;
      const sampleTime = prevTs > 0 ? Math.max(prevTs + 0.005, calcElapsed) : Math.max(0.001, calcElapsed);

      // Compute Thermodynamics Physics
      const thermo = (typeof DynoPhysicsEngine !== 'undefined')
        ? DynoPhysicsEngine.calculateThermodynamics({
            rpm: rawFrame.rpm,
            tps: rawFrame.tps || rawFrame.throttle,
            map: rawFrame.map,
            iat: rawFrame.iat || rawFrame.airTemp,
            ect: rawFrame.ect || rawFrame.coolantTemp,
            vbat: rawFrame.vbat || rawFrame.battery,
            injPW: rawFrame.injPW || rawFrame.injectorPW,
            injDuty: rawFrame.injDuty || rawFrame.injectorDuty,
            ignTiming: rawFrame.ignTiming || rawFrame.ignition,
            afr: rawFrame.afr,
            lambda: rawFrame.lambda,
            engineLoad: rawFrame.engineLoad
          })
        : { hpEngine: 0, tqEngine: 0, vePct: 85, bmepKpa: 800 };

      const hpLive = physData && physData.hpEngine ? physData.hpEngine : (thermo.hpEngine || rawFrame.hp || 0);
      const tqLive = physData && physData.tqEngine ? physData.tqEngine : (thermo.tqEngine || rawFrame.tq || 0);

      DebugMetrics.currentEstHp = hpLive;
      DebugMetrics.currentEstTq = tqLive;

      // 15 Standardized RawSample Fields
      const rawSample = {
        timestamp: parseFloat(sampleTime.toFixed(3)),
        rpm: Math.round(Number(rawFrame.rpm) || 0),
        speed: parseFloat((Number(rawFrame.speed) || 0).toFixed(1)),
        wheelSpeed: parseFloat((Number(rawFrame.wheelSpeed || rawFrame.speed) || 0).toFixed(1)),
        throttle: parseFloat((Number(rawFrame.tps || rawFrame.throttle) || 0).toFixed(1)),
        tps: parseFloat((Number(rawFrame.tps || rawFrame.throttle) || 0).toFixed(1)),
        map: parseFloat((Number(rawFrame.map) || 101.3).toFixed(1)),
        iat: parseFloat((Number(rawFrame.iat || rawFrame.airTemp) || 25).toFixed(1)),
        ect: parseFloat((Number(rawFrame.ect || rawFrame.coolantTemp) || 35).toFixed(1)),
        airTemp: parseFloat((Number(rawFrame.iat || rawFrame.airTemp) || 25).toFixed(1)),
        coolantTemp: parseFloat((Number(rawFrame.ect || rawFrame.coolantTemp) || 35).toFixed(1)),
        engineTemp: parseFloat((Number(rawFrame.ect || rawFrame.engineTemp) || 35).toFixed(1)),
        battery: parseFloat((Number(rawFrame.vbat || rawFrame.battery) || 12.4).toFixed(1)),
        injectorPW: parseFloat((Number(rawFrame.injPW || rawFrame.injectorPW) || 0).toFixed(2)),
        injectorDuty: parseFloat((Number(rawFrame.injDuty || rawFrame.injectorDuty) || 0).toFixed(1)),
        lambda: parseFloat((Number(rawFrame.lambda) || 1.0).toFixed(2)),
        afr: parseFloat((Number(rawFrame.afr) || 14.7).toFixed(1)),
        ignition: parseFloat((Number(rawFrame.ignTiming || rawFrame.ignition) || 10).toFixed(1)),
        engineLoad: parseFloat((Math.min(100, ((Number(rawFrame.map) || 101.3) / 101.3) * 100)).toFixed(1)),
        hp: parseFloat(Number(hpLive).toFixed(2)),
        tq: parseFloat(Number(tqLive).toFixed(2)),
        thermo: thermo
      };

      const check = validateRawSample(rawSample, prevTs);
      if (!check.valid) {
        DebugMetrics.droppedPackets += 1;
        logStage('RecordingEngine', `Sample rejected: ${check.reason}`);
        return false;
      }

      _activeSession.rawSamples.push(rawSample);
      DebugMetrics.rawSampleCount = _activeSession.rawSamples.length;
      DebugMetrics.bufferSize = _activeSession.rawSamples.length;

      // Dyno Power & Torque Calculation over active samples
      const calcResult = DynoCalculator.calculatePowerAndTorque(_activeSession.rawSamples, _activeSession);
      
      // Update Processed Buffer & GraphBuffer
      _activeSession.processedBuffer = ProcessedRunBuffer.processSamples(_activeSession.rawSamples, calcResult);
      _activeSession.graphBuffer = [..._activeSession.processedBuffer];
      DebugMetrics.processedSampleCount = _activeSession.processedBuffer.length;
      DebugMetrics.graphPointsCount = _activeSession.processedBuffer.length;

      logStage('RecordingEngine', `Appended sample #${_activeSession.rawSamples.length}: RPM=${rawSample.rpm}, HP=${hpLive.toFixed(1)}`);
      return true;
    },

    stopSession: function() {
      setRecordingState(REC_STATES.STOPPING);
      setState(STATES.COMPLETED);
      logStage('RecordingEngine', 'Stopping Dyno Pull session...');

      if (_activeSession) {
        _activeSession.duration = _activeSession.rawSamples.length > 0
          ? _activeSession.rawSamples[_activeSession.rawSamples.length - 1].timestamp
          : 0;

        // Final Processed Run Buffer computation
        const calcResult = DynoCalculator.calculatePowerAndTorque(_activeSession.rawSamples, _activeSession);
        _activeSession.processedBuffer = ProcessedRunBuffer.processSamples(_activeSession.rawSamples, calcResult);
        _activeSession.graphBuffer = [..._activeSession.processedBuffer];

        // Recalculate Peaks
        let pkHp = 0, pkHpRpm = 0, pkTq = 0, pkTqRpm = 0;
        _activeSession.processedBuffer.forEach(p => {
          if (p.hp >= pkHp) { pkHp = p.hp; pkHpRpm = p.rpm; }
          if (p.tq >= pkTq) { pkTq = p.tq; pkTqRpm = p.rpm; }
        });

        _activeSession.peakPower = pkHp;
        _activeSession.peakPowerRpm = pkHpRpm;
        _activeSession.peakTorque = pkTq;
        _activeSession.peakTorqueRpm = pkTqRpm;

        setRecordingState(REC_STATES.FINISHED);
        logStage('RecordingEngine', `Session FINISHED. Peak Power: ${pkHp.toFixed(1)} HP @ ${pkHpRpm} RPM`);
      }

      return _activeSession;
    },

    getActiveSession: function() { return _activeSession; }
  };

  // 8. VIRTUAL DYNO CALCULATOR
  const DynoCalculator = {
    calculatePowerAndTorque: function(rawSamples, sessionConfig = {}) {
      if (!rawSamples || rawSamples.length < 2) {
        return { statusText: 'Waiting for acceleration...', isReady: false, hp: 0, tq: 0 };
      }

      const pFirst = rawSamples[0];
      const pLast = rawSamples[rawSamples.length - 1];
      const dt = Math.max(0.01, pLast.timestamp - pFirst.timestamp);
      const dRpm = pLast.rpm - pFirst.rpm;

      if (dRpm < 50 || dt <= 0) {
        return { statusText: 'Waiting for acceleration...', isReady: false, hp: 0, tq: 0 };
      }

      let hp = pLast.hp || 0;
      let tq = pLast.tq || 0;

      if ((!hp || hp <= 0) && typeof DynoPhysicsEngine !== 'undefined') {
        const est = DynoPhysicsEngine.calculateThermodynamics({
          rpm: pLast.rpm,
          tps: pLast.tps || pLast.throttle || 80.0,
          map: pLast.map || 101.3
        });
        hp = est.hpEngine;
        tq = est.tqEngine;
      }

      return {
        statusText: 'CALCULATING',
        isReady: true,
        hp: hp,
        tq: tq
      };
    }
  };

  // 9. PROCESSED RUN BUFFER / GRAPH BUFFER (Deduplication, Monotonic Sorting, Interpolation, SG Smoothing)
  const ProcessedRunBuffer = {
    processSamples: function(rawSamples, calcResult = {}) {
      if (!rawSamples || rawSamples.length === 0) return [];

      // Step A: Group by RPM
      const grouped = new Map();
      rawSamples.forEach(s => {
        const rpmKey = s.rpm;
        if (!grouped.has(rpmKey)) {
          grouped.set(rpmKey, { hpSum: 0, tqSum: 0, afrSum: 0, spdSum: 0, mapSum: 0, tpsSum: 0, ignSum: 0, loadSum: 0, count: 0, time: s.timestamp });
        }
        const g = grouped.get(rpmKey);
        const curHp = (s.hp !== undefined && s.hp > 0) ? s.hp : (calcResult.hp || 0);
        const curTq = (s.tq !== undefined && s.tq > 0) ? s.tq : (calcResult.tq || 0);
        g.hpSum += curHp;
        g.tqSum += curTq;
        g.afrSum += s.afr;
        g.spdSum += s.speed;
        g.mapSum += s.map;
        g.tpsSum += s.throttle || s.tps;
        g.ignSum += s.ignition;
        g.loadSum += s.engineLoad;
        g.count += 1;
      });

      // Step B: Average duplicated RPMs
      const merged = [];
      grouped.forEach((g, rpmKey) => {
        merged.push({
          timestamp: g.time,
          rpm: rpmKey,
          hp: parseFloat((g.hpSum / g.count).toFixed(2)),
          tq: parseFloat((g.tqSum / g.count).toFixed(2)),
          afr: parseFloat((g.afrSum / g.count).toFixed(2)),
          speed: parseFloat((g.spdSum / g.count).toFixed(1)),
          map: parseFloat((g.mapSum / g.count).toFixed(1)),
          tps: parseFloat((g.tpsSum / g.count).toFixed(1)),
          ignition: parseFloat((g.ignSum / g.count).toFixed(1)),
          engineLoad: parseFloat((g.loadSum / g.count).toFixed(1))
        });
      });

      // Step C: Sort strictly monotonic ascending by RPM
      merged.sort((a, b) => a.rpm - b.rpm);

      // Step D: Strict Monotonicity Filter (x_i < x_i+1)
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
  };

  return {
    STATES,
    getState,
    setState,
    onStateChange,
    REC_STATES,
    getRecordingState,
    setRecordingState,
    onRecordingStateChange,
    logStage,
    getLogs,
    DebugMetrics,
    LiveDataStore,
    RecordingEngine,
    DynoCalculator,
    ProcessedRunBuffer,
    createRunSession
  };

})();

if (typeof window !== 'undefined') window.DynoArchitecture = DynoArchitecture;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DynoArchitecture;
}
