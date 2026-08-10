#!/usr/bin/env python3
# ============================================================
# build_apk.py — Honda ECU Tool APK Builder (macOS/Linux/Windows)
# Otomatis install Android SDK cmdline-tools dan build APK
# ============================================================

import os
import sys
import shutil
import urllib.request
import zipfile
import subprocess
import time
import ssl

# Bypass SSL certificate verification for macOS python downloads
ssl._create_default_https_context = ssl._create_unverified_context

def print_header(text):
    print("\n" + "=" * 50)
    print(f" {text}")
    print("=" * 50 + "\n")

def print_step(text):
    print(f"[*] {text}")

def print_ok(text):
    print(f"[✓] {text}")

def print_err(text):
    print(f"[✗] {text}")

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    honda_apk_dir = os.path.join(script_dir, "honda-ecu-apk")
    android_dir = os.path.join(honda_apk_dir, "android")
    
    # Destination SDK Path
    sdk_dir = os.path.expanduser("~/Library/Android/sdk")
    sdkmanager_bin = os.path.join(sdk_dir, "cmdline-tools", "latest", "bin", "sdkmanager")
    
    print_header("JRT Tect Honda ECU Tool — APK Builder")
    
    # ---- Step 1: Check Node.js ----
    print_header("Step 1 — Node.js Check")
    try:
        node_ver = subprocess.check_output(["node", "--version"], text=True).strip()
        print_ok(f"Node.js found: {node_ver}")
    except Exception:
        print_err("Node.js not found. Please install Node.js (v18+) first!")
        sys.exit(1)

    # ---- Step 2: Check Java JDK ----
    print_header("Step 2 — Java JDK Check")
    java_home = ""
    try:
        # Get JAVA_HOME from macOS utility
        java_home = subprocess.check_output(["/usr/libexec/java_home"], text=True).strip()
        print_ok(f"Java SDK found. JAVA_HOME: {java_home}")
    except Exception:
        # Check standard env
        java_home = os.environ.get("JAVA_HOME", "")
        if java_home:
            print_ok(f"Java SDK found via environment. JAVA_HOME: {java_home}")
        else:
            print_err("Java JDK (v17) is required but not found. Please run: brew install openjdk@21")
            sys.exit(1)
            
    # Set environment variables for compilation
    os.environ["JAVA_HOME"] = java_home
    os.environ["PATH"] = os.path.join(java_home, "bin") + os.pathsep + os.environ.get("PATH", "")

    # ---- Step 3: Setup Android SDK ----
    print_header("Step 3 — Android SDK Setup")
    
    if os.path.exists(sdkmanager_bin):
        print_ok(f"Android SDK already set up at: {sdk_dir}")
        # Ensure execution permissions
        bin_dir = os.path.dirname(sdkmanager_bin)
        if os.path.exists(bin_dir):
            for f in os.listdir(bin_dir):
                fp = os.path.join(bin_dir, f)
                if os.path.isfile(fp):
                    os.chmod(fp, 0o755)
    else:
        print_step("Android SDK not found. Setting up custom command-line tools...")
        os.makedirs(sdk_dir, exist_ok=True)
        
        # macOS Command Line Tools URL
        url = "https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip"
        zip_path = os.path.join(sdk_dir, "cmdtools.zip")
        
        print_step(f"Downloading Android command line tools from: {url}")
        try:
            urllib.request.urlretrieve(url, zip_path)
            print_ok("Download complete.")
        except Exception as e:
            print_err(f"Download failed: {e}")
            sys.exit(1)
            
        print_step("Extracting zip archive...")
        temp_extract = os.path.join(sdk_dir, "temp_tools")
        os.makedirs(temp_extract, exist_ok=True)
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(temp_extract)
            
            # The zip file extracts to cmdline-tools/
            # We must move contents to cmdline-tools/latest/
            latest_dir = os.path.join(sdk_dir, "cmdline-tools", "latest")
            os.makedirs(os.path.dirname(latest_dir), exist_ok=True)
            if os.path.exists(latest_dir):
                shutil.rmtree(latest_dir)
            shutil.move(os.path.join(temp_extract, "cmdline-tools"), latest_dir)
            
            # Cleanup temp files
            os.remove(zip_path)
            shutil.rmtree(temp_extract)
            
            # Make the sdkmanager and other tools executable
            bin_dir = os.path.dirname(sdkmanager_bin)
            if os.path.exists(bin_dir):
                for f in os.listdir(bin_dir):
                    fp = os.path.join(bin_dir, f)
                    if os.path.isfile(fp):
                        os.chmod(fp, 0o755)
                        
            print_ok("Android SDK tools extracted successfully.")
        except Exception as e:
            print_err(f"Extraction failed: {e}")
            sys.exit(1)
            
    # Set Android SDK variables
    os.environ["ANDROID_HOME"] = sdk_dir
    os.environ["ANDROID_SDK_ROOT"] = sdk_dir
    
    # ---- Step 4: Install SDK Components ----
    print_header("Step 4 — Install SDK Components (Platforms)")
    
    # Check if target platform-34 is already installed
    platform_34_dir = os.path.join(sdk_dir, "platforms", "android-34")
    if os.path.exists(platform_34_dir):
        print_ok("Android Platform 34 is already installed.")
    else:
        print_step("Installing Android Platform-34 and build tools...")
        # Auto-accept licenses and install components
        try:
            # Accept licenses first
            print_step("Accepting licenses...")
            proc_lic = subprocess.Popen(
                [sdkmanager_bin, "--licenses"],
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                text=True
            )
            proc_lic.communicate(input="y\ny\ny\ny\ny\ny\ny\ny\ny\ny\ny\ny\ny\ny\n")
            
            # Now install platform components
            print_step("Installing packages...")
            proc = subprocess.Popen(
                [sdkmanager_bin, "platform-tools", "platforms;android-34", "build-tools;34.0.0"],
                stdin=subprocess.PIPE,
                text=True
            )
            proc.communicate(input="y\ny\ny\ny\ny\ny\ny\ny\ny\ny\n")
            print_ok("Android components installed successfully.")
        except Exception as e:
            print_err(f"sdkmanager failed: {e}")
            sys.exit(1)

    # ---- Step 5: Install NPM dependencies & Sync ----
    print_header("Step 5 — Sync Web Assets via Capacitor")
    
    node_modules_dir = os.path.join(honda_apk_dir, "node_modules")
    if not os.path.exists(node_modules_dir):
        print_step("Installing NPM packages...")
        subprocess.check_call(["npm", "install"], cwd=honda_apk_dir)
        print_ok("NPM packages installed.")
    else:
        print_ok("node_modules exists, skipping install.")
        
    print_step("Syncing web assets to Android platform...")
    subprocess.check_call(["npx", "cap", "sync", "android"], cwd=honda_apk_dir)
    print_ok("Capacitor sync complete.")

    # ---- Step 6: Gradle Compile APK ----
    print_header("Step 6 — Compile APK via Gradle")
    
    # Create local.properties to explicitly point to our SDK
    local_props_path = os.path.join(android_dir, "local.properties")
    with open(local_props_path, "w") as f:
        f.write(f"sdk.dir={sdk_dir}\n")
    print_ok(f"Created local.properties pointing to: {sdk_dir}")
    
    # Compile
    gradlew_bin = os.path.join(android_dir, "gradlew")
    os.chmod(gradlew_bin, 0o755)
    
    print_step("Running Gradle assembleDebug...")
    try:
        subprocess.check_call([gradlew_bin, "assembleDebug"], cwd=android_dir)
        print_ok("Gradle build complete!")
    except Exception as e:
        print_err(f"Gradle build failed: {e}")
        sys.exit(1)
        
    # Copy APK to root
    apk_output = os.path.join(android_dir, "app", "build", "outputs", "apk", "debug", "app-debug.apk")
    target_apk = os.path.join(script_dir, "HondaECUTool-v1.0.0-debug.apk")
    if os.path.exists(apk_output):
        shutil.copy2(apk_output, target_apk)
        size_mb = os.path.getsize(target_apk) / (1024 * 1024)
        
        print_header("APK BUILD SUCCESSFUL!")
        print(f" File: {target_apk}")
        print(f" Size: {size_mb:.2f} MB")
        print("=" * 50)
        print("\nCara install di HP Android:")
        print("1. Kirim file HondaECUTool-v1.0.0-debug.apk ke handphone Android Anda.")
        print("2. Buka file manager di HP dan ketuk file APK tersebut untuk menginstal.")
        print("3. Buka WiFi HP dan hubungkan ke hotspot 'Honda ECU Tool'.")
        print("4. Buka aplikasi dan masukkan IP: 192.168.4.1\n")
    else:
        print_err(f"APK compiled but not found at: {apk_output}")
        sys.exit(1)

if __name__ == "__main__":
    main()
