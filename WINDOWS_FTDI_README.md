# Panduan JRT Tect ANALIST Pro - Windows Setup & Build

Dokumen ini menjelaskan langkah-langkah untuk menjalankan, mem-build, dan mengonfigurasi driver FTDI pada sistem operasi Windows agar aplikasi dapat terhubung ke ECU Honda dengan lancar.

---

## 1. Instalasi Driver FTDI (PENTING)

Agar adapter USB-ke-K-Line (FTDI) dapat terbaca oleh library Python (`pylibftdi`/`ctypes`), Windows membutuhkan driver FTDI D2XX yang sesuai.

### Cara Install:
1. Hubungkan modul FTDI USB Anda ke PC Windows.
2. Download **FTDI CDM Drivers** (D2XX dan VCP) resmi dari website FTDI:
   * URL: [https://ftdichip.com/drivers/d2xx-drivers/](https://ftdichip.com/drivers/d2xx-drivers/)
3. Pilih versi installer (misalnya **setup executable** untuk Windows) agar instalasi berjalan otomatis.
4. Jika menggunakan file `.zip` manual:
   * Ekstrak file.
   * Buka **Device Manager** di Windows.
   * Klik kanan pada device FTDI yang belum dikenali (tanda seru kuning), pilih **Update Driver** -> **Browse my computer for drivers**, lalu arahkan ke folder ekstraksi tersebut.

### Memastikan Driver Terpasang:
Setelah instalasi berhasil, buka **Device Manager**:
* Di bagian **Ports (COM & LPT)**, akan muncul **USB Serial Port (COMx)**.
* Di bagian **Universal Serial Bus controllers**, akan muncul **USB Serial Converter**.

---

## 2. Cara Build Aplikasi di Windows

Jika Anda ingin memaketkan aplikasi ini menjadi file `.exe` mandiri (standalone), jalankan langkah berikut di PC Windows:

### Prasyarat:
Pastikan Anda sudah menginstal Python 3.10 atau versi terbaru di Windows, dan telah menambahkan Python ke dalam System `PATH` (centang *"Add Python to PATH"* saat menginstal).

### Langkah-langkah Build:
1. Buka **Command Prompt (cmd)** atau **PowerShell** di folder project `remap-ecu-honda-main`.
2. Instal library dependensi yang dibutuhkan:
   ```cmd
   pip install pyinstaller pywebview aiohttp pylibftdi
   ```
3. Jalankan script build khusus Windows:
   ```cmd
   python build_windows.py
   ```
4. Setelah build selesai, file executable `.exe` beserta asetnya akan berada di folder:
   * `dist/JRT Tect ANALIST Pro/JRT Tect ANALIST Pro.exe`
5. Anda bisa mendistribusikan aplikasi dengan melakukan zip pada folder `dist/JRT Tect ANALIST Pro/`.

---

## 3. Cara Menjalankan Mode Pengembangan (Dev Mode)

Jika Anda ingin menjalankan aplikasi langsung dari source code tanpa mem-build:
1. Jalankan backend server:
   ```cmd
   python localhost_server.py
   ```
2. Di terminal terpisah, jalankan GUI Desktop pembungkus:
   ```cmd
   python AnalistProStudioApp.py
   ```
3. Atau buka web browser Anda dan akses `http://127.0.0.1:8080` untuk masuk ke Dashboard JRT Tect.
