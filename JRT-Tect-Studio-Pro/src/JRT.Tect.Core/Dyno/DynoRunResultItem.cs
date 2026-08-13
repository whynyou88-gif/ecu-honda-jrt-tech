namespace JRT.Tect.Core.Dyno;

public class DynoRunResultItem
{
    public double Time { get; set; }           // Seconds
    public double Speed { get; set; }          // km/h (filtered)
    public double SpeedMs { get; set; }         // m/s
    public int Rpm { get; set; }                // Calculated RPM
    public double Acc { get; set; }             // Acceleration m/s2
    public double AccMean { get; set; }         // 3-point moving average acc
    public double AccFiltered { get; set; }     // Kalman filtered acc
    public double Force { get; set; }           // Newton
    public double PowerKw { get; set; }         // Raw Power in kW
    public double PowerKwFiltered { get; set; } // Kalman filtered Power in kW

    public double PowerHp => PowerKwFiltered * 1.34102; // Convert kW to HP
    public double TorqueNm => Rpm > 0 ? (PowerKwFiltered * 9549.3 / Rpm) : 0;
}
