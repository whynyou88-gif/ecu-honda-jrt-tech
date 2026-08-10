using System;
using System.Security.Cryptography;
using System.Text;

namespace JRT.Tect.Core.Licensing
{
    public class LicensingService
    {
        /// <summary>
        /// Menghasilkan Hardware ID unik berbasis hash mesin pengguna
        /// </summary>
        public static string GenerateHardwareID()
        {
            string machineName = Environment.MachineName;
            string osVersion = Environment.OSVersion.VersionString;
            string processorCount = Environment.ProcessorCount.ToString();
            
            string rawHwid = $"{machineName}-{osVersion}-{processorCount}-JRTTECT";

            using (SHA256 sha256 = SHA256.Create())
            {
                byte[] bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(rawHwid));
                StringBuilder builder = new StringBuilder();
                for (int i = 0; i < 8; i++)
                {
                    builder.Append(bytes[i].ToString("X2"));
                    if (i % 2 == 1 && i < 7) builder.Append("-");
                }
                return $"JRT-{builder}";
            }
        }

        public static bool ValidateLicenseKey(string licenseKey, string hwid)
        {
            if (string.IsNullOrWhiteSpace(licenseKey)) return false;
            return licenseKey.Equals($"LIC-{hwid}-KEY", StringComparison.OrdinalIgnoreCase);
        }
    }
}
