using System.IO.Ports;

namespace JRT.Tect.Hardware;

public interface IKLineAdapter : IDisposable
{
    bool IsOpen { get; }
    string PortName { get; set; }
    int BaudRate { get; set; }
    Task<bool> OpenAsync(CancellationToken ct = default);
    Task CloseAsync();
    Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken ct = default);
    Task<int> ReadAsync(byte[] buffer, int offset, int count, int timeoutMs = 1000, CancellationToken ct = default);
    Task<byte[]> SendReceiveAsync(byte[] command, int expectedResponseLen, int timeoutMs = 1000, CancellationToken ct = default);
}

public class SerialKLineAdapter : IKLineAdapter
{
    private SerialPort? _serialPort;

    public bool IsOpen => _serialPort?.IsOpen ?? false;
    public string PortName { get; set; } = "COM1";
    public int BaudRate { get; set; } = 10400;

    public async Task<bool> OpenAsync(CancellationToken ct = default)
    {
        return await Task.Run(() =>
        {
            try
            {
                if (_serialPort != null && _serialPort.IsOpen)
                {
                    _serialPort.Close();
                }

                _serialPort = new SerialPort(PortName, BaudRate, Parity.None, 8, StopBits.One)
                {
                    ReadTimeout = 500,
                    WriteTimeout = 500
                };
                _serialPort.Open();
                return true;
            }
            catch
            {
                return false;
            }
        }, ct);
    }

    public async Task CloseAsync()
    {
        await Task.Run(() =>
        {
            if (_serialPort != null && _serialPort.IsOpen)
            {
                _serialPort.Close();
                _serialPort.Dispose();
                _serialPort = null;
            }
        });
    }

    public async Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken ct = default)
    {
        if (_serialPort == null || !_serialPort.IsOpen) return;
        await _serialPort.BaseStream.WriteAsync(buffer.AsMemory(offset, count), ct);
        await _serialPort.BaseStream.FlushAsync(ct);
    }

    public async Task<int> ReadAsync(byte[] buffer, int offset, int count, int timeoutMs = 1000, CancellationToken ct = default)
    {
        if (_serialPort == null || !_serialPort.IsOpen) return 0;
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(timeoutMs);
        try
        {
            return await _serialPort.BaseStream.ReadAsync(buffer.AsMemory(offset, count), cts.Token);
        }
        catch (OperationCanceledException)
        {
            return 0;
        }
    }

    public async Task<byte[]> SendReceiveAsync(byte[] command, int expectedResponseLen, int timeoutMs = 1000, CancellationToken ct = default)
    {
        await WriteAsync(command, 0, command.Length, ct);
        byte[] response = new byte[expectedResponseLen];
        int readBytes = await ReadAsync(response, 0, expectedResponseLen, timeoutMs, ct);

        if (readBytes < expectedResponseLen)
        {
            Array.Resize(ref response, readBytes);
        }
        return response;
    }

    public void Dispose()
    {
        if (_serialPort != null)
        {
            if (_serialPort.IsOpen) _serialPort.Close();
            _serialPort.Dispose();
            _serialPort = null;
        }
        GC.SuppressFinalize(this);
    }
}
