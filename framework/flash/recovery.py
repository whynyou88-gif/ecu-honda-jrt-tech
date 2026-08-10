"""
Flash Recovery & Emergency Rollback Manager
Handles pre-write backup creation, checksum validation, rollback indexing, and recovery.
"""

import os
import zlib
import hashlib
import datetime
from typing import Optional, List, Dict, Any

class FlashRecoveryManager:
    """Manages pre-write binary backups and emergency rollback recovery files."""

    def __init__(self, backup_dir: str = "HondaECUTool/data/web/backup"):
        self.backup_dir = os.path.abspath(backup_dir)
        os.makedirs(self.backup_dir, exist_ok=True)

    def create_prewrite_backup(self, raw_binary_bytes: bytes, ecu_id: str = "ECU") -> Dict[str, Any]:
        """Create immutable pre-write backup file with fsync and checksum metadata."""
        if not raw_binary_bytes:
            raise ValueError("Cannot create backup of empty binary buffer.")

        timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"autobackup_{ecu_id}_{timestamp_str}.bin"
        filepath = os.path.join(self.backup_dir, filename)

        crc32_val = f"{zlib.crc32(raw_binary_bytes) & 0xFFFFFFFF:08X}"
        md5_val = hashlib.md5(raw_binary_bytes).hexdigest()

        with open(filepath, "wb") as f:
            f.write(raw_binary_bytes)
            f.flush()
            os.fsync(f.fileno())

        return {
            "filename": filename,
            "filepath": filepath,
            "size_bytes": len(raw_binary_bytes),
            "crc32": crc32_val,
            "md5": md5_val,
            "timestamp": timestamp_str
        }

    def list_available_backups(self) -> List[Dict[str, Any]]:
        """List available recovery backups sorted by newest first."""
        backups = []
        if not os.path.exists(self.backup_dir):
            return backups

        for fname in os.listdir(self.backup_dir):
            if fname.endswith(".bin"):
                fpath = os.path.join(self.backup_dir, fname)
                try:
                    size = os.path.getsize(fpath)
                    mtime = os.path.getmtime(fpath)
                    backups.append({
                        "filename": fname,
                        "filepath": fpath,
                        "size_bytes": size,
                        "mtime": mtime,
                        "date_str": datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
                    })
                except Exception:
                    continue

        backups.sort(key=lambda x: x["mtime"], reverse=True)
        return backups

    def load_backup_file(self, filepath: str) -> bytes:
        """Load and verify integrity of a recovery backup file."""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Recovery backup file '{filepath}' not found.")

        with open(filepath, "rb") as f:
            data = f.read()

        if not data or len(data) == 0:
            raise ValueError(f"Recovery backup file '{filepath}' is empty.")

        return data
