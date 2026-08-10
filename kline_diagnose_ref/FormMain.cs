using KLine_Diagnose_Motorcycle;
using System;

using System.Collections.Generic;
using System.Drawing;
using System.IO.Ports;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using static System.Windows.Forms.VisualStyles.VisualStyleElement;

namespace KLine_Diagnose_Motorcycle
{
    public partial class FormMain : Form
    {
        private Scantool scantool;
        private bool isConnected = false;
        private readonly int bytesToRead;
        private System.Windows.Forms.AGauge speedometerGauge;
        private bool startDrawing = false;
        private static bool endThread = false;//false
        public static IntPtr ftHandle = IntPtr.Zero;
        private Thread workerThread;

        public FormMain()
        {
            InitializeComponent();
        }

        private void FormMain_Load(object sender, EventArgs e)
        {
            // Populate COM ports
            string[] ports = SerialPort.GetPortNames();
            comboComPort.Items.AddRange(ports);
            if (comboComPort.Items.Count > 0)
                comboComPort.SelectedItem = "COM4";

            // Initialize data grid
            InitializeDataGrid();

            // Set default baud rate
            radioBaud10400.Checked = true;

            // Clear ECM info fields
            txtECMCode.Text = "";
            txtECMPart.Text = "";
            timerScan.Interval = 100;
            timerScan.GetLifetimeService();
        }

       
        private void UpdateGauges()
        {
            GaugeRPM.Value = scantool.OBD_RPM / 1000;
            GaugeTPS.Value = scantool.OBD_TPS2_PCT;
            aGaugeIGT.Value = scantool.OBD_IGT_DEG;
        }
        private void InitializeDataGrid()
        {
            // Add parameters to the data grid (removed ECU Code and ECU Part as they are now in separate textboxes)
            dataGridViewParams.Rows.Add("1", "Putaran Mesin (RPM)", "", "RPM", "Idle: 1300-1500, Max: ~12000");
            dataGridViewParams.Rows.Add("2", "Tegangan TPS", "", "mVolt", "0.5 - 4.5 Volt");
            dataGridViewParams.Rows.Add("3", "Bukaan TPS (%)", "", "%", "0 - 100");
            dataGridViewParams.Rows.Add("4", "Tegangan Sensor (ECT)", "", "mVolt", "0.5 - 4.5 Volt");
            dataGridViewParams.Rows.Add("5", "Suhu Mesin (ECT)", "", "°C", "Normal: 80-100");
            dataGridViewParams.Rows.Add("6", "Tegangan Sensor IAT", "", "mVolt", "0.5 - 4.5 Volt");
            dataGridViewParams.Rows.Add("7", "Suhu Sensor IAT", "", "°C", "Ambient: 20-40");
            dataGridViewParams.Rows.Add("8", "Tegangan MAP", "", "mVolt", "0 - 5 Volt");
            dataGridViewParams.Rows.Add("9", "Tekanan MAP", "", "kPa", "Idle: 30-40, WOT: ~100");
            dataGridViewParams.Rows.Add("10", "Tegangan Battery", "", "Volt", "12 - 14.5 Volt");
            dataGridViewParams.Rows.Add("11", "Durasi Injektor", "", "ms", "1000 - 4000 ms");
            dataGridViewParams.Rows.Add("12", "Derajat Pengapian (Adv. Igt)", "", "Deg (°)", "10 - 38 Deg");
            dataGridViewParams.Rows.Add("13", "Kecepatan Kendaraan", "", "km/h", "0 - 200+");
            DataGridViewCellStyle headerStyle = new DataGridViewCellStyle();
            headerStyle.BackColor = Color.Black;
            headerStyle.ForeColor = Color.White;
        }

       
        private async void btnConnect_Click(object sender, EventArgs e)
        {
            // Toggle status penggambaran
            startDrawing = !startDrawing;
            // Ubah teks tombol berdasarkan status penggambaran
            BtnConnect.Text = startDrawing ? "Disconnect" : "Connect";
            BtnConnect.BackColor = startDrawing ? Color.Firebrick : SystemColors.HotTrack;
            pictureBox3.Visible = !startDrawing;
            if (bytesToRead > 0)
            {
                byte[] responseBuffer = new byte[bytesToRead];
                int bytesRead = scantool.SerialPort.Read(responseBuffer, 0, bytesToRead);
                AddLog($"Received {bytesRead} bytes: {BitConverter.ToString(responseBuffer)}");

                // Process the response to extract ECU info
                ProcessECUResponse(responseBuffer);

                // Also try the specific Honda parser
                ParseHondaResponse(responseBuffer);
            }
            if (!isConnected)
            {
                // Get selected COM port and baud rate
                string portName = comboComPort.SelectedItem?.ToString();
                if (string.IsNullOrEmpty(portName))
                {
                    MessageBox.Show("Please select a COM port.", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                int baudRate = radioBaud9600.Checked ? 9600 : 10400;

                // Define sequences from Scantool class
                byte[] WAKEUP = { 0xFE, 0x04, 0x72, 0x8C };
                byte[] ECM_PART = { 0x72, 0x05, 0x71, 0x00, 0x18 };

                AddLog($"Connecting to {portName} at {baudRate} baud...");

                try
                {
                    // Create and configure serial port
                    scantool = new Scantool(portName, baudRate);

                    // Configure serial port properties
                    scantool.SerialPort.Handshake = Handshake.None;
                    scantool.SerialPort.ReadTimeout = 500; // Increased timeout for initialization
                    scantool.SerialPort.WriteTimeout = 500;

                    // Open the serial port
                    scantool.SerialPort.Open();
                    AddLog("Serial port opened successfully");

                    // K-line wake-up sequence
                    AddLog("Starting K-line wake-up sequence...");
                    scantool.SerialPort.BreakState = false;
                    await Task.Delay(100);
                    scantool.SerialPort.BreakState = true;
                    await Task.Delay(70);
                    scantool.SerialPort.BreakState = false;
                    await Task.Delay(150); // Combined the two delays
                    scantool.SerialPort.Write(WAKEUP, 0, WAKEUP.Length);
                    AddLog($"Wake-up sequence sent: {BitConverter.ToString(WAKEUP)} \r\n");
                    await Task.Delay(100); // Increased delay for ECU response

                    // Clear buffers
                    scantool.SerialPort.DiscardInBuffer();
                    scantool.SerialPort.DiscardOutBuffer();
                    await Task.Delay(50);

                    // Send ECM_PART command to read ECU information
                    AddLog("Requesting ECU information...");
                    scantool.SerialPort.Write(ECM_PART, 0, ECM_PART.Length);
                    AddLog($"ECM_PART command sent: {BitConverter.ToString(ECM_PART)} \r\n");

                    // Wait for response
                    await Task.Delay(200); // Give more time for response

                    // Read response manually to ensure we get the data
                    int bytesToRead = scantool.SerialPort.BytesToRead;
                    if (bytesToRead > 0)
                    {
                        byte[] responseBuffer = new byte[bytesToRead];
                        int bytesRead = scantool.SerialPort.Read(responseBuffer, 0, bytesToRead);
                        AddLog($"Received {bytesRead} bytes: {BitConverter.ToString(responseBuffer)}");

                        // Process the response to extract ECU info
                        ProcessECUResponse(responseBuffer);
                    }
                    else
                    {
                        AddLog("No response received from ECU");
                        throw new Exception("No response from ECU after ECM_PART command");
                    }

                    isConnected = true;
                    BtnConnect.Text = "Disconnect";
                    comboComPort.Enabled = false;
                    radioBaud9600.Enabled = false;
                    radioBaud10400.Enabled = false;
                    numericUpdateInterval.Enabled = false;
                    TxtRPM.ForeColor = Color.Lime;
                    statusStrip1.Items[0].Text = "Status: ECU sudah Terhubung";

                    AddLog("ECU connection established successfully");

                    // Set timer interval and start
                    timerScan.Interval = (int)numericUpdateInterval.Value;
                    timerScan.Tick += timerScan_Tick;
                    timerScan.GetLifetimeService();
                    timerScan.Start();

                    AddLog($"Update interval set to {timerScan.Interval} ms");
                }
                catch (Exception ex)
                {
                    AddLog($"Connection error: {ex.Message} \r\n");
                    MessageBox.Show($"Failed to connect to ECU: {ex.Message}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);

                    if (scantool != null && scantool.IsConnected)
                    {
                        scantool.Disconnect();
                    }
                    scantool = null;
                    isConnected = false;
                }
                finally
                {
                    if (!isConnected)
                    {
                        BtnConnect.Text = "Connect";
                        comboComPort.Enabled = true;
                        radioBaud9600.Enabled = true;
                        radioBaud10400.Enabled = true;
                        numericUpdateInterval.Enabled = true;
                        TxtRPM.ForeColor = Color.Lime;
                        statusStrip1.Items[0].Text = "Status: Hubungan dengan ECU - TERPUTUS";
                        // Clear ECM info fields
                        txtECMCode.Text = "";
                        txtECMPart.Text = "";
                    }
                }
            }
            else
            {
                // Disconnect
                timerScan.Stop();
                scantool.Disconnect();
                scantool = null;
                isConnected = false;
                BtnConnect.Text = "Connect";
                comboComPort.Enabled = true;
                radioBaud9600.Enabled = true;
                radioBaud10400.Enabled = true;
                numericUpdateInterval.Enabled = true;
                statusStrip1.Items[0].Text = "Status: Hubungan dengan ECU - TERPUTUS";
                AddLog("Disconnected.");

                // Clear ECM info fields
                txtECMCode.Text = "";
                txtECMPart.Text = "";

                // Clear data grid values
                for (int i = 0; i < dataGridViewParams.Rows.Count; i++)
                {
                    dataGridViewParams.Rows[i].Cells[2].Value = "";
                }
            }
        }
        private void ProcessECUResponse(byte[] response)
        {
            try
            {
                AddLog($"Raw response: {BitConverter.ToString(response)} \r\n");
                AddLog($"Response length: {response.Length} bytes");
                if (response.Length >= 14) 
                {

                    if (response.Length >= 5 && response[0] == 0x72 && response[1] == 0x05 && response[2] == 0x71)
                    {
                        string hexString = "";
                        int buffStart = 9;
                        int buffEnd = Math.Min(13, response.Length - 1);
                        for (int i = buffStart; i <= buffEnd; i++)
                        {
                            hexString += response[i].ToString("X2");
                        }
                        string ecuCode = hexString;
                        string ecuPart = DetermineECUPart(ecuCode);
                        txtECMCode.Text = ecuCode;
                        txtECMPart.Text = ecuPart;
                        AddLog($"ECU Code extracted: {ecuCode} \r\n");
                        AddLog($"ECU Part determined: {ecuPart} \r\n");
                        string asciiResponse = ConvertToASCII(response);
                        AddLog($"ASCII representation: {asciiResponse} \r\n");
                    }
                    else
                    {
                        AddLog("Response doesn't match expected protocol format");
                        txtECMCode.Text = "Invalid Format";
                        txtECMPart.Text = "Check Protocol";
                    }
                }
                else
                {
                    AddLog($"Response too short: {response.Length} bytes");
                    txtECMCode.Text = "Short Response";
                    txtECMPart.Text = "Resend Command";
                }
            }
            catch (Exception ex)
            {
                AddLog($"Error processing ECU response: {ex.Message}\r\n");
                txtECMCode.Text = "Error";
                txtECMPart.Text = "Error";
            }
        }

        private string DetermineECUPart(string ecuCode)
        {
            var ecuMappings = new Dictionary<string, string>
            {
                     { "", "" }, // Pemetaan ID ke indeks ComboBox
                           
            };

            if (string.IsNullOrEmpty(ecuCode))
            {
                return "No ECU code detected";
            }
            else if (ecuMappings.TryGetValue(ecuCode, out string mappedPart))
            {
                return mappedPart;
            }
            else
            {
                return $"Unknown ECU code: {ecuCode}";
            }
        }
        private string ConvertToASCII(byte[] bytes)
        {
            StringBuilder asciiBuilder = new StringBuilder();

            foreach (byte b in bytes)
            {
                if (b >= 32 && b <= 126)
                {
                    asciiBuilder.Append((char)b);
                }
                else
                {
                    asciiBuilder.Append("."); // Use dot for non-printable characters
                }
            }

            return asciiBuilder.ToString();
        }

        // Method to parse Honda OBD response more accurately
        private void ParseHondaResponse(byte[] response)
        {
            try
            {
                AddLog($"Parsing Honda OBD response: {BitConverter.ToString(response)} \r\n");
                if (response.Length >= 6 && response[0] == 0x72 && response[2] == 0x71)
                {
                    int dataLength = response[1];
                    int expectedLength = 3 + dataLength + 1; // Header + data + checksum

                    if (response.Length >= expectedLength)
                    {
                        byte mode = response[3];
                        byte pid = response[4];

                        AddLog($"Mode: 0x{mode:X2}, PID: 0x{pid:X2} \r\n");
                        byte[] data = new byte[dataLength - 2]; // Subtract mode and PID
                        Array.Copy(response, 5, data, 0, data.Length);

                        AddLog($"Data: {BitConverter.ToString(data)} \r\n");

                        // Process based on mode and PID
                        if (mode == 0x00 && pid == 0x18) // ECM_PART request
                        {
                            ParseECMPartData(data);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                AddLog($"Error in ParseHondaResponse: {ex.Message} \r\n");
            }
        }

        private void ParseECMPartData(byte[] data)
        {
            try
            {
                AddLog($"ECM Part Data: {BitConverter.ToString(data)}\r\n");

                if (data.Length >= 5)
                {
                    // ECM code is typically in the first few bytes of data
                    string hexString = "";
                    for (int i = 0; i < Math.Min(5, data.Length); i++)
                    {
                        hexString += data[i].ToString("X2");
                    }

                    string ecuCode = hexString;
                    string ecuPart = "Unknown";

                    // Map known ECU codes to part numbers
                    var ecuMappings = new Dictionary<string, string>
            {
                { "0103470F01", "30400-K97G-N31" },
              
            };

                    if (ecuMappings.ContainsKey(ecuCode))
                    {
                        ecuPart = ecuMappings[ecuCode];
                    }
                    else
                    {
                        // Try partial matches
                        foreach (var mapping in ecuMappings)
                        {
                            if (ecuCode.StartsWith(mapping.Key) || mapping.Key.StartsWith(ecuCode))
                            {
                                ecuPart = mapping.Value;
                                break;
                            }
                        }
                    }

                    txtECMCode.Text = ecuCode;
                    txtECMPart.Text = ecuPart;

                    AddLog($"Parsed ECU Code: {ecuCode}\r\n");
                    AddLog($"Parsed ECU Part: {ecuPart}\r\n");
                }
            }
            catch (Exception ex)
            {
                AddLog($"Error in ParseECMPartData: {ex.Message} \r\n");
            }
        }

        private void timerScan_Tick(object sender, EventArgs e)
        {
            if (isConnected && scantool != null && scantool.IsConnected)
            {
                try
                {
                    scantool.ScanTool();
                    UpdateGauges();
                    // Update data grid with new values
                    dataGridViewParams.Rows[0].Cells[2].Value = scantool.OBD_RPM;
                    dataGridViewParams.Rows[1].Cells[2].Value = scantool.OBD_TPS1_MV.ToString("F1");
                    dataGridViewParams.Rows[2].Cells[2].Value = scantool.OBD_TPS2_PCT.ToString("F1");
                    dataGridViewParams.Rows[3].Cells[2].Value = scantool.OBD_ECT1_MV.ToString("F1");
                    dataGridViewParams.Rows[4].Cells[2].Value = scantool.OBD_ECT2_C;
                    dataGridViewParams.Rows[5].Cells[2].Value = scantool.OBD_IAT1_MV.ToString("F1");
                    dataGridViewParams.Rows[6].Cells[2].Value = scantool.OBD_IAT2_C;
                    dataGridViewParams.Rows[7].Cells[2].Value = scantool.OBD_MAP1_MV.ToString("F1");
                    dataGridViewParams.Rows[8].Cells[2].Value = scantool.OBD_MAP2_KPA;
                    dataGridViewParams.Rows[9].Cells[2].Value = scantool.OBD_BAT_V.ToString("F1");
                    dataGridViewParams.Rows[10].Cells[2].Value = scantool.OBD_INJ_MS.ToString("F2");
                    dataGridViewParams.Rows[11].Cells[2].Value = scantool.OBD_IGT_DEG.ToString("F1");
                    dataGridViewParams.Rows[12].Cells[2].Value = scantool.OBD_SPEED_KMH;

                    //Update RPM textbox
                    TxtRPM.Text = scantool.OBD_RPM.ToString();
                    textBoxIGT.Text = scantool.OBD_IGT_DEG.ToString("F1");
                    textBoxTPS.Text = scantool.OBD_TPS2_PCT.ToString("F1");
                    textBoxRPM.Text = scantool.OBD_RPM.ToString("F1");

                    // Update Gauge max value based on RPM
                    GaugeRPM.Value = scantool.OBD_RPM / 1000;
                    GaugeTPS.Value = scantool.OBD_TPS2_PCT;
                    aGaugeIGT.Value = scantool.OBD_IGT_DEG;

                }
                catch (Exception ex)
                {
                    AddLog($"Scan error: {ex.Message} \r\n");
                }
            }
        }

        private void AddLog(string message)
        {
            if (txtLog.Text.Length > 10000) // Prevent log from growing too large
            {
                txtLog.Text = txtLog.Text.Substring(5000);
            }

            txtLog.AppendText($"{DateTime.Now:HH:mm:ss} - {message}\r\n");
            txtLog.ScrollToCaret();
        }

        private void FormMain_FormClosing(object sender, FormClosingEventArgs e)
        {
            if (isConnected && scantool != null)
            {
                scantool.Disconnect();
            }
        }

        private void numericUpdateInterval_ValueChanged(object sender, EventArgs e)
        {
            // Set default interval to 100ms
            const int DefaultInterval = 100;

            // Ensure the value is within reasonable bounds
            int newInterval = Math.Max(1, (int)numericUpdateInterval.Value);
            try
            {
                if (isConnected)
                {
                    // Stop timer before updating
                    timerScan.Stop();
                    timerScan.Interval = newInterval > 0 ? newInterval : DefaultInterval;
                    timerScan.Start();
                    AddLog($"Update interval changed to {timerScan.Interval} ms\r\n");
                }
                else
                {
                    // Update interval for next connection
                    timerScan.Interval = newInterval > 0 ? newInterval : DefaultInterval;
                }
            }
            catch (Exception ex)
            {
                AddLog($"Error updating interval: {ex.Message}\r\n");
            }
        }

        private void button1_Click(object sender, EventArgs e)
        {
            if (comboComPort.Items.Count > 0)
                comboComPort.SelectedIndex = 0;
        }

        private void button2_Click(object sender, EventArgs e)
        {
            txtLog.Text = ""; // Clear log
        }

        private void MainForm_FormClosing(object sender, FormClosingEventArgs e)
        {
            if (e.CloseReason == CloseReason.UserClosing)
            {
                DialogResult result = MessageBox.Show(
                    "Apakah Anda yakin ingin keluar dari aplikasi?",
                    "Konfirmasi Keluar",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question,
                    MessageBoxDefaultButton.Button2);

                if (result == DialogResult.No)
                {
                    e.Cancel = true;
                    return;
                }
            }
        }


      

        private void BtnClose_Click(object sender, EventArgs e)
        {
            // Konfirmasi keluar aplikasi
            DialogResult result = MessageBox.Show(
                "Apakah Anda yakin ingin keluar dari aplikasi?",
                "MFI - Konfirmasi Keluar",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question,
                MessageBoxDefaultButton.Button2); // Default ke "No" untuk mencegah accidental click

            if (result == DialogResult.Yes)
            {
                CloseFtdiHandle();// Tutup semua form dan keluar dari aplikasi dengan bersih
                Application.Exit();
            }

            // Jika "Tidak" dipilih, tidak melakukan apa-apa (tetap di form saat ini)
        }



        private void CleanupResources()
        {
            this.Close();
            if (isConnected && scantool != null)
            {
                scantool.Disconnect();
            }
        }

        private void button4_Click(object sender, EventArgs e)
        {
            this.Hide();
            if (isConnected && scantool != null)
            {
                scantool.Disconnect();
            }
            new FormMain().ShowDialog();
        }

        private void button3_Click(object sender, EventArgs e)
        {

        }

       
        private void CloseFtdiHandle()
        {
            if (FormMain.ftHandle != IntPtr.Zero)
            {
                FTDI.FT_Close(FormMain.ftHandle);
                FormMain.ftHandle = IntPtr.Zero;
            }
        }
    }
}