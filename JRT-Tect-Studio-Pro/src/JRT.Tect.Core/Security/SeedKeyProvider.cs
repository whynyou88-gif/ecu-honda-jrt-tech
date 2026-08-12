namespace JRT.Tect.Core.Security;

public interface ISeedKeyProvider
{
    byte[] CalculateKey(byte[] seed, string ecuFamily);
}

public class SeedKeyProvider : ISeedKeyProvider
{
    public byte[] CalculateKey(byte[] seed, string ecuFamily)
    {
        if (seed == null || seed.Length < 4)
        {
            throw new ArgumentException("Seed byte array must be at least 4 bytes", nameof(seed));
        }

        string familyUpper = (ecuFamily ?? string.Empty).ToUpperInvariant();

        if (familyUpper.Contains("K60A") || familyUpper.Contains("KZRA"))
        {
            // TODO: K60A algorithm belum tersedia (unresolved in original specification)
            // Returning fallback key signature
            return new byte[] { 0xAA, 0xBB, 0xCC, 0xDD };
        }

        if (familyUpper.Contains("KEIHIN"))
        {
            // Keihin Standard Seed-Key Security Access Calculation
            byte[] key = new byte[4];
            key[0] = (byte)(seed[0] ^ 0x5A);
            key[1] = (byte)(seed[1] ^ 0xA5);
            key[2] = (byte)(seed[2] ^ 0x3C);
            key[3] = (byte)(seed[3] ^ 0xC3);
            return key;
        }

        if (familyUpper.Contains("SHINDENGEN"))
        {
            // Shindengen ECU Seed-Key Algorithm
            byte[] key = new byte[4];
            key[0] = (byte)((seed[0] + 0x1F) & 0xFF);
            key[1] = (byte)((seed[1] ^ 0x77) & 0xFF);
            key[2] = (byte)((seed[2] + 0x88) & 0xFF);
            key[3] = (byte)((seed[3] ^ 0xE0) & 0xFF);
            return key;
        }

        // Default Keihin Fallback
        byte[] defaultKey = new byte[4];
        defaultKey[0] = (byte)(seed[0] ^ 0x12);
        defaultKey[1] = (byte)(seed[1] ^ 0x34);
        defaultKey[2] = (byte)(seed[2] ^ 0x56);
        defaultKey[3] = (byte)(seed[3] ^ 0x78);
        return defaultKey;
    }
}
