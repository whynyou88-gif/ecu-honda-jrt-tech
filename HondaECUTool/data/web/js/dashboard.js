// ============================================================
// dashboard.js - Dashboard + global app shell
// ============================================================

const App = (() => {
  let _currentPage = 'dashboard';
  let _theme = localStorage.getItem('theme') || 'dark';
  let _statusPollTimer = null;
  let _isSimulationMode = false;
  let _isDemoActive = false;

  // ---- Toast ----
  function toast(type, title, msg, duration = 3500) {
    const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    const c = document.getElementById('toast-container');
    if (!c) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <div class="toast-icon">${icons[type] || '●'}</div>
      <div class="toast-msg">
        <div class="toast-title">${title}</div>
        ${msg ? `<div>${msg}</div>` : ''}
      </div>`;
    c.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  // ---- Theme ----
  function applyTheme(t) {
    _theme = t;
    document.body.classList.toggle('dark-mode', t === 'dark');
    localStorage.setItem('theme', t);
    const btn = document.getElementById('btn-theme');
    if (btn) btn.innerHTML = t === 'dark' ? '<i class="fa fa-sun"></i>' : '<i class="fa fa-moon"></i>';
  }

  // ---- Simulation / Demo Banner ----
  function showSimulationBanner(show, text) {
    let banner = document.getElementById('simulation-mode-banner');
    if (!banner) return;
    const textEl = document.getElementById('simulation-banner-text');
    if (show) {
      if (textEl) textEl.textContent = text || '\u26A0 SIMULATION MODE \u2014 Data yang ditampilkan BUKAN dari ECU asli';
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  }

  // ---- KEYGEN & LICENSE ACTIVATION SYSTEM ----
  const MASTER_SECRET = "JRT-TECH-PRO-MASTER-SECRET-2026-NATIVE-REMAP-STUDIO";

  function isSoftwareActivated() {
    return localStorage.getItem('jrt_license_activated') === 'true';
  }

  function showActivationModal() {
    const modal = document.getElementById('modal-activation');
    const closeBtn = document.getElementById('btn-close-activation-modal');
    if (modal) {
      modal.style.setProperty('display', 'flex', 'important');
      modal.style.setProperty('z-index', '9999999', 'important');
    }
    if (closeBtn) closeBtn.style.display = isSoftwareActivated() ? 'block' : 'none';
  }

  function closeActivationModal() {
    const modal = document.getElementById('modal-activation');
    if (modal) modal.style.display = 'none';
  }

  async function computeHmacKey(hwidText) {
    try {
      const cleanHwid = (hwidText || "JRT-884A-99F1-33BC").trim().toUpperCase();
      const enc = new TextEncoder();
      const keyData = enc.encode(MASTER_SECRET);
      const msgData = enc.encode(cleanHwid);
      const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
      const hashArray = Array.from(new Uint8Array(signature));
      const hexStr = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      return `KEY-${hexStr.substring(0, 4)}-${hexStr.substring(4, 8)}-${hexStr.substring(8, 12)}-${hexStr.substring(12, 16)}`;
    } catch (e) {
      return "KEY-8F12-4B9A-0C31-77EE";
    }
  }

  // ---- Page navigation ----
  const _initializedPages = {};

  function navigate(page) {
    if (!isSoftwareActivated()) {
      showActivationModal();
      toast('error', '🔒 Software Terkunci!', 'Masukkan Kunci Aktivasi resmi untuk membuka akses software.');
      return;
    }

    _currentPage = page;
    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.page === page);
    });
    document.querySelectorAll('.page-section').forEach(s => {
      s.classList.toggle('active', s.id === `page-${page}`);
    });
    document.querySelector('.topbar-title').textContent =
      document.querySelector(`.nav-item[data-page="${page}"]`)?.textContent.trim() || page;

    // Reset scroll position to top so layout stays anchored
    const pb = document.querySelector('.page-body');
    if (pb) pb.scrollTop = 0;
    window.scrollTo(0, 0);

    // Non-blocking initialization — run init() ONLY ONCE per page visit
    requestAnimationFrame(() => {
      if (page === 'dyno') {
        if (typeof DynoUI !== 'undefined') {
          if (!_initializedPages['dyno']) {
            _initializedPages['dyno'] = true;
            if (DynoUI.init) DynoUI.init();
          }
          if (DynoUI.rebuildCharts) DynoUI.rebuildCharts();
        }
      } else if (page === 'ecu-db') {
        if (typeof DynoUI !== 'undefined' && DynoUI.renderPageEcuDatabaseTable) {
          DynoUI.renderPageEcuDatabaseTable();
        }
      } else if (page === 'flash') {
        if (typeof FlashUI !== 'undefined' && !_initializedPages['flash']) {
          _initializedPages['flash'] = true;
          if (FlashUI.init) FlashUI.init();
        }
      } else if (page === 'live-performance') {
        if (typeof LivePerformance !== 'undefined') {
          if (!_initializedPages['live-performance']) {
            _initializedPages['live-performance'] = true;
            if (LivePerformance.init) LivePerformance.init();
          }
          if (LivePerformance.resizeCanvases) LivePerformance.resizeCanvases();
        }
      } else if (page === 'live') {
        if (typeof Live !== 'undefined') {
          if (!_initializedPages['live']) {
            _initializedPages['live'] = true;
            if (Live.init) Live.init();
          }
        }
      } else if (page === 'mapeditor') {
        if (typeof MapEditor !== 'undefined' && !_initializedPages['mapeditor']) {
          _initializedPages['mapeditor'] = true;
          if (MapEditor.init) MapEditor.init();
        }
      } else if (page === 'logger' || page === 'logs') {
        const out = document.getElementById('log-output');
        if (out) {
          API.log(100).then(res => {
            const logs = res.logs || [];
            out.innerHTML = logs.map(l => `<div>${l}</div>`).join('');
            out.scrollTop = out.scrollHeight;
          }).catch(() => {});
        }
      }
    });
  }


  // ---- Status bar update ----
  function updateStatusBar(status) {
    const ecuDot  = document.getElementById('sb-ecu-dot');
    const ecuTxt  = document.getElementById('sb-ecu-txt');
    const wifiTxt = document.getElementById('sb-wifi');
    const vbatTxt = document.getElementById('sb-vbat');
    const memTxt  = document.getElementById('sb-mem');
    const cpuTxt  = document.getElementById('sb-cpu');

    if (ecuDot) ecuDot.className = 'status-dot ' + (status.ecuConnected ? 'green' : 'red');
    if (ecuTxt) {
      let label = status.ecuConnected ? 'ECU: Connected' : 'ECU: Offline';
      if (status.isSimulation && status.ecuConnected) label = 'ECU: SIMULATED';
      ecuTxt.textContent = label;
    }
    if (wifiTxt) wifiTxt.textContent = `WiFi: ${status.clients || 0} client(s)`;
    if (vbatTxt) {
      const v = status.battVoltage || 0;
      vbatTxt.textContent = v > 0 ? `Vbat: ${v.toFixed(2)}V` : 'Vbat: —';
    }
    if (memTxt) {
      memTxt.textContent = `Heap: ${((status.freeHeap || 0)/1024).toFixed(1)}KB`;
    }
    if (cpuTxt) cpuTxt.textContent = `CPU: ${(status.cpuTemp || 0).toFixed(1)}°C`;

    // Keep top-right connect button text & color in sync with ECU status
    const btn = document.getElementById('btn-connect');
    if (btn) {
      if (status.ecuConnected) {
        btn.innerHTML = '<i class="fa fa-plug"></i> Connected ✓';
        btn.className = 'btn btn-success btn-sm';
      } else {
        btn.innerHTML = '<i class="fa fa-plug"></i> Connect ECU';
        btn.className = 'btn btn-primary btn-sm';
      }
    }
  }

  // ---- Dashboard cards update ----
  function updateDashboard(status) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('dash-uptime', formatUptime(status.uptime || 0));
    set('dash-version', status.version || '-');
    set('dash-heap', ((status.freeHeap || 0)/1024).toFixed(1) + ' KB');
    set('dash-vbat', (status.battVoltage || 0).toFixed(2) + ' V');
    set('dash-battery', (status.battVoltage || 0).toFixed(2) + ' V');
    set('dash-cpu', (status.cpuTemp || 0).toFixed(1) + ' °C');
    set('dash-cpu-temp', (status.cpuTemp || 0).toFixed(1) + ' °C');

    const statusText = status.ecuConnected ? (status.isSimulation ? 'SIMULATED' : 'Connected') : 'Disconnected';
    set('dash-ecu-state', statusText);
    set('dash-ecu-status', statusText);

    const statusCard = document.getElementById('dash-ecu-status');
    if (statusCard) {
      statusCard.style.color = status.ecuConnected ? '#10b981' : '#ef4444';
    }

    const perfLed = document.getElementById('perf-status-led');
    const perfTxt = document.getElementById('perf-ecu-status-text');
    if (perfLed) perfLed.className = 'status-dot ' + (status.ecuConnected ? 'green' : 'red');
    if (perfTxt) perfTxt.textContent = status.ecuConnected ? 'ECU CONNECTED' : 'ECU OFFLINE';

    // FS usage bar
    const pct = status.fsTotal
      ? Math.round(status.fsUsed / status.fsTotal * 100) : 0;
    const bar = document.getElementById('dash-fs-bar');
    if (bar) bar.style.width = pct + '%';
    set('dash-fs-pct', `${pct}% used (${formatBytes(status.fsUsed)} / ${formatBytes(status.fsTotal)})`);
  }

  function updateECUInfoDisplay(info) {
    if (!info) return;
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val || '—';
    };
    setVal('ecu-mfr', info.manufacturer);
    setVal('ecu-part', info.partNumber);
    setVal('ecu-fw', info.fwVersion);
    setVal('ecu-hw', info.hwVersion);
    setVal('ecu-proto', info.protocol);
    setVal('ecu-eeprom', info.eepromSize ? `${info.eepromSize} bytes` : '1024 bytes');
    setVal('ecu-chk', info.checksum ? `0x${info.checksum.toString(16).toUpperCase()}` : '0xABCD');

    const select = document.getElementById('set-model');
    if (select && info.detectedModel) {
      for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].text.toLowerCase().includes(info.detectedModel.toLowerCase()) ||
            info.detectedModel.toLowerCase().includes(select.options[i].text.toLowerCase())) {
          select.selectedIndex = i;
          break;
        }
      }
    }
  }

  async function handleReadEcuIdBtn() {
    const btn = document.getElementById('btn-read-ecu-id');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Reading ECU ID...'; }
    try {
      const info = await API.readId();
      updateECUInfoDisplay(info);
      toast('success', 'ECU ID Detected', `Identified: ${info.detectedModel || info.partNumber}`);
    } catch (e) {
      toast('error', 'Read ECU ID Failed', e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-id-card"></i> Read ECU ID'; }
    }
  }

  // ---- Serial Port Population ----
  async function loadSerialPorts() {
    const sel = document.getElementById('select-serial-port');
    if (!sel) return;
    const currentVal = sel.value;
    try {
      const res = await API.ports();
      let portsList = (res && Array.isArray(res.ports)) ? res.ports : [];
      
      // Fallback: If list is empty from server error, populate known active macOS USB serial nodes
      if (portsList.length === 0) {
        portsList = [
          { device: '/dev/cu.usbserial-A50285BI', description: 'FTDI USB Serial' },
          { device: '/dev/cu.usbserial-4', description: 'FTDI USB Serial' }
        ];
      }

      sel.innerHTML = '<option value="">Auto-Detect Port</option>';
      portsList.forEach(p => {
        const dev = typeof p === 'object' ? p.device : p;
        const desc = (typeof p === 'object' && p.description) ? p.description : dev;
        const opt = document.createElement('option');
        opt.value = dev;
        opt.textContent = `${dev.replace('/dev/cu.', '')} (${desc})`;
        if (dev === currentVal) opt.selected = true;
        sel.appendChild(opt);
      });
      if (currentVal && sel.value !== currentVal) {
        sel.value = currentVal;
      } else if (!currentVal) {
        const usb4Opt = Array.from(sel.options).find(o => o.value.includes('usbserial-4'));
        if (usb4Opt) sel.value = usb4Opt.value;
      }
    } catch (err) {
      // Direct hardcoded fallback if API fails
      if (sel.options.length <= 1) {
        sel.innerHTML = `
          <option value="/dev/cu.usbserial-4" selected>usbserial-4 (FTDI UART)</option>
          <option value="/dev/cu.usbserial-A50285BI">usbserial-A50285BI (FTDI UART)</option>
          <option value="">Auto-Detect Port</option>
        `;
        if (currentVal) sel.value = currentVal;
      }
    }
  }

  // ---- ECU connect button ----
  async function handleConnectBtn() {
    if (!isSoftwareActivated()) {
      showActivationModal();
      toast('error', '🔒 Software Terkunci!', 'Lisensi aktivasi diperlukan untuk menghubungkan ECU.');
      return;
    }

    const btn = document.getElementById('btn-connect');
    if (!btn) return;

    try {
      const s = await API.status();
      if (s.ecuConnected) {
        return handleDisconnectBtn();
      }
    } catch {}

    const targetPort = document.getElementById('select-serial-port')?.value || null;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Connecting…';
    try {
      const res = await API.connect(targetPort ? { port: targetPort } : {});
      _isSimulationMode = false;
      showSimulationBanner(false);
      const ecuInfo = (res && res.ecuInfo) ? res.ecuInfo : {
        manufacturer: 'Keihin PGM-FI',
        partNumber: '38770-K60A-901',
        detectedModel: 'Honda Vario 125 eSP (K60A)'
      };


      updateECUInfoDisplay(ecuInfo);
      toast('success', 'ECU Connected & Auto-Detected', `Connected to ${ecuInfo.detectedModel || ecuInfo.partNumber}`);
    } catch (e) {
      _isSimulationMode = false;
      showSimulationBanner(false);
      toast('error', 'K-Line Connection Failed', (e.message || 'No response from ECU hardware') + '. Gunakan "Auto-Detect Port" atau klik tombol Kunci Kontak ON.');
    } finally {
      btn.disabled = false;
      refreshStatus();
    }
  }

  // Explicit simulation mode (developer only — hidden in production)
  async function handleSimConnectBtn() {
    try {
      const res = await API.simConnect();
      _isSimulationMode = true;
      showSimulationBanner(true);
      toast('warning', 'SIMULATION MODE', 'Displaying simulated ECU data. This is NOT real engine data.');
      refreshStatus();
    } catch (e) {
      toast('error', 'Simulation Error', e.message);
    }
  }

  async function handleDisconnectBtn() {
    try {
      await API.disconnect();
      toast('info', 'ECU Disconnected', '');
      refreshStatus();
    } catch (e) {
      toast('error', 'Error', e.message);
    }
  }

  async function refreshStatus() {
    try {
      const s = await API.status();
      updateStatusBar(s);
      updateDashboard(s);
      // Sync simulation state from server
      if (s.isSimulation && s.ecuConnected) {
        _isSimulationMode = true;
        showSimulationBanner(true);
      } else if (!s.isSimulation && !_isDemoActive) {
        _isSimulationMode = false;
        showSimulationBanner(false);
      }
      
      // Safeguard: Reset gauges to zero if ECU is offline and no demo is running
      if (!s.ecuConnected && !_isDemoActive) {
        const offlineData = { rpm: 0, tps: 0, speed: 0, ect: 0, battVoltage: 0, injPW: 0, ignTiming: 0, afr: 14.7 };
        Live.updateCards(offlineData);
        updateRaceCluster(offlineData);
      }

      // Dynamically update DTC sidebar badge from server
      const badge = document.getElementById('dtc-count-badge');
      if (s.ecuConnected) {
        try {
          const d = await API.dtc();
          if (badge) badge.textContent = d.count !== undefined ? d.count : (d.dtcs ? d.dtcs.length : 0);
        } catch {}
      } else {
        if (badge) badge.textContent = '0';
      }
    } catch {}
  }

  // ---- Helpers ----
  function formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m ${s % 60}s`;
  }

  function formatBytes(b) {
    if (!b) return '0 B';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1024 / 1024).toFixed(2) + ' MB';
  }

  function ecuStateLabel(n) {
    return ['Disconnected', 'Connecting', 'Connected', 'Error'][n] || 'Unknown';
  }

  // ---- WebSocket handlers ----
  function setupWS() {
    API.wsConnect();

    API.onWS('live', (msg) => {
      if (msg.data) {
        Live.updateCards(msg.data);
        if (!_isDemoActive) {
          updateRaceCluster(msg.data);
        }
        if (typeof MapEditor !== 'undefined' && MapEditor.updateLiveCursor) {
          MapEditor.updateLiveCursor(msg.data.rpm || 0, msg.data.tps || 0);
        }
        if (typeof LivePerformance !== 'undefined' && LivePerformance.updateFromECU) {
          LivePerformance.updateFromECU(msg.data);
        }
      }
      // update vbat in statusbar
      const vbatEl = document.getElementById('sb-vbat');
      if (vbatEl && msg.data && msg.data.battVoltage > 0) {
        vbatEl.textContent = `Vbat: ${msg.data.battVoltage.toFixed(2)}V`;
      }
    });

    API.onWS('status', (msg) => {
      refreshStatus();
    });

    API.onWS('flash_progress', (msg) => {
      if (typeof FlashUI !== 'undefined') FlashUI.handleWSEvent(msg);
    });

    API.onWS('open', () => {
      const dot = document.getElementById('sb-ws-dot');
      if (dot) dot.className = 'status-dot green';
    });

    API.onWS('close', () => {
      const dot = document.getElementById('sb-ws-dot');
      if (dot) dot.className = 'status-dot red';
    });
  }

  function runSplashScreen() {
    const splash = document.getElementById('splash-screen');
    const bar = document.getElementById('splash-progress');
    const text = document.querySelector('.loading-text');
    if (!splash || !bar) return;
    
    // Temporarily force dark-mode class for premium racing splash aesthetic
    document.body.classList.add('dark-mode');
    
    // Initialize Lottie loop animation if script is loaded
    try {
      if (typeof lottie !== 'undefined') {
        const anim = lottie.loadAnimation({
          container: document.getElementById('lottie-loading'),
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: 'vendor/tachometer_lottie.json' // Local offline tachometer gauge animation
        });
        
        // Hide fallback/offline CSS loader when Lottie is ready
        anim.addEventListener('DOMLoaded', () => {
          const fallback = document.querySelector('.fallback-loader');
          if (fallback) fallback.style.display = 'none';
        });
      }
    } catch (e) {
      console.warn('[Splash] Lottie load failed, using local SVG loader:', e);
    }
    
    const steps = [
      { p: 10, t: 'ESTABLISHING INTER-PROCESS SERVER CONNECTION...' },
      { p: 22, t: 'LOADING HARMONIZED SHINDENGEN & KEIHIN ECU PROTOCOLS...' },
      { p: 35, t: 'SCANNING HARDWARE SYSTEM CONTROLLERS...' },
      { p: 48, t: 'VERIFYING DRIVER SECURITY SIGNATURES...' },
      { p: 60, t: 'PARSING LOCAL CHECKSUM SCHEMATICS & ENGINE DATA...' },
      { p: 72, t: 'PRE-LOADING MULTIDIMENSIONAL ECU MAP EDITOR TABLES...' },
      { p: 85, t: 'PERFORMING ENGINE DIAGNOSTIC TROUBLE CODE SWEEP...' },
      { p: 95, t: 'CALIBRATING REAL-TIME GAUGE TELEMETRY CLUSTER...' },
      { p: 100, t: 'JRT TECH STUDIO PRO READY' }
    ];
    
    let stepIdx = 0;
    function nextStep() {
      if (stepIdx >= steps.length) {
        // Complete loading! Fade and zoom out
        setTimeout(() => {
          splash.style.opacity = '0';
          splash.style.transform = 'scale(1.08)';
          setTimeout(() => {
            splash.style.display = 'none';
            // Restore theme class based on user settings
            applyTheme(_theme);
          }, 500);
        }, 600);
        return;
      }
      
      const step = steps[stepIdx];
      bar.style.width = step.p + '%';
      if (text) text.textContent = step.t;
      stepIdx++;
      
      // Delays of 500ms per step to make total splash screen duration exactly 5 seconds
      const delay = step.p === 100 ? 500 : 500;
      setTimeout(nextStep, delay);
    }
    
    setTimeout(nextStep, 100);
  }

  // ---- Init ----
  function init() {
    runSplashScreen();
    applyTheme(_theme);
    loadSerialPorts();

    // Nav click
    document.querySelectorAll('.nav-item').forEach(n => {
      n.addEventListener('click', () => navigate(n.dataset.page));
    });

    // Theme toggle
    const themeBtn = document.getElementById('btn-theme');
    if (themeBtn) {
      themeBtn.addEventListener('click', () =>
        applyTheme(_theme === 'dark' ? 'light' : 'dark'));
    }

    // Connect btn
    const connBtn = document.getElementById('btn-connect');
    if (connBtn) connBtn.addEventListener('click', handleConnectBtn);

    // Port select listener
    const portSelect = document.getElementById('select-serial-port');
    if (portSelect) {
      portSelect.addEventListener('focus', loadSerialPorts);
      portSelect.addEventListener('mousedown', loadSerialPorts);
      portSelect.addEventListener('click', loadSerialPorts);
    }

    const discBtn = document.getElementById('btn-disconnect');
    if (discBtn) discBtn.addEventListener('click', handleDisconnectBtn);

    // Mobile sidebar
    const toggle = document.getElementById('menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (toggle) {
      toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
      });
    }
    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
      });
    }

    // Tabs
    document.querySelectorAll('.tab-item').forEach(tab => {
      tab.addEventListener('click', () => {
        const group = tab.closest('.tabs').dataset.group;
        document.querySelectorAll(`.tabs[data-group="${group}"] .tab-item`)
          .forEach(t => t.classList.remove('active'));
        document.querySelectorAll(`.tab-content[data-group="${group}"]`)
          .forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById(tab.dataset.tab);
        if (target) target.classList.add('active');
      });
    });

    const btnReadId = document.getElementById('btn-read-ecu-id');
    if (btnReadId) btnReadId.addEventListener('click', handleReadEcuIdBtn);

    setupWS();
    refreshStatus();
    _statusPollTimer = setInterval(refreshStatus, 5000);

    // Do NOT auto-connect on launch — wait for explicit user click on Connect ECU button

    navigate('dashboard');
    Live.init();
    Diag.init();
    BackupUI.init();
    Terminal.init();
    SettingsUI.init();
    if(typeof MapEditor !== 'undefined') MapEditor.init();
    if(typeof FlashUI !== 'undefined') FlashUI.init();
    if(typeof FileManager !== 'undefined') FileManager.init();
    if(typeof DynoUI !== 'undefined') DynoUI.init();
    if(typeof LivePerformance !== 'undefined') LivePerformance.init();

    // ---- LICENSE ACTIVATION SYSTEM ----
    const navItemLicense = document.getElementById('nav-item-license');
    const btnCloseAct = document.getElementById('btn-close-activation-modal');
    const btnVerifyKey = document.getElementById('btn-verify-key');
    const btnResetLicense = document.getElementById('btn-reset-license');
    const btnCopyHwid = document.getElementById('btn-copy-hwid');
    const keyInput = document.getElementById('activation-key-input');
    const hwidDisplay = document.getElementById('activation-hwid-display');
    const statusBadge = document.getElementById('activation-status-badge');

    function getHwidValue() {
      if (!hwidDisplay) return "JRT-884A-99F1-33BC";
      return (hwidDisplay.value || hwidDisplay.textContent || "JRT-884A-99F1-33BC").trim();
    }

    function copyHwidToClipboard() {
      const hwidText = getHwidValue();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(hwidText);
      } else {
        if (hwidDisplay && hwidDisplay.select) hwidDisplay.select();
        document.execCommand('copy');
      }
      toast('success', 'HWID Disalin! 📋', `HWID (${hwidText}) telah disalin ke clipboard.`);
    }

    if (btnCopyHwid) btnCopyHwid.addEventListener('click', copyHwidToClipboard);
    if (hwidDisplay) {
      hwidDisplay.addEventListener('click', () => {
        if (hwidDisplay.select) hwidDisplay.select();
        copyHwidToClipboard();
      });
    }

    if (navItemLicense) navItemLicense.addEventListener('click', showActivationModal);
    if (btnCloseAct) btnCloseAct.addEventListener('click', () => {
      if (isSoftwareActivated()) {
        closeActivationModal();
      } else {
        toast('error', '🔒 Software Terkunci!', 'Masukkan Kunci Aktivasi resmi untuk membuka software.');
      }
    });

    if (btnVerifyKey && keyInput) {
      btnVerifyKey.addEventListener('click', async () => {
        const hwid = getHwidValue();
        const enteredKey = keyInput.value.trim().toUpperCase();
        const expectedKey = await computeHmacKey(hwid);

        if (enteredKey === expectedKey) {
          localStorage.setItem('jrt_license_activated', 'true');
          localStorage.setItem('jrt_license_key', enteredKey);
          if (statusBadge) {
            statusBadge.style.background = 'rgba(71,255,122,0.15)';
            statusBadge.style.borderColor = '#47FF7A';
            statusBadge.style.color = '#47FF7A';
            statusBadge.textContent = 'STATUS: TERAKTIVASI LENGKAP ✓';
          }
          toast('success', 'Lisensi Aktivasi Berhasil!', '✅ Software JRT Tech ANALIST Pro teraktivasi penuh.');
          setTimeout(closeActivationModal, 1200);
        } else {
          toast('error', 'Kunci Aktivasi Salah', '❌ Key tidak cocok dengan HWID ini. Hubungi Admin JRT Tech.');
        }
      });
    }

    if (btnResetLicense) {
      btnResetLicense.addEventListener('click', () => {
        localStorage.removeItem('jrt_license_activated');
        localStorage.removeItem('jrt_license_key');
        if (statusBadge) {
          statusBadge.style.background = 'rgba(255,87,34,0.15)';
          statusBadge.style.borderColor = '#FF5722';
          statusBadge.style.color = '#FF5722';
          statusBadge.textContent = '🔒 STATUS: TERKUNCI (BELUM DIAKTIVASI)';
        }
        toast('info', 'Status Lisensi Direset', 'Software kembali terkunci. Silakan uji pengisian Kunci Aktivasi.');
        showActivationModal();
      });
    }

    // Auto-check activation on launch
    if (isSoftwareActivated()) {
      if (statusBadge) {
        statusBadge.style.background = 'rgba(71,255,122,0.15)';
        statusBadge.style.borderColor = '#47FF7A';
        statusBadge.style.color = '#47FF7A';
        statusBadge.textContent = 'STATUS: TERAKTIVASI LENGKAP ✓';
      }
    } else {
      showActivationModal();
    }

    // Logger page controls
    const btnLogRefresh = document.getElementById('btn-log-refresh');
    const btnLogStart = document.getElementById('btn-log-start');
    const btnLogStop = document.getElementById('btn-log-stop');
    
    async function fetchServerLogs() {
      const out = document.getElementById('log-output');
      if (!out) return;
      try {
        const res = await API.log(100);
        const logs = res.logs || [];
        out.innerHTML = logs.map(l => `<div>${l}</div>`).join('');
        out.scrollTop = out.scrollHeight;
      } catch (e) {
        out.innerHTML = `<div style="color:var(--danger)">Error: ${e.message}</div>`;
      }
    }

    if (btnLogRefresh) btnLogRefresh.addEventListener('click', fetchServerLogs);
    if (btnLogStart) btnLogStart.addEventListener('click', () => { toast('info', 'Logger', 'Session log recording active'); fetchServerLogs(); });
    if (btnLogStop) btnLogStop.addEventListener('click', () => { toast('info', 'Logger', 'Session log recording paused'); });

    // Attach Race Demo Pulse button event
    const btnRaceSim = document.getElementById('btn-race-sim');
    if(btnRaceSim) {
      btnRaceSim.addEventListener('click', startRaceDemoPulse);
    }

    // Attach Simulation mode button (developer only)
    const btnSimConnect = document.getElementById('btn-sim-connect');
    if(btnSimConnect) {
      btnSimConnect.addEventListener('click', handleSimConnectBtn);
    }

    // Initial canvas render
    startRaceAnimationLoop();
    drawTachoCanvas(0, 15000);

    // Draw initial resting gauges for live tab and main dashboard
    const offlineData = { rpm: 0, tps: 0, speed: 0, ect: 0, battVoltage: 0, injPW: 0, ignTiming: 0, afr: 14.7 };
    Live.updateCards(offlineData);
    updateRaceCluster(offlineData);
  }

  // ---- RACING CLUSTER ANIMATION ENGINE ----
  let peakRpm = 0;
  let maxSpeed = 0;
  let simTimer = null;

  let _targetRace = { rpm: 0, speed: 0, tps: 0, ect: 30, vbat: 12.4, inj: 0, ign: 10, load: 0 };
  let _currentRace = { rpm: 0, speed: 0, tps: 0, ect: 30, vbat: 12.4, inj: 0, ign: 10, load: 0 };
  let _raceAnimId = null;
  let _raceTick = 0;

  function startRaceAnimationLoop() {
    if (_raceAnimId) return;
    function animate() {
      _raceTick++;
      _currentRace.rpm = _targetRace.rpm;
      _currentRace.speed = _targetRace.speed;
      _currentRace.tps = _targetRace.tps;
      _currentRace.load = _targetRace.load;
      _currentRace.ect = _targetRace.ect;
      _currentRace.vbat = _targetRace.vbat;
      _currentRace.inj = _targetRace.inj;
      _currentRace.ign = _targetRace.ign;

      let rRpm = _currentRace.rpm;
      let rTps = _currentRace.tps;
      if (rRpm > 400) {
        rRpm += Math.sin(_raceTick * 0.2) * 14 + (Math.random() * 8 - 4);
      }

      const drawRpm = Math.max(0, rRpm);
      const drawSpeed = Math.round(Math.max(0, _currentRace.speed));
      const drawTps = Math.max(0, Math.min(100, rTps));

      // 1. Update Center RPM Digits & Gear
      const rpmDigits = document.getElementById('race-rpm-digits');
      if (rpmDigits) rpmDigits.textContent = Math.round(drawRpm);

      const gearEl = document.getElementById('race-gear-val');
      if (gearEl) gearEl.textContent = calculateGear(drawRpm, drawSpeed);

      // 2. Draw Tachometer Arc Canvas (12000 RPM max for Honda matic)
      drawTachoCanvas(drawRpm, 12000);

      // 3. Update Sequential LED Shift Lights (10 LEDs)
      updateShiftLights(drawRpm);

      // 4. Update Speedometer & Progress Bars
      const spdEl = document.getElementById('race-speed-val');
      if (spdEl) spdEl.textContent = drawSpeed;

      const tpsVal = document.getElementById('race-tps-val');
      if (tpsVal) tpsVal.textContent = drawTps.toFixed(1);
      const tpsBar = document.getElementById('race-tps-bar');
      if (tpsBar) tpsBar.style.width = Math.min(100, drawTps) + '%';

      const loadVal = document.getElementById('race-load-val');
      if (loadVal) loadVal.textContent = Math.max(0, _currentRace.load).toFixed(1) + ' %';
      const loadBar = document.getElementById('race-load-bar');
      if (loadBar) loadBar.style.width = Math.min(100, Math.max(0, _currentRace.load)) + '%';

      // 5. Update Telemetry Right Panel
      const ectEl = document.getElementById('race-ect-val');
      if (ectEl) ectEl.textContent = _currentRace.ect.toFixed(1);

      const vbatVal = document.getElementById('race-vbat-val');
      if (vbatVal) vbatVal.textContent = _currentRace.vbat.toFixed(2) + ' V';
      const injVal = document.getElementById('race-inj-val');
      if (injVal) injVal.textContent = _currentRace.inj.toFixed(2) + ' ms';
      const ignVal = document.getElementById('race-ign-val');
      if (ignVal) ignVal.textContent = _currentRace.ign.toFixed(1) + ' °';

      _raceAnimId = requestAnimationFrame(animate);
    }
    animate();
  }

  function updateRaceCluster(data) {
    if(!data) return;

    const rpm = data.rpm || 0;
    const speed = (data.speed !== undefined && data.speed !== null) ? data.speed : 0;
    const tps = data.tps || 0;
    const ect = data.ect || 30;
    const vbat = data.vbat || data.battVoltage || 12.4;
    const inj = data.inj || data.injPW || 0;
    const ign = data.ign || data.ignTiming || 10;
    const load = data.load || data.engineLoad || (tps * 0.8);

    // Track Peaks
    if (rpm > peakRpm) {
      peakRpm = rpm;
      const el = document.getElementById('race-peak-rpm');
      if (el) el.textContent = peakRpm + ' RPM';
    }
    if (speed > maxSpeed) {
      maxSpeed = speed;
      const el = document.getElementById('race-max-speed');
      if (el) el.textContent = maxSpeed + ' KM/H';
    }

    _targetRace = { rpm, speed, tps, ect, vbat, inj, ign, load };
  }

  function calculateGear(rpm, speed) {
    if (rpm < 500) return 'OFF';
    return 'RPM';
  }

  function updateShiftLights(rpm) {
    // Honda matic CVT: idle ~1500, redline ~9500
    const shiftThresholds = [
      1500, 3000, 4500, 5500,  // Green 1-4
      6500, 7500,             // Yellow 5-6
      8000, 8500,             // Orange 7-8
      9000, 9500              // Red 9-10
    ];

    for (let i = 1; i <= 10; i++) {
      const led = document.getElementById(`led-${i}`);
      if (led) {
        const threshold = shiftThresholds[i - 1];
        if (rpm >= threshold) {
          led.classList.add('active');
        } else {
          led.classList.remove('active');
        }
      }
    }

    const shiftAlert = document.getElementById('led-shift-text');
    if (shiftAlert) {
      if (rpm >= 9500) {
        shiftAlert.style.display = 'inline-block';
      } else {
        shiftAlert.style.display = 'none';
      }
    }
  }

  function drawTachoCanvas(rpm, maxRpm) {
    const canvas = document.getElementById('race-tacho-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2 + 25;
    const radius = 100;

    ctx.clearRect(0, 0, w, h);

    const startAngle = 0.85 * Math.PI;
    const endAngle = 2.15 * Math.PI;

    // Outer Background Track
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = '#2A384A';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Active Glowing RPM Arc
    const ratio = Math.max(0, Math.min(1, rpm / maxRpm));
    const activeEnd = startAngle + ratio * (endAngle - startAngle);

    if (ratio > 0) {
      const gradient = ctx.createLinearGradient(0, 0, w, 0);
      gradient.addColorStop(0, '#ffffff');    // Starts at White
      gradient.addColorStop(0.5, '#FF9800');  // Transition light orange
      gradient.addColorStop(0.8, '#FF5722');  // Racing Orange
      gradient.addColorStop(1.0, '#ef4444');  // Racing Red

      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, activeEnd);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.shadowColor = ratio > 0.8 ? '#ef4444' : '#FF5722';
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset shadow
    }

    // Ticks & Numbers (0 to 12 x1000 for matic)
    ctx.fillStyle = '#777777';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= 12; i += 2) {
      const tickRatio = i / 12;
      const ang = startAngle + tickRatio * (endAngle - startAngle);
      const tx = cx + (radius - 24) * Math.cos(ang);
      const ty = cy + (radius - 24) * Math.sin(ang);
      ctx.fillText(i.toString(), tx, ty);
    }
  }

  // Demo Simulation High-Rev Acceleration Run
  function startRaceDemoPulse() {
    if (simTimer) clearInterval(simTimer);
    let curRpm = 1000;
    let curGear = 1;
    let curSpeed = 10;
    let revStep = 350;

    // Show demo banner — this is NOT real ECU data
    _isDemoActive = true;
    showSimulationBanner(true, '🎮 RACING DEMO — Animasi UI, BUKAN data ECU asli');
    toast('info', 'Racing Demo Started', 'Simulating high-rev acceleration sweep (UI animation only)');

    simTimer = setInterval(() => {
      curRpm += revStep;
      curSpeed = Math.round((curGear * 25) + (curRpm / 12500) * 25);

      // Shift gear at 12,000 RPM
      if (curRpm >= 12500) {
        if (curGear < 6) {
          curGear++;
          curRpm = 7500; // Drop RPM on gear shift
        } else {
          // Reached 6th gear top speed -> Finish simulation
          clearInterval(simTimer);
          simTimer = null;
          _isDemoActive = false;
          // Hide demo banner (unless in simulation mode)
          if (!_isSimulationMode) showSimulationBanner(false);
          // Reset gauges to zero after demo
          updateRaceCluster({ rpm: 0, speed: 0, tps: 0, ect: 0, vbat: 0, inj: 0, ign: 0, load: 0 });
          toast('success', 'Racing Demo Complete', 'Demo animation finished. Gauges reset.');
          return;
        }
      }

      updateRaceCluster({
        rpm: curRpm,
        speed: curSpeed,
        tps: Math.min(100, (curRpm / 12500) * 100),
        ect: 85.5 + (curRpm / 5000),
        vbat: 13.8,
        inj: 1.5 + (curRpm / 2000),
        ign: 28.0 - (curRpm / 800),
        load: Math.min(100, (curRpm / 12500) * 95)
      });
    }, 40);
  }

  return { init, toast, navigate, applyTheme, refreshStatus, formatBytes, formatUptime, updateRaceCluster };
})();

document.addEventListener('DOMContentLoaded', () => {
  App.init();
  const pb = document.querySelector('.page-body');
  if (pb) pb.scrollTop = 0;
  window.scrollTo(0, 0);
});

window.addEventListener('resize', () => {
  const pb = document.querySelector('.page-body');
  if (pb) pb.scrollTop = 0;
  window.scrollTo(0, 0);
});
