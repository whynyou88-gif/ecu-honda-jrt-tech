using System;
using System.Collections.Generic;
using System.Linq;

namespace JRT.Tect.Core.Dyno;

/// <summary>
/// Port of dynorunresult.h / dynorunresult.cpp from OpenDyno
/// </summary>
public class DynoRunResult
{
    private float _rpmRatio = 20.0f;
    private int _weight = 1000;
    private int _lossesSkipNum = 8;
    private int _lossesStartIndex = -1;
    private int _lossesCnt = 0;
    private double _correctionFactor = 1.0;

    private readonly List<DynoRunResultItem> _items = new();
    private readonly KalmanFilter _accFilter = new();
    private readonly KalmanFilter _pwrFilter = new();
    private readonly KalmanFilter _speedFilter = new();

    private double _lossA = 0;
    private double _lossB = 0;
    private double _lossC = 0;

    public DynoRunResult()
    {
        _correctionFactor = 1.0;
        _accFilter.Init(4.0, 1.0, 1.0, 4.0, 0.25);
        _pwrFilter.Init(10.0, 1.0, 1.0, 15.0, 0.25);
        _speedFilter.Init(0.2, 1.0, 1.0, 1.0, 0.25);
    }

    public void SetParameters(float rpmRatio, int weight, int lossesSkipNum = 8, double correctionFactor = 1.0, double filterPower = 4.0)
    {
        _rpmRatio = rpmRatio;
        _weight = weight;
        _lossesSkipNum = lossesSkipNum;
        _correctionFactor = correctionFactor;

        _accFilter.Init(4.0, 1.0, 1.0, filterPower, 0.25);
        _pwrFilter.Reset(0);

        for (int i = 0; i < _items.Count; i++)
        {
            _items[i].Rpm = (int)Math.Round(_items[i].Speed * _rpmRatio);
            CalculateForceAndPower(_items[i]);
        }

        RecalculateLosses();
    }

    public float RpmRatio => _rpmRatio;
    public int Weight => _weight;
    public double CorrectionFactor => _correctionFactor;

    public DynoRunResultItem AddData(double time, double speed)
    {
        DynoRunResultItem? prevItem = _items.Count > 0 ? _items.Last() : null;
        if (_items.Count == 0)
        {
            _speedFilter.Reset(speed);
        }

        var item = new DynoRunResultItem
        {
            Time = time,
            Speed = _speedFilter.GetFiltered(speed)
        };
        item.SpeedMs = item.Speed * 1000.0 / 3600.0;
        item.Rpm = (int)Math.Round(item.Speed * _rpmRatio);

        if (prevItem != null)
        {
            double dt = item.Time - prevItem.Time;
            item.Acc = dt > 0 ? (item.SpeedMs - prevItem.SpeedMs) / dt : 0;
        }
        else
        {
            item.Acc = 0;
        }

        _items.Add(item);

        int lastIdx = _items.Count - 2;
        if (lastIdx >= 0)
        {
            RecalculateItem(lastIdx);
        }

        return item;
    }

    private void CalculateForceAndPower(DynoRunResultItem item)
    {
        item.Force = item.AccFiltered * _weight;
        item.PowerKw = item.Force * item.SpeedMs / 1000.0 * _correctionFactor;
        item.PowerKwFiltered = _pwrFilter.GetFiltered(item.PowerKw);
    }

    private void RecalculateItem(int idx)
    {
        if (idx < 0 || idx >= _items.Count) return;

        var item = _items[idx];
        if (idx == 0 || idx == _items.Count - 1)
        {
            item.AccFiltered = item.Acc;
            item.AccMean = item.Acc;
        }
        else
        {
            var prevItem = _items[idx - 1];
            var nextItem = _items[idx + 1];
            item.AccMean = (prevItem.Acc + item.Acc + nextItem.Acc) / 3.0;
            item.AccFiltered = _accFilter.GetFiltered(item.AccMean);
        }

        CalculateForceAndPower(item);

        if (item.PowerKw < 0)
        {
            _lossesCnt++;
            if (_lossesCnt > 3 && _lossesStartIndex < 0)
            {
                _lossesStartIndex = _items.Count - _lossesCnt;
            }
            RecalculateLosses();
        }
        else if (_lossesStartIndex < 0)
        {
            _lossesCnt = 0;
        }
    }

    private void RecalculateLosses()
    {
        if (_lossesCnt <= 10 || _lossesStartIndex < 0) return;

        int baseIdx = _lossesStartIndex + _lossesSkipNum;
        int cnt = _lossesCnt - _lossesSkipNum - 1;
        if (cnt <= 0 || baseIdx + cnt > _items.Count) return;

        double xsum = 0, x2sum = 0, ysum = 0, xysum = 0;
        for (int i = 0; i < cnt; i++)
        {
            var item = _items[baseIdx + i];
            double x = item.Rpm;
            double y = -item.PowerKw;
            if (y <= 0) continue;
            double lny = Math.Log(y);

            xsum += x;
            ysum += lny;
            x2sum += Math.Pow(x, 2);
            xysum += x * lny;
        }

        double denom = (cnt * x2sum - xsum * xsum);
        if (Math.Abs(denom) > 1e-9)
        {
            _lossA = (cnt * xysum - xsum * ysum) / denom;
            _lossB = (x2sum * ysum - xsum * xysum) / denom;
            _lossC = Math.Pow(Math.E, _lossB);
        }
    }

    public double LossAt(int rpm)
    {
        if (_lossesCnt <= 0 || _lossC <= 0) return 0;
        return _lossC * Math.Pow(Math.E, _lossA * rpm);
    }

    public DynoRunResultItem? Item(int idx)
    {
        if (idx >= 0 && idx < _items.Count) return _items[idx];
        return null;
    }

    public List<DynoRunResultItem> Items => _items;

    public int ResultsCount => _lossesStartIndex >= 0 ? _lossesStartIndex : Math.Max(0, _items.Count - 1);
    public int LossesCount => _lossesStartIndex >= 0 ? Math.Max(0, _items.Count - _lossesStartIndex - 1) : 0;
    public int ItemsCount => Math.Max(0, _items.Count - 1);
}
