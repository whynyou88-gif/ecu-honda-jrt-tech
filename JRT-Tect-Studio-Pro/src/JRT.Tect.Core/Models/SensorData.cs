namespace JRT.Tect.Core.Models
{
    public class SensorData
    {
        public int RPM { get; set; }
        public double TPSPercent { get; set; }
        public double MAPkPa { get; set; }
        public double IATTempC { get; set; }
        public double ECTTempC { get; set; }
        public double BatteryVoltage { get; set; }
        public double InjectorPulseWidthMs { get; set; }
        public double IgnitionTimingDegree { get; set; }
        public double SpeedKph { get; set; }
        public double EngineLoadPercent { get; set; }
        public double O2SensorVoltageMv { get; set; }
        public double FuelTrimPercent { get; set; }
        public bool IsClosedLoop { get; set; }
        public bool IsIdleSwitchOn { get; set; }
    }
}
