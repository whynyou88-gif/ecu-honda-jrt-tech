using System;
using System.IO.Ports;
using System.Threading;

namespace KLine_Diagnose_Motorcycle
{
    public class Scantool
    {
        private SerialPort serialPort;
        private byte[] WAKEUP = { 0xFE, 0x04, 0x72, 0x8C };
        private byte[] ECM_PART = { 0x72, 0x05, 0x71, 0x00, 0x18 };
        private byte[] TABLE = { 0x72, 0x05, 0x71, 0x17, 0x01 };
        private byte[] buff = new byte[29];
        private int buffCount = 0;
        private string ecuCode = "";
        private string ecuPart = "";
        public SerialPort SerialPort { get => serialPort; }

        public int OBD_RPM { get; private set; }
        public float OBD_TPS1_MV { get; private set; }
        public float OBD_TPS2_PCT { get; private set; }
        public float OBD_ECT1_MV { get; private set; }
        public int OBD_ECT2_C { get; private set; }
        public float OBD_IAT1_MV { get; private set; }
        public int OBD_IAT2_C { get; private set; }
        public float OBD_MAP1_MV { get; private set; }
        public int OBD_MAP2_KPA { get; private set; }
        public float OBD_BAT_V { get; private set; }
        public float OBD_INJ_MS { get; private set; }
        public float OBD_IGT_DEG { get; private set; }
        public int OBD_SPEED_KMH { get; private set; }
        public int OBD_CHECKSUM { get; private set; }
        public byte OBD_IAC { get; private set; }
        public string ECUCode { get => ecuCode; }
        public string ECUPart { get => ecuPart; }
        public float OBD_AFR { get; private set; }
        public float OBD_O2V { get; private set; }
        public bool IsConnected { get => serialPort != null && serialPort.IsOpen; }

        public Scantool(string portName, int baudRate)
        {
            serialPort = new SerialPort(portName, baudRate, Parity.None, 8, StopBits.One);
        }

        public Scantool()
        {
        }

        public bool Connect()
        {
            try
            {
                if (!serialPort.IsOpen)
                {
                    serialPort.Open();
                    // Send wakeup sequence
                    serialPort.Write(WAKEUP, 0, WAKEUP.Length);
                    Thread.Sleep(100);
                    ReadEcmPart();
                    return true;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Kesalahan Koneksi: {ex.Message}");
            }
            return false;
        }

        public void Disconnect()
        {
            if (serialPort != null && serialPort.IsOpen)
            {
                serialPort.Close();
            }
        }

        private void ReadEcmPart()
        {
            try
            {
                serialPort.DiscardInBuffer();
                serialPort.DiscardOutBuffer();
                Thread.Sleep(100);
                serialPort.Write(ECM_PART, 0, ECM_PART.Length);
                Thread.Sleep(100);
                buffCount = 0;
                while (serialPort.BytesToRead > 0 && buffCount < 21)
                {
                    buff[buffCount++] = (byte)serialPort.ReadByte();
                }
                string hexString = "";
                int buffStart = 9;
                int buffEnd = 13;
                for (int i = buffStart; i <= buffEnd && i < buff.Length; i++)
                {
                    hexString += buff[i].ToString("X2");
                }
                ecuCode = hexString;
                ecuPart = ecuCode == "" ? "" : "ECU Tidak Diketahui";
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ECM read error: {ex.Message}");
                ecuCode = "Error";
                ecuPart = "Error";
            }
        }

        public void ScanTool()
        {
            try
            {
                serialPort.DiscardInBuffer();
                serialPort.DiscardOutBuffer();
                serialPort.Write(TABLE, 0, TABLE.Length);
                Thread.Sleep(100);
                buffCount = 0;
                while (serialPort.BytesToRead > 0 && buffCount < 29)
                {
                    buff[buffCount++] = (byte)serialPort.ReadByte();
                }
                OBD_RPM = (buff[9] << 8) + buff[10];
                OBD_TPS1_MV = buff[11] * 5f / 256f;
                OBD_TPS2_PCT = buff[12] / 2f; 
                OBD_ECT1_MV = buff[13] * 5f / 256f;
                OBD_ECT2_C = (-40 + buff[14]);
                if (buff[15] == 255)
                {
                    OBD_IAT1_MV = 0;
                    OBD_IAT2_C = -40;
                }
                else
                {
                    OBD_IAT1_MV = buff[15] * 19.6f;
                    OBD_IAT2_C = (-40 + buff[16]);
                }
                if (buff[17] == 255)
                {
                    OBD_MAP1_MV = 0;
                    OBD_MAP2_KPA = 0;
                }
                else
                {
                    OBD_MAP1_MV = buff[17] * 19.6f;
                    OBD_MAP2_KPA = buff[18];
                }
                OBD_BAT_V = buff[19] / 10.0f;
                OBD_INJ_MS = ((buff[20] << 8) + buff[21]) / 200f;
                OBD_IGT_DEG = buff[22] / 2f - 64f;
                OBD_SPEED_KMH = buff[24];
                OBD_CHECKSUM = buff[28];
                OBD_IAC = buff[23];
                OBD_AFR = (float)((-5.351 * OBD_O2V) + 17.7f);
                OBD_O2V = (buff[26] & 0xFF) / 50.9937f;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Scan error: {ex.Message}");
            }
        }
    }
}