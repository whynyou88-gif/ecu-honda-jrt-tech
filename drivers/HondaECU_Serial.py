"""
HondaECU Serial Driver — PySerial Backend
Drop-in replacement for HondaECU (pylibftdi) that uses standard serial ports.
Works on macOS without needing to unload the AppleUSBFTDI kernel driver.
"""
from __future__ import division
import os
import sys
import time
import struct
import serial
import serial.tools.list_ports

# macOS AppleUSBFTDI termios tcsetattr patch (fixes Errno 22 Invalid Argument on FTDI ports)
try:
	import serial.serialposix
	_orig_reconfigure = serial.serialposix.Serial._reconfigure_port
	def _patched_reconfigure(self, force_update=False):
		try:
			_orig_reconfigure(self, force_update=force_update)
		except Exception:
			pass
	serial.serialposix.Serial._reconfigure_port = _patched_reconfigure
except Exception:
	pass


def checksum8bitHonda(data):
	return ((sum(bytearray(data)) ^ 0xFF) + 1) & 0xFF

def checksum8bit(data):
	return 0xff - ((sum(bytearray(data))-1) >> 8)

def validate_checksum(byts, fix=False):
	cksum = len(byts)-8
	fcksum = byts[cksum]
	ccksum = checksum8bitHonda(byts[:cksum]+byts[(cksum+1):])
	fixed = False
	if fix:
		if fcksum != ccksum:
			fixed = True
			byts[cksum] = ccksum
	return byts, fcksum, ccksum, fixed


def format_message(mtype, data):
	ml = len(mtype)
	dl = len(data)
	msgsize = 0x02 + ml + dl
	msg = mtype + [msgsize] + data
	msg += [checksum8bitHonda(msg)]
	assert(msg[ml] == len(msg))
	return msg, ml, dl


def find_ftdi_serial_port():
	"""Auto-detect USB serial port (FTDI, CH340, CP2102, PL2303, etc.) on macOS/Linux/Windows."""
	# 1. Search via glob on Unix systems (/dev/cu.usbserial*, /dev/cu.usbmodem*, etc.)
	if sys.platform != 'win32':
		import glob
		for pattern in [
			'/dev/cu.usbserial*', 
			'/dev/cu.usbmodem*', 
			'/dev/cu.wchusbserial*', 
			'/dev/cu.SLAB_USBtoUART*', 
			'/dev/cu.usb*', 
			'/dev/tty.usbserial*', 
			'/dev/tty.usbmodem*'
		]:
			matches = glob.glob(pattern)
			if matches:
				return matches[0]

	# 2. Search via PySerial comports
	ports = serial.tools.list_ports.comports()
	for p in ports:
		desc = (p.description or '').lower()
		mfr = (p.manufacturer or '').lower()
		dev = (p.device or '').lower()
		vid = p.vid
		# FTDI (0x0403), CH340 (0x1a86), CP210x (0x10c4), PL2303 (0x067b)
		if vid in (0x0403, 0x1a86, 0x10c4, 0x067b) or any(k in desc or k in mfr or k in dev for k in ['ftdi', 'ft232', 'ch340', 'ch341', 'cp210', 'pl2303', 'usbserial', 'usbmodem']):
			return p.device
	return None


class HondaECU(object):
	"""
	HondaECU driver using pyserial — compatible API with pylibftdi version.
	"""

	def __init__(self, device_id=None):
		super(HondaECU, self).__init__()
		self.device_id = device_id
		self.dev = None
		self.error = 0
		self.resets = 0
		self._port_name = None
		self.reset()

	def reset(self):
		if self.dev is not None:
			try:
				self.dev.close()
			except Exception:
				pass
			self.dev = None

		# Find the serial port
		port = self.device_id
		if port is None:
			port = find_ftdi_serial_port()
		if port is None:
			raise Exception("No FTDI USB serial port found. Check cable connection.")
		
		self._port_name = port
		self.dev = serial.Serial(
			port=port,
			baudrate=10400,
			bytesize=serial.EIGHTBITS,
			stopbits=serial.STOPBITS_ONE,
			parity=serial.PARITY_NONE,
			timeout=0.02
		)
		sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [SERIAL] Opened port {port} at 10400 baud (timeout=0.02s)\n")


	def close(self):
		if self.dev is not None:
			try:
				self.dev.close()
			except Exception:
				pass
			self.dev = None

	def setup(self):
		"""Initialize the serial port for Honda K-Line communication."""
		if self.dev is None:
			self.reset()
		
		# Reset port parameters
		self.dev.baudrate = 10400
		self.dev.bytesize = serial.EIGHTBITS
		self.dev.stopbits = serial.STOPBITS_ONE
		self.dev.parity = serial.PARITY_NONE
		self.dev.timeout = 0.02

		
		# Enable DTR/RTS to supply 5V VCC power rail to FTDI active level shifter
		try:
			self.dev.dtr = True
			self.dev.rts = True
			sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [SERIAL] DTR/RTS set to HIGH (5V VCC Transceiver Power)\n")
		except Exception as e:
			sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [SERIAL] Warning: failed to set DTR/RTS: {e}\n")
		
		# Flush buffers
		self.dev.reset_input_buffer()
		self.dev.reset_output_buffer()
		sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [SERIAL] Setup complete on {self._port_name}\n")

	def _break(self, duration_sec=0.070, debug=False):
		"""Send exact Honda K-Line Fast-Init break pulse (70ms LOW, 120ms HIGH)."""
		try:
			self.dev.break_condition = True
			time.sleep(duration_sec)
			self.dev.break_condition = False
		except Exception:
			try:
				if hasattr(self.dev, 'send_break'):
					self.dev.send_break(duration_sec)
			except Exception:
				pass
		time.sleep(0.120)
		try:
			self.dev.reset_input_buffer()
			self.dev.reset_output_buffer()
		except Exception:
			pass

	def send_raw_kline(self, msg_bytes, timeout=0.25):
		"""Send raw byte sequence over single-wire K-Line, handle echo, and return ECU response frame."""
		msg_b = bytes(msg_bytes)
		try:
			self.dev.reset_input_buffer()
			self.dev.write(msg_b)
			self.dev.flush()
		except Exception as e:
			sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [K-LINE TX ERR] {e}\n")
			self._is_connected = False
			return None

		start = time.time()
		raw_buf = bytearray()

		while (time.time() - start) < timeout:
			try:
				waiting = getattr(self.dev, 'in_waiting', 0)
				chunk = self.dev.read(waiting if waiting > 0 else 1)
				if chunk:
					raw_buf.extend(chunk)
					
					# Case A: TX echo present
					if raw_buf.startswith(msg_b):
						payload = raw_buf[len(msg_b):]
						if len(payload) >= 3:
							expected_len = payload[1] if len(payload) > 1 else 0
							if 3 <= expected_len <= 100 and len(payload) >= expected_len:
								return bytes(payload[:expected_len])
					
					# Case B: Echo suppressed by FTDI hardware
					elif len(raw_buf) >= 3 and not msg_b.startswith(raw_buf[:1]):
						expected_len = raw_buf[1] if len(raw_buf) > 1 else 0
						if 3 <= expected_len <= 100 and len(raw_buf) >= expected_len:
							return bytes(raw_buf[:expected_len])
			except Exception:
				pass
			time.sleep(0.002)

		# Final extraction attempt
		if raw_buf.startswith(msg_b):
			payload = raw_buf[len(msg_b):]
			if len(payload) >= 3:
				return bytes(payload)
		elif len(raw_buf) >= 3:
			return bytes(raw_buf)

		return None

	def init(self, debug=False):

		"""
		Initialize Honda K-Line communication using strict ISO 14230 / Honda Fast-Init:
		1. Fast-Init Break Pulse (70ms LOW, 120ms HIGH).
		2. Purge RX buffer of framing noise.
		3. Send Wakeup frame (0xFE 0x04 0x72 0x8C) & verify ACK.
		4. Send Session Init frame (0x72 0x05 0x00 0xF0 0x99).
		"""
		try:
			self.dev.baudrate = 10400
			self.dev.dtr = True
			self.dev.rts = True
		except Exception:
			pass

		# 1. DIRECT AWAKE PROBE (50ms) — If ECU key is ON and already awake
		for tbl in [0x17, 0x11, 0x67]:
			try:
				cmd = format_message([0x72], [0x71, tbl])[0]
				rx = self.send_raw_kline(bytes(cmd), timeout=0.10)
				if rx and len(rx) >= 5 and rx[-1] == checksum8bitHonda(rx[:-1]):
					self._active_table = tbl
					sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [HONDA K-LINE] ECU already awake! Direct probe connected to Table 0x{tbl:02X} in 50ms.\n")
					return True
			except Exception:
				pass

		# 2. FAST-INIT BREAK PULSE HANDSHAKE (70ms LOW, 120ms HIGH)
		try:
			self._break(0.070, debug=debug)
			time.sleep(0.120)
			self.dev.reset_input_buffer()
			self.dev.reset_output_buffer()

			# Send Wake Up code: FE 04 72 8C
			wakeup_cmd = bytes([0xFE, 0x04, 0x72, 0x8C])
			rx_wakeup = self.send_raw_kline(wakeup_cmd, timeout=0.20)

			# Send Initialise code: 72 05 00 F0 99
			init_cmd = bytes([0x72, 0x05, 0x00, 0xF0, 0x99])
			rx_init = self.send_raw_kline(init_cmd, timeout=0.20)

			if (rx_init and len(rx_init) >= 3 and rx_init[-1] == checksum8bitHonda(rx_init[:-1])) or \
			   (rx_wakeup and len(rx_wakeup) >= 3):
				self._active_table = 0x17
				sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [HONDA K-LINE] Fast-Init Handshake OK!\n")
				return True
		except Exception as e:
			sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [HONDA K-LINE] Fast-Init error: {e}\n")

		# 3. Fallback direct telemetry probe
		for tbl in [0x17, 0x11, 0x67, 0x10, 0x00]:
			try:
				cmd = format_message([0x72], [0x71, tbl])[0]
				rx = self.send_raw_kline(bytes(cmd), timeout=0.15)
				if rx and len(rx) >= 5 and rx[-1] == checksum8bitHonda(rx[:-1]):
					self._active_table = tbl
					return True
			except Exception:
				pass

		return False

	def kline(self):
		"""Check K-Line status via CTS pin (approximate)."""
		try:
			return self.dev.cts
		except Exception:
			return False

	def send(self, msg, ml=1, timeout=None):
		"""
		Send command byte sequence over single-wire K-Line.
		1. Read incoming stream and drain TX echo if present.
		2. Parse ECU response packet with dynamic length decoding.
		"""
		t_out = timeout if timeout is not None else 0.35
		msg_bytes = bytes(msg)

		try:
			self.dev.reset_input_buffer()
			self.dev.write(msg_bytes)
			self.dev.flush()
		except Exception:
			return None

		start = time.time()
		raw_buf = bytearray()

		while (time.time() - start) < t_out:
			try:
				waiting = getattr(self.dev, 'in_waiting', 0)
				if waiting > 0:
					chunk = self.dev.read(waiting)
				else:
					time.sleep(0.001)
					continue
				if chunk:
					raw_buf.extend(chunk)
					
					# Case A: TX Echo is present at beginning of buffer
					if raw_buf.startswith(msg_bytes):
						payload = raw_buf[len(msg_bytes):]
						if len(payload) >= ml + 1:
							expected_len = payload[ml]
							if 3 <= expected_len <= 100:
								if len(payload) >= expected_len:
									return bytes(payload[:expected_len])
								t_out = max(t_out, (time.time() - start) + 0.15)
					
					# Case B: Hardware suppresses echo (no TX echo in buffer)
					elif len(raw_buf) >= ml + 1 and not msg_bytes.startswith(raw_buf[:1]):
						expected_len = raw_buf[ml]
						if 3 <= expected_len <= 100:
							if len(raw_buf) >= expected_len:
								return bytes(raw_buf[:expected_len])
							t_out = max(t_out, (time.time() - start) + 0.15)
			except Exception:
				time.sleep(0.001)

		# Final extraction attempt
		if raw_buf.startswith(msg_bytes):
			payload = raw_buf[len(msg_bytes):]
			if len(payload) >= 3:
				expected_len = payload[ml] if len(payload) > ml else len(payload)
				return bytes(payload[:expected_len]) if len(payload) >= expected_len else bytes(payload)
		elif len(raw_buf) >= 3:
			expected_len = raw_buf[ml] if len(raw_buf) > ml else len(raw_buf)
			return bytes(raw_buf[:expected_len]) if len(raw_buf) >= expected_len else bytes(raw_buf)

		return None


	def send_command(self, mtype, data=[], retries=3, debug=False, timeout=None):
		"""
		Send command to ECU with strict Honda 8-bit checksum validation and microsecond hex logging.
		"""
		msg, ml, dl = format_message(mtype, data)
		first = True
		attempts = 0
		max_attempts = retries if retries > 0 else 1

		while attempts < max_attempts:
			attempts += 1
			t_start = time.time()
			if debug:
				sys.stderr.write(f"> [TX] [{bytes(msg).hex().upper()}]\n")

			resp = self.send(msg, ml, timeout=timeout)
			t_latency_ms = (time.time() - t_start) * 1000.0

			if resp is None:
				if debug:
					sys.stderr.write(f" ! Timeout on attempt {attempts}/{max_attempts}\n")
				try:
					if self.dev: self.dev.reset_input_buffer()
				except Exception:
					pass
				time.sleep(0.005)
				continue

			# STRICT CHECKSUM ENFORCEMENT: ONLY accept official Honda 8-bit checksum
			if mtype in [[0xfe], [0xFE]]:
				checksum_ok = True
			else:
				expected_cksum = checksum8bitHonda(resp[:-1])
				checksum_ok = (resp[-1] == expected_cksum)

			if not checksum_ok:
				if debug:
					sys.stderr.write(f" ! Checksum Error on attempt {attempts}/{max_attempts}: Got 0x{resp[-1]:02X}, Expected 0x{checksum8bitHonda(resp[:-1]):02X}\n")
				try:
					if self.dev: self.dev.reset_input_buffer()
				except Exception:
					pass
				time.sleep(0.005)
				continue

			if debug:
				sys.stderr.write(f"< [RX] [{bytes(resp).hex().upper()}] Latency: {t_latency_ms:.1f}ms\n")

			rmtype = resp[:ml]
			rml = resp[ml:(ml+1)]
			rdl = rml[0] - 2 - len(rmtype)
			rdata = resp[(ml+1):-1]
			return (rmtype, rml, rdata, rdl)

		return None

	def do_init_recover(self, debug=False):
		self.send_command([0x7b], [0x00, 0x01, 0x03], debug=debug)
		self.send_command([0x7b], [0x00, 0x01, 0x01], debug=debug)
		self.send_command([0x7b], [0x00, 0x01, 0x02], debug=debug)
		self.send_command([0x7b], [0x00, 0x01, 0x03], debug=debug)
		self.send_command([0x7b], [0x00, 0x02, 0x76, 0x03, 0x17], debug=debug)
		self.send_command([0x7b], [0x00, 0x03, 0x75, 0x05, 0x13], debug=debug)

	def do_init_write(self, debug=False):
		self.send_command([0x7d], [0x01, 0x01, 0x00], debug=debug)
		self.send_command([0x7d], [0x01, 0x01, 0x01], debug=debug)
		self.send_command([0x7d], [0x01, 0x01, 0x02], debug=debug)
		self.send_command([0x7d], [0x01, 0x01, 0x03], debug=debug)
		self.send_command([0x7d], [0x01, 0x02, 0x50, 0x47, 0x4d], debug=debug)
		self.send_command([0x7d], [0x01, 0x03, 0x2d, 0x46, 0x49], debug=debug)

	def do_pre_write(self, debug=False):
		self.send_command([0x7e], [0x01, 0x01, 0x00], debug=debug)
		time.sleep(11)
		self.send_command([0x7e], [0x01, 0x02], debug=debug)
		self.send_command([0x7e], [0x01, 0x03, 0x00, 0x00], debug=debug)
		self.send_command([0x7e], [0x01, 0x01, 0x00], debug=debug)
		self.send_command([0x7e], [0x01, 0x0b, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff], debug=debug)
		self.send_command([0x7e], [0x01, 0x01, 0x00], debug=debug)
		self.send_command([0x7e], [0x01, 0x0e, 0x01, 0x90], debug=debug)
		self.send_command([0x7e], [0x01, 0x01, 0x01], debug=debug)
		self.send_command([0x7e], [0x01, 0x04, 0xff], debug=debug)
		self.send_command([0x7e], [0x01, 0x01, 0x00], debug=debug)

	def do_pre_write_wait(self, debug=False):
		while True:
			info = self.send_command([0x7e], [0x01, 0x05], debug=debug)
			if info and len(info) >= 3 and len(info[2]) > 1 and info[2][1] == 0x00:
				break
		self.send_command([0x7e], [0x01, 0x01, 0x00], debug=debug)

