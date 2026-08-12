using System.Collections.Generic;
using System.Windows.Controls;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JRT.Tect.Data;
using JRT.Tect.Data.Repositories;
using JRT.Tect.Hardware;
using JRT.Tect.Protocols;

namespace JRT.Tect.Desktop.ViewModels;

public enum NavigationTarget
{
    Dashboard,
    LivePerformance,
    LiveData,
    Diagnostic,
    MapEditor,
    DynoTest,
    FlashEcu,
    DatabaseEcu,
    Backup,
    Restore,
    FileManager,
    Terminal,
    Logs,
    Settings,
    About
}

public partial class MainViewModel : ObservableObject
{
    // Lazy View Cache: Stores initialized UserControls so tab switches are instantaneous without rebuild
    private readonly Dictionary<NavigationTarget, UserControl> _viewCache = new();
    private readonly EcuDbContext _dbContext;
    private readonly IEcuModelRepository _repository;
    private readonly IKLineAdapter _adapter;
    private readonly IHondaProtocolEngine _protocolEngine;

    [ObservableProperty]
    private UserControl _currentView = null!;

    [ObservableProperty]
    private NavigationTarget _activeTarget = NavigationTarget.Dashboard;

    [ObservableProperty]
    private string _currentPageTitle = "Dashboard";

    [ObservableProperty]
    private bool _isConnected;

    [ObservableProperty]
    private string _connectionStatusText = "ECU OFFLINE";

    [ObservableProperty]
    private string _selectedPort = "usbserial-4 (FTDI UART)";

    public MainViewModel()
    {
        _dbContext = new EcuDbContext();
        _repository = new EcuModelRepository(_dbContext);
        _adapter = new SerialKLineAdapter();
        _protocolEngine = new HondaPGMFIProtocolEngine(_adapter, new Core.Checksum.HondaChecksumCalculator());

        // Initialize default Dashboard View into cache
        NavigateTo(NavigationTarget.Dashboard);
    }

    [RelayCommand]
    public void Navigate(NavigationTarget target)
    {
        NavigateTo(target);
    }

    private void NavigateTo(NavigationTarget target)
    {
        ActiveTarget = target;
        CurrentPageTitle = GetPageTitle(target);

        // Check if view is already cached
        if (!_viewCache.TryGetValue(target, out var cachedView))
        {
            cachedView = CreateView(target);
            _viewCache[target] = cachedView;
        }

        CurrentView = cachedView;
    }

    private UserControl CreateView(NavigationTarget target) => target switch
    {
        NavigationTarget.Dashboard => new Views.DashboardView { DataContext = new DashboardViewModel(_protocolEngine) },
        NavigationTarget.LivePerformance => new Views.LivePerformanceView { DataContext = new LivePerformanceViewModel(_protocolEngine) },
        NavigationTarget.LiveData => new Views.LiveDataView { DataContext = new LiveDataViewModel(_protocolEngine) },
        NavigationTarget.Diagnostic => new Views.DiagnosticView { DataContext = new DiagnosticViewModel(_protocolEngine) },
        NavigationTarget.MapEditor => new Views.MapEditorView { DataContext = new MapEditorViewModel() },
        NavigationTarget.DynoTest => new Views.DynoTestView { DataContext = new DynoTestViewModel() },
        NavigationTarget.FlashEcu => new Views.FlashEcuView { DataContext = new FlashEcuViewModel(_protocolEngine) },
        NavigationTarget.DatabaseEcu => new Views.DatabaseEcuView { DataContext = new DatabaseEcuViewModel(_repository) },
        NavigationTarget.Settings => new Views.SettingsView { DataContext = new SettingsViewModel() },
        _ => new Views.DashboardView { DataContext = new DashboardViewModel(_protocolEngine) }
    };

    private static string GetPageTitle(NavigationTarget target) => target switch
    {
        NavigationTarget.Dashboard => "Dashboard",
        NavigationTarget.LivePerformance => "🏁 LIVE PERFORMANCE",
        NavigationTarget.LiveData => "Live Data",
        NavigationTarget.Diagnostic => "Diagnostic Trouble Codes (DTC)",
        NavigationTarget.MapEditor => "Map Editor (3D / 2D Grid)",
        NavigationTarget.DynoTest => "Dyno Test Studio",
        NavigationTarget.FlashEcu => "Flash ECU & Remap Studio",
        NavigationTarget.DatabaseEcu => "Database ECU Management",
        NavigationTarget.Settings => "Settings",
        _ => "JRT Tech ANALIST Pro"
    };

    [RelayCommand]
    public async Task ToggleConnectionAsync()
    {
        if (IsConnected)
        {
            await _protocolEngine.DisconnectAsync();
            IsConnected = false;
            ConnectionStatusText = "ECU OFFLINE";
        }
        else
        {
            _adapter.PortName = SelectedPort;
            bool success = await _protocolEngine.ConnectAsync();
            IsConnected = success;
            ConnectionStatusText = success ? "ECU CONNECTED (10.4 kbps)" : "CONNECT FAILED";
        }
    }
}
