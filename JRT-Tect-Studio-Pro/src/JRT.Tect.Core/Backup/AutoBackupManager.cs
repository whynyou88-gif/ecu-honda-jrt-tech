using System;
using System.IO;
using System.Threading.Tasks;

namespace JRT.Tect.Core.Backup
{
    public class AutoBackupManager
    {
        private readonly string _backupFolder;

        public AutoBackupManager(string rootPath = null)
        {
            _backupFolder = rootPath ?? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), 
                "JRT-Tect", 
                "AutoBackups"
            );

            if (!Directory.Exists(_backupFolder))
            {
                Directory.CreateDirectory(_backupFolder);
            }
        }

        /// <summary>
        /// Membuat backup otomatis sebelum menulis ke Flash / EEPROM
        /// </summary>
        public async Task<string> CreateBackupAsync(string targetName, string partNumber, byte[] data)
        {
            if (data == null || data.Length == 0)
                throw new InvalidOperationException("Tidak dapat membuat backup dari data kosong.");

            string timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
            string safePartNo = string.IsNullOrWhiteSpace(partNumber) ? "UNKNOWN" : partNumber.Replace(" ", "_");
            string fileName = $"BACKUP_{targetName}_{safePartNo}_{timestamp}.bin";
            string fullPath = Path.Combine(_backupFolder, fileName);

            await File.WriteAllBytesAsync(fullPath, data);
            return fullPath;
        }

        public string GetBackupDirectory() => _backupFolder;
    }
}
