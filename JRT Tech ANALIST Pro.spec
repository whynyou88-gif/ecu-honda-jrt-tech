# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['/Users/ferdyvalentino/Downloads/remap-ecu-honda-main/AnalistProStudioApp.py'],
    pathex=[],
    binaries=[],
    datas=[('/Users/ferdyvalentino/Downloads/remap-ecu-honda-main/HondaECUTool/data/web', 'HondaECUTool/data/web'), ('/Users/ferdyvalentino/Downloads/remap-ecu-honda-main/localhost_server.py', '.'), ('/Users/ferdyvalentino/Downloads/remap-ecu-honda-main/seed_key_provider.py', '.'), ('/Users/ferdyvalentino/Downloads/remap-ecu-honda-main/drivers', 'drivers'), ('/Users/ferdyvalentino/Downloads/remap-ecu-honda-main/protocols', 'protocols'), ('/Users/ferdyvalentino/Downloads/remap-ecu-honda-main/framework', 'framework'), ('/Users/ferdyvalentino/Downloads/remap-ecu-honda-main/plugins', 'plugins')],
    hiddenimports=['webview', 'webview.platforms.cocoa', 'aiohttp', 'aiohttp.web', 'aiohttp.web_runner', 'aiohttp.web_server', 'aiohttp.web_app', 'aiohttp.web_request', 'aiohttp.web_response', 'aiohttp.web_routedef', 'aiohttp.web_middlewares', 'aiohttp.web_exceptions', 'aiohttp.web_fileresponse', 'aiohttp.web_urldispatcher', 'aiohttp.web_ws', 'multidict', 'yarl', 'frozenlist', 'serial', 'serial.tools', 'serial.tools.list_ports', 'serial.tools.list_ports_common', 'serial.tools.list_ports_posix', 'serial.serialutil', 'serial.serialposix', 'pylibftdi', 'pylibftdi.driver', 'pylibftdi.device', 'pylibftdi._base', 'drivers', 'drivers.HondaECU', 'drivers.HondaECU_Serial', 'drivers.HondaPGMFI', 'drivers.CustomFTDI', 'drivers.KawasakiKDS', 'drivers.SuzukiSDS', 'drivers.YamahaYEC', 'drivers.ecmids', 'drivers.ecu_driver_base', 'drivers.hardware_adapter', 'drivers.plugin_engine', 'protocols', 'protocols.session', 'protocols.transport', 'protocols.security', 'protocols.state_machine', 'protocols.models', 'protocols.constants', 'protocols.exceptions', 'framework', 'framework.core', 'framework.core.models', 'framework.core.exceptions', 'framework.core.constants', 'framework.core.state_machine', 'framework.flash', 'framework.flash.base_flash', 'framework.flash.keihin_flash', 'framework.flash.recovery', 'framework.transport', 'framework.transport.base', 'framework.transport.factory', 'framework.transport.serial_transport', 'framework.transport.simulated_transport', 'framework.plugins', 'framework.plugins.factory', 'framework.plugins.base_protocol', 'framework.plugins.keihin_kline', 'framework.live_data', 'framework.live_data.repository', 'framework.live_data.engine', 'framework.live_data.graph_backend', 'framework.database', 'framework.database.ecu_database', 'framework.analyzer', 'framework.analyzer.packet_decoder', 'framework.analyzer.protocol_analyzer', 'framework.analyzer.session_logger', 'framework.developer', 'framework.developer.dev_panel', 'seed_key_provider', 'hashlib', 'zlib', 'struct', 'asyncio', 'tempfile', 'importlib', 'importlib.util'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='JRT Tech ANALIST Pro',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['/Users/ferdyvalentino/Downloads/remap-ecu-honda-main/icon.icns'],
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='JRT Tech ANALIST Pro',
)
app = BUNDLE(
    coll,
    name='JRT Tech ANALIST Pro.app',
    icon='/Users/ferdyvalentino/Downloads/remap-ecu-honda-main/icon.icns',
    bundle_identifier='com.jrt-tech.analist-pro',
)
