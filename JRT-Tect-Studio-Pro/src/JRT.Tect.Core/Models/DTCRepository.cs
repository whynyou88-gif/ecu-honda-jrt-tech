using System;
using System.Collections.Generic;

namespace JRT.Tect.Core.Models
{
    public static class DTCRepository
    {
        public static List<DTCItem> GetStandardHondaDTCs()
        {
            return new List<DTCItem>
            {
                new DTCItem { Code = "DTC 7-1",  Description = "Engine Coolant Temperature (ECT) Sensor Low Voltage", Status = "Active", Severity = "High" },
                new DTCItem { Code = "DTC 7-2",  Description = "Engine Coolant Temperature (ECT) Sensor High Voltage", Status = "Active", Severity = "High" },
                new DTCItem { Code = "DTC 8-1",  Description = "Throttle Position (TP) Sensor Low Voltage Fault", Status = "History", Severity = "Medium" },
                new DTCItem { Code = "DTC 8-2",  Description = "Throttle Position (TP) Sensor High Voltage Fault", Status = "History", Severity = "Medium" },
                new DTCItem { Code = "DTC 9-1",  Description = "Intake Air Temperature (IAT) Sensor Circuit Low Voltage", Status = "History", Severity = "Low" },
                new DTCItem { Code = "DTC 11-1", Description = "Vehicle Speed Sensor (VSS) Signal Malfunction", Status = "History", Severity = "Low" },
                new DTCItem { Code = "DTC 12-1", Description = "Fuel Injector Circuit Open or Short Circuit", Status = "Active", Severity = "Critical" },
                new DTCItem { Code = "DTC 21-1", Description = "Oxygen (O2) Sensor Signal Circuit Malfunction", Status = "History", Severity = "Medium" },
                new DTCItem { Code = "DTC 29-1", Description = "Intake Air Control Valve (IACV) Circuit Malfunction", Status = "History", Severity = "Medium" },
                new DTCItem { Code = "DTC 33-2", Description = "ECM Internal EEPROM / Checksum Hardware Fault", Status = "Active", Severity = "Critical" },
                new DTCItem { Code = "DTC 54-1", Description = "Bank Angle Sensor (BAS) Voltage Out of Range", Status = "History", Severity = "High" }
            };
        }
    }
}
