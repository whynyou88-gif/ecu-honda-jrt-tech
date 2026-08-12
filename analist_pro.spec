# -*- mode: python ; coding: utf-8 -*-
# ============================================================
# analist_pro.spec — Optimized PyInstaller Onedir Spec
# JRT Tech ANALIST Pro 3.4 - Honda ECU Remap Studio
#
# Usage:  pyinstaller analist_pro.spec --clean
# Output: dist/JRT Tech ANALIST Pro/  (onedir folder)
# ============================================================

import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(SPEC))
SEP = ';' if sys.platform == 'win32' else ':'

# ---- DATA BUNDLES ----
# All paths are RELATIVE to project root (SPEC directory)
datas_list = [
    # Full HondaECUTool data directory (web frontend, definitions, ecu_db, config, backup, log)
    (os.path.join(SCRIPT_DIR, 'HondaECUTool', 'data'), os.path.join('HondaECUTool', 'data')),
    # Backend server script (loaded dynamically via importlib in frozen mode)
    (os.path.join(SCRIPT_DIR, 'localhost_server.py'), '.'),
    # Seed key provider (crypto authentication)
    (os.path.join(SCRIPT_DIR, 'seed_key_provider.py'), '.'),
    # Driver package (HondaECU, HondaECU_Serial, HondaPGMFI, etc.)
    (os.path.join(SCRIPT_DIR, 'drivers'), 'drivers'),
    # Protocol definitions (K-Line session, transport, security)
    (os.path.join(SCRIPT_DIR, 'protocols'), 'protocols'),
    # Framework package (core, flash, transport, plugins, live_data, database, analyzer, developer)
    (os.path.join(SCRIPT_DIR, 'framework'), 'framework'),
    # Plugin JSON configs (honda_kline.json, yamaha_yec.json)
    (os.path.join(SCRIPT_DIR, 'plugins'), 'plugins'),
    # EULA license text
    (os.path.join(SCRIPT_DIR, 'EULA_LICENSE.txt'), '.'),
    # Activation readme
    (os.path.join(SCRIPT_DIR, 'README_CARA_AKTIVASI.txt'), '.'),
]

# Filter out any paths that don't exist on this build machine
datas_list = [(src, dst) for src, dst in datas_list if os.path.exists(src)]

# ---- HIDDEN IMPORTS ----
# These are needed because PyInstaller cannot detect:
#   1. importlib.util dynamic loading of localhost_server.py (line 94-97 in AnalistProStudioApp.py)
#   2. pywebview platform backends (selected at runtime based on OS)
#   3. aiohttp submodule web components (lazy imports)
#   4. driver/framework modules loaded by the server
hidden_imports_list = [
    # --- pywebview GUI backends (Windows) ---
    'webview',
    'webview.platforms',
    'webview.platforms.winforms',
    'webview.platforms.edgechromium',
    'webview.platforms.mshtml',
    'webview.platforms.edgehtml',
    'webview.platforms.cef',
    'webview.js',
    'webview.js.api',
    # Windows GUI bindings required by pywebview winforms backend
    'clr',
    'clr_loader',
    'pythonnet',
    'bottle',
    'ctypes',
    'ctypes.wintypes',

    # --- aiohttp (localhost HTTP server) ---
    'aiohttp',
    'aiohttp.web',
    'aiohttp.web_runner',
    'aiohttp.web_server',
    'aiohttp.web_app',
    'aiohttp.web_request',
    'aiohttp.web_response',
    'aiohttp.web_routedef',
    'aiohttp.web_middlewares',
    'aiohttp.web_exceptions',
    'aiohttp.web_fileresponse',
    'aiohttp.web_urldispatcher',
    'aiohttp.web_ws',
    # aiohttp C-extension dependencies
    'multidict',
    'multidict._multidict',
    'yarl',
    'yarl._quoting',
    'frozenlist',

    # --- pyserial (FTDI K-Line USB adapter) ---
    'serial',
    'serial.tools',
    'serial.tools.list_ports',
    'serial.tools.list_ports_common',
    'serial.tools.list_ports_windows',
    'serial.serialutil',
    'serial.serialwin32',

    # --- pylibftdi (optional direct FTDI driver) ---
    'pylibftdi',
    'pylibftdi.driver',
    'pylibftdi.device',
    'pylibftdi._base',

    # --- Project: drivers package ---
    'drivers',
    'drivers.HondaECU',
    'drivers.HondaECU_Serial',
    'drivers.HondaPGMFI',
    'drivers.CustomFTDI',
    'drivers.KawasakiKDS',
    'drivers.SuzukiSDS',
    'drivers.YamahaYEC',
    'drivers.ecmids',
    'drivers.ecu_driver_base',
    'drivers.hardware_adapter',
    'drivers.plugin_engine',

    # --- Project: protocols package ---
    'protocols',
    'protocols.session',
    'protocols.transport',
    'protocols.security',
    'protocols.state_machine',
    'protocols.models',
    'protocols.constants',
    'protocols.exceptions',

    # --- Project: framework package ---
    'framework',
    'framework.core',
    'framework.core.models',
    'framework.core.exceptions',
    'framework.core.constants',
    'framework.core.state_machine',
    'framework.flash',
    'framework.flash.base_flash',
    'framework.flash.keihin_flash',
    'framework.flash.recovery',
    'framework.transport',
    'framework.transport.base',
    'framework.transport.factory',
    'framework.transport.serial_transport',
    'framework.transport.simulated_transport',
    'framework.plugins',
    'framework.plugins.factory',
    'framework.plugins.base_protocol',
    'framework.plugins.keihin_kline',
    'framework.live_data',
    'framework.live_data.repository',
    'framework.live_data.engine',
    'framework.live_data.graph_backend',
    'framework.database',
    'framework.database.ecu_database',
    'framework.analyzer',
    'framework.analyzer.packet_decoder',
    'framework.analyzer.protocol_analyzer',
    'framework.analyzer.session_logger',
    'framework.developer',
    'framework.developer.dev_panel',

    # --- seed_key_provider (loaded by server) ---
    'seed_key_provider',

    # --- stdlib modules PyInstaller sometimes misses ---
    'hashlib',
    'zlib',
    'struct',
    'asyncio',
    'concurrent',
    'concurrent.futures',
    'json',
    'math',
    'datetime',
    'tempfile',
    'importlib',
    'importlib.util',
]

# ---- EXCLUDES ----
# Verified unused: no imports to these anywhere in the project
excludes_list = [
    # GUI frameworks NOT used (pywebview uses winforms/edgechromium, not Qt/Tk)
    'tkinter', '_tkinter', 'tcl', 'tk',
    'PyQt5', 'PyQt6', 'PySide2', 'PySide6',
    'wx',
    # Heavy scientific libs not used
    'numpy', 'numpy.tests',
    'scipy', 'scipy.tests',
    'pandas',
    'matplotlib', 'matplotlib.tests',
    'PIL', 'Pillow',
    # Jupyter/IPython ecosystem
    'IPython', 'notebook', 'jupyter', 'jupyter_core', 'jupyter_client',
    # Testing frameworks
    'unittest', 'pytest', 'doctest', 'pydoc',
    # Network libs not used
    'scapy',
    'twisted',
    'tornado',
    # Misc
    'jinja2', 'markupsafe',
    'setuptools',
    'distutils',
    'lib2to3',
    'xmlrpc',
    'email',
    'pydoc_data',
]

# ---- ICON ----
icon_path = os.path.join(SCRIPT_DIR, 'icon.ico')
icon_list = [icon_path] if os.path.isfile(icon_path) else []

# ============================================================
# PyInstaller Build Configuration
# ============================================================

a = Analysis(
    [os.path.join(SCRIPT_DIR, 'AnalistProStudioApp.py')],
    pathex=[SCRIPT_DIR],
    binaries=[],
    datas=datas_list,
    hiddenimports=hidden_imports_list,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes_list,
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,     # CRITICAL: True = onedir mode. False = onefile.
    name='JRT Tech ANALIST Pro',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,             # Windowed mode, no terminal
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=icon_list,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[
        # Qt DLLs — UPX compression causes AV false positives & crashes
        'Qt6Core.dll',
        'Qt6Gui.dll',
        'Qt6Widgets.dll',
        'Qt6WebEngineCore.dll',
        'Qt5Core.dll',
        'Qt5Gui.dll',
        'Qt5Widgets.dll',
        # Python core DLL — UPX here causes startup crash
        'python3.dll',
        'python310.dll',
        'python311.dll',
        'python312.dll',
        'python313.dll',
        # VCRT — compressing these triggers Windows Defender
        'vcruntime140.dll',
        'vcruntime140_1.dll',
        'ucrtbase.dll',
        'msvcp140.dll',
        # .NET / CLR assemblies used by pywebview winforms
        'clrjit.dll',
        'coreclr.dll',
        'WebView2Loader.dll',
    ],
    name='JRT Tech ANALIST Pro',
)
