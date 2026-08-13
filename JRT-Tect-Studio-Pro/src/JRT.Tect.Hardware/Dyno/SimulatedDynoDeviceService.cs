using System;
using System.Collections.Generic;
using System.Threading;

namespace JRT.Tect.Hardware.Dyno;

public class SimulatedDynoDeviceService : IDynoDeviceService
{
    private readonly Timer _simTimer;
    private bool _isConnected;
    private double _elapsedTime;
    private double _currentSpeed;

    public bool IsConnected => _isConnected;
    public string CurrentPort => "SIMULATOR (GPS Road Dyno)";
    public int GpsFix => 3; // 3D Fix
    public int GpsSiv => 12; // 12 Satellites
    public double CurrentSpeed => _currentSpeed;

    public event EventHandler<DynoDataEventArgs>? NewData;
    public event EventHandler<GpsStatusEventArgs>? GpsStatusChanged;
    public event EventHandler<double>? SpeedChanged;
    public event EventHandler<string>? SerialPortChanged;

    public SimulatedDynoDeviceService()
    {
        _simTimer = new Timer(SimTick, null, Timeout.Infinite, Timeout.Infinite);
    }

    public List<string> GetAvailablePorts()
    {
        return new List<string> { "SIMULATOR (GPS Road Dyno)", "COM3 - USB Serial GPS", "COM4 - FTDI UART" };
    }

    public void SetPort(string portName)
    {
        SerialPortChanged?.Invoke(this, portName);
    }

    public bool Connect()
    {
        _isConnected = true;
        _elapsedTime = 0;
        _currentSpeed = 0;
        _simTimer.Change(0, 250); // 4Hz tick rate
        GpsStatusChanged?.Invoke(this, new GpsStatusEventArgs(GpsFix, GpsSiv));
        return true;
    }

    public void Disconnect()
    {
        _isConnected = false;
        _simTimer.Change(Timeout.Infinite, Timeout.Infinite);
        _currentSpeed = 0;
        SpeedChanged?.Invoke(this, 0);
    }

    private void SimTick(object? state)
    {
        if (!_isConnected) return;

        _elapsedTime += 0.25; // 250ms = 0.25s

        // Realistic acceleration -> coast-down simulation profile
        double speed;
        if (_elapsedTime < 2.0)
        {
            // Initial wait
            speed = 0;
        }
        else if (_elapsedTime < 16.0)
        {
            // WOT Acceleration phase (0 to ~120 km/h)
            double t = _elapsedTime - 2.0;
            speed = 125.0 * (1.0 - Math.Exp(-0.18 * t));
        }
        else if (_elapsedTime < 36.0)
        {
            // Coast-down (Losses) phase
            double t = _elapsedTime - 16.0;
            speed = 115.0 * Math.Exp(-0.045 * t);
        }
        else
        {
            // Restart cycle
            _elapsedTime = 0;
            speed = 0;
        }

        _currentSpeed = Math.Max(0, speed);
        SpeedChanged?.Invoke(this, _currentSpeed);
        NewData?.Invoke(this, new DynoDataEventArgs(_elapsedTime, _currentSpeed));
    }
}
