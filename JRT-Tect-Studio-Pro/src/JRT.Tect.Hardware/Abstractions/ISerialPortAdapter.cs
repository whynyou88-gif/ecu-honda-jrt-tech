namespace JRT.Tect.Hardware.Abstractions
{
    public interface ISerialPortAdapter : IDisposable
    {
        bool IsOpen { get; }
        string PortName { get; }
        int BaudRate { get; set; }

        bool Open(string portName, int baudRate = 10400);
        void Close();
        
        int Write(byte[] buffer, int offset, int count);
        int Read(byte[] buffer, int offset, int count, int timeoutMs = 1000);
        void Flush();
        
        // K-Line Specific Hardware Pulse (Fast Init / 5-Baud Init Break)
        bool SendBreak(int durationMs);
        string[] GetAvailablePorts();
    }
}
