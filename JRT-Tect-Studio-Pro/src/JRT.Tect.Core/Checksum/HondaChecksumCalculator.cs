namespace JRT.Tect.Core.Checksum;

public interface IChecksumCalculator
{
    byte CalculateCRC8Honda(ReadOnlySpan<byte> data);
    byte CalculateChecksum8Bit(ReadOnlySpan<byte> data);
    ushort CalculateCRC16CCITT(ReadOnlySpan<byte> data);
}

public class HondaChecksumCalculator : IChecksumCalculator
{
    public byte CalculateCRC8Honda(ReadOnlySpan<byte> data)
    {
        byte crc = 0x00;
        foreach (byte b in data)
        {
            crc ^= b;
            for (int i = 0; i < 8; i++)
            {
                if ((crc & 0x80) != 0)
                {
                    crc = (byte)((crc << 1) ^ 0x07);
                }
                else
                {
                    crc <<= 1;
                }
            }
        }
        return crc;
    }

    public byte CalculateChecksum8Bit(ReadOnlySpan<byte> data)
    {
        byte sum = 0;
        foreach (byte b in data)
        {
            sum += b;
        }
        return (byte)(0x100 - sum);
    }

    public ushort CalculateCRC16CCITT(ReadOnlySpan<byte> data)
    {
        ushort crc = 0xFFFF;
        foreach (byte b in data)
        {
            crc ^= (ushort)(b << 8);
            for (int i = 0; i < 8; i++)
            {
                if ((crc & 0x8000) != 0)
                {
                    crc = (ushort)((crc << 1) ^ 0x1021);
                }
                else
                {
                    crc <<= 1;
                }
            }
        }
        return crc;
    }
}
