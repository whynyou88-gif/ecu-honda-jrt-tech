@echo off
title JRT Tech ANALIST Pro v3.4 - Windows Build
echo ============================================================
echo   JRT Tech ANALIST Pro v3.4 - Windows EXE Builder
echo ============================================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Install Python 3.10+ from python.org
    echo         Make sure "Add Python to PATH" is checked during install.
    pause
    exit /b 1
)

echo [STEP 1/3] Installing Python dependencies...
pip install pyinstaller pywebview pythonnet pywin32 bottle aiohttp pyserial multidict yarl frozenlist aiosignal



echo.
echo [STEP 2/3] Building Windows EXE with PyInstaller...
python build_windows.py

echo.
echo [STEP 3/3] Build complete!
echo ============================================================
echo   Output: dist\JRT Tech ANALIST Pro\
echo   Run:    dist\JRT Tech ANALIST Pro\JRT Tech ANALIST Pro.exe
echo ============================================================
echo.
echo   To create a Windows Installer (.exe Setup):
echo     1. Install Inno Setup from https://jrsoftware.org/isdl.php
echo     2. Open installer.iss in Inno Setup Compiler
echo     3. Click Build ^> Compile
echo.
pause
