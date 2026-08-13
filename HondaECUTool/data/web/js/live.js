// ============================================================
// live.js - Live Data + Chart
// ============================================================

const Live = (() => {
  let _cutLimitRpm = 10500;
  let _cutMode = 'hard';
  let _modeHelicopter = false;
  let _modeRotary = false;
  let _modePopBang = false;
  let _modeLaunch = false;
  let _fxTick = 0;
  let _paused = false;
  let _chart = null;
  const MAX_POINTS = 50;
  let _history = {
    labels: [],
    rpm: [],
    tps: [],
    ect: []
  };

  // (init function is defined at the bottom of the module)

  let _activeFxModeKey = null;

  function openFxModal(mode) {
    const cfg = _fxConfigs[mode];
    if (!cfg) return;
    _activeFxModeKey = mode;
    const backdrop = document.getElementById('modal-fx-backdrop');
    const titleEl = document.getElementById('modal-fx-title');
    const bodyEl = document.getElementById('modal-fx-body');
    if (!backdrop || !bodyEl) return;

    if (titleEl) titleEl.innerHTML = `<i class="fa fa-sliders"></i> ${cfg.title}`;

    bodyEl.innerHTML = cfg.fields.map((f, i) => `
      <div style="background:var(--bg-secondary);padding:12px;border-radius:10px;border:1px solid var(--border-color)">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:12px;font-weight:700;color:var(--text-primary);">${f.label}</span>
          <span style="font-size:12px;font-weight:900;color:var(--accent);" id="fx-val-${i}">${f.val} ${f.unit}</span>
        </div>
        <input type="range" id="fx-input-${i}" class="form-control" min="${f.min}" max="${f.max}" value="${f.val}" step="${f.step}" 
               oninput="document.getElementById('fx-val-${i}').textContent = this.value + ' ${f.unit}'"
               style="width:100%;height:8px;accent-color:var(--accent);">
      </div>
    `).join('');

    backdrop.style.display = 'flex';
  }

  function closeFxModal() {
    const backdrop = document.getElementById('modal-fx-backdrop');
    if (backdrop) backdrop.style.display = 'none';
  }

  // ---- PUBLIC: Open Config Modal (called via onclick) ----
  function openConfig(mode) {
    openFxModal(mode);
  }

  // ---- PUBLIC: Apply Cut Lock (called via onclick) ----
  function applyCutLock() {
    const inp = document.getElementById('input-cut-rpm');
    const sel = document.getElementById('select-cut-mode');
    if (inp) _cutLimitRpm = parseInt(inp.value) || 10500;
    if (sel) _cutMode = sel.value;
    if (typeof App !== 'undefined') App.toast('success', 'RPM Cut Lock Updated', `Limiter set to ${_cutLimitRpm} RPM (${_cutMode.toUpperCase()} CUT)`);
  }

  function _clearChart() {
    _history.labels = [];
    _history.rpm = [];
    _history.tps = [];
    _history.ect = [];
    if (_chart) {
      _chart.data.labels = [];
      _chart.data.datasets.forEach(ds => ds.data = []);
      _chart.update();
    }
  }

  // ---- INIT (single, unified) ----
  function init() {
    _initChart();
    startAnimationLoop();

    // Live Telemetry Controls
    const btnPause = document.getElementById('btn-live-pause');
    if (btnPause) {
      btnPause.addEventListener('click', () => {
        _paused = !_paused;
        btnPause.innerHTML = _paused ? '▶ Resume' : '⏸ Pause';
        btnPause.className = _paused ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
      });
    }

    const btnClear = document.getElementById('btn-live-clear');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        _clearChart();
      });
    }

    const btnExport = document.getElementById('btn-live-export');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        _exportCSV();
      });
    }

    // Modal Close Buttons
    const btnClose = document.getElementById('btn-close-fx-modal');
    const btnCancel = document.getElementById('btn-cancel-fx-modal');
    const btnSave = document.getElementById('btn-save-fx-modal');

    if (btnClose) btnClose.addEventListener('click', closeFxModal);
    if (btnCancel) btnCancel.addEventListener('click', closeFxModal);
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        if (_activeFxModeKey && _fxConfigs[_activeFxModeKey]) {
          const cfg = _fxConfigs[_activeFxModeKey];
          cfg.fields.forEach((f, i) => {
            const input = document.getElementById(`fx-input-${i}`);
            if (input) f.val = parseFloat(input.value);
          });
          const customVals = cfg.fields.map(f => f.val);
          if (typeof MapEditor !== 'undefined' && MapEditor.applyPreset) {
            MapEditor.applyPreset(_activeFxModeKey, customVals);
          }
          if (typeof API !== 'undefined' && API.post) {
            API.post('/api/fx_override', { mode: _activeFxModeKey, active: true, params: customVals }).catch(() => {});
          }
        }
        closeFxModal();
        if (typeof App !== 'undefined') App.toast('success', 'Tuning Parameters Saved', '⚡ Sent custom parameters to ECU hardware & patched map matrix!');
      });
    }
  }

  const PIDS = [
    { key: 'rpm',        label: 'RPM',          unit: '',    id: 'live-rpm',       fmt: v => Math.round(v) },
    { key: 'tps',        label: 'TPS',           unit: '%',   id: 'live-tps',       fmt: v => v.toFixed(1) },
    { key: 'map',        label: 'MAP',           unit: 'kPa', id: 'live-map',       fmt: v => v.toFixed(1) },
    { key: 'iat',        label: 'IAT',           unit: '°C',  id: 'live-iat',       fmt: v => v.toFixed(1) },
    { key: 'ect',        label: 'ECT',           unit: '°C',  id: 'live-ect',       fmt: v => v.toFixed(1) },
    { key: 'battVoltage',label: 'Battery',       unit: 'V',   id: 'live-vbat',      fmt: v => v.toFixed(2) },
    { key: 'injPW',      label: 'Inj PW',        unit: 'ms',  id: 'live-inj',       fmt: v => v.toFixed(3) },
    { key: 'ignTiming',  label: 'Ign Timing',    unit: '°',   id: 'live-ign',       fmt: v => v.toFixed(1) },
    { key: 'speed',      label: 'Speed',         unit: 'km/h',id: 'live-speed',     fmt: v => Math.round(v) },
    { key: 'engineLoad', label: 'Engine Load',   unit: '%',   id: 'live-load',      fmt: v => v.toFixed(1) },
    { key: 'o2',         label: 'O2 Sensor',     unit: 'mV',  id: 'live-o2',        fmt: v => v.toFixed(1) },
    { key: 'fuelTrim',   label: 'Fuel Trim',     unit: '%',   id: 'live-ftrim',     fmt: v => v.toFixed(1) },
    { key: 'closedLoop', label: 'Loop',          unit: '',    id: 'live-loop',      fmt: v => v ? 'Closed' : 'Open' },
    { key: 'idleSwitch', label: 'Idle SW',       unit: '',    id: 'live-idle',      fmt: v => v ? 'ON' : 'OFF' },
  ];

  let _targetData = { rpm: 0, speed: 0, tps: 0, afr: 14.7, ignTiming: 10 };
  let _currentData = { rpm: 0, speed: 0, tps: 0, afr: 14.7, ignTiming: 10 };
  let _animFrameId = null;

  function startAnimationLoop() {
    if (_animFrameId) return;
    function animate() {
      if (!_paused) {
        _fxTick++;
        const lerpFactor = 1.0; // Direct 1:1 real-time sync (0ms UI lag)
        _currentData.rpm = _targetData.rpm;
        _currentData.speed = _targetData.speed;
        _currentData.tps = _targetData.tps;
        _currentData.afr = _targetData.afr;
        _currentData.ignTiming = _targetData.ignTiming;

        let renderRpm = _currentData.rpm;
        let renderTps = _currentData.tps <= 0.1 ? 0 : _currentData.tps;

        drawSpeedGauge(Math.max(0, _currentData.speed));
        drawTachoGauge(Math.max(0, renderRpm), Math.max(0, _currentData.speed));
        drawTpsGauge(Math.max(0, Math.min(100, renderTps)));
        drawAfrGauge(Math.max(10, Math.min(20, _currentData.afr)));
        updateLiveShiftLights(renderRpm);
      }
      _animFrameId = requestAnimationFrame(animate);
    }
    animate();
  }

  function updateCards(data) {
    if (_paused) return;

    let rpm = data.rpm || 0;
    let speed = (data.speed !== undefined && data.speed !== null) ? data.speed : 0;
    let tps = data.tps || 0;
    let o2 = data.o2 || 450;
    let afr = (data.afr !== undefined && data.afr !== null) ? data.afr : (rpm < 400 ? 14.7 : Math.max(10.0, Math.min(18.0, Math.round((14.7 - ((o2 - 450.0) / 450.0) * 2.2) * 10) / 10)));
    let ign = data.ignTiming || 10;

    // 1. Helicopter Mode FX Modulation
    if (_modeHelicopter && rpm < 3000) {
      const targetIdle = _fxConfigs.helicopter.fields[0].val || 1600;
      const freq = _fxConfigs.helicopter.fields[1].val || 12;
      const retard = _fxConfigs.helicopter.fields[2].val || -10;
      rpm = targetIdle + (Math.sin(_fxTick * (freq * 0.08)) > 0 ? 550 : 0) + (Math.random() * 80);
      ign = Math.sin(_fxTick * (freq * 0.08)) > 0 ? 15.0 : retard;
    }

    // 2. Rotary Mode FX Modulation
    if (_modeRotary && rpm < 3000) {
      const bounceRpm = _fxConfigs.rotary.fields[0].val || 1800;
      rpm = bounceRpm + (Math.sin(_fxTick * 0.5) > 0 ? 450 : -250) + (Math.random() * 60);
      ign = (_fxTick % 2 === 0) ? 18.0 : -12.0;
    }

    // 3. Pop & Bangs Decel Flame FX Modulation
    const thresholdRpm = _fxConfigs.popbang.fields[0].val || 4000;
    if (_modePopBang && tps < 5 && rpm > thresholdRpm) {
      const retard = _fxConfigs.popbang.fields[1].val || -18;
      const enrich = _fxConfigs.popbang.fields[2].val || 20;
      ign = retard; // Heavy retard for flames
      afr = Math.max(10.0, 14.7 - (enrich * 0.15));  // Rich fuel overrun
    }

    // 4. Launch Control Anti-Lag FX Modulation
    if (_modeLaunch) {
      const launchRpm = _fxConfigs.launch.fields[0].val || 5500;
      const retard = _fxConfigs.launch.fields[1].val || -12;
      rpm = launchRpm + (Math.random() * 150 - 75);
      tps = 100.0;
      ign = retard;
    }

    _targetData = { rpm, speed, tps, afr, ignTiming: ign };

    // Update PID Text Cards
    const modData = { ...data, rpm, speed, tps, afr, ignTiming: ign };
    PIDS.forEach(p => {
      const el = document.getElementById(p.id);
      if (el && modData[p.key] !== undefined) {
        el.textContent = p.fmt(modData[p.key]) + (p.unit ? ' ' + p.unit : '');
      }
    });

    _pushChart(modData);

    // Sync Dashboard Race Cluster
    if (typeof App !== 'undefined' && App.updateRaceCluster) {
      App.updateRaceCluster(modData);
    }
  }

  // ---- ANALOG RACING GAUGE DRAWING ENGINE ----
  function drawSpeedGauge(speed) {
    const canvas = document.getElementById('live-speed-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2 + 10, r = 70;

    ctx.clearRect(0, 0, w, h);
    const startAng = 0.85 * Math.PI, endAng = 2.15 * Math.PI;

    // Track
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAng, endAng);
    ctx.strokeStyle = '#2A384A';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Active Arc
    const ratio = Math.max(0, Math.min(1, speed / 220));
    const activeEnd = startAng + ratio * (endAng - startAng);
    if (ratio > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAng, activeEnd);
      ctx.strokeStyle = '#FF5722'; // Orange
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#FF5722';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Needle
    const needleAng = startAng + ratio * (endAng - startAng);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (r - 12) * Math.cos(needleAng), cy + (r - 12) * Math.sin(needleAng));
    ctx.strokeStyle = '#ef4444'; // Red
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center Cap
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  function drawTachoGauge(rpm, speed) {
    const canvas = document.getElementById('live-tacho-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2 + 10, r = 85;

    ctx.clearRect(0, 0, w, h);
    const startAng = 0.85 * Math.PI, endAng = 2.15 * Math.PI;

    // Outer Track
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAng, endAng);
    ctx.strokeStyle = '#2A384A';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Active Arc
    const ratio = Math.max(0, Math.min(1, rpm / 12000));
    const activeEnd = startAng + ratio * (endAng - startAng);
    if (ratio > 0) {
      const gradient = ctx.createLinearGradient(0, 0, w, 0);
      gradient.addColorStop(0, '#ffffff'); // Starts at White
      gradient.addColorStop(0.6, '#FF5722'); // Repsol Orange
      gradient.addColorStop(1.0, '#ef4444'); // Racing Red

      ctx.beginPath();
      ctx.arc(cx, cy, r, startAng, activeEnd);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.shadowColor = ratio > 0.8 ? '#ef4444' : '#FF5722';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Cut Lock Marker Tick Line
    const cutRatio = Math.max(0, Math.min(1, _cutLimitRpm / 12000));
    const cutAng = startAng + cutRatio * (endAng - startAng);
    ctx.beginPath();
    ctx.arc(cx, cy, r, cutAng - 0.03, cutAng + 0.03);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 16;
    ctx.stroke();

    // Needle
    const needleAng = startAng + ratio * (endAng - startAng);
    const isCutActive = rpm >= _cutLimitRpm;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (r - 14) * Math.cos(needleAng), cy + (r - 14) * Math.sin(needleAng));
    ctx.strokeStyle = isCutActive ? '#ef4444' : '#FF5722';
    ctx.lineWidth = isCutActive ? 6 : 4;
    ctx.stroke();

    // Center Cap
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = isCutActive ? '#ef4444' : '#FF5722';
    ctx.fill();

    // Tachometer state indicator
    const gearEl = document.getElementById('live-gear-val');
    if (gearEl) {
      if (isCutActive) {
        gearEl.textContent = 'CUT!';
        gearEl.style.color = '#ef4444';
      } else if (rpm < 500) {
        gearEl.textContent = 'OFF';
        gearEl.style.color = '#777777';
      } else {
        gearEl.textContent = 'RPM';
        gearEl.style.color = 'var(--accent)';
      }
    }
  }

  function drawTpsGauge(tps) {
    const canvas = document.getElementById('live-tps-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2 + 10, r = 70;

    ctx.clearRect(0, 0, w, h);
    const startAng = 0.85 * Math.PI, endAng = 2.15 * Math.PI;

    // Track
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAng, endAng);
    ctx.strokeStyle = '#2A384A';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Active Arc
    const ratio = Math.max(0, Math.min(1, tps / 100));
    const activeEnd = startAng + ratio * (endAng - startAng);
    if (ratio > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAng, activeEnd);
      ctx.strokeStyle = '#FF5722'; // Orange
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#FF5722';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Needle
    const needleAng = startAng + ratio * (endAng - startAng);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (r - 12) * Math.cos(needleAng), cy + (r - 12) * Math.sin(needleAng));
    ctx.strokeStyle = '#ef4444'; // Red
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center Cap
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  function drawAfrGauge(afr) {
    const canvas = document.getElementById('live-afr-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2 + 10, r = 65;

    ctx.clearRect(0, 0, w, h);
    const startAng = 0.85 * Math.PI, endAng = 2.15 * Math.PI;

    // Track
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAng, endAng);
    ctx.strokeStyle = '#2A384A';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Determine AFR state color
    let afrColor = '#ffffff'; // STOICH (White)
    let afrState = 'STOICH';

    if (afr < 13.6) {
      afrColor = '#FF5722'; // RICH (Orange / Power)
      afrState = 'RICH (POWER)';
    } else if (afr > 15.0) {
      afrColor = '#ef4444'; // LEAN (Red / Warning)
      afrState = 'LEAN (WARN)';
    }

    const elVal = document.getElementById('live-afr-val');
    if (elVal) {
      elVal.textContent = afr.toFixed(1);
      elVal.style.color = afrColor;
    }
    const elState = document.getElementById('live-afr-state');
    if (elState) {
      elState.textContent = afrState;
      elState.style.color = afrColor;
    }

    // Active Arc (Scale: 10.0 to 20.0 AFR)
    const ratio = Math.max(0, Math.min(1, (afr - 10.0) / 10.0));
    const activeEnd = startAng + ratio * (endAng - startAng);
    if (ratio > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAng, activeEnd);
      ctx.strokeStyle = afrColor;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.shadowColor = afrColor;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Needle
    const needleAng = startAng + ratio * (endAng - startAng);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (r - 12) * Math.cos(needleAng), cy + (r - 12) * Math.sin(needleAng));
    ctx.strokeStyle = afrColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center Cap
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  function updateLiveShiftLights(rpm) {
    // Adjusted for Honda matic CVT: idle ~1500, redline ~9500
    const shiftThresholds = [1500, 3000, 4500, 5500, 6500, 7500, 8500, 9500];
    for (let i = 1; i <= 8; i++) {
      const led = document.getElementById(`live-led-${i}`);
      if (led) {
        if (rpm >= shiftThresholds[i - 1]) led.classList.add('active');
        else led.classList.remove('active');
      }
    }
    const alert = document.getElementById('live-led-shift-text');
    if (alert) alert.style.display = (rpm >= 9500) ? 'inline-block' : 'none';
  }

  function _pushChart(data) {
    if (!_chart || _paused) return;
    const ts = new Date().toLocaleTimeString('id', { hour12: false });
    _history.labels.push(ts);
    _history.rpm.push(data.rpm || 0);
    _history.tps.push(data.tps || 0);
    _history.ect.push(data.ect || 0);

    if (_history.labels.length > MAX_POINTS) {
      _history.labels.shift();
      _history.rpm.shift();
      _history.tps.shift();
      _history.ect.shift();
    }

    _chart.data.labels                = _history.labels;
    _chart.data.datasets[0].data      = _history.rpm;
    _chart.data.datasets[1].data      = _history.tps;
    _chart.data.datasets[2].data      = _history.ect;
    _chart.update('none');
  }

  function _initChart() {
    const canvas = document.getElementById('live-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    _chart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'RPM / 10',
            data: [],
            borderColor: '#FF6D00',
            backgroundColor: 'rgba(255,109,0,0.08)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.3,
            yAxisID: 'y',
          },
          {
            label: 'TPS %',
            data: [],
            borderColor: '#CC0000',
            backgroundColor: 'rgba(204,0,0,0.08)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.3,
            yAxisID: 'y1',
          },
          {
            label: 'ECT °C',
            data: [],
            borderColor: '#ca8a04',
            backgroundColor: 'rgba(202,138,4,0.08)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.3,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { color: '#555555', font: { size: 11 } } },
          tooltip: { enabled: true },
        },
        scales: {
          x: {
            ticks: { color: '#999999', font: { size: 10 }, maxTicksLimit: 10 },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
          y: {
            type: 'linear', position: 'left',
            min: 0, max: 800,
            ticks: { color: '#FF6D00', font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,0.06)' },
            title: { display: true, text: 'RPM/10', color: '#FF6D00', font: { size: 10 } },
          },
          y1: {
            type: 'linear', position: 'right',
            min: 0, max: 120,
            ticks: { color: '#555555', font: { size: 10 } },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
  }

  function _exportCSV() {
    const rows = [['Time', 'RPM', 'TPS%', 'ECT°C']];
    for (let i = 0; i < _history.labels.length; i++) {
      rows.push([_history.labels[i], _history.rpm[i], _history.tps[i], _history.ect[i]]);
    }
    const csv  = rows.map(r => r.join(',')).join('\n');
    const filename = `live_${Date.now()}.csv`;
    
    if (window.pywebview && window.pywebview.api && window.pywebview.api.save_file) {
      window.pywebview.api.save_file(csv, filename)
        .then(res => {
          if (res.status === 'ok') {
            App.toast('success', 'CSV Exported', `Saved successfully: ${res.path.split('/').pop()}`);
          } else if (res.status === 'error') {
            App.toast('danger', 'Export Failed', res.message);
          }
        })
        .catch(err => {
          App.toast('danger', 'Export Error', err.toString());
        });
    } else {
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    }
  }

  // ---- FX CONFIG DEFINITIONS (for openConfig) ----
  const _fxConfigs = {
    helicopter: { title: 'MODE HELIKOPTER CONFIGURATION', fields: [
      { label: 'Target Idle Speed (RPM)', min: 1200, max: 2400, val: 1600, step: 50, unit: 'RPM' },
      { label: 'Chop Pulse Frequency (Hz)', min: 6, max: 20, val: 12, step: 1, unit: 'Hz' },
      { label: 'Ignition Retard Angle (°)', min: -20, max: 10, val: -10, step: 1, unit: '°' }
    ]},
    rotary: { title: 'MODE ROTARY SOUND CONFIGURATION', fields: [
      { label: 'Idle Bounce RPM (RPM)', min: 1200, max: 2500, val: 1800, step: 50, unit: 'RPM' },
      { label: 'Spark Delay Offset (ms)', min: 5, max: 50, val: 20, step: 5, unit: 'ms' }
    ]},
    popbang: { title: 'POP & BANGS FLAME DECEL CONFIGURATION', fields: [
      { label: 'Decel Activation Threshold (RPM)', min: 2500, max: 6000, val: 4000, step: 100, unit: 'RPM' },
      { label: 'Flame Ignition Retard (°)', min: -30, max: -5, val: -18, step: 1, unit: '°' },
      { label: 'Fuel Overrun Enrichment (%)', min: 5, max: 40, val: 20, step: 1, unit: '%' }
    ]},
    launch: { title: 'LAUNCH CONTROL ANTI-LAG CONFIGURATION', fields: [
      { label: 'Launch Lock Target (RPM)', min: 3500, max: 8000, val: 5500, step: 100, unit: 'RPM' },
      { label: 'Anti-Lag Retard Angle (°)', min: -25, max: -5, val: -12, step: 1, unit: '°' }
    ]}
  };

  // ---- PUBLIC: Toggle Mode ON/OFF (called via onclick) ----
  function toggleMode(mode, btn) {
    const setters = {
      helicopter: v => _modeHelicopter = v,
      rotary:     v => _modeRotary = v,
      popbang:    v => _modePopBang = v,
      launch:     v => _modeLaunch = v
    };
    const names = {
      helicopter: 'Helicopter Idle',
      rotary:     'Rotary Idle Pulse',
      popbang:    'Pop & Bangs Flame Decel',
      launch:     'Launch Control Anti-Lag'
    };

    if (!btn._fxActive) btn._fxActive = false;
    btn._fxActive = !btn._fxActive;
    const active = btn._fxActive;
    const name = names[mode] || mode;

    if (setters[mode]) setters[mode](active);

    const cfg = _fxConfigs[mode];
    const params = cfg ? cfg.fields.map(f => f.val) : [];

    // Send K-Line live override command to connected ECU hardware
    if (typeof API !== 'undefined' && API.post) {
      API.post('/api/fx_override', { mode, active, params }).catch(() => {});
    }

    if (active) {
      btn.className = 'btn btn-primary btn-sm btn-full';
      btn.innerHTML = `<i class="fa fa-toggle-on"></i> ${name} ACTIVE`;
      if (typeof MapEditor !== 'undefined' && MapEditor.applyPreset) {
        MapEditor.applyPreset(mode, params);
      }
      if (typeof App !== 'undefined') App.toast('success', `${name} Active`, '⚡ Sent K-Line hardware override to ECU! Click FLASH in Map Editor to write permanently.');
    } else {
      btn.className = 'btn btn-secondary btn-sm btn-full';
      btn.innerHTML = `<i class="fa fa-toggle-off"></i> Enable`;
      if (typeof App !== 'undefined') App.toast('info', `${name} Disabled`, 'Reverted ECU parameter override.');
    }
  }

  // ---- PUBLIC: Open Config Modal (called via onclick) ----
  function openConfig(mode) {
    openFxModal(mode);
  }

  // ---- PUBLIC: Apply Cut Lock (called via onclick) ----
  function applyCutLock() {
    const inp = document.getElementById('input-cut-rpm');
    const sel = document.getElementById('select-cut-mode');
    if (inp) _cutLimitRpm = parseInt(inp.value) || 10500;
    if (sel) _cutMode = sel.value;
    if (typeof App !== 'undefined') App.toast('success', 'RPM Cut Lock Updated', `Limiter set to ${_cutLimitRpm} RPM (${_cutMode.toUpperCase()} CUT)`);
  }

  function _clearChart() {
    _history.labels = [];
    _history.rpm = [];
    _history.tps = [];
    _history.ect = [];
    if (_chart) {
      _chart.data.labels = [];
      _chart.data.datasets.forEach(ds => ds.data = []);
      _chart.update();
    }
  }

  // ---- INIT (single, unified) ----
  function init() {
    _initChart();
    startAnimationLoop();

    // Live Telemetry Controls
    const btnPause = document.getElementById('btn-live-pause');
    if (btnPause) {
      btnPause.addEventListener('click', () => {
        _paused = !_paused;
        btnPause.innerHTML = _paused ? '▶ Resume' : '⏸ Pause';
        btnPause.className = _paused ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
      });
    }

    const btnClear = document.getElementById('btn-live-clear');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        _clearChart();
      });
    }

    const btnExport = document.getElementById('btn-live-export');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        _exportCSV();
      });
    }

    // Modal Close Buttons
    const btnClose = document.getElementById('btn-close-fx-modal');
    const btnCancel = document.getElementById('btn-cancel-fx-modal');
    const btnSave = document.getElementById('btn-save-fx-modal');

    if (btnClose) btnClose.addEventListener('click', closeFxModal);
    if (btnCancel) btnCancel.addEventListener('click', closeFxModal);
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        closeFxModal();
        if (typeof App !== 'undefined') App.toast('success', 'Tuning Parameters Saved', 'New mode parameters written to active ECU map!');
      });
    }

    // Render resting initial gauges immediately on page load
    drawSpeedGauge(0);
    drawTachoGauge(0, 0);
    drawTpsGauge(0);
    drawAfrGauge(14.7);

    // Register WebSocket spontaneous telemetry stream
    if (typeof API !== 'undefined' && API.onLiveUpdate) {
      API.onLiveUpdate((data) => {
        if (!_paused && data) {
          updateCards(data);
        }
      });
    }

    // Continuous live telemetry fallback poll (ONLY if WebSocket disconnected)
    setInterval(async () => {
      if (_paused) return;
      if (typeof API !== 'undefined' && API.isWsConnected) return; // Skip HTTP poll when WS is streaming
      try {
        if (typeof API !== 'undefined' && API.live) {
          const liveData = await API.live();
          if (liveData) {
            updateCards(liveData);
            if (typeof App !== 'undefined' && App.updateRaceCluster) {
              App.updateRaceCluster(liveData);
            }
            if (typeof DynoUI !== 'undefined' && DynoUI.processLiveTelemetry) {
              DynoUI.processLiveTelemetry(liveData);
            }
            if (typeof MapEditor !== 'undefined' && MapEditor.updateLiveCursor) {
              MapEditor.updateLiveCursor(liveData.rpm || 0, liveData.tps || 0);
            }
            if (typeof LivePerformance !== 'undefined' && LivePerformance.updateFromECU) {
              LivePerformance.updateFromECU(liveData);
            }
          }
        }
      } catch (e) {}
    }, 100);
  }

  return { init, updateCards, toggleMode, openConfig, applyCutLock };
})();
