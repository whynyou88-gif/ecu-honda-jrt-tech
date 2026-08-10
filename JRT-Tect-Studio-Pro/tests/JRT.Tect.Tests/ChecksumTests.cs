using JRT.Tect.Core.Checksum;
using Xunit;

namespace JRT.Tect.Tests
{
    public class ChecksumTests
    {
        [Fact]
        public void CalculateHondaChecksum8Bit_ShouldReturnCorrectValue()
        {
            // Arrange: Fast Init Packet [0xFE, 0x04, 0x72]
            byte[] packet = new byte[] { 0xFE, 0x04, 0x72 };

            // Act
            byte checksum = ChecksumEngine.CalculateHondaChecksum8Bit(packet, packet.Length);

            // Assert: Checksum for [0xFE, 0x04, 0x72] is 0x8C
            Assert.Equal(0x8C, checksum);
        }

        [Fact]
        public void ValidateHondaPacketChecksum_ValidPacket_ShouldReturnTrue()
        {
            // Arrange: Full Packet with Checksum [0xFE, 0x04, 0x72, 0x8C]
            byte[] fullPacket = new byte[] { 0xFE, 0x04, 0x72, 0x8C };

            // Act
            bool isValid = ChecksumEngine.ValidateHondaPacketChecksum(fullPacket);

            // Assert
            Assert.True(isValid);
        }
    }
}
