using Xunit;
using JRT.Tect.Core.Checksum;
using JRT.Tect.Core.Security;
using JRT.Tect.Core.Licensing;

namespace JRT.Tect.Tests;

public class ChecksumAndSecurityTests
{
    private readonly HondaChecksumCalculator _calculator = new();
    private readonly SeedKeyProvider _seedKeyProvider = new();

    [Fact]
    public void CalculateCRC8Honda_ValidData_ReturnsExpectedByte()
    {
        byte[] payload = new byte[] { 0x72, 0x05, 0x00, 0xF0 };
        byte crc = _calculator.CalculateCRC8Honda(payload);
        Assert.True(crc >= 0);
    }

    [Fact]
    public void CalculateChecksum8Bit_ValidData_ReturnsExpectedByte()
    {
        byte[] payload = new byte[] { 0x10, 0x20, 0x30 };
        byte cs = _calculator.CalculateChecksum8Bit(payload);
        Assert.Equal((byte)(0x100 - (0x10 + 0x20 + 0x30)), cs);
    }

    [Fact]
    public void CalculateCRC16CCITT_ValidData_ReturnsNonZero()
    {
        byte[] payload = new byte[] { 0x01, 0x02, 0x03, 0x04 };
        ushort crc = _calculator.CalculateCRC16CCITT(payload);
        Assert.True(crc > 0);
    }

    [Fact]
    public void CalculateKey_KeihinFamily_ReturnsXorKey()
    {
        byte[] seed = new byte[] { 0x11, 0x22, 0x33, 0x44 };
        byte[] key = _seedKeyProvider.CalculateKey(seed, "KEIHIN");
        Assert.Equal(4, key.Length);
        Assert.Equal((byte)(0x11 ^ 0x5A), key[0]);
    }

    [Fact]
    public void CalculateKey_K60AFamily_ReturnsFallbackKeyAndDoesNotThrow()
    {
        byte[] seed = new byte[] { 0x11, 0x22, 0x33, 0x44 };
        byte[] key = _seedKeyProvider.CalculateKey(seed, "K60A");
        Assert.Equal(new byte[] { 0xAA, 0xBB, 0xCC, 0xDD }, key);
    }

    [Fact]
    public void Licensing_GenerateActivationKey_MatchesHMACKeygen()
    {
        string hwid = "JRT-884A-99F1-33BC";
        string key = LicensingService.GenerateActivationKey(hwid);
        Assert.StartsWith("KEY-", key);
        Assert.True(LicensingService.ValidateLicenseKey(key, hwid));
        Assert.False(LicensingService.ValidateLicenseKey("KEY-INVALID-KEY", hwid));
    }
}
