// ============================================================
// dtc.js - Diagnostic Trouble Codes UI
// ============================================================

const Diag = (() => {
  let _dtcs = [];

  function _renderTable() {
    const tbody = document.getElementById('dtc-tbody');
    if (!tbody) return;

    if (_dtcs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px">
        No DTCs found — Engine OK ✅</td></tr>`;
      const badge = document.getElementById('dtc-count-badge');
      if (badge) badge.textContent = '0';
      return;
    }

    tbody.innerHTML = _dtcs.map(d => {
      const isCurrent = d.milOn || d.occurrence === 'current';
      const codeBadge = isCurrent
        ? `<span class="badge-pill badge-danger">${d.code}</span>`
        : `<span class="badge-pill badge-warning">${d.code}</span>`;
      const milBadge = isCurrent
        ? '<span class="badge-pill badge-danger">⚠ MIL ON</span>'
        : '<span class="badge-pill badge-info">History</span>';
      const statusText = isCurrent
        ? '<span style="color:#ef4444;font-weight:700;">ACTIVE</span>'
        : '<span style="color:#888;">HISTORY</span>';
      return `<tr>
        <td>${codeBadge}</td>
        <td>${d.description || 'Unknown'}</td>
        <td>${milBadge}</td>
        <td>${statusText}</td>
      </tr>`;
    }).join('');

    const badge = document.getElementById('dtc-count-badge');
    if (badge) badge.textContent = _dtcs.length;
  }

  async function handleReadDTC() {
    const btn = document.getElementById('btn-read-dtc');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Scanning ECU...'; }
    try {
      const res = await API.readDTC();
      _dtcs = res.dtcs || [];
      _renderTable();
      
      // Show raw debug log if available
      const debugPanel = document.getElementById('dtc-debug-log');
      if (debugPanel && res.debug && res.debug.length > 0) {
        debugPanel.innerHTML = '<div style="font-size:11px;font-family:monospace;color:#8b8;max-height:200px;overflow-y:auto;padding:8px;background:#111;border-radius:6px;margin-top:12px;border:1px solid #333">' +
          '<div style="color:#6cf;font-weight:700;margin-bottom:4px">📡 K-Line DTC Raw Response Log:</div>' +
          res.debug.map(line => {
            const color = line.includes('Found DTC') ? '#f44' : line.includes('No response') ? '#666' : '#8b8';
            return `<div style="color:${color}">${line}</div>`;
          }).join('') +
          '</div>';
      } else if (debugPanel) {
        debugPanel.innerHTML = '';
      }
      
      App.toast('success', 'DTC Read', `Found ${_dtcs.length} code(s) — Scanned 32 pages`);
    } catch (e) {
      App.toast('error', 'Read DTC Failed', e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🔍 Read DTC'; }
    }
  }

  async function handleClearDTC() {
    if (!confirm('Clear all DTCs? This will erase fault history.')) return;
    const btn = document.getElementById('btn-clear-dtc');
    if (btn) { btn.disabled = true; btn.textContent = 'Clearing…'; }
    try {
      await API.clearDTC();
      _dtcs = [];
      _renderTable();
      App.toast('success', 'DTCs Cleared', 'All fault codes have been erased');
    } catch (e) {
      App.toast('error', 'Clear Failed', e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🗑 Clear DTC'; }
    }
  }

  function init() {
    const readBtn  = document.getElementById('btn-read-dtc');
    const clearBtn = document.getElementById('btn-clear-dtc');
    if (readBtn)  readBtn.addEventListener('click',  handleReadDTC);
    if (clearBtn) clearBtn.addEventListener('click', handleClearDTC);
    _renderTable();
  }

  return { init };
})();
