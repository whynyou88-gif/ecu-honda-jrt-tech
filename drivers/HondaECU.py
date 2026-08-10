"""
HondaECU Driver — Redirected to PySerial backend for maximum macOS compatibility.
"""
import sys
import time

from ctypes import create_string_buffer
try:
	from pylibftdi import Device
except ImportError:
	class Device(object):
		def __init__(self, *args, **kwargs):
			pass

try:
	from drivers.HondaECU_Serial import HondaECU, find_ftdi_serial_port, checksum8bitHonda, checksum8bit, format_message
except ImportError:
	from HondaECU_Serial import HondaECU, find_ftdi_serial_port, checksum8bitHonda, checksum8bit, format_message

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

class HondaECU(object):

	def __init__(self, device_id=None):
		super(HondaECU, self).__init__()
		self.device_id = device_id
		self.dev = None
		self.error = 0
		self.resets = 0
		self.reset()

	def reset(self):
		if self.dev != None:
			del self.dev
			self.dev = None
		self.dev = Device(self.device_id)

	def close(self):
		if self.dev != None:
			try:
				self.dev.close()
			except Exception:
				pass
			self.dev = None

	def setup(self):
		self.dev.ftdi_fn.ftdi_usb_reset()
		self.dev.ftdi_fn.ftdi_usb_purge_buffers()
		self.dev.ftdi_fn.ftdi_set_line_property(8, 1, 0)
		self.dev.baudrate = 10400
		
		# Set low latency timer (e.g. 2ms) to avoid delay in short packets/timeouts
		try:
			self.dev.ftdi_fn.ftdi_set_latency_timer(2)
			sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [DRIVER] FTDI latency timer set to 2ms\n")
		except Exception as e:
			sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [DRIVER] Warning: failed to set FTDI latency timer: {e}\n")
			
		# Enable DTR/RTS to supply 5V VCC power rail to FTDI active level shifter
		try:
			self.dev.ftdi_fn.ftdi_setdtr(1)
			self.dev.ftdi_fn.ftdi_setrts(1)
			self.dev.ftdi_fn.ftdi_setflowctrl(0)
			sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [DRIVER] FTDI DTR/RTS set to 1 (5V VCC Power)\n")
		except Exception as e:
			sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [DRIVER] Warning: failed to set DTR/RTS: {e}\n")


	def _break(self, ms, debug=False):
		self.dev.ftdi_fn.ftdi_set_bitmode(1, 0x01)
		self.dev._write(b'\x00')
		time.sleep(ms)
		self.dev._write(b'\x01')
		time.sleep(0.130)
		self.dev.ftdi_fn.ftdi_set_bitmode(0, 0x00)
		self.dev.baudrate = 10400
		self.dev.flush()

	def init(self, debug=False):
		# 1. Direct session probe (if ECU is already active/awake)
		info = self.send_command([0x72], [0x00, 0xf0], debug=debug, retries=1)
		if info is not None and len(info) >= 3:
			return True

		# 2. Fast-init break pulse (70ms LOW, 130ms HIGH)
		self._break(.070)
		time.sleep(.130)
		self.dev.flush()
		info = self.send_command([0xfe], [0x72], debug=debug, retries=1)
		if info is not None and len(info) >= 3 and len(info[0]) > 0 and info[0][0] > 0:
			if len(info[2]) > 0 and info[2][0] == 0x72:
				return True

		# 3. Final session probe after fast-init
		info = self.send_command([0x72], [0x00, 0xf0], debug=debug, retries=1)
		return info is not None and len(info) >= 3

	def kline(self):
		b = create_string_buffer(2)
		self.dev.ftdi_fn.ftdi_poll_modem_status(b)
		return b.raw[1] & 16 == 0

	def send(self, buf, ml, timeout=None):
		if timeout is None:
			timeout = max(0.6, len(buf) * 0.004 + 0.3)

		self.dev.flush()
		msg = "".join([chr(b) for b in buf]).encode("latin1")
		self.dev._write(msg)
		r = len(msg)
		to = time.time()
		while r > 0:
			r -= len(self.dev._read(r))
			if time.time() - to > timeout:
				sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [DRIVER] Timeout while waiting for TX echo cancellation\n")
				return None
		buf = bytearray()
		r = ml+1
		while r > 0:
			tmp = self.dev._read(r)
			r -= len(tmp)
			buf.extend(tmp)
			if time.time() - to > timeout:
				sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [DRIVER] Timeout while waiting for header ({ml+1} bytes, got {len(buf)} bytes)\n")
				return None
		r = buf[-1]-ml-1
		while r > 0:
			tmp = self.dev._read(r)
			r -= len(tmp)
			buf.extend(tmp)
			if time.time() - to > timeout:
				sys.stderr.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [DRIVER] Timeout while waiting for payload (total expected {buf[-1]} bytes, got {len(buf)} bytes)\n")
				return None
		return buf

	def send_command(self, mtype, data=[], retries=10, debug=False, timeout=None):
		msg, ml, dl = format_message(mtype, data)
		first = True
		while first or retries > 0:
			first = False
			if debug:
				sys.stderr.write("> [%s]" % ", ".join(["%02x" % m for m in msg]))
			resp = self.send(msg, ml, timeout=timeout)
			ret = None
			if resp == None:
				if debug:
					sys.stderr.write(" !%d \n" % (retries))
				retries -= 1
				time.sleep(0)
				continue
			else:
				if debug:
					sys.stderr.write("\n")
			if debug:
				sys.stderr.write("< [%s]" % ", ".join(["%02x" % r for r in resp]))
			invalid = (resp[-1] != checksum8bitHonda([r for r in resp[:-1]]))
			if invalid:
				if debug:
					sys.stderr.write(" !%d \n" % (retries))
				retries -= 1
				time.sleep(0)
				continue
			else:
				if debug:
					sys.stderr.write("\n")
			sys.stderr.flush()
			rmtype = resp[:ml]
			rml = resp[ml:(ml+1)]
			rdl = rml[0] - 2 - len(rmtype)
			rdata = resp[(ml+1):-1]
			return (rmtype, rml, rdata, rdl)

	def do_init_recover(self, debug=False):
		self.send_command([0x7b], [0x00, 0x01, 0x03], debug=debug)
		self.send_command([0x7b], [0x00, 0x01, 0x01], debug=debug)
		self.send_command([0x7b], [0x00, 0x01, 0x02], debug=debug)
		self.send_command([0x7b], [0x00, 0x01, 0x03], debug=debug)
		self.send_command([0x7b], [0x00, 0x02, 0x76, 0x03, 0x17], debug=debug) # seed/key?
		self.send_command([0x7b], [0x00, 0x03, 0x75, 0x05, 0x13], debug=debug) # seed/key?

	def do_init_write(self, debug=False):
		# is this the command to erase the ECU?
		self.send_command([0x7d], [0x01, 0x01, 0x00], debug=debug)
		self.send_command([0x7d], [0x01, 0x01, 0x01], debug=debug)
		self.send_command([0x7d], [0x01, 0x01, 0x02], debug=debug)
		self.send_command([0x7d], [0x01, 0x01, 0x03], debug=debug)
		self.send_command([0x7d], [0x01, 0x02, 0x50, 0x47, 0x4d], debug=debug) # seed/key?
		self.send_command([0x7d], [0x01, 0x03, 0x2d, 0x46, 0x49], debug=debug) # seed/key?

	def do_pre_write(self, debug=False):
		self.send_command([0x7e], [0x01, 0x01, 0x00], debug=debug)
		time.sleep(11)
		self.send_command([0x7e], [0x01, 0x02], debug=debug)
		self.send_command([0x7e], [0x01, 0x03, 0x00, 0x00], debug=debug)
		self.send_command([0x7e], [0x01, 0x01, 0x00], debug=debug)
		self.send_command([0x7e], [0x01, 0x0b, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff], debug=debug) # password?
		self.send_command([0x7e], [0x01, 0x01, 0x00], debug=debug)
		self.send_command([0x7e], [0x01, 0x0e, 0x01, 0x90], debug=debug)
		self.send_command([0x7e], [0x01, 0x01, 0x01], debug=debug)
		self.send_command([0x7e], [0x01, 0x04, 0xff], debug=debug)
		self.send_command([0x7e], [0x01, 0x01, 0x00], debug=debug)

	def do_pre_write_wait(self, debug=False):
		while True:
			info = self.send_command([0x7e], [0x01, 0x05], debug=debug)
			if info[2][1] == 0x00:
				break
		self.send_command([0x7e], [0x01, 0x01, 0x00], debug=debug)
