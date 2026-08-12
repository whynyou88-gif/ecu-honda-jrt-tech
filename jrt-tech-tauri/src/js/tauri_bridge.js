// ============================================================
// tauri_bridge.js — High-Performance Frontend Adapter Layer for Tauri
// Fixes Windows WebView2 Not Responding issue by:
// 1. Properly hooking WebSocket onmessage/onopen properties & listeners
// 2. Returning cached live data for /api/live without IPC lock contention
// 3. Throttling UI telemetry dispatches with requestAnimationFrame
// ============================================================

(function () {
  'use strict';

  console.log('[TauriBridge] Initializing Ultra-Fast Tauri Frontend Bridge...');

  const isTauri = !!window.__TAURI_INTERNALS__ || !!window.__TAURI_IPC__ || !!window.__TAURI__;

  // Cached telemetry state
  let latestTelemetry = {
    connected: false,
    ecuConnected: false,
    rpm: 0,
    tps: 0.0,
    map: 0.0,
    iat: 0.0,
    ect: 0.0,
    battVoltage: 0.0,
    injPW: 0.0,
    ignTiming: 0.0,
    speed: 0,
    engineLoad: 0.0,
    o2: 0.0,
    afr: 0.0,
    fuelTrim: 0.0,
    closedLoop: false,
    idleSwitch: false,
    com_port: "FTDI USB Serial"
  };

  // Global event bus for WebSocket compatibility
  window.tauriEventEmitter = {
    listeners: {},
    on(event, fn) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(fn);
    },
    emit(event, data) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(fn => {
          try { fn(data); } catch (e) { console.error('[TauriBridge Event Error]', e); }
        });
      }
    }
  };

  if (isTauri) {
    console.log('[TauriBridge] Running in Tauri environment!');

    const invoke = window.__TAURI_INTERNALS__ ? window.__TAURI_INTERNALS__.invoke : window.__TAURI__.core.invoke;
    const listen = window.__TAURI__ ? window.__TAURI__.event.listen : null;

    let rafPending = false;

    // Listen to real-time telemetry from Rust
    if (listen) {
      listen('live-telemetry', (event) => {
        if (event.payload) {
          latestTelemetry = event.payload;

          // Throttle event emission to 60fps requestAnimationFrame to prevent WebView2 thread lock
          if (!rafPending) {
            rafPending = true;
            requestAnimationFrame(() => {
              rafPending = false;
              window.tauriEventEmitter.emit('live', latestTelemetry);
              if (window.onLiveTelemetryUpdate) {
                try { window.onLiveTelemetryUpdate(latestTelemetry); } catch (e) {}
              }
            });
          }
        }
      });

      listen('flash-progress', (event) => {
        if (event.payload) {
          window.tauriEventEmitter.emit('flash_progress', event.payload);
          if (window.onFlashProgressUpdate) {
            try { window.onFlashProgressUpdate(event.payload); } catch (e) {}
          }
        }
      });
    }

    // Override fetch to route /api/* requests to Tauri commands
    const originalFetch = window.fetch;
    window.fetch = async function (url, options) {
      const urlStr = typeof url === 'string' ? url : (url.url || '');

      if (urlStr.includes('/api/status')) {
        try {
          const res = await invoke('get_status');
          return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
          return new Response(JSON.stringify({ connected: false, ecuConnected: false }), { status: 200 });
        }
      }

      if (urlStr.includes('/api/live')) {
        // Fast instant return from memory cache to prevent HTTP polling bottleneck
        return new Response(JSON.stringify(latestTelemetry), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/api/info')) {
        const res = await invoke('get_info');
        return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/api/ports') || urlStr.includes('/api/comm/ports')) {
        const ports = await invoke('get_ports');
        return new Response(JSON.stringify({ ports }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/api/connect')) {
        let body = {};
        if (options && options.body) {
          try { body = JSON.parse(options.body); } catch (e) {}
        }
        try {
          const res = await invoke('connect_ecu', { port: body.port || null });
          return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } catch (err) {
          return new Response(JSON.stringify({ error: String(err), code: 'CONNECT_ERROR' }), { status: 500 });
        }
      }

      if (urlStr.includes('/api/disconnect')) {
        const res = await invoke('disconnect_ecu');
        return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/api/sim/connect')) {
        const res = await invoke('sim_connect');
        return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/api/sim/disconnect')) {
        const res = await invoke('sim_disconnect');
        return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/api/read-dtc')) {
        try {
          const res = await invoke('read_dtc');
          return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } catch (err) {
          return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
        }
      }

      if (urlStr.includes('/api/clear-dtc')) {
        try {
          const res = await invoke('clear_dtc');
          return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } catch (err) {
          return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
        }
      }

      if (urlStr.includes('/api/ecu/read')) {
        let body = {};
        if (options && options.body) {
          try { body = JSON.parse(options.body); } catch (e) {}
        }
        const res = await invoke('start_flash_read', {
          readType: body.type || 'calibration',
          readSizeKb: body.readSize || 128
        });
        return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/api/ecu/write')) {
        let body = {};
        if (options && options.body) {
          try { body = JSON.parse(options.body); } catch (e) {}
        }
        const res = await invoke('start_flash_write', {
          writeType: body.type || 'calibration',
          autoBackup: body.autoBackup !== false,
          dryRun: body.dryRun === true,
          sourceHex: null
        });
        return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (urlStr.includes('/api/reset_flash_count')) {
        const res = await invoke('reset_flash_count');
        return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // Fallback to default fetch
      return originalFetch.apply(this, arguments);
    };

    // Full WebSocket polyfill supporting properties (onopen, onmessage, etc.) and addEventListener
    window.WebSocket = function FakeWebSocket(wsUrl) {
      console.log('[TauriBridge] Initializing FakeWebSocket for:', wsUrl);
      const self = this;
      this.readyState = 1; // 1 = OPEN
      this.URL = wsUrl;

      this.onopen = null;
      this.onmessage = null;
      this.onclose = null;
      this.onerror = null;

      const eventListeners = {
        message: [],
        open: [],
        close: [],
        error: []
      };

      this.addEventListener = function (type, listener) {
        if (eventListeners[type] && !eventListeners[type].includes(listener)) {
          eventListeners[type].push(listener);
        }
      };

      this.removeEventListener = function (type, listener) {
        if (eventListeners[type]) {
          eventListeners[type] = eventListeners[type].filter(l => l !== listener);
        }
      };

      this.send = function (data) {
        // No-op for client-to-server WS commands
      };

      this.close = function () {
        self.readyState = 3; // CLOSED
        if (self.onclose) self.onclose();
        eventListeners.close.forEach(fn => fn());
      };

      // Wire tauriEventEmitter to this WebSocket instance
      window.tauriEventEmitter.on('live', (data) => {
        const msgEvent = { data: JSON.stringify({ type: 'live', data }) };
        if (typeof self.onmessage === 'function') {
          try { self.onmessage(msgEvent); } catch (e) {}
        }
        eventListeners.message.forEach(fn => {
          try { fn(msgEvent); } catch (e) {}
        });
      });

      window.tauriEventEmitter.on('flash_progress', (data) => {
        const msgEvent = { data: JSON.stringify(data) };
        if (typeof self.onmessage === 'function') {
          try { self.onmessage(msgEvent); } catch (e) {}
        }
        eventListeners.message.forEach(fn => {
          try { fn(msgEvent); } catch (e) {}
        });
      });

      // Trigger open event after current tick
      setTimeout(() => {
        if (typeof self.onopen === 'function') {
          try { self.onopen(); } catch (e) {}
        }
        eventListeners.open.forEach(fn => {
          try { fn(); } catch (e) {}
        });
      }, 20);
    };

    window.WebSocket.OPEN = 1;
    window.WebSocket.CLOSED = 3;
  }
})();
