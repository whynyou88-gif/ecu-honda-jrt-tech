using System;
using System.Collections.Generic;

namespace JRT.Tect.Hardware.Dyno;

public class DynoDataEventArgs : EventArgs
{
    public double Time { get; set; }  // seconds
    public double Speed { get; set; } // km/h

    public DynoDataEventArgs(double time, double speed)
    {
        Time = time;
        Speed = speed;
    }
}

public class GpsStatusEventArgs : EventArgs
{
    public int Fix { get; set; } // 0=unknown, 1=nofix, 2=2D, 3=3D
    public int Siv { get; set; } // satellites in view

    public GpsStatusEventArgs(int fix, int siv)
    {
        Fix = fix;
        Siv = siv;
    }
}

public interface IDynoDeviceService
{
    bool IsConnected { get; }
    string CurrentPort { get; }
    int GpsFix { get; }
    int GpsSiv { get; }
    double CurrentSpeed { get; }

    event EventHandler<DynoDataEventArgs>? NewData;
    event EventHandler<GpsStatusEventArgs>? GpsStatusChanged;
    event EventHandler<double>? SpeedChanged;
    event EventHandler<string>? SerialPortChanged;

    List<string> GetAvailablePorts();
    void SetPort(string portName);
    bool Connect();
    void Disconnect();
}
