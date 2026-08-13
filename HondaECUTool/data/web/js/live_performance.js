/**
 * 🏁 LIVE PERFORMANCE DASHBOARD ENGINE (live_performance.js)
 * Professional Motorsport Telemetry Dashboard for Honda PGM-FI Scooter ECUs.
 * Inspired by MoTeC, Haltech, Hondata, AiM RaceStudio, ECUMaster, Bosch Motorsport, Honda HRC.
 * Subscribes ONLY to single source of truth RealtimeECUData repository via WebSockets.
 */

const LivePerformance = (() => {
  let _canvasTacho = null;
  let _canvasGraph = null;
  let _ctxTacho = null;
  let _ctxGraph = null;

  let _paused = false;
  let _isLogging = false;
  let _logSamples = [];
  let _packetCounter = 0;
  let _startTime = Date.now();

  let _targetRpm = 0;
  let _targetSpeed = 0;
  let _targetTps = 0;
  let _targetEct = 0;
  let _targetVbat = 12.4;
  let _targetInj = 0;
  let _targetIgn = 10;
  let _targetAfr = 14.7;
  let _targetMap = 101.3;

  let _currentRpm = 0;
  let _currentSpeed = 0;
  let _currentTps = 0;
  let _currentEct = 0;
  let _currentVbat = 12.4;
  let _currentInj = 0;
  let _currentIgn = 10;
  let _currentAfr = 14.7;
  let _currentMap = 101.3;

  let _graphHistory = []; // Array of telemetry snapshots
  let _graphWindowSec = 30; // Default 30 sec history window
  let _activeChannels = {
    rpm: true,
    tps: true,
    inj: true,
    ect: true,
    map: true,
    batt: true,
    speed: true,
    afr: true
  };

  let _animFrameId = null;

  function resizeCanvases() {
    const dpr = window.devicePixelRatio || 1;
    if (!_canvasTacho) {
      _canvasTacho = document.getElementById("canvas-perf-rpm") || document.getElementById("canvas-main-rpm");
      if (_canvasTacho) _ctxTacho = _canvasTacho.getContext("2d");
    }
    if (!_canvasGraph) {
      _canvasGraph = document.getElementById("canvas-perf-graph") || document.getElementById("canvas-main-graph");
      if (_canvasGraph) _ctxGraph = _canvasGraph.getContext("2d");
    }

    if (_canvasTacho) {
      const p = _canvasTacho.parentElement;
      const cw = _canvasTacho.clientWidth || (p ? p.clientWidth : 0) || 440;
      const ch = _canvasTacho.clientHeight || cw || 440;
      const targetW = Math.round(cw * dpr);
      const targetH = Math.round(ch * dpr);
      if (_canvasTacho.width !== targetW) _canvasTacho.width = targetW;
      if (_canvasTacho.height !== targetH) _canvasTacho.height = targetH;
    }
    if (_canvasGraph) {
      const p = _canvasGraph.parentElement;
      const cw = _canvasGraph.clientWidth || (p ? p.clientWidth : 0) || 800;
      const ch = _canvasGraph.clientHeight || 320;
      const targetW = Math.round(cw * dpr);
      const targetH = Math.round(ch * dpr);
      if (_canvasGraph.width !== targetW) _canvasGraph.width = targetW;
      if (_canvasGraph.height !== targetH) _canvasGraph.height = targetH;
    }
  }

  // Initialize Canvas and Event Listeners
  function init() {
    console.log("[LivePerformance] Initializing Motorsport Telemetry Dashboard Engine...");
    _canvasTacho = document.getElementById("canvas-perf-rpm") || document.getElementById("canvas-main-rpm");
    _canvasGraph = document.getElementById("canvas-perf-graph") || document.getElementById("canvas-main-graph");

    if (_canvasTacho) _ctxTacho = _canvasTacho.getContext("2d");
    if (_canvasGraph) _ctxGraph = _canvasGraph.getContext("2d");

    window.addEventListener("resize", resizeCanvases);
    setTimeout(resizeCanvases, 50);
    setTimeout(resizeCanvases, 200);


    // Setup Window Controls
    const winSelect = document.getElementById("select-graph-window") || document.getElementById("select-main-graph-window");
    if (winSelect) {
      winSelect.addEventListener("change", (e) => {
        _graphWindowSec = parseInt(e.target.value) || 30;
      });
    }

    // Setup Channel Toggles
    document.querySelectorAll(".btn-graph-ch, .btn-main-graph-ch").forEach(btn => {
      btn.addEventListener("click", () => {
        const ch = btn.dataset.ch;
        if (ch) {
          _activeChannels[ch] = !_activeChannels[ch];
          btn.classList.toggle("active", _activeChannels[ch]);
        }
      });
    });

    // Setup Logger Controls
    const btnStart = document.getElementById("btn-perf-log-start");
    const btnPause = document.getElementById("btn-perf-log-pause");
    const btnStop  = document.getElementById("btn-perf-log-stop");
    const btnCsv   = document.getElementById("btn-perf-log-csv");

    if (btnStart) {
      btnStart.addEventListener("click", () => {
        _isLogging = true;
        _logSamples = [];
        updateLoggerUI("LOGGING");
        if (typeof App !== "undefined") App.toast("success", "Session Logger", "🏁 Live ECU telemetry logging started.");
      });
    }

    if (btnPause) {
      btnPause.addEventListener("click", () => {
        _paused = !_paused;
        btnPause.innerHTML = _paused ? '<i class="fa fa-play"></i> Resume' : '<i class="fa fa-pause"></i> Pause';
        if (typeof App !== "undefined") App.toast("info", "Telemetry View", _paused ? "Paused live telemetry stream." : "Resumed live stream.");
      });
    }

    if (btnStop) {
      btnStop.addEventListener("click", () => {
        _isLogging = false;
        updateLoggerUI("IDLE");
        if (typeof App !== "undefined") App.toast("warning", "Session Logger", `Stopped logging. ${logSamplesCount()} samples captured.`);
      });
    }

    if (btnCsv) {
      btnCsv.addEventListener("click", exportCSV);
    }

    // Start 60 FPS Canvas Animation Loop
    startAnimationLoop();

    // Subscribe to WebSocket & HTTP Polling ECU Telemetry Stream
    if (typeof API !== "undefined") {
      if (API.onWS) {
        API.onWS("live", (msg) => {
          if (msg && msg.data) {
            updateFromECU(msg.data);
          }
        });
      }
      if (API.onLiveUpdate) {
        API.onLiveUpdate((data) => {
          if (data) {
            updateFromECU(data);
          }
        });
      }
      // HTTP polling fallback (ensures continuous stream even if WebSocket is disconnected)
      setInterval(async () => {
        if (!API.isWsConnected && API.live) {
          try {
            const liveData = await API.live();
            if (liveData) updateFromECU(liveData);
          } catch (e) {}
        }
      }, 100);
    }
  }

  function logSamplesCount() {
    return _logSamples.length;
  }

  function updateLoggerUI(statusStr) {
    const el = document.getElementById("perf-logger-status");
    if (el) {
      el.textContent = statusStr;
      el.className = statusStr === "LOGGING" ? "status-badge logging" : "status-badge idle";
    }
  }

  // Push Real ECU Telemetry Sample (Called directly on WS frame arrival)
  function updateFromECU(data) {
    if (!data || typeof data !== 'object') {
      setOfflineUI();
      return;
    }

    _packetCounter++;
    const now = Date.now();

    const isConnected = data.ecuConnected !== false && data.connected !== false;

    if (!isConnected) {
      setOfflineUI();
      return;
    }

    // Structure & Numeric Type Validation Guard (Sanitize all telemetry fields)
    const num = (val, fallback = 0) => (typeof val === 'number' && !isNaN(val)) ? val : fallback;
    _targetRpm = num(data.rpm, 0);
    _targetSpeed = num(data.speed, 0);
    _targetTps = num(data.tps, 0);
    _targetEct = num(data.ect, 0);
    _targetVbat = num(data.battVoltage, 12.4);
    _targetInj = num(data.injPW, 0);
    _targetIgn = num(data.ignTiming, 10);
    _targetAfr = num(data.afr, 14.7);
    _targetMap = num(data.map, 101.3);

    // Log sample if active
    if (_isLogging) {
      _logSamples.push({
        timestamp: new Date().toISOString(),
        rpm: _targetRpm,
        speed: _targetSpeed,
        tps: _targetTps,
        ect: _targetEct,
        vbat: _targetVbat,
        inj: _targetInj,
        ign: _targetIgn,
        map: data.map || 0,
        afr: _targetAfr
      });
    }

    // Update Header Status Metrics
    const statusTxtEl = document.getElementById("perf-ecu-status-text");
    if (statusTxtEl) statusTxtEl.textContent = "ECU CONNECTED";

    const statusLed = document.getElementById("perf-status-led");
    if (statusLed) statusLed.className = "status-dot green";

    const packetEl = document.getElementById("perf-packet-counter");
    if (packetEl) packetEl.textContent = _packetCounter.toLocaleString();

    const rateEl = document.getElementById("perf-packet-rate");
    if (rateEl) rateEl.textContent = (data.sample_rate_hz || 10).toFixed(1) + " Hz";

    const latEl = document.getElementById("perf-latency");
    if (latEl) latEl.textContent = (data.latency_ms || 8).toFixed(1) + " ms";

    const comEl = document.getElementById("perf-com-port");
    if (comEl) comEl.textContent = data.com_port || "FTDI USB Serial";

    const modelEl = document.getElementById("perf-ecu-model");
    if (modelEl) modelEl.textContent = data.ecu_model || "Keihin K60A (V850)";

    // Update Digital Strip, Compact Table & OEM Vehicle Info Card
    updateDigitalStripAndTable(data);
    updateVehicleInfoCard(data.vehicle_info);
    updateStatusLEDs(data);

    // Append to Graph History
    _graphHistory.push({
      time: now,
      rpm: _targetRpm,
      tps: _targetTps,
      inj: _targetInj,
      ect: _targetEct,
      map: _targetMap,
      vbat: _targetVbat,
      speed: _targetSpeed,
      afr: _targetAfr
    });

    // Prune history older than 15 minutes
    const maxAgeMs = 15 * 60 * 1000;
    _graphHistory = _graphHistory.filter(pt => now - pt.time <= maxAgeMs);
  }

  function setOfflineUI() {
    const statusTxtEl = document.getElementById("perf-ecu-status-text");
    if (statusTxtEl) statusTxtEl.textContent = "ECU OFFLINE";

    const statusLed = document.getElementById("perf-status-led");
    if (statusLed) statusLed.className = "status-dot red";

    const rateEl = document.getElementById("perf-packet-rate");
    if (rateEl) rateEl.textContent = "-- Hz";

    const latEl = document.getElementById("perf-latency");
    if (latEl) latEl.textContent = "-- ms";

    const setTxt = (id, val) => {
      const el1 = document.getElementById(id);
      if (el1) el1.textContent = val;
      const el2 = document.getElementById("main-" + id);
      if (el2) el2.textContent = val;
    };

    ["strip-rpm", "strip-tps", "strip-adv", "strip-inj", "strip-afr", "strip-map", "strip-ect", "strip-iat", "strip-bat", "strip-vss", "strip-load", "strip-lambda"].forEach(id => setTxt(id, "--"));

    setTxt("table-ect-val", "-- °C");
    setTxt("table-vbat-val", "-- V");
    setTxt("table-inj-val", "-- ms");
    setTxt("table-tps-val", "-- %");
    setTxt("table-speed-val", "-- km/h");
    setTxt("table-ign-val", "-- °");

    ["table-ect-badge", "table-vbat-badge", "table-inj-badge", "table-tps-badge", "table-speed-badge", "table-ign-badge"].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = "OFFLINE"; el.className = "status-badge idle"; }
    });

    updateVehicleInfoCard(null);
  }

  // Update OEM Vehicle Info Card & Header
  function updateVehicleInfoCard(v) {
    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val || "Unknown";
    };

    if (!v) {
      setTxt("hdr-vehicle-name", "HONDA MOTORCYCLE (UNCONNECTED)");
      setTxt("hdr-vehicle-year", "--");
      setTxt("hdr-ecu-model", "--");
      setTxt("hdr-cal-id", "--");
      setTxt("hdr-protocol", "Honda PGM-FI");

      setTxt("vcard-mfr", "Honda");
      setTxt("vcard-model", "NOT CONNECTED");
      setTxt("vcard-year", "--");
      setTxt("vcard-eng-code", "--");
      setTxt("vcard-eng-cc", "--");

      setTxt("vcard-family", "--");
      setTxt("vcard-partno", "--");
      setTxt("vcard-calid", "--");
      setTxt("vcard-hwver", "--");
      setTxt("vcard-swver", "--");
      setTxt("vcard-immo", "--");
      setTxt("vcard-svg-label", "CONNECT ECU TO IDENTIFY");
      return;
    }

    setTxt("hdr-vehicle-name", (v.manufacturer || "HONDA") + " " + (v.vehicle_name || "UNKNOWN").toUpperCase());
    setTxt("hdr-vehicle-year", v.production_year);
    setTxt("hdr-ecu-model", v.ecu_family + " " + v.ecu_model);
    setTxt("hdr-cal-id", v.calibration_id);
    setTxt("hdr-protocol", v.protocol || "Honda PGM-FI");

    setTxt("vcard-mfr", v.manufacturer || "Honda");
    setTxt("vcard-model", v.vehicle_name || "Unknown Vehicle");
    setTxt("vcard-year", v.production_year);
    setTxt("vcard-eng-code", v.engine_code);
    setTxt("vcard-eng-cc", v.displacement_cc);

    setTxt("vcard-family", v.ecu_family);
    setTxt("vcard-partno", v.part_number);
    setTxt("vcard-calid", v.calibration_id);
    setTxt("vcard-hwver", v.hardware_ver);
    setTxt("vcard-swver", v.software_ver);
    setTxt("vcard-immo", v.immobilizer_support ? "Active" : "Not Supported");
    setTxt("vcard-svg-label", (v.vehicle_name || "HONDA SCOOTER").toUpperCase());
  }

  // Update Digital Strip & Compact Table
  function updateDigitalStripAndTable(d) {
    const setVal = (id, val, suffix="") => {
      const formatted = (val !== null && val !== undefined) ? `${val}${suffix}` : "--";
      const el1 = document.getElementById(id);
      if (el1) el1.textContent = formatted;
      const el2 = document.getElementById("main-" + id);
      if (el2) el2.textContent = formatted;
    };

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = (val !== null && val !== undefined) ? val : "--";
    };

    // Telemetry Strip
    setVal("strip-rpm", d.rpm);
    setVal("strip-tps", d.tps !== undefined ? d.tps.toFixed(1) : "--", "%");
    setVal("strip-adv", d.ignTiming !== undefined ? d.ignTiming.toFixed(1) : "--", "°");
    setVal("strip-inj", d.injPW !== undefined ? d.injPW.toFixed(2) : "--", "ms");
    setVal("strip-afr", d.afr !== undefined ? d.afr.toFixed(1) : "--");
    setVal("strip-map", d.map !== undefined ? d.map.toFixed(1) : "--");
    setVal("strip-ect", d.ect !== undefined ? d.ect.toFixed(1) : "--");
    setVal("strip-iat", d.iat !== undefined ? d.iat.toFixed(1) : "--");
    setVal("strip-bat", d.battVoltage !== undefined ? d.battVoltage.toFixed(2) : "--");
    setVal("strip-vss", d.speed !== undefined ? Math.round(d.speed) : "--");
    setVal("strip-load", d.engineLoad !== undefined ? d.engineLoad.toFixed(1) : "--");
    setVal("strip-lambda", d.lambda !== undefined ? d.lambda.toFixed(2) : "--");

    // Compact Table
    setVal("table-ect-val", d.ect !== undefined ? d.ect.toFixed(1) : "--", " °C");
    setVal("table-vbat-val", d.battVoltage !== undefined ? d.battVoltage.toFixed(2) : "--", " V");
    setVal("table-inj-val", d.injPW !== undefined ? d.injPW.toFixed(3) : "--", " ms");
    setVal("table-tps-val", d.tps !== undefined ? d.tps.toFixed(1) : "--", " %");
    setVal("table-speed-val", d.speed !== undefined ? Math.round(d.speed) : "--", " km/h");
    setVal("table-ign-val", d.ignTiming !== undefined ? d.ignTiming.toFixed(1) : "--", " °");

    // FormMain.cs & ScanTool.cs DataGridView Params Update
    setTxt("dgv-rpm-val", d.rpm !== undefined ? Math.round(d.rpm) : "--");
    setTxt("dgv-tps-mv", d.tps !== undefined ? (d.tps * 0.04 + 0.5).toFixed(2) : "--");
    setTxt("dgv-tps-pct", d.tps !== undefined ? d.tps.toFixed(1) : "--");
    setTxt("dgv-ect-mv", d.ect !== undefined ? (Math.max(0.5, 4.5 - (d.ect * 0.035))).toFixed(2) : "--");
    setTxt("dgv-ect-c", d.ect !== undefined ? d.ect.toFixed(1) : "--");
    setTxt("dgv-iat-mv", d.iat !== undefined ? (Math.max(0.5, 4.5 - (d.iat * 0.035))).toFixed(2) : "--");
    setTxt("dgv-iat-c", d.iat !== undefined ? d.iat.toFixed(1) : "--");
    setTxt("dgv-map-mv", d.map !== undefined ? (d.map * 0.045).toFixed(2) : "--");
    setTxt("dgv-map-kpa", d.map !== undefined ? d.map.toFixed(1) : "--");
    setTxt("dgv-bat-v", d.battVoltage !== undefined ? d.battVoltage.toFixed(2) : "--");
    setTxt("dgv-inj-ms", d.injPW !== undefined ? d.injPW.toFixed(2) : "--");
    setTxt("dgv-igt-deg", d.ignTiming !== undefined ? d.ignTiming.toFixed(1) : "--");
    setTxt("dgv-spd-kmh", d.speed !== undefined ? Math.round(d.speed) : "--");


    // Table Badges
    const setBadge = (id, text, isOk) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = text;
        el.className = "status-badge " + (isOk ? "logging" : "idle");
      }
    };

    setBadge("table-ect-badge", d.ect > 100 ? "HOT" : "NORMAL", d.ect <= 100);
    setBadge("table-vbat-badge", d.battVoltage >= 13.0 ? "CHARGING" : "BATTERY", d.battVoltage >= 12.0);
    setBadge("table-inj-badge", d.rpm > 300 ? "ACTIVE" : "IDLE", d.rpm > 300);
    setBadge("table-tps-badge", d.tps > 2.0 ? "OPEN" : "CLOSED", true);
    setBadge("table-speed-badge", d.speed > 0 ? "MOVING" : "STOPPED", true);
    setBadge("table-ign-badge", d.rpm > 300 ? "FIRED" : "READY", true);
  }

  // Update Status LED Indicators Panel
  function updateStatusLEDs(d) {
    const setLed = (id, active, isFault=false) => {
      const el = document.getElementById(id);
      if (el) {
        el.className = "led-item " + (active ? (isFault ? "red" : "green") : "off");
      }
    };

    setLed("led-mil", d.milOn, true);
    setLed("led-fuelpump", d.rpm > 0 || d.battVoltage > 11.0);
    setLed("led-fan", d.ect >= 98.0);
    setLed("led-inj", d.rpm > 300);
    setLed("led-ign", d.rpm > 300);
    setLed("led-closedloop", d.closedLoop);
    setLed("led-ecm-ready", d.ecuConnected !== false);
  }

  // 60 FPS Render Loop with Needle Interpolation
  function startAnimationLoop() {
    if (_animFrameId) return;

    function render() {
      if (!_paused) {
        // Direct interpolation between packets (0ms UI lag)
        _currentRpm += (_targetRpm - _currentRpm) * 0.35;
        _currentSpeed += (_targetSpeed - _currentSpeed) * 0.35;
        _currentTps += (_targetTps - _currentTps) * 0.35;
        if (_targetTps <= 0.05 && Math.abs(_currentTps) < 0.1) _currentTps = 0;
        _currentEct += (_targetEct - _currentEct) * 0.35;
        _currentVbat += (_targetVbat - _currentVbat) * 0.35;
        _currentInj += (_targetInj - _currentInj) * 0.35;
        _currentIgn += (_targetIgn - _currentIgn) * 0.35;
        _currentAfr += (_targetAfr - _currentAfr) * 0.35;
        _currentMap += (_targetMap - _currentMap) * 0.35;

        // Push smooth 80ms history frame when telemetry is active
        const now = Date.now();
        if (_targetVbat > 5 || _packetCounter > 0) {
          if (_graphHistory.length === 0 || now - _graphHistory[_graphHistory.length - 1].time >= 80) {
            _graphHistory.push({
              time: now,
              rpm: _currentRpm,
              tps: _currentTps,
              inj: _currentInj,
              ect: _currentEct,
              map: _currentMap,
              vbat: _currentVbat,
              speed: _currentSpeed,
              afr: _currentAfr
            });
            const windowMs = _graphWindowSec * 1000;
            _graphHistory = _graphHistory.filter(pt => now - pt.time <= windowMs);
          }
        }

        // Render Canvas Tachometer & Telemetry Graph
        try {
          drawTachometer(_currentRpm);
          drawTelemetryGraph();
          updateCircularGauges();
        } catch (e) {
          console.warn("[LivePerformance] Render exception:", e);
        }
      }
      _animFrameId = requestAnimationFrame(render);
    }
    render();
  }

  // Draw Professional MoTeC C1212 / Haltech iC-7 Style Racing Tachometer
  function drawTachometer(rpm) {
    if (!_ctxTacho || !_canvasTacho) {
      _canvasTacho = document.getElementById("canvas-perf-rpm") || document.getElementById("canvas-main-rpm");
      if (_canvasTacho) _ctxTacho = _canvasTacho.getContext("2d");
      if (!_ctxTacho || !_canvasTacho) return;
    }
    const w = _canvasTacho.width || 440;
    const h = _canvasTacho.height || 440;
    const ctx = _ctxTacho;


    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 22;

    // 1. Carbon & Metallic Outer Bezel
    const bgGrad = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
    bgGrad.addColorStop(0, "#0F1722");
    bgGrad.addColorStop(0.7, "#090E16");
    bgGrad.addColorStop(1, "#182434");

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = bgGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 229, 255, 0.4)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00E5FF";
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0; // Reset shadow

    // 2. Top LED Shift Light Array (10 LEDs)
    const ledCount = 10;
    const ledY = cy - radius + 18;
    const ledWidth = (radius * 1.5) / ledCount;
    const startX = cx - (radius * 0.75);

    for (let i = 0; i < ledCount; i++) {
      const lx = startX + i * ledWidth + (ledWidth / 2);
      const thresholdRpm = (i + 1) * (12500 / ledCount);
      const isActive = rpm >= thresholdRpm;

      let ledColor = "#121A24";
      let glowColor = "transparent";

      if (isActive) {
        if (i < 4) { ledColor = "#47FF7A"; glowColor = "#47FF7A"; } // Green (0-5k)
        else if (i < 7) { ledColor = "#FFD400"; glowColor = "#FFD400"; } // Yellow (5k-8.7k)
        else { ledColor = "#FF3D3D"; glowColor = "#FF3D3D"; } // Red (>8.7k)
      }

      ctx.beginPath();
      ctx.arc(lx, ledY, 6, 0, Math.PI * 2);
      ctx.fillStyle = ledColor;
      ctx.fill();
      if (isActive) {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // Shift Light Flash Alert when >11,500 RPM
    if (rpm > 11500 && Math.floor(Date.now() / 150) % 2 === 0) {
      ctx.fillStyle = "#FF3D3D";
      ctx.font = "900 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SHIFT UP!", cx, ledY + 22);
    }

    // 3. Wide 240-Degree Scale Arc & Tick Marks (0 to 13 x 1000 RPM)
    const startAngle = Math.PI * 0.75; // 7 o'clock
    const endAngle = Math.PI * 2.25;   // 5 o'clock
    const maxRpm = 13000;
    const rpmPct = Math.min(1.0, Math.max(0, rpm / maxRpm));

    // Dial Background Arc Ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 28, startAngle, endAngle);
    ctx.strokeStyle = "rgba(0, 229, 255, 0.25)";
    ctx.lineWidth = 12;
    ctx.stroke();

    // Active Sweeping Gradient Arc Fill
    if (rpmPct > 0) {
      const linGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
      linGrad.addColorStop(0, "#00E5FF");
      linGrad.addColorStop(0.5, "#47FF7A");
      linGrad.addColorStop(1.0, "#FF3D3D");

      ctx.beginPath();
      ctx.arc(cx, cy, radius - 28, startAngle, startAngle + (endAngle - startAngle) * rpmPct);
      ctx.strokeStyle = linGrad;
      ctx.lineWidth = 12;
      ctx.stroke();
    }

    // Redline Arc (10,500 - 13,000)
    const redlineStart = startAngle + (endAngle - startAngle) * (10500 / maxRpm);
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 28, redlineStart, endAngle);
    ctx.strokeStyle = "rgba(255, 61, 61, 0.35)";
    ctx.lineWidth = 12;
    ctx.stroke();

    // Scale Numbers (0 to 13) and Ticks
    for (let r = 0; r <= 13; r++) {
      const ang = startAngle + (endAngle - startAngle) * (r / 13);
      const isRedline = r >= 11;

      // Major Ticks
      const innerX = cx + Math.cos(ang) * (radius - 42);
      const innerY = cy + Math.sin(ang) * (radius - 42);
      const outerX = cx + Math.cos(ang) * (radius - 34);
      const outerY = cy + Math.sin(ang) * (radius - 34);

      ctx.beginPath();
      ctx.moveTo(innerX, innerY);
      ctx.lineTo(outerX, outerY);
      ctx.strokeStyle = isRedline ? "#FF3D3D" : "#FFFFFF";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Number Labels
      const numX = cx + Math.cos(ang) * (radius - 54);
      const numY = cy + Math.sin(ang) * (radius - 54);

      ctx.fillStyle = isRedline ? "#FF3D3D" : "#A0AAB0";
      ctx.font = "800 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(r.toString(), numX, numY);

      // Minor Ticks (Every 250 RPM)
      if (r < 13) {
        for (let sub = 1; sub <= 3; sub++) {
          const subAng = startAngle + (endAngle - startAngle) * ((r + sub * 0.25) / 13);
          const sInnerX = cx + Math.cos(subAng) * (radius - 38);
          const sInnerY = cy + Math.sin(subAng) * (radius - 38);
          const sOuterX = cx + Math.cos(subAng) * (radius - 34);
          const sOuterY = cy + Math.sin(subAng) * (radius - 34);

          ctx.beginPath();
          ctx.moveTo(sInnerX, sInnerY);
          ctx.lineTo(sOuterX, sOuterY);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // 4. Center Hub Display (Digital RPM + Speed VSS + Gear Box)
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 38px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 229, 255, 0.6)";
    ctx.shadowBlur = 8;
    ctx.fillText(Math.round(rpm).toLocaleString(), cx, cy - 8);
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#00E5FF";
    ctx.font = "800 12px sans-serif";
    ctx.fillText("RPM x1000", cx, cy + 22);

    // Speed VSS Subtext
    ctx.fillStyle = "#47FF7A";
    ctx.font = "800 14px monospace";
    ctx.fillText(`${Math.round(_currentSpeed)} KM/H`, cx, cy + 42);

    // 5. High-Performance illuminated Needle
    const needleAngle = startAngle + (endAngle - startAngle) * rpmPct + Math.PI * 0.5;

    let needleColor = "#00E5FF";
    if (rpm > 6000) needleColor = "#47FF7A";
    if (rpm > 8500) needleColor = "#FFD400";
    if (rpm > 10500) needleColor = "#FF3D3D";

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(needleAngle);

    // Needle Body with Glow
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(0, -radius + 36);
    ctx.lineTo(4, 0);
    ctx.fillStyle = needleColor;
    ctx.shadowColor = needleColor;
    ctx.shadowBlur = 12;
    ctx.fill();

    // Needle Center Cap
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#182434";
    ctx.fill();
    ctx.strokeStyle = needleColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  // Draw 60 FPS Telemetry Graph (High-Resolution Motorsport Oscilloscope)
  function drawTelemetryGraph() {
    if (!_ctxGraph || !_canvasGraph) return;
    const w = _canvasGraph.width || 800;
    const h = _canvasGraph.height || 320;
    const ctx = _ctxGraph;

    ctx.clearRect(0, 0, w, h);

    // 1. Oscilloscope Background Grid
    ctx.fillStyle = "#06090F";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(0, 229, 255, 0.08)";
    ctx.lineWidth = 1;

    for (let x = 0; x < w; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const now = Date.now();
    const windowMs = _graphWindowSec * 1000;

    let pts = _graphHistory.filter(pt => now - pt.time <= windowMs);
    
    // Always supply initial point if history is empty so graph is immediately rendered
    if (pts.length === 0) {
      pts = [{
        time: now - windowMs,
        rpm: _currentRpm,
        tps: _currentTps,
        inj: _currentInj,
        ect: _currentEct,
        map: _currentMap,
        vbat: _currentVbat,
        speed: _currentSpeed,
        afr: _currentAfr
      }];
    }

    // Append current live frame so lines connect smoothly to rightmost edge (x = w)
    pts = pts.concat([{
      time: now,
      rpm: _currentRpm,
      tps: _currentTps,
      inj: _currentInj,
      ect: _currentEct,
      map: _currentMap,
      vbat: _currentVbat,
      speed: _currentSpeed,
      afr: _currentAfr
    }]);

    // 2. Stacked Multi-Lane Channel Geometry (Dynamic Responsive Scaling)
    const bandH = Math.floor((h - 30) / 6);

    // Channel 1: RPM (Cyan #00E5FF) - Top Lane 1 (Scaled for 0-8500 RPM Scooter Range)
    if (_activeChannels.rpm) {
      const baseY = 30 + bandH - 4;
      const amp = bandH - 8;
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = "#00E5FF";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#00E5FF";
      ctx.shadowBlur = 6;
      pts.forEach((pt, idx) => {
        const x = w - ((now - pt.time) / windowMs) * w;
        const val = Math.max(0, pt.rpm || 0);
        const y = baseY - Math.min(1.0, val / 8500) * amp;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // Channel 2: TPS (Green #47FF7A) - Lane 2 (High Sensitivity Throttle Response, 0-40% Range)
    if (_activeChannels.tps) {
      const baseY = 30 + bandH * 2 - 4;
      const amp = bandH - 8;
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = "#47FF7A";
      ctx.lineWidth = 3.0;
      ctx.shadowColor = "#47FF7A";
      ctx.shadowBlur = 8;
      pts.forEach((pt, idx) => {
        const x = w - ((now - pt.time) / windowMs) * w;
        const val = Math.max(0, pt.tps || 0);
        const y = baseY - Math.min(1.0, val / 40.0) * amp;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // Channel 3: MAP (Red #FF3D3D) - Lane 3 (Scaled for 20-110 kPa Manifold Vacuum/Pressure)
    if (_activeChannels.map) {
      const baseY = 30 + bandH * 3 - 4;
      const amp = bandH - 8;
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = "#FF3D3D";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#FF3D3D";
      ctx.shadowBlur = 6;
      pts.forEach((pt, idx) => {
        const x = w - ((now - pt.time) / windowMs) * w;
        const mapRaw = (pt.map !== undefined && pt.map > 0) ? pt.map : 101.3;
        const val = Math.min(1.0, Math.max(0, (mapRaw - 20) / 90));
        const y = baseY - val * amp;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // Channel 4: Injector (Yellow #FFD400) - Lane 4 (Scaled for 0-8ms Pulse Width)
    if (_activeChannels.inj) {
      const baseY = 30 + bandH * 4 - 4;
      const amp = bandH - 8;
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = "#FFD400";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#FFD400";
      ctx.shadowBlur = 6;
      pts.forEach((pt, idx) => {
        const x = w - ((now - pt.time) / windowMs) * w;
        const val = Math.max(0, pt.inj || 0);
        const y = baseY - Math.min(1.0, val / 8.0) * amp;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // Channel 5: ECT Temp (Orange #FF9800) - Lane 5 (Scaled for 20-120 °C Engine Temp)
    if (_activeChannels.ect) {
      const baseY = 30 + bandH * 5 - 4;
      const amp = bandH - 8;
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = "#FF9800";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#FF9800";
      ctx.shadowBlur = 6;
      pts.forEach((pt, idx) => {
        const x = w - ((now - pt.time) / windowMs) * w;
        const val = Math.max(0, pt.ect || 0);
        const y = baseY - Math.min(1.0, Math.max(0, (val - 30) / 90)) * amp;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // Channel 6: Battery VBAT (Purple #C084FC) - Bottom Lane 6 (Scaled for 11.0-15.5 V Voltage)
    if (_activeChannels.batt) {
      const baseY = 30 + bandH * 6 - 4;
      const amp = bandH - 8;
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = "#C084FC";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#C084FC";
      ctx.shadowBlur = 6;
      pts.forEach((pt, idx) => {
        const x = w - ((now - pt.time) / windowMs) * w;
        const batVal = pt.vbat || 12.4;
        const val = Math.min(1.0, Math.max(0, (batVal - 11.0) / 4.5));
        const y = baseY - val * amp;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // 3. Live Digital HUD Badges Overlay on Top-Left of Oscilloscope
    ctx.save();
    ctx.font = "900 11px monospace";
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#00E5FF";
    ctx.fillText(`RPM: ${Math.round(_currentRpm)}`, 14, 20);

    ctx.fillStyle = "#47FF7A";
    ctx.fillText(`TPS: ${_currentTps.toFixed(1)}%`, 120, 20);

    ctx.fillStyle = "#FF3D3D";
    ctx.fillText(`MAP: ${(_currentMap || 101.3).toFixed(1)} kPa`, 220, 20);

    ctx.fillStyle = "#FFD400";
    ctx.fillText(`INJ: ${_currentInj.toFixed(2)}ms`, 350, 20);

    ctx.fillStyle = "#FF9800";
    ctx.fillText(`ECT: ${Math.round(_currentEct)}°C`, 460, 20);

    ctx.fillStyle = "#C084FC";
    ctx.fillText(`VBAT: ${_currentVbat.toFixed(1)}V`, 560, 20);

    ctx.restore();
  }

  // Update Right Panel Circular Gauges
  function updateCircularGauges() {
    const updateGauge = (id, val, maxVal, formatFn) => {
      const valEl = document.getElementById(`cg-val-${id}`);
      if (valEl) valEl.textContent = formatFn(val);
    };

    updateGauge("ect", _currentEct, 130, v => v.toFixed(1) + " °C");
    updateGauge("vbat", _currentVbat, 16, v => v.toFixed(2) + " V");
    updateGauge("inj", _currentInj, 15, v => v.toFixed(3) + " ms");
    updateGauge("tps", _currentTps, 100, v => v.toFixed(1) + " %");
    updateGauge("speed", _currentSpeed, 160, v => Math.round(v) + " km/h");
    updateGauge("ign", _currentIgn, 45, v => v.toFixed(1) + " °");
  }

  // Export Recorded CSV Session
  function exportCSV() {
    if (_logSamples.length === 0) {
      if (typeof App !== "undefined") App.toast("warning", "Export CSV", "No telemetry samples recorded in this session.");
      return;
    }

    const headers = ["Timestamp", "RPM", "Speed_kmh", "TPS_pct", "ECT_degC", "VBAT_volts", "Inj_ms", "Ign_deg", "MAP_kPa", "AFR"];
    const rows = _logSamples.map(s => [
      s.timestamp, s.rpm, s.speed, s.tps, s.ect, s.vbat, s.inj, s.ign, s.map, s.afr
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `honda_ecu_telemetry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return {
    init,
    updateFromECU,
    exportCSV,
    resizeCanvases
  };
})();

// Auto-initialize when DOM loads
document.addEventListener("DOMContentLoaded", () => {
  LivePerformance.init();
});
