#!/usr/bin/env python3
"""
Build Script - Create macOS .dmg installer for JRT Tect ANALIST Pro 3.4
Creates a distributable disk image (.dmg) containing the .app bundle.

Usage:
    python3 build_dmg.py
"""

import os
import sys
import subprocess
import shutil

APP_NAME = "JRT Tech ANALIST Pro"
VERSION = "3.4"
DMG_NAME = f"{APP_NAME} {VERSION}"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(SCRIPT_DIR, "dist")
APP_PATH = os.path.join(DIST_DIR, f"{APP_NAME}.app")
DMG_PATH = os.path.join(DIST_DIR, f"{DMG_NAME}.dmg")
STAGING_DIR = os.path.join(DIST_DIR, "dmg_staging")


def build_app_if_needed(force_rebuild=True):
    """Build the .app bundle using build_app.py to package all latest static assets and code."""
    if os.path.exists(APP_PATH) and not force_rebuild:
        print(f"[DMG] Using existing .app bundle: {APP_PATH}")
        return True

    print("[DMG] Rebuilding PyInstaller .app bundle to include latest files & UI changes...")
    result = subprocess.run(
        [sys.executable, os.path.join(SCRIPT_DIR, "build_app.py")],
        cwd=SCRIPT_DIR
    )
    if result.returncode != 0:
        print("[DMG] ❌ Failed to build .app bundle")
        return False

    if not os.path.exists(APP_PATH):
        print(f"[DMG] ❌ .app bundle not found after build at: {APP_PATH}")
        return False

    return True


def create_dmg():
    """Create a .dmg disk image from the .app bundle."""
    print(f"\n{'='*60}")
    print(f"  Creating macOS .dmg Installer")
    print(f"  {APP_NAME} v{VERSION}")
    print(f"{'='*60}\n")

    # Step 1: Build app if needed
    if not build_app_if_needed():
        sys.exit(1)

    # Step 2: Clean previous staging and dmg
    if os.path.exists(STAGING_DIR):
        shutil.rmtree(STAGING_DIR)
    if os.path.exists(DMG_PATH):
        os.remove(DMG_PATH)
        print(f"[DMG] Removed old .dmg: {DMG_PATH}")

    # Step 3: Create staging directory with app + Applications symlink
    os.makedirs(STAGING_DIR)
    print("[DMG] Copying .app bundle to staging directory...")
    shutil.copytree(APP_PATH, os.path.join(STAGING_DIR, f"{APP_NAME}.app"), symlinks=True)

    # Create Applications symlink for drag-and-drop install
    os.symlink("/Applications", os.path.join(STAGING_DIR, "Applications"))
    print("[DMG] Created Applications symlink for drag-and-drop")

    # Step 4: Calculate volume size (app size + 50MB buffer)
    app_size_mb = sum(
        os.path.getsize(os.path.join(dp, f))
        for dp, dn, fn in os.walk(os.path.join(STAGING_DIR, f"{APP_NAME}.app"))
        for f in fn
    ) / (1024 * 1024)
    vol_size_mb = int(app_size_mb + 50)
    print(f"[DMG] App size: {app_size_mb:.1f} MB, Volume size: {vol_size_mb} MB")

    # Step 5: Create DMG using hdiutil
    print("[DMG] Creating .dmg disk image...")
    temp_dmg = os.path.join(DIST_DIR, "temp.dmg")

    # Create writable DMG
    cmd_create = [
        "hdiutil", "create",
        "-srcfolder", STAGING_DIR,
        "-volname", DMG_NAME,
        "-fs", "HFS+",
        "-fsargs", "-c c=64,a=16,e=16",
        "-format", "UDRW",
        "-size", f"{vol_size_mb}m",
        temp_dmg
    ]
    result = subprocess.run(cmd_create, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[DMG] ❌ hdiutil create failed: {result.stderr}")
        sys.exit(1)

    # Convert to compressed read-only DMG
    print("[DMG] Compressing to final .dmg...")
    cmd_convert = [
        "hdiutil", "convert",
        temp_dmg,
        "-format", "UDZO",
        "-imagekey", "zlib-level=9",
        "-o", DMG_PATH
    ]
    result = subprocess.run(cmd_convert, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[DMG] ❌ hdiutil convert failed: {result.stderr}")
        sys.exit(1)

    # Clean up
    os.remove(temp_dmg)
    shutil.rmtree(STAGING_DIR)

    # Step 6: Print results
    dmg_size_mb = os.path.getsize(DMG_PATH) / (1024 * 1024)
    print(f"\n{'='*60}")
    print(f"  ✅ DMG CREATED SUCCESSFULLY!")
    print(f"  File: {DMG_PATH}")
    print(f"  Size: {dmg_size_mb:.1f} MB")
    print(f"{'='*60}")
    print(f"\n  To install: Open the .dmg and drag the app to Applications")
    print(f"  To distribute: Share the .dmg file directly\n")


if __name__ == '__main__':
    create_dmg()
