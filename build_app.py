#!/usr/bin/env python3
"""
Build Script - Package JRT Tect ANALIST Pro 3.4 into a standalone macOS .app
Uses PyInstaller to create a distributable application bundle.
"""

import os
import sys
import subprocess
import shutil

# Patch dis._get_const_info to prevent PyInstaller crash on bytecode anomalies
try:
    import dis
    original_get_const_info = dis._get_const_info
    def new_get_const_info(*args, **kwargs):
        try:
            return original_get_const_info(*args, **kwargs)
        except IndexError:
            const_index = args[0] if args else 0
            return (f"<invalid_const_{const_index}>", repr(f"<invalid_const_{const_index}>"))
    dis._get_const_info = new_get_const_info
except Exception as e:
    print(f"[Build] Warning: failed to patch dis module: {e}")

APP_NAME = "JRT Tech ANALIST Pro"
VERSION = "3.4"
BUNDLE_ID = "com.jrt-tech.analist-pro"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MAIN_SCRIPT = os.path.join(SCRIPT_DIR, "AnalistProStudioApp.py")
SERVER_SCRIPT = os.path.join(SCRIPT_DIR, "localhost_server.py")
WEB_DIR = os.path.join(SCRIPT_DIR, "HondaECUTool", "data", "web")
DIST_DIR = os.path.join(SCRIPT_DIR, "dist")
BUILD_DIR = os.path.join(SCRIPT_DIR, "build")

def check_dependencies():
    """Ensure PyInstaller and other deps are available"""
    try:
        import PyInstaller
        print(f"[OK] PyInstaller {PyInstaller.__version__} found")
    except ImportError:
        print("[INSTALL] Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

    try:
        import webview
        print(f"[OK] pywebview found")
    except ImportError:
        print("[INSTALL] Installing pywebview...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pywebview"])

    try:
        import aiohttp
        print(f"[OK] aiohttp found")
    except ImportError:
        print("[INSTALL] Installing aiohttp...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "aiohttp"])

def build():
    check_dependencies()

    print(f"\n{'='*60}")
    print(f"  Building {APP_NAME} v{VERSION}")
    print(f"  Target: macOS .app bundle")
    print(f"{'='*60}\n")

    # Clean previous builds
    for d in [DIST_DIR, BUILD_DIR]:
        if os.path.exists(d):
            try:
                shutil.rmtree(d, ignore_errors=True)
                print(f"[CLEAN] Removed {d}")
            except Exception as e:
                print(f"[CLEAN] Warning clearing {d}: {e}")

    sep = ":"

    excludes = [
        "numpy", "PIL", "Pillow", "jinja2", "markupsafe",
        "tkinter", "_tkinter", "tcl", "tk", "matplotlib", "scipy", "pandas",
        "IPython", "notebook", "jupyter", "wx", "PyQt5", "PyQt6", "PySide2",
        "PySide6", "scapy", "unittest", "pydoc", "doctest"
    ]

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name", APP_NAME,
        "--windowed",
        "--onedir",
        "--noconfirm",
        "--clean",
    ]

    for exc in excludes:
        cmd.extend(["--exclude-module", exc])

    cmd.extend([
        "--add-data", f"{WEB_DIR}{sep}HondaECUTool/data/web",
        "--add-data", f"{SERVER_SCRIPT}{sep}.",
        "--add-data", f"{os.path.join(SCRIPT_DIR, 'seed_key_provider.py')}{sep}.",
        "--add-data", f"{os.path.join(SCRIPT_DIR, 'drivers')}{sep}drivers",
        "--add-data", f"{os.path.join(SCRIPT_DIR, 'protocols')}{sep}protocols",
        "--add-data", f"{os.path.join(SCRIPT_DIR, 'framework')}{sep}framework",
        "--add-data", f"{os.path.join(SCRIPT_DIR, 'plugins')}{sep}plugins",
        "--hidden-import", "webview",
        "--hidden-import", "webview.platforms",
        "--hidden-import", "webview.platforms.cocoa",
        "--hidden-import", "webview.platforms.winforms",
        "--hidden-import", "webview.platforms.mshtml",
        "--hidden-import", "webview.platforms.edgechromium",
        "--hidden-import", "webview.js",
        "--hidden-import", "webview.js.api",
        "--hidden-import", "aiohttp",
        "--hidden-import", "aiohttp.web",
        "--hidden-import", "aiohttp.web_runner",
        "--hidden-import", "aiohttp.web_server",
        "--hidden-import", "aiohttp.web_app",
        "--hidden-import", "aiohttp.web_request",
        "--hidden-import", "aiohttp.web_response",
        "--hidden-import", "aiohttp.web_routedef",
        "--hidden-import", "aiohttp.web_middlewares",
        "--hidden-import", "aiohttp.web_exceptions",
        "--hidden-import", "aiohttp.web_fileresponse",
        "--hidden-import", "aiohttp.web_urldispatcher",
        "--hidden-import", "aiohttp.web_ws",
        "--hidden-import", "multidict",
        "--hidden-import", "yarl",
        "--hidden-import", "frozenlist",
        "--hidden-import", "email",
        "--hidden-import", "http",
        "--hidden-import", "urllib",
        "--hidden-import", "serial",
        "--hidden-import", "serial.tools",
        "--hidden-import", "serial.tools.list_ports",
        "--hidden-import", "serial.tools.list_ports_common",
        "--hidden-import", "serial.tools.list_ports_posix",
        "--hidden-import", "serial.serialutil",
        "--hidden-import", "serial.serialposix",
        "--hidden-import", "pylibftdi",
        "--hidden-import", "pylibftdi.driver",
        "--hidden-import", "pylibftdi.device",
        "--hidden-import", "pylibftdi._base",
        "--hidden-import", "drivers",
        "--hidden-import", "drivers.HondaECU",
        "--hidden-import", "drivers.HondaECU_Serial",
        "--hidden-import", "drivers.HondaPGMFI",
        "--hidden-import", "drivers.CustomFTDI",
        "--hidden-import", "drivers.KawasakiKDS",
        "--hidden-import", "drivers.SuzukiSDS",
        "--hidden-import", "drivers.YamahaYEC",
        "--hidden-import", "drivers.ecmids",
        "--hidden-import", "drivers.ecu_driver_base",
        "--hidden-import", "drivers.hardware_adapter",
        "--hidden-import", "drivers.plugin_engine",
        "--hidden-import", "protocols",
        "--hidden-import", "protocols.session",
        "--hidden-import", "protocols.transport",
        "--hidden-import", "protocols.security",
        "--hidden-import", "protocols.state_machine",
        "--hidden-import", "protocols.models",
        "--hidden-import", "protocols.constants",
        "--hidden-import", "protocols.exceptions",
        "--hidden-import", "framework",
        "--hidden-import", "framework.core",
        "--hidden-import", "framework.core.models",
        "--hidden-import", "framework.core.exceptions",
        "--hidden-import", "framework.core.constants",
        "--hidden-import", "framework.core.state_machine",
        "--hidden-import", "framework.flash",
        "--hidden-import", "framework.flash.base_flash",
        "--hidden-import", "framework.flash.keihin_flash",
        "--hidden-import", "framework.flash.recovery",
        "--hidden-import", "framework.transport",
        "--hidden-import", "framework.transport.base",
        "--hidden-import", "framework.transport.factory",
        "--hidden-import", "framework.transport.serial_transport",
        "--hidden-import", "framework.transport.simulated_transport",
        "--hidden-import", "framework.plugins",
        "--hidden-import", "framework.plugins.factory",
        "--hidden-import", "framework.plugins.base_protocol",
        "--hidden-import", "framework.plugins.keihin_kline",
        "--hidden-import", "framework.live_data",
        "--hidden-import", "framework.live_data.repository",
        "--hidden-import", "framework.live_data.engine",
        "--hidden-import", "framework.live_data.graph_backend",
        "--hidden-import", "framework.database",
        "--hidden-import", "framework.database.ecu_database",
        "--hidden-import", "framework.analyzer",
        "--hidden-import", "framework.analyzer.packet_decoder",
        "--hidden-import", "framework.analyzer.protocol_analyzer",
        "--hidden-import", "framework.analyzer.session_logger",
        "--hidden-import", "framework.developer",
        "--hidden-import", "framework.developer.dev_panel",
        "--hidden-import", "seed_key_provider",
        "--hidden-import", "hashlib",
        "--hidden-import", "zlib",
        "--hidden-import", "struct",
        "--hidden-import", "asyncio",
        "--hidden-import", "tempfile",
        "--hidden-import", "importlib",
        "--hidden-import", "importlib.util",
        "--osx-bundle-identifier", BUNDLE_ID,
        MAIN_SCRIPT
    ])

    icon_icns = os.path.join(SCRIPT_DIR, "icon.icns")
    if os.path.isfile(icon_icns):
        cmd.insert(-1, "--icon")
        cmd.insert(-1, icon_icns)

    print("[BUILD] Running PyInstaller in-process...")
    try:
        import PyInstaller.__main__
        PyInstaller.__main__.run(cmd[3:])
        class DummyResult:
            returncode = 0
        result = DummyResult()
    except SystemExit as e:
        class DummyResult:
            returncode = e.code if isinstance(e.code, int) else 0
        result = DummyResult()
    except Exception as e:
        print(f"[BUILD] PyInstaller failed with error: {e}")
        class DummyResult:
            returncode = 1
        result = DummyResult()

    if result.returncode == 0:
        app_path = os.path.join(DIST_DIR, f"{APP_NAME}.app")
        if os.path.exists(app_path):
            size_mb = sum(
                os.path.getsize(os.path.join(dp, f))
                for dp, dn, fn in os.walk(app_path)
                for f in fn
            ) / (1024 * 1024)
            print(f"\n{'='*60}")
            print(f"  SUCCESS! Created {APP_NAME}.app")
            print(f"  Path: {app_path}")
            print(f"  Size: {size_mb:.1f} MB")
            print(f"{'='*60}\n")
            return True

    print(f"\n❌ Build failed with exit code {result.returncode}")
    return False

if __name__ == "__main__":
    success = build()
    sys.exit(0 if success else 1)
