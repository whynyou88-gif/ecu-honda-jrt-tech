using System;
using System.IO;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace JRT.Tect.Desktop.Views;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Loaded += MainWindow_Loaded;
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            await webView.EnsureCoreWebView2Async();

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string webPath = Path.Combine(baseDir, "HondaECUTool", "data", "web");

            if (!Directory.Exists(webPath))
            {
                DirectoryInfo? dir = new DirectoryInfo(baseDir);
                while (dir != null && !Directory.Exists(Path.Combine(dir.FullName, "HondaECUTool", "data", "web")))
                {
                    dir = dir.Parent;
                }
                if (dir != null)
                {
                    webPath = Path.Combine(dir.FullName, "HondaECUTool", "data", "web");
                }
            }

            if (Directory.Exists(webPath))
            {
                webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "jrtapp.local", webPath, CoreWebView2HostResourceAccessKind.Allow);
                webView.Source = new Uri("https://jrtapp.local/index.html");
            }
            else
            {
                webView.Source = new Uri("http://localhost:8080/index.html");
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show($"WebView2 Exception: {ex.Message}", "JRT Tech ANALIST Pro", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }
}
