using System;
using System.IO;
using System.Text.Json;

namespace JRT.Tect.Core.Dyno;

public class DynoSettings
{
    public string DataDir { get; set; } = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "AnalistPro", "DynoRuns");
    public string GpsPort { get; set; } = "";
    public int LossTime { get; set; } = 20; // seconds
    public double CorrectionFactor { get; set; } = 1.0;
    public double FilterPower { get; set; } = 4.0;
    public VehicleProfile Profile { get; set; } = new();
    public string WatermarkPath { get; set; } = "";
}

public class DynoSettingsService
{
    private static readonly string SettingsFilePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "AnalistPro", "dyno_settings.json");

    public static DynoSettings LoadSettings()
    {
        try
        {
            if (File.Exists(SettingsFilePath))
            {
                string json = File.ReadAllText(SettingsFilePath);
                var settings = JsonSerializer.Deserialize<DynoSettings>(json);
                if (settings != null) return settings;
            }
        }
        catch { }

        var defaultSettings = new DynoSettings();
        SaveSettings(defaultSettings);
        return defaultSettings;
    }

    public static bool SaveSettings(DynoSettings settings)
    {
        try
        {
            string? dir = Path.GetDirectoryName(SettingsFilePath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }

            if (!Directory.Exists(settings.DataDir))
            {
                Directory.CreateDirectory(settings.DataDir);
            }

            string json = JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(SettingsFilePath, json);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
