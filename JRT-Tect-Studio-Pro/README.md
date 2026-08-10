# JRT Tect ECU Studio Pro (Windows Desktop App)

**JRT Tect ECU Studio Pro** adalah aplikasi desktop Windows (64-bit) modular berbasis **C# (.NET 8 + WPF)** untuk membaca, mengedit, memflash, dan mengelola ECU sepeda motor Honda (Keihin & Shindengen) via antarmuka K-Line / FTDI Serial.

---

## 🚀 Fitur Utama & Modul

1. **Read & Write Flash / Recovery Mode:**
   - Membaca memori flash Keihin (48, 96, 128, 256, 512, 1024 KB).
   - Menulis ulang firmware (.bin) dengan verifikasi checksum ganda.
   - Mode pemulihan (*fail-safe recovery*) jika proses flashing terputus.
2. **Read / Write EEPROM & Reset Flash Counter:**
   - Backup otomatis sebelum menulis.
   - Validasi checksum ganda.
3. **Smart Key / Key-ID Management:**
   - Baca dan registrasi ID Kunci Honda Smart Key via K-Line.
4. **Diagnostic Trouble Codes (DTC):**
   - Scan fault code, Clear DTC, dan Reset ECU.
5. **Live Data Streaming & Charting:**
   - Visualisasi sensor realtime (RPM, TPS, ECT, IAT, MAP, Battery Voltage, Inj PW, Ign Timing).
6. **Keamanan & Proteksi Hardware:**
   - Lisensi terikat Hardware ID (WMI HWID Binding).
   - Logging audit terstruktur via Serilog.

---

## 🛠️ Cara Menambahkan Dukungan ECU Baru

Untuk menambahkan protokol ECU baru (misalnya **Honda Shindengen** versi baru atau brand lain):

1. **Buat Class Protocol Handler Baru:**
   Tambahkan file baru di `src/JRT.Tect.Protocols/Honda/` (misalnya `CustomEcuHandler.cs`) yang mengimplementasikan interface `IECUProtocol`:

   ```csharp
   using JRT.Tect.Protocols.Abstractions;
   using JRT.Tect.Hardware.Abstractions;

   public class CustomEcuHandler : IECUProtocol
   {
       private readonly ISerialPortAdapter _adapter;

       public string ProtocolName => "Custom ECU K-Line";
       public string TargetBrand => "Honda";

       public CustomEcuHandler(ISerialPortAdapter adapter)
       {
           _adapter = adapter;
       }

       public async Task<bool> InitializeSessionAsync(CancellationToken ct = default)
       {
           // Implementasikan pulsa Fast Init / 5-Baud Init di sini
           _adapter.SendBreak(70);
           await Task.Delay(130, ct);
           return true;
       }

       // Implementasikan metode ReadLiveDataAsync, ReadFlashAsync, WriteFlashAsync, dst.
   }
   ```

2. **Daftarkan Handler di Dropdown UI:**
   Tambahkan opsi handler baru tersebut pada View / ViewModel antarmuka WPF Anda.

---

## ⚖️ Disclaimer Hukum & Regulasi
*Aplikasi ini dirancang khusus untuk keperluan diagnostik dan perbaikan kendaraan. Pengubahan data kalibrasi ECU kendaraan bermotor (remap) dapat membatalkan garansi resmi pabrikan serta berdampak pada emisi kendaraan sesuai dengan regulasi yang berlaku di Indonesia.*
