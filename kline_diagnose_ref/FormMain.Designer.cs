namespace KLine_Diagnose_Motorcycle
{
    partial class FormMain
    {
        private System.ComponentModel.IContainer components = null;

        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        private void InitializeComponent()
        {
            this.components = new System.ComponentModel.Container();
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(FormMain));
            System.Windows.Forms.DataGridViewCellStyle dataGridViewCellStyle9 = new System.Windows.Forms.DataGridViewCellStyle();
            System.Windows.Forms.DataGridViewCellStyle dataGridViewCellStyle10 = new System.Windows.Forms.DataGridViewCellStyle();
            System.Windows.Forms.DataGridViewCellStyle dataGridViewCellStyle14 = new System.Windows.Forms.DataGridViewCellStyle();
            System.Windows.Forms.DataGridViewCellStyle dataGridViewCellStyle15 = new System.Windows.Forms.DataGridViewCellStyle();
            System.Windows.Forms.DataGridViewCellStyle dataGridViewCellStyle16 = new System.Windows.Forms.DataGridViewCellStyle();
            System.Windows.Forms.DataGridViewCellStyle dataGridViewCellStyle11 = new System.Windows.Forms.DataGridViewCellStyle();
            System.Windows.Forms.DataGridViewCellStyle dataGridViewCellStyle12 = new System.Windows.Forms.DataGridViewCellStyle();
            System.Windows.Forms.DataGridViewCellStyle dataGridViewCellStyle13 = new System.Windows.Forms.DataGridViewCellStyle();
            this.groupBox1 = new System.Windows.Forms.GroupBox();
            this.BtnRefreshPort = new System.Windows.Forms.Button();
            this.numericUpdateInterval = new System.Windows.Forms.NumericUpDown();
            this.label5 = new System.Windows.Forms.Label();
            this.radioBaud10400 = new System.Windows.Forms.RadioButton();
            this.radioBaud9600 = new System.Windows.Forms.RadioButton();
            this.label2 = new System.Windows.Forms.Label();
            this.comboComPort = new System.Windows.Forms.ComboBox();
            this.label1 = new System.Windows.Forms.Label();
            this.BtnConnect = new System.Windows.Forms.Button();
            this.groupBox2 = new System.Windows.Forms.GroupBox();
            this.pictureBox3 = new System.Windows.Forms.PictureBox();
            this.dataGridViewParams = new System.Windows.Forms.DataGridView();
            this.Column1 = new System.Windows.Forms.DataGridViewTextBoxColumn();
            this.Parameter = new System.Windows.Forms.DataGridViewTextBoxColumn();
            this.Value = new System.Windows.Forms.DataGridViewTextBoxColumn();
            this.Unit = new System.Windows.Forms.DataGridViewTextBoxColumn();
            this.Column4 = new System.Windows.Forms.DataGridViewTextBoxColumn();
            this.groupBox3 = new System.Windows.Forms.GroupBox();
            this.txtLog = new System.Windows.Forms.TextBox();
            this.timerScan = new System.Windows.Forms.Timer(this.components);
            this.groupBox4 = new System.Windows.Forms.GroupBox();
            this.txtECMPart = new System.Windows.Forms.TextBox();
            this.txtECMCode = new System.Windows.Forms.TextBox();
            this.label4 = new System.Windows.Forms.Label();
            this.label3 = new System.Windows.Forms.Label();
            this.panel1 = new System.Windows.Forms.Panel();
            this.label6 = new System.Windows.Forms.Label();
            this.BtnRemap = new System.Windows.Forms.Button();
            this.BtnDTC = new System.Windows.Forms.Button();
            this.BtnAnalisaIGT = new System.Windows.Forms.Button();
            this.BtnClose = new System.Windows.Forms.Button();
            this.panel2 = new System.Windows.Forms.Panel();
            this.button1 = new System.Windows.Forms.Button();
            this.label11 = new System.Windows.Forms.Label();
            this.pictureBox1 = new System.Windows.Forms.PictureBox();
            this.groupBox6 = new System.Windows.Forms.GroupBox();
            this.label7 = new System.Windows.Forms.Label();
            this.TxtRPM = new System.Windows.Forms.TextBox();
            this.groupBox5 = new System.Windows.Forms.GroupBox();
            this.button2 = new System.Windows.Forms.Button();
            this.button4 = new System.Windows.Forms.Button();
            this.panel3 = new System.Windows.Forms.Panel();
            this.textBoxRPM = new System.Windows.Forms.TextBox();
            this.textBoxTPS = new System.Windows.Forms.TextBox();
            this.textBoxIGT = new System.Windows.Forms.TextBox();
            this.label10 = new System.Windows.Forms.Label();
            this.label9 = new System.Windows.Forms.Label();
            this.label8 = new System.Windows.Forms.Label();
            this.GaugeTPS = new System.Windows.Forms.AGauge();
            this.GaugeRPM = new System.Windows.Forms.AGauge();
            this.pictureBox2 = new System.Windows.Forms.PictureBox();
            this.statusStrip1 = new System.Windows.Forms.StatusStrip();
            this.StatusLabel = new System.Windows.Forms.ToolStripStatusLabel();
            this.aGaugeIGT = new System.Windows.Forms.AGauge();
            this.groupBox1.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.numericUpdateInterval)).BeginInit();
            this.groupBox2.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox3)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.dataGridViewParams)).BeginInit();
            this.groupBox3.SuspendLayout();
            this.groupBox4.SuspendLayout();
            this.panel1.SuspendLayout();
            this.panel2.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox1)).BeginInit();
            this.groupBox6.SuspendLayout();
            this.groupBox5.SuspendLayout();
            this.panel3.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox2)).BeginInit();
            this.statusStrip1.SuspendLayout();
            this.SuspendLayout();
            // 
            // groupBox1
            // 
            this.groupBox1.Controls.Add(this.BtnRefreshPort);
            this.groupBox1.Controls.Add(this.numericUpdateInterval);
            this.groupBox1.Controls.Add(this.label5);
            this.groupBox1.Controls.Add(this.radioBaud10400);
            this.groupBox1.Controls.Add(this.radioBaud9600);
            this.groupBox1.Controls.Add(this.label2);
            this.groupBox1.Controls.Add(this.comboComPort);
            this.groupBox1.Controls.Add(this.label1);
            this.groupBox1.Controls.Add(this.BtnConnect);
            this.groupBox1.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.groupBox1.ForeColor = System.Drawing.Color.Red;
            this.groupBox1.Location = new System.Drawing.Point(18, 75);
            this.groupBox1.Name = "groupBox1";
            this.groupBox1.Size = new System.Drawing.Size(239, 225);
            this.groupBox1.TabIndex = 0;
            this.groupBox1.TabStop = false;
            this.groupBox1.Text = "1. Connection Settings";
            // 
            // BtnRefreshPort
            // 
            this.BtnRefreshPort.BackColor = System.Drawing.SystemColors.HotTrack;
            this.BtnRefreshPort.Cursor = System.Windows.Forms.Cursors.Hand;
            this.BtnRefreshPort.FlatStyle = System.Windows.Forms.FlatStyle.Popup;
            this.BtnRefreshPort.Font = new System.Drawing.Font("Segoe UI Semibold", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.BtnRefreshPort.ForeColor = System.Drawing.Color.White;
            this.BtnRefreshPort.Location = new System.Drawing.Point(63, 145);
            this.BtnRefreshPort.Name = "BtnRefreshPort";
            this.BtnRefreshPort.Size = new System.Drawing.Size(163, 35);
            this.BtnRefreshPort.TabIndex = 8;
            this.BtnRefreshPort.Text = "Refresh Ports";
            this.BtnRefreshPort.UseVisualStyleBackColor = false;
            this.BtnRefreshPort.Click += new System.EventHandler(this.button1_Click);
            // 
            // numericUpdateInterval
            // 
            this.numericUpdateInterval.Font = new System.Drawing.Font("Segoe UI Semibold", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.numericUpdateInterval.Increment = new decimal(new int[] {
            100,
            0,
            0,
            0});
            this.numericUpdateInterval.Location = new System.Drawing.Point(63, 108);
            this.numericUpdateInterval.Maximum = new decimal(new int[] {
            5000,
            0,
            0,
            0});
            this.numericUpdateInterval.Minimum = new decimal(new int[] {
            100,
            0,
            0,
            0});
            this.numericUpdateInterval.Name = "numericUpdateInterval";
            this.numericUpdateInterval.Size = new System.Drawing.Size(162, 22);
            this.numericUpdateInterval.TabIndex = 7;
            this.numericUpdateInterval.Value = new decimal(new int[] {
            500,
            0,
            0,
            0});
            this.numericUpdateInterval.ValueChanged += new System.EventHandler(this.numericUpdateInterval_ValueChanged);
            // 
            // label5
            // 
            this.label5.AutoSize = true;
            this.label5.Font = new System.Drawing.Font("Segoe UI Semibold", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label5.ForeColor = System.Drawing.Color.White;
            this.label5.Location = new System.Drawing.Point(6, 110);
            this.label5.Name = "label5";
            this.label5.Size = new System.Drawing.Size(51, 13);
            this.label5.TabIndex = 6;
            this.label5.Text = "Interval :";
            // 
            // radioBaud10400
            // 
            this.radioBaud10400.AutoSize = true;
            this.radioBaud10400.Font = new System.Drawing.Font("Microsoft Sans Serif", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.radioBaud10400.ForeColor = System.Drawing.Color.White;
            this.radioBaud10400.Location = new System.Drawing.Point(64, 85);
            this.radioBaud10400.Name = "radioBaud10400";
            this.radioBaud10400.Size = new System.Drawing.Size(55, 17);
            this.radioBaud10400.TabIndex = 5;
            this.radioBaud10400.TabStop = true;
            this.radioBaud10400.Text = "10400";
            this.radioBaud10400.UseVisualStyleBackColor = true;
            // 
            // radioBaud9600
            // 
            this.radioBaud9600.AutoSize = true;
            this.radioBaud9600.Checked = true;
            this.radioBaud9600.Font = new System.Drawing.Font("Microsoft Sans Serif", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.radioBaud9600.ForeColor = System.Drawing.Color.White;
            this.radioBaud9600.Location = new System.Drawing.Point(64, 62);
            this.radioBaud9600.Name = "radioBaud9600";
            this.radioBaud9600.Size = new System.Drawing.Size(49, 17);
            this.radioBaud9600.TabIndex = 4;
            this.radioBaud9600.TabStop = true;
            this.radioBaud9600.Text = "9600";
            this.radioBaud9600.UseVisualStyleBackColor = true;
            // 
            // label2
            // 
            this.label2.AutoSize = true;
            this.label2.Font = new System.Drawing.Font("Segoe UI Semibold", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label2.ForeColor = System.Drawing.Color.White;
            this.label2.Location = new System.Drawing.Point(19, 64);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(39, 13);
            this.label2.TabIndex = 3;
            this.label2.Text = "Baud :";
            // 
            // comboComPort
            // 
            this.comboComPort.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
            this.comboComPort.Font = new System.Drawing.Font("Segoe UI Semibold", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.comboComPort.FormattingEnabled = true;
            this.comboComPort.Location = new System.Drawing.Point(63, 27);
            this.comboComPort.Name = "comboComPort";
            this.comboComPort.Size = new System.Drawing.Size(162, 21);
            this.comboComPort.TabIndex = 2;
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Font = new System.Drawing.Font("Segoe UI Semibold", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label1.ForeColor = System.Drawing.Color.White;
            this.label1.Location = new System.Drawing.Point(20, 30);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(38, 13);
            this.label1.TabIndex = 1;
            this.label1.Text = "COM :";
            // 
            // BtnConnect
            // 
            this.BtnConnect.BackColor = System.Drawing.SystemColors.HotTrack;
            this.BtnConnect.Cursor = System.Windows.Forms.Cursors.Hand;
            this.BtnConnect.FlatStyle = System.Windows.Forms.FlatStyle.Popup;
            this.BtnConnect.Font = new System.Drawing.Font("Segoe UI Semibold", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.BtnConnect.ForeColor = System.Drawing.Color.White;
            this.BtnConnect.Location = new System.Drawing.Point(64, 183);
            this.BtnConnect.Name = "BtnConnect";
            this.BtnConnect.Size = new System.Drawing.Size(163, 35);
            this.BtnConnect.TabIndex = 0;
            this.BtnConnect.Text = "Connect";
            this.BtnConnect.UseVisualStyleBackColor = false;
            this.BtnConnect.Click += new System.EventHandler(this.btnConnect_Click);
            // 
            // groupBox2
            // 
            this.groupBox2.Controls.Add(this.pictureBox3);
            this.groupBox2.Controls.Add(this.dataGridViewParams);
            this.groupBox2.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.groupBox2.ForeColor = System.Drawing.Color.Red;
            this.groupBox2.Location = new System.Drawing.Point(270, 101);
            this.groupBox2.Name = "groupBox2";
            this.groupBox2.Size = new System.Drawing.Size(601, 383);
            this.groupBox2.TabIndex = 1;
            this.groupBox2.TabStop = false;
            this.groupBox2.Text = "4. ECM Parameters";
            // 
            // pictureBox3
            // 
            this.pictureBox3.Dock = System.Windows.Forms.DockStyle.Fill;
            this.pictureBox3.Image = ((System.Drawing.Image)(resources.GetObject("pictureBox3.Image")));
            this.pictureBox3.Location = new System.Drawing.Point(3, 18);
            this.pictureBox3.Name = "pictureBox3";
            this.pictureBox3.Size = new System.Drawing.Size(595, 362);
            this.pictureBox3.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pictureBox3.TabIndex = 1;
            this.pictureBox3.TabStop = false;
            // 
            // dataGridViewParams
            // 
            this.dataGridViewParams.AllowUserToAddRows = false;
            this.dataGridViewParams.AllowUserToDeleteRows = false;
            this.dataGridViewParams.AllowUserToResizeRows = false;
            dataGridViewCellStyle9.Alignment = System.Windows.Forms.DataGridViewContentAlignment.MiddleCenter;
            dataGridViewCellStyle9.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(224)))), ((int)(((byte)(224)))), ((int)(((byte)(224)))));
            this.dataGridViewParams.AlternatingRowsDefaultCellStyle = dataGridViewCellStyle9;
            this.dataGridViewParams.AutoSizeColumnsMode = System.Windows.Forms.DataGridViewAutoSizeColumnsMode.Fill;
            this.dataGridViewParams.BackgroundColor = System.Drawing.SystemColors.ControlLightLight;
            this.dataGridViewParams.BorderStyle = System.Windows.Forms.BorderStyle.Fixed3D;
            dataGridViewCellStyle10.Alignment = System.Windows.Forms.DataGridViewContentAlignment.MiddleCenter;
            dataGridViewCellStyle10.BackColor = System.Drawing.Color.Black;
            dataGridViewCellStyle10.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            dataGridViewCellStyle10.ForeColor = System.Drawing.Color.White;
            dataGridViewCellStyle10.SelectionBackColor = System.Drawing.SystemColors.Highlight;
            dataGridViewCellStyle10.SelectionForeColor = System.Drawing.SystemColors.HighlightText;
            dataGridViewCellStyle10.WrapMode = System.Windows.Forms.DataGridViewTriState.True;
            this.dataGridViewParams.ColumnHeadersDefaultCellStyle = dataGridViewCellStyle10;
            this.dataGridViewParams.ColumnHeadersHeightSizeMode = System.Windows.Forms.DataGridViewColumnHeadersHeightSizeMode.AutoSize;
            this.dataGridViewParams.Columns.AddRange(new System.Windows.Forms.DataGridViewColumn[] {
            this.Column1,
            this.Parameter,
            this.Value,
            this.Unit,
            this.Column4});
            dataGridViewCellStyle14.Alignment = System.Windows.Forms.DataGridViewContentAlignment.MiddleCenter;
            dataGridViewCellStyle14.BackColor = System.Drawing.SystemColors.Window;
            dataGridViewCellStyle14.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            dataGridViewCellStyle14.ForeColor = System.Drawing.Color.Red;
            dataGridViewCellStyle14.SelectionBackColor = System.Drawing.SystemColors.Highlight;
            dataGridViewCellStyle14.SelectionForeColor = System.Drawing.SystemColors.HighlightText;
            dataGridViewCellStyle14.WrapMode = System.Windows.Forms.DataGridViewTriState.False;
            this.dataGridViewParams.DefaultCellStyle = dataGridViewCellStyle14;
            this.dataGridViewParams.Location = new System.Drawing.Point(14, 21);
            this.dataGridViewParams.Name = "dataGridViewParams";
            this.dataGridViewParams.ReadOnly = true;
            dataGridViewCellStyle15.Alignment = System.Windows.Forms.DataGridViewContentAlignment.MiddleCenter;
            dataGridViewCellStyle15.BackColor = System.Drawing.Color.Black;
            dataGridViewCellStyle15.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            dataGridViewCellStyle15.ForeColor = System.Drawing.Color.White;
            dataGridViewCellStyle15.SelectionBackColor = System.Drawing.SystemColors.Highlight;
            dataGridViewCellStyle15.SelectionForeColor = System.Drawing.SystemColors.HighlightText;
            dataGridViewCellStyle15.WrapMode = System.Windows.Forms.DataGridViewTriState.True;
            this.dataGridViewParams.RowHeadersDefaultCellStyle = dataGridViewCellStyle15;
            this.dataGridViewParams.RowHeadersVisible = false;
            dataGridViewCellStyle16.Alignment = System.Windows.Forms.DataGridViewContentAlignment.MiddleCenter;
            dataGridViewCellStyle16.ForeColor = System.Drawing.Color.Black;
            this.dataGridViewParams.RowsDefaultCellStyle = dataGridViewCellStyle16;
            this.dataGridViewParams.RowTemplate.Height = 25;
            this.dataGridViewParams.SelectionMode = System.Windows.Forms.DataGridViewSelectionMode.FullRowSelect;
            this.dataGridViewParams.Size = new System.Drawing.Size(571, 348);
            this.dataGridViewParams.TabIndex = 0;
            // 
            // Column1
            // 
            this.Column1.FillWeight = 20F;
            this.Column1.HeaderText = "No.";
            this.Column1.Name = "Column1";
            this.Column1.ReadOnly = true;
            // 
            // Parameter
            // 
            dataGridViewCellStyle11.Alignment = System.Windows.Forms.DataGridViewContentAlignment.MiddleLeft;
            dataGridViewCellStyle11.BackColor = System.Drawing.Color.White;
            dataGridViewCellStyle11.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            dataGridViewCellStyle11.ForeColor = System.Drawing.Color.Black;
            this.Parameter.DefaultCellStyle = dataGridViewCellStyle11;
            this.Parameter.HeaderText = "Parameter";
            this.Parameter.Name = "Parameter";
            this.Parameter.ReadOnly = true;
            // 
            // Value
            // 
            dataGridViewCellStyle12.Alignment = System.Windows.Forms.DataGridViewContentAlignment.MiddleCenter;
            dataGridViewCellStyle12.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            dataGridViewCellStyle12.ForeColor = System.Drawing.Color.Black;
            this.Value.DefaultCellStyle = dataGridViewCellStyle12;
            this.Value.FillWeight = 30F;
            this.Value.HeaderText = "Value";
            this.Value.Name = "Value";
            this.Value.ReadOnly = true;
            // 
            // Unit
            // 
            dataGridViewCellStyle13.Alignment = System.Windows.Forms.DataGridViewContentAlignment.MiddleCenter;
            dataGridViewCellStyle13.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            dataGridViewCellStyle13.ForeColor = System.Drawing.Color.Black;
            this.Unit.DefaultCellStyle = dataGridViewCellStyle13;
            this.Unit.FillWeight = 30F;
            this.Unit.HeaderText = "Unit";
            this.Unit.Name = "Unit";
            this.Unit.ReadOnly = true;
            // 
            // Column4
            // 
            this.Column4.FillWeight = 70F;
            this.Column4.HeaderText = "Standart";
            this.Column4.Name = "Column4";
            this.Column4.ReadOnly = true;
            // 
            // groupBox3
            // 
            this.groupBox3.Controls.Add(this.txtLog);
            this.groupBox3.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.groupBox3.ForeColor = System.Drawing.Color.Red;
            this.groupBox3.Location = new System.Drawing.Point(270, 490);
            this.groupBox3.Name = "groupBox3";
            this.groupBox3.Size = new System.Drawing.Size(498, 100);
            this.groupBox3.TabIndex = 2;
            this.groupBox3.TabStop = false;
            this.groupBox3.Text = "6. Connection Log";
            // 
            // txtLog
            // 
            this.txtLog.Dock = System.Windows.Forms.DockStyle.Fill;
            this.txtLog.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.txtLog.Location = new System.Drawing.Point(3, 18);
            this.txtLog.Multiline = true;
            this.txtLog.Name = "txtLog";
            this.txtLog.ReadOnly = true;
            this.txtLog.ScrollBars = System.Windows.Forms.ScrollBars.Vertical;
            this.txtLog.Size = new System.Drawing.Size(492, 79);
            this.txtLog.TabIndex = 0;
            // 
            // timerScan
            // 
            this.timerScan.Tick += new System.EventHandler(this.timerScan_Tick);
            // 
            // groupBox4
            // 
            this.groupBox4.Controls.Add(this.txtECMPart);
            this.groupBox4.Controls.Add(this.txtECMCode);
            this.groupBox4.Controls.Add(this.label4);
            this.groupBox4.Controls.Add(this.label3);
            this.groupBox4.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.groupBox4.ForeColor = System.Drawing.Color.Red;
            this.groupBox4.Location = new System.Drawing.Point(270, 5);
            this.groupBox4.Name = "groupBox4";
            this.groupBox4.Size = new System.Drawing.Size(369, 88);
            this.groupBox4.TabIndex = 3;
            this.groupBox4.TabStop = false;
            this.groupBox4.Text = "3. ECM Information";
            // 
            // txtECMPart
            // 
            this.txtECMPart.Font = new System.Drawing.Font("Segoe UI Semibold", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.txtECMPart.ForeColor = System.Drawing.Color.Red;
            this.txtECMPart.Location = new System.Drawing.Point(99, 56);
            this.txtECMPart.Name = "txtECMPart";
            this.txtECMPart.ReadOnly = true;
            this.txtECMPart.Size = new System.Drawing.Size(257, 23);
            this.txtECMPart.TabIndex = 3;
            this.txtECMPart.Text = "N/A";
            // 
            // txtECMCode
            // 
            this.txtECMCode.Font = new System.Drawing.Font("Segoe UI Semibold", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.txtECMCode.ForeColor = System.Drawing.Color.Red;
            this.txtECMCode.Location = new System.Drawing.Point(99, 27);
            this.txtECMCode.Name = "txtECMCode";
            this.txtECMCode.ReadOnly = true;
            this.txtECMCode.Size = new System.Drawing.Size(257, 23);
            this.txtECMCode.TabIndex = 2;
            this.txtECMCode.Text = "N/A";
            // 
            // label4
            // 
            this.label4.AutoSize = true;
            this.label4.Font = new System.Drawing.Font("Segoe UI Semibold", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label4.ForeColor = System.Drawing.Color.White;
            this.label4.Location = new System.Drawing.Point(27, 59);
            this.label4.Name = "label4";
            this.label4.Size = new System.Drawing.Size(65, 13);
            this.label4.TabIndex = 1;
            this.label4.Text = "ECM Part   :";
            // 
            // label3
            // 
            this.label3.AutoSize = true;
            this.label3.Font = new System.Drawing.Font("Segoe UI Semibold", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label3.ForeColor = System.Drawing.Color.White;
            this.label3.Location = new System.Drawing.Point(27, 30);
            this.label3.Name = "label3";
            this.label3.Size = new System.Drawing.Size(66, 13);
            this.label3.TabIndex = 0;
            this.label3.Text = "ECM Code :";
            // 
            // panel1
            // 
            this.panel1.BackColor = System.Drawing.SystemColors.HotTrack;
            this.panel1.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.panel1.Controls.Add(this.label6);
            this.panel1.Location = new System.Drawing.Point(12, 21);
            this.panel1.Name = "panel1";
            this.panel1.Size = new System.Drawing.Size(1130, 44);
            this.panel1.TabIndex = 10;
            // 
            // label6
            // 
            this.label6.AutoSize = true;
            this.label6.Font = new System.Drawing.Font("Segoe UI Semibold", 18F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label6.ForeColor = System.Drawing.Color.White;
            this.label6.Location = new System.Drawing.Point(91, 5);
            this.label6.Name = "label6";
            this.label6.Size = new System.Drawing.Size(592, 32);
            this.label6.TabIndex = 0;
            this.label6.Text = "MFI - QuantumDiag Pro V.1 (Scan dan Diagnosa ECU)";
            // 
            // BtnRemap
            // 
            this.BtnRemap.BackColor = System.Drawing.SystemColors.HotTrack;
            this.BtnRemap.Cursor = System.Windows.Forms.Cursors.Hand;
            this.BtnRemap.FlatStyle = System.Windows.Forms.FlatStyle.Popup;
            this.BtnRemap.Font = new System.Drawing.Font("Segoe UI Semibold", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.BtnRemap.ForeColor = System.Drawing.Color.White;
            this.BtnRemap.Location = new System.Drawing.Point(18, 28);
            this.BtnRemap.Name = "BtnRemap";
            this.BtnRemap.Size = new System.Drawing.Size(203, 36);
            this.BtnRemap.TabIndex = 12;
            this.BtnRemap.Text = "Recovery ECU";
            this.BtnRemap.UseVisualStyleBackColor = false;

            // 
            // BtnDTC
            // 
            this.BtnDTC.BackColor = System.Drawing.SystemColors.HotTrack;
            this.BtnDTC.Cursor = System.Windows.Forms.Cursors.Hand;
            this.BtnDTC.FlatStyle = System.Windows.Forms.FlatStyle.Popup;
            this.BtnDTC.Font = new System.Drawing.Font("Segoe UI Semibold", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.BtnDTC.ForeColor = System.Drawing.Color.White;
            this.BtnDTC.Location = new System.Drawing.Point(18, 68);
            this.BtnDTC.Name = "BtnDTC";
            this.BtnDTC.Size = new System.Drawing.Size(203, 36);
            this.BtnDTC.TabIndex = 13;
            this.BtnDTC.Text = "DTC (Kode MIL)";
            this.BtnDTC.UseVisualStyleBackColor = false;

            // 
            // BtnAnalisaIGT
            // 
            this.BtnAnalisaIGT.BackColor = System.Drawing.SystemColors.HotTrack;
            this.BtnAnalisaIGT.Cursor = System.Windows.Forms.Cursors.Hand;
            this.BtnAnalisaIGT.FlatStyle = System.Windows.Forms.FlatStyle.Popup;
            this.BtnAnalisaIGT.Font = new System.Drawing.Font("Segoe UI Semibold", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.BtnAnalisaIGT.ForeColor = System.Drawing.Color.White;
            this.BtnAnalisaIGT.Location = new System.Drawing.Point(18, 108);
            this.BtnAnalisaIGT.Name = "BtnAnalisaIGT";
            this.BtnAnalisaIGT.Size = new System.Drawing.Size(203, 36);
            this.BtnAnalisaIGT.TabIndex = 14;
            this.BtnAnalisaIGT.Text = "Analisa Pengapian";
            this.BtnAnalisaIGT.UseVisualStyleBackColor = false;

            // 
            // BtnClose
            // 
            this.BtnClose.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(192)))), ((int)(((byte)(0)))), ((int)(((byte)(0)))));
            this.BtnClose.Cursor = System.Windows.Forms.Cursors.Hand;
            this.BtnClose.FlatStyle = System.Windows.Forms.FlatStyle.Popup;
            this.BtnClose.Font = new System.Drawing.Font("Segoe UI Semibold", 11.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.BtnClose.ForeColor = System.Drawing.Color.White;
            this.BtnClose.Location = new System.Drawing.Point(18, 549);
            this.BtnClose.Name = "BtnClose";
            this.BtnClose.Size = new System.Drawing.Size(239, 41);
            this.BtnClose.TabIndex = 15;
            this.BtnClose.Text = "Keluar Aplikasi";
            this.BtnClose.UseVisualStyleBackColor = false;
            this.BtnClose.Click += new System.EventHandler(this.BtnClose_Click);
            // 
            // panel2
            // 
            this.panel2.BorderStyle = System.Windows.Forms.BorderStyle.Fixed3D;
            this.panel2.Controls.Add(this.button1);
            this.panel2.Controls.Add(this.label11);
            this.panel2.Controls.Add(this.pictureBox1);
            this.panel2.Controls.Add(this.groupBox6);
            this.panel2.Controls.Add(this.BtnClose);
            this.panel2.Controls.Add(this.groupBox5);
            this.panel2.Controls.Add(this.groupBox4);
            this.panel2.Controls.Add(this.groupBox3);
            this.panel2.Controls.Add(this.groupBox1);
            this.panel2.Controls.Add(this.groupBox2);
            this.panel2.Controls.Add(this.panel3);
            this.panel2.Location = new System.Drawing.Point(12, 84);
            this.panel2.Name = "panel2";
            this.panel2.Size = new System.Drawing.Size(1130, 602);
            this.panel2.TabIndex = 16;
            // 
            // button1
            // 
            this.button1.BackColor = System.Drawing.SystemColors.HotTrack;
            this.button1.Cursor = System.Windows.Forms.Cursors.Hand;
            this.button1.FlatStyle = System.Windows.Forms.FlatStyle.Popup;
            this.button1.Font = new System.Drawing.Font("Segoe UI Semibold", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.button1.ForeColor = System.Drawing.Color.White;
            this.button1.Location = new System.Drawing.Point(774, 556);
            this.button1.Name = "button1";
            this.button1.Size = new System.Drawing.Size(104, 34);
            this.button1.TabIndex = 9;
            this.button1.Text = "Clear Log";
            this.button1.UseVisualStyleBackColor = false;
            this.button1.Click += new System.EventHandler(this.button2_Click);
            // 
            // label11
            // 
            this.label11.AutoSize = true;
            this.label11.Font = new System.Drawing.Font("Segoe UI", 15.75F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label11.ForeColor = System.Drawing.Color.White;
            this.label11.Location = new System.Drawing.Point(21, 22);
            this.label11.Name = "label11";
            this.label11.Size = new System.Drawing.Size(236, 30);
            this.label11.TabIndex = 4;
            this.label11.Text = "Diagnosa Data Sensors";
            // 
            // pictureBox1
            // 
            this.pictureBox1.BackColor = System.Drawing.Color.White;
            this.pictureBox1.BorderStyle = System.Windows.Forms.BorderStyle.Fixed3D;
            this.pictureBox1.Cursor = System.Windows.Forms.Cursors.Hand;
            this.pictureBox1.Image = ((System.Drawing.Image)(resources.GetObject("pictureBox1.Image")));
            this.pictureBox1.Location = new System.Drawing.Point(780, 12);
            this.pictureBox1.Name = "pictureBox1";
            this.pictureBox1.Size = new System.Drawing.Size(90, 90);
            this.pictureBox1.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pictureBox1.TabIndex = 18;
            this.pictureBox1.TabStop = false;
            // 
            // groupBox6
            // 
            this.groupBox6.Controls.Add(this.label7);
            this.groupBox6.Controls.Add(this.TxtRPM);
            this.groupBox6.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.groupBox6.ForeColor = System.Drawing.Color.Red;
            this.groupBox6.Location = new System.Drawing.Point(650, 5);
            this.groupBox6.Name = "groupBox6";
            this.groupBox6.Size = new System.Drawing.Size(118, 88);
            this.groupBox6.TabIndex = 16;
            this.groupBox6.TabStop = false;
            this.groupBox6.Text = "5. Highlight";
            // 
            // label7
            // 
            this.label7.AutoSize = true;
            this.label7.Font = new System.Drawing.Font("Segoe UI Semibold", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label7.ForeColor = System.Drawing.Color.White;
            this.label7.Location = new System.Drawing.Point(10, 21);
            this.label7.Name = "label7";
            this.label7.Size = new System.Drawing.Size(36, 13);
            this.label7.TabIndex = 9;
            this.label7.Text = "RPM :";
            // 
            // TxtRPM
            // 
            this.TxtRPM.Font = new System.Drawing.Font("Trebuchet MS", 20.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.TxtRPM.ForeColor = System.Drawing.Color.Red;
            this.TxtRPM.Location = new System.Drawing.Point(13, 37);
            this.TxtRPM.Multiline = true;
            this.TxtRPM.Name = "TxtRPM";
            this.TxtRPM.ReadOnly = true;
            this.TxtRPM.RightToLeft = System.Windows.Forms.RightToLeft.Yes;
            this.TxtRPM.Size = new System.Drawing.Size(94, 39);
            this.TxtRPM.TabIndex = 4;
            this.TxtRPM.Text = "-";
            // 
            // groupBox5
            // 
            this.groupBox5.Controls.Add(this.button2);
            this.groupBox5.Controls.Add(this.button4);
            this.groupBox5.Controls.Add(this.BtnAnalisaIGT);
            this.groupBox5.Controls.Add(this.BtnRemap);
            this.groupBox5.Controls.Add(this.BtnDTC);
            this.groupBox5.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.groupBox5.ForeColor = System.Drawing.Color.Red;
            this.groupBox5.Location = new System.Drawing.Point(18, 306);
            this.groupBox5.Name = "groupBox5";
            this.groupBox5.Size = new System.Drawing.Size(239, 234);
            this.groupBox5.TabIndex = 10;
            this.groupBox5.TabStop = false;
            this.groupBox5.Text = "2. Tools";
            // 
            // button2
            // 
            this.button2.BackColor = System.Drawing.SystemColors.HotTrack;
            this.button2.Cursor = System.Windows.Forms.Cursors.Hand;
            this.button2.FlatStyle = System.Windows.Forms.FlatStyle.Popup;
            this.button2.Font = new System.Drawing.Font("Segoe UI Semibold", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.button2.ForeColor = System.Drawing.Color.White;
            this.button2.Location = new System.Drawing.Point(18, 190);
            this.button2.Name = "button2";
            this.button2.Size = new System.Drawing.Size(203, 36);
            this.button2.TabIndex = 17;
            this.button2.Text = "Live Data Sensor";
            this.button2.UseVisualStyleBackColor = false;
            // 
            // button4
            // 
            this.button4.BackColor = System.Drawing.SystemColors.HotTrack;
            this.button4.Cursor = System.Windows.Forms.Cursors.Hand;
            this.button4.FlatStyle = System.Windows.Forms.FlatStyle.Popup;
            this.button4.Font = new System.Drawing.Font("Segoe UI Semibold", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.button4.ForeColor = System.Drawing.Color.White;
            this.button4.Location = new System.Drawing.Point(18, 148);
            this.button4.Name = "button4";
            this.button4.Size = new System.Drawing.Size(203, 36);
            this.button4.TabIndex = 16;
            this.button4.Text = "Setting Parameter ECU";
            this.button4.UseVisualStyleBackColor = false;
            this.button4.Click += new System.EventHandler(this.button4_Click);
            // 
            // panel3
            // 
            this.panel3.BorderStyle = System.Windows.Forms.BorderStyle.Fixed3D;
            this.panel3.Controls.Add(this.textBoxIGT);
            this.panel3.Controls.Add(this.label8);
            this.panel3.Controls.Add(this.aGaugeIGT);
            this.panel3.Controls.Add(this.textBoxRPM);
            this.panel3.Controls.Add(this.textBoxTPS);
            this.panel3.Controls.Add(this.label10);
            this.panel3.Controls.Add(this.label9);
            this.panel3.Controls.Add(this.GaugeTPS);
            this.panel3.Controls.Add(this.GaugeRPM);
            this.panel3.Location = new System.Drawing.Point(884, 12);
            this.panel3.Name = "panel3";
            this.panel3.Size = new System.Drawing.Size(229, 578);
            this.panel3.TabIndex = 24;
            // 
            // textBoxRPM
            // 
            this.textBoxRPM.BackColor = System.Drawing.SystemColors.MenuHighlight;
            this.textBoxRPM.Font = new System.Drawing.Font("Segoe UI Semibold", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.textBoxRPM.ForeColor = System.Drawing.Color.White;
            this.textBoxRPM.Location = new System.Drawing.Point(84, 527);
            this.textBoxRPM.Name = "textBoxRPM";
            this.textBoxRPM.Size = new System.Drawing.Size(45, 23);
            this.textBoxRPM.TabIndex = 34;
            this.textBoxRPM.Text = "0";
            this.textBoxRPM.TextAlign = System.Windows.Forms.HorizontalAlignment.Center;
            // 
            // textBoxTPS
            // 
            this.textBoxTPS.BackColor = System.Drawing.SystemColors.MenuHighlight;
            this.textBoxTPS.Font = new System.Drawing.Font("Segoe UI Semibold", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.textBoxTPS.ForeColor = System.Drawing.Color.White;
            this.textBoxTPS.Location = new System.Drawing.Point(83, 335);
            this.textBoxTPS.Name = "textBoxTPS";
            this.textBoxTPS.Size = new System.Drawing.Size(45, 23);
            this.textBoxTPS.TabIndex = 33;
            this.textBoxTPS.Text = "0";
            this.textBoxTPS.TextAlign = System.Windows.Forms.HorizontalAlignment.Center;
            // 
            // textBoxIGT
            // 
            this.textBoxIGT.BackColor = System.Drawing.SystemColors.MenuHighlight;
            this.textBoxIGT.Font = new System.Drawing.Font("Segoe UI Semibold", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.textBoxIGT.ForeColor = System.Drawing.Color.White;
            this.textBoxIGT.Location = new System.Drawing.Point(85, 147);
            this.textBoxIGT.Name = "textBoxIGT";
            this.textBoxIGT.Size = new System.Drawing.Size(45, 23);
            this.textBoxIGT.TabIndex = 32;
            this.textBoxIGT.Text = "0";
            this.textBoxIGT.TextAlign = System.Windows.Forms.HorizontalAlignment.Center;
            // 
            // label10
            // 
            this.label10.AutoSize = true;
            this.label10.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label10.ForeColor = System.Drawing.Color.White;
            this.label10.Location = new System.Drawing.Point(81, 361);
            this.label10.Name = "label10";
            this.label10.Size = new System.Drawing.Size(47, 13);
            this.label10.TabIndex = 27;
            this.label10.Text = "TPS (%)";
            // 
            // label9
            // 
            this.label9.AutoSize = true;
            this.label9.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label9.ForeColor = System.Drawing.Color.White;
            this.label9.Location = new System.Drawing.Point(69, 553);
            this.label9.Name = "label9";
            this.label9.Size = new System.Drawing.Size(76, 13);
            this.label9.TabIndex = 23;
            this.label9.Text = "RPM (x 1000)";
            // 
            // label8
            // 
            this.label8.AutoSize = true;
            this.label8.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label8.ForeColor = System.Drawing.Color.White;
            this.label8.Location = new System.Drawing.Point(74, 171);
            this.label8.Name = "label8";
            this.label8.Size = new System.Drawing.Size(80, 13);
            this.label8.TabIndex = 23;
            this.label8.Text = "Ignition (Deg)";
            // 
            // GaugeTPS
            // 
            this.GaugeTPS.BaseArcColor = System.Drawing.Color.Aqua;
            this.GaugeTPS.BaseArcRadius = 80;
            this.GaugeTPS.BaseArcStart = 135;
            this.GaugeTPS.BaseArcSweep = 270;
            this.GaugeTPS.BaseArcWidth = 2;
            this.GaugeTPS.Center = new System.Drawing.Point(100, 100);
            this.GaugeTPS.Font = new System.Drawing.Font("Segoe UI Semibold", 6.75F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.GaugeTPS.Location = new System.Drawing.Point(8, 197);
            this.GaugeTPS.MaxValue = 90F;
            this.GaugeTPS.MinValue = 0F;
            this.GaugeTPS.Name = "GaugeTPS";
            this.GaugeTPS.NeedleColor1 = System.Windows.Forms.AGaugeNeedleColor.Red;
            this.GaugeTPS.NeedleColor2 = System.Drawing.Color.Aqua;
            this.GaugeTPS.NeedleRadius = 80;
            this.GaugeTPS.NeedleType = System.Windows.Forms.NeedleType.Advance;
            this.GaugeTPS.NeedleWidth = 2;
            this.GaugeTPS.ScaleLinesInterColor = System.Drawing.Color.White;
            this.GaugeTPS.ScaleLinesInterInnerRadius = 73;
            this.GaugeTPS.ScaleLinesInterOuterRadius = 80;
            this.GaugeTPS.ScaleLinesInterWidth = 1;
            this.GaugeTPS.ScaleLinesMajorColor = System.Drawing.Color.Aqua;
            this.GaugeTPS.ScaleLinesMajorInnerRadius = 70;
            this.GaugeTPS.ScaleLinesMajorOuterRadius = 80;
            this.GaugeTPS.ScaleLinesMajorStepValue = 5F;
            this.GaugeTPS.ScaleLinesMajorWidth = 2;
            this.GaugeTPS.ScaleLinesMinorColor = System.Drawing.Color.Red;
            this.GaugeTPS.ScaleLinesMinorInnerRadius = 75;
            this.GaugeTPS.ScaleLinesMinorOuterRadius = 80;
            this.GaugeTPS.ScaleLinesMinorTicks = 9;
            this.GaugeTPS.ScaleLinesMinorWidth = 1;
            this.GaugeTPS.ScaleNumbersColor = System.Drawing.Color.Turquoise;
            this.GaugeTPS.ScaleNumbersFormat = null;
            this.GaugeTPS.ScaleNumbersRadius = 95;
            this.GaugeTPS.ScaleNumbersRotation = 0;
            this.GaugeTPS.ScaleNumbersStartScaleLine = 0;
            this.GaugeTPS.ScaleNumbersStepScaleLines = 1;
            this.GaugeTPS.Size = new System.Drawing.Size(209, 188);
            this.GaugeTPS.TabIndex = 28;
            this.GaugeTPS.Text = "aGauge1";
            this.GaugeTPS.Value = 0F;
            // 
            // GaugeRPM
            // 
            this.GaugeRPM.BaseArcColor = System.Drawing.Color.Red;
            this.GaugeRPM.BaseArcRadius = 80;
            this.GaugeRPM.BaseArcStart = 135;
            this.GaugeRPM.BaseArcSweep = 270;
            this.GaugeRPM.BaseArcWidth = 2;
            this.GaugeRPM.Center = new System.Drawing.Point(100, 100);
            this.GaugeRPM.Font = new System.Drawing.Font("Segoe UI Semibold", 6.75F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.GaugeRPM.Location = new System.Drawing.Point(8, 391);
            this.GaugeRPM.MaxValue = 13F;
            this.GaugeRPM.MinValue = 0F;
            this.GaugeRPM.Name = "GaugeRPM";
            this.GaugeRPM.NeedleColor1 = System.Windows.Forms.AGaugeNeedleColor.Red;
            this.GaugeRPM.NeedleColor2 = System.Drawing.Color.Aqua;
            this.GaugeRPM.NeedleRadius = 80;
            this.GaugeRPM.NeedleType = System.Windows.Forms.NeedleType.Advance;
            this.GaugeRPM.NeedleWidth = 2;
            this.GaugeRPM.ScaleLinesInterColor = System.Drawing.Color.White;
            this.GaugeRPM.ScaleLinesInterInnerRadius = 73;
            this.GaugeRPM.ScaleLinesInterOuterRadius = 80;
            this.GaugeRPM.ScaleLinesInterWidth = 1;
            this.GaugeRPM.ScaleLinesMajorColor = System.Drawing.Color.Aqua;
            this.GaugeRPM.ScaleLinesMajorInnerRadius = 70;
            this.GaugeRPM.ScaleLinesMajorOuterRadius = 80;
            this.GaugeRPM.ScaleLinesMajorStepValue = 1F;
            this.GaugeRPM.ScaleLinesMajorWidth = 2;
            this.GaugeRPM.ScaleLinesMinorColor = System.Drawing.Color.Red;
            this.GaugeRPM.ScaleLinesMinorInnerRadius = 75;
            this.GaugeRPM.ScaleLinesMinorOuterRadius = 80;
            this.GaugeRPM.ScaleLinesMinorTicks = 9;
            this.GaugeRPM.ScaleLinesMinorWidth = 1;
            this.GaugeRPM.ScaleNumbersColor = System.Drawing.Color.White;
            this.GaugeRPM.ScaleNumbersFormat = null;
            this.GaugeRPM.ScaleNumbersRadius = 95;
            this.GaugeRPM.ScaleNumbersRotation = 0;
            this.GaugeRPM.ScaleNumbersStartScaleLine = 0;
            this.GaugeRPM.ScaleNumbersStepScaleLines = 1;
            this.GaugeRPM.Size = new System.Drawing.Size(209, 178);
            this.GaugeRPM.TabIndex = 29;
            this.GaugeRPM.Text = "aGauge1";
            this.GaugeRPM.Value = 0F;
            // 
            // pictureBox2
            // 
            this.pictureBox2.BackColor = System.Drawing.Color.White;
            this.pictureBox2.BorderStyle = System.Windows.Forms.BorderStyle.Fixed3D;
            this.pictureBox2.Cursor = System.Windows.Forms.Cursors.Hand;
            this.pictureBox2.Image = ((System.Drawing.Image)(resources.GetObject("pictureBox2.Image")));
            this.pictureBox2.Location = new System.Drawing.Point(25, 13);
            this.pictureBox2.Name = "pictureBox2";
            this.pictureBox2.Size = new System.Drawing.Size(55, 58);
            this.pictureBox2.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pictureBox2.TabIndex = 17;
            this.pictureBox2.TabStop = false;
            // 
            // statusStrip1
            // 
            this.statusStrip1.BackColor = System.Drawing.Color.Black;
            this.statusStrip1.Items.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.StatusLabel});
            this.statusStrip1.Location = new System.Drawing.Point(0, 689);
            this.statusStrip1.Name = "statusStrip1";
            this.statusStrip1.RenderMode = System.Windows.Forms.ToolStripRenderMode.Professional;
            this.statusStrip1.Size = new System.Drawing.Size(1154, 22);
            this.statusStrip1.TabIndex = 18;
            this.statusStrip1.Text = "statusStrip1";
            // 
            // StatusLabel
            // 
            this.StatusLabel.Font = new System.Drawing.Font("Segoe UI Semibold", 9F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.StatusLabel.ForeColor = System.Drawing.Color.White;
            this.StatusLabel.Name = "StatusLabel";
            this.StatusLabel.Size = new System.Drawing.Size(385, 17);
            this.StatusLabel.Text = "Note :  Pilih Interval sesuai kondisi ECU (100), kemudian tekan \'Connect\'";
            // 
            // aGaugeIGT
            // 
            this.aGaugeIGT.BaseArcColor = System.Drawing.Color.Aqua;
            this.aGaugeIGT.BaseArcRadius = 80;
            this.aGaugeIGT.BaseArcStart = 135;
            this.aGaugeIGT.BaseArcSweep = 270;
            this.aGaugeIGT.BaseArcWidth = 2;
            this.aGaugeIGT.Center = new System.Drawing.Point(100, 100);
            this.aGaugeIGT.Font = new System.Drawing.Font("Segoe UI Semibold", 6.75F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.aGaugeIGT.Location = new System.Drawing.Point(8, 3);
            this.aGaugeIGT.MaxValue = 65F;
            this.aGaugeIGT.MinValue = -15F;
            this.aGaugeIGT.Name = "aGaugeIGT";
            this.aGaugeIGT.NeedleColor1 = System.Windows.Forms.AGaugeNeedleColor.Red;
            this.aGaugeIGT.NeedleColor2 = System.Drawing.Color.Aqua;
            this.aGaugeIGT.NeedleRadius = 80;
            this.aGaugeIGT.NeedleType = System.Windows.Forms.NeedleType.Advance;
            this.aGaugeIGT.NeedleWidth = 2;
            this.aGaugeIGT.ScaleLinesInterColor = System.Drawing.Color.White;
            this.aGaugeIGT.ScaleLinesInterInnerRadius = 73;
            this.aGaugeIGT.ScaleLinesInterOuterRadius = 80;
            this.aGaugeIGT.ScaleLinesInterWidth = 1;
            this.aGaugeIGT.ScaleLinesMajorColor = System.Drawing.Color.Aqua;
            this.aGaugeIGT.ScaleLinesMajorInnerRadius = 70;
            this.aGaugeIGT.ScaleLinesMajorOuterRadius = 80;
            this.aGaugeIGT.ScaleLinesMajorStepValue = 5F;
            this.aGaugeIGT.ScaleLinesMajorWidth = 2;
            this.aGaugeIGT.ScaleLinesMinorColor = System.Drawing.Color.Red;
            this.aGaugeIGT.ScaleLinesMinorInnerRadius = 75;
            this.aGaugeIGT.ScaleLinesMinorOuterRadius = 80;
            this.aGaugeIGT.ScaleLinesMinorTicks = 9;
            this.aGaugeIGT.ScaleLinesMinorWidth = 1;
            this.aGaugeIGT.ScaleNumbersColor = System.Drawing.Color.Turquoise;
            this.aGaugeIGT.ScaleNumbersFormat = null;
            this.aGaugeIGT.ScaleNumbersRadius = 95;
            this.aGaugeIGT.ScaleNumbersRotation = 0;
            this.aGaugeIGT.ScaleNumbersStartScaleLine = 0;
            this.aGaugeIGT.ScaleNumbersStepScaleLines = 1;
            this.aGaugeIGT.Size = new System.Drawing.Size(209, 188);
            this.aGaugeIGT.TabIndex = 35;
            this.aGaugeIGT.Text = "aGauge1";
            this.aGaugeIGT.Value = 0F;
            // 
            // FormMain
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.BackColor = System.Drawing.SystemColors.ActiveCaptionText;
            this.ClientSize = new System.Drawing.Size(1154, 711);
            this.Controls.Add(this.statusStrip1);
            this.Controls.Add(this.pictureBox2);
            this.Controls.Add(this.panel1);
            this.Controls.Add(this.panel2);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.FixedSingle;
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.Name = "FormMain";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "MFI - QuantumDiag Pro V.1";
            this.FormClosing += new System.Windows.Forms.FormClosingEventHandler(this.FormMain_FormClosing);
            this.Load += new System.EventHandler(this.FormMain_Load);
            this.groupBox1.ResumeLayout(false);
            this.groupBox1.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.numericUpdateInterval)).EndInit();
            this.groupBox2.ResumeLayout(false);
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox3)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.dataGridViewParams)).EndInit();
            this.groupBox3.ResumeLayout(false);
            this.groupBox3.PerformLayout();
            this.groupBox4.ResumeLayout(false);
            this.groupBox4.PerformLayout();
            this.panel1.ResumeLayout(false);
            this.panel1.PerformLayout();
            this.panel2.ResumeLayout(false);
            this.panel2.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox1)).EndInit();
            this.groupBox6.ResumeLayout(false);
            this.groupBox6.PerformLayout();
            this.groupBox5.ResumeLayout(false);
            this.panel3.ResumeLayout(false);
            this.panel3.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox2)).EndInit();
            this.statusStrip1.ResumeLayout(false);
            this.statusStrip1.PerformLayout();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.GroupBox groupBox1;
        private System.Windows.Forms.Button BtnConnect;
        private System.Windows.Forms.GroupBox groupBox2;
        private System.Windows.Forms.GroupBox groupBox3;
        private System.Windows.Forms.TextBox txtLog;
        private System.Windows.Forms.ComboBox comboComPort;
        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.Label label2;
        private System.Windows.Forms.RadioButton radioBaud10400;
        private System.Windows.Forms.RadioButton radioBaud9600;
        private System.Windows.Forms.DataGridView dataGridViewParams;
        private System.Windows.Forms.Timer timerScan;
        private System.Windows.Forms.GroupBox groupBox4;
        private System.Windows.Forms.TextBox txtECMPart;
        private System.Windows.Forms.TextBox txtECMCode;
        private System.Windows.Forms.Label label4;
        private System.Windows.Forms.Label label3;
        private System.Windows.Forms.NumericUpDown numericUpdateInterval;
        private System.Windows.Forms.Label label5;
        private System.Windows.Forms.Button BtnRefreshPort;
        private System.Windows.Forms.Panel panel1;
        private System.Windows.Forms.Label label6;
        private System.Windows.Forms.Button BtnRemap;
        private System.Windows.Forms.Button BtnDTC;
        private System.Windows.Forms.Button BtnAnalisaIGT;
        private System.Windows.Forms.Button BtnClose;
        private System.Windows.Forms.Panel panel2;
        private System.Windows.Forms.Button button1;
        private System.Windows.Forms.GroupBox groupBox5;
        private System.Windows.Forms.PictureBox pictureBox2;
        private System.Windows.Forms.GroupBox groupBox6;
        private System.Windows.Forms.Label label7;
        private System.Windows.Forms.TextBox TxtRPM;
        private System.Windows.Forms.PictureBox pictureBox1;
        private System.Windows.Forms.DataGridViewTextBoxColumn Column1;
        private System.Windows.Forms.DataGridViewTextBoxColumn Parameter;
        private System.Windows.Forms.DataGridViewTextBoxColumn Value;
        private System.Windows.Forms.DataGridViewTextBoxColumn Unit;
        private System.Windows.Forms.DataGridViewTextBoxColumn Column4;
        private System.Windows.Forms.Label label9;
        private System.Windows.Forms.Panel panel3;
        private System.Windows.Forms.Label label8;
        private System.Windows.Forms.StatusStrip statusStrip1;
        private System.Windows.Forms.ToolStripStatusLabel StatusLabel;
        private System.Windows.Forms.AGauge GaugeIGT;
        private System.Windows.Forms.Label label10;
        private System.Windows.Forms.Button button4;
        private System.Windows.Forms.AGauge GaugeTPS;
        private System.Windows.Forms.AGauge GaugeRPM;
        private System.Windows.Forms.Label label11;
        private System.Windows.Forms.Button button2;
        private System.Windows.Forms.PictureBox pictureBox3;
        private System.Windows.Forms.TextBox textBoxRPM;
        private System.Windows.Forms.TextBox textBoxTPS;
        private System.Windows.Forms.TextBox textBoxIGT;
        private System.Windows.Forms.AGauge aGaugeIGT;
    }
}