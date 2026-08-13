namespace JRT.Tect.Core.Dyno;

public class VehicleProfile
{
    public int Weight { get; set; } = 1000;         // kg (vehicle + rider)
    public float RpmRatio { get; set; } = 20.0f;     // calibration speed(km/h) -> rpm
    public float AirTemp { get; set; } = 20.0f;      // Celcius
    public float AirPress { get; set; } = 1013.0f;   // hPa
}
