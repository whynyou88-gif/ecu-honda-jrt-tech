using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using JRT.Tect.Core.Models;

namespace JRT.Tect.Protocols.Abstractions
{
    public interface IECUProtocol
    {
        string ProtocolName { get; }
        string TargetBrand { get; }
        
        Task<bool> InitializeSessionAsync(CancellationToken ct = default);
        Task<ECUInfo> ReadECUInfoAsync(CancellationToken ct = default);
        
        // Diagnostics
        Task<List<DTCItem>> ReadDTCAsync(CancellationToken ct = default);
        Task<bool> ClearDTCAsync(CancellationToken ct = default);
        Task<SensorData> ReadLiveDataAsync(CancellationToken ct = default);
        
        // Memory Operations (Flash & EEPROM)
        Task<byte[]> ReadFlashAsync(int memorySizeBytes, IProgress<double> progress = null, CancellationToken ct = default);
        Task<bool> WriteFlashAsync(byte[] data, IProgress<double> progress = null, CancellationToken ct = default);
        
        Task<byte[]> ReadEEPROMAsync(IProgress<double> progress = null, CancellationToken ct = default);
        Task<bool> WriteEEPROMAsync(byte[] data, IProgress<double> progress = null, CancellationToken ct = default);
        
        // Special Functions
        Task<bool> ResetFlashCounterAsync(CancellationToken ct = default);
        Task<string> ReadKeyIDAsync(CancellationToken ct = default);
        Task<bool> RegisterKeyIDAsync(string keyId, CancellationToken ct = default);
        Task<bool> RecoveryModeAsync(byte[] recoveryImage, IProgress<double> progress = null, CancellationToken ct = default);
    }
}
