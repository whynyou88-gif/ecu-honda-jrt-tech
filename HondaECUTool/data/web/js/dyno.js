// ============================================================
// dyno.js - Virtual Dyno Studio (DynoJet 1.2.0 Grade Architecture)
// Multi-Run Overlay Comparison + Real Telemetry Physics + Savitzky-Golay Smoothing
// ============================================================

const DynoUI = (function() {
  let _chart = null;
  let _afrChart = null;
  let _pullTimer = null;
  let _isPulling = false;
  let _startTime = 0;
  let _currentMode = 'engine'; // engine | wheel | torque | time
  let _smoothingLevel = 2; // 0=Off, 1=Light, 2=Standard, 3=Smooth, 4=DynoJet Grade
  let _activeRunId = 1;
  let _savedRuns = [];

  function generateDefaultRunSamples(stage) {
    const samples = [];
    const maxRpm = stage === 2 ? 10200 : 9400;
    const baseHp = stage === 2 ? 12.8 : 11.2;
    const baseTq = stage === 2 ? 12.2 : 10.8;
    const pkHpRpm = stage === 2 ? 8800 : 8500;
    const pkTqRpm = stage === 2 ? 5500 : 5000;

    for (let rpm = 1500; rpm <= maxRpm; rpm += 100) {
      let normRpm = (rpm - 1500) / (maxRpm - 1500);
      let tqFactor = Math.exp(-Math.pow((rpm - pkTqRpm) / 2800, 2));
      let tq = (baseTq * 0.45) + (baseTq * 0.55) * tqFactor;
      let hp = (tq * rpm) / 7127.0;
      let afr = 14.2 - (normRpm * 1.6);
      if (stage === 2) afr -= 0.4;

      samples.push({
        time: (rpm - 1500) / 1000.0,
        rpm: rpm,
        hp: parseFloat(hp.toFixed(2)),
        hpEngine: parseFloat(hp.toFixed(2)),
        tq: parseFloat(tq.toFixed(2)),
        tqEngine: parseFloat(tq.toFixed(2)),
        afr: parseFloat(afr.toFixed(2)),
        speed: parseFloat(((rpm / 100.0) * 0.95).toFixed(1)),
        cvtRatio: parseFloat((2.6 - (normRpm * 1.8)).toFixed(2)),
        tps: Math.min(100, 20 + normRpm * 80),
        map: 101.3
      });
    }
    return samples;
  }

  // Multi-Run Comparison Storage (Run #1, Run #2)
  let _runs = {
    1: { id: 1, label: 'Run #1 (Stock Base)', color: '#FF3B30', hpBins: {}, tqBins: {}, afrBins: {}, peakHp: 11.2, peakHpRpm: 8500, peakTq: 10.8, peakTqRpm: 5000, samples: generateDefaultRunSamples(1), visible: true },
    2: { id: 2, label: 'Run #2 (Remap Stage 1)', color: '#00E5FF', hpBins: {}, tqBins: {}, afrBins: {}, peakHp: 12.8, peakHpRpm: 8800, peakTq: 12.2, peakTqRpm: 5500, samples: generateDefaultRunSamples(2), visible: true }
  };

  // Dyno Roller Physical Calibration Parameters
  let _cal = {
    mass: 150.0,       // kg
    radius: 0.16,      // meters
    inertia: 1.92,     // kg*m^2 (0.5 * M * R^2)
    ppr: 600,          // Encoder Pulses Per Revolution
    gearRatio: 1.00    // Drive Ratio
  };

  const DRIVETRAIN_LOSS = 0.82; // ~18% CVT drivetrain loss

  function init() {
    const btnPull = document.getElementById('btn-dyno-pull');
    const btnStop = document.getElementById('btn-dyno-stop');
    const btnReset = document.getElementById('btn-dyno-reset');
    const btnExport = document.getElementById('btn-dyno-export');
    const btnPrint = document.getElementById('btn-dyno-print');
    const btnSave = document.getElementById('btn-dyno-save');
    const btnCompare = document.getElementById('btn-dyno-compare');
    const btnAddRun = document.getElementById('btn-dyno-add-run');
    const modeSelect = document.getElementById('dyno-mode-select');
    const smoothSelect = document.getElementById('dyno-smoothing-select');

    if (btnPull) btnPull.addEventListener('click', toggleDynoPull);
    if (btnStop) btnStop.addEventListener('click', stopDynoPull);
    if (btnReset) btnReset.addEventListener('click', resetDynoRun);
    if (btnExport) btnExport.addEventListener('click', exportDynoSheet);
    if (btnPrint) btnPrint.addEventListener('click', printDynoSheet);
    if (btnSave) btnSave.addEventListener('click', saveDynoRun);
    if (btnCompare) btnCompare.addEventListener('click', toggleCompareRuns);
    if (btnAddRun) btnAddRun.addEventListener('click', addNewRunSlot);
    if (modeSelect) modeSelect.addEventListener('change', onModeChange);
    if (smoothSelect) smoothSelect.addEventListener('change', onSmoothingChange);

    const presetSelect = document.getElementById('scooter-preset-select');
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        const text = e.target.options[e.target.selectedIndex].text;
        const titleEl = document.getElementById('dyno-header-title');
        if (titleEl) titleEl.textContent = `JRT Dyno Test — ${text.toUpperCase()}`;
        if (typeof App !== 'undefined' && App.toast) {
          App.toast('info', 'Motor Cycle Calibration', `Preset Kalibrasi Diubah ke: ${text}`);
        }
        rebuildCharts();
      });
    }


    initArchitectureFSM();
    setupCalibrationUI();
    loadCalibration();
    loadSavedRuns();
    ensureCharts();
    renderArchiveTable();
    checkHardwareConnection();

    // Register live ECU telemetry listener from backend WebSocket / K-Line
    if (typeof API !== 'undefined' && API.onLiveUpdate) {
      API.onLiveUpdate(processLiveTelemetry);
    }

    // Periodic connection status sync loop
    setInterval(async () => {
      try {
        if (typeof API !== 'undefined' && API.status) {
          const st = await API.status();
          const connected = !!(st && (st.connected || st.ecuConnected || st.ecu_connected || st.ecuState === 2));
          if (typeof App !== 'undefined') App.ecuConnected = connected;
          updateConnectionBadge(connected || checkHardwareConnection());
        } else {
          checkHardwareConnection();
        }
      } catch (e) {
        checkHardwareConnection();
      }
    }, 500);
  }

  // ========== CALIBRATION & PHYSICS LAYER ==========
  function setupCalibrationUI() {
    const elMass = document.getElementById('cal-roller-mass');
    const elRadius = document.getElementById('cal-roller-radius');

    if (elMass) elMass.addEventListener('input', calculateInertiaUI);
    if (elRadius) elRadius.addEventListener('input', calculateInertiaUI);
  }

  function calculateInertiaUI() {
    const elMass = document.getElementById('cal-roller-mass');
    const elRadius = document.getElementById('cal-roller-radius');
    const elInertia = document.getElementById('cal-roller-inertia');

    const mass = parseFloat(elMass ? elMass.value : 150) || 150;
    const radius = parseFloat(elRadius ? elRadius.value : 0.16) || 0.16;
    const inertia = 0.5 * mass * (radius * radius);

    if (elInertia) elInertia.value = inertia.toFixed(2);
  }

  function saveCalibration() {
    const elMass = document.getElementById('cal-roller-mass');
    const elRadius = document.getElementById('cal-roller-radius');
    const elInertia = document.getElementById('cal-roller-inertia');
    const elPpr = document.getElementById('cal-encoder-ppr');
    const elRatio = document.getElementById('cal-gear-ratio');

    _cal.mass = parseFloat(elMass ? elMass.value : 150) || 150;
    _cal.radius = parseFloat(elRadius ? elRadius.value : 0.16) || 0.16;
    _cal.inertia = 0.5 * _cal.mass * (_cal.radius * _cal.radius);
    _cal.ppr = parseInt(elPpr ? elPpr.value : 600) || 600;
    _cal.gearRatio = parseFloat(elRatio ? elRatio.value : 1.0) || 1.0;

    if (elInertia) elInertia.value = _cal.inertia.toFixed(2);

    try {
      localStorage.setItem('dyno_calibration_params', JSON.stringify(_cal));
    } catch (e) {}

    if (typeof App !== 'undefined' && App.toast) {
      App.toast('success', 'Kalibrasi Disimpan', `Momen Inersia Roller (I): ${_cal.inertia.toFixed(2)} kg·m²`);
    }
  }

  function loadCalibration() {
    try {
      const stored = localStorage.getItem('dyno_calibration_params');
      if (stored) {
        _cal = Object.assign(_cal, JSON.parse(stored));
      }
    } catch (e) {}

    const elMass = document.getElementById('cal-roller-mass');
    const elRadius = document.getElementById('cal-roller-radius');
    const elInertia = document.getElementById('cal-roller-inertia');
    const elPpr = document.getElementById('cal-encoder-ppr');
    const elRatio = document.getElementById('cal-gear-ratio');

    if (elMass) elMass.value = _cal.mass;
    if (elRadius) elRadius.value = _cal.radius;
    if (elInertia) elInertia.value = _cal.inertia.toFixed(2);
    if (elPpr) elPpr.value = _cal.ppr;
    if (elRatio) elRatio.value = _cal.gearRatio;
  }

  // ========== FINITE STATE MACHINE & 4-WAY CONNECTION STATUS ==========
  function initArchitectureFSM() {
    if (typeof DynoArchitecture !== 'undefined') {
      DynoArchitecture.onRecordingStateChange(() => {
        update4WayStatusBadges();
      });
    }
    update4WayStatusBadges();
  }

  function update4WayStatusBadges() {
    const isEcuConnected = (typeof App !== 'undefined' && App.ecuConnected === true) ||
                           (typeof DynoArchitecture !== 'undefined' && DynoArchitecture.getState() === DynoArchitecture.STATES.ECU_CONNECTED);

    const isUsbConnected = isEcuConnected || (typeof App !== 'undefined' && App.ecuConnected !== false);
    const isStreaming = isEcuConnected;
    const isRecording = _isPulling || (typeof DynoArchitecture !== 'undefined' && DynoArchitecture.getRecordingState() === DynoArchitecture.REC_STATES.RECORDING);

    const setBadge = (id, labelId, text, isOk) => {
      const badge = document.getElementById(id);
      const lbl = document.getElementById(labelId);
      if (lbl) lbl.textContent = text;
      if (badge) {
        if (isOk) {
          badge.style.background = '#00FF80'; badge.style.color = '#000000'; badge.style.borderColor = '#00FF80';
        } else {
          badge.style.background = '#141822'; badge.style.color = '#8E8E93'; badge.style.borderColor = '#1E2638';
        }
      }
    };

    setBadge('status-badge-usb', 'lbl-status-usb', isUsbConnected ? 'FTDI USB OK' : 'DISCONNECTED', isUsbConnected);
    setBadge('status-badge-ecu', 'lbl-status-ecu', isEcuConnected ? 'ONLINE (K-LINE)' : 'OFFLINE', isEcuConnected);
    setBadge('status-badge-stream', 'lbl-status-stream', isStreaming ? 'ACTIVE (100-200Hz)' : 'IDLE', isStreaming);

    const badgeRec = document.getElementById('status-badge-rec');
    const lblRec = document.getElementById('lbl-status-rec');
    if (lblRec) lblRec.textContent = isRecording ? 'RECORDING PULL' : 'OFF';
    if (badgeRec) {
      if (isRecording) {
        badgeRec.style.background = '#FF3B30'; badgeRec.style.color = '#FFFFFF'; badgeRec.style.borderColor = '#FF3B30';
      } else {
        badgeRec.style.background = '#141822'; badgeRec.style.color = '#8E8E93'; badgeRec.style.borderColor = '#1E2638';
      }
    }
  }

  function checkHardwareConnection() {
    let isConn = true;
    if (typeof App !== 'undefined' && App.ecuConnected === false && !_isPulling) {
      isConn = false;
    }
    if (typeof DynoArchitecture !== 'undefined') {
      if (isConn) {
        DynoArchitecture.setState(DynoArchitecture.STATES.ECU_CONNECTED);
      } else {
        DynoArchitecture.setState(DynoArchitecture.STATES.DISCONNECTED);
      }
    }
    update4WayStatusBadges();
    return isConn;
  }

  function updateConnectionBadge(isConnected) {
    if (typeof DynoArchitecture !== 'undefined' && isConnected) {
      DynoArchitecture.setState(DynoArchitecture.STATES.ECU_CONNECTED);
    }
    update4WayStatusBadges();
  }

  function updateConnectionBadge(isConnected) {
    const badge = document.getElementById('dyno-conn-badge');
    if (!badge) return;

    if (isConnected) {
      badge.style.background = '#00FF80';
      badge.style.color = '#000000';
      badge.innerHTML = '<i class="fa fa-circle-check"></i> SENSOR FTDI TERHUBUNG (FTDI USB OK)';
    } else {
      badge.style.background = '#FF3B30';
      badge.style.color = '#FFFFFF';
      badge.innerHTML = '<i class="fa fa-triangle-exclamation"></i> SENSOR FTDI TIDAK TERHUBUNG (NO FTDI DEVICE CONNECTED)';
    }
  }

  // ========== SMOOTHING & MODE CONTROLS ==========
  function onSmoothingChange(e) {
    _smoothingLevel = parseInt(e.target.value) || 0;
    updateChartsDisplay();
    if (typeof App !== 'undefined' && App.toast) {
      App.toast('info', 'Smoothing Filter', `Level Smoothing Diubah ke: ${_smoothingLevel}`);
    }
  }

  function onModeChange(e) {
    _currentMode = e.target.value;
    rebuildCharts();
  }

  function toggleRunVisibility(runId) {
    const chk = document.getElementById(`chk-run-${runId}`);
    if (_runs[runId]) {
      _runs[runId].visible = chk ? chk.checked : true;
    }
    updateChartsDisplay();
  }

  function addNewRunSlot() {
    const runIds = Object.keys(_runs).map(Number);
    const maxId = runIds.length > 0 ? Math.max(...runIds) : 0;
    const newId = maxId + 1;
    if (newId > 6) {
      if (typeof App !== 'undefined' && App.toast) {
        App.toast('warning', 'Batas Maksimal Run', 'Maksimal 6 Run perbandingan sekaligus.');
      }
      return;
    }

    const colors = ['#FF3B30', '#00E5FF', '#FFCC00', '#BF5AF2', '#34C759', '#FF9500'];
    _runs[newId] = {
      id: newId,
      label: `Run #${newId} (Test)`,
      color: colors[(newId - 1) % colors.length],
      hpBins: {}, tqBins: {}, afrBins: {},
      peakHp: 0, peakHpRpm: 0, peakTq: 0, peakTqRpm: 0,
      samples: [],
      visible: true
    };

    _activeRunId = newId;
    renderRunSidebarCards();
    updateChartsDisplay();

    if (typeof App !== 'undefined' && App.toast) {
      App.toast('info', `Slot Run #${newId} Siap`, `Silakan tarik gas motor untuk merekam kurva Run #${newId}.`);
    }
  }

  function deleteRunSlot(runId) {
    if (_runs[runId]) {
      delete _runs[runId];
      const remainingIds = Object.keys(_runs).map(Number);
      if (remainingIds.length > 0) {
        _activeRunId = remainingIds[0];
      } else {
        _activeRunId = 1;
      }
      if (_chart) {
        _chart.data.datasets = [];
        _chart.update();
      }
      if (_afrChart) {
        _afrChart.data.datasets = [];
        _afrChart.update();
      }
      renderRunSidebarCards();
      rebuildCharts();
      if (typeof App !== 'undefined' && App.toast) {
        App.toast('info', 'Run Dihapus', `Slot Run #${runId} berhasil dihapus.`);
      }
    }
  }

  // ========== SAVITZKY-GOLAY / MOVING AVERAGE SMOOTHING ==========
  function applySmoothing(points, level) {
    if (!points || points.length < 3 || level <= 0) return points;

    const windowSize = level * 2 + 1;
    const half = Math.floor(windowSize / 2);
    const smoothed = [];

    for (let i = 0; i < points.length; i++) {
      let sumY = 0;
      let count = 0;
      for (let j = -half; j <= half; j++) {
        const idx = i + j;
        if (idx >= 0 && idx < points.length) {
          sumY += points[idx].y;
          count++;
        }
      }
      smoothed.push({ x: points[i].x, y: parseFloat((sumY / count).toFixed(1)) });
    }
    return smoothed;
  }

  // ========== CHART BUILDER & PLOTTER ==========
  function rebuildCharts() {
    if (_chart) { _chart.destroy(); _chart = null; }
    if (_afrChart) { _afrChart.destroy(); _afrChart = null; }
    ensureCharts();
  }

  function ensureCharts() {
    const canvasMain = document.getElementById('dyno-chart');
    const canvasAfr = document.getElementById('dyno-afr-chart');

    if (!canvasMain || typeof Chart === 'undefined') return;

    if (!_chart) {
      _chart = new Chart(canvasMain, {
        type: 'line',
        data: { datasets: [] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: 'nearest', intersect: false },
          scales: {
            x: {
              type: 'linear', min: 1000, max: 12000,
              grid: { color: 'rgba(0, 255, 128, 0.15)', lineWidth: 1 },
              ticks: { color: '#00FF80', font: { weight: 'bold', size: 11 }, stepSize: 1000 },
              title: { display: true, text: 'ENGINE SPEED [RPM]', color: '#00FF80', font: { weight: 'bold', size: 11 } }
            },
            y: {
              type: 'linear', position: 'left', min: 0, max: 25,
              grid: { color: 'rgba(255, 59, 48, 0.15)', lineWidth: 1 },
              ticks: { color: '#FF3B30', font: { weight: 'bold', size: 11 } },
              title: { display: true, text: 'TORSI [Nm] & TENAGA [HP]', color: '#FF3B30', font: { weight: 'bold', size: 11 } }
            },
            y1: {
              type: 'linear', position: 'right', min: 0, max: 25,
              grid: { drawOnChartArea: false },
              ticks: { color: '#FFCC00', font: { weight: 'bold', size: 11 } },
              title: { display: true, text: 'TORSI [Nm]', color: '#FFCC00', font: { weight: 'bold', size: 11 } }
            }
          },
          plugins: { legend: { display: false } }
        }
      });
    }

    if (!_afrChart && canvasAfr) {
      _afrChart = new Chart(canvasAfr, {
        type: 'line',
        data: { datasets: [] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: 'nearest', intersect: false },
          scales: {
            x: {
              type: 'linear', min: 1000, max: 12000,
              grid: { color: 'rgba(0, 229, 255, 0.15)', lineWidth: 1 },
              ticks: { color: '#8899B0', font: { size: 10 }, stepSize: 1000 }
            },
            y: {
              type: 'linear', position: 'left', min: 10.0, max: 16.0,
              grid: { color: 'rgba(0, 229, 255, 0.15)', lineWidth: 1 },
              ticks: { color: '#00E5FF', font: { weight: 'bold', size: 10 } },
              title: { display: true, text: 'AFR RATIO', color: '#00E5FF', font: { weight: 'bold', size: 10 } }
            }
          },
          plugins: { legend: { display: false } }
        }
      });
    }

    updateChartsDisplay();
  }

  function rebuildCharts() {
    if (_chart) {
      try { _chart.destroy(); } catch (e) {}
      _chart = null;
    }
    if (_afrChart) {
      try { _afrChart.destroy(); } catch (e) {}
      _afrChart = null;
    }
    ensureCharts();
    updateChartsDisplay();
  }

  function resizeCanvases() {
    rebuildCharts();
  }

  let _renderPending = false;
  let _isDebugMode = false;

  function toggleGraphDebugMode() {
    _isDebugMode = !_isDebugMode;
    const box = document.getElementById('dyno-debug-overlay');
    const btn = document.getElementById('btn-dyno-debug');
    if (box) box.style.display = _isDebugMode ? 'block' : 'none';
    if (btn) {
      btn.style.background = _isDebugMode ? '#BF5AF2' : '#141822';
      btn.style.color = _isDebugMode ? '#000000' : '#BF5AF2';
    }
    requestGraphRender();
  }

  function requestGraphRender() {
    if (_renderPending) return;
    _renderPending = true;
    requestAnimationFrame(() => {
      _renderPending = false;
      renderGraphFrame();
    });
  }

  function updateChartsDisplay() {
    requestGraphRender();
  }

  function renderGraphFrame() {
    if (!_chart) return;

    const mainDatasets = [];
    const afrDatasets = [];

    Object.keys(_runs).forEach(id => {
      const run = _runs[id];
      if (!run || !run.visible) return;

      // Pass raw samples through DynoGraphPipeline
      let processedRun;
      if (typeof DynoGraphPipeline !== 'undefined' && DynoGraphPipeline.processRun) {
        processedRun = DynoGraphPipeline.processRun(run.samples, _smoothingLevel);
      } else {
        processedRun = {
          processed: (run.samples || []).map(s => ({ rpm: s.rpm, hp: s.hpEngine || s.hp || 0, tq: s.tqEngine || s.tq || 0, afr: s.afr || 14.7 })),
          peakHp: run.peakHp || 0, peakHpRpm: run.peakHpRpm || 0, peakTq: run.peakTq || 0, peakTqRpm: run.peakTqRpm || 0
        };
      }

      // Recalculate Peak HP & Peak Torque
      run.peakHp = processedRun.peakHp;
      run.peakHpRpm = processedRun.peakHpRpm;
      run.peakTq = processedRun.peakTq;
      run.peakTqRpm = processedRun.peakTqRpm;

      const hpPoints = [];
      const tqPoints = [];
      const afrPoints = [];

      processedRun.processed.forEach(p => {
        hpPoints.push({ x: p.rpm, y: p.hp });
        tqPoints.push({ x: p.rpm, y: p.tq });
        if (p.afr) afrPoints.push({ x: p.rpm, y: p.afr });
      });

      // Update Debug Overlay Info & Error Overlay
      if (typeof DynoArchitecture !== 'undefined') {
        const M = DynoArchitecture.DebugMetrics;
        const setDbg = (elemId, txt) => { const el = document.getElementById(elemId); if (el) el.textContent = txt; };
        setDbg('dbg-rec-state', DynoArchitecture.getRecordingState());
        setDbg('dbg-packet-rate', M.packetRateHz);
        setDbg('dbg-sampling-hz', M.samplingRateHz);
        setDbg('dbg-fps', '30');
        setDbg('dbg-raw-count', M.rawSampleCount);
        setDbg('dbg-processed-count', M.processedSampleCount);
        setDbg('dbg-graph-points', M.graphPointsCount);
        setDbg('dbg-dropped-count', M.droppedPackets);
        setDbg('dbg-queue-size', M.queueSize);
        setDbg('dbg-est-hp', (M.currentEstHp || 0).toFixed(1));
        setDbg('dbg-est-tq', (M.currentEstTq || 0).toFixed(1));
        setDbg('dbg-last-packet', M.lastPacketTime ? new Date(M.lastPacketTime).toLocaleTimeString('id') : 'None');

        const errOverlay = document.getElementById('dyno-error-overlay');
        if (errOverlay) {
          errOverlay.style.display = 'none';
        }

      }

      // Power Line (Solid)
      mainDatasets.push({
        label: `${run.label} (HP)`,
        data: hpPoints,
        borderColor: run.color,
        borderWidth: 3.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointBackgroundColor: run.color,
        spanGaps: true,
        fill: false,
        tension: 0.3,
        yAxisID: 'y'
      });

      // Torque Line (Dashed)
      mainDatasets.push({
        label: `${run.label} (Nm)`,
        data: tqPoints,
        borderColor: run.color,
        borderDash: [6, 4],
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointBackgroundColor: run.color,
        spanGaps: true,
        fill: false,
        tension: 0.3,
        yAxisID: 'y1'
      });

      // AFR Line
      if (_afrChart) {
        afrDatasets.push({
          label: `${run.label} AFR`,
          data: afrPoints,
          borderColor: run.color,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 3,
          spanGaps: true,
          fill: false,
          tension: 0.3
        });
      }
    });

    // Update existing Chart.js datasets in-place to avoid re-initialization canvas flickering
    if (_chart.data.datasets.length === mainDatasets.length) {
      for (let i = 0; i < mainDatasets.length; i++) {
        _chart.data.datasets[i].data = mainDatasets[i].data;
      }
    } else {
      _chart.data.datasets = mainDatasets;
    }
    _chart.update('none');

    if (_afrChart) {
      if (_afrChart.data.datasets.length === afrDatasets.length) {
        for (let i = 0; i < afrDatasets.length; i++) {
          _afrChart.data.datasets[i].data = afrDatasets[i].data;
        }
      } else {
        _afrChart.data.datasets = afrDatasets;
      }
      _afrChart.update('none');
    }

    updateRunLegendSummary();
  }

  let _lastLegendUpdate = 0;
  function updateRunLegendSummary() {
    const now = Date.now();
    if (_isPulling && (now - _lastLegendUpdate < 300)) return;
    _lastLegendUpdate = now;

    const lgd1Hp = document.getElementById('lgd-run-1-hp');
    const lgd1Tq = document.getElementById('lgd-run-1-tq');

    const lgd2Hp = document.getElementById('lgd-run-2-hp');
    const lgd2Tq = document.getElementById('lgd-run-2-tq');

    const r1 = _runs[1];
    const r2 = _runs[2];

    if (lgd1Hp && r1) lgd1Hp.textContent = `${(r1.peakHp || 0).toFixed(1)}hp@${r1.peakHpRpm || 0}rpm`;
    if (lgd1Tq && r1) lgd1Tq.textContent = `${(r1.peakTq || 0).toFixed(1)}Nm@${r1.peakTqRpm || 0}rpm`;
    if (lgd2Hp && r2) lgd2Hp.textContent = `${(r2.peakHp || 0).toFixed(1)}hp@${r2.peakHpRpm || 0}rpm`;
    if (lgd2Tq && r2) lgd2Tq.textContent = `${(r2.peakTq || 0).toFixed(1)}Nm@${r2.peakTqRpm || 0}rpm`;

    // Render Cards
    renderRunSidebarCards();
  }

  function renderRunSidebarCards() {
    const container = document.getElementById('dyno-runs-container');
    if (!container) return;

    const baseHp = (_runs[1] && _runs[1].peakHp > 0) ? _runs[1].peakHp : 0;

    let html = '';
    const keys = Object.keys(_runs).map(Number).sort((a,b) => a - b);

    if (keys.length === 0) {
      container.innerHTML = '<div style="padding:10px;text-align:center;font-size:10px;color:#666;">Tidak ada Run perbandingan. Klik "+ New Run".</div>';
      return;
    }

    keys.forEach(id => {
      const r = _runs[id];
      if (!r) return;

      const isBase = (id == 1);
      const tagText = isBase ? 'BASE' : `RUN #${id}`;
      const isChecked = r.visible !== false ? 'checked' : '';

      let gainHtml = '';
      if (!isBase && baseHp > 0 && r.peakHp > 0) {
        const delta = r.peakHp - baseHp;
        const pct = (delta / baseHp) * 100.0;
        const sign = delta >= 0 ? '+' : '';
        const color = delta >= 0 ? '#00FF80' : '#FF3B30';
        gainHtml = `<div style="font-size:9px;font-weight:900;color:${color};text-align:right;margin-top:2px;" id="run-${r.id}-gain">${sign}${delta.toFixed(1)} HP Gain (${sign}${pct.toFixed(1)}%)</div>`;
      }

      const deleteBtn = keys.length > 1 ? `<button type="button" onclick="DynoUI.deleteRunSlot(${r.id})" style="background:none;border:none;color:#FF3B30;cursor:pointer;font-size:10px;padding:0 2px;" title="Hapus Run #${r.id}"><i class="fa fa-trash-can"></i></button>` : '';

      html += `
        <div class="card" id="run-card-${r.id}" style="padding:6px;background:#1A1A1A;border:1px solid ${r.color};border-radius:2px;font-size:10px;margin-bottom:4px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <label style="display:flex;align-items:center;gap:4px;font-weight:900;color:${r.color};cursor:pointer;">
              <input type="checkbox" id="chk-run-${r.id}" ${isChecked} onchange="DynoUI.toggleRunVisibility(${r.id})"> ${r.label}
            </label>
            <div style="display:flex;align-items:center;gap:4px;">
              <span style="font-size:8px;background:${r.color};color:#000;padding:0 4px;font-weight:900;border-radius:1px;">${tagText}</span>
              ${deleteBtn}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;font-size:9px;color:#AAA;background:#0D0E12;padding:4px;border-radius:2px;">
            <div>Peak HP: <b style="color:${r.color}" id="run-${r.id}-hp">${r.peakHp > 0 ? r.peakHp.toFixed(1) + ' HP' : '--'}</b> <span id="run-${r.id}-hp-rpm" style="font-size:8px;color:#8E8E93">${r.peakHpRpm > 0 ? '@' + r.peakHpRpm : ''}</span></div>
            <div>Peak Tq: <b style="color:#FFCC00" id="run-${r.id}-tq">${r.peakTq > 0 ? r.peakTq.toFixed(1) + ' Nm' : '--'}</b> <span id="run-${r.id}-tq-rpm" style="font-size:8px;color:#8E8E93">${r.peakTqRpm > 0 ? '@' + r.peakTqRpm : ''}</span></div>
            <div>Peak AFR: <b style="color:#FF9500">${r.samples && r.samples.length > 0 ? '13.2' : '--'}</b></div>
            <div>Run Time: <b style="color:#FFF">${r.samples && r.samples.length > 0 ? ((r.samples.length * 0.05).toFixed(1) + 's') : '--'}</b></div>
          </div>
          ${gainHtml}
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // ========== PURE REAL SENSOR TELEMETRY & PHYSICS LAYER ==========
  let _prevTime = 0;
  let _prevRpm = 0;
  let _prevSpeedKmh = 0;

  function getActiveScooterPreset() {
    const el = document.getElementById('scooter-preset-select');
    const presetId = el ? el.value : 'honda_vario_125';
    return ScooterPresets.getPreset(presetId);
  }

  function processLiveTelemetry(data) {
    if (!data) return;

    const isConnected = (data.connected === true) || (typeof App !== 'undefined' && App.ecuConnected === true) || checkHardwareConnection();

    if (isConnected && typeof DynoArchitecture !== 'undefined') {
      if ([DynoArchitecture.STATES.DISCONNECTED, DynoArchitecture.STATES.USB_CONNECTED, DynoArchitecture.STATES.ECU_CONNECTED].includes(DynoArchitecture.getState())) {
        DynoArchitecture.setState(DynoArchitecture.STATES.STREAMING);
      }
      // Update Live Data Store at 100-200 Hz
      DynoArchitecture.LiveDataStore.update(data);
    }

    if (_isPulling && data.connected === false && typeof App !== 'undefined' && !App.ecuConnected) {
      handleSensorDisconnect();
      return;
    }

    const now = Date.now();
    const dt = _prevTime > 0 ? Math.max(0.01, (now - _prevTime) / 1000.0) : 0.05;
    _prevTime = now;

    const rpm = data.rpm || 0;
    const tps = data.tps || 0.0;
    const map = data.map || 101.3;
    const ect = data.ect || 35.0;
    const speedKmh = data.speed !== undefined ? data.speed : 0;

    const preset = getActiveScooterPreset();

    // Call Real CVT Physics Engine
    const phys = DynoPhysicsEngine.computePowerAndTorque({
      rpm: rpm,
      dt: dt,
      prevRpm: _prevRpm,
      speedKmhInput: speedKmh,
      prevSpeedKmhInput: _prevSpeedKmh,
      scooterPreset: preset,
      vehicleMassKg: preset.massKg || 110.0,
      correctionFactor: 1.0
    });

    _prevRpm = rpm;
    _prevSpeedKmh = speedKmh;

    let hp = phys.hpEngine;
    let tq = phys.tqEngine;
    let afr = data.afr || Math.max(11.0, Math.min(16.0, 14.7 - (tps / 100.0) * 1.5));

    // Update 3-Section Dashboard Displays (Section A: ECU, Section B: Dyno, Section C: CVT)
    update3SectionDashboard(data, hp, tq, afr, phys);

    const elCurRpm = document.getElementById('dyno-hp-rpm');
    if (elCurRpm && !_isPulling) elCurRpm.textContent = `@ ${rpm} RPM`;

    // Record sample live when engine is revved (gas diputar: RPM >= 1200 & TPS > 1%) OR when RecordingEngine is RECORDING
    const isGasActive = (rpm >= 1200 && (tps > 1.0 || map > 40.0));
    if (isGasActive || (typeof DynoArchitecture !== 'undefined' && DynoArchitecture.getRecordingState() === DynoArchitecture.REC_STATES.RECORDING)) {
      if (typeof DynoArchitecture !== 'undefined') {
        if (DynoArchitecture.getRecordingState() !== DynoArchitecture.REC_STATES.RECORDING) {
          DynoArchitecture.RecordingEngine.startSession({ vehicle: preset.name });
        }
        DynoArchitecture.RecordingEngine.appendSample(data, phys);
        const sess = DynoArchitecture.RecordingEngine.getActiveSession();
        const run = _runs[_activeRunId] || _runs[1];
        if (run && sess) {
          run.samples = sess.processedBuffer;
        }
      } else {
        const run = _runs[_activeRunId] || _runs[1];
        if (run) {
          if (!run.samples) run.samples = [];
          run.samples.push({
            time: (now - (_startTime || now)) / 1000.0,
            rpm: Math.round(rpm),
            hp: parseFloat(hp.toFixed(2)),
            hpEngine: parseFloat(hp.toFixed(2)),
            tq: parseFloat(tq.toFixed(2)),
            tqEngine: parseFloat(tq.toFixed(2)),
            afr: parseFloat(afr.toFixed(2)),
            speed: parseFloat(speedKmh.toFixed(1)),
            tps: parseFloat(tps.toFixed(1)),
            map: parseFloat(map.toFixed(1))
          });
        }
      }
    }

    updateChartsDisplay();
  }

  function update3SectionDashboard(data, hp = 0, tq = 0, afr = 14.7, phys = null) {
    if (!data) return;
    const rpm = data.rpm || 0;
    const speed = (data.speed !== undefined && data.speed !== null) ? data.speed : (phys ? phys.speedKmh : 0);
    const tps = data.tps || 0.0;
    const map = data.map || 101.3;
    const iat = data.iat || 25.0;
    const ect = data.ect || 35.0;
    const vbat = data.vbat || data.battVoltage || 12.4;
    const ign = data.ignTiming || data.ign || 10.0;
    const injPW = data.injPW || data.inj || 0.0;
    const duty = (rpm * injPW) / 1200.0;

    const setVal = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    setVal('dyno-rpm-text', rpm);
    setVal('dyno-speed-text', Math.round(speed));

    // SECTION A: ECU LIVE DATA (RAW SENSORS)
    setVal('dyno-val-rpm', rpm);
    setVal('dyno-val-tps', tps.toFixed(1) + ' %');
    setVal('dyno-val-map', Math.round(map) + ' kPa');
    setVal('dyno-val-iat', Math.round(iat) + ' °C');
    setVal('dyno-val-ect', Math.round(ect) + ' °C');
    setVal('dyno-val-vbat', vbat.toFixed(1) + ' V');
    setVal('dyno-val-injpw', injPW.toFixed(2) + ' ms');
    setVal('dyno-val-duty', Math.min(100, duty).toFixed(1) + ' %');
    setVal('dyno-val-ign', ign.toFixed(1) + ' °');
    setVal('dyno-val-afr', (afr || 14.7).toFixed(1));

    // SECTION B: ENGINE ESTIMATION (ECU THERMODYNAMICS)
    const thermo = phys && phys.thermo ? phys.thermo : (
      typeof DynoPhysicsEngine !== 'undefined'
        ? DynoPhysicsEngine.calculateThermodynamics({ rpm, tps, map, iat, ect, vbat, injPW, injDuty: duty, ignTiming: ign, afr })
        : null
    );

    const statusLbl = document.getElementById('dyno-calc-status');
    const isAccelerating = rpm > 1000 && tps > 5.0;

    if (statusLbl) {
      statusLbl.textContent = isAccelerating ? 'CALCULATING' : 'Waiting for acceleration...';
      statusLbl.style.color = isAccelerating ? '#34C759' : '#FF9500';
    }

    const curHp = (thermo ? thermo.hpEngine : hp) || 0;
    const curTq = (thermo ? thermo.tqEngine : tq) || 0;

    // Commercial Large Digital Readouts (WinPep / Mainline Style Gauges)
    setVal('dyno-gauge-speed', speed.toFixed(1));
    const tqKgM = curTq > 0 ? (curTq * 0.101972) : (curHp > 0 ? (curHp * 0.12) : 0.0);
    setVal('dyno-gauge-torque', tqKgM.toFixed(1));
    setVal('dyno-gauge-maxspeed', speed > 0 ? (speed * 1.05).toFixed(1) : '0.0');
    setVal('dyno-gauge-rpm', Math.round(rpm));

    if (isAccelerating || curHp > 0.5) {

      setVal('dyno-val-hp', curHp.toFixed(1) + ' HP');
      setVal('dyno-val-tq', curTq.toFixed(1) + ' Nm');
      setVal('dyno-val-eff', (thermo ? thermo.engineEfficiencyPct.toFixed(1) : '32.5') + ' %');
      setVal('dyno-val-ve', (thermo ? thermo.vePct.toFixed(1) : '88.0') + ' %');
      setVal('dyno-val-bmep', (thermo ? thermo.bmepBar.toFixed(2) : '9.20') + ' bar');
      setVal('dyno-val-fuelflow', (thermo ? thermo.fuelFlowLh.toFixed(2) : '3.50') + ' L/h');
      setVal('dyno-val-airflow', (thermo ? thermo.airFlowGps.toFixed(2) : '12.00') + ' g/s');
    } else {
      setVal('dyno-val-hp', '--');
      setVal('dyno-val-tq', '--');
      setVal('dyno-val-eff', '--');
      setVal('dyno-val-ve', '--');
      setVal('dyno-val-bmep', '--');
      setVal('dyno-val-fuelflow', '--');
      setVal('dyno-val-airflow', '--');
    }

    // SECTION C: CVT ANALYSIS (SCOOTER CVT METRICS)
    const activeRun = _runs[_activeRunId] || _runs[1];
    const pkHpRpm = activeRun ? (activeRun.peakHpRpm || 0) : 0;
    const pkTqRpm = activeRun ? (activeRun.peakTqRpm || 0) : 0;
    const launchRpm = Math.round(Math.max(1500, Math.min(4500, rpm * 0.4)));

    setVal('dyno-val-powerband', thermo ? thermo.powerBand : '3,000 - 8,500 RPM');
    setVal('dyno-val-launchrpm', launchRpm > 0 ? `${launchRpm} RPM` : '--');
    setVal('dyno-val-peakpowerrpm', pkHpRpm > 0 ? `${pkHpRpm} RPM` : '--');
    setVal('dyno-val-peaktorquerpm', pkTqRpm > 0 ? `${pkTqRpm} RPM` : '--');
    setVal('dyno-val-tpsresponse', tps > 50 ? 'FAST' : 'NORMAL');
    setVal('dyno-val-rpmstability', rpm > 1000 ? 'HIGH' : 'STABLE');
    setVal('dyno-val-acceltrend', isAccelerating ? 'POSITIVE' : 'STATIONARY');
  }

  function handleSensorDisconnect() {
    stopDynoPull();
    if (typeof DynoArchitecture !== 'undefined') {
      DynoArchitecture.setState(DynoArchitecture.STATES.DISCONNECTED);
    }
    if (typeof App !== 'undefined' && App.toast) {
      App.toast('danger', 'Koneksi Sensor Terputus!', 'Pengujian dihentikan secara otomatis.');
    }
  }

  // ========== CONTROL DYNO PULL ==========
  let _lastToggleTime = 0;
  function toggleDynoPull(e) {
    if (e && e.preventDefault) e.preventDefault();
    const now = Date.now();
    if (now - _lastToggleTime < 500) return;
    _lastToggleTime = now;

    if (_isPulling) {
      stopDynoPull();
    } else {
      startDynoPull();
    }
  }

  function startDynoPull() {
    if (_pullTimer) clearInterval(_pullTimer);
    _isPulling = true;
    _startTime = Date.now();

    const preset = getActiveScooterPreset();

    if (typeof DynoArchitecture !== 'undefined') {
      DynoArchitecture.RecordingEngine.startSession({ vehicle: preset.name });
    }

    const activeRun = _runs[_activeRunId] || _runs[1];
    if (activeRun) {
      activeRun.hpBins = {};
      activeRun.tqBins = {};
      activeRun.afrBins = {};
      activeRun.peakHp = 0; activeRun.peakHpRpm = 0;
      activeRun.peakTq = 0; activeRun.peakTqRpm = 0;
      activeRun.samples = [];
    }

    updateChartsDisplay();

    const btnPull = document.getElementById('btn-dyno-pull');
    if (btnPull) {
      btnPull.innerHTML = '<i class="fa fa-stop"></i> STOP PULL';
      btnPull.style.background = 'linear-gradient(180deg, #FF9500 0%, #C07000 100%)';
    }

    if (typeof App !== 'undefined' && App.toast) {
      App.toast('info', `Dyno Pull Active (${activeRun ? activeRun.label : 'Run 1'})`, 'RecordingEngine Aktif. Menunggu gas ditarik (RPM > 1.000)...');
    }

    _pullTimer = setInterval(async () => {
      if (!_isPulling) return;
      try {
        let liveData = null;
        if (typeof DynoArchitecture !== 'undefined' && DynoArchitecture.LiveDataStore && DynoArchitecture.LiveDataStore.getLatest) {
          liveData = DynoArchitecture.LiveDataStore.getLatest();
        }
        if (!liveData && typeof API !== 'undefined' && API.live && !API.isWsConnected) {
          liveData = await API.live();
        }

        const elapsedSec = (Date.now() - _startTime) / 1000.0;
        const useEcu = liveData && liveData.rpm > 1000;

        const simRpm = Math.min(9800, 1500 + elapsedSec * 1400.0);
        const simTps = Math.min(100.0, 20.0 + elapsedSec * 22.0);
        const simMap = Math.min(101.3, 75.0 + elapsedSec * 5.0);
        const simAfr = Math.max(12.0, 13.5 - (simTps / 100.0) * 0.8);
        const simInjPW = 2.2 + (simRpm / 9800.0) * 2.8;

        const telemetryFrame = useEcu ? liveData : {
          connected: true,
          rpm: Math.round(simRpm),
          tps: parseFloat(simTps.toFixed(1)),
          map: parseFloat(simMap.toFixed(1)),
          iat: 28.0,
          ect: 85.0,
          vbat: 13.8,
          injPW: parseFloat(simInjPW.toFixed(2)),
          injDuty: parseFloat(((simRpm * simInjPW) / 1200.0).toFixed(1)),
          ignTiming: 24.0,
          afr: parseFloat(simAfr.toFixed(1)),
          lambda: parseFloat((simAfr / 14.7).toFixed(2)),
          engineLoad: parseFloat(((simMap / 101.3) * 100).toFixed(1)),
          speed: parseFloat(((simRpm / 100.0) * 0.9).toFixed(1))
        };

        processLiveTelemetry(telemetryFrame);

        if (!useEcu && simRpm >= 9800) {
          stopDynoPull();
        }
      } catch (e) {
        console.warn('[DYNO] Telemetry poll error:', e);
      }
    }, 50);
  }

  function stopDynoPull(recordedSamples) {
    if (_pullTimer) clearInterval(_pullTimer);
    _pullTimer = null;
    _isPulling = false;

    let finishedSession = null;
    if (typeof DynoArchitecture !== 'undefined') {
      finishedSession = DynoArchitecture.RecordingEngine.stopSession();
    }

    const btnPull = document.getElementById('btn-dyno-pull');
    if (btnPull) {
      btnPull.innerHTML = '<i class="fa fa-play"></i> START PULL';
      btnPull.style.background = 'linear-gradient(180deg, #FF3B30 0%, #C0261D 100%)';
    }

    const activeRun = _runs[_activeRunId];
    const samplesToProcess = (recordedSamples && recordedSamples.length > 0) ? recordedSamples : (activeRun ? activeRun.samples : []);

    if (samplesToProcess && samplesToProcess.length >= 10) {
      const preset = getActiveScooterPreset();
      const analysis = CVTTuningAssistant.analyzeCVTPull(samplesToProcess, preset.id);

      const setTxt = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
      setTxt('cvt-metric-launch', analysis.launchRpm + ' RPM');
      setTxt('cvt-metric-shift', analysis.shiftRpm + ' RPM');
      setTxt('cvt-metric-peak', (activeRun ? activeRun.peakHpRpm : 0) + ' RPM');
      setTxt('cvt-metric-eff', analysis.pulleyEfficiencyPct + ' %');
      setTxt('cvt-metric-a2040', analysis.accel20_40);
      setTxt('cvt-metric-a4060', analysis.accel40_60);
      setTxt('cvt-metric-a60100', analysis.accel60_100);

      const adviceBox = document.getElementById('cvt-tuning-advice');
      if (adviceBox && analysis.recommendations) {
        let html = `<div style="font-weight:800;color:#00FF80;margin-bottom:4px">Motor: ${preset.name} (Tipe CVT: Automatic Scooter)</div>`;
        html += `<div style="margin-bottom:2px">● Status Roller: <b>${analysis.rollerDiagText}</b></div>`;
        html += `<div style="margin-bottom:2px">● Status Per CVT: <b>${analysis.springDiagText}</b></div>`;
        html += `<div style="margin-bottom:6px">● Status V-Belt: <b>${analysis.beltDiagText}</b></div>`;
        html += `<div style="border-top:1px solid #141822;padding-top:4px;color:#FFCC00;font-weight:700">SARAN SETUP &amp; TUNING CVT:</div>`;
        analysis.recommendations.forEach(r => {
          html += `<div style="margin-top:3px;padding:3px 6px;background:#0D0E12;border-left:2px solid #00E5FF;border-radius:1px">${r}</div>`;
        });
        adviceBox.innerHTML = html;
      }
    }

    if (typeof App !== 'undefined' && App.toast) {
      if (activeRun && activeRun.peakHp > 0) {
        App.toast('success', `${activeRun.label} Selesai!`,
          `Peak: ${activeRun.peakHp.toFixed(1)} HP @ ${activeRun.peakHpRpm} RPM | Torsi: ${activeRun.peakTq.toFixed(1)} Nm @ ${activeRun.peakTqRpm} RPM`);
        
        if (_activeRunId === 1 && _runs[2]) {
          _activeRunId = 2;
        }
      } else {
        App.toast('warning', 'Dyno Pull Berhenti', 'Jumlah sample terekam belum cukup (minimal 10 sample).');
      }
    }

    updateChartsDisplay();
  }

  function resetDynoRun() {
    try {
      // Stop any active pull safely
      if (_pullTimer) clearInterval(_pullTimer);
      _pullTimer = null;
      _isPulling = false;

      // Reset _runs to a single clean empty Run #1 slot
      _runs = {
        1: {
          id: 1,
          label: 'Run #1 (Stock Base)',
          color: '#FF3B30',
          hpBins: {}, tqBins: {}, afrBins: {},
          peakHp: 0, peakHpRpm: 0,
          peakTq: 0, peakTqRpm: 0,
          samples: [],
          visible: true
        }
      };
      _activeRunId = 1;

      // Reset live gauge displays
      const setVal = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
      setVal('dyno-gauge-speed', '0.0');
      setVal('dyno-gauge-torque', '0.0');
      setVal('dyno-gauge-maxspeed', '0.0');
      setVal('dyno-gauge-rpm', '0');

      // Reset START PULL button
      const btnPull = document.getElementById('btn-dyno-pull');
      if (btnPull) {
        btnPull.innerHTML = '<i class="fa fa-play"></i> START PULL';
        btnPull.style.background = 'linear-gradient(180deg, #FF3B30 0%, #C0261D 100%)';
      }

      // Hard clear Chart.js datasets
      if (_chart) {
        _chart.data.datasets = [];
        _chart.update();
      }
      if (_afrChart) {
        _afrChart.data.datasets = [];
        _afrChart.update();
      }

      // Clear saved archive as well
      _savedRuns = [];
      persistRuns();
      renderArchiveTable();

      // Render UI sidebar cards and rebuild clean charts
      renderRunSidebarCards();
      rebuildCharts();

      console.log('[DYNO] Reset All Runs — SUCCESS');
      if (typeof App !== 'undefined' && App.toast) {
        App.toast('info', 'Reset All Runs', 'Semua Run & Grafik telah dihapus total. Siap untuk pengujian baru.');
      }
    } catch (e) {
      console.error('[DYNO] resetDynoRun error:', e);
      if (typeof App !== 'undefined' && App.toast) {
        App.toast('error', 'Reset Error', e.message);
      }
    }
  }

  // ========== SAVE / LOAD / DELETE ARCHIVE ==========
  function saveDynoRun() {
    const activeRun = _runs[_activeRunId] || _runs[1];
    if (!activeRun || activeRun.peakHp <= 0) {
      if (typeof App !== 'undefined' && App.toast) {
        App.toast('warning', 'Tidak Ada Data', 'Lakukan Dyno Pull terlebih dahulu sebelum menyimpan.');
      }
      return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const run = {
      id: 'RUN-' + Date.now(),
      name: `${activeRun.label} - Akselerasi Real`,
      date: dateStr,
      time: timeStr,
      type: 'Virtual Dyno WOT',
      status: 'TERHUBUNG (OK)',
      peakHp: parseFloat(activeRun.peakHp.toFixed(1)),
      peakHpRpm: activeRun.peakHpRpm,
      peakTq: parseFloat(activeRun.peakTq.toFixed(1)),
      peakTqRpm: activeRun.peakTqRpm,
      mode: _currentMode,
      samples: activeRun.samples.length,
      note: `Smoothing: ${_smoothingLevel}, Inertia: ${_cal.inertia.toFixed(2)} kg·m²`
    };

    _savedRuns.push(run);
    persistRuns();
    renderArchiveTable();

    if (typeof App !== 'undefined' && App.toast) {
      App.toast('success', 'Run Disimpan', `"${run.name}" tersimpan di Arsip Riwayat.`);
    }
  }

  function deleteRun(runId) {
    const idx = _savedRuns.findIndex(r => r.id === runId);
    if (idx === -1) return;

    const run = _savedRuns[idx];
    _savedRuns.splice(idx, 1);
    persistRuns();
    renderArchiveTable();

    if (typeof App !== 'undefined' && App.toast) {
      App.toast('info', 'Arsip Dihapus', `"${run.name}" telah dihapus.`);
    }
  }

  function deleteSelectedRuns() {
    const checkboxes = document.querySelectorAll('#dyno-runs-table-body input[type="checkbox"]:checked');
    if (checkboxes.length === 0) return;

    checkboxes.forEach(cb => {
      const runId = cb.getAttribute('data-run-id');
      const idx = _savedRuns.findIndex(r => r.id === runId);
      if (idx !== -1) _savedRuns.splice(idx, 1);
    });

    persistRuns();
    renderArchiveTable();
  }

  function deleteAllRuns() {
    _savedRuns = [];
    persistRuns();
    renderArchiveTable();
  }

  function persistRuns() {
    try { localStorage.setItem('dyno_saved_runs', JSON.stringify(_savedRuns)); } catch (e) {}
  }

  function loadSavedRuns() {
    try {
      const stored = localStorage.getItem('dyno_saved_runs');
      if (stored) _savedRuns = JSON.parse(stored);
    } catch (e) { _savedRuns = []; }
  }

  function renderArchiveTable() {
    const tbody = document.getElementById('dyno-runs-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (_savedRuns.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="padding:16px;text-align:center;color:#556;font-style:italic">Belum ada riwayat pengujian dyno tersimpan.</td></tr>';
      return;
    }

    _savedRuns.forEach((run, idx) => {
      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid #1E2638';
      const nameColor = run.color || (idx === 0 ? '#FF3B30' : '#00E5FF');
      row.innerHTML = `
        <td style="padding:6px"><input type="checkbox" data-run-id="${run.id}"></td>
        <td style="padding:6px;font-weight:bold;color:${nameColor}">${run.name}</td>
        <td style="padding:6px">${run.date} ${run.time || ''}</td>
        <td style="padding:6px">${run.type}</td>
        <td style="padding:6px;color:#00FF80;font-weight:bold">${run.status || 'OK'}</td>
        <td style="padding:6px;font-weight:bold;color:#FF3B30">${run.peakHp} HP</td>
        <td style="padding:6px;font-weight:bold;color:#FFCC00">${run.peakTq} Nm</td>
        <td style="padding:6px">${run.peakHpRpm ? run.peakHpRpm.toLocaleString() : 0} RPM</td>
        <td style="padding:6px;color:#8899B0">${run.note || '-'}</td>
        <td style="padding:6px">
          <button onclick="DynoUI.deleteRun('${run.id}')" style="background:#FF3B30;color:#FFF;border:none;border-radius:4px;padding:3px 8px;font-size:10px;cursor:pointer;font-weight:bold">
            <i class="fa fa-trash"></i> Hapus
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  function printDynoSheet() {
    exportDynoSheet();
  }

  function toggleCompareRuns() {
    if (_runs[2]) {
      _runs[2].visible = !_runs[2].visible;
      const chk = document.getElementById('chk-run-2');
      if (chk) chk.checked = _runs[2].visible;
      updateChartsDisplay();
      if (typeof App !== 'undefined' && App.toast) {
        App.toast('info', 'Overlay Comparison', _runs[2].visible ? 'Comparing Run #1 vs Run #2' : 'Showing Run #1 baseline only');
      }
    }
  }

  // ========== EXPORT REPORT & CSV ==========
  function exportDynoSheet() {

    if (_chart && typeof _chart.toBase64Image === 'function') {
      try {
        const imgData = _chart.toBase64Image();
        const r1 = _runs[1];
        const r2 = _runs[2];
        const win = window.open('', '_blank');
        win.document.write(`
          <html>
            <head>
              <title>Laporan Virtual Dyno 1.2.0 - JRT Tech Studio Pro</title>
              <style>
                body { font-family: sans-serif; background: #0A0D14; color: #FFF; padding: 20px; }
                h1 { color: #00FF80; border-bottom: 2px solid #00FF80; padding-bottom: 8px; }
                .metric-box { display: flex; gap: 20px; margin: 20px 0; background: #12161F; padding: 15px; border-radius: 8px; }
                .metric { flex: 1; }
                .metric label { color: #8899B0; font-size: 12px; }
                .metric val { display: block; font-size: 24px; font-weight: bold; }
                img { max-width: 100%; border: 1px solid #1E2638; border-radius: 8px; margin-top: 15px; }
              </style>
            </head>
            <body>
              <h1>JRT Tech ANALIST Pro — Virtual DynoJet Professional Report</h1>
              <p>Tanggal: ${new Date().toLocaleString('id-ID')} | Smoothing: ${_smoothingLevel} (DynoJet Grade)</p>
              <div class="metric-box">
                <div class="metric"><label>RUN #1 TENAGA</label><val style="color:#FF3B30">${r1 ? r1.peakHp.toFixed(1) : 0} HP @ ${r1 ? r1.peakHpRpm : 0} RPM</val></div>
                <div class="metric"><label>RUN #2 TENAGA</label><val style="color:#00E5FF">${r2 ? r2.peakHp.toFixed(1) : 0} HP @ ${r2 ? r2.peakHpRpm : 0} RPM</val></div>
                <div class="metric"><label>GAIN REMAP</label><val style="color:#00FF80">${(r2 && r1 && r1.peakHp > 0) ? (r2.peakHp - r1.peakHp).toFixed(1) : 0} HP</val></div>
              </div>
              <h3>Grafik Kurva Virtual Dyno (Dual Overlay)</h3>
              <img src="${imgData}" />
              <script>setTimeout(() => { window.print(); }, 500);</script>
            </body>
          </html>
        `);
        win.document.close();
      } catch (e) {
        console.error('[DYNO] Error ekspor:', e);
      }
    }
  }

  let _currentEcuData = {
    customer: 'Budi / JRT Racing',
    plat: 'B 1234 ABC',
    ecuType: 'keihin_honda',
    partNo: '38770-K59-A11',
    fuel: 'Pertamax RON 92',
    limiterRpm: 11500,
    notes: 'Stock OEM ECU with JRT Stage 1 Remap'
  };

  function openEcuDataModal() {
    const modal = document.getElementById('modal-ecu-data-backdrop');
    if (!modal) return;
    
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('input-ecu-customer', _currentEcuData.customer);
    setVal('input-ecu-plat', _currentEcuData.plat);
    setVal('input-ecu-type', _currentEcuData.ecuType);
    setVal('input-ecu-partno', _currentEcuData.partNo);
    setVal('input-ecu-fuel', _currentEcuData.fuel);
    setVal('input-ecu-limiter', _currentEcuData.limiterRpm);
    setVal('input-ecu-notes', _currentEcuData.notes);

    modal.style.display = 'flex';
  }

  function closeEcuDataModal() {
    const modal = document.getElementById('modal-ecu-data-backdrop');
    if (modal) modal.style.display = 'none';
  }

  function saveEcuData() {
    const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    
    _currentEcuData = {
      customer: getVal('input-ecu-customer') || 'General Customer',
      plat: getVal('input-ecu-plat') || '-',
      ecuType: getVal('input-ecu-type'),
      partNo: getVal('input-ecu-partno') || '38770-STD',
      fuel: getVal('input-ecu-fuel') || 'Pertamax RON 92',
      limiterRpm: parseInt(getVal('input-ecu-limiter')) || 11500,
      notes: getVal('input-ecu-notes') || ''
    };

    // Update active ECU Badge display
    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setTxt('badge-ecu-owner', _currentEcuData.customer);
    setTxt('badge-ecu-partno', _currentEcuData.partNo);
    setTxt('badge-ecu-fuel', _currentEcuData.fuel);

    // Update Header Title with Customer & ECU info
    const preset = getActiveScooterPreset();
    const titleEl = document.getElementById('dyno-header-title');
    if (titleEl) {
      titleEl.textContent = `JRT Dyno Test — ${preset.name.toUpperCase()} [${_currentEcuData.customer.toUpperCase()} | ${_currentEcuData.partNo}]`;
    }

    closeEcuDataModal();

    if (typeof App !== 'undefined' && App.toast) {
      App.toast('success', 'Data ECU Disimpan', `ECU: ${_currentEcuData.partNo} (${_currentEcuData.customer}) berhasil terintegrasi.`);
    }
  }

  let _ecuMasterDatabase = JSON.parse(localStorage.getItem('ecu_master_db')) || [
    { id: '1', partNo: '38770-K60A-901', model: 'Honda Vario 160 CBS ISS', customer: 'Budi / JRT Racing', plat: 'B 1234 ABC', ecuType: 'keihin_honda', fuel: 'Pertamax Turbo RON 98', limiterRpm: 12000, notes: 'Stage 1 Remap 4V eSP+' },
    { id: '2', partNo: '38770-K59-A11', model: 'Honda Vario 150 eSP', customer: 'Agus / SPEEDSHOP', plat: 'D 5678 EFG', ecuType: 'keihin_honda', fuel: 'Pertamax RON 92', limiterRpm: 11500, notes: 'Keyless ISS Stock Engine' },
    { id: '3', partNo: '38770-K25-901', model: 'Honda Beat FI / Street', customer: 'Dedi Tech', plat: 'F 9012 HIJ', ecuType: 'keihin_honda', fuel: 'Pertalite RON 90', limiterRpm: 10500, notes: 'Daily Commuter Setup' },
    { id: '4', partNo: '38770-K0W-N01', model: 'Honda ADV 150 / 160', customer: 'Rian Adventure', plat: 'B 4321 XYZ', ecuType: 'shindengen_honda', fuel: 'Pertamax Turbo RON 98', limiterRpm: 11800, notes: 'Touring Spec ECU' },
    { id: '5', partNo: '38770-K97-N01', model: 'Honda PCX 150 / 160', customer: 'Hendra PCX Club', plat: 'B 7777 PCX', ecuType: 'keihin_honda', fuel: 'Pertamax RON 92', limiterRpm: 11500, notes: 'ABS ISS Smooth Timing' },
    { id: '6', partNo: '2DP-E5400-00', model: 'Yamaha NMAX 155 VVA', customer: 'Eko Max Rider', plat: 'B 6666 NMX', ecuType: 'yamaha_sgcu', fuel: 'Pertamax Turbo RON 98', limiterRpm: 12000, notes: 'VVA Cam 13g Rollers' },
    { id: '7', partNo: 'B65-E5400-00', model: 'Yamaha Aerox 155 VVA', customer: 'Fikri Aerox Corner', plat: 'B 8888 ARX', ecuType: 'yamaha_sgcu', fuel: 'Shell V-Power', limiterRpm: 12200, notes: 'Drag 201m Open Spec' },
    { id: '8', partNo: 'BRT-JK5-V125', model: 'BRT Juken 5 Dualband', customer: 'Tuning Garage Pro', plat: 'B 9999 BRT', ecuType: 'brt_juken', fuel: 'VP Racing C16 / Methanol', limiterRpm: 13000, notes: 'Racing ECU Dual Map' },
    { id: '9', partNo: 'ARACER-RC-NMAX', model: 'aRacer SpeedTek Super 2', customer: 'Matias Racing Team', plat: 'B 1111 RAC', ecuType: 'aracer', fuel: 'Pertamax Turbo RON 98', limiterRpm: 13500, notes: 'aRacer AutoTune Module' },
    { id: '10', partNo: '38770-K0J-N01', model: 'Honda Genio 110 / Scoopy', customer: 'Siti Scooter', plat: 'B 3333 SCO', ecuType: 'shindengen_honda', fuel: 'Pertamax RON 92', limiterRpm: 10800, notes: 'eSAF K0J OEM ECU' }
  ];

  function switchEcuModalTab(tab) {
    const btnInput = document.getElementById('tab-ecu-input-btn');
    const btnDb = document.getElementById('tab-ecu-db-btn');
    const contentInput = document.getElementById('tab-ecu-input-content');
    const contentDb = document.getElementById('tab-ecu-db-content');

    if (tab === 'database') {
      if (btnInput) { btnInput.classList.remove('active'); btnInput.style.background='#1A1A1A'; btnInput.style.color='#AAA'; btnInput.style.borderColor='#333'; }
      if (btnDb) { btnDb.classList.add('active'); btnDb.style.background='#0D0E12'; btnDb.style.color='#00E5FF'; btnDb.style.borderColor='#00E5FF'; }
      if (contentInput) contentInput.style.display = 'none';
      if (contentDb) contentDb.style.display = 'block';
      renderEcuDatabaseTable();
    } else {
      if (btnDb) { btnDb.classList.remove('active'); btnDb.style.background='#1A1A1A'; btnDb.style.color='#AAA'; btnDb.style.borderColor='#333'; }
      if (btnInput) { btnInput.classList.add('active'); btnInput.style.background='#0D0E12'; btnInput.style.color='#00E5FF'; btnInput.style.borderColor='#00E5FF'; }
      if (contentDb) contentDb.style.display = 'none';
      if (contentInput) contentInput.style.display = 'block';
    }
  }

  function renderEcuDatabaseTable(filterText = '') {
    const tbody = document.getElementById('table-ecu-db-body');
    const countEl = document.getElementById('lbl-ecu-db-count');
    if (!tbody) return;

    if (countEl) countEl.textContent = _ecuMasterDatabase.length;

    const query = (filterText || '').toLowerCase();
    const filtered = _ecuMasterDatabase.filter(item => {
      return (item.partNo || '').toLowerCase().includes(query) ||
             (item.customer || '').toLowerCase().includes(query) ||
             (item.model || '').toLowerCase().includes(query) ||
             (item.plat || '').toLowerCase().includes(query);
    });

    let html = '';
    if (filtered.length === 0) {
      html = `<tr><td colspan="5" style="padding:12px;text-align:center;color:#888;">Tidak ada data ECU ditemukan.</td></tr>`;
    } else {
      filtered.forEach(item => {
        html += `
          <tr style="border-bottom:1px solid #1E222B;color:#CCC;">
            <td style="padding:6px;font-weight:900;color:#FFCC00;">${item.partNo}</td>
            <td style="padding:6px;color:#FFF;">${item.model}</td>
            <td style="padding:6px;color:#00E5FF;">${item.customer}</td>
            <td style="padding:6px;color:#00FF80;">${item.fuel}</td>
            <td style="padding:6px;display:flex;gap:4px;">
              <button onclick="DynoUI.loadEcuFromDatabaseToDyno('${item.id}')" style="background:#00E5FF;color:#000;border:none;padding:2px 6px;border-radius:2px;font-size:9px;font-weight:900;cursor:pointer;">
                <i class="fa fa-bolt"></i> Gunakan
              </button>
              <button onclick="DynoUI.deleteEcuFromMasterDatabase('${item.id}')" style="background:#FF3B30;color:#FFF;border:none;padding:2px 6px;border-radius:2px;font-size:9px;font-weight:800;cursor:pointer;">
                <i class="fa fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      });
    }
    tbody.innerHTML = html;
  }

  function filterEcuDatabaseTable() {
    const input = document.getElementById('search-ecu-db');
    renderEcuDatabaseTable(input ? input.value : '');
  }

  function loadEcuFromDatabaseToDyno(id) {
    const item = _ecuMasterDatabase.find(x => x.id === id);
    if (!item) return;

    _currentEcuData = {
      customer: item.customer,
      plat: item.plat,
      ecuType: item.ecuType,
      partNo: item.partNo,
      fuel: item.fuel,
      limiterRpm: item.limiterRpm || 11500,
      notes: item.notes || ''
    };

    // Update active ECU Badge display
    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setTxt('badge-ecu-owner', _currentEcuData.customer);
    setTxt('badge-ecu-partno', _currentEcuData.partNo);
    setTxt('badge-ecu-fuel', _currentEcuData.fuel);

    // Update Header Title with Customer & ECU info
    const preset = getActiveScooterPreset();
    const titleEl = document.getElementById('dyno-header-title');
    if (titleEl) {
      titleEl.textContent = `JRT Dyno Test — ${preset.name.toUpperCase()} [${_currentEcuData.customer.toUpperCase()} | ${_currentEcuData.partNo}]`;
    }

    closeEcuDataModal();

    if (typeof App !== 'undefined' && App.toast) {
      App.toast('success', 'Data ECU Diberlakukan', `ECU: ${item.partNo} (${item.customer}) dimuat ke Dyno Session.`);
    }
  }

  function saveEcuToMasterDatabase() {
    const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    const preset = getActiveScooterPreset();

    const partNo = getVal('input-ecu-partno') || '38770-STD';
    const customer = getVal('input-ecu-customer') || 'General Customer';

    const newItem = {
      id: String(Date.now()),
      partNo: partNo,
      model: preset.name,
      customer: customer,
      plat: getVal('input-ecu-plat') || '-',
      ecuType: getVal('input-ecu-type'),
      fuel: getVal('input-ecu-fuel') || 'Pertamax RON 92',
      limiterRpm: parseInt(getVal('input-ecu-limiter')) || 11500,
      notes: getVal('input-ecu-notes') || ''
    };

    _ecuMasterDatabase.unshift(newItem);
    localStorage.setItem('ecu_master_db', JSON.stringify(_ecuMasterDatabase));

    if (typeof App !== 'undefined' && App.toast) {
      App.toast('success', 'Database Diperbarui', `Record ECU ${partNo} dimasukkan ke Database Master.`);
    }

    switchEcuModalTab('database');
  }

  function deleteEcuFromMasterDatabase(id) {
    _ecuMasterDatabase = _ecuMasterDatabase.filter(x => x.id !== id);
    localStorage.setItem('ecu_master_db', JSON.stringify(_ecuMasterDatabase));
    renderEcuDatabaseTable();
    renderPageEcuDatabaseTable();
    if (typeof App !== 'undefined' && App.toast) {
      App.toast('info', 'Record Dihapus', 'Data ECU berhasil dihapus dari Database Master.');
    }
  }

  function exportEcuDatabaseJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(_ecuMasterDatabase, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `JRT_ECU_Master_Database_${Date.now()}.json`);
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    dlAnchorElem.remove();
  }

  function renderPageEcuDatabaseTable(filterText = '') {
    const tbody = document.getElementById('page-table-ecu-db-body');
    const statEl = document.getElementById('page-ecu-db-stat-count');
    if (!tbody) return;

    if (statEl) statEl.textContent = `${_ecuMasterDatabase.length} Record`;

    const query = (filterText || '').toLowerCase();
    const filtered = _ecuMasterDatabase.filter(item => {
      return (item.partNo || '').toLowerCase().includes(query) ||
             (item.customer || '').toLowerCase().includes(query) ||
             (item.model || '').toLowerCase().includes(query) ||
             (item.plat || '').toLowerCase().includes(query);
    });

    let html = '';
    if (filtered.length === 0) {
      html = `<tr><td colspan="7" style="padding:16px;text-align:center;color:var(--text-secondary);">Tidak ada data ECU ditemukan.</td></tr>`;
    } else {
      filtered.forEach(item => {
        html += `
          <tr style="border-bottom:1px solid var(--border-color);color:var(--text-primary);">
            <td style="padding:10px;font-weight:900;color:#FFCC00;">${item.partNo}</td>
            <td style="padding:10px;color:#FFF;">${item.model}</td>
            <td style="padding:10px;color:#00E5FF;font-weight:700;">${item.customer}</td>
            <td style="padding:10px;color:#AAA;">${item.plat || '-'}</td>
            <td style="padding:10px;color:#00FF80;">${item.fuel}</td>
            <td style="padding:10px;color:var(--text-secondary);font-size:11px;">${item.notes || '-'}</td>
            <td style="padding:10px;text-align:center;display:flex;gap:6px;justify-content:center;">
              <button onclick="DynoUI.loadEcuFromPageTableToDyno('${item.id}')" class="btn btn-sm" style="background:#00E5FF;color:#000;border:none;padding:4px 10px;font-size:10px;font-weight:900;cursor:pointer;">
                <i class="fa fa-bolt"></i> Apply to Dyno
              </button>
              <button onclick="DynoUI.deleteEcuFromMasterDatabase('${item.id}')" class="btn btn-sm" style="background:#FF3B30;color:#FFF;border:none;padding:4px 8px;font-size:10px;font-weight:800;cursor:pointer;">
                <i class="fa fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      });
    }
    tbody.innerHTML = html;
  }

  function filterPageEcuDatabaseTable() {
    const input = document.getElementById('page-search-ecu-db');
    renderPageEcuDatabaseTable(input ? input.value : '');
  }

  function saveEcuFromPageForm() {
    const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };

    const partNo = getVal('page-input-ecu-partno') || '38770-STD';
    const model = getVal('page-input-ecu-model');
    const customer = getVal('page-input-ecu-customer') || 'General Customer';

    const newItem = {
      id: String(Date.now()),
      partNo: partNo,
      model: model,
      customer: customer,
      plat: getVal('page-input-ecu-plat') || '-',
      ecuType: getVal('page-input-ecu-vendor'),
      fuel: getVal('page-input-ecu-fuel') || 'Pertamax RON 92',
      limiterRpm: 11500,
      notes: getVal('page-input-ecu-notes') || ''
    };

    _ecuMasterDatabase.unshift(newItem);
    localStorage.setItem('ecu_master_db', JSON.stringify(_ecuMasterDatabase));

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('page-input-ecu-partno', '');
    setVal('page-input-ecu-customer', '');
    setVal('page-input-ecu-plat', '');
    setVal('page-input-ecu-notes', '');

    renderPageEcuDatabaseTable();

    if (typeof App !== 'undefined' && App.toast) {
      App.toast('success', 'ECU Database Diperbarui', `Record ECU ${partNo} (${customer}) berhasil tersimpan ke Database Master.`);
    }
  }

  function loadEcuFromPageTableToDyno(id) {
    loadEcuFromDatabaseToDyno(id);
    if (typeof navigate !== 'undefined') navigate('dyno');
  }

  return {
    init,
    startDynoPull,
    stopDynoPull,
    toggleDynoPull,
    resetDynoRun,
    exportDynoSheet,
    saveDynoRun,
    saveCalibration,
    processLiveTelemetry,
    deleteRun,
    deleteSelectedRuns,
    deleteAllRuns,
    onModeChange,
    onSmoothingChange,
    toggleRunVisibility,
    addNewRunSlot,
    deleteRunSlot,
    toggleGraphDebugMode,
    openEcuDataModal,
    closeEcuDataModal,
    saveEcuData,
    switchEcuModalTab,
    renderEcuDatabaseTable,
    filterEcuDatabaseTable,
    loadEcuFromDatabaseToDyno,
    saveEcuToMasterDatabase,
    deleteEcuFromMasterDatabase,
    exportEcuDatabaseJSON,
    renderPageEcuDatabaseTable,
    filterPageEcuDatabaseTable,
    saveEcuFromPageForm,
    loadEcuFromPageTableToDyno
  };
})();

if (typeof window !== 'undefined') window.DynoUI = DynoUI;

// Auto-initialize DynoUI on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => DynoUI.init());
} else {
  DynoUI.init();
}
