#!/usr/bin/env python3
# ============================================================
# AnalistProStudioApp.py - Native Desktop Software App
# JRT Tech ANALIST Pro 3.4 - Honda ECU Remap Studio
# ============================================================

import os
import sys
import time
import socket
import subprocess
import threading
import tempfile
from aiohttp import web

_APP_DEBUG_LOG = os.path.join(tempfile.gettempdir(), "jrt_app_debug.log")


def get_resource_dir():
    """Get the resource directory, supporting PyInstaller, py2app, and dev mode."""
    if getattr(sys, 'frozen', False):
        if hasattr(sys, '_MEIPASS'):
            return sys._MEIPASS
        return os.path.dirname(os.path.abspath(__file__))
    return os.path.dirname(os.path.abspath(__file__))


def is_port_in_use(port=8080):
    """Fast non-blocking check if target port is listening (takes 1ms)."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.1)
            return s.connect_ex(('127.0.0.1', port)) == 0
    except Exception:
        return False


def kill_port_occupant(port=8080):
    """Forcefully kill any process occupying target port ONLY if port is currently in use."""
    if not is_port_in_use(port):
        return  # Port is free, skip subprocess calls (0ms)
    try:
        if sys.platform == 'win32':
            subprocess.run(f"for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :{port}') do taskkill /F /PID %a", shell=True, capture_output=True, timeout=1.0)
        else:
            subprocess.run(f"lsof -ti:{port} | xargs kill -9 2>/dev/null", shell=True, capture_output=True, timeout=1.0)
        time.sleep(0.1)
    except Exception:
        pass


def start_backend_server():
    """Start clean server instance on 127.0.0.1:8080 with zero unnecessary delays."""
    print("[App] Starting JRT Tech local FTDI server...")
    script_dir = get_resource_dir()

    # Write debug log
    try:
        with open(_APP_DEBUG_LOG, "w") as f:
            f.write(f"sys.executable: {sys.executable}\n")
            f.write(f"sys.frozen: {getattr(sys, 'frozen', False)}\n")
            f.write(f"script_dir: {script_dir}\n")
    except Exception as e:
        print("[App] Log write error:", e)

    # In PyInstaller frozen mode: run server in-process on a background thread
    if getattr(sys, 'frozen', False):
        candidate_dirs = [
            script_dir,
            getattr(sys, '_MEIPASS', script_dir),
            os.path.join(os.path.dirname(sys.executable), '_internal'),
            os.path.dirname(sys.executable)
        ]
        server_path = None
        target_dir = script_dir
        for cd in candidate_dirs:
            if cd and os.path.exists(cd):
                sp = os.path.join(cd, "localhost_server.py")
                if os.path.isfile(sp):
                    server_path = sp
                    target_dir = cd
                    break

        if not server_path:
            print(f"[App] ERROR: localhost_server.py not found in candidate dirs: {candidate_dirs}")
            return

        if target_dir not in sys.path:
            sys.path.insert(0, target_dir)
        
        def run_server_inprocess():
            try:
                os.chdir(target_dir)
                import importlib.util
                spec = importlib.util.spec_from_file_location("localhost_server", server_path)
                server_module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(server_module)
                
                srv_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                srv_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                try:
                    srv_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
                except Exception:
                    pass
                
                srv_sock.bind(('127.0.0.1', 8080))
                web.run_app(server_module.app, sock=srv_sock, handle_signals=False)

            except Exception as e:
                import traceback
                print(f"[App] In-process server error: {e}\n{traceback.format_exc()}")
        
        server_thread = threading.Thread(target=run_server_inprocess, daemon=True)
        server_thread.start()
        return

    # Development mode: spawn as subprocess
    python_exe = sys.executable
    server_path = os.path.join(script_dir, "localhost_server.py")
    
    if not os.path.isfile(server_path):
        print(f"[App] ERROR: Server script not found at: {server_path}")
        return
        
    env = os.environ.copy()
    if sys.platform == 'darwin':
        brew_lib = "/opt/homebrew/lib"
        local_lib = "/usr/local/lib"
        current_dyld = env.get("DYLD_LIBRARY_PATH", "")
        new_paths = [p for p in [brew_lib, local_lib] if os.path.exists(p)]
        if new_paths:
            env["DYLD_LIBRARY_PATH"] = ":".join(new_paths + ([current_dyld] if current_dyld else []))
    elif sys.platform == 'win32':
        ftdi_paths = [
            os.path.join(script_dir, 'drivers', 'ftdi'),
            os.path.join(os.environ.get('ProgramFiles', 'C:\\Program Files'), 'FTDI', 'CDM'),
            os.path.join(os.environ.get('ProgramFiles(x86)', 'C:\\Program Files (x86)'), 'FTDI', 'CDM'),
        ]
        existing_path = env.get("PATH", "")
        for p in ftdi_paths:
            if os.path.isdir(p) and p not in existing_path:
                existing_path = p + ";" + existing_path
        env["PATH"] = existing_path

    subprocess.Popen([python_exe, "-u", server_path], cwd=script_dir, env=env)


def main():
    # 1. Clear any stale process occupying port 8080 (0ms if port is free)
    kill_port_occupant(8080)

    # 2. Start backend server in background
    start_backend_server()

    # 3. Fast wait for server to start listening (takes ~50ms)
    for _ in range(40):
        if is_port_in_use(8080):
            break
        time.sleep(0.05)

    app_url = "http://127.0.0.1:8080/index.html"

    # 4. Launch native pywebview window loading original index.html directly
    try:
        import webview
        
        class APIBridge:
            def __init__(self):
                self.window = None
                
            def open_file(self):
                if not self.window:
                    return {"status": "error", "message": "Window not initialized"}
                
                file_types = ('Binary Files (*.bin;*.hex;*.json)', 'All files (*.*)')
                file_path = self.window.create_file_dialog(
                    webview.OPEN_DIALOG,
                    file_types=file_types
                )
                
                if file_path:
                    if isinstance(file_path, (list, tuple)):
                        file_path = file_path[0] if len(file_path) > 0 else None
                    if not file_path:
                        return {"status": "cancelled"}
                    try:
                        with open(file_path, 'rb') as f:
                            byts = f.read()
                        
                        save_name = os.path.basename(file_path)
                        import localhost_server
                        parsed_map = localhost_server.parse_binary_to_map(byts, model_name=os.path.splitext(save_name)[0], ecmid_str="0101E20F01")
                        
                        try:
                            if save_name.lower().endswith(('.bin', '.hex')):
                                import urllib.request
                                import json
                                req_data = json.dumps({"filepath": file_path, "filename": save_name}).encode('utf-8')
                                req = urllib.request.Request(
                                    "http://127.0.0.1:8080/api/buffer/upload_path",
                                    data=req_data,
                                    headers={"Content-Type": "application/json"}
                                )
                                urllib.request.urlopen(req, timeout=1.5)
                        except Exception as sync_err:
                            print(f"[open_file] Sync buffer HTTP error: {sync_err}")
                        
                        return {
                            "status": "ok",
                            "filename": save_name,
                            "path": file_path,
                            "size": len(byts),
                            "mapData": parsed_map
                        }
                    except Exception as e:
                        return {"status": "error", "message": str(e)}
                return {"status": "cancelled"}

            def open_bin_for_flash(self):
                if not self.window:
                    return {"status": "error", "message": "Window not initialized"}
                
                file_types = ('ECU Binary Files (*.bin;*.hex;*.BIN;*.HEX)', 'All files (*.*)')
                file_path = self.window.create_file_dialog(
                    webview.OPEN_DIALOG,
                    file_types=file_types
                )
                
                if file_path:
                    if isinstance(file_path, (list, tuple)):
                        file_path = file_path[0] if len(file_path) > 0 else None
                    if not file_path:
                        return {"status": "cancelled"}
                    try:
                        with open(file_path, 'rb') as f:
                            content = f.read()
                        
                        filename = os.path.basename(file_path)
                        size_bytes = len(content)

                        import urllib.request
                        import json
                        
                        req_data = json.dumps({
                            "filepath": file_path,
                            "filename": filename
                        }).encode('utf-8')
                        
                        req = urllib.request.Request(
                            "http://127.0.0.1:8080/api/buffer/upload_path",
                            data=req_data,
                            headers={"Content-Type": "application/json"}
                        )
                        
                        with urllib.request.urlopen(req, timeout=3.0) as resp:
                            res_json = json.loads(resp.read().decode('utf-8'))
                            if res_json.get("status") == "ok":
                                return {
                                    "status": "ok",
                                    "filename": filename,
                                    "size": size_bytes,
                                    "path": file_path
                                }
                            else:
                                return {"status": "error", "message": res_json.get("error", "Failed to set buffer")}
                    except Exception as e:
                        return {"status": "error", "message": str(e)}
                return {"status": "cancelled"}

            def save_file(self, content, filename):
                if not self.window:
                    return {"status": "error", "message": "Window not initialized"}
                
                file_types = ('All files (*.*)',)
                if filename.endswith('.json'):
                    file_types = ('JSON Files (*.json)', 'All files (*.*)')
                elif filename.endswith('.csv'):
                    file_types = ('CSV Files (*.csv)', 'All files (*.*)')
                elif filename.endswith('.txt'):
                    file_types = ('Text Files (*.txt)', 'All files (*.*)')
                elif filename.endswith('.bin'):
                    file_types = ('Binary Files (*.bin)', 'All files (*.*)')
                elif filename.endswith('.hex'):
                    file_types = ('Intel Hex Files (*.hex)', 'All files (*.*)')
                    
                save_path = self.window.create_file_dialog(
                    webview.SAVE_DIALOG,
                    save_filename=filename,
                    file_types=file_types
                )
                
                if save_path:
                    if isinstance(save_path, (list, tuple)):
                        save_path = save_path[0] if len(save_path) > 0 else None
                    if not save_path:
                        return {"status": "cancelled"}
                    try:
                        if filename.endswith('.bin') and not content.startswith('{'):
                            try:
                                data = bytes.fromhex(content)
                                with open(save_path, 'wb') as f:
                                    f.write(data)
                            except Exception:
                                with open(save_path, 'w') as f:
                                    f.write(content)
                        else:
                            with open(save_path, 'w', encoding='utf-8') as f:
                                f.write(content)
                        return {"status": "ok", "path": save_path}
                    except Exception as e:
                        return {"status": "error", "message": str(e)}
                return {"status": "cancelled"}

        api_bridge = APIBridge()

        print(f"[App] Launching JRT Tech ANALIST Pro 3.4 Native Window ({app_url})...")
        window = webview.create_window(
            title="JRT Tech ANALIST Pro 3.4 - Honda ECU Remap Studio",

            url=app_url,
            width=1280,
            height=820,
            resizable=True,
            min_size=(1024, 720),
            background_color="#0a0a0f",
            js_api=api_bridge
        )
        api_bridge.window = window
        try:
            webview.start(debug=False)
        except Exception as gui_err:
            print(f"[App] Default pywebview GUI start failed ({gui_err}), trying fallback GUI backends...")
            try:
                webview.start(gui='edgechromium', debug=False)
            except Exception:
                try:
                    webview.start(gui='winforms', debug=False)
                except Exception as final_gui_err:
                    print(f"[App] All pywebview GUI backends failed: {final_gui_err}")
                    raise final_gui_err
        sys.exit(0)
    except Exception as e:
        import traceback
        err_detail = f"Gagal membuka Native Desktop Window: {e}\n{traceback.format_exc()}"
        print(f"[App] {err_detail}")
        try:
            with open(_APP_DEBUG_LOG, "a") as f:
                f.write(err_detail + "\n")
        except Exception:
            pass
        if sys.platform == 'win32':
            try:
                import ctypes
                ctypes.windll.user32.MessageBoxW(0, f"Gagal menginisialisasi Native Window:\n{e}", "JRT Tech ANALIST Pro Error", 0x10)
            except Exception:
                pass
        sys.exit(1)




if __name__ == '__main__':
    main()
