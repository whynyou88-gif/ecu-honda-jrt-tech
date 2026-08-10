// ============================================================
// filemanager.js - File & Storage Manager
// ============================================================

const FileManager = (function() {

  const tbody = document.getElementById('fm-file-list');
  const btnRefresh = document.getElementById('btn-fm-refresh');
  const btnLoadBuffer = document.getElementById('btn-fm-load-buffer');
  
  let selectedFile = null;

  function init() {
    if(!tbody || !btnRefresh) return;
    
    document.querySelector('[data-page="files"]').addEventListener('click', loadFiles);
    btnRefresh.addEventListener('click', loadFiles);
    
    if(btnLoadBuffer) {
      btnLoadBuffer.addEventListener('click', () => {
        if(!selectedFile) {
          App.toast('error', 'Select File', 'Please select a file first.');
          return;
        }
        
        API.loadBuffer(selectedFile)
          .then(res => {
            App.toast('success', 'Buffer Loaded', `${selectedFile} is now set as the active write buffer!`);
          })
          .catch(e => {
            App.toast('error', 'Load Buffer Failed', e.message);
          });
      });
    }
  }

  function loadFiles() {
    tbody.innerHTML = '<li style="padding:24px;text-align:center;color:var(--text-muted)"><i class="fa fa-spinner fa-spin"></i> Loading...</li>';
    
    API.files()
      .then(res => {
        tbody.innerHTML = '';
        selectedFile = null;
        
        if (!res.files || res.files.length === 0) {
          tbody.innerHTML = '<li style="padding:24px;text-align:center;color:var(--text-muted)">No files found in /backup</li>';
          return;
        }
        
        res.files.forEach(f => {
          const li = document.createElement('li');
          li.className = 'file-item';
          
          const kb = (f.size / 1024).toFixed(1);
          
          li.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px">
              <i class="fa fa-file-lines fa-2x" style="color:var(--primary)"></i>
              <div>
                <div style="font-weight:600">${f.name}</div>
                <div style="font-size:11px;color:var(--text-secondary)">Size: ${kb} KB</div>
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-secondary btn-sm btn-download" data-file="${f.name}" title="Download">
                <i class="fa fa-download"></i>
              </button>
              <button class="btn btn-danger btn-sm btn-del" data-file="${f.name}" title="Delete">
                <i class="fa fa-trash"></i>
              </button>
            </div>
          `;
          
          // Select behavior
          li.addEventListener('click', (e) => {
            if(e.target.closest('.btn') || e.target.closest('a')) return; // ignore buttons
            document.querySelectorAll('.file-item').forEach(el => el.style.background = '');
            li.style.background = 'rgba(255,255,255,0.05)';
            selectedFile = f.name;
          });
          
          // Delete behavior
          li.querySelector('.btn-del').addEventListener('click', () => {
            if (confirm(`Delete ${f.name}?`)) {
              deleteFile(f.name);
            }
          });

          // Download behavior
          li.querySelector('.btn-download').addEventListener('click', () => {
            downloadFile(f.name);
          });
          
          tbody.appendChild(li);
        });
      })
      .catch(e => {
        tbody.innerHTML = `<li style="padding:24px;text-align:center;color:var(--danger)">Error: ${e.message}</li>`;
      });
  }

  function deleteFile(name) {
    API.deleteBackup(name)
      .then(res => {
        App.toast('success', 'Deleted', `${name} removed.`);
        loadFiles();
      })
      .catch(e => {
        App.toast('error', 'Delete Failed', e.message);
      });
  }

  async function downloadFile(name) {
    try {
      App.toast('info', 'Downloading', `Fetching ${name}...`);
      const resp = await fetch(`/download?file=${encodeURIComponent(name)}`);
      if (!resp.ok) {
        let errMsg = `HTTP ${resp.status}`;
        try {
          const errJson = await resp.json();
          errMsg = errJson.error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      App.toast('success', 'Downloaded', `${name} saved (${(blob.size / 1024).toFixed(1)} KB)`);
    } catch (e) {
      App.toast('error', 'Download Failed', e.message);
    }
  }

  return { init, loadFiles };

})();
