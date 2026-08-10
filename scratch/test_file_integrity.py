import zlib
import hashlib
import os

def checksum8bitHonda(data):
    s = sum(data) & 0xFF
    return (0x100 - s) & 0xFF

def run_integrity_check():
    std_path = "/Users/ferdyvalentino/Downloads/VARIO 125 - K60A-B01-11000 1.bin"
    print("==================================================")
    print("🧪 CONSECUTIVE FILE INTEGRITY & CHECKSUM TEST (5x)")
    print("==================================================")
    
    disk_crcs = []
    mem_crcs = []
    
    for i in range(1, 6):
        # 1. Read source bytes from disk
        with open(std_path, 'rb') as f:
            raw_bytes = f.read()
            
        raw_crc = f"{zlib.crc32(raw_bytes) & 0xFFFFFFFF:08X}"
        raw_md5 = hashlib.md5(raw_bytes).hexdigest()
        disk_crcs.append(raw_crc)
        
        # 2. Create isolated memory copy buffer & apply Honda checksum
        mem_buffer = bytearray(raw_bytes)
        mem_buffer[-1] = checksum8bitHonda(mem_buffer[:-1])
        
        mem_crc = f"{zlib.crc32(mem_buffer) & 0xFFFFFFFF:08X}"
        mem_md5 = hashlib.md5(mem_buffer).hexdigest()
        mem_crcs.append(mem_crc)
        
        print(f"Run #{i}: Disk CRC32={raw_crc} (MD5={raw_md5[:8]}...) | Mem Buffer CRC32={mem_crc} (MD5={mem_md5[:8]}...)")
        
    print("\n--------------------------------------------------")
    all_disk_identical = len(set(disk_crcs)) == 1
    all_mem_identical = len(set(mem_crcs)) == 1
    print(f"Disk Raw File Immutability:  {'PASSED ✓ (Identical across all 5 runs)' if all_disk_identical else 'FAILED ✗'}")
    print(f"Memory Copy Buffer Consistency: {'PASSED ✓ (Identical across all 5 runs)' if all_mem_identical else 'FAILED ✗'}")
    print("--------------------------------------------------")
    
    assert all_disk_identical, "Source file on disk MUST remain 100% untouched!"
    assert all_mem_identical, "Memory buffer CRC32 MUST be 100% deterministic!"

if __name__ == '__main__':
    run_integrity_check()
