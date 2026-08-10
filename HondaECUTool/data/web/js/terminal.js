// ============================================================
// terminal.js - K-Line Manual Terminal + Logger
// ============================================================

const Terminal = (() => {
  let _history = [];
  let _autoScroll = true;
  let _logBuffer = [];

  function _appendLine(type, hex, ascii, ts) {
    const output = document.getElementById('terminal-output');
    if (!output) return;

    const colors = { TX: '#3b82f6', RX: '#22c55e', INFO: '#8a91a8', ERR: '#ef4444' };
    const div = document.createElement('div');
    div.style.cssText = `font-family:monospace;font-size:12px;padding:1px 0;color:${colors[type]||'#f0f2f8'}`;
    div.innerHTML =
      `<span style="color:var(--text-muted)">[${ts}]</span> ` +
      `<span style="font-weight:600">${type}</span> ` +
      `<span>${hex}</span>` +
      (ascii ? ` <span style="color:var(--text-secondary)">  ${ascii}</span>` : '');
    output.appendChild(div);

    _logBuffer.push({ ts, type, hex, ascii });
    if (_logBuffer.length > 500) _logBuffer.shift();

    if (_autoScroll) output.scrollTop = output.scrollHeight;
  }

  function _hexToAscii(hex) {
    return hex.split(' ')
      .map(b => {
        const c = parseInt(b, 16);
        return (c >= 32 && c < 127) ? String.fromCharCode(c) : '.';
      }).join('');
  }

  async function send() {
    const input = document.getElementById('terminal-input');
    if (!input) return;
    const raw = input.value.trim();
    if (!raw) return;

    const ts  = new Date().toLocaleTimeString('id', { hour12: false, fractionalSecondDigits: 3 });
    const hex = raw.toUpperCase().replace(/[^0-9A-F ]/gi, '').trim();

    _appendLine('TX', hex, _hexToAscii(hex), ts);
    _history.push(raw);
    input.value = '';

    try {
      const res = await API.klineSend(hex);
      const rxTs = new Date().toLocaleTimeString('id', { hour12: false, fractionalSecondDigits: 3 });
      if (res.status === 'ok' && res.rx) {
        _appendLine('RX', res.rx, _hexToAscii(res.rx), rxTs);
      } else {
        _appendLine('ERR', `Error code: ${res.code}`, '', rxTs);
      }
    } catch (e) {
      _appendLine('ERR', e.message, '', ts);
    }
  }

  function clear() {
    const output = document.getElementById('terminal-output');
    if (output) output.innerHTML = '';
    _logBuffer = [];
  }

  function exportTxt() {
    const lines = _logBuffer.map(e =>
      `[${e.ts}] ${e.type.padEnd(4)} ${e.hex}  ${e.ascii}`).join('\n');
    const filename = `terminal_${Date.now()}.txt`;
    
    if (window.pywebview && window.pywebview.api && window.pywebview.api.save_file) {
      window.pywebview.api.save_file(lines, filename)
        .then(res => {
          if (res.status === 'ok') {
            App.toast('success', 'Terminal Log Exported', `Saved successfully: ${res.path.split('/').pop()}`);
          } else if (res.status === 'error') {
            App.toast('danger', 'Export Failed', res.message);
          }
        })
        .catch(err => {
          App.toast('danger', 'Export Error', err.toString());
        });
    } else {
      const blob = new Blob([lines], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    }
  }

  async function loadServerLog() {
    try {
      const res = await API.log(100);
      const logs = res.logs || [];
      logs.forEach(l => {
        const ts = (l.ts / 1000).toFixed(3);
        _appendLine(l.level === 'ERR' ? 'ERR' : 'INFO',
                    `[${l.tag}] ${l.msg}`, '', ts);
      });
    } catch (e) {
      _appendLine('ERR', e.message, '', '0');
    }
  }

  // History navigation
  let _histIdx = -1;

  async function refreshPorts() {
    try {
      const res = await fetch('/api/comm/ports').then(r => r.json());
      const select = document.getElementById('comm-port-select');
      if (select && res.ports && res.ports.length > 0) {
        select.innerHTML = '';
        res.ports.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id || p.name;
          opt.textContent = `${p.name} [${p.type}] - ${p.description}`;
          select.appendChild(opt);
        });
      }
    } catch (e) {
      console.warn('[Terminal] Failed to fetch ports:', e);
    }
  }

  async function updateCommStats() {
    try {
      const st = await fetch('/api/comm/stats').then(r => r.json());
      const elHz = document.getElementById('comm-stat-hz');
      const elLat = document.getElementById('comm-stat-lat');
      const elLoss = document.getElementById('comm-stat-loss');

      if (elHz) elHz.textContent = `${st.sample_rate_hz || (st.connected ? 100.0 : 0.0)} Hz`;
      if (elLat) elLat.textContent = `${st.latency_ms || 1.5} ms`;
      if (elLoss) elLoss.textContent = `${st.packet_loss_count || 0} pkts`;
    } catch (e) {}
  }

  function init() {
    const sendBtn   = document.getElementById('btn-terminal-send');
    const clearBtn  = document.getElementById('btn-terminal-clear');
    const exportBtn = document.getElementById('btn-terminal-export');
    const autoSw    = document.getElementById('terminal-autoscroll');
    const loadBtn   = document.getElementById('btn-load-log');
    const input     = document.getElementById('terminal-input');

    if (sendBtn)   sendBtn.addEventListener('click', send);
    if (clearBtn)  clearBtn.addEventListener('click', clear);
    if (exportBtn) exportBtn.addEventListener('click', exportTxt);
    if (loadBtn)   loadBtn.addEventListener('click', loadServerLog);

    if (autoSw) {
      autoSw.addEventListener('change', () => { _autoScroll = autoSw.checked; });
    }

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { send(); _histIdx = -1; }
        if (e.key === 'ArrowUp') {
          if (_history.length === 0) return;
          _histIdx = Math.min(_histIdx + 1, _history.length - 1);
          input.value = _history[_history.length - 1 - _histIdx];
        }
        if (e.key === 'ArrowDown') {
          _histIdx = Math.max(_histIdx - 1, -1);
          input.value = _histIdx < 0 ? '' : _history[_history.length - 1 - _histIdx];
        }
      });
    }

    refreshPorts();
    setInterval(updateCommStats, 1000);

    // WS log stream
    API.onWS('message', (msg) => {
      if (msg.type === 'log' && msg.logs) {
        msg.logs.forEach(l => {
          _appendLine('INFO', `[${l.tag}] ${l.msg}`, '', (l.ts/1000).toFixed(3));
        });
      }
    });

    _appendLine('INFO', 'Terminal ready. Enter HEX bytes, e.g: 72 05 71 17 C0', '', '0.000');
  }

  return { init, send, clear, exportTxt, refreshPorts };
})();
