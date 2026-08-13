using System;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Windows;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JRT.Tect.Core.Dyno;
using JRT.Tect.Hardware.Dyno;

namespace JRT.Tect.Desktop.ViewModels;

public partial class DynoTestViewModel : ObservableObject
{
    private IDynoDeviceService _deviceService;

    [ObservableProperty]
    private DynoSettings _settings;

    [ObservableProperty]
    private ObservableCollection<DynoRun> _savedRuns = new();

    [ObservableProperty]
    private DynoRun? _selectedRun;

    [ObservableProperty]
    private DynoRunState _currentRunState = DynoRunState.Initial;

    [ObservableProperty]
    private string _statusText = "Siap Pengujian (GPS Disconnected)";

    [ObservableProperty]
    private double _liveSpeed;

    [ObservableProperty]
    private double _liveAcc;

    [ObservableProperty]
    private int _gpsFix = 1;

    [ObservableProperty]
    private int _gpsSiv = 0;

    [ObservableProperty]
    private string _gpsFixText = "No Fix";

    [ObservableProperty]
    private bool _isSimulationMode = true;

    [ObservableProperty]
    private double _lossesSecondsRemaining = 20.0;

    [ObservableProperty]
    private double _stockPeakHp = 8.5;

    [ObservableProperty]
    private double _stockPeakTq = 10.8;

    [ObservableProperty]
    private double _remapPeakHp = 10.4;

    [ObservableProperty]
    private double _remapPeakTq = 12.2;

    [ObservableProperty]
    private string _hpGainText = "+1.9 HP Gain (+22.1%)";

    // Calibration Helper properties
    [ObservableProperty]
    private double _calibSpeedKmh = 60.0;

    [ObservableProperty]
    private int _calibActualRpm = 3000;

    [ObservableProperty]
    private string _calibResultText = "RpmRatio Saat Ini: 20.0";

    public DynoRun CurrentRun { get; private set; } = new();

    public DynoTestViewModel()
    {
        _settings = DynoSettingsService.LoadSettings();
        _deviceService = new SimulatedDynoDeviceService();
        SetupDeviceEvents();

        // Seed initial sample runs for multi-run comparison
        var stockRun = new DynoRun { Name = "Run #1 (Stock Base)" };
        stockRun.Result.SetParameters(_settings.Profile.RpmRatio, _settings.Profile.Weight, 8, _settings.CorrectionFactor);
        SimulateSampleRun(stockRun, 8.5, 10.8, 6300, 5000);
        SavedRuns.Add(stockRun);

        var remapRun = new DynoRun { Name = "Run #2 (Remap Stage 1)" };
        remapRun.Result.SetParameters(_settings.Profile.RpmRatio, _settings.Profile.Weight, 8, _settings.CorrectionFactor);
        SimulateSampleRun(remapRun, 10.4, 12.2, 6700, 5500);
        SavedRuns.Add(remapRun);

        SelectedRun = remapRun;
        UpdateComparisonMetrics();

        // Connect simulation by default
        _deviceService.Connect();
    }

    private void SetupDeviceEvents()
    {
        _deviceService.NewData += OnDeviceNewData;
        _deviceService.GpsStatusChanged += OnGpsStatusChanged;
        _deviceService.SpeedChanged += OnSpeedChanged;
    }

    [RelayCommand]
    public void ToggleSimulationMode()
    {
        _deviceService.Disconnect();
        if (IsSimulationMode)
        {
            _deviceService = new DynoDeviceService();
            if (!string.IsNullOrEmpty(Settings.GpsPort))
            {
                _deviceService.SetPort(Settings.GpsPort);
            }
            _deviceService.Connect();
            IsSimulationMode = false;
            StatusText = "Mode Serial Hardware GPS Terhubung";
        }
        else
        {
            _deviceService = new SimulatedDynoDeviceService();
            _deviceService.Connect();
            IsSimulationMode = true;
            StatusText = "Mode Simulasi Road Dyno Aktif";
        }
        OnPropertyChanged(nameof(IsSimulationMode));
    }

    [RelayCommand]
    public void StartRun()
    {
        CurrentRun = new DynoRun
        {
            Name = $"Run #{SavedRuns.Count + 1}",
            LossTimeSec = Settings.LossTime
        };
        CurrentRun.Result.SetParameters(Settings.Profile.RpmRatio, Settings.Profile.Weight, 8, Settings.CorrectionFactor, Settings.FilterPower);
        CurrentRun.StateChanged += CurrentRun_StateChanged;
        CurrentRun.LossesRemainingChanged += CurrentRun_LossesRemainingChanged;
        CurrentRun.StartRun();
        StatusText = "Menunggu Kecepatan Kendaraan...";
    }

    [RelayCommand]
    public void CancelRun()
    {
        CurrentRun.CancelRun();
        CurrentRunState = DynoRunState.Canceled;
        StatusText = "Pengujian Dibatalkan";
    }

    [RelayCommand]
    public void SaveRun()
    {
        if (CurrentRun.Result.ItemsCount > 0)
        {
            SavedRuns.Add(CurrentRun);
            SelectedRun = CurrentRun;
            UpdateComparisonMetrics();

            string fileName = $"DynoRun_{DateTime.Now:yyyyMMdd_HHmmss}.dynorun";
            string path = Path.Combine(Settings.DataDir, fileName);
            CurrentRun.SaveToJsonFile(path);

            MessageBox.Show($"Data Dyno Run berhasil disimpan ke:\n{path}", "JRT Tech Dyno Studio", MessageBoxButton.OK, MessageBoxImage.Information);
        }
    }

    [RelayCommand]
    public void CalculateRpmRatio()
    {
        if (CalibSpeedKmh > 0 && CalibActualRpm > 0)
        {
            float newRatio = (float)Math.Round(CalibActualRpm / CalibSpeedKmh, 2);
            Settings.Profile.RpmRatio = newRatio;
            DynoSettingsService.SaveSettings(Settings);
            CalibResultText = $"Rasio Hasil Kalibrasi: {newRatio} (RPM / km/h)";

            foreach (var run in SavedRuns)
            {
                run.Result.SetParameters(newRatio, Settings.Profile.Weight, 8, Settings.CorrectionFactor, Settings.FilterPower);
                run.RecalculatePeakMetrics();
            }
            UpdateComparisonMetrics();
        }
    }

    private void CurrentRun_StateChanged(object? sender, DynoRunState state)
    {
        CurrentRunState = state;
        switch (state)
        {
            case DynoRunState.WaitForSpeed:
                StatusText = "Mendeteksi Pergerakan Kendaraan...";
                break;
            case DynoRunState.Countdown:
                StatusText = "Hitung Mundur Perekaman Akselerasi (2s)...";
                break;
            case DynoRunState.Accelerating:
                StatusText = "🏁 MEREKAM FASE AKSELERASI WOT (Buka Gas Penuh)...";
                break;
            case DynoRunState.Losses:
                StatusText = "⚡ MEREKAM FASE LOSSES (Engine Braking / Lepas Gas)...";
                break;
            case DynoRunState.Finished:
                StatusText = "✅ Pengujian Selesai! Mengkalkulasi Kurva Power & Torque.";
                SaveRun();
                break;
            case DynoRunState.Canceled:
                StatusText = "Pengujian Dibatalkan.";
                break;
        }
    }

    private void CurrentRun_LossesRemainingChanged(object? sender, double secondsLeft)
    {
        LossesSecondsRemaining = Math.Round(secondsLeft, 1);
    }

    private void OnDeviceNewData(object? sender, DynoDataEventArgs e)
    {
        CurrentRun.OnNewData(e.Time, e.Speed);
    }

    private void OnGpsStatusChanged(object? sender, GpsStatusEventArgs e)
    {
        GpsFix = e.Fix;
        GpsSiv = e.Siv;
        GpsFixText = e.Fix switch
        {
            3 => $"3D Fix ({e.Siv} Satellites)",
            2 => $"2D Fix ({e.Siv} Satellites)",
            _ => "No Fix (Scanning GPS...)"
        };
    }

    private void OnSpeedChanged(object? sender, double speed)
    {
        LiveSpeed = Math.Round(speed, 1);
        if (CurrentRun.Result.ItemsCount > 0)
        {
            var last = CurrentRun.Result.Item(CurrentRun.Result.ItemsCount - 1);
            if (last != null)
            {
                LiveAcc = Math.Round(last.AccFiltered, 2);
            }
        }
    }

    private void UpdateComparisonMetrics()
    {
        if (SavedRuns.Count >= 2)
        {
            var stock = SavedRuns[0];
            var remap = SavedRuns[1];

            StockPeakHp = Math.Round(stock.PowerMaxHp, 1);
            StockPeakTq = Math.Round(stock.TorqueMaxNm, 1);
            RemapPeakHp = Math.Round(remap.PowerMaxHp, 1);
            RemapPeakTq = Math.Round(remap.TorqueMaxNm, 1);

            double gainHp = RemapPeakHp - StockPeakHp;
            double gainPct = StockPeakHp > 0 ? (gainHp / StockPeakHp) * 100.0 : 0;
            HpGainText = $"+{gainHp:F1} HP Gain (+{gainPct:F1}%)";
        }
    }

    private void SimulateSampleRun(DynoRun run, double peakHp, double peakTq, int pRpm, int tRpm)
    {
        double maxKw = peakHp / 1.34102;
        for (int i = 0; i <= 60; i++)
        {
            double time = i * 0.25;
            double speed = 120.0 * (1.0 - Math.Exp(-0.08 * i));
            run.Result.AddData(time, speed);
        }
        run.FinishRun();
    }
}
