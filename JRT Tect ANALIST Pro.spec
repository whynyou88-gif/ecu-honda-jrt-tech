# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['/Users/ferdyvalentino/Downloads/remap-ecu-honda-main/AnalistProStudioApp.py'],
    pathex=[],
    binaries=[],
    datas=[('/Users/ferdyvalentino/Downloads/remap-ecu-honda-main/HondaECUTool/data/web', 'HondaECUTool/data/web'), ('/Users/ferdyvalentino/Downloads/remap-ecu-honda-main/localhost_server.py', '.'), ('/Users/ferdyvalentino/Downloads/remap-ecu-honda-main/drivers', 'drivers')],
    hiddenimports=['webview', 'aiohttp', 'aiohttp.web', 'aiohttp.web_runner', 'aiohttp.web_server', 'aiohttp.web_app', 'aiohttp.web_request', 'aiohttp.web_response', 'aiohttp.web_routedef', 'aiohttp.web_fileresponse', 'aiohttp.web_ws', 'webview.platforms.cocoa', 'pylibftdi', 'pylibftdi.driver', 'pylibftdi.device', 'pylibftdi._base'],
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
    name='JRT Tect ANALIST Pro',
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
    name='JRT Tect ANALIST Pro',
)
app = BUNDLE(
    coll,
    name='JRT Tect ANALIST Pro.app',
    icon='/Users/ferdyvalentino/Downloads/remap-ecu-honda-main/icon.icns',
    bundle_identifier='com.jrt-tect.analist-pro',
)
