using System;
using System.IO.Ports;
using System.Threading;
using JRT.Tect.Hardware.Abstractions;

namespace JRT.Tect.Hardware.Serial
{
    public class StandardSerialAdapter : ISerialPortAdapter
    {
        private SerialPort _serialPort;

        public bool IsOpen => _serialPort != null && _serialPort.IsOpen;
        public string PortName => _serialPort?.PortName ?? string.Empty;

        public int BaudRate
        {
            get => _serialPort?.BaudRate ?? 10400;
            set
            {
                if (_serialPort != null)
                {
                    _serialPort.BaudRate = value;
                }
            }
        }

        public bool Open(string portName, int baudRate = 10400)
        {
            try
            {
                Close();
                _serialPort = new SerialPort(portName, baudRate, Parity.None, 8, StopBits.One)
                {
                    ReadTimeout = 1000,
                    WriteTimeout = 1000,
                    DtrEnable = false,
                    RtsEnable = false
                };
                _serialPort.Open();
                return IsOpen;
            }
            catch
            {
                return false;
            }
        }

        public void Close()
        {
            if (_serialPort != null)
            {
                if (_serialPort.IsOpen)
                {
                    _serialPort.Close();
                }
                _serialPort.Dispose();
                _serialPort = null;
            }
        }

        public int Write(byte[] buffer, int offset, int count)
        {
            if (!IsOpen) throw new InvalidOperationException("Serial port is not open.");
            _serialPort.Write(buffer, offset, count);
            return count;
        }

        public int Read(byte[] buffer, int offset, int count, int timeoutMs = 1000)
        {
            if (!IsOpen) throw new InvalidOperationException("Serial port is not open.");
            _serialPort.ReadTimeout = timeoutMs;
            
            int totalBytesRead = 0;
            while (totalBytesRead < count)
            {
                try
                {
                    int bytesRead = _serialPort.Read(buffer, offset + totalBytesRead, count - totalBytesRead);
                    if (bytesRead <= 0) break;
                    totalBytesRead += bytesRead;
                }
                catch (TimeoutException)
                {
                    break;
                }
            }
            return totalBytesRead;
        }

        public void Flush()
        {
            if (IsOpen)
            {
                _serialPort.DiscardInBuffer();
                _serialPort.DiscardOutBuffer();
            }
        }

        public bool SendBreak(int durationMs)
        {
            if (!IsOpen) return false;
            try
            {
                _serialPort.BreakState = true;
                Thread.Sleep(durationMs);
                _serialPort.BreakState = false;
                return true;
            }
            catch
            {
                return false;
            }
        }

        public string[] GetAvailablePorts()
        {
            return SerialPort.GetPortNames();
        }

        public void Dispose()
        {
            Close();
        }
    }
}
