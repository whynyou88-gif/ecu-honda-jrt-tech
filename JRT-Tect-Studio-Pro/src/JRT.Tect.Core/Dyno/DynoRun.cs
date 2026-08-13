using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace JRT.Tect.Core.Dyno;

public class DynoRun
{
    public string Name { get; set; } = "Run #1";
    public DateTime RecordedAt { get; set; } = DateTime.Now;
    public DynoRunState State { get; private set; } = DynoRunState.Initial;
    public DynoRunResult Result { get; } = new();

    public double LossTimeSec { get; set; } = 20.0;
    private int _countdownTicks = 0;
    private double _startTime = 0;
    private double _lossesStartTime = 0;

    public double PowerMaxKw { get; private set; }
    public double PowerMaxHp => PowerMaxKw * 1.34102;
    public int PowerMaxRpm { get; private set; }

    public double TorqueMaxNm { get; private set; }
    public int TorqueMaxRpm { get; private set; }

    public double SpeedMax { get; private set; }
    public int RpmMax { get; private set; }

    public event EventHandler<DynoRunState>? StateChanged;
    public event EventHandler<double>? LossesRemainingChanged;

    public void StartRun()
    {
        State = DynoRunState.WaitForSpeed;
        StateChanged?.Invoke(this, State);
    }

    public void CancelRun()
    {
        State = DynoRunState.Canceled;
        StateChanged?.Invoke(this, State);
    }

    public void FinishRun(DynoRunState finalState = DynoRunState.Finished)
    {
        State = finalState;
        RecalculatePeakMetrics();
        StateChanged?.Invoke(this, State);
    }

    public void OnNewData(double gpsTime, double speed)
    {
        switch (State)
        {
            case DynoRunState.WaitForSpeed:
                if (speed >= 0)
                {
                    _countdownTicks = -8; // ~2 seconds wait at 4Hz sample rate
                    State = DynoRunState.Countdown;
                    StateChanged?.Invoke(this, State);
                }
                break;

            case DynoRunState.Countdown:
                _countdownTicks++;
                if (_countdownTicks >= 0)
                {
                    _startTime = gpsTime;
                    State = DynoRunState.Accelerating;
                    StateChanged?.Invoke(this, State);
                }
                break;

            case DynoRunState.Accelerating:
                Result.AddData(gpsTime - _startTime, speed);
                RecalculatePeakMetrics();
                if (Result.LossesCount > 0)
                {
                    _lossesStartTime = gpsTime;
                    State = DynoRunState.Losses;
                    StateChanged?.Invoke(this, State);
                }
                break;

            case DynoRunState.Losses:
                Result.AddData(gpsTime - _startTime, speed);
                RecalculatePeakMetrics();
                double elapsedLoss = gpsTime - _lossesStartTime;
                double remaining = Math.Max(0, LossTimeSec - elapsedLoss);
                LossesRemainingChanged?.Invoke(this, remaining);
                if (elapsedLoss >= LossTimeSec)
                {
                    FinishRun(DynoRunState.Finished);
                }
                break;
        }
    }

    public void RecalculatePeakMetrics()
    {
        double pMax = 0;
        int pRpm = 0;
        double tMax = 0;
        int tRpm = 0;
        double sMax = 0;
        int rMax = 0;

        foreach (var item in Result.Items)
        {
            if (item.Speed > sMax) sMax = item.Speed;
            if (item.Rpm > rMax) rMax = item.Rpm;

            double totalPowerKw = item.PowerKwFiltered + Result.LossAt(item.Rpm);
            if (totalPowerKw > pMax)
            {
                pMax = totalPowerKw;
                pRpm = item.Rpm;
            }

            double torque = CalculateTorque(item.Rpm, totalPowerKw);
            if (torque > tMax)
            {
                tMax = torque;
                tRpm = item.Rpm;
            }
        }

        PowerMaxKw = pMax;
        PowerMaxRpm = pRpm;
        TorqueMaxNm = tMax;
        TorqueMaxRpm = tRpm;
        SpeedMax = sMax;
        RpmMax = rMax;
    }

    public static double CalculateTorque(int rpm, double powerKw)
    {
        if (rpm <= 0) return 0;
        return powerKw * 9549.3 / rpm;
    }

    public bool SaveToJsonFile(string filePath)
    {
        try
        {
            var rawData = new List<DynoRawPoint>();
            foreach (var item in Result.Items)
            {
                rawData.Add(new DynoRawPoint { Time = item.Time, Speed = item.Speed });
            }

            var dto = new DynoRunFileDto
            {
                FormatVersion = "1.0",
                Name = Name,
                RecordedAt = RecordedAt,
                RpmRatio = Result.RpmRatio,
                Weight = Result.Weight,
                CorrectionFactor = Result.CorrectionFactor,
                RawData = rawData
            };

            string json = JsonSerializer.Serialize(dto, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(filePath, json);
            return true;
        }
        catch
        {
            return false;
        }
    }

    public bool LoadFromJsonFile(string filePath)
    {
        try
        {
            if (!File.Exists(filePath)) return false;
            string json = File.ReadAllText(filePath);
            var dto = JsonSerializer.Deserialize<DynoRunFileDto>(json);
            if (dto == null) return false;

            Name = dto.Name;
            RecordedAt = dto.RecordedAt;
            Result.SetParameters(dto.RpmRatio, dto.Weight, 8, dto.CorrectionFactor);

            Result.Items.Clear();
            foreach (var pt in dto.RawData)
            {
                Result.AddData(pt.Time, pt.Speed);
            }

            RecalculatePeakMetrics();
            State = DynoRunState.Finished;
            return true;
        }
        catch
        {
            return false;
        }
    }

    public bool ImportLegacyDynoFile(string filePath)
    {
        try
        {
            if (!File.Exists(filePath)) return false;
            string[] lines = File.ReadAllLines(filePath);
            if (lines.Length == 0) return false;

            // OpenDyno format: opendynofile;<rpmRatio>;<weight>
            string header = lines[0].Trim();
            string[] headerParts = header.Split(';');
            if (headerParts.Length < 3 || !headerParts[0].Equals("opendynofile", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            float.TryParse(headerParts[1], out float rpmRatio);
            int.TryParse(headerParts[2], out int weight);

            Name = Path.GetFileNameWithoutExtension(filePath);
            Result.SetParameters(rpmRatio > 0 ? rpmRatio : 20.0f, weight > 0 ? weight : 1000);
            Result.Items.Clear();

            for (int i = 1; i < lines.Length; i++)
            {
                string line = lines[i].Trim();
                if (string.IsNullOrEmpty(line)) continue;
                string[] parts = line.Split(';');
                if (parts.Length >= 2 && double.TryParse(parts[0], out double t) && double.TryParse(parts[1], out double spd))
                {
                    Result.AddData(t, spd);
                }
            }

            RecalculatePeakMetrics();
            State = DynoRunState.Finished;
            return true;
        }
        catch
        {
            return false;
        }
    }
}

public class DynoRunFileDto
{
    public string FormatVersion { get; set; } = "1.0";
    public string Name { get; set; } = "";
    public DateTime RecordedAt { get; set; }
    public float RpmRatio { get; set; }
    public int Weight { get; set; }
    public double CorrectionFactor { get; set; }
    public List<DynoRawPoint> RawData { get; set; } = new();
}

public class DynoRawPoint
{
    public double Time { get; set; }
    public double Speed { get; set; }
}
