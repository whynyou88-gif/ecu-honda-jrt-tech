// ============================================================
// mapeditor.js - ANALIST Pro 3.4 Tuning Engine & 3D Surface Graph
// ============================================================

const MapEditor = (function() {
  
  let currentMap = "22 VARIO 125 KZRA-601";
  let mapData = null; // { name, type, cols, rows, rowLabels, colLabels, values }
  
  // Default Sample Fuel Map Data (16 Cols x 16 Rows) for Vario 125 KZRA-601
  const defaultCols = [0, 1.2, 2.5, 4.0, 6.5, 10.0, 15.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0];
  const defaultRows = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000];

  // Proposed 32x32 Grid Axes
  const defaultCols32 = [
    0, 0.5, 0.8, 1.2, 1.6, 2.0, 2.5, 3.0, 3.5, 4.0,
    4.8, 5.6, 6.5, 8.0, 10.0, 12.5, 15.0, 17.5, 20.0, 25.0,
    30.0, 35.0, 40.0, 45.0, 50.0, 55.0, 60.0, 65.0, 70.0, 80.0,
    90.0, 100.0
  ];
  const defaultRows32 = [
    1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3250,
    3500, 3750, 4000, 4250, 4500, 4750, 5000, 5500, 6000, 6500,
    7000, 7500, 8000, 8500, 9000, 9500, 10000, 10500, 11000, 11500,
    12000, 12500
  ];

  // TunerPro RT Inspired Parameter Tree Definition
  const PARAMETER_TREE = [
    {
      category: "Fuel / Injection",
      icon: "fa-droplet",
      items: [
        { id: "mainFuelMap", name: "Main Fuel Map", type: "2d", defaultVal: 2.0, min: 0.5, max: 5.0, unit: "ms" },
        { id: "fuelColdStart", name: "Fuel Map (Cold Start)", type: "2d", defaultVal: 2.5, min: 0.5, max: 5.0, unit: "ms" },
        { id: "fuelTrim", name: "Fuel Trim", type: "2d", defaultVal: 1.0, min: 0.5, max: 2.0, unit: "ratio" }
      ]
    },
    {
      category: "Ignition",
      icon: "fa-bolt",
      items: [
        { id: "ignitionTimingComfort", name: "Ignition Timing (Comfort)", type: "2d", defaultVal: 15.0, min: -10.0, max: 45.0, unit: "°" },
        { id: "ignitionTimingSport", name: "Ignition Timing (Sport)", type: "2d", defaultVal: 18.0, min: -10.0, max: 45.0, unit: "°" },
        { id: "ignitionTimingSportPlus", name: "Ignition Timing (Sport+)", type: "2d", defaultVal: 20.0, min: -10.0, max: 45.0, unit: "°" }
      ]
    },
    {
      category: "Limiters",
      icon: "fa-gauge-simple-high",
      items: [
        { id: "revLimiterSoft", name: "Rev Limiter (soft cut)", type: "1d", cols: 1, rows: 1, colLabels: ["Limit"], rowLabels: ["RPM"], defaultVal: 10500, min: 2000, max: 16000, unit: "RPM" },
        { id: "revLimiterHard", name: "Rev Limiter (hard cut)", type: "1d", cols: 1, rows: 1, colLabels: ["Limit"], rowLabels: ["RPM"], defaultVal: 10800, min: 2000, max: 16000, unit: "RPM" },
        { id: "fuelRpmLimiter", name: "Fuel RPM Limiter", type: "1d", cols: 1, rows: 1, colLabels: ["Limit"], rowLabels: ["RPM"], defaultVal: 11000, min: 2000, max: 16000, unit: "RPM" },
        { id: "ignitionRpmOffset", name: "Ignition RPM Offset", type: "2d", defaultVal: 0.0, min: -15.0, max: 15.0, unit: "°" }
      ]
    },
    {
      category: "Idle & Warm Up",
      icon: "fa-temperature-half",
      items: [
        { id: "idleSetting", name: "Idle Setting", type: "2d", defaultVal: 1400.0, min: 800.0, max: 3000.0, unit: "RPM" },
        { id: "warmUpEnrichment", name: "Warm Up Enrichment", type: "2d", defaultVal: 1.2, min: 0.8, max: 2.5, unit: "ratio" }
      ]
    },
    {
      category: "Electronic Throttle",
      icon: "fa-code-branch",
      items: [
        { id: "etvMap1", name: "ETV Map 1", type: "2d", defaultVal: 50.0, min: 0.0, max: 100.0, unit: "%" },
        { id: "etvMap2", name: "ETV Map 2", type: "2d", defaultVal: 50.0, min: 0.0, max: 100.0, unit: "%" }
      ]
    },
    {
      category: "Presets / Special",
      icon: "fa-wand-magic-sparkles",
      items: [
        { id: "presetHelicopter", name: "Helicopter Idle", type: "preset", action: "helicopter" },
        { id: "presetRotary", name: "Rotary Idle", type: "preset", action: "rotary" },
        { id: "presetPopBang", name: "Pop & Bangs", type: "preset", action: "popbang" },
        { id: "presetLaunch", name: "Launch Control", type: "preset", action: "launch" },
        { id: "presetCutLock", name: "Cut Lock (10.5k)", type: "preset", action: "cutlock" }
      ]
    }
  ];

  let collapsedCategories = {};
  let mapHistory = {}; // Scoped per active map table

  const VERIFIED_HEX_OFFSETS = {
    'revLimiterSoft': { offset: 0x018E14, label: '0x018E14' },
    'revLimiterHard': { offset: 0x018ED6, label: '0x018ED6' },
    'mainFuelMap': { offset: 0x0190EE, label: '0x0190EE' }
  };

  function renderParameterTree() {
    const container = document.getElementById('parameter-tree-container');
    if (!container) return;

    const searchInput = document.getElementById('tree-search-input');
    const filterText = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let html = '';

    PARAMETER_TREE.forEach((cat, catIdx) => {
      const filteredItems = cat.items.filter(item => 
        item.name.toLowerCase().includes(filterText)
      );

      if (filterText && filteredItems.length === 0) return;

      const isCollapsed = collapsedCategories[cat.category] || false;
      const arrowClass = isCollapsed ? 'fa-chevron-left collapsed' : 'fa-chevron-down';
      const itemsCollapseClass = isCollapsed ? 'collapsed' : '';
      const headerCollapseClass = isCollapsed ? 'collapsed' : '';

      html += `<div class="tree-category">
                <div class="tree-category-header ${headerCollapseClass}" data-cat="${cat.category}">
                  <i class="fa ${cat.icon || 'fa-folder'}"></i>
                  <span>${cat.category}</span>
                  <i class="fa ${arrowClass} arrow-icon"></i>
                </div>
                <div class="tree-category-items ${itemsCollapseClass}">`;

      const itemsToRender = filterText ? filteredItems : cat.items;
      itemsToRender.forEach(item => {
        const isRawHex = mapData && mapData.raw_hex_mode;
        const verifiedInfo = isRawHex ? VERIFIED_HEX_OFFSETS[item.id] : null;
        
        let iconHtml = `<i class="fa ${item.type === 'preset' ? 'fa-wand-magic-sparkles' : 'fa-table'}"></i>`;
        let badgeHtml = '';
        let itemStyle = 'display:flex; align-items:center;';

        if (isRawHex) {
          if (verifiedInfo) {
            iconHtml = `<i class="fa fa-circle-check" style="color:#22c55e; margin-right:6px;"></i>`;
            badgeHtml = `<span style="font-size:10px; color:#22c55e; background:rgba(34, 197, 94, 0.12); border:1px solid rgba(34, 197, 94, 0.3); padding:1px 5px; border-radius:3px; margin-left:auto; font-family:monospace;">${verifiedInfo.label}</span>`;
            itemStyle += 'color:#fff; font-weight:600; cursor:pointer;';
          } else {
            iconHtml = `<i class="fa fa-lock" style="color:#737373; margin-right:6px;"></i>`;
            badgeHtml = `<span style="font-size:10px; color:#a3a3a3; background:#262626; padding:1px 5px; border-radius:3px; margin-left:auto;">Belum tersedia</span>`;
            itemStyle += 'color:#737373; opacity:0.6; cursor:pointer;';
          }
        }

        const isActive = mapData && mapData.activeTable === item.id;
        const activeClass = isActive ? 'active' : '';
        html += `<div class="tree-item ${activeClass}" data-id="${item.id}" data-type="${item.type}" style="${itemStyle}">
                  ${iconHtml}
                  <span>${item.name}</span>
                  ${badgeHtml}
                </div>`;
      });

      html += `  </div>
              </div>`;
    });

    container.innerHTML = html;

    // Attach click listeners
    container.querySelectorAll('.tree-category-header').forEach(header => {
      header.addEventListener('click', (e) => {
        e.stopPropagation();
        const cat = header.getAttribute('data-cat');
        collapsedCategories[cat] = !collapsedCategories[cat];
        renderParameterTree();
      });
    });

    container.querySelectorAll('.tree-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = item.getAttribute('data-id');
        const type = item.getAttribute('data-type');

        if (mapData && mapData.raw_hex_mode) {
          const verifiedInfo = VERIFIED_HEX_OFFSETS[id];
          const rawItemName = item.querySelector('span')?.textContent || id;
          const cleanName = rawItemName.replace('Belum tersedia', '').trim();

          if (verifiedInfo) {
            jumpToHexOffset(verifiedInfo.offset);
            App.toast('success', 'Parameter Terverifikasi', `Melompat ke offset ${cleanName} (0x${verifiedInfo.offset.toString(16).toUpperCase()})`);
          } else {
            App.toast('warning', 'Belum Tersedia', `Offset untuk [${cleanName}] belum teridentifikasi. Lihat panel Detected Parameters atau gunakan Jump to Offset untuk eksplorasi manual.`);
          }
          return;
        }

        if (type === 'preset') {
          const presetItem = PARAMETER_TREE.flatMap(c => c.items).find(i => i.id === id);
          if (presetItem && presetItem.action) {
            applyMapPreset(presetItem.action);
          }
          return;
        }

        switchTable(id);
      });
    });
  }

  function switchTable(id) {
    if (!mapData) return;
    if (mapData.raw_hex_mode) {
      renderHexViewerMode(mapData);
      return;
    }

    // Auto-save current state
    localStorage.setItem('map_' + mapData.name, JSON.stringify(mapData));

    let foundItem = null;
    let categoryName = "";
    for (const cat of PARAMETER_TREE) {
      const item = cat.items.find(i => i.id === id);
      if (item) {
        foundItem = item;
        categoryName = cat.category;
        break;
      }
    }

    if (!foundItem) return;

    // Ensure array for this table exists in mapData
    if (!mapData[id]) {
      const is32 = mapData.cols === 32;
      const size = is32 ? 32 : 16;
      if (foundItem.type === '1d') {
        const cols = foundItem.cols || 1;
        const rows = foundItem.rows || 1;
        mapData[id] = Array(rows).fill().map(() => Array(cols).fill(foundItem.defaultVal));
      } else {
        const tableType = (id.toLowerCase().includes('ignition') || id.toLowerCase().includes('timing')) ? 'ignition' : 'fuel';
        mapData[id] = generateDefaultValues(mapData.name, tableType, size);
      }
    }

    // Save previous history pos
    if (mapData.activeTable) {
      if (!mapHistory[mapData.activeTable]) {
        mapHistory[mapData.activeTable] = { history: [], pos: -1 };
      }
      mapHistory[mapData.activeTable].history = history;
      mapHistory[mapData.activeTable].pos = historyPos;
    }

    mapData.activeTable = id;
    mapData.values = mapData[id];

    // Synchronize to original fuelValues/ignitionValues for backwards compatibility
    const tableType = (id.toLowerCase().includes('ignition') || id.toLowerCase().includes('timing')) ? 'ignition' : 'fuel';
    if (tableType === 'ignition') {
      mapData.ignitionValues = mapData[id];
    } else {
      mapData.fuelValues = mapData[id];
    }

    // Load new history pos
    if (!mapHistory[id]) {
      mapHistory[id] = { history: [], pos: -1 };
    }
    history = mapHistory[id].history;
    historyPos = mapHistory[id].pos;

    if (history.length === 0) {
      saveHistory();
    }

    // Update Breadcrumb/Title above grid
    updateTableBreadcrumb(categoryName, foundItem);

    // Re-render
    selectedCells = [];
    renderHeatmapTable();
    renderParameterTree();
    if (modalGraph3D && modalGraph3D.style.display !== 'none') renderPlotly3D();
  }

  function updateTableBreadcrumb(categoryName, item) {
    const el = document.getElementById('analist-table-breadcrumb');
    if (!el) return;
    const unitText = item.unit ? ` <span class="bc-unit">Unit: ${item.unit}</span>` : '';
    el.innerHTML = `<span class="bc-parent">${categoryName}</span> &gt; <span class="bc-child">${item.name}</span>${unitText}`;
  }

  function initializeMapDataParameters(mapObj) {
    if (!mapObj) return;

    const is32 = (mapObj.cols === 32 || (mapObj.values && mapObj.values[0] && mapObj.values[0].length === 32));
    const size = is32 ? 32 : 16;

    PARAMETER_TREE.forEach(cat => {
      cat.items.forEach(item => {
        if (item.type === 'preset') return;

        if (!mapObj[item.id]) {
          if (item.id === 'mainFuelMap' && mapObj.fuelValues) {
            mapObj.mainFuelMap = JSON.parse(JSON.stringify(mapObj.fuelValues));
          } else if (item.id === 'ignitionTimingComfort' && mapObj.ignitionValues) {
            mapObj.ignitionTimingComfort = JSON.parse(JSON.stringify(mapObj.ignitionValues));
          } else if (item.type === '1d') {
            const cols = item.cols || 1;
            const rows = item.rows || 1;
            mapObj[item.id] = Array(rows).fill().map(() => Array(cols).fill(item.defaultVal));
          } else {
            const tableType = (item.id.toLowerCase().includes('ignition') || item.id.toLowerCase().includes('timing')) ? 'ignition' : 'fuel';
            mapObj[item.id] = generateDefaultValues(mapObj.name, tableType, size);
          }
        }
      });
    });

    if (!mapObj.fuelValues) {
      mapObj.fuelValues = mapObj.mainFuelMap;
    }
    if (!mapObj.ignitionValues) {
      mapObj.ignitionValues = mapObj.ignitionTimingComfort;
    }

    if (!mapObj.activeTable || mapObj.activeTable === 'fuel' || mapObj.activeTable === 'ignition') {
      mapObj.activeTable = mapObj.activeTable === 'ignition' ? 'ignitionTimingComfort' : 'mainFuelMap';
    }

    mapObj.values = mapObj[mapObj.activeTable];
  }

  // 2D Bilinear Interpolation helper to scale maps
  function interpolate2DGrid(oldRows, oldCols, oldValues, newRows, newCols) {
    let newValues = [];
    for (let r = 0; r < newRows.length; r++) {
      let rowVals = [];
      let targetY = newRows[r];
      for (let c = 0; c < newCols.length; c++) {
        let targetX = newCols[c];
        
        // Find surrounding row indices in old grid
        let r0 = 0;
        for (let i = 0; i < oldRows.length; i++) {
          if (oldRows[i] <= targetY) r0 = i;
        }
        let r1 = oldRows.length - 1;
        for (let i = oldRows.length - 1; i >= 0; i--) {
          if (oldRows[i] >= targetY) r1 = i;
        }

        // Find surrounding column indices in old grid
        let c0 = 0;
        for (let i = 0; i < oldCols.length; i++) {
          if (oldCols[i] <= targetX) c0 = i;
        }
        let c1 = oldCols.length - 1;
        for (let i = oldCols.length - 1; i >= 0; i--) {
          if (oldCols[i] >= targetX) c1 = i;
        }

        let val;
        if (r0 === r1 && c0 === c1) {
          val = oldValues[r0][c0];
        } else if (r0 === r1) {
          let tX = (targetX - oldCols[c0]) / (oldCols[c1] - oldCols[c0] || 1);
          val = oldValues[r0][c0] + (oldValues[r0][c1] - oldValues[r0][c0]) * tX;
        } else if (c0 === c1) {
          let tY = (targetY - oldRows[r0]) / (oldRows[r1] - oldRows[r0] || 1);
          val = oldValues[r0][c0] + (oldValues[r1][c0] - oldValues[r0][c0]) * tY;
        } else {
          let tX = (targetX - oldCols[c0]) / (oldCols[c1] - oldCols[c0] || 1);
          let tY = (targetY - oldRows[r0]) / (oldRows[r1] - oldRows[r0] || 1);
          let v00 = oldValues[r0][c0];
          let v01 = oldValues[r0][c1];
          let v10 = oldValues[r1][c0];
          let v11 = oldValues[r1][c1];
          let vRow0 = v00 + (v01 - v00) * tX;
          let vRow1 = v10 + (v11 - v10) * tX;
          val = vRow0 + (vRow1 - vRow0) * tY;
        }
        rowVals.push(parseFloat(val.toFixed(3)));
      }
      newValues.push(rowVals);
    }
    return newValues;
  }

  function generateDefaultValues(modelName = "", tableType = "fuel", size = null) {
    if (size === null) {
      size = (mapData && mapData.cols === 32) ? 32 : 16;
    }
    modelName = String(modelName || "");
    let scale = 1.0;
    let offset = 0.0;
    
    // Scale baseline maps based on selected model engine classes
    if (modelName.includes("BEAT") || modelName.includes("SCOOPY") || modelName.includes("K25") || modelName.includes("K16")) {
      scale = 0.82; // leaner for 110cc
      offset = -0.15;
    } else if (modelName.includes("150") || modelName.includes("K59") || modelName.includes("K15") || modelName.includes("K45")) {
      scale = 1.25; // richer for 150cc
      offset = 0.25;
    }
    
    let vals = [];
    if (tableType === "ignition") {
      // Ignition advance in degrees (e.g. 10 to 35 degrees)
      for(let r=0; r<16; r++) {
        let row = [];
        for(let c=0; c<16; c++) {
          let val = 10.0 + (r * 1.5) - (c * 0.4) + Math.cos(r/4)*2.0;
          if (val < 5.0) val = 5.0;
          if (val > 45.0) val = 45.0;
          row.push(parseFloat(val.toFixed(1)));
        }
        vals.push(row);
      }
    } else {
      // Fuel map injection pulse widths (ms)
      for(let r=0; r<16; r++) {
        let row = [];
        for(let c=0; c<16; c++) {
          let base = (1.2 + (r * 0.12) + (c * 0.08) + Math.sin(r/3)*0.2) * scale + offset;
          if (base < 0.8) base = 0.8;
          row.push(parseFloat(base.toFixed(3)));
        }
        vals.push(row);
      }
    }

    if (size === 32) {
      return interpolate2DGrid(defaultRows, defaultCols, vals, defaultRows32, defaultCols32);
    }
    return vals;
  }

  // DOM Elements
  const container = document.getElementById('map-table-container');
  const btnGraph3D = document.getElementById('btn-graph-3d');
  const modalGraph3D = document.getElementById('graph3d-modal');
  const btnCloseG3D = document.getElementById('btn-graph3d-close');
  const btnCalcCC = document.getElementById('btn-calc-cc');
  const btnValPlus = document.getElementById('btn-val-plus');
  const btnValMinus = document.getElementById('btn-val-minus');

  // Sliders for 3D View
  const sldZoom = document.getElementById('g3d-zoom');
  const sldElev = document.getElementById('g3d-elev');
  const sldRot = document.getElementById('g3d-rot');
  const selColorScheme = document.getElementById('g3d-colorscheme');
  const selRenderMode = document.getElementById('g3d-rendermode');
  const btnReset3D = document.getElementById('btn-g3d-reset');
  const btnScreenshot3D = document.getElementById('btn-g3d-screenshot');

  let history = [];
  let historyPos = -1;
  let plotlyInitialized = false;
  let _flashCount = 0;
  let _autoLive = true;
  let selectedCells = [];
  let isSelecting = false;
  let startSelectCell = null;

  function saveHistory() {
    if (!mapData || !mapData.values) return;
    if (historyPos < history.length - 1) {
      history = history.slice(0, historyPos + 1);
    }
    history.push(JSON.parse(JSON.stringify(mapData.values)));
    historyPos = history.length - 1;
    if (mapData.activeTable) {
      if (!mapHistory[mapData.activeTable]) {
        mapHistory[mapData.activeTable] = { history: [], pos: -1 };
      }
      mapHistory[mapData.activeTable].history = history;
      mapHistory[mapData.activeTable].pos = historyPos;
    }
  }

  function selectRange(start, end) {
    selectedCells = [];
    let minR = Math.min(start.r, end.r);
    let maxR = Math.max(start.r, end.r);
    let minC = Math.min(start.c, end.c);
    let maxC = Math.max(start.c, end.c);

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        selectedCells.push([r, c]);
      }
    }
    updateCellSelectionStyles();
  }

  function updateCellSelectionStyles() {
    const tds = container.querySelectorAll('td[data-r]');
    tds.forEach(td => {
      let r = parseInt(td.dataset.r);
      let c = parseInt(td.dataset.c);
      let isSel = selectedCells.some(cell => cell[0] === r && cell[1] === c);
      if (isSel) {
        td.classList.add('selected-cell');
        td.style.outline = '2px solid #FF5722';
        td.style.outlineOffset = '-2px';
      } else {
        td.classList.remove('selected-cell');
        td.style.outline = '';
      }
    });
  }

  function selectAllCells() {
    if(!mapData) return;
    selectedCells = [];
    for (let r = 0; r < mapData.rows; r++) {
      for (let c = 0; c < mapData.cols; c++) {
        selectedCells.push([r, c]);
      }
    }
    updateCellSelectionStyles();
    App.toast('info', 'Select All', 'Selected all cells in the map matrix');
  }

  function limitValue(val) {
    if (!mapData) return val;
    let min = 0.0;
    let max = 25.0;
    const activeId = mapData.activeTable;
    let found = null;
    for (const cat of PARAMETER_TREE) {
      const item = cat.items.find(i => i.id === activeId);
      if (item) {
        found = item;
        break;
      }
    }
    if (found) {
      min = found.min !== undefined ? found.min : 0.0;
      max = found.max !== undefined ? found.max : 25.0;
    } else if (activeId === 'ignition') {
      min = -15.0;
      max = 60.0;
    }
    return Math.max(min, Math.min(max, val));
  }

  function setSelectedValue(val) {
    if(!mapData || !mapData.values) return;
    val = limitValue(val);
    let cellsToSet = selectedCells.length > 0 ? selectedCells : null;
    if (cellsToSet) {
      cellsToSet.forEach(cell => {
        let r = cell[0];
        let c = cell[1];
        mapData.values[r][c] = val;
      });
    } else {
      for(let r=0; r<mapData.rows; r++) {
        for(let c=0; c<mapData.cols; c++) {
          mapData.values[r][c] = val;
        }
      }
    }
    saveHistory();
    renderHeatmapTable();
    if(modalGraph3D && modalGraph3D.style.display !== 'none') {
      renderPlotly3D();
    }
    App.toast('success', 'Values Updated', `Set cells to ${val.toFixed(3)}`);
  }

  // Generic math transform on selected (or all) cells
  function mathOnSelected(fn) {
    if(!mapData || !mapData.values) return;
    let cells = selectedCells.length > 0 ? selectedCells : null;
    if (cells) {
      cells.forEach(cell => {
        mapData.values[cell[0]][cell[1]] = limitValue(fn(mapData.values[cell[0]][cell[1]]));
      });
    } else {
      for(let r=0; r<mapData.rows; r++) {
        for(let c=0; c<mapData.cols; c++) {
          mapData.values[r][c] = limitValue(fn(mapData.values[r][c]));
        }
      }
    }
    saveHistory();
    renderHeatmapTable();
    if(modalGraph3D && modalGraph3D.style.display !== 'none') renderPlotly3D();
  }

  // Interpolate: linear interpolation across selected cells (must be a straight row or column)
  function interpolateSelected() {
    if(!mapData || !mapData.values || selectedCells.length < 3) {
      App.toast('warning', 'Interpolate', 'Select at least 3 cells in a row or column');
      return;
    }

    // Verify 1D line selection: either all cells are in the same row, or all are in the same column
    let firstR = selectedCells[0][0];
    let firstC = selectedCells[0][1];
    let sameRow = selectedCells.every(cell => cell[0] === firstR);
    let sameCol = selectedCells.every(cell => cell[1] === firstC);

    if (!sameRow && !sameCol) {
      App.toast('warning', 'Interpolate Error', 'Selection must be a single straight row or column (no 2D block)');
      return;
    }

    // Sort selected cells by row then column
    let sorted = [...selectedCells].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let startVal = mapData.values[sorted[0][0]][sorted[0][1]];
    let endVal = mapData.values[sorted[sorted.length - 1][0]][sorted[sorted.length - 1][1]];
    let count = sorted.length;

    for (let i = 0; i < count; i++) {
      let t = i / (count - 1);
      let interpVal = startVal + (endVal - startVal) * t;
      mapData.values[sorted[i][0]][sorted[i][1]] = limitValue(parseFloat(interpVal.toFixed(3)));
    }

    saveHistory();
    renderHeatmapTable();
    if(modalGraph3D && modalGraph3D.style.display !== 'none') renderPlotly3D();
    App.toast('success', 'Interpolated', `Linear interpolation from ${startVal.toFixed(3)} to ${endVal.toFixed(3)} across ${count} cells`);
  }

  // Smooth: 3x3 kernel average on selected cells
  function smoothSelected() {
    if(!mapData || !mapData.values) return;

    let cells = selectedCells.length > 0 ? selectedCells : null;
    let snapshot = JSON.parse(JSON.stringify(mapData.values));

    function avgNeighbors(r, c) {
      let sum = 0, cnt = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          let nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < mapData.rows && nc >= 0 && nc < mapData.cols) {
            sum += snapshot[nr][nc];
            cnt++;
          }
        }
      }
      return parseFloat((sum / cnt).toFixed(3));
    }

    if (cells) {
      cells.forEach(cell => {
        mapData.values[cell[0]][cell[1]] = limitValue(avgNeighbors(cell[0], cell[1]));
      });
    } else {
      for(let r=0; r<mapData.rows; r++) {
        for(let c=0; c<mapData.cols; c++) {
          mapData.values[r][c] = limitValue(avgNeighbors(r, c));
        }
      }
    }

    saveHistory();
    renderHeatmapTable();
    if(modalGraph3D && modalGraph3D.style.display !== 'none') renderPlotly3D();
    App.toast('success', 'Smoothed', 'Applied 3×3 kernel averaging to selected cells');
  }

  // ============================================================
  // CURVE EDIT — Easing Functions, Modal, Preview & Apply Logic
  // ============================================================

  // 6 easing curve types with adjustable strength
  function easingFunction(t, type, strength) {
    let s = 1 + Math.abs(strength) / 50; // maps -100..100 → exponent 1.0..3.0
    if (strength < 0) {
      // Negative strength inverts the curve bias
      s = 1 / s;
    }
    switch(type) {
      case 'linear':
        return t;
      case 'ease-in':
        return Math.pow(t, s);
      case 'ease-out':
        return 1 - Math.pow(1 - t, s);
      case 'ease-in-out':
        return t < 0.5
          ? Math.pow(2 * t, s) / 2
          : 1 - Math.pow(2 * (1 - t), s) / 2;
      case 'exponential':
        if (s <= 1) return t;
        return (Math.pow(2, s * t) - 1) / (Math.pow(2, s) - 1);
      case 'logarithmic':
        if (s <= 1) return t;
        return Math.log(1 + t * (Math.pow(2, s) - 1)) / (s * Math.LN2);
      default:
        return t;
    }
  }

  // Get selection bounding box
  function getSelectionBounds() {
    if (!selectedCells || selectedCells.length === 0) return null;
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    selectedCells.forEach(cell => {
      if (cell[0] < minR) minR = cell[0];
      if (cell[0] > maxR) maxR = cell[0];
      if (cell[1] < minC) minC = cell[1];
      if (cell[1] > maxC) maxC = cell[1];
    });
    return { minR, maxR, minC, maxC };
  }

  // Draggable control points state
  let ceControlPoints = []; // Array of {t, value} normalized 0..1
  let ceDraggingIdx = -1;
  let ceHoveringIdx = -1;
  let ceCanvasListenersAttached = false;

  // Initialize N control points from easing function
  function initControlPoints(numPoints) {
    const curveType = document.getElementById('ce-curve-type')?.value || 'linear';
    const strength = parseInt(document.getElementById('ce-strength')?.value || '0');
    ceControlPoints = [];
    for (let i = 0; i < numPoints; i++) {
      let t = numPoints > 1 ? i / (numPoints - 1) : 0;
      let val = easingFunction(t, curveType, strength);
      ceControlPoints.push({ t, value: val });
    }
  }

  // Open Curve Edit modal (fullscreen)
  function openCurveEditModal() {
    if (!mapData || !mapData.values) {
      App.toast('warning', 'Curve Edit', 'No map data loaded');
      return;
    }
    if (selectedCells.length < 2) {
      App.toast('warning', 'Curve Edit', 'Select at least 2 cells first (drag or Shift+click)');
      return;
    }

    const modal = document.getElementById('curve-edit-modal');
    if (!modal) return;

    // Sort selection and auto-fill Start/End values
    let sorted = [...selectedCells].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let startVal = mapData.values[sorted[0][0]][sorted[0][1]];
    let endVal = mapData.values[sorted[sorted.length - 1][0]][sorted[sorted.length - 1][1]];

    const ceStartVal = document.getElementById('ce-start-val');
    const ceEndVal = document.getElementById('ce-end-val');
    const ceStrength = document.getElementById('ce-strength');
    const ceStrengthLabel = document.getElementById('ce-strength-label');
    const ceCellCount = document.getElementById('ce-cell-count');

    if (ceStartVal) ceStartVal.value = startVal.toFixed(3);
    if (ceEndVal) ceEndVal.value = endVal.toFixed(3);
    if (ceStrength) ceStrength.value = 0;
    if (ceStrengthLabel) ceStrengthLabel.textContent = '0';
    if (ceCellCount) ceCellCount.textContent = selectedCells.length;

    modal.style.display = 'flex';

    // Initialize control points (match number of selected cells, capped at 32)
    let numPts = Math.min(selectedCells.length, 32);
    if (numPts < 4) numPts = Math.min(selectedCells.length, 4);
    initControlPoints(numPts);

    // Size canvas to container after display
    requestAnimationFrame(() => {
      resizeCurveCanvas();
      attachCurveCanvasListeners();
      drawCurvePreview();
      previewCurveOnGrid();
    });
  }

  // Resize canvas to fill its container (HiDPI aware)
  function resizeCurveCanvas() {
    const canvas = document.getElementById('ce-preview-canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas._displayW = rect.width;
    canvas._displayH = rect.height;
  }

  // Close Curve Edit modal & clean up
  function closeCurveEditModal() {
    const modal = document.getElementById('curve-edit-modal');
    if (modal) modal.style.display = 'none';
    clearCurvePreviewOverlay();
    ceDraggingIdx = -1;
    ceHoveringIdx = -1;
  }

  let _ceDraggingColIdx = -1;
  let _ceHoveringColIdx = -1;

  // Attach mouse event listeners to canvas for 2D Graph node drag interaction
  function attachCurveCanvasListeners() {
    const canvas = document.getElementById('ce-preview-canvas');
    if (!canvas || ceCanvasListenersAttached) return;
    ceCanvasListenersAttached = true;

    const padLeft = 40;
    const padRight = 20;
    const padTop = 30;
    const padBot = 40;

    function getCanvasCoords(e) {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function findNearestPoint(mx, my) {
      if (!mapData || !mapData.values) return -1;
      const w = canvas.clientWidth || 680;
      const h = canvas.clientHeight || 380;
      const drawW = w - padLeft - padRight;
      const drawH = h - padTop - padBot;

      const rowVals = mapData.values[_ceActiveRowIdx] || [];
      const baseRowVals = (_ceBaselineValues && _ceBaselineValues[_ceActiveRowIdx]) ? _ceBaselineValues[_ceActiveRowIdx] : rowVals;
      const N = rowVals.length;
      if (N < 1) return -1;

      let minV = Math.min(...rowVals, ...baseRowVals) * 0.9;
      let maxV = Math.max(...rowVals, ...baseRowVals) * 1.1;
      if (maxV === minV) { minV = 0; maxV = 10; }

      let closest = -1;
      let minDist = 25; // Click hit radius

      for (let i = 0; i < N; i++) {
        let px = padLeft + (i / (N - 1)) * drawW;
        let normY = (rowVals[i] - minV) / (maxV - minV);
        let py = padTop + (1.0 - normY) * drawH;

        let dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      }
      return closest;
    }

    canvas.addEventListener('mousedown', (e) => {
      const { x, y } = getCanvasCoords(e);
      let idx = findNearestPoint(x, y);
      if (idx >= 0) {
        _ceDraggingColIdx = idx;
        canvas.style.cursor = 'ns-resize';
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      const { x, y } = getCanvasCoords(e);
      const w = canvas.clientWidth || 680;
      const h = canvas.clientHeight || 380;
      const drawH = h - padTop - padBot;

      if (_ceDraggingColIdx >= 0 && mapData && mapData.values) {
        const rowVals = mapData.values[_ceActiveRowIdx] || [];
        const baseRowVals = (_ceBaselineValues && _ceBaselineValues[_ceActiveRowIdx]) ? _ceBaselineValues[_ceActiveRowIdx] : rowVals;
        let minV = Math.min(...rowVals, ...baseRowVals) * 0.9;
        let maxV = Math.max(...rowVals, ...baseRowVals) * 1.1;
        if (maxV === minV) { minV = 0; maxV = 10; }

        let normY = Math.max(0, Math.min(1, 1.0 - ((y - padTop) / drawH)));
        let newVal = minV + normY * (maxV - minV);
        newVal = limitValue(roundToStep(newVal, 0.05, 2));

        // Update map cell value directly
        mapData.values[_ceActiveRowIdx][_ceDraggingColIdx] = newVal;
        if (mapData.activeTable) {
          mapData[mapData.activeTable] = JSON.parse(JSON.stringify(mapData.values));
        }

        // Realtime render sync across Table Grid, 3D Plot & Binary Buffer
        renderHeatmapTable();
        if (modalGraph3D && modalGraph3D.style.display !== 'none') renderPlotly3D();
        saveHistory();
        if (typeof saveToBuffer === 'function') saveToBuffer();

        drawCurvePreview();
      } else {
        let idx = findNearestPoint(x, y);
        if (idx !== _ceHoveringColIdx) {
          _ceHoveringColIdx = idx;
          canvas.style.cursor = idx >= 0 ? 'ns-resize' : 'crosshair';
        }
      }
    });

    canvas.addEventListener('mouseup', () => {
      if (_ceDraggingColIdx >= 0) {
        _ceDraggingColIdx = -1;
        canvas.style.cursor = 'crosshair';
        drawCurvePreview();
      }
    });

    canvas.addEventListener('mouseleave', () => {
      _ceDraggingColIdx = -1;
      _ceHoveringColIdx = -1;
      canvas.style.cursor = 'crosshair';
    });

    // Connect Toolbar Button Handlers (-5%, +5%, Reset Row)
    const btnInc = document.getElementById('btn-ce-adjust-inc');
    const btnDec = document.getElementById('btn-ce-adjust-dec');
    const btnReset = document.getElementById('btn-ce-reset-row');

    if (btnInc) {
      btnInc.onclick = () => {
        if (!mapData || !mapData.values) return;
        let rowVals = mapData.values[_ceActiveRowIdx];
        for (let i = 0; i < rowVals.length; i++) {
          rowVals[i] = limitValue(roundToStep(rowVals[i] * 1.05, 0.05, 2));
        }
        renderHeatmapTable();
        if (modalGraph3D && modalGraph3D.style.display !== 'none') renderPlotly3D();
        saveHistory();
        if (typeof saveToBuffer === 'function') saveToBuffer();
        drawCurvePreview();
      };
    }

    if (btnDec) {
      btnDec.onclick = () => {
        if (!mapData || !mapData.values) return;
        let rowVals = mapData.values[_ceActiveRowIdx];
        for (let i = 0; i < rowVals.length; i++) {
          rowVals[i] = limitValue(roundToStep(rowVals[i] * 0.95, 0.05, 2));
        }
        renderHeatmapTable();
        if (modalGraph3D && modalGraph3D.style.display !== 'none') renderPlotly3D();
        saveHistory();
        if (typeof saveToBuffer === 'function') saveToBuffer();
        drawCurvePreview();
      };
    }

    if (btnReset) {
      btnReset.onclick = () => {
        if (!mapData || !mapData.values || !_ceBaselineValues) return;
        mapData.values[_ceActiveRowIdx] = JSON.parse(JSON.stringify(_ceBaselineValues[_ceActiveRowIdx]));
        renderHeatmapTable();
        if (modalGraph3D && modalGraph3D.style.display !== 'none') renderPlotly3D();
        saveHistory();
        if (typeof saveToBuffer === 'function') saveToBuffer();
        drawCurvePreview();
      };
    }
  }


  let _ceActiveRowIdx = 0;
  let _ceBaselineValues = null;

  // Open 2D Graph Interactive Line Chart Modal
  function openCurveEditModal() {
    if (!mapData || !mapData.values) return;
    const modal = document.getElementById('curve-edit-modal');
    if (!modal) return;

    if (!selectedCells || selectedCells.length === 0) {
      _ceActiveRowIdx = 0;
    } else {
      _ceActiveRowIdx = selectedCells[0][0];
    }

    if (!_ceBaselineValues) {
      _ceBaselineValues = JSON.parse(JSON.stringify(mapData.values));
    }

    modal.style.display = 'block';
    render2DGraphTPSHeader();
    render2DGraphRPMAxis();
    attachCurveCanvasListeners();
    drawCurvePreview();
  }

  function render2DGraphTPSHeader() {
    const bar = document.getElementById('ce-tps-header-bar');
    if (!bar || !mapData) return;
    const cols = mapData.colLabels || defaultCols;
    let html = '<span style="color:#A0AAB0; font-size:11px; font-weight:700; margin-right:8px;">TPS%:</span>';
    cols.forEach((c, idx) => {
      let isSel = selectedCells.some(cell => cell[1] === idx);
      let bg = isSel ? '#22c55e' : '#222';
      let color = isSel ? '#000' : '#FFF';
      html += `<span style="background:${bg}; color:${color}; padding:2px 6px; border-radius:3px; font-size:10px; font-weight:900;">${c}%</span>`;
    });
    bar.innerHTML = html;
  }

  function render2DGraphRPMAxis() {
    const col = document.getElementById('ce-rpm-axis-column');
    if (!col || !mapData) return;
    const rows = mapData.rowLabels || defaultRows;
    let html = '';
    rows.forEach((r, idx) => {
      let isActive = (idx === _ceActiveRowIdx);
      let bg = isActive ? '#FF0055' : '#1A1A1A';
      let color = isActive ? '#FFF' : '#AAA';
      html += `<div class="ce-rpm-item" data-idx="${idx}" style="background:${bg}; color:${color}; padding:4px 8px; border-bottom:1px solid #333; cursor:pointer; font-weight:700;">${r}</div>`;
    });
    col.innerHTML = html;

    col.querySelectorAll('.ce-rpm-item').forEach(el => {
      el.addEventListener('click', () => {
        _ceActiveRowIdx = parseInt(el.dataset.idx);
        render2DGraphRPMAxis();
        drawCurvePreview();
      });
    });
  }

  // Draw TuneECU / TunerPro 2D Line Chart
  function drawCurvePreview() {
    const canvas = document.getElementById('ce-preview-canvas');
    if (!canvas || !mapData || !mapData.values) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    if (canvas.clientWidth) {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = (canvas.clientHeight || 380) * dpr;
    }

    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. Dark Grey Background (#2D2D2D)
    ctx.fillStyle = '#2D2D2D';
    ctx.fillRect(0, 0, w, h);

    const padLeft = 40;
    const padRight = 20;
    const padTop = 30;
    const padBot = 40;
    const drawW = w - padLeft - padRight;
    const drawH = h - padTop - padBot;

    const rowVals = mapData.values[_ceActiveRowIdx] || [];
    const baseRowVals = (_ceBaselineValues && _ceBaselineValues[_ceActiveRowIdx]) ? _ceBaselineValues[_ceActiveRowIdx] : rowVals;
    const cols = mapData.colLabels || defaultCols;
    const N = rowVals.length;

    let minV = Math.min(...rowVals, ...baseRowVals) * 0.9;
    let maxV = Math.max(...rowVals, ...baseRowVals) * 1.1;
    if (maxV === minV) { minV = 0; maxV = 10; }

    const labelRpm = document.getElementById('ce-active-row-label');
    if (labelRpm) {
      const rpmStr = (mapData.rowLabels && mapData.rowLabels[_ceActiveRowIdx]) ? mapData.rowLabels[_ceActiveRowIdx] : '--';
      labelRpm.textContent = `Active Row: ${rpmStr} RPM`;
    }

    // 2. Background Grid
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    for (let i = 0; i < N; i++) {
      let x = padLeft + (i / (N - 1)) * drawW;
      ctx.beginPath(); ctx.moveTo(x, padTop); ctx.lineTo(x, padTop + drawH); ctx.stroke();
    }
    for (let j = 0; j <= 5; j++) {
      let y = padTop + (j / 5) * drawH;
      ctx.beginPath(); ctx.moveTo(padLeft, y); ctx.lineTo(padLeft + drawW, y); ctx.stroke();
    }

    // 3. Dotted Baseline Curve (Pre-Edit Original)
    ctx.strokeStyle = 'rgba(255, 46, 99, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      let x = padLeft + (i / (N - 1)) * drawW;
      let normY = (baseRowVals[i] - minV) / (maxV - minV);
      let y = padTop + (1.0 - normY) * drawH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Solid Bright Pink Active Curve (#FF0055)
    ctx.strokeStyle = '#FF0055';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(255, 0, 85, 0.6)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      let x = padLeft + (i / (N - 1)) * drawW;
      let normY = (rowVals[i] - minV) / (maxV - minV);
      let y = padTop + (1.0 - normY) * drawH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 5. Node Circles & Percentage Change Labels
    for (let i = 0; i < N; i++) {
      let x = padLeft + (i / (N - 1)) * drawW;
      let normY = (rowVals[i] - minV) / (maxV - minV);
      let y = padTop + (1.0 - normY) * drawH;

      let diffPct = 0;
      if (baseRowVals[i] > 0) {
        diffPct = Math.round(((rowVals[i] - baseRowVals[i]) / baseRowVals[i]) * 100);
      }

      let isModified = Math.abs(diffPct) > 0;

      // Node dot
      ctx.beginPath();
      ctx.arc(x, y, isModified ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isModified ? '#00E5FF' : '#FF0055';
      ctx.fill();
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Delta label text above node
      ctx.fillStyle = isModified ? '#00E5FF' : '#AAA';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      let pctStr = isModified ? (diffPct > 0 ? `+${diffPct}%` : `${diffPct}%`) : '0%';
      ctx.fillText(pctStr, x, y - 12);
    }

    ctx.restore();
  }

  // Add preview overlay on grid cells that will be affected
  function previewCurveOnGrid() {
    clearCurvePreviewOverlay();
    if (!container || selectedCells.length === 0) return;

    selectedCells.forEach(cell => {
      const td = container.querySelector(`td[data-r="${cell[0]}"][data-c="${cell[1]}"]`);
      if (td) td.classList.add('curve-preview-cell');
    });
  }

  // Remove preview overlay from all cells
  function clearCurvePreviewOverlay() {
    if (!container) return;
    const prevCells = container.querySelectorAll('.curve-preview-cell');
    prevCells.forEach(el => el.classList.remove('curve-preview-cell'));
  }

  // Safety guard: check if current map is sensitive
  function checkSensitiveMap() {
    const sensitiveKeywords = ['limiter', 'vtec', 'vvt', 'fan', 'launch', 'protection', 'limp'];
    const mapSelect = document.getElementById('map-select');
    let mapName = '';
    if (mapSelect && mapSelect.selectedIndex >= 0 && mapSelect.options[mapSelect.selectedIndex]) {
      mapName = mapSelect.options[mapSelect.selectedIndex].text;
    }
    if (!mapName && mapData) mapName = mapData.name || '';
    mapName = mapName.toLowerCase();

    return sensitiveKeywords.some(kw => mapName.includes(kw));
  }

  // Get step precision from toolbar input
  function getCurveStepPrecision() {
    const el = document.getElementById('analist-step-val');
    let step = el ? parseFloat(el.value) : 0.05;
    if (isNaN(step) || step <= 0) step = 0.05;
    // Determine decimal places from step value
    let decimals = 3;
    let stepStr = step.toString();
    if (stepStr.includes('.')) {
      decimals = stepStr.split('.')[1].length;
    }
    return { step, decimals };
  }

  // Round value to nearest step
  function roundToStep(val, step, decimals) {
    let rounded = Math.round(val / step) * step;
    return parseFloat(rounded.toFixed(decimals));
  }

  // Main Apply function: calculate and write curve values to the grid
  // Interpolate the user-dragged control point curve at position t (0..1)
  function sampleControlCurve(t) {
    if (ceControlPoints.length === 0) return t;
    if (ceControlPoints.length === 1) return ceControlPoints[0].value;
    // Find the two surrounding control points
    let left = ceControlPoints[0];
    let right = ceControlPoints[ceControlPoints.length - 1];
    for (let i = 0; i < ceControlPoints.length - 1; i++) {
      if (t >= ceControlPoints[i].t && t <= ceControlPoints[i + 1].t) {
        left = ceControlPoints[i];
        right = ceControlPoints[i + 1];
        break;
      }
    }
    if (right.t === left.t) return left.value;
    let localT = (t - left.t) / (right.t - left.t);
    // Smooth interpolation (cubic hermite-like)
    let smooth = localT * localT * (3 - 2 * localT);
    return left.value + (right.value - left.value) * smooth;
  }

  // Unified save to binary ROM buffer & localStorage
  function saveToBuffer() {
    if (!mapData) return;
    try {
      if (mapData.name) {
        localStorage.setItem('map_' + mapData.name, JSON.stringify(mapData));
      }
      localStorage.setItem('active_remap_buffer', JSON.stringify(mapData));
      
      const _base = (location.protocol === 'file:' || !location.host) ? 'http://127.0.0.1:8080' : '';
      fetch(_base + '/api/map/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapData)
      }).catch(() => {});
    } catch (e) {
      console.warn("saveToBuffer error:", e);
    }
  }

  // Expose saveToBuffer globally
  window.saveToBuffer = saveToBuffer;


  // Main Save & Apply function for 2D Graph line chart edits
  function applyCurveEdit() {
    if (!mapData || !mapData.values) return;

    // Sync values back to active parameter tree slot
    if (mapData.activeTable) {
      mapData[mapData.activeTable] = JSON.parse(JSON.stringify(mapData.values));
    }
    const tableType = (mapData.activeTable && (mapData.activeTable.toLowerCase().includes('ignition') || mapData.activeTable.toLowerCase().includes('timing'))) ? 'ignition' : 'fuel';
    if (tableType === 'ignition') {
      mapData.ignitionValues = JSON.parse(JSON.stringify(mapData.values));
    } else {
      mapData.fuelValues = JSON.parse(JSON.stringify(mapData.values));
    }

    // Save history and update binary ROM buffer
    saveHistory();
    if (typeof saveToBuffer === 'function') saveToBuffer();

    // Render updated table grid and 3D surface plot
    clearCurvePreviewOverlay();
    renderHeatmapTable();
    if (modalGraph3D && modalGraph3D.style.display !== 'none') renderPlotly3D();

    // Close 2D Graph Modal window
    closeCurveEditModal();

    if (typeof App !== 'undefined' && App.toast) {
      App.toast('success', '2D Graph Saved', '2D Graph edits applied & saved to ROM binary buffer');
    }
  }



  function init() {
    const mapModelSelect = document.getElementById('map-model-select');
    let modelName = "22 VARIO 125 KZRA-601";
    if (mapModelSelect && mapModelSelect.selectedIndex !== -1 && mapModelSelect.options[mapModelSelect.selectedIndex]) {
      modelName = mapModelSelect.options[mapModelSelect.selectedIndex].text;
    }

    // Initial map data setup — Try loading from localStorage first
    let saved = localStorage.getItem('map_' + modelName);
    if (saved) {
      try {
        mapData = JSON.parse(saved);
        if (mapData.values && mapData.values[0] && mapData.values[0].length === 32) {
          mapData.cols = 32;
          mapData.rows = 32;
          mapData.colLabels = defaultCols32;
          mapData.rowLabels = defaultRows32;
        } else {
          mapData.cols = 16;
          mapData.rows = 16;
          mapData.colLabels = defaultCols;
          mapData.rowLabels = defaultRows;
        }
      } catch (e) {
        saved = null;
      }
    }
    if (!saved) {
      mapData = {
        name: modelName,
        cols: 16,
        rows: 16,
        colLabels: defaultCols,
        rowLabels: defaultRows,
        activeTable: "mainFuelMap"
      };
    }
    initializeMapDataParameters(mapData);

    // Default connection indicator to Offline on load
    const statusIndicator = document.getElementById('analist-status-indicator');
    if (statusIndicator) {
      statusIndicator.innerHTML = '<div class="status-dot red"></div> ECU Offline';
    }

    // Check ECU status from server on load
    const initBtnConnect = document.getElementById('btn-connect-ecm');
    if (typeof API !== 'undefined' && API.status) {
      API.status().then(status => {
        if (status && status.ecuConnected) {
          if (statusIndicator) statusIndicator.innerHTML = '<div class="status-dot green"></div> ECU Connected';
          if (initBtnConnect) initBtnConnect.textContent = 'Connected ✓';
          // Re-draw gauges with current telemetry vbat/cpu if available
          drawGauges(0, 0);
        }
      }).catch(() => {});
    }

    saveHistory();
    renderParameterTree();
    renderHeatmapTable();
    drawGauges(0, 0); // Draw initial Gauges at 0 (offline state)
    initDefinitionEditor();

    // 3D Graph Modal Toggle
    if(btnGraph3D) {
      btnGraph3D.addEventListener('click', () => {
        if(modalGraph3D) {
          modalGraph3D.style.display = 'flex';
          renderPlotly3D();
        }
      });
    }

    if(btnCloseG3D) {
      btnCloseG3D.addEventListener('click', () => {
        if(modalGraph3D) modalGraph3D.style.display = 'none';
      });
    }

    // CC Calculator
    if(btnCalcCC) {
      btnCalcCC.addEventListener('click', calculateEngineCC);
    }

    // Helper: get current value from input
    function getEditVal() {
      const el = document.getElementById('analist-edit-val');
      let v = el ? parseFloat(el.value) : NaN;
      if (isNaN(v)) {
        App.toast('warning', 'Invalid Input', 'Please enter a numeric value in the VALUE field');
      }
      return v;
    }
    function getStepVal() {
      const el = document.getElementById('analist-step-val');
      let v = el ? parseFloat(el.value) : 0.05;
      if (isNaN(v) || v <= 0) {
        v = 0.05;
        if (el) el.value = '0.05';
        App.toast('warning', 'Step Reset', 'Step value must be positive and greater than zero');
      }
      return v;
    }

    // Edit Value +/- Buttons (now uses dynamic step)
    if(btnValPlus) {
      btnValPlus.addEventListener('click', () => adjustSelectedValues(getStepVal()));
    }
    if(btnValMinus) {
      btnValMinus.addEventListener('click', () => adjustSelectedValues(-getStepVal()));
    }

    // Set Button
    const btnValSet = document.getElementById('btn-val-set');
    if(btnValSet) {
      btnValSet.addEventListener('click', () => {
        let num = getEditVal();
        if(!isNaN(num)) setSelectedValue(num);
      });
    }

    // +Add Button (add typed value to selected cells)
    const btnValAdd = document.getElementById('btn-val-add');
    if(btnValAdd) {
      btnValAdd.addEventListener('click', () => {
        let num = getEditVal();
        if(!isNaN(num)) adjustSelectedValues(num);
      });
    }

    // Percent Button (multiply selected cells by value as %)
    const btnValPercent = document.getElementById('btn-val-percent');
    if(btnValPercent) {
      btnValPercent.addEventListener('click', () => {
        let pct = getEditVal();
        if(isNaN(pct)) return;
        let factor = pct / 100;
        mathOnSelected((val) => parseFloat((val * factor).toFixed(3)));
        App.toast('success', 'Percent Applied', `Multiplied selected cells by ${pct}%`);
      });
    }

    // Multiply Button (multiply selected cells by value)
    const btnValMultiply = document.getElementById('btn-val-multiply');
    if(btnValMultiply) {
      btnValMultiply.addEventListener('click', () => {
        let mul = getEditVal();
        if(isNaN(mul)) return;
        mathOnSelected((val) => parseFloat((val * mul).toFixed(3)));
        App.toast('success', 'Multiply Applied', `Multiplied selected cells by ${mul}`);
      });
    }

    // Divide Button (divide selected cells by value)
    const btnValDivide = document.getElementById('btn-val-divide');
    if(btnValDivide) {
      btnValDivide.addEventListener('click', () => {
        let div = getEditVal();
        if(isNaN(div) || div === 0) { App.toast('error', 'Error', 'Cannot divide by zero'); return; }
        mathOnSelected((val) => parseFloat((val / div).toFixed(3)));
        App.toast('success', 'Divide Applied', `Divided selected cells by ${div}`);
      });
    }

    // Fill Button (fill selected cells with value)
    const btnValFill = document.getElementById('btn-val-fill');
    if(btnValFill) {
      btnValFill.addEventListener('click', () => {
        let num = getEditVal();
        if(!isNaN(num)) setSelectedValue(num);
      });
    }

    // Interpolate Button
    const btnValInterpolate = document.getElementById('btn-val-interpolate');
    if(btnValInterpolate) {
      btnValInterpolate.addEventListener('click', interpolateSelected);
    }

    // Smooth Button
    const btnValSmooth = document.getElementById('btn-val-smooth');
    if(btnValSmooth) {
      btnValSmooth.addEventListener('click', smoothSelected);
    }

    // Curve Edit Button & Modal Wiring
    const btnCurveEdit = document.getElementById('btn-val-curve-edit');
    if (btnCurveEdit) {
      btnCurveEdit.addEventListener('click', openCurveEditModal);
    }
    const btnCurveClose = document.getElementById('btn-curve-edit-close');
    if (btnCurveClose) {
      btnCurveClose.addEventListener('click', closeCurveEditModal);
    }
    const btnCurveCancel = document.getElementById('btn-curve-cancel');
    if (btnCurveCancel) {
      btnCurveCancel.addEventListener('click', closeCurveEditModal);
    }
    const btnCurveApply = document.getElementById('btn-curve-apply');
    if (btnCurveApply) {
      btnCurveApply.addEventListener('click', applyCurveEdit);
    }

    // Curve Edit modal live preview: update on any parameter change
    const ceUpdatePreview = () => { drawCurvePreview(); previewCurveOnGrid(); };
    // When curve type or strength changes, reinit control points from easing
    const ceResetAndPreview = () => {
      let numPts = Math.min(selectedCells.length, 32);
      if (numPts < 4) numPts = Math.min(selectedCells.length, 4);
      initControlPoints(numPts);
      resizeCurveCanvas();
      drawCurvePreview();
      previewCurveOnGrid();
    };
    const ceAxisTarget = document.getElementById('ce-axis-target');
    const ceCurveType = document.getElementById('ce-curve-type');
    const ceStrengthSlider = document.getElementById('ce-strength');
    const ceStartValInput = document.getElementById('ce-start-val');
    const ceEndValInput = document.getElementById('ce-end-val');
    const ceStrengthLbl = document.getElementById('ce-strength-label');

    if (ceAxisTarget) ceAxisTarget.addEventListener('change', ceUpdatePreview);
    if (ceCurveType) ceCurveType.addEventListener('change', ceResetAndPreview);
    if (ceStartValInput) ceStartValInput.addEventListener('input', ceUpdatePreview);
    if (ceEndValInput) ceEndValInput.addEventListener('input', ceUpdatePreview);
    if (ceStrengthSlider) {
      ceStrengthSlider.addEventListener('input', () => {
        if (ceStrengthLbl) ceStrengthLbl.textContent = ceStrengthSlider.value;
        ceResetAndPreview();
      });
    }

    // Make Curve Edit modal draggable
    const curveEditModal = document.getElementById('curve-edit-modal');
    const curveEditHeader = document.getElementById('curve-edit-header');
    makeModalDraggable(curveEditModal, curveEditHeader);

    // Select All Button
    const btnValSelectAll = document.getElementById('btn-val-select-all');
    if(btnValSelectAll) {
      btnValSelectAll.addEventListener('click', selectAllCells);
    }

    // Clear Selection Button
    const btnValClearSel = document.getElementById('btn-val-clear-sel');
    if(btnValClearSel) {
      btnValClearSel.addEventListener('click', () => {
        selectedCells = [];
        updateCellSelectionStyles();
        App.toast('info', 'Selection Cleared', 'All cells deselected');
      });
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', e => {
      const pageMapEditor = document.getElementById('page-mapeditor');
      if (!pageMapEditor || !pageMapEditor.classList.contains('active')) return;
      if (document.activeElement.tagName === 'INPUT') return;

      // Ctrl+A / Cmd+A - Select All
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAllCells();
      }
      // Ctrl+Z / Cmd+Z - Undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        document.getElementById('btn-map-undo')?.click();
      }
      // Ctrl+Shift+Z / Ctrl+Y - Redo
      if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        document.getElementById('btn-map-redo')?.click();
      }
      // Delete / Backspace - Zero out selected cells
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedCells.length > 0) {
          e.preventDefault();
          setSelectedValue(0);
        }
      }
      // Escape - Clear selection
      if (e.key === 'Escape') {
        selectedCells = [];
        updateCellSelectionStyles();
      }
    });

    // Sliders & 3D Options
    if(sldElev) sldElev.addEventListener('input', updatePlotlyCamera);
    if(sldRot) sldRot.addEventListener('input', updatePlotlyCamera);
    if(sldZoom) sldZoom.addEventListener('input', updatePlotlyCamera);
    if(selColorScheme) selColorScheme.addEventListener('change', renderPlotly3D);
    const selRenderMode = document.getElementById('g3d-rendermode');
    if(selRenderMode) selRenderMode.addEventListener('change', renderPlotly3D);
    if(btnReset3D) btnReset3D.addEventListener('click', resetPlotlyCamera);
    if(btnScreenshot3D) btnScreenshot3D.addEventListener('click', savePlotlyScreenshot);

    // Make 3D modal window draggable by header (disabled for fullscreen layout)
    // makeModalDraggable(modalGraph3D, document.getElementById('graph3d-header'));

    // Map Editor Special FX Parameter Preset Buttons
    setupMapPresetBtn('map-btn-helicopter', 'helicopter');
    setupMapPresetBtn('map-btn-rotary', 'rotary');
    setupMapPresetBtn('map-btn-popbang', 'popbang');
    setupMapPresetBtn('map-btn-launch', 'launch');
    setupMapPresetBtn('map-btn-cutlock', 'cutlock');

    // ---- SIDEBAR BUTTON HANDLERS ----
    const btnConnectECM = document.getElementById('btn-connect-ecm');
    const btnDiag = document.getElementById('btn-diag');
    const btnFlash = document.getElementById('btn-flash');
    const btnLive = document.getElementById('btn-live');
    const btnAutoLive = document.getElementById('btn-auto-live');
    const btnOpenFile = document.getElementById('btn-open-file');
    const btnSave = document.getElementById('btn-save');
    const btnSaveAs = document.getElementById('btn-save-as');
    const btnUndo = document.getElementById('btn-map-undo');
    const btnRedo = document.getElementById('btn-map-redo');
    const btnCountReset = document.getElementById('btn-count-reset');

    // Connect ECM
    if (btnConnectECM) {
      btnConnectECM.addEventListener('click', () => {
        btnConnectECM.textContent = 'Connecting...';
        if (typeof API !== 'undefined' && API.connect) {
          API.connect().then(r => {
            if (statusIndicator) statusIndicator.innerHTML = '<div class="status-dot green"></div> ECU Connected';
            btnConnectECM.textContent = 'Connected ✓';
            App.toast('success', 'ECU Connected', 'K-Line ECM session active');
          }).catch(e => {
            if (statusIndicator) statusIndicator.innerHTML = '<div class="status-dot red"></div> ECU Offline';
            btnConnectECM.textContent = 'Connect ECM';
            App.toast('error', 'Connection Failed', e.message || 'Check USB-FTDI cable');
          });
        } else {
          setTimeout(() => {
            if (statusIndicator) statusIndicator.innerHTML = '<div class="status-dot green"></div> ECU Connected (SIM)';
            btnConnectECM.textContent = 'Connected ✓';
            App.toast('success', 'ECU Connected (Sim)', 'Simulated K-Line session active');
          }, 800);
        }
      });
    }

    // DIAG - Navigate to Diagnostic page
    if (btnDiag) {
      btnDiag.addEventListener('click', () => {
        if (typeof App !== 'undefined' && App.navigate) {
          App.navigate('diagnostic');
        } else {
          App.toast('info', 'Diagnostic Mode', 'Switched to DTC / Diagnostic page');
        }
      });
    }

    // FLASH - Initiate real ECU flash write
    if (btnFlash) {
      btnFlash.addEventListener('click', () => {
        if (!mapData) return;

        // Safeguard flash protection for 32x32 maps to prevent bricking the ECU
        if (mapData.cols === 32) {
          alert('UNSUPPORTED HARDWARE SPECIFICATIONS:\n\n' +
                'Fitur Flashing diblokir untuk peta beresolusi 32x32.\n' +
                'Firmware/partisi ECU fisik motor Anda hanya mendukung alokasi tabel 16x16 (512 bytes).\n' +
                'Memaksa flash map 32x32 (2048 bytes) akan memicu Buffer Overflow dan dapat merusak (brick) ECU secara permanen.\n\n' +
                'Silakan gunakan berkas beresolusi 16x16 untuk menulis ke hardware fisik.');
          return;
        }

        if (confirm('WARNING: You are about to flash the current modified map parameters directly to the motorcycle ECU.\n\nEnsure battery voltage is stable above 12.0V and DO NOT disconnect the interface cable during flash.\n\nProceed to Flash?')) {
          if (typeof App !== 'undefined' && App.navigate) {
            App.navigate('flash');
          }
          setTimeout(() => {
            const btnWriteCal = document.getElementById('btn-flash-write-cal');
            if (btnWriteCal) {
              btnWriteCal.click();
            }
          }, 300);
        }
      });
    }

    // LIVE - Navigate to Live Data page
    if (btnLive) {
      btnLive.addEventListener('click', () => {
        if (typeof App !== 'undefined' && App.navigate) {
          App.navigate('live');
        } else {
          App.toast('info', 'Live Mode', 'Switched to Live Data page');
        }
      });
    }

    // Auto Live Map Data - Toggle real-time cell highlight
    if (btnAutoLive) {
      btnAutoLive.addEventListener('click', () => {
        _autoLive = !_autoLive;
        btnAutoLive.textContent = _autoLive ? '● Auto Live ON' : 'Auto Live Map Data';
        btnAutoLive.style.background = _autoLive ? '#22c55e' : '';
        App.toast(_autoLive ? 'success' : 'info', 
          _autoLive ? 'Auto Live Enabled' : 'Auto Live Disabled',
          _autoLive ? 'Map cells highlight in real-time from ECU telemetry' : 'Auto Live map tracking disabled');
      });
    }

    // OPEN File - Trigger file input & parse BIN/HEX binary map data
    const mapFileInput = document.getElementById('map-file-picker-input');
    
    if (btnOpenFile) {
      btnOpenFile.addEventListener('click', () => {
        if (_autoLive) {
          const confirmLive = confirm("Auto Live Map Data sedang aktif.\n\nApakah Anda yakin ingin memuat file binary baru dan menimpa buffer aktif saat ini?");
          if (!confirmLive) return;
        }

        if (window.pywebview && window.pywebview.api && window.pywebview.api.open_file) {
          App.toast('info', 'Opening File...', 'Select .bin or .hex calibration file...');
          window.pywebview.api.open_file().then(res => {
            if (res && res.status === 'ok' && res.mapData) {
              loadImportedMapData(res.mapData, res.filename);
              App.toast('success', 'Binary Map Loaded', `Loaded ${res.filename} (${(res.size/1024).toFixed(1)} KB)`);
            } else if (res && res.status === 'error') {
              App.toast('error', 'Open Error', res.message || 'Failed to open file');
            }
          }).catch(err => {
            console.error('[PYWEBVIEW OPEN ERROR]', err);
            if (mapFileInput) { mapFileInput.value = ''; mapFileInput.click(); }
          });
          return;
        }

        if (mapFileInput) {
          mapFileInput.value = '';
          mapFileInput.click();
        } else {
          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.accept = '.bin,.hex,.json';
          fileInput.style.display = 'none';
          document.body.appendChild(fileInput);
          fileInput.addEventListener('change', handleMapFileSelect);
          fileInput.click();
          setTimeout(() => document.body.removeChild(fileInput), 1000);
        }
      });
    }

    if (mapFileInput) {
      mapFileInput.addEventListener('change', handleMapFileSelect);
    }

    function handleMapFileSelect(e) {
      const file = e.target.files[0];
      if (!file) return;

      const ext = file.name.split('.').pop().toLowerCase();
      
      if (ext === 'json') {
        const convertLegacy = confirm("Peringatan: File .json adalah format legacy.\n\nApakah Anda ingin mengonversi file ini secara otomatis ke format binary .bin yang kompatibel dengan ECU?");
        if (!convertLegacy) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const legacyObj = JSON.parse(evt.target.result);
            API.request('POST', '/api/map/convert_json', { mapData: legacyObj })
              .then(res => {
                if (res.status === 'ok' && res.mapData) {
                  loadImportedMapData(res.mapData, res.filename);
                  App.toast('success', 'Legacy JSON Converted', `Converted & loaded binary buffer: ${res.filename}`);
                }
              })
              .catch(err => App.toast('error', 'Conversion Error', err.message));
          } catch(err) {
            App.toast('error', 'JSON Error', err.message);
          }
        };
        reader.readAsText(file);
        return;
      }

      if (ext !== 'bin' && ext !== 'hex') {
        App.toast('error', 'Format Tidak Didukung', 'Map Editor hanya menerima file binary (.bin) dan Intel HEX (.hex).');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      App.toast('info', 'Reading Binary Map...', `Parsing ${file.name}...`);

      const _base = (location.protocol === 'file:' || !location.host) ? 'http://127.0.0.1:8080' : '';
      fetch(_base + '/api/map/import', {
        method: 'POST',
        body: formData
      })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok' && data.mapData) {
          try {
            loadImportedMapData(data.mapData, data.filename);
            const paramCount = Object.keys(data.mapData).length;
            App.toast('success', 'Binary Map Loaded', `Successfully loaded: ${data.filename} (${(data.size/1024).toFixed(1)} KB, ${paramCount} parameters updated)`);
          } catch (parseErr) {
            console.error('[MAP OPEN ERROR]', parseErr);
            App.toast('error', 'Parsing Failed', 'Gagal memuat struktur tabel: ' + parseErr.message);
          }
        } else {
          App.toast('error', 'Import Failed', data.error || 'Failed to parse binary map');
        }
      })
      .catch(err => {
        console.error('[MAP OPEN FETCH ERROR]', err);
        App.toast('error', 'Import Error', err.message);
      });
    }

    function loadImportedMapData(imported, filename) {
      if (!imported) return;
      const previousState = mapData ? JSON.parse(JSON.stringify(mapData)) : null;

      try {
        mapData = imported;
        if (mapData.raw_hex_mode) {
          renderHexViewerMode(mapData);
          return;
        }

        if (mapData.values && mapData.values[0] && mapData.values[0].length === 32) {
          mapData.cols = 32;
          mapData.rows = 32;
          mapData.colLabels = defaultCols32;
          mapData.rowLabels = defaultRows32;
        } else {
          mapData.cols = 16;
          mapData.rows = 16;
          mapData.colLabels = defaultCols;
          mapData.rowLabels = defaultRows;
        }
        
        initializeMapDataParameters(mapData);
        if (typeof FlashUI !== 'undefined' && FlashUI.loadBufferList) {
          FlashUI.loadBufferList();
        }
        
        // Push initial snapshot into history stack for Undo/Redo support
        mapHistory = {};
        history = [];
        historyPos = -1;
        saveHistory();

        const modelSel = document.getElementById('map-model-select');
        if (modelSel) {
          for (let i = 0; i < modelSel.options.length; i++) {
            if (modelSel.options[i].text === mapData.name) {
              modelSel.selectedIndex = i;
              break;
            }
          }
        }

        localStorage.setItem('map_' + mapData.name, JSON.stringify(mapData));
        renderHexViewerMode(mapData);
        switchTable(mapData.activeTable || 'mainFuelMap');
      } catch (e) {
        if (previousState) mapData = previousState;
        throw e;
      }
    }

    // SAVE - Save current map persistently to local storage
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        if (!mapData) return;
        localStorage.setItem('map_' + mapData.name, JSON.stringify(mapData));
        App.toast('success', 'Map Saved', `${mapData.name} saved to local storage memory`);
      });
    }

    // SAVE As FILE - Export directly as .bin or .hex binary file to local OS
    if (btnSaveAs) {
      btnSaveAs.addEventListener('click', () => {
        if (!mapData) return;
        const wantHex = confirm("Pilih Format Save As:\n\n[OK] Save sebagai Binary RAW (.bin) — Direkomendasikan untuk Flash ECU\n[Cancel] Save sebagai Intel HEX (.hex) — Alternatif text hex");
        const exportFormat = wantHex ? 'bin' : 'hex';

        App.toast('info', 'Exporting Binary Map...', 'Patching calibration data to memory layout...');

        API.request('POST', '/api/map/export', { mapData: mapData, format: exportFormat })
          .then(res => {
            if (res.status === 'ok') {
              App.toast('success', 'Binary Map Exported', `Saved: ${res.filename} (${(res.size/1024).toFixed(1)} KB)\nDownloading to your local Mac/OS folder...`);
              
              // 1. Trigger local OS browser download to Mac/PC Downloads folder
              const downloadUrl = '/download?file=' + encodeURIComponent(res.filename);
              const a = document.createElement('a');
              a.href = downloadUrl;
              a.download = res.filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);

              // 2. Native pywebview OS Save Dialog fallback
              if (window.pywebview && window.pywebview.api && window.pywebview.api.save_file) {
                window.pywebview.api.save_file(res.path || res.filename, res.filename);
              }
            } else {
              App.toast('error', 'Export Failed', res.error || 'Failed to export binary map');
            }
          })
          .catch(err => {
            App.toast('error', 'Export Error', err.message);
          });
      });
    }

    // Undo
    if (btnUndo) {
      btnUndo.addEventListener('click', () => {
        if (historyPos > 0) {
          historyPos--;
          const restoredValues = JSON.parse(JSON.stringify(history[historyPos]));
          mapData[mapData.activeTable] = restoredValues;
          mapData.values = mapData[mapData.activeTable];

          const tableType = (mapData.activeTable.toLowerCase().includes('ignition') || mapData.activeTable.toLowerCase().includes('timing')) ? 'ignition' : 'fuel';
          if (tableType === 'ignition') {
            mapData.ignitionValues = restoredValues;
          } else {
            mapData.fuelValues = restoredValues;
          }

          if (!mapHistory[mapData.activeTable]) {
            mapHistory[mapData.activeTable] = { history: [], pos: -1 };
          }
          mapHistory[mapData.activeTable].pos = historyPos;

          renderHeatmapTable();
          if (modalGraph3D && modalGraph3D.style.display !== 'none') renderPlotly3D();
          App.toast('info', 'Undo', `Step ${historyPos + 1} of ${history.length}`);
        } else {
          App.toast('warning', 'Undo', 'Nothing to undo');
        }
      });
    }

    // Redo
    if (btnRedo) {
      btnRedo.addEventListener('click', () => {
        if (historyPos < history.length - 1) {
          historyPos++;
          const restoredValues = JSON.parse(JSON.stringify(history[historyPos]));
          mapData[mapData.activeTable] = restoredValues;
          mapData.values = mapData[mapData.activeTable];

          const tableType = (mapData.activeTable.toLowerCase().includes('ignition') || mapData.activeTable.toLowerCase().includes('timing')) ? 'ignition' : 'fuel';
          if (tableType === 'ignition') {
            mapData.ignitionValues = restoredValues;
          } else {
            mapData.fuelValues = restoredValues;
          }

          if (!mapHistory[mapData.activeTable]) {
            mapHistory[mapData.activeTable] = { history: [], pos: -1 };
          }
          mapHistory[mapData.activeTable].pos = historyPos;

          renderHeatmapTable();
          if (modalGraph3D && modalGraph3D.style.display !== 'none') renderPlotly3D();
          App.toast('info', 'Redo', `Step ${historyPos + 1} of ${history.length}`);
        } else {
          App.toast('warning', 'Redo', 'Nothing to redo');
        }
      });
    }

    // Count Flash Reset
    if (btnCountReset) {
      btnCountReset.addEventListener('click', () => {
        _flashCount = 0;
        App.toast('success', 'Flash Count Reset', 'Session flash counter reset to 0');
      });
    }

    const btnMigrate32 = document.getElementById('btn-migrate-32');
    const gridZoomSelect = document.getElementById('analist-grid-zoom');

    // Migrate to 32x32 Grid resolution with auto-backup
    if (btnMigrate32) {
      btnMigrate32.addEventListener('click', () => {
        if (!mapData) return;
        if (mapData.cols === 32) {
          App.toast('warning', 'Already 32x32', 'Map ini sudah beresolusi 32x32');
          return;
        }

        if (confirm('KONFIRMASI MIGRASI:\n\nApakah Anda yakin ingin meningkatkan resolusi map ini menjadi 32x32 (1024 sel)?\n\nData 16x16 lama akan dimigrasikan menggunakan interpolasi bilinear secara presisi. Backup otomatis akan dibuat.')) {
          
          // Auto-backup using API if connected to backend server
          if (typeof API !== 'undefined' && API.backup) {
            API.backup(mapData.name.replace(/\s+/g, '_') + '_auto_backup_' + Date.now())
              .then(() => App.toast('info', 'Backup Created', 'Safety backup file saved successfully on server'))
              .catch(err => console.warn('Safety auto-backup failed:', err));
          }

          // Scale all 2D maps in mapData using bilinear interpolation
          PARAMETER_TREE.forEach(cat => {
            cat.items.forEach(item => {
              if (item.type === '2d' && mapData[item.id]) {
                mapData[item.id] = interpolate2DGrid(defaultRows, defaultCols, mapData[item.id], defaultRows32, defaultCols32);
              }
            });
          });

          // Also scale fallback fuelValues and ignitionValues for safety/compatibility
          if (mapData.fuelValues) mapData.fuelValues = interpolate2DGrid(defaultRows, defaultCols, mapData.fuelValues, defaultRows32, defaultCols32);
          if (mapData.ignitionValues) mapData.ignitionValues = interpolate2DGrid(defaultRows, defaultCols, mapData.ignitionValues, defaultRows32, defaultCols32);

          // Update mapData structure to 32x32
          mapData.cols = 32;
          mapData.rows = 32;
          mapData.colLabels = defaultCols32;
          mapData.rowLabels = defaultRows32;
          mapData.values = mapData[mapData.activeTable];

          // Clear history stack
          mapHistory = {};
          history = [];
          historyPos = -1;
          saveHistory();

          // Save to localStorage persistently
          localStorage.setItem('map_' + mapData.name, JSON.stringify(mapData));

          // Re-render table and 3D graph
          switchTable(mapData.activeTable);

          App.toast('success', 'Migration Success', 'Map successfully migrated to high-resolution 32x32 grid!');
        }
      });
    }

    // Grid Zoom Handler
    if (gridZoomSelect) {
      gridZoomSelect.addEventListener('change', () => {
        renderHeatmapTable();
      });
    }

    // Map Model Selector - change map data on model switch
    if (mapModelSelect) {
      mapModelSelect.addEventListener('change', () => {
        let selectedText = mapModelSelect.value;
        if (mapModelSelect.selectedIndex !== -1 && mapModelSelect.options[mapModelSelect.selectedIndex]) {
          selectedText = mapModelSelect.options[mapModelSelect.selectedIndex].text;
        }

        // Try loading from localStorage first
        let saved = localStorage.getItem('map_' + selectedText);
        if (saved) {
          try {
            mapData = JSON.parse(saved);
            if (mapData.values && mapData.values[0] && mapData.values[0].length === 32) {
              mapData.cols = 32;
              mapData.rows = 32;
              mapData.colLabels = defaultCols32;
              mapData.rowLabels = defaultRows32;
            } else {
              mapData.cols = 16;
              mapData.rows = 16;
              mapData.colLabels = defaultCols;
              mapData.rowLabels = defaultRows;
            }
          } catch (e) {
            saved = null;
          }
        }
        if (!saved) {
          mapData = {
            name: selectedText,
            cols: 16,
            rows: 16,
            colLabels: defaultCols,
            rowLabels: defaultRows,
            activeTable: "mainFuelMap"
          };
        }
        initializeMapDataParameters(mapData);

        // Reset history stack for new model
        mapHistory = {};
        history = [];
        historyPos = -1;
        saveHistory();
        
        switchTable(mapData.activeTable);
        App.toast('info', 'Model Changed', `Loaded map database for ${selectedText}`);
      });
    }

    // Listen to WS live updates for real-time Gauges and flash progress
    if(typeof API !== 'undefined' && API.onWS) {
      API.onWS('message', msg => {
        if (msg) {
          if (msg.type === 'live' && msg.data) {
            const telemetry = msg.data;
            drawGauges(telemetry.rpm || 0, telemetry.tps || 0);
            updateAnalistMeters(telemetry);
            highlightActiveCell(telemetry.rpm || 0, telemetry.tps || 0);
          } else if (msg.type === 'flash_progress' && msg.state === 'DONE' && msg.msg && msg.msg.toLowerCase().includes('write')) {
            _flashCount++;
            App.toast('success', 'Flash Successful', `ECU flash write completed. Session flash count: ${_flashCount}`);
          }
        }
      });
    }

    // Register spontaneous WebSocket telemetry stream for real-time map cell highlight tracing
    if (typeof API !== 'undefined' && API.onLiveUpdate) {
      API.onLiveUpdate((data) => {
        if (data && data.rpm !== undefined) {
          updateAnalistMeters(data);
          highlightActiveCell(data.rpm || 0, data.tps || 0);
        }
      });
    }

    // Fallback Telemetry Poll Timer for Map Cell Highlight Tracing (ONLY when WS disconnected)
    setInterval(async () => {
      if (typeof API !== 'undefined' && API.isWsConnected) return; // Skip HTTP poll when WS streaming
      if (typeof API !== 'undefined' && API.get) {
        try {
          const liveData = await API.get('/api/live');
          if (liveData && liveData.rpm !== undefined) {
            updateAnalistMeters(liveData);
            highlightActiveCell(liveData.rpm || 0, liveData.tps || 0);
          }
        } catch (e) {}
      }
    }, 100);

    // Initialize Parameter Tree search and render
    const treeSearchInput = document.getElementById('tree-search-input');
    const treeSearchClear = document.getElementById('btn-tree-search-clear');
    if (treeSearchInput) {
      treeSearchInput.addEventListener('input', () => {
        if (treeSearchClear) {
          treeSearchClear.style.display = treeSearchInput.value.length > 0 ? 'block' : 'none';
        }
        renderParameterTree();
      });
    }
    if (treeSearchClear) {
      treeSearchClear.addEventListener('click', () => {
        treeSearchInput.value = '';
        treeSearchClear.style.display = 'none';
        renderParameterTree();
      });
    }

    renderParameterTree();
    switchTable(mapData.activeTable || "mainFuelMap");
  }

  function setupMapPresetBtn(id, mode) {
    const btn = document.getElementById(id);
    if(!btn) return;
    btn.addEventListener('click', () => applyMapPreset(mode));
  }

  function applyMapPreset(mode, customParams) {
    if(!mapData || !mapData.values) return;

    if(mode === 'helicopter') {
      const targetIdle = customParams && customParams[0] ? customParams[0] : 1600;
      const retard = customParams && customParams[2] ? customParams[2] : -10;
      let colLimit = mapData.cols === 32 ? 8 : 4;
      for(let c=0; c<colLimit; c++) {
        mapData.values[0][c] = limitValue(parseFloat((1.2 + (c%2)*0.6).toFixed(3)));
        mapData.values[1][c] = limitValue(parseFloat((1.4 - (c%2)*0.5).toFixed(3)));
      }
      App.toast('success', 'Helicopter Idle Patched', `Pushed Choppy Idle (${targetIdle} RPM, Retard: ${retard}°) to Map Matrix`);
    } else if(mode === 'rotary') {
      const bounceRpm = customParams && customParams[0] ? customParams[0] : 1800;
      let colLimit = mapData.cols === 32 ? 12 : 6;
      for(let c=0; c<colLimit; c++) {
        mapData.values[0][c] = limitValue(parseFloat((1.8 - (c%2)*0.9).toFixed(3)));
        mapData.values[1][c] = limitValue(parseFloat((2.1 - (c%2)*1.1).toFixed(3)));
      }
      App.toast('success', 'Rotary Sound Patched', `Pushed Rotary Wankel (${bounceRpm} RPM) parameters to Map Matrix`);
    } else if(mode === 'popbang') {
      const thresholdRpm = customParams && customParams[0] ? customParams[0] : 4000;
      const retard = customParams && customParams[1] ? customParams[1] : -18;
      const enrich = customParams && customParams[2] ? customParams[2] : 20;
      let startRow = mapData.rows === 32 ? 16 : 8;
      let endRow = mapData.rows === 32 ? 32 : 16;
      for(let r=startRow; r<endRow; r++) {
        mapData.values[r][0] = limitValue(parseFloat((2.500 + (enrich * 0.05)).toFixed(3)));
        mapData.values[r][1] = limitValue(parseFloat((2.100 + (enrich * 0.04)).toFixed(3)));
        if (mapData.cols === 32) {
          mapData.values[r][2] = limitValue(parseFloat((1.800 + (enrich * 0.03)).toFixed(3)));
          mapData.values[r][3] = limitValue(parseFloat((1.500 + (enrich * 0.02)).toFixed(3)));
        }
      }
      App.toast('success', 'Pop & Bangs Patched', `Pushed Flame Decel (Overrun: >${thresholdRpm} RPM, Retard: ${retard}°, Enrich: +${enrich}%) to Map Matrix`);
    } else if(mode === 'launch') {
      const launchRpm = customParams && customParams[0] ? customParams[0] : 5500;
      const retard = customParams && customParams[1] ? customParams[1] : -12;
      let launchRow = mapData.rows === 32 ? 17 : 10;
      let wotCol = mapData.cols - 1;
      mapData.values[launchRow][wotCol] = limitValue(4.850);
      App.toast('success', 'Launch Control Patched', `Pushed ${launchRpm} RPM Anti-Lag launch limit (Retard: ${retard}°) to Map Matrix`);
    } else if(mode === 'cutlock') {
      for(let c=0; c<mapData.cols; c++) {
        mapData.values[mapData.rows - 1][c] = limitValue(0.000);
      }
      App.toast('success', 'Cut Lock Patched', 'Pushed maximum RPM limiter zero-fuel cutoff to Map Matrix');
    }

    // Sync changes to active parameter tree slot
    mapData[mapData.activeTable] = JSON.parse(JSON.stringify(mapData.values));
    const tableType = (mapData.activeTable.toLowerCase().includes('ignition') || mapData.activeTable.toLowerCase().includes('timing')) ? 'ignition' : 'fuel';
    if (tableType === 'ignition') {
      mapData.ignitionValues = JSON.parse(JSON.stringify(mapData.values));
    } else {
      mapData.fuelValues = JSON.parse(JSON.stringify(mapData.values));
    }

    saveHistory();
    renderHeatmapTable();
    if(modalGraph3D && modalGraph3D.style.display !== 'none') {
      renderPlotly3D();
    }
  }

  // Calculate Heatmap Color (Blue -> Green -> Yellow -> Red)
  function getHeatmapColor(val, min = 1.0, max = 4.5) {
    if (mapData && mapData.activeTable) {
      let activeItem = null;
      for (const cat of PARAMETER_TREE) {
        const item = cat.items.find(i => i.id === mapData.activeTable);
        if (item) {
          activeItem = item;
          break;
        }
      }
      if (activeItem && activeItem.min !== undefined && activeItem.max !== undefined) {
        min = activeItem.min;
        max = activeItem.max;
      }
    }
    let ratio = (val - min) / (max - min);
    ratio = Math.max(0, Math.min(1, ratio));

    let h = (1.0 - ratio) * 240; // 240 is Blue, 0 is Red
    return `hsl(${h}, 85%, 45%)`;
  }

  function renderHeatmapTable() {
    if (!container || !mapData || !mapData.values) return;

    // Look up active item definition in PARAMETER_TREE
    const activeId = mapData.activeTable;
    let activeItem = null;
    for (const cat of PARAMETER_TREE) {
      const item = cat.items.find(i => i.id === activeId);
      if (item) {
        activeItem = item;
        break;
      }
    }

    let cols = mapData.cols;
    let rows = mapData.rows;
    let colLabels = mapData.colLabels;
    let rowLabels = mapData.rowLabels;
    let cornerLabel = "RPM \\ TPS (%)";

    if (activeItem && activeItem.type === '1d') {
      cols = activeItem.cols || 1;
      rows = activeItem.rows || 1;
      colLabels = activeItem.colLabels || ["Limit"];
      rowLabels = activeItem.rowLabels || ["RPM"];
      cornerLabel = "Parameter";
    }

    const values = mapData.values;

    let zoomClass = '';
    const gridZoomSelect = document.getElementById('analist-grid-zoom');
    if (gridZoomSelect) {
      if (gridZoomSelect.value === 'compact') zoomClass = 'compact';
      else if (gridZoomSelect.value === 'micro') zoomClass = 'micro';
    }

    let html = `<table class="map-table-heatmap ${zoomClass}"><thead><tr><th style="cursor:pointer;" id="th-select-all-corner">${cornerLabel}</th>`;
    for(let c=0; c<cols; c++) {
      html += `<th style="cursor:pointer;" data-col="${c}">${colLabels[c]}</th>`;
    }
    html += '</tr></thead><tbody>';

    let renderDecimals = 3;
    if (activeItem) {
      if (activeItem.unit === '°' || activeItem.unit === '%' || activeItem.unit === 'RPM') {
        renderDecimals = 1;
      }
    } else if (mapData.activeTable && (mapData.activeTable.toLowerCase().includes('ign') || mapData.activeTable.toLowerCase().includes('timing'))) {
      renderDecimals = 1;
    }

    for(let r=0; r<rows; r++) {
      html += `<tr><th style="cursor:pointer;" data-row="${r}">${rowLabels[r]}</th>`;
      for(let c=0; c<cols; c++) {
        let val = values[r][c];
        let color = getHeatmapColor(val);
        let isSel = selectedCells.some(cell => cell[0] === r && cell[1] === c);
        let selectedStyle = isSel ? 'outline: 2px solid #FF5722; outline-offset: -2px;' : '';
        let selectedClass = isSel ? 'selected-cell' : '';
        html += `<td style="background:${color}; ${selectedStyle}" class="${selectedClass}" data-r="${r}" data-c="${c}">
                   <input type="text" class="map-cell-val" value="${val.toFixed(renderDecimals)}" data-r="${r}" data-c="${c}" style="background:transparent;border:none;color:#fff;text-align:center;width:100%;height:100%;cursor:pointer;">
                 </td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';

    container.innerHTML = html;

    // Corner Header Click - Select All
    const cornerTh = document.getElementById('th-select-all-corner');
    if (cornerTh) {
      cornerTh.addEventListener('click', selectAllCells);
    }

    // Col Header Click - Select Entire Column
    const colThs = container.querySelectorAll('thead th[data-col]');
    colThs.forEach(th => {
      th.addEventListener('click', () => {
        let c = parseInt(th.dataset.col);
        selectedCells = [];
        for (let r = 0; r < rows; r++) {
          selectedCells.push([r, c]);
        }
        updateCellSelectionStyles();
      });
    });

    // Row Header Click - Select Entire Row
    const rowThs = container.querySelectorAll('tbody th[data-row]');
    rowThs.forEach(th => {
      th.addEventListener('click', () => {
        let r = parseInt(th.dataset.row);
        selectedCells = [];
        for (let c = 0; c < cols; c++) {
          selectedCells.push([r, c]);
        }
        updateCellSelectionStyles();
      });
    });

    // Cell Selection & Drag Logic
    const tds = container.querySelectorAll('td[data-r]');
    tds.forEach(td => {
      td.addEventListener('mousedown', e => {
        let r = parseInt(td.dataset.r);
        let c = parseInt(td.dataset.c);
        isSelecting = true;
        startSelectCell = { r, c };

        if (e.shiftKey) {
          selectRange(startSelectCell, { r, c });
        } else {
          selectedCells = [[r, c]];
          updateCellSelectionStyles();
        }
        
        // Populate current cell value into the EDIT VALUE input box for editing
        const editValInp = document.getElementById('analist-edit-val');
        if (editValInp) {
          editValInp.value = values[r][c].toFixed(renderDecimals);
        }
      });

      td.addEventListener('mouseenter', () => {
        if (isSelecting && startSelectCell) {
          let r = parseInt(td.dataset.r);
          let c = parseInt(td.dataset.c);
          selectRange(startSelectCell, { r, c });
        }
      });
    });

    window.addEventListener('mouseup', () => {
      isSelecting = false;
    });

    // Cell edit events
    const cells = container.querySelectorAll('.map-cell-val');
    cells.forEach(cell => {
      cell.addEventListener('change', e => {
        let r = parseInt(e.target.dataset.r);
        let c = parseInt(e.target.dataset.c);
        let num = parseFloat(e.target.value);
        if(!isNaN(num)) {
          num = limitValue(num);
          e.target.value = num.toFixed(renderDecimals);
          saveHistory();
          mapData.values[r][c] = num;
          
          // Sync changes to active parameter tree slot
          mapData[mapData.activeTable] = JSON.parse(JSON.stringify(mapData.values));

          // Sync changes to backwards compatibility sub-arrays
          const tableType = (mapData.activeTable.toLowerCase().includes('ignition') || mapData.activeTable.toLowerCase().includes('timing')) ? 'ignition' : 'fuel';
          if (tableType === 'ignition') {
            mapData.ignitionValues = JSON.parse(JSON.stringify(mapData.values));
          } else {
            mapData.fuelValues = JSON.parse(JSON.stringify(mapData.values));
          }
          
          e.target.parentElement.style.background = getHeatmapColor(num);
          if(modalGraph3D && modalGraph3D.style.display !== 'none') {
            renderPlotly3D();
          }
        }
      });
    });
  }

  // Draw Analog Gauges on Canvas
  function drawGauges(rpm, tps) {
    drawSingleGauge('gauge-rpm-canvas', rpm, 0, 12000, 'RPM', '#FF5722');
    drawSingleGauge('gauge-tps-canvas', tps, 0, 100, 'TPS %', '#FF5722');
  }

  function drawSingleGauge(canvasId, value, minVal, maxVal, label, needleColor) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = w / 2 - 12;

    ctx.clearRect(0, 0, w, h);

    // Check connection status
    let isConnected = false;
    const statusIndicator = document.getElementById('analist-status-indicator');
    if (statusIndicator && statusIndicator.textContent.toLowerCase().includes('connected')) {
      isConnected = true;
    }

    // Colors adjusted if offline
    const trackColor = '#2a2a2a';
    const arcColor = isConnected ? needleColor : '#333333';
    const needleStrokeColor = isConnected ? '#ffffff' : '#555555';
    const pivotColor = isConnected ? needleColor : '#444444';

    // Background dial
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0.75 * Math.PI, 2.25 * Math.PI);
    ctx.strokeStyle = trackColor;
    ctx.lineWidth = 10;
    ctx.stroke();

    // Value Arc
    let valRatio = isConnected ? ((value - minVal) / (maxVal - minVal)) : 0;
    valRatio = Math.max(0, Math.min(1, valRatio));
    let endAngle = (0.75 + valRatio * 1.5) * Math.PI;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0.75 * Math.PI, endAngle);
    ctx.strokeStyle = arcColor;
    ctx.lineWidth = 10;
    ctx.stroke();

    // Ticks & Numbers
    ctx.fillStyle = isConnected ? '#888' : '#444';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for(let i=0; i<=5; i++) {
      let ang = (0.75 + (i/5) * 1.5) * Math.PI;
      let tx = cx + (radius - 16) * Math.cos(ang);
      let ty = cy + (radius - 16) * Math.sin(ang);
      let tickVal = Math.round(minVal + (i/5) * (maxVal - minVal));
      if(maxVal > 1000) tickVal = Math.round(tickVal / 1000); // 0..15 for RPM
      ctx.fillText(tickVal.toString(), tx, ty);
    }

    // Needle
    let needleAng = (0.75 + valRatio * 1.5) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (radius - 10) * Math.cos(needleAng), cy + (radius - 10) * Math.sin(needleAng));
    ctx.strokeStyle = needleStrokeColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center pivot
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
    ctx.fillStyle = pivotColor;
    ctx.fill();

    // Value or OFFLINE text
    if (isConnected) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText(value.toFixed(0), cx, cy + 28);
    } else {
      ctx.fillStyle = '#ef4444'; // Red offline label
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillText('OFFLINE', cx, cy + 28);
    }
  }

  function highlightActiveCell(rpm, tps) {
    const container = document.getElementById('map-table-container');
    if (!_autoLive || !mapData || !container) return;

    // Find closest row index (RPM)
    let closestRow = 0;
    let minRowDiff = Infinity;
    if (mapData.rowLabels && mapData.rowLabels.length > 0) {
      for (let r = 0; r < mapData.rowLabels.length; r++) {
        let diff = Math.abs(mapData.rowLabels[r] - rpm);
        if (diff < minRowDiff) {
          minRowDiff = diff;
          closestRow = r;
        }
      }
    }

    // Find closest col index (TPS)
    let closestCol = 0;
    let minColDiff = Infinity;
    if (mapData.colLabels && mapData.colLabels.length > 0) {
      for (let c = 0; c < mapData.colLabels.length; c++) {
        let diff = Math.abs(mapData.colLabels[c] - tps);
        if (diff < minColDiff) {
          minColDiff = diff;
          closestCol = c;
        }
      }
    }

    // Clear previous highlights
    const prevActive = container.querySelectorAll('.active-live-cell');
    prevActive.forEach(el => {
      el.classList.remove('active-live-cell');
      el.style.boxShadow = '';
      el.style.border = '';
      el.style.outline = '';
      el.style.fontWeight = '';
    });

    // Highlight new active cell corresponding to real RPM and TPS
    const activeTd = container.querySelector(`td[data-r="${closestRow}"][data-c="${closestCol}"]`);
    if (activeTd) {
      activeTd.classList.add('active-live-cell');
      activeTd.style.boxShadow = 'inset 0 0 12px #ff3300, 0 0 16px #ff5500, 0 0 8px #ffffff';
      activeTd.style.border = '2px solid #ffffff';
      activeTd.style.outline = '3px solid #ff3300';
      activeTd.style.outlineOffset = '-3px';
      activeTd.style.fontWeight = '900';
    }
  }

  function setDashboardOffline() {
    drawGauges(0, 0);
    const metrics = ['analist-tps', 'analist-rpm', 'analist-ig', 'analist-temp', 'analist-inj', 'analist-idc', 'analist-hp', 'analist-afr', 'analist-load'];
    const units = {
      'analist-tps': '--- %',
      'analist-rpm': '---',
      'analist-ig': '--- °',
      'analist-temp': '--- °C',
      'analist-inj': '--- ms',
      'analist-idc': '--- %',
      'analist-hp': '--- HP',
      'analist-afr': '---',
      'analist-load': '--- %'
    };
    metrics.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = units[id];
    });
  }

  function updateStatus(status) {
    const statusIndicator = document.getElementById('analist-status-indicator');
    const btnConnectECM = document.getElementById('btn-connect-ecm');
    if (status && status.ecuConnected) {
      if (statusIndicator) statusIndicator.innerHTML = '<div class="status-dot green"></div> ECU Connected';
      if (btnConnectECM) btnConnectECM.textContent = 'Connected ✓';
    } else {
      if (statusIndicator) statusIndicator.innerHTML = '<div class="status-dot red"></div> ECU Offline';
      if (btnConnectECM) btnConnectECM.textContent = 'Connect ECM';
      setDashboardOffline();
    }
  }

  function updateAnalistMeters(data) {
    if (!data) return;
    
    // Normalize parameter names from various telemetry formats
    const tps = data.tps || 0;
    const rpm = data.rpm || 0;
    const ect = data.ect || 0;
    const inj = data.inj || data.injPW || 0;
    const ig = data.ign || data.ignTiming || 0;
    const load = data.load || data.engineLoad || (tps * 0.8);
    const afr = data.afr || 14.7;

    // IDC (Injector Duty Cycle) formula
    const idc = (rpm * inj) / 1200;

    // Estimated HP formula (smooth approximation based on RPM & TPS)
    const hp = (rpm > 1000) ? ((rpm - 1000) * (tps + 10) * 0.000015) : 0;

    if(document.getElementById('analist-tps')) document.getElementById('analist-tps').textContent = tps.toFixed(1) + ' %';
    if(document.getElementById('analist-rpm')) document.getElementById('analist-rpm').textContent = rpm;
    if(document.getElementById('analist-temp')) document.getElementById('analist-temp').textContent = ect.toFixed(1) + ' °C';
    if(document.getElementById('analist-inj')) document.getElementById('analist-inj').textContent = inj.toFixed(2) + ' ms';
    if(document.getElementById('analist-ig')) document.getElementById('analist-ig').textContent = ig.toFixed(1) + ' °';
    if(document.getElementById('analist-idc')) document.getElementById('analist-idc').textContent = idc.toFixed(1) + ' %';
    if(document.getElementById('analist-hp')) document.getElementById('analist-hp').textContent = hp.toFixed(1) + ' HP';
    if(document.getElementById('analist-afr')) document.getElementById('analist-afr').textContent = afr.toFixed(1);
    if(document.getElementById('analist-load')) document.getElementById('analist-load').textContent = load.toFixed(1) + ' %';

    if (_autoLive) {
      highlightActiveCell(rpm, tps);
    }
  }

  // Render 3D Surface Plot with Plotly.js
  function renderPlotly3D() {
    const container3D = document.getElementById('graph3d-plot');
    if(!container3D || typeof Plotly === 'undefined') return;

    let activeItem = null;
    if (mapData) {
      for (const cat of PARAMETER_TREE) {
        const item = cat.items.find(i => i.id === mapData.activeTable);
        if (item) {
          activeItem = item;
          break;
        }
      }
    }

    if (activeItem && activeItem.type === '1d') {
      container3D.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-size:13px;font-weight:700;">
                                <i class="fa fa-cube" style="margin-right:6px;"></i> 3D Graph not available for 1D parameters
                               </div>`;
      const pointsCntEl = document.getElementById('g3d-points-cnt');
      if (pointsCntEl) pointsCntEl.textContent = '1';
      return;
    }

    let zData = mapData.values;
    let xData = mapData.colLabels;
    let yData = mapData.rowLabels;

    // Update dynamic points count in info tag
    const pointsCntEl = document.getElementById('g3d-points-cnt');
    if (pointsCntEl && mapData) {
      pointsCntEl.textContent = mapData.rows * mapData.cols;
    }

    let renderMode = 'wireframe-solid';
    if (selRenderMode) {
      renderMode = selRenderMode.value;
    }

    let data = [];

    // 1. Surface Trace (Solid)
    if (renderMode === 'solid' || renderMode === 'wireframe-solid') {
      let colorscale = 'Rainbow';
      if(selColorScheme) {
        if(selColorScheme.value === 'Viridis') colorscale = 'Viridis';
        if(selColorScheme.value === 'Hot') colorscale = 'Hot';
        if(selColorScheme.value === 'Rainbow1') colorscale = 'Rainbow';
      }

      data.push({
        z: zData,
        x: xData,
        y: yData,
        type: 'surface',
        colorscale: colorscale,
        showscale: true,
        contours: {
          z: { show: true, usecolormap: true, highlightcolor: "#FF5722", project: { z: true } }
        }
      });
    }

    // 2. Scatter3D Trace (Wireframe Mesh Grid)
    if (renderMode === 'wireframe' || renderMode === 'wireframe-solid') {
      let scatterX = [];
      let scatterY = [];
      let scatterZ = [];

      let step = 1;
      if (mapData.cols > 16) {
        step = 2; // Show every 2nd line to prevent mesh cluttering on dense grids
      }

      // Horizontal lines (constant rows / RPM)
      for (let r = 0; r < mapData.rows; r += step) {
        for (let c = 0; c < mapData.cols; c++) {
          scatterX.push(mapData.colLabels[c]);
          scatterY.push(mapData.rowLabels[r]);
          scatterZ.push(mapData.values[r][c]);
        }
        scatterX.push(null);
        scatterY.push(null);
        scatterZ.push(null);
      }

      // Vertical lines (constant cols / TPS%)
      for (let c = 0; c < mapData.cols; c += step) {
        for (let r = 0; r < mapData.rows; r++) {
          scatterX.push(mapData.colLabels[c]);
          scatterY.push(mapData.rowLabels[r]);
          scatterZ.push(mapData.values[r][c]);
        }
        scatterX.push(null);
        scatterY.push(null);
        scatterZ.push(null);
      }

      let lineWidth = renderMode === 'wireframe' ? 2 : 1.5;
      if (mapData.cols > 16) {
        lineWidth = renderMode === 'wireframe' ? 1.5 : 1.0;
      }

      data.push({
        type: 'scatter3d',
        x: scatterX,
        y: scatterY,
        z: scatterZ,
        mode: 'lines',
        line: {
          color: renderMode === 'wireframe' ? '#14b8a6' : '#ffffff', // teal for standalone wireframe, white overlay for solid
          width: lineWidth
        },
        hoverinfo: 'none',
        showlegend: false
      });
    }

    let zTitle = 'Injection (ms)';
    if (activeItem) {
      zTitle = activeItem.name + (activeItem.unit ? ' (' + activeItem.unit + ')' : '');
    } else if (mapData && mapData.activeTable && (mapData.activeTable.toLowerCase().includes('ign') || mapData.activeTable.toLowerCase().includes('timing'))) {
      zTitle = 'Timing (deg)';
    }

    let layout = {
      margin: { l: 0, r: 0, b: 0, t: 0 },
      paper_bgcolor: '#0d0d0d',
      plot_bgcolor: '#0d0d0d',
      scene: {
        xaxis: { title: 'TPS %', color: '#FF5722', gridcolor: '#333' },
        yaxis: { title: 'RPM', color: '#FF5722', gridcolor: '#333' },
        zaxis: { title: zTitle, color: '#FF5722', gridcolor: '#333' },
        camera: {
          eye: { x: 1.5, y: 1.5, z: 1.2 }
        }
      }
    };

    let config = { responsive: true, displayModeBar: false };

    Plotly.newPlot(container3D, data, layout, config);
    plotlyInitialized = true;
  }

  function updatePlotlyCamera() {
    const container3D = document.getElementById('graph3d-plot');
    if(!container3D || !plotlyInitialized || typeof Plotly === 'undefined') return;

    let elev = parseFloat(sldElev.value) * (Math.PI / 180);
    let rot = parseFloat(sldRot.value) * (Math.PI / 180);
    let zoom = parseFloat(sldZoom.value);

    let eyeX = zoom * 1.5 * Math.cos(rot) * Math.cos(elev);
    let eyeY = zoom * 1.5 * Math.sin(rot) * Math.cos(elev);
    let eyeZ = zoom * 1.2 * Math.sin(elev);

    Plotly.relayout(container3D, {
      'scene.camera.eye': { x: eyeX, y: eyeY, z: Math.max(0.2, eyeZ) }
    });
  }

  function resetPlotlyCamera() {
    if(sldZoom) sldZoom.value = 1.0;
    if(sldElev) sldElev.value = 45;
    if(sldRot) sldRot.value = 45;
    renderPlotly3D();
  }

  function savePlotlyScreenshot() {
    const container3D = document.getElementById('graph3d-plot');
    if(container3D && typeof Plotly !== 'undefined') {
      Plotly.downloadImage(container3D, { format: 'png', width: 800, height: 600, filename: 'Graph3D_ANALIST_Pro' });
    }
  }

  // CC Calculator Logic
  function calculateEngineCC() {
    const boreEl = document.getElementById('calc-bore');
    const strokeEl = document.getElementById('calc-stroke');
    const cylindersEl = document.getElementById('calc-cylinders');
    const resultEl = document.getElementById('calc-cc-result');

    if(boreEl && strokeEl && resultEl) {
      let bore = parseFloat(boreEl.value);
      let stroke = parseFloat(strokeEl.value);
      let cylinders = cylindersEl ? parseInt(cylindersEl.value) : 1;
      if (isNaN(cylinders) || cylinders < 1) cylinders = 1;
      
      if(!isNaN(bore) && !isNaN(stroke)) {
        let cc = (Math.PI / 4) * Math.pow(bore, 2) * stroke * cylinders / 1000;
        resultEl.textContent = `Displacement: ${cc.toFixed(1)} cc`;
      }
    }
  }

  function adjustSelectedValues(delta) {
    if(!mapData || !mapData.values) return;
    let cellsToAdjust = selectedCells.length > 0 ? selectedCells : null;
    if (cellsToAdjust) {
      cellsToAdjust.forEach(cell => {
        let r = cell[0];
        let c = cell[1];
        mapData.values[r][c] = limitValue(parseFloat((mapData.values[r][c] + delta).toFixed(3)));
      });
    } else {
      for(let r=0; r<mapData.rows; r++) {
        for(let c=0; c<mapData.cols; c++) {
          mapData.values[r][c] = limitValue(parseFloat((mapData.values[r][c] + delta).toFixed(3)));
        }
      }
    }
    saveHistory();
    renderHeatmapTable();
    if(modalGraph3D && modalGraph3D.style.display !== 'none') {
      renderPlotly3D();
    }
  }

  // Make Modal Window Draggable
  function makeModalDraggable(modal, header) {
    if(!modal || !header) return;
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      modal.style.top = (modal.offsetTop - pos2) + "px";
      modal.style.left = (modal.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  let hexViewerState = {
    hexData: '',
    totalBytes: 0,
    currentPage: 0,
    rowsPerPage: 16,
    highlightOffset: -1
  };

  function jumpToHexOffset(targetOffset) {
    if (targetOffset === undefined || targetOffset === null) return;
    const hexContainer = document.getElementById('hex-viewer-mode-container');
    if (hexContainer && hexContainer.style.display !== 'none') {
      const targetRow = Math.floor(targetOffset / 16);
      hexViewerState.currentPage = Math.floor(targetRow / hexViewerState.rowsPerPage);
      hexViewerState.highlightOffset = targetOffset;
      renderHexPage();
    }
  }

  function renderHexViewerMode(targetData) {
    const dataToUse = targetData || mapData;
    const tableContainer = document.getElementById('map-table-container');
    const hexContainer = document.getElementById('hex-viewer-mode-container');
    const breadcrumb = document.getElementById('analist-table-breadcrumb');

    if (!hexContainer || !dataToUse) return;

    if (dataToUse.raw_hex_mode) {
      if (tableContainer) tableContainer.style.display = 'none';
      hexContainer.style.display = 'block';
      if (breadcrumb) {
        breadcrumb.innerHTML = `<span class="bc-parent">Renesas V850 MCU Dump</span> &gt; <span class="bc-child" style="color:var(--accent);">${dataToUse.name} (Raw Hex Viewer Mode)</span>`;
      }

      // 1. Populate Metadata
      document.getElementById('hex-meta-filename').textContent = dataToUse.filename || dataToUse.name;
      document.getElementById('hex-meta-size').textContent = `${((dataToUse.size || 393216)/1024).toFixed(1)} KB (${(dataToUse.size || 393216).toLocaleString()} Bytes)`;
      document.getElementById('hex-meta-md5').textContent = dataToUse.md5 || '-';
      document.getElementById('hex-meta-crc32').textContent = dataToUse.crc32 || '-';
      document.getElementById('hex-meta-fw').textContent = dataToUse.fw_identifier || 'SV850T06C121RV101';
      
      const pct = dataToUse.occupied_pct || 50.0;
      document.getElementById('hex-meta-occupancy-label').textContent = `0x000000 - 0x02FFFF (${pct}%)`;
      const barActive = document.getElementById('hex-bar-active');
      const barEmpty = document.getElementById('hex-bar-empty');
      if (barActive) barActive.style.width = `${pct}%`;
      if (barEmpty) barEmpty.style.width = `${100 - pct}%`;

      // 2. Populate Detected Parameters Badges
      const paramsList = document.getElementById('hex-detected-params-list');
      if (paramsList) {
        let html = '';
        (dataToUse.detected_params || []).forEach(p => {
          const isHigh = p.confidence.includes('HIGH');
          const badgeColor = isHigh ? '#22c55e' : '#f59e0b';
          html += `
            <div style="background:#181818; border:1px solid #282828; border-radius:6px; padding:8px 12px; display:flex; align-items:center; justify-content:space-between; font-size:12px;">
              <div>
                <span style="font-weight:700; color:#fff;">${p.name}</span>
                <span style="font-family:monospace; color:var(--text-secondary); margin-left:8px;">[${p.offset}]</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-family:monospace; color:var(--accent); font-weight:700;">${p.value}</span>
                <span style="background:${badgeColor}22; color:${badgeColor}; border:1px solid ${badgeColor}44; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">${p.confidence}</span>
              </div>
            </div>
          `;
        });
        paramsList.innerHTML = html;
      }

      // 3. Hex Viewer Table State Setup
      hexViewerState.hexData = dataToUse.hex_data || '';
      hexViewerState.totalBytes = dataToUse.size || (hexViewerState.hexData.length / 2);
      hexViewerState.currentPage = 0;
      hexViewerState.highlightOffset = -1;

      renderHexPage();
      setupHexViewerControls();
    } else {
      if (tableContainer) tableContainer.style.display = 'block';
      hexContainer.style.display = 'none';
    }
  }

  function renderHexPage() {
    const tbody = document.getElementById('hex-table-body');
    const pageLabel = document.getElementById('hex-page-label');
    if (!tbody || !hexViewerState.hexData) return;

    const hexStr = hexViewerState.hexData;
    const totalRows = Math.ceil(hexViewerState.totalBytes / 16);
    const totalPages = Math.ceil(totalRows / hexViewerState.rowsPerPage);
    
    if (hexViewerState.currentPage < 0) hexViewerState.currentPage = 0;
    if (hexViewerState.currentPage >= totalPages) hexViewerState.currentPage = totalPages - 1;

    if (pageLabel) {
      pageLabel.textContent = `Page ${hexViewerState.currentPage + 1} / ${totalPages}`;
    }

    const startRow = hexViewerState.currentPage * hexViewerState.rowsPerPage;
    const endRow = Math.min(totalRows, startRow + hexViewerState.rowsPerPage);

    let html = '';
    for (let r = startRow; r < endRow; r++) {
      const rowOffset = r * 16;
      const offsetHex = `0x${rowOffset.toString(16).padStart(6, '0').toUpperCase()}`;
      
      let hexBytes = '';
      let asciiChars = '';

      for (let i = 0; i < 16; i++) {
        const byteIdx = rowOffset + i;
        if (byteIdx < hexViewerState.totalBytes) {
          const hexPair = hexStr.substr(byteIdx * 2, 2).toUpperCase();
          const byteVal = parseInt(hexPair, 16);
          const isHighlighted = (hexViewerState.highlightOffset >= 0 && byteIdx >= hexViewerState.highlightOffset && byteIdx < hexViewerState.highlightOffset + 4);
          const hlStyle = isHighlighted ? 'background:#f97316; color:#000; font-weight:bold; padding:0 2px; border-radius:2px;' : '';
          
          hexBytes += `<span style="${hlStyle}">${hexPair}</span> `;
          if (i === 7) hexBytes += ' ';

          if (byteVal >= 32 && byteVal <= 126) {
            const char = String.fromCharCode(byteVal);
            const escChar = char === '<' ? '&lt;' : (char === '>' ? '&gt;' : (char === '&' ? '&amp;' : char));
            asciiChars += `<span style="${hlStyle}">${escChar}</span>`;
          } else {
            asciiChars += `<span style="color:#555; ${hlStyle}">.</span>`;
          }
        } else {
          hexBytes += '   ';
        }
      }

      const isRowHighlighted = (hexViewerState.highlightOffset >= rowOffset && hexViewerState.highlightOffset < rowOffset + 16);
      const rowBg = isRowHighlighted ? 'background:rgba(249, 115, 22, 0.2); font-weight:bold;' : (r % 2 === 0 ? 'background:#141414;' : 'background:#181818;');

      html += `
        <tr style="${rowBg} border-bottom:1px solid #222;">
          <td style="padding:4px 10px; color:#3b82f6; font-weight:700;">${offsetHex}</td>
          <td style="padding:4px 10px; color:#e5e5e5; letter-spacing:0.5px;">${hexBytes}</td>
          <td style="padding:4px 10px; color:#22c55e;">${asciiChars}</td>
        </tr>
      `;
    }

    tbody.innerHTML = html;
  }

  function setupHexViewerControls() {
    const btnPrev = document.getElementById('btn-hex-prev');
    const btnNext = document.getElementById('btn-hex-next');
    const btnJump = document.getElementById('btn-hex-jump');
    const inputOffset = document.getElementById('hex-search-offset');

    if (btnPrev) {
      btnPrev.onclick = () => {
        if (hexViewerState.currentPage > 0) {
          hexViewerState.currentPage--;
          renderHexPage();
        }
      };
    }

    if (btnNext) {
      btnNext.onclick = () => {
        const totalRows = Math.ceil(hexViewerState.totalBytes / 16);
        const totalPages = Math.ceil(totalRows / hexViewerState.rowsPerPage);
        if (hexViewerState.currentPage < totalPages - 1) {
          hexViewerState.currentPage++;
          renderHexPage();
        }
      };
    }

    if (btnJump && inputOffset) {
      btnJump.onclick = () => {
        let val = inputOffset.value.trim().toLowerCase();
        if (!val) return;
        if (val.startsWith('0x')) val = val.substring(2);
        const targetOffset = parseInt(val, 16);

        if (isNaN(targetOffset) || targetOffset < 0 || targetOffset >= hexViewerState.totalBytes) {
          App.toast('warning', 'Invalid Offset', 'Offset out of file memory bounds');
          return;
        }

        const targetRow = Math.floor(targetOffset / 16);
        hexViewerState.currentPage = Math.floor(targetRow / hexViewerState.rowsPerPage);
        hexViewerState.highlightOffset = targetOffset;
        renderHexPage();
        App.toast('success', 'Offset Found', `Jumped to 0x${targetOffset.toString(16).padStart(6, '0').toUpperCase()}`);
      };
    }
  }

  // ---- DEFINITION EDITOR (XDF SCHEMA MANAGER) ----
  let activeDefinitionDraft = null;

  function initDefinitionEditor() {
    const btnDefEditor = document.getElementById('btn-def-editor');
    const modalDef = document.getElementById('definition-editor-modal');
    const headerDef = document.getElementById('def-editor-header');
    const btnClose = document.getElementById('btn-def-editor-close');
    const btnCancel = document.getElementById('btn-def-cancel');
    const btnAddTable = document.getElementById('btn-def-add-table');
    const btnAddScalar = document.getElementById('btn-def-add-scalar');
    const btnTestRead = document.getElementById('btn-def-test-read');
    const btnSaveJson = document.getElementById('btn-def-save-json');

    if (modalDef && headerDef) {
      makeModalDraggable(modalDef, headerDef);
    }

    if (btnDefEditor) {
      btnDefEditor.addEventListener('click', () => {
        const targetId = (mapData && mapData.ecuId) ? mapData.ecuId : 'K60A';
        fetchDefinition(targetId);
        if (modalDef) modalDef.style.display = 'flex';
      });
    }

    if (btnClose) btnClose.addEventListener('click', () => { if (modalDef) modalDef.style.display = 'none'; });
    if (btnCancel) btnCancel.addEventListener('click', () => { if (modalDef) modalDef.style.display = 'none'; });

    if (btnAddTable) {
      btnAddTable.addEventListener('click', () => {
        if (!activeDefinitionDraft) return;
        if (!activeDefinitionDraft.tables) activeDefinitionDraft.tables = [];
        activeDefinitionDraft.tables.push({
          id: `custom_table_${Date.now().toString().slice(-4)}`,
          name: "New Table Map",
          category: "Fuel / Injection",
          address: "0x0190EE",
          dataType: "uint16",
          endianness: "big",
          rows: 16,
          cols: 16,
          scaling: { formula: "raw / 100.0", inverseFormula: "raw * 100.0", unit: "ms" },
          verified: false
        });
        renderDefinitionForms();
      });
    }

    if (btnAddScalar) {
      btnAddScalar.addEventListener('click', () => {
        if (!activeDefinitionDraft) return;
        if (!activeDefinitionDraft.scalars) activeDefinitionDraft.scalars = [];
        activeDefinitionDraft.scalars.push({
          id: `custom_scalar_${Date.now().toString().slice(-4)}`,
          name: "New Scalar Parameter",
          category: "Limiters",
          address: "0x018E14",
          dataType: "uint16",
          endianness: "big",
          scaling: { formula: "raw", inverseFormula: "raw", unit: "RPM" },
          verified: true
        });
        renderDefinitionForms();
      });
    }

    if (btnTestRead) {
      btnTestRead.addEventListener('click', () => {
        syncFormsToDraft();
        API.request('POST', '/api/definition/test_read', { definition: activeDefinitionDraft })
          .then(res => {
            if (res.status === 'ok') {
              renderTestReadPreview(res.test_scalars, res.test_tables);
            } else {
              App.toast('error', 'Test Read Error', res.error || 'Failed to test read binary');
            }
          })
          .catch(err => App.toast('error', 'Test Read Error', err.message));
      });
    }

    if (btnSaveJson) {
      btnSaveJson.addEventListener('click', () => {
        syncFormsToDraft();
        API.request('POST', '/api/definition/save', { definition: activeDefinitionDraft })
          .then(res => {
            if (res.status === 'ok') {
              App.toast('success', 'Definition Saved', `Saved definition ${res.filename} to project definitions database`);
              if (modalDef) modalDef.style.display = 'none';
            } else {
              App.toast('error', 'Save Error', res.error || 'Failed to save definition file');
            }
          })
          .catch(err => App.toast('error', 'Save Error', err.message));
      });
    }
  }

  function fetchDefinition(ecuId) {
    API.request('POST', '/api/definition/load', { ecuId: ecuId })
      .then(res => {
        if (res.status === 'ok' && res.definition) {
          activeDefinitionDraft = res.definition;
          renderDefinitionForms();
        }
      })
      .catch(() => {
        activeDefinitionDraft = {
          metadata: { ecuId: "38770-K60A-B01", modelName: "Honda Vario 125 eSP All New (K60A)", mcuArch: "Renesas V850 / RH850", firmwareId: "SV850T06C121RV101" },
          tables: [],
          scalars: []
        };
        renderDefinitionForms();
      });
  }

  function renderDefinitionForms() {
    if (!activeDefinitionDraft) return;
    const meta = activeDefinitionDraft.metadata || {};

    const elEcuId = document.getElementById('def-meta-ecuid');
    const elModel = document.getElementById('def-meta-model');
    const elArch = document.getElementById('def-meta-arch');
    const elFw = document.getElementById('def-meta-fw');

    if (elEcuId) elEcuId.value = meta.ecuId || '';
    if (elModel) elModel.value = meta.modelName || '';
    if (elArch) elArch.value = meta.mcuArch || '';
    if (elFw) elFw.value = meta.firmwareId || '';

    // Render Tables List Form
    const tablesContainer = document.getElementById('def-tables-list');
    if (tablesContainer) {
      let html = '';
      (activeDefinitionDraft.tables || []).forEach((t, idx) => {
        html += `
          <div style="background:#202020; border:1px solid #333; border-radius:6px; padding:12px; display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)) 40px; gap:8px; align-items:center;">
            <div><label style="font-size:10px; color:#888;">Name:</label><input type="text" class="def-tbl-name" data-idx="${idx}" value="${t.name || ''}" style="width:100%; background:#141414; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; font-size:11px;"></div>
            <div><label style="font-size:10px; color:#888;">Category:</label><input type="text" class="def-tbl-cat" data-idx="${idx}" value="${t.category || ''}" style="width:100%; background:#141414; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; font-size:11px;"></div>
            <div><label style="font-size:10px; color:#888;">Address:</label><input type="text" class="def-tbl-addr" data-idx="${idx}" value="${t.address || ''}" style="width:100%; background:#141414; border:1px solid #444; color:#38bdf8; font-family:monospace; padding:4px; border-radius:4px; font-size:11px;"></div>
            <div><label style="font-size:10px; color:#888;">Type:</label><input type="text" class="def-tbl-dtype" data-idx="${idx}" value="${t.dataType || 'uint16'}" style="width:100%; background:#141414; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; font-size:11px;"></div>
            <div><label style="font-size:10px; color:#888;">Rows x Cols:</label><div style="display:flex; gap:2px;"><input type="number" class="def-tbl-rows" data-idx="${idx}" value="${t.rows || 16}" style="width:50%; background:#141414; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; font-size:11px;"><input type="number" class="def-tbl-cols" data-idx="${idx}" value="${t.cols || 16}" style="width:50%; background:#141414; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; font-size:11px;"></div></div>
            <div><label style="font-size:10px; color:#888;">Formula:</label><input type="text" class="def-tbl-formula" data-idx="${idx}" value="${(t.scaling && t.scaling.formula) ? t.scaling.formula : 'raw / 100.0'}" style="width:100%; background:#141414; border:1px solid #444; color:#eab308; font-family:monospace; padding:4px; border-radius:4px; font-size:11px;"></div>
            <div><label style="font-size:10px; color:#888;">Verified:</label><select class="def-tbl-verified" data-idx="${idx}" style="width:100%; background:#141414; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; font-size:11px;"><option value="true" ${t.verified ? 'selected' : ''}>YES (Verified)</option><option value="false" ${!t.verified ? 'selected' : ''}>NO (Unverified)</option></select></div>
            <button onclick="MapEditor.removeDefTable(${idx})" style="background:#ef4444; border:none; color:#fff; border-radius:4px; height:28px; cursor:pointer; font-weight:bold;">&times;</button>
          </div>
        `;
      });
      tablesContainer.innerHTML = html;
    }

    // Render Scalars List Form
    const scalarsContainer = document.getElementById('def-scalars-list');
    if (scalarsContainer) {
      let html = '';
      (activeDefinitionDraft.scalars || []).forEach((s, idx) => {
        html += `
          <div style="background:#202020; border:1px solid #333; border-radius:6px; padding:12px; display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)) 40px; gap:8px; align-items:center;">
            <div><label style="font-size:10px; color:#888;">Name:</label><input type="text" class="def-sc-name" data-idx="${idx}" value="${s.name || ''}" style="width:100%; background:#141414; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; font-size:11px;"></div>
            <div><label style="font-size:10px; color:#888;">Category:</label><input type="text" class="def-sc-cat" data-idx="${idx}" value="${s.category || ''}" style="width:100%; background:#141414; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; font-size:11px;"></div>
            <div><label style="font-size:10px; color:#888;">Address:</label><input type="text" class="def-sc-addr" data-idx="${idx}" value="${s.address || ''}" style="width:100%; background:#141414; border:1px solid #444; color:#38bdf8; font-family:monospace; padding:4px; border-radius:4px; font-size:11px;"></div>
            <div><label style="font-size:10px; color:#888;">Type:</label><input type="text" class="def-sc-dtype" data-idx="${idx}" value="${s.dataType || 'uint16'}" style="width:100%; background:#141414; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; font-size:11px;"></div>
            <div><label style="font-size:10px; color:#888;">Unit:</label><input type="text" class="def-sc-unit" data-idx="${idx}" value="${(s.scaling && s.scaling.unit) ? s.scaling.unit : ''}" style="width:100%; background:#141414; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; font-size:11px;"></div>
            <div><label style="font-size:10px; color:#888;">Verified:</label><select class="def-sc-verified" data-idx="${idx}" style="width:100%; background:#141414; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; font-size:11px;"><option value="true" ${s.verified ? 'selected' : ''}>YES (Verified)</option><option value="false" ${!s.verified ? 'selected' : ''}>NO (Unverified)</option></select></div>
            <button onclick="MapEditor.removeDefScalar(${idx})" style="background:#ef4444; border:none; color:#fff; border-radius:4px; height:28px; cursor:pointer; font-weight:bold;">&times;</button>
          </div>
        `;
      });
      scalarsContainer.innerHTML = html;
    }
  }

  function syncFormsToDraft() {
    if (!activeDefinitionDraft) return;
    if (!activeDefinitionDraft.metadata) activeDefinitionDraft.metadata = {};
    activeDefinitionDraft.metadata.ecuId = document.getElementById('def-meta-ecuid')?.value || '38770-K60A-B01';
    activeDefinitionDraft.metadata.modelName = document.getElementById('def-meta-model')?.value || 'Honda Vario 125 eSP All New (K60A)';
    activeDefinitionDraft.metadata.mcuArch = document.getElementById('def-meta-arch')?.value || 'Renesas V850 / RH850';
    activeDefinitionDraft.metadata.firmwareId = document.getElementById('def-meta-fw')?.value || 'SV850T06C121RV101';

    // Sync Tables
    document.querySelectorAll('#def-tables-list > div').forEach((row, idx) => {
      if (activeDefinitionDraft.tables[idx]) {
        const t = activeDefinitionDraft.tables[idx];
        t.name = row.querySelector('.def-tbl-name')?.value || t.name;
        t.category = row.querySelector('.def-tbl-cat')?.value || t.category;
        t.address = row.querySelector('.def-tbl-addr')?.value || t.address;
        t.dataType = row.querySelector('.def-tbl-dtype')?.value || t.dataType;
        t.rows = parseInt(row.querySelector('.def-tbl-rows')?.value || t.rows);
        t.cols = parseInt(row.querySelector('.def-tbl-cols')?.value || t.cols);
        if (!t.scaling) t.scaling = {};
        t.scaling.formula = row.querySelector('.def-tbl-formula')?.value || t.scaling.formula;
        t.verified = row.querySelector('.def-tbl-verified')?.value === 'true';
      }
    });

    // Sync Scalars
    document.querySelectorAll('#def-scalars-list > div').forEach((row, idx) => {
      if (activeDefinitionDraft.scalars[idx]) {
        const s = activeDefinitionDraft.scalars[idx];
        s.name = row.querySelector('.def-sc-name')?.value || s.name;
        s.category = row.querySelector('.def-sc-cat')?.value || s.category;
        s.address = row.querySelector('.def-sc-addr')?.value || s.address;
        s.dataType = row.querySelector('.def-sc-dtype')?.value || s.dataType;
        if (!s.scaling) s.scaling = {};
        s.scaling.unit = row.querySelector('.def-sc-unit')?.value || s.scaling.unit;
        s.verified = row.querySelector('.def-sc-verified')?.value === 'true';
      }
    });
  }

  function renderTestReadPreview(scalars, tables) {
    const previewPanel = document.getElementById('def-preview-panel');
    const previewContent = document.getElementById('def-preview-content');
    if (!previewPanel || !previewContent) return;

    previewPanel.style.display = 'block';
    let html = '<div style="margin-bottom:12px;"><strong style="color:#22c55e;">SCALARS READ TEST:</strong></div>';
    
    (scalars || []).forEach(sc => {
      const isPl = sc.plausible ? '<span style="color:#22c55e;">[PLAUSIBLE ✓]</span>' : '<span style="color:#ef4444;">[CHECK FORMULA ⚠️]</span>';
      html += `<div>• <strong>${sc.name}</strong> [${sc.address}]: Raw <code>${sc.raw}</code> -> Parsed Value: <strong style="color:var(--accent);">${sc.value} ${sc.unit}</strong> ${isPl}</div>`;
    });

    html += '<div style="margin-top:14px; margin-bottom:12px;"><strong style="color:#38bdf8;">TABLES READ TEST (SAMPLE ROW 1):</strong></div>';
    (tables || []).forEach(tbl => {
      html += `<div>• <strong>${tbl.name}</strong> [${tbl.address}] (${tbl.rows}x${tbl.cols}): Sample Row 1: [${(tbl.preview_sample || []).join(', ')}]</div>`;
    });

    previewContent.innerHTML = html;
  }

  function removeDefTable(idx) {
    if (activeDefinitionDraft && activeDefinitionDraft.tables[idx]) {
      activeDefinitionDraft.tables.splice(idx, 1);
      renderDefinitionForms();
    }
  }

  function removeDefScalar(idx) {
    if (activeDefinitionDraft && activeDefinitionDraft.scalars[idx]) {
      activeDefinitionDraft.scalars.splice(idx, 1);
      renderDefinitionForms();
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    init: init,
    renderPlotly3D: renderPlotly3D,
    drawGauges: drawGauges,
    applyPreset: applyMapPreset,
    getMapData: () => mapData,
    openCurveEdit: openCurveEditModal,
    saveToBuffer: saveToBuffer,
    updateLiveCursor: highlightActiveCell,
    updateStatus: updateStatus,
    setDashboardOffline: setDashboardOffline,
    removeDefTable: removeDefTable,
    removeDefScalar: removeDefScalar
  };


})();
