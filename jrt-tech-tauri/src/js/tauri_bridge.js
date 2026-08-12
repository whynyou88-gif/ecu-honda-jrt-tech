// ============================================================
// tauri_bridge.js — Frontend Adapter Layer for Tauri
// Intercepts API calls and routes them through Tauri invoke() & events
// ============================================================

(function () {
  'use strict';

  console.log('[TauriBridge] Initializing Tauri Frontend Bridge...');

  const isTauri = !!window.__TAURI_INTERNALS__ || !!window.__TAURI_IPC__ || !!window.__TAURI__;

  // Global event bus for WebSocket compatibility
  window.tauriEventEmitter = {
    listeners: {},
    on(event, fn) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(fn);
    },
    emit(event, data) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(fn => fn(data));
      }
    }
  };

  if (isTauri) {
    console.log('[TauriBridge] Running in Tauri environment!');

    // Import Tauri invoke
    const invoke = window.__TAURI_INTERNALS__ ? window.__TAURI_INTERNALS__.invoke : window.__TAURI__.core.invoke;
    const listen = window.__TAURI__ ? window.__TAURI__.event.listen : null;

    // Listen to real-time telemetry from Rust
    if (listen) {
      listen('live-telemetry', (event) => {
        window.tauriEventEmitter.emit('live', event.payload);
        if (window.onLiveTelemetryUpdate) {
          window.onLiveTelemetryUpdate(event.payload);
        }
      });

      listen('flash-progress', (event) => {
        window.tauriEventEmitter.emit('flash_progress', event.payload);
        if (window.onFlashProgressUpdate) {
          window.onFlashProgressUpdate(event.payload);
        }
      });
    }

    // Override fetch to route /api/* requests to Tauri commands
    const originalFetch = window.fetch;
    window.fetch = async function (url, options) {
      const urlStr = typeof url === 'string' ? url : (url.url || '');

      if (urlStr.includes('/api/status')) {
        const res = await invoke('get_status');
        return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
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

      // Fallback to default fetch for local static assets
      return originalFetch.apply(this, arguments);
    };

    // Polyfill WebSocket for existing JS components
    window.WebSocket = function (wsUrl) {
      console.log('[TauriBridge] Intercepted WebSocket connection to:', wsUrl);
      const fakeWs = {
        readyState: 1, // OPEN
        send: function (data) {},
        close: function () {},
        addEventListener: function (event, cb) {
          if (event === 'message') {
            window.tauriEventEmitter.on('live', (data) => {
              cb({ data: JSON.stringify({ type: 'live', data }) });
            });
            window.tauriEventEmitter.on('flash_progress', (data) => {
              cb({ data: JSON.stringify(data) });
            });
          }
        }
      };

      setTimeout(() => {
        if (fakeWs.onopen) fakeWs.onopen();
      }, 50);

      return fakeWs;
    };
  }
})();
