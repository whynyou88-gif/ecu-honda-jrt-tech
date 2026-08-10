import asyncio
import sys
import os

# Add workspace directory to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))

# Mock ECU object
class MockECU:
    def __init__(self, mode="normal"):
        self.mode = mode
        self.sent_commands = []
        self.nrc78_count = 0
        self.read_block_count = 0
        
    def send_command(self, header, payload, debug=False, retries=1):
        full_frame = list(header) + list(payload)
        self.sent_commands.append(full_frame)
        
        # Test Case 1: Handshake NACK (NRC 0x33)
        if self.mode == "nack_handshake":
            if payload and len(payload) >= 2 and payload[0] == 0x01 and payload[1] == 0x0b: # Passcode command
                return [0x7E, 0x7F, 0x33] # NRC 0x33 Security Access Denied
            return [0x7E, 0x01, 0x00]
            
        # Test Case 4: Read-back mismatch at exact Block #501 (index 500, offset 0x01F400)
        if self.mode == "readback_mismatch_block500":
            if header == [0x72] and payload and payload[0] == 0x71:
                idx = self.read_block_count
                self.read_block_count += 1
                if idx == 500: # Exact 501st block (index 500)
                    return [0x72, 0x71, [0x00] * 128] # Corrupted bytes (0x00 vs 0xFF)
            return [0x7E, 0x01, 0x00]
            
        # Test Case 5: NRC 0x78 Response Pending retry test
        if self.mode == "nrc78_pending":
            if payload and len(payload) >= 2 and payload[0] == 0x01 and payload[1] == 0x0b: # Passcode command
                self.nrc78_count += 1
                if self.nrc78_count <= 2:
                    return [0x7E, 0x7F, 0x78] # NRC 0x78 Response Pending
                return [0x7E, 0x01, 0x00] # Success on 3rd attempt!
            return [0x7E, 0x01, 0x00]
            
        # Normal OK mock response
        return [0x7E, 0x01, 0x00]
        
    def read_vbat(self):
        if self.mode == "low_vbat":
            return 10.2
        return 12.6

async def run_tests():
    import localhost_server
    
    print("==================================================")
    print("🧪 RUNNING UNIT TESTS FOR ECU WRITE SAFETY GUARDS")
    print("==================================================")
    
    # ---------------------------------------------------
    # TEST 1: Low Vbat Auto-Abort Test
    # ---------------------------------------------------
    print("\n[TEST 1] Low Vbat (<11.5V) Auto-Abort Test...")
    localhost_server.HAS_HONDA_ECU = True
    localhost_server.ecu_connected = True
    mock_low_vbat = MockECU(mode="low_vbat")
    localhost_server.ecu = mock_low_vbat
    
    abort_triggered = False
    try:
        await localhost_server.run_ecu_write_task(write_type="calibration", auto_backup=False, dry_run=False)
    except Exception as e:
        print(f"  Caught expected error: {e}")
        abort_triggered = True
        
    print(f"  Result: {'PASSED ✓' if mock_low_vbat.sent_commands == [] else 'FAILED ✗'}")
    assert len(mock_low_vbat.sent_commands) == 0, "Low Vbat must abort before sending any ECU frame!"
    
    # ---------------------------------------------------
    # TEST 2: Handshake NACK (NRC 0x33) Auto-Abort Test
    # ---------------------------------------------------
    print("\n[TEST 2] ECU Security Handshake NACK (NRC 0x33) Auto-Abort Test...")
    mock_nack = MockECU(mode="nack_handshake")
    localhost_server.ecu = mock_nack
    
    await localhost_server.run_ecu_write_task(write_type="calibration", auto_backup=False, dry_run=False)
        
    block_0_sent = any(cmd[0:3] == [0x7E, 0x01, 0x06] for cmd in mock_nack.sent_commands)
    print(f"  Block 0 Sent? {block_0_sent} (Must be False)")
    print(f"  Result: {'PASSED ✓' if not block_0_sent else 'FAILED ✗'}")
    assert not block_0_sent, "NACK during handshake MUST abort before Block 0!"

    # ---------------------------------------------------
    # TEST 3: Dry-Run Mode Safety Guard Test
    # ---------------------------------------------------
    print("\n[TEST 3] Dry-Run Mode Guard Test (Skip Sector Erase)...")
    mock_dry = MockECU(mode="normal")
    localhost_server.ecu = mock_dry
    
    await localhost_server.run_ecu_write_task(write_type="calibration", auto_backup=True, dry_run=True)
    erase_cmd_sent = any(cmd == [0x7E, 0x01, 0x01, 0x01] for cmd in mock_dry.sent_commands)
    print(f"  Flash Erase Command Sent? {erase_cmd_sent} (Must be False)")
    print(f"  Result: {'PASSED ✓' if not erase_cmd_sent else 'FAILED ✗'}")
    assert not erase_cmd_sent, "Dry-Run MUST NOT send actual sector erase command!"

    # ---------------------------------------------------
    # TEST 4: 100% Read-Back Mismatch Test (Block #500)
    # ---------------------------------------------------
    print("\n[TEST 4] 100% Read-Back Byte Mismatch Test (Targeting Block #500)...")
    mock_mismatch = MockECU(mode="readback_mismatch_block500")
    localhost_server.ecu = mock_mismatch
    
    log_dir = os.path.join(localhost_server.get_base_dir(), "logs")
    log_file_path = os.path.join(log_dir, "ecu_write.log")
    if os.path.exists(log_file_path):
        os.remove(log_file_path) # Reset log file before test
        
    await localhost_server.run_ecu_write_task(write_type="calibration", auto_backup=False, dry_run=False)
    
    mismatch_logged = False
    if os.path.exists(log_file_path):
        with open(log_file_path, "r", encoding="utf-8") as f:
            log_content = f.read()
            mismatch_logged = "POST-WRITE VERIFICATION FAILED" in log_content
            
    print(f"  Mismatch Caught & Logged? {mismatch_logged}")
    print(f"  Result: {'PASSED ✓' if mismatch_logged else 'FAILED ✗'}")
    assert mismatch_logged, "100% Read-back verification MUST catch mismatch at Block #500!"

    # ---------------------------------------------------
    # TEST 5: NRC 0x78 Response Pending Retry Test
    # ---------------------------------------------------
    print("\n[TEST 5] NRC 0x78 (Response Pending) Retry Test...")
    mock_pending = MockECU(mode="nrc78_pending")
    localhost_server.ecu = mock_pending
    
    pending_success = False
    try:
        # Dry run or normal execution with 0x78 retries
        await localhost_server.run_ecu_write_task(write_type="calibration", auto_backup=False, dry_run=False)
        pending_success = True
    except Exception as e:
        print(f"  Unexpected exception: {e}")
        
    print(f"  NRC 0x78 Retry Count: {mock_pending.nrc78_count} (Expected 3 attempts)")
    print(f"  Result: {'PASSED ✓' if (pending_success and mock_pending.nrc78_count == 3) else 'FAILED ✗'}")
    assert pending_success and mock_pending.nrc78_count == 3, "NRC 0x78 MUST retry and succeed on 3rd attempt without aborting!"

    print("\n==================================================")
    print("✅ ALL 5 UNIT TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == '__main__':
    asyncio.run(run_tests())
