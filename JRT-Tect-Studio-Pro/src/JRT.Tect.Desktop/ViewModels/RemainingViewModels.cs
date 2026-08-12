using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JRT.Tect.Core.Models;
using JRT.Tect.Data.Repositories;
using JRT.Tect.Protocols;

namespace JRT.Tect.Desktop.ViewModels;

public partial class LiveDataViewModel : ObservableObject
{
    private readonly IHondaProtocolEngine _protocolEngine;

    [ObservableProperty]
    private int _revLimitCut = 10500;

    [ObservableProperty]
    private string _selectedCutType = "Hard Cut (Ignition)";

    [ObservableProperty]
    private bool _helicopterModeEnabled;

    [ObservableProperty]
    private bool _rotaryModeEnabled;

    [ObservableProperty]
    private bool _popBangsEnabled;

    [ObservableProperty]
    private bool _launchControlEnabled;

    public LiveDataViewModel(IHondaProtocolEngine protocolEngine)
    {
        _protocolEngine = protocolEngine;
    }
}

public partial class DiagnosticViewModel : ObservableObject
{
    private readonly IHondaProtocolEngine _protocolEngine;

    [ObservableProperty]
    private ObservableCollection<DtcRecord> _dtcList = new();

    [ObservableProperty]
    private bool _isBusy;

    [ObservableProperty]
    private string _statusMessage = "No DTCs found — Engine OK";

    public DiagnosticViewModel(IHondaProtocolEngine protocolEngine)
    {
        _protocolEngine = protocolEngine;
    }

    [RelayCommand]
    public async Task ReadDtcAsync()
    {
        IsBusy = true;
        StatusMessage = "Reading DTC codes from ECU via K-Line...";
        try
        {
            var dtcs = await _protocolEngine.ReadDtcAsync();
            DtcList.Clear();
            foreach (var dtc in dtcs)
            {
                DtcList.Add(dtc);
            }
            StatusMessage = DtcList.Count > 0 ? $"Found {DtcList.Count} fault code(s)" : "No DTCs found — Engine OK";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    public async Task ClearDtcAsync()
    {
        IsBusy = true;
        StatusMessage = "Clearing fault codes...";
        try
        {
            bool success = await _protocolEngine.ClearDtcAsync();
            if (success)
            {
                DtcList.Clear();
                StatusMessage = "DTC Codes cleared successfully";
            }
            else
            {
                StatusMessage = "Clear DTC failed (ECU Offline or Communication Error)";
            }
        }
        finally
        {
            IsBusy = false;
        }
    }
}

public partial class MapEditorViewModel : ObservableObject
{
    [ObservableProperty]
    private string _selectedEcuModel = "22 VARIO 125 OLD KZRA-601 (2013-2015)";

    [ObservableProperty]
    private double _editStep = 0.05;

    [ObservableProperty]
    private ObservableCollection<MapCell> _mapGrid = new();

    public MapEditorViewModel()
    {
        GenerateSampleGrid();
    }

    private void GenerateSampleGrid()
    {
        MapGrid.Clear();
        int[] rpms = { 1000, 1500, 2000, 2500, 3000, 3500, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000 };
        double[] tps = { 0, 1.2, 2.5, 4, 6.5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100 };

        for (int r = 0; r < rpms.Length; r++)
        {
            for (int c = 0; c < tps.Length; c++)
            {
                double baseVal = 1.200 + (r * 0.12) + (c * 0.015);
                MapGrid.Add(new MapCell
                {
                    RowIndex = r,
                    ColumnIndex = c,
                    RowHeader = rpms[r],
                    ColumnHeader = tps[c],
                    Value = Math.Round(baseVal, 3)
                });
            }
        }
    }

    [RelayCommand]
    public void IncreaseCellValues()
    {
        foreach (var cell in MapGrid)
        {
            cell.Value = Math.Round(cell.Value + EditStep, 3);
        }
        OnPropertyChanged(nameof(MapGrid));
    }

    [RelayCommand]
    public void DecreaseCellValues()
    {
        foreach (var cell in MapGrid)
        {
            cell.Value = Math.Round(Math.Max(0, cell.Value - EditStep), 3);
        }
        OnPropertyChanged(nameof(MapGrid));
    }
}

public partial class DynoTestViewModel : ObservableObject
{
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
}

public partial class FlashEcuViewModel : ObservableObject
{
    private readonly IHondaProtocolEngine _protocolEngine;
    private CancellationTokenSource? _cts;

    [ObservableProperty]
    private string _selectedBinFile = "test_upload.bin [Verified: OK]";

    [ObservableProperty]
    private bool _autoBackupBeforeWrite = true;

    [ObservableProperty]
    private bool _dryRunSimulationMode;

    [ObservableProperty]
    private int _flashProgressPct = 0;

    [ObservableProperty]
    private bool _isFlashing;

    [ObservableProperty]
    private string _flashStatusText = "Ready to flash ECU";

    public FlashEcuViewModel(IHondaProtocolEngine protocolEngine)
    {
        _protocolEngine = protocolEngine;
    }

    [RelayCommand]
    public async Task WriteCalibrationAsync()
    {
        IsFlashing = true;
        _cts = new CancellationTokenSource();
        var progress = new Progress<int>(pct => FlashProgressPct = pct);

        FlashStatusText = "Flashing Calibration Map to ECU memory...";
        try
        {
            byte[] mockData = new byte[65536];
            bool ok = await _protocolEngine.WriteFlashMemoryAsync(mockData, progress, _cts.Token);
            FlashStatusText = ok ? "Flash Calibration Completed Successfully! ✅" : "Flash Error ❌";
        }
        catch (OperationCanceledException)
        {
            FlashStatusText = "Flash Operation Cancelled by User 🛑";
        }
        finally
        {
            IsFlashing = false;
        }
    }

    [RelayCommand]
    public void CancelFlash()
    {
        _cts?.Cancel();
    }
}

public partial class DatabaseEcuViewModel : ObservableObject
{
    private readonly IEcuModelRepository _repository;

    [ObservableProperty]
    private ObservableCollection<EcuRecord> _ecuRecords = new();

    [ObservableProperty]
    private string _partNumberInput = "38770-K59-A11";

    [ObservableProperty]
    private string _modelNameInput = "Honda Vario 125 eSP (K35/K60)";

    [ObservableProperty]
    private string _customerInput = "Budi / JRT Racing";

    [ObservableProperty]
    private string _licensePlateInput = "B 1234 ABC";

    [ObservableProperty]
    private string _hardwareBrandInput = "Keihin PGM-FI (Honda OEM)";

    [ObservableProperty]
    private string _fuelGradeInput = "Pertamax (RON 92)";

    [ObservableProperty]
    private string _notesInput = "Stage 1 Remap 4V eSP+";

    [ObservableProperty]
    private string _searchFilter = "";

    public DatabaseEcuViewModel(IEcuModelRepository repository)
    {
        _repository = repository;
        _ = LoadRecordsAsync();
    }

    [RelayCommand]
    public async Task LoadRecordsAsync()
    {
        var records = await _repository.SearchRecordsAsync(SearchFilter);
        EcuRecords.Clear();
        foreach (var rec in records)
        {
            EcuRecords.Add(rec);
        }
    }

    [RelayCommand]
    public async Task SaveRecordAsync()
    {
        var record = new EcuRecord
        {
            PartNumber = PartNumberInput,
            ModelName = ModelNameInput,
            CustomerName = CustomerInput,
            LicensePlate = LicensePlateInput,
            HardwareBrand = HardwareBrandInput,
            FuelGrade = FuelGradeInput,
            RemapNotes = NotesInput,
            CreatedAt = DateTime.Now
        };

        await _repository.SaveRecordAsync(record);
        await LoadRecordsAsync();
    }
}

public partial class SettingsViewModel : ObservableObject
{
    [ObservableProperty]
    private string _wifiSsid = "JRT Tect";

    [ObservableProperty]
    private int _baudRate = 10400;

    [ObservableProperty]
    private int _timeoutMs = 500;

    [ObservableProperty]
    private bool _autoReconnect = true;

    [ObservableProperty]
    private bool _darkMode = true;
}
