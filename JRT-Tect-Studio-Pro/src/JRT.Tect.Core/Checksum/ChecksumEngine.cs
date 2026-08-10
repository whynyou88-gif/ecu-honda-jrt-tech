using System;

namespace JRT.Tect.Core.Checksum
{
    public static class ChecksumEngine
    {
        /// <summary>
        /// Menghitung Checksum 8-bit standar Honda (Sum XOR 0xFF + 1)
        /// </summary>
        public static byte CalculateHondaChecksum8Bit(byte[] data, int length)
        {
            if (data == null || length <= 0 || length > data.Length)
                return 0;

            int sum = 0;
            for (int i = 0; i < length; i++)
            {
                sum += data[i];
            }

            return (byte)(((sum & 0xFF) ^ 0xFF) + 1);
        }

        /// <summary>
        /// Validasi Checksum pada paket response K-Line Honda
        /// </summary>
        public static bool ValidateHondaPacketChecksum(byte[] packet)
        {
            if (packet == null || packet.Length < 3) return false;
            
            byte expectedChecksum = packet[packet.Length - 1];
            byte calculatedChecksum = CalculateHondaChecksum8Bit(packet, packet.Length - 1);
            
            return expectedChecksum == calculatedChecksum;
        }

        /// <summary>
        /// Standard CRC16 Calculation for flash blocks
        /// </summary>
        public static ushort CalculateCRC16(byte[] data, int offset, int length)
        {
            ushort crc = 0xFFFF;
            for (int i = offset; i < offset + length; i++)
            {
                crc ^= (ushort)(data[i] << 8);
                for (int j = 0; j < 8; j++)
                {
                    if ((crc & 0x8000) != 0)
                        crc = (ushort)((crc << 1) ^ 0x1021);
                    else
                        crc <<= 1;
                }
            }
            return crc;
        }
    }
}
