using System;
using System.IO;
using System.Linq;
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

            // Intercept new window requests so everything stays inside the WPF app window
            webView.CoreWebView2.NewWindowRequested += (s, args) =>
            {
                args.Handled = true;
                if (!string.IsNullOrEmpty(args.Uri))
                {
                    webView.CoreWebView2.Navigate(args.Uri);
                }
            };

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            
            // Search all possible publish and development asset directory paths
            string[] candidatePaths = new string[]
            {
                Path.Combine(baseDir, "data", "web"),
                Path.Combine(baseDir, "HondaECUTool", "data", "web"),
                Path.Combine(baseDir, "web"),
                baseDir
            };

            string? webPath = candidatePaths.FirstOrDefault(p => Directory.Exists(p) && File.Exists(Path.Combine(p, "index.html")));

            if (webPath == null)
            {
                // Traverse parent directories up to project root if running from bin/Debug
                DirectoryInfo? dir = new DirectoryInfo(baseDir);
                while (dir != null && webPath == null)
                {
                    foreach (var sub in new[] { "HondaECUTool/data/web", "data/web" })
                    {
                        string candidate = Path.Combine(dir.FullName, sub);
                        if (Directory.Exists(candidate) && File.Exists(Path.Combine(candidate, "index.html")))
                        {
                            webPath = candidate;
                            break;
                        }
                    }
                    dir = dir.Parent;
                }
            }

            if (!string.IsNullOrEmpty(webPath))
            {
                // Serve local web assets natively via https://jrtapp.local/
                webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "jrtapp.local", webPath, CoreWebView2HostResourceAccessKind.Allow);
                webView.Source = new Uri("https://jrtapp.local/index.html");
            }
            else
            {
                MessageBox.Show($"File index.html tidak ditemukan di folder aplikasi.\nBase Directory: {baseDir}", "JRT Tech ANALIST Pro", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show($"WebView2 Exception: {ex.Message}", "JRT Tech ANALIST Pro", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }
}
