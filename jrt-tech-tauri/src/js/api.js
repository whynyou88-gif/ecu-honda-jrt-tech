// ============================================================
// api.js - REST API Client + WebSocket Manager & Tauri IPC Bridge
// ============================================================

const API = (() => {
  const BASE = (location.protocol === 'file:' || !location.host) ? 'http://127.0.0.1:8080' : '';   // fallback for local desktop file://
  let _ws = null;
  let _wsHandlers = {};
  let _wsReconnectTimer = null;
  let _wsConnected = false;

  function safeTauriInvoke(cmd, args) {
    try {
      if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
        return window.__TAURI__.core.invoke(cmd, args);
      } else if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
        return window.__TAURI_INTERNALS__.invoke(cmd, args);
      }
    } catch(e) {
      console.warn("[Tauri IPC invoke catch]:", e);
    }
    return null;
  }

  function isTauriEnv() {
    return !!(window.__TAURI__ || window.__TAURI_INTERNALS__);
  }

  async function _tauriBridge(path, body) {
    if (!isTauriEnv()) return null;

    if (path.includes('/api/status') || path.includes('/api/live')) return safeTauriInvoke('get_status');
    if (path.includes('/api/info')) return safeTauriInvoke('get_info');
    if (path.includes('/api/ports')) return safeTauriInvoke('get_ports');
    if (path.includes('/api/connect')) return safeTauriInvoke('connect_ecu', { port: (body && body.port) ? body.port : null });
    if (path.includes('/api/disconnect')) return safeTauriInvoke('disconnect_ecu');
    if (path.includes('/api/sim/connect')) return safeTauriInvoke('sim_connect');
    if (path.includes('/api/sim/disconnect')) return safeTauriInvoke('sim_disconnect');
    if (path.includes('/api/read-dtc') || path.includes('/api/dtc')) return safeTauriInvoke('read_dtc');
    if (path.includes('/api/clear-dtc')) return safeTauriInvoke('clear_dtc');
    if (path.includes('/api/flash/read')) return safeTauriInvoke('start_flash_read', body || {});
    if (path.includes('/api/flash/write')) return safeTauriInvoke('start_flash_write', body || {});
    
    return null;
  }

  // ---- HTTP helpers ----
  async function _req(method, path, body = null) {
    // Robust check for swapped arguments
    if (method && (method.startsWith('/') || method.startsWith('http'))) {
      const temp = method;
      method = path || 'GET';
      path = temp;
    }
    if (!method) method = 'GET';

    // 1. Try Tauri IPC Native Bridge first if inside Tauri
    if (isTauriEnv()) {
      const tauriPromise = _tauriBridge(path, body);
      if (tauriPromise !== null) {
        try {
          const res = await tauriPromise;
          if (res !== null && res !== undefined) return res;
        } catch (err) {
          console.warn(`[Tauri IPC Error ${path}]:`, err);
          throw err;
        }
      }
    }
    
    // 2. Fallback to HTTP Fetch for Python / Server mode
    const opts = {
      method: method.toUpperCase(),
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    try {
      const r = await fetch(BASE + path, opts);
      const text = await r.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch (parseErr) {
        if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
        throw new Error(`Modul FTDI/K-Line belum terdeteksi. Silakan colokkan kabel FTDI ke USB.`);
      }
      if (!r.ok) throw new Error((json && json.error) ? json.error : `HTTP ${r.status}`);
      return json;
    } catch (e) {
      console.error(`[API] ${method} ${path}:`, e.message);
      throw e;
    }
  }

  const get  = (path)        => _req('GET',    path);
  const post = (path, body)  => _req('POST',   path, body);
  const del  = (path)        => _req('DELETE', path);

  // ---- GET ----
  const status   = () => get('/api/status');
  const info     = () => get('/api/info');
  const live     = () => get('/api/live');
  const dtc      = () => get('/api/dtc');
  const log      = (n=50) => get(`/api/log?count=${n}`);
  const files    = (path='/backup') => get(`/api/files?path=${encodeURIComponent(path)}`);
  const settings = () => get('/api/settings');

  // ---- POST ----
  const connect      = (data={})  => post('/api/connect', data);
  const disconnect   = ()         => post('/api/disconnect');
  const simConnect   = ()         => post('/api/sim/connect');
  const simDisconnect= ()         => post('/api/sim/disconnect');
  const readId       = ()         => post('/api/read-id');
  const readDTC      = ()         => post('/api/read-dtc');
  const clearDTC     = ()         => post('/api/clear-dtc');
  const startLog     = ()         => post('/api/start-log');
  const stopLog      = ()         => post('/api/stop-log');
  const backup       = (filename) => post('/api/backup', { filename });
  const restore      = (filename) => post('/api/restore', { filename });
  const reboot       = ()         => post('/api/reboot');
  const saveSettings = (data)     => post('/api/settings', data);
  const setModel     = (id)       => post('/api/set-model', { model: id });
  const klineSend    = (hex)      => post('/api/kline-send', { hex });
  const loadBuffer   = (filename) => post('/api/buffer/load', { filename });

  // ---- DELETE ----
  const deleteBackup = (filename) =>
    del(`/api/backup?filename=${encodeURIComponent(filename)}`);

  // ---- OTA Upload ----
  async function otaUpload(file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/ota');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress)
          onProgress(Math.round(e.loaded / e.total * 100));
      };
      xhr.onload = () => {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { resolve({}); }
      };
      xhr.onerror = () => reject(new Error('OTA upload failed'));
      const fd = new FormData();
      fd.append('firmware', file, file.name);
      xhr.send(fd);
    });
  }

  // ---- Download backup file ----
  function downloadBackup(filename) {
    const a = document.createElement('a');
    a.href = `${BASE}/download?file=${encodeURIComponent(filename)}`;
    a.download = filename;
    a.click();
  }

  // ---- WebSocket & Tauri Telemetry Stream ----
  function wsConnect() {
    if (isTauriEnv()) {
      _wsConnected = true;
      console.log('[Tauri IPC] Active telemetry listener attached');
      const listenFn = (window.__TAURI__ && window.__TAURI__.event) ? window.__TAURI__.event.listen : (window.__TAURI_INTERNALS__ ? window.__TAURI_INTERNALS__.listen : null);
      if (listenFn) {
        listenFn('live-telemetry', (event) => {
          const telemetryData = event.payload || event;
          const msg = { type: 'telemetry', data: telemetryData };
          if (_wsHandlers['telemetry']) {
            _wsHandlers['telemetry'].forEach(h => { try { h(msg); } catch {} });
          }
          if (_wsHandlers['live']) {
            _wsHandlers['live'].forEach(h => { try { h(msg); } catch {} });
          }
          if (_wsHandlers.message) {
            _wsHandlers.message.forEach(h => { try { h(msg); } catch {} });
          }
        });
      }
      return;
    }

    const host = (location.protocol === 'file:' || !location.host) ? 'localhost:8080' : location.host;
    const url = `ws://${host}/ws`;
    try {
      _ws = new WebSocket(url);
    } catch(e) {
      console.warn('[WS] WebSocket init failed:', e);
      return;
    }

    _ws.onopen = () => {
      _wsConnected = true;
      console.log('[WS] Connected');
      clearTimeout(_wsReconnectTimer);
      if (_wsHandlers.open) {
        _wsHandlers.open.forEach(h => { try { h(); } catch {} });
      }
    };

    _ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (_wsHandlers[msg.type]) {
          _wsHandlers[msg.type].forEach(h => { try { h(msg); } catch {} });
        }
        if (_wsHandlers.message) {
          _wsHandlers.message.forEach(h => { try { h(msg); } catch {} });
        }
      } catch {}
    };

    _ws.onclose = () => {
      _wsConnected = false;
      console.log('[WS] Disconnected — reconnecting in 3s');
      if (_wsHandlers.close) {
        _wsHandlers.close.forEach(h => { try { h(); } catch {} });
      }
      _wsReconnectTimer = setTimeout(wsConnect, 3000);
    };

    _ws.onerror = (e) => {
      console.warn('[WS] Error', e);
    };
  }

  function wsSend(cmd, data = {}) {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(JSON.stringify({ cmd, ...data }));
    }
  }

  function onWS(type, handler) {
    if (typeof handler !== 'function') return;
    if (!_wsHandlers[type]) _wsHandlers[type] = [];
    if (!_wsHandlers[type].includes(handler)) {
      _wsHandlers[type].push(handler);
    }
  }

  function wsClose() {
    clearTimeout(_wsReconnectTimer);
    if (_ws) _ws.close();
  }

  function onLiveUpdate(callback) {
    if (typeof callback === 'function') {
      onWS('telemetry', (msg) => { if (msg && msg.data) callback(msg.data); else if (msg) callback(msg); });
      onWS('live', (msg) => { if (msg && msg.data) callback(msg.data); else if (msg) callback(msg); });
    }
  }

  return {
    // GET
    status, info, live, dtc, log, files, settings,
    // POST
    connect, disconnect, simConnect, simDisconnect, readId, readDTC, clearDTC,
    startLog, stopLog, backup, restore, reboot,
    saveSettings, setModel, klineSend, loadBuffer,
    // Generic Request
    request: _req,
    // DELETE
    deleteBackup,
    // File
    otaUpload, downloadBackup,
    // WS
    wsConnect, wsSend, onWS, wsClose, onLiveUpdate,
    get isWsConnected() { return _wsConnected; }
  };
})();
