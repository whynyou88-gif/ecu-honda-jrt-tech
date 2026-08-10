namespace JRT.Tect.Core.Models
{
    public class DTCItem
    {
        public string Code { get; set; }
        public string Description { get; set; }
        public bool IsMILOn { get; set; }
        public string Status { get; set; } // "Active", "Pending", "Stored"
    }

    public class ECUInfo
    {
        public string Manufacturer { get; set; } // "Keihin", "Shindengen"
        public string PartNumber { get; set; }
        public string FirmwareVersion { get; set; }
        public string HardwareVersion { get; set; }
        public string Protocol { get; set; }
        public int FlashSizeBytes { get; set; }
        public int EEPROMSizeBytes { get; set; }
        public string VIN { get; set; }
    }
}
