namespace JRT.Tect.Core.Models
{
    public class DTCItem
    {
        public string Code { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public bool IsMILOn { get; set; }
        public string Status { get; set; } = string.Empty; // "Active", "Pending", "Stored"
        public string Severity { get; set; } = string.Empty; // "Low", "Medium", "High", "Critical"
    }

    public class ECUInfo
    {
        public string Manufacturer { get; set; } = string.Empty; // "Keihin", "Shindengen"
        public string PartNumber { get; set; } = string.Empty;
        public string FirmwareVersion { get; set; } = string.Empty;
        public string HardwareVersion { get; set; } = string.Empty;
        public string Protocol { get; set; } = string.Empty;
        public int FlashSizeBytes { get; set; }
        public int EEPROMSizeBytes { get; set; }
        public string VIN { get; set; } = string.Empty;
    }

}
