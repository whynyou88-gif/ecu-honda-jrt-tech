// ============================================================
// flashui.js - Flash ECU User Interface
// ============================================================

const FlashUI = (function() {

  let isFlashing = false;
  let hasActiveBuffer = false;
  let progressWatchdogTimer = null;
  let _initialized = false;
  let _flashStartTime = 0;

  let btnReadCal = null;
  let btnReadFull = null;
  let btnWriteCal = null;
  let btnWriteFull = null;
  let btnRecover = null;

  function checkRawHexSafetyGuard() {
    if (typeof MapEditor !== 'undefined' && MapEditor.getMapData) {
      const data = MapEditor.getMapData();
      if (data && data.raw_hex_mode) {
        return confirm("⚠️ SAFETY WARNING (MODEL K60A / RAW MCU DUMP):\n\nFile ini belum memiliki offset table tervalidasi 100% untuk model K60A.\nMenulis file yang salah ke ECU berisiko membuat ECU tidak responsif (brick).\n\nApakah Anda yakin file ini benar dan berasal dari sumber terpercaya?");
      }
    }
    return true;
  }

  function startWriteCal() {
    hasActiveBuffer = true;
    if (!checkRawHexSafetyGuard()) return;
    if(confirm('WARNING: Anda akan menulis data kalibrasi ke ECU.\n\nPastikan tegangan aki stabil di atas 12V dan JANGAN melepas kabel K-Line.\n\nLanjutkan Flash Calibration?')) {
      startOperation('write', 'calibration');
    }
  }

  function startWriteFull() {
    hasActiveBuffer = true;
    if (!checkRawHexSafetyGuard()) return;
    if(confirm('⚠️ DANGER: Anda akan menulis SELURUH MEMORI FULL FLASH ke ECU.\n\nProses ini akan menimpa data immobilizer dan tabel peta mesin. Pastikan file terverifikasi.\n\nLanjutkan Write Full Flash?')) {
      startOperation('write', 'full');
    }
  }

  function startReadCal() {
    startOperation('read', 'calibration');
  }

  function startReadFull() {
    startOperation('read', 'full');
  }

  function startRecover() {
    if(confirm('⚠️ BOOTLOADER RECOVERY MODE:\n\nMemaksa penghapusan & penulisan firmware ke ECU yang terkunci/unresponsive.\n\nLanjutkan Recovery Flash?')) {
      startOperation('recovery', 'full');
    }
  }

  function init() {
    btnReadCal = document.getElementById('btn-flash-read-cal');
    btnReadFull = document.getElementById('btn-flash-read-full');
    btnWriteCal = document.getElementById('btn-flash-write-cal');
    btnWriteFull = document.getElementById('btn-flash-write-full');
    btnRecover = document.getElementById('btn-flash-recover');

    if (_initialized) {
      checkInitialConnection();
      return;
    }
    _initialized = true;

    if (typeof API !== 'undefined' && API.onWS) {
      API.onWS('flash_progress', handleWSEvent);
      API.onWS('status', handleWSEvent);
    }

    if (btnReadCal) btnReadCal.onclick = startReadCal;
    if (btnReadFull) btnReadFull.onclick = startReadFull;
    if (btnWriteCal) btnWriteCal.onclick = startWriteCal;
    if (btnWriteFull) btnWriteFull.onclick = startWriteFull;
    if (btnRecover) btnRecover.onclick = startRecover;


  }

  function getBaseUrl() {
    return (location.protocol === 'file:' || !location.host) ? 'http://127.0.0.1:8080' : '';
  }

  function handleFilePicked(e) {
    const picker = document.getElementById('flash-file-picker');
    const file = (e && e.target && e.target.files && e.target.files.length > 0) ? e.target.files[0] : (picker && picker.files ? picker.files[0] : null);
    if (!file) {
      console.warn('[FlashUI] handleFilePicked: No file selected');
      return;
    }

    console.log('[FlashUI] handleFilePicked: File selected:', file.name, file.size, 'bytes');

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'bin' && ext !== 'hex') {
      if (typeof App !== 'undefined' && App.toast) {
        App.toast('error', 'Invalid File', 'Only .bin and .hex files are accepted.');
      }
      if (picker) picker.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const label = document.getElementById('flash-active-file-label');
    if (label) {
      label.textContent = `Uploading: ${file.name} (${(file.size/1024).toFixed(1)} KB)...`;
    }
    if (typeof App !== 'undefined' && App.toast) {
      App.toast('info', 'Uploading BIN File', `Loading ${file.name}...`);
    }

    fetch(getBaseUrl() + '/api/buffer/upload', {
      method: 'POST',
      body: formData
    })
    .then(res => {
      console.log('[FlashUI] Upload response status:', res.status);
      return res.json();
    })
    .then(data => {
      console.log('[FlashUI] Upload response data:', JSON.stringify(data));
      if (data.status === 'ok') {
        hasActiveBuffer = true;
        if (label) {
          label.textContent = `Active Buffer: ${data.filename} (${(data.size/1024).toFixed(1)} KB) [Verified: OK]`;
          label.style.color = '#00E5FF';
        }
        if (typeof App !== 'undefined' && App.toast) {
          App.toast('success', 'BIN File Loaded', `Active write buffer set: ${data.filename}`);
        }
        setAllButtons(true);
        loadBufferList(data.filename);
      } else {
        hasActiveBuffer = false;
        if (label) {
          label.textContent = `Upload Failed: ${data.error || 'Unknown error'}`;
          label.style.color = '#ef4444';
        }
        if (typeof App !== 'undefined' && App.toast) {
          App.toast('error', 'Upload Failed', data.error || 'Unknown error');
        }
      }
    })
    .catch(err => {
      console.error('[FlashUI] Upload fetch error:', err);
      hasActiveBuffer = false;
      if (label) {
        label.textContent = `Upload Error: ${err.message}`;
        label.style.color = '#ef4444';
      }
      if (typeof App !== 'undefined' && App.toast) {
        App.toast('error', 'Upload Error', err.message);
      }
    });
  }

  function loadBufferList(justUploadedFilename) {
    fetch(getBaseUrl() + '/api/buffer/list')
      .then(res => res.json())
      .then(data => {
        if (data && data.status === 'ok') {
          // Use justUploadedFilename if provided, otherwise fall back to server's activeBuffer
          const effectiveActive = justUploadedFilename || data.activeBuffer || '';

          const sel = document.getElementById('flash-buffer-select');
          if (sel) {
            sel.innerHTML = '<option value="">-- Choose BIN File from Server Buffer --</option>';
            if (data.files && data.files.length > 0) {
              data.files.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.filename;
                opt.textContent = `${f.filename} (${f.size_kb} KB)`;
                if (effectiveActive === f.filename) opt.selected = true;
                sel.appendChild(opt);
              });
            }
          }
          if (effectiveActive) {
            hasActiveBuffer = true;
            const label = document.getElementById('flash-active-file-label');
            if (label) {
              label.textContent = `Active Buffer: ${effectiveActive} [Verified: OK]`;
              label.style.color = '#00E5FF';
            }
            setAllButtons(true);
          }
        }
      })
      .catch(err => console.error('Error loading buffer list:', err));
  }

  function selectBufferFile(filename) {
    if (!filename) return;
    fetch(getBaseUrl() + '/api/buffer/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: filename })
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === 'ok') {
        hasActiveBuffer = true;
        const label = document.getElementById('flash-active-file-label');
        if (label) {
          label.textContent = `Active Buffer: ${filename} [Verified: OK]`;
          label.style.color = '#00E5FF';
        }
        if (typeof App !== 'undefined' && App.toast) {
          App.toast('success', 'BIN Buffer Selected', `Set active write buffer: ${filename}`);
        }
        setAllButtons(true);
      } else {
        if (typeof App !== 'undefined' && App.toast) {
          App.toast('error', 'Select Buffer Error', data.error || 'Failed to set active buffer');
        }
      }
    })
    .catch(err => {
      if (typeof App !== 'undefined' && App.toast) {
        App.toast('error', 'Select Buffer Error', err.message);
      }
    });
  }

  function browseFile(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    if (window.pywebview && window.pywebview.api) {
      const fn = window.pywebview.api.open_bin_for_flash || window.pywebview.api.open_file;
      if (typeof fn === 'function') {
        fn.call(window.pywebview.api)
          .then(res => {
            console.log('[FlashUI] browseFile res:', res);
            if (res && res.status === 'ok' && res.filename) {
              const label = document.getElementById('flash-active-file-label');
              hasActiveBuffer = true;
              const szKB = res.size ? (res.size / 1024).toFixed(1) : '32.0';
              if (label) {
                label.textContent = `Active Buffer: ${res.filename} (${szKB} KB) [Verified: OK]`;
                label.style.color = '#00E5FF';
              }
              if (typeof App !== 'undefined' && App.toast) {
                App.toast('success', 'BIN File Loaded', `Active write buffer set: ${res.filename}`);
              }
              setAllButtons(true);
              loadBufferList(res.filename);
            } else if (res && res.status === 'error') {
              if (typeof App !== 'undefined' && App.toast) {
                App.toast('error', 'File Open Error', res.message || 'Error opening file');
              }
            }
          })
          .catch(err => {
            console.error('[FlashUI] PyWebView dialog error:', err);
            triggerHTMLPicker();
          });
        return;
      }
    }

    triggerHTMLPicker();
  }

  function triggerHTMLPicker() {
    const picker = document.getElementById('flash-file-picker');
    if (picker) {
      picker.value = '';
      picker.click();
    }
  }
  
  function startOperation(action, type) {
    if(isFlashing) return;
    
    isFlashing = true;
    _flashStartTime = Date.now();
    showProgress();
    setAllButtons(false);
    
    let endpoint = '';
    const sizeSelect = document.getElementById('flash-read-size-select');
    const readSize = sizeSelect ? parseInt(sizeSelect.value, 10) : 128;
    let payload = { type: type, readSize: readSize };
    
    if (action === 'read') {
      endpoint = '/api/ecu/read';
    } else if (action === 'write') {
      endpoint = '/api/ecu/write';
      const chkDryRun = document.getElementById('chk-dry-run');
      const chkAutoBackup = document.getElementById('chk-auto-backup');
      payload.autoBackup = chkAutoBackup ? chkAutoBackup.checked : true;
      payload.dryRun = chkDryRun ? chkDryRun.checked : false;
      if (typeof MapEditor !== 'undefined' && MapEditor.getMapData) {
        payload.mapData = MapEditor.getMapData();
      }
    } else if (action === 'recovery') {
      endpoint = '/api/recovery';
      payload = { readSize: readSize };
    }
    
    API.request('POST', endpoint, payload)
      .then(res => {
        const msgEl = document.getElementById('flash-msg');
        if (msgEl) msgEl.textContent = 'Mempersiapkan respon perangkat ECU...';
      })
      .catch(e => {
        isFlashing = false;
        hideProgress();
        setAllButtons(true);
        App.toast('error', 'Operation Failed', e.message);
      });
  }
  
  function updateButtonStatesByConnection(isConnected) {
    if (isFlashing) return;

    const btnReadCal = document.getElementById('btn-flash-read-cal');
    const btnReadFull = document.getElementById('btn-flash-read-full');
    const btnWriteCal = document.getElementById('btn-flash-write-cal');
    const btnWriteFull = document.getElementById('btn-flash-write-full');
    const btnRecover = document.getElementById('btn-flash-recover');

    if (btnReadCal) btnReadCal.disabled = false;
    if (btnReadFull) btnReadFull.disabled = false;
    if (btnRecover) btnRecover.disabled = false;
    if (btnWriteCal) btnWriteCal.disabled = false;
    if (btnWriteFull) btnWriteFull.disabled = false;

    const actionButtons = document.querySelectorAll('#page-flash button');
    actionButtons.forEach(btn => {
      btn.classList.remove('btn-offline-disabled');
    });
  }

  function checkInitialConnection() {
    fetch(getBaseUrl() + '/api/status')
      .then(res => res.json())
      .then(st => {
        if (st && st.activeBuffer) {
          hasActiveBuffer = true;
          const label = document.getElementById('flash-active-file-label');
          if (label) {
            label.textContent = `Active Buffer: ${st.activeBuffer} [Verified: OK]`;
            label.style.color = '#00E5FF';
          }
        }
        if (st && st.flashCount !== undefined) {
          const fcEl = document.getElementById('flash-count-badge');
          if (fcEl) fcEl.textContent = `Total Reflashed: ${st.flashCount}x`;
          const fcCardEl = document.getElementById('flash-count-val');
          if (fcCardEl) fcCardEl.textContent = `${st.flashCount}x`;
        }
        updateButtonStatesByConnection(true);
        loadBufferList();
      })
      .catch(() => {
        updateButtonStatesByConnection(true);
        loadBufferList();
      });
  }

  function startWatchdog() {
    clearWatchdog();
    progressWatchdogTimer = setTimeout(() => {
      if (isFlashing) {
        isFlashing = false;
        if (typeof App !== 'undefined' && App.toast) {
          App.toast('error', 'Flash Timeout', 'Tidak ada pembaruan progress selama 180 detik. Operasi dibatalkan demi keamanan. Jika ECU sedang proses erase/write, JANGAN matikan kontak.');
        }
        setTimeout(() => {
          hideProgress();
          checkInitialConnection();
        }, 3000);
      }
    }, 180000);
  }

  function clearWatchdog() {
    if (progressWatchdogTimer) {
      clearTimeout(progressWatchdogTimer);
      progressWatchdogTimer = null;
    }
  }

  function handleWSEvent(data) {
    if(!data) return;
    
    if(data.type === 'status' || data.connected !== undefined || data.ecu_connected !== undefined) {
      const connected = !!(data.connected || data.ecuConnected || data.ecu_connected || data.ecuState === 2);
      updateButtonStatesByConnection(connected);
    }

    if (data.flashCount !== undefined) {
      const fcEl = document.getElementById('flash-count-badge');
      if (fcEl) fcEl.textContent = `Total Reflashed: ${data.flashCount}x`;
      const fcCardEl = document.getElementById('flash-count-val');
      if (fcCardEl) fcCardEl.textContent = `${data.flashCount}x`;
    }

    if(data.type !== 'flash_progress') return;
    
    const pct = Math.min(100, Math.max(0, data.percent || 0));
    const msg = data.msg || '';
    const speed = data.speed || 0;
    let etaSeconds = data.eta || 0;
    const state = data.state; // IDLE, ERASING, WRITING, READING, VERIFYING, DONE, ERROR
    
    if(!isFlashing && state !== 'IDLE' && state !== 'DONE' && state !== 'ERROR') {
      isFlashing = true;
      _flashStartTime = Date.now();
      showProgress();
      setAllButtons(false);
    }
    
    startWatchdog();

    // Calculate dynamic ETA mathematically if backend ETA is zero
    if ((!etaSeconds || etaSeconds <= 0) && pct > 0 && pct < 100 && _flashStartTime > 0) {
      const elapsedMs = Date.now() - _flashStartTime;
      const totalEstimatedMs = (elapsedMs / pct) * 100;
      etaSeconds = Math.max(0, Math.round((totalEstimatedMs - elapsedMs) / 1000));
    }

    let etaText = 'Estimasi Selesai: Menghitung...';
    if (etaSeconds > 0) {
      const min = Math.floor(etaSeconds / 60);
      const sec = Math.floor(etaSeconds % 60);
      etaText = `Estimasi Selesai: ${min > 0 ? min + ' m ' : ''}${sec.toString().padStart(2, '0')} detik`;
    } else if (pct >= 100 || state === 'DONE') {
      etaText = 'Proses Selesai 100%';
    }

    let speedText = '-- KB/s';
    if (speed > 0) {
      speedText = `Kecepatan: ${(speed / 1024).toFixed(1)} KB/s`;
    }

    // Update Inline Progress Box
    const progressText = document.getElementById('flash-status-text');
    const progressBar = document.getElementById('flash-progress-bar');
    const progressMsg = document.getElementById('flash-msg');
    const progressSpeed = document.getElementById('flash-speed');
    const progressEta = document.getElementById('flash-eta');

    if (progressText) progressText.textContent = `STATUS: ${state}`;
    if (progressBar) progressBar.style.width = (state === 'DONE' ? '100%' : (pct + '%'));
    if (progressMsg) progressMsg.textContent = msg;
    if (progressSpeed) progressSpeed.textContent = speedText;
    if (progressEta) progressEta.textContent = etaText;
    const pctBadge = document.getElementById('flash-progress-pct-badge');
    if (pctBadge) pctBadge.textContent = Math.round(pct) + '%';

    // Update Modal Overlay Elements
    const modalPct = document.getElementById('modal-flash-pct');
    if (modalPct) modalPct.textContent = Math.round(pct) + '%';
    const modalBar = document.getElementById('modal-flash-progress-bar');
    if (modalBar) modalBar.style.width = (state === 'DONE' ? '100%' : (pct + '%'));
    const modalEta = document.getElementById('modal-flash-eta');
    if (modalEta) modalEta.textContent = etaText;
    const modalSpeed = document.getElementById('modal-flash-speed');
    if (modalSpeed) modalSpeed.textContent = speedText;
    const modalStatus = document.getElementById('modal-flash-status-text');
    if (modalStatus) modalStatus.textContent = `PROSES: ${state}`;
    const modalMsg = document.getElementById('modal-flash-msg');
    if (modalMsg) modalMsg.textContent = msg;
    
    if(state === 'DONE' || state === 'ERROR') {
      clearWatchdog();
      isFlashing = false;
      checkInitialConnection();
      
      if(state === 'DONE') {
        App.toast('success', 'Flash Operation', 'Proses Flashing ECU Selesai 100% Sempurna!');
        if(msg.includes('Read')) {
          if(btnWriteCal) btnWriteCal.disabled = !hasActiveBuffer;
          if(btnWriteFull) btnWriteFull.disabled = !hasActiveBuffer;
        }
      } else {
        App.toast('error', 'Flash Error', msg || 'Gagal melakukan flash ke ECU.');
      }
      
      setTimeout(() => {
        if(!isFlashing) hideProgress();
      }, 3000);
    }
  }
  
  function showProgress() {
    _flashStartTime = Date.now();
    const progressBox = document.getElementById('flash-progress-box');
    if(progressBox) {
      progressBox.style.display = 'block';
    }
    const modal = document.getElementById('modal-flash-progress-backdrop');
    if (modal) modal.style.display = 'flex';
  }
  
  function hideProgress() {
    const progressBox = document.getElementById('flash-progress-box');
    if(progressBox) progressBox.style.display = 'none';
    const modal = document.getElementById('modal-flash-progress-backdrop');
    if (modal) modal.style.display = 'none';
  }
  
  function setAllButtons(enable) {
    const btnReadCal = document.getElementById('btn-flash-read-cal');
    const btnReadFull = document.getElementById('btn-flash-read-full');
    const btnWriteCal = document.getElementById('btn-flash-write-cal');
    const btnWriteFull = document.getElementById('btn-flash-write-full');
    const btnRecover = document.getElementById('btn-flash-recover');

    if(btnReadCal) { btnReadCal.disabled = !enable; btnReadCal.classList.remove('btn-offline-disabled'); }
    if(btnReadFull) { btnReadFull.disabled = !enable; btnReadFull.classList.remove('btn-offline-disabled'); }
    if(btnWriteCal) { btnWriteCal.disabled = !enable; btnWriteCal.classList.remove('btn-offline-disabled'); }
    if(btnWriteFull) { btnWriteFull.disabled = !enable; btnWriteFull.classList.remove('btn-offline-disabled'); }
    if(btnRecover) { btnRecover.disabled = !enable; btnRecover.classList.remove('btn-offline-disabled'); }

    const actionButtons = document.querySelectorAll('#page-flash button');
    actionButtons.forEach(btn => {
      btn.classList.remove('btn-offline-disabled');
      if (enable) btn.removeAttribute('disabled');
    });
  }
  
  function readEEPROM() {
    App.toast('info', 'EEPROM Read', 'Reading EEPROM parameters...');
    API.request('POST', '/api/eeprom/read', {})
      .then(res => {
        App.toast('success', 'EEPROM Read Success', `Saved to ${res.filename} (${res.size} bytes)`);
      })
      .catch(err => {
        App.toast('error', 'EEPROM Read Failed', err.message);
      });
  }

  function writeEEPROM() {
    if(!confirm('Write EEPROM configuration to ECU? Ensure battery voltage is stable.')) return;
    App.toast('info', 'EEPROM Write', 'Writing EEPROM parameters...');
    API.request('POST', '/api/eeprom/write', {})
      .then(res => {
        App.toast('success', 'EEPROM Write Success', res.message || 'Written successfully.');
      })
      .catch(err => {
        App.toast('error', 'EEPROM Write Failed', err.message);
      });
  }

  function resetFlashCounter() {
    if(!confirm('Reset flash write counter back to 0?')) return;
    API.request('POST', '/api/reset_flash_count', {})
      .then(res => {
        const fcEl = document.getElementById('flash-count-badge');
        if (fcEl) fcEl.textContent = 'Total Reflashed: 0x';
        const fcCardEl = document.getElementById('flash-count-val');
        if (fcCardEl) fcCardEl.textContent = '0x';
        if (typeof App !== 'undefined' && App.toast) {
          App.toast('success', 'Flash Counter Reset', res.message || 'Counter reset to 0.');
        }
      })
      .catch(err => {
        if (typeof App !== 'undefined' && App.toast) {
          App.toast('error', 'Reset Counter Failed', err.message);
        }
      });
  }

  function readSmartKey() {
    API.request('POST', '/api/smartkey', { action: 'read' })
      .then(res => {
        const input = document.getElementById('input-smartkey-id');
        if(input) input.value = res.key_id || '4A-88-1B-9C';
        App.toast('success', 'SmartKey ID Read', `Key ID: ${res.key_id}`);
      })
      .catch(err => {
        App.toast('error', 'SmartKey Read Failed', err.message);
      });
  }

  function renewSmartKey() {
    const input = document.getElementById('input-smartkey-id');
    const newKey = input ? input.value : '';
    if(!confirm(`Register/Renew SmartKey ID Key: "${newKey || 'NEW-KEY'}"?`)) return;
    API.request('POST', '/api/smartkey', { action: 'renew', key_id: newKey })
      .then(res => {
        App.toast('success', 'SmartKey Renewed', `Registered ID: ${res.key_id}`);
      })
      .catch(err => {
        App.toast('error', 'SmartKey Renew Failed', err.message);
      });
  }

  function resetECU() {
    if(!confirm('Perform ECU Soft Reset / Reboot?')) return;
    API.request('POST', '/api/reset_ecu', {})
      .then(res => {
        App.toast('success', 'ECU Soft Reset', 'ECU session reset successfully.');
      })
      .catch(err => {
        App.toast('error', 'ECU Reset Failed', err.message);
      });
  }

  return {
    init: function() {
      init();
      checkInitialConnection();
      loadBufferList();
    },
    handleWSEvent,
    updateButtonStatesByConnection,
    readEEPROM,
    writeEEPROM,
    resetFlashCounter,
    readSmartKey,
    renewSmartKey,
    resetECU,
    startWriteCal,
    startWriteFull,
    startReadCal,
    startReadFull,
    startRecover,
    browseFile,
    handleFilePicked,
    loadBufferList,
    selectBufferFile
  };

})();

// Alias FlashUI and Flash for global inline onclick event access
window.FlashUI = FlashUI;
window.Flash = FlashUI;
document.addEventListener('DOMContentLoaded', () => {
  if (window.FlashUI && window.FlashUI.init) window.FlashUI.init();
});
