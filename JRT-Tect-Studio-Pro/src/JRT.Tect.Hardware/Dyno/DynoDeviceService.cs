using System;
using System.Collections.Generic;
using System.IO.Ports;
using System.Text;
using System.Threading;

namespace JRT.Tect.Hardware.Dyno;

public class DynoDeviceService : IDynoDeviceService
{
    private SerialPort? _serialPort;
    private readonly Timer _watchdogTimer;
    private string _currentPort = "";
    private readonly StringBuilder _buffer = new();

    public bool IsConnected => _serialPort != null && _serialPort.IsOpen;
    public string CurrentPort => _currentPort;
    public int GpsFix { get; private set; } = 1;
    public int GpsSiv { get; private set; } = 0;
    public double CurrentSpeed { get; private set; } = 0;

    public event EventHandler<DynoDataEventArgs>? NewData;
    public event EventHandler<GpsStatusEventArgs>? GpsStatusChanged;
    public event EventHandler<double>? SpeedChanged;
    public event EventHandler<string>? SerialPortChanged;

    public DynoDeviceService()
    {
        _watchdogTimer = new Timer(WatchdogTick, null, Timeout.Infinite, Timeout.Infinite);
    }

    public List<string> GetAvailablePorts()
    {
        return new List<string>(SerialPort.GetPortNames());
    }

    public void SetPort(string portName)
    {
        if (_currentPort != portName)
        {
            Disconnect();
            _currentPort = portName;
            SerialPortChanged?.Invoke(this, _currentPort);
        }
    }

    public bool Connect()
    {
        if (string.IsNullOrWhiteSpace(_currentPort)) return false;

        try
        {
            Disconnect();

            _serialPort = new SerialPort(_currentPort, 115200, Parity.None, 8, StopBits.One)
            {
                Handshake = Handshake.None,
                ReadTimeout = 500,
                WriteTimeout = 500
            };
            _serialPort.DataReceived += OnDataReceived;
            _serialPort.Open();

            _watchdogTimer.Change(1000, 1000);
            return true;
        }
        catch
        {
            Disconnect();
            return false;
        }
    }

    public void Disconnect()
    {
        _watchdogTimer.Change(Timeout.Infinite, Timeout.Infinite);
        if (_serialPort != null)
        {
            try
            {
                _serialPort.DataReceived -= OnDataReceived;
                if (_serialPort.IsOpen)
                {
                    _serialPort.Close();
                }
                _serialPort.Dispose();
            }
            catch { }
            _serialPort = null;
        }

        GpsFix = 1;
        GpsSiv = 0;
        CurrentSpeed = 0;
        GpsStatusChanged?.Invoke(this, new GpsStatusEventArgs(GpsFix, GpsSiv));
        SpeedChanged?.Invoke(this, CurrentSpeed);
    }

    private void WatchdogTick(object? state)
    {
        if (!IsConnected && !string.IsNullOrEmpty(_currentPort))
        {
            try
            {
                Connect();
            }
            catch { }
        }
    }

    private void OnDataReceived(object sender, SerialDataReceivedEventArgs e)
    {
        if (_serialPort == null || !_serialPort.IsOpen) return;

        try
        {
            string chunk = _serialPort.ReadExisting();
            _buffer.Append(chunk);

            string str = _buffer.ToString();
            int newlineIdx;
            while ((newlineIdx = str.IndexOf("\r\n", StringComparison.Ordinal)) >= 0)
            {
                string line = str.Substring(0, newlineIdx).Trim();
                _buffer.Remove(0, newlineIdx + 2);
                str = _buffer.ToString();

                ProcessLine(line);
            }
        }
        catch { }
    }

    private void ProcessLine(string line)
    {
        if (string.IsNullOrWhiteSpace(line) || !line.StartsWith("+")) return;

        string cleanLine = line.Substring(1);
        string[] parts = cleanLine.Split(';');
        if (parts.Length < 4) return;

        if (ulong.TryParse(parts[0], out ulong timeMs) &&
            ulong.TryParse(parts[1], out ulong speedMms) &&
            int.TryParse(parts[2], out int siv) &&
            int.TryParse(parts[3], out int fix))
        {
            double timeSec = timeMs / 1000.0;
            double speedKmh = (speedMms / 1000.0) * 3.6;

            if (GpsFix != fix || GpsSiv != siv)
            {
                GpsFix = fix;
                GpsSiv = siv;
                GpsStatusChanged?.Invoke(this, new GpsStatusEventArgs(GpsFix, GpsSiv));
            }

            if (Math.Abs(CurrentSpeed - speedKmh) > 0.01)
            {
                CurrentSpeed = speedKmh;
                SpeedChanged?.Invoke(this, CurrentSpeed);
            }

            NewData?.Invoke(this, new DynoDataEventArgs(timeSec, speedKmh));
        }
    }
}
