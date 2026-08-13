using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace JRT.Tect.Core.Licensing
{
    public class LicensingService
    {
        private const string MasterSecret = "JRT-TECH-PRO-MASTER-SECRET-2026-NATIVE-REMAP-STUDIO";

        /// <summary>
        /// Generates unique hardware ID for customer machine
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

        /// <summary>
        /// Generates official Activation Key matching jrt-keygen.py specification
        /// </summary>
        public static string GenerateActivationKey(string hwid)
        {
            if (string.IsNullOrWhiteSpace(hwid)) return string.Empty;
            string cleanHwid = hwid.Trim().ToUpperInvariant();
            byte[] keyBytes = Encoding.UTF8.GetBytes(MasterSecret);
            using (HMACSHA256 hmac = new HMACSHA256(keyBytes))
            {
                byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(cleanHwid));
                string hexStr = Convert.ToHexString(hash).ToUpperInvariant();
                return $"KEY-{hexStr.Substring(0, 4)}-{hexStr.Substring(4, 4)}-{hexStr.Substring(8, 4)}-{hexStr.Substring(12, 4)}";
            }
        }

        /// <summary>
        /// Verifies whether provided activation key matches machine HWID
        /// </summary>
        public static bool ValidateLicenseKey(string licenseKey, string hwid)
        {
            if (string.IsNullOrWhiteSpace(licenseKey) || string.IsNullOrWhiteSpace(hwid)) return false;
            string expectedKey = GenerateActivationKey(hwid);
            return string.Equals(licenseKey.Trim(), expectedKey, StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Persists activation key locally
        /// </summary>
        public static void SaveLicenseKey(string key)
        {
            try
            {
                string path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "license.dat");
                File.WriteAllText(path, key.Trim());
            }
            catch { }
        }

        /// <summary>
        /// Reads persisted activation key
        /// </summary>
        public static string LoadSavedLicenseKey()
        {
            try
            {
                string path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "license.dat");
                if (File.Exists(path)) return File.ReadAllText(path).Trim();
            }
            catch { }
            return string.Empty;
        }
    }
}
