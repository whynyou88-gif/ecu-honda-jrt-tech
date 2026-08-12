namespace JRT.Tect.Core.Models;

public class TelemetryData
{
    public int Rpm { get; set; }
    public double TpsVoltage { get; set; }
    public double TpsPercent { get; set; }
    public double EctVoltage { get; set; }
    public double EctTempC { get; set; }
    public double IatVoltage { get; set; }
    public double IatTempC { get; set; }
    public double MapVoltage { get; set; }
    public double MapPressureKpa { get; set; }
    public double BatteryVoltage { get; set; }
    public double InjectorDurationMs { get; set; }
    public double IgnitionAdvanceDeg { get; set; }
    public double VehicleSpeedKmh { get; set; }
    public double AirFuelRatio { get; set; } = 14.7;
    public DateTime Timestamp { get; set; } = DateTime.Now;
}

public class DtcRecord
{
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool MilStatus { get; set; }
    public string StatusText { get; set; } = "Stored";
}

public class EcuRecord
{
    public string PartNumber { get; set; } = string.Empty;
    public string ModelName { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string LicensePlate { get; set; } = string.Empty;
    public string HardwareBrand { get; set; } = string.Empty;
    public string FuelGrade { get; set; } = string.Empty;
    public string RemapNotes { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}

public class MapCell
{
    public int RowIndex { get; set; }
    public int ColumnIndex { get; set; }
    public double RowHeader { get; set; } // e.g. RPM
    public double ColumnHeader { get; set; } // e.g. TPS%
    public double Value { get; set; }
    public string Unit { get; set; } = "ms";
}

public class MapGridModel
{
    public string MapName { get; set; } = "Main Fuel Map";
    public string Category { get; set; } = "Fuel / Injection";
    public double[] RpmHeaders { get; set; } = Array.Empty<double>();
    public double[] TpsHeaders { get; set; } = Array.Empty<double>();
    public double[,] DataMatrix { get; set; } = new double[0, 0];
    public double MinValue { get; set; } = 1.0;
    public double MaxValue { get; set; } = 4.0;
}
