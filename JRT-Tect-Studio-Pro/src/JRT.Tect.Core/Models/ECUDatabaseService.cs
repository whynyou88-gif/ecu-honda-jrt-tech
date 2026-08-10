using System;
using System.Collections.Generic;

namespace JRT.Tect.Core.Models
{
    public class ECUMappingItem
    {
        public string ECUIdPattern { get; set; } = string.Empty;
        public string PartNumber { get; set; } = string.Empty;
        public string VehicleName { get; set; } = string.Empty;
        public string DisplacementCC { get; set; } = string.Empty;
        public string EngineCode { get; set; } = string.Empty;
        public string ECUFamily { get; set; } = string.Empty;
        public string Protocol { get; set; } = string.Empty;
    }

    public static class ECUDatabaseService
    {
        public static List<ECUMappingItem> GetHondaECUDefinitions()
        {
            return new List<ECUMappingItem>
            {
                new ECUMappingItem { ECUIdPattern = "KZRA", PartNumber = "38770-KZRA-601", VehicleName = "Vario 125 Old (2013-2015)", DisplacementCC = "124.8 cc", EngineCode = "KF12E", ECUFamily = "Keihin", Protocol = "Honda PGM-FI KWP2000" },
                new ECUMappingItem { ECUIdPattern = "K59J", PartNumber = "38770-K59J-A01", VehicleName = "Vario 150 New Keyless (2018-2021)", DisplacementCC = "149.3 cc", EngineCode = "KF21E", ECUFamily = "Keihin", Protocol = "Honda PGM-FI KWP2000" },
                new ECUMappingItem { ECUIdPattern = "K25",  PartNumber = "38770-K25-901",  VehicleName = "Beat FI / Street (2014-2019)", DisplacementCC = "108.2 cc", EngineCode = "JM21E", ECUFamily = "Keihin", Protocol = "Honda PGM-FI KWP2000" },
                new ECUMappingItem { ECUIdPattern = "K15",  PartNumber = "38770-K15-901",  VehicleName = "CB150R Streetfire (2013-2018)", DisplacementCC = "149.1 cc", EngineCode = "KC15E", ECUFamily = "Keihin", Protocol = "Honda PGM-FI KWP2000" },
                new ECUMappingItem { ECUIdPattern = "K16",  PartNumber = "38770-K16-901",  VehicleName = "Scoopy FI eSP (2015-2020)", DisplacementCC = "108.2 cc", EngineCode = "JM31E", ECUFamily = "Keihin", Protocol = "Honda PGM-FI KWP2000" },
                new ECUMappingItem { ECUIdPattern = "K97",  PartNumber = "38770-K97-N01",  VehicleName = "PCX 150 Local (2018-2021)", DisplacementCC = "149.3 cc", EngineCode = "KF31E", ECUFamily = "Shindengen", Protocol = "Honda PGM-FI KWP2000" },
                new ECUMappingItem { ECUIdPattern = "K60A", PartNumber = "38770-K60A-901", VehicleName = "Vario 160 CBS ISS (2022-2024)", DisplacementCC = "156.9 cc", EngineCode = "KF47E", ECUFamily = "Keihin", Protocol = "Honda PGM-FI KWP2000" },
                new ECUMappingItem { ECUIdPattern = "K45",  PartNumber = "38770-K45-N01",  VehicleName = "CBR 150R LED (2016-2023)", DisplacementCC = "149.1 cc", EngineCode = "KC45E", ECUFamily = "Keihin", Protocol = "Honda PGM-FI KWP2000" }
            };
        }
    }
}
