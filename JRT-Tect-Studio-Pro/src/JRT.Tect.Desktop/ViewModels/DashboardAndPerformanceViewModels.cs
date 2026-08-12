using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JRT.Tect.Core.Models;
using JRT.Tect.Protocols;

namespace JRT.Tect.Desktop.ViewModels;

public partial class DashboardViewModel : ObservableObject
{
    private readonly IHondaProtocolEngine _protocolEngine;
    private CancellationTokenSource? _cts;

    [ObservableProperty]
    private int _rpm = 0;

    [ObservableProperty]
    private double _speed = 0;

    [ObservableProperty]
    private double _tpsPercent = 0.0;

    [ObservableProperty]
    private double _engineTemp = 30.0;

    [ObservableProperty]
    private double _batteryVoltage = 12.4;

    [ObservableProperty]
    private string _uptimeText = "0h 0m 0s";

    public DashboardViewModel(IHondaProtocolEngine protocolEngine)
    {
        _protocolEngine = protocolEngine;
    }

    [RelayCommand]
    public async Task StartStreamingAsync()
    {
        _cts?.Cancel();
        _cts = new CancellationTokenSource();
        var progress = new Progress<TelemetryData>(data =>
        {
            Rpm = data.Rpm;
            Speed = data.VehicleSpeedKmh;
            TpsPercent = data.TpsPercent;
            EngineTemp = data.EctTempC;
            BatteryVoltage = data.BatteryVoltage;
        });

        await Task.Run(() => _protocolEngine.StreamTelemetryAsync(progress, _cts.Token));
    }

    [RelayCommand]
    public void StopStreaming()
    {
        _cts?.Cancel();
    }
}

public partial class LivePerformanceViewModel : ObservableObject
{
    private readonly IHondaProtocolEngine _protocolEngine;

    [ObservableProperty]
    private string _vehicleName = "HONDA VARIO 125 eSP (K59/K60)";

    [ObservableProperty]
    private string _ecuModel = "38770-K59-A11";

    [ObservableProperty]
    private string _calibrationId = "K59-A110-V02";

    [ObservableProperty]
    private int _rpm = 1450;

    [ObservableProperty]
    private double _tpsVoltage = 0.49;

    [ObservableProperty]
    private double _tpsPercent = 0.0;

    [ObservableProperty]
    private double _ectVoltage = 1.20;

    [ObservableProperty]
    private double _ectTemp = 85.0;

    [ObservableProperty]
    private double _iatVoltage = 2.40;

    [ObservableProperty]
    private double _iatTemp = 32.0;

    [ObservableProperty]
    private double _mapPressure = 34.2;

    [ObservableProperty]
    private double _batteryVoltage = 13.8;

    [ObservableProperty]
    private double _injectorDuration = 2.45;

    [ObservableProperty]
    private double _ignitionAdvance = 12.5;

    public LivePerformanceViewModel(IHondaProtocolEngine protocolEngine)
    {
        _protocolEngine = protocolEngine;
    }
}
