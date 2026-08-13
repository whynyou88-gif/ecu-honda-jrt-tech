using System;

namespace JRT.Tect.Core.Dyno;

/// <summary>
/// Scalar Kalman Filter ported 1:1 from OpenDyno kalmanfilter.h / kalmanfilter.cpp
/// </summary>
public class KalmanFilter
{
    private double _A;
    private double _C;
    private double _V;
    private double _W;
    private double _P0;
    private double _xpri;
    private double _Ppri;
    private double _xpost;
    private double _Ppost;

    public void Init(double stdDev, double a, double c, double power, double dt)
    {
        _A = a;
        _C = c;
        _V = power * stdDev * dt;
        _W = stdDev * stdDev;
    }

    public void Reset(double initialVal)
    {
        _P0 = 1.0;
        _xpri = initialVal;
        _Ppri = _P0;
        _xpost = initialVal;
        _Ppost = _P0;
    }

    public double GetFiltered(double value)
    {
        _xpri = _A * _xpost;
        _Ppri = _A * _Ppost + _V;

        double eps = value - _C * _xpri;
        double s = _C * _Ppri * _C + _W;
        double k = _Ppri * _C * Math.Pow(s, -1.0);
        _xpost = _xpri + k * eps;
        _Ppost = _Ppri - k * s * k;

        return _xpost;
    }
}
