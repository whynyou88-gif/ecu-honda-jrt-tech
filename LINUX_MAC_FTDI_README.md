# Panduan JRT Tect ANALIST Pro - Linux & macOS Setup

Dokumen ini menjelaskan langkah-langkah untuk menjalankan aplikasi desktop pada **Linux (seperti Kali Linux, Ubuntu, dll.)** dan **macOS (Apple Silicon/Intel)** menggunakan adapter K-Line USB FTDI.

---

## 1. Konfigurasi Linux (Kali Linux / Ubuntu / dll.) - PENTING

Pada distro Linux, layanan bawaan seperti `ModemManager` secara otomatis memindai port serial baru ketika adapter FTDI dicolokkan. Hal ini menyebabkan gangguan transmisi (AT commands) dan menyebabkan koneksi terputus dalam hitungan detik. Selain itu, fitur `autosuspend` pada kernel USB Linux dapat menidurkan adapter saat idle.

### Cara Mengatasi dengan udev Rules:
Kami menyediakan script otomatis untuk memasang rule udev yang akan mengabaikan adapter FTDI dari `ModemManager` dan menonaktifkan `USB autosuspend`. Rule ini akan dipasang di `/etc/udev/rules.d/99-ecu-ftdi-ignore-mm.rules`.

1. Jalankan script setup rules dengan hak akses root (`sudo`):
   ```bash
   sudo ./scripts/setup_linux_rules.sh
   ```
2. Hubungkan kembali (unplug & replug) adapter FTDI Anda.
3. Anda dapat memverifikasi status ModemManager dengan perintah berikut jika masih terjadi error:
   ```bash
   sudo systemctl status ModemManager
   journalctl -u ModemManager -f
   ```

---

## 2. Konfigurasi macOS (Apple Silicon / Intel)

Di macOS, driver bawaan Apple (`AppleUSBFTDI`) mungkin secara otomatis mengklaim adapter FTDI. Namun, library Python `pylibftdi` berkomunikasi langsung melalui driver user-space `libftdi` + `libusb` (memotong driver serial virtual/VCP bawaan).

### Prasyarat macOS (Homebrew):
1. Pastikan Homebrew telah terinstal di Mac Anda.
2. Instal library `libftdi` dan `libusb`:
   ```bash
   brew install libftdi libusb
   ```
3. Driver `HondaECU.py` secara otomatis memetakan path library Homebrew pada Apple Silicon (`/opt/homebrew/lib`) dan Intel Mac (`/usr/local/lib`).

### Tips Menggunakan Driver Virtual COM Port (VCP) di macOS:
Jika aplikasi C# atau aplikasi desktop lainnya menggunakan port serial virtual COM di macOS:
- Harap gunakan path perangkat `/dev/cu.usbserial-*` alih-alih `/dev/tty.usbserial-*`. Perangkat `/dev/cu.*` (Callout device) dirancang khusus untuk koneksi outgoing dan tidak akan memblokir proses menunggu sinyal carrier detect (DCD) seperti yang dilakukan oleh `/dev/tty.*`.
- Anda dapat mengonfirmasi daftar perangkat yang terdeteksi dengan perintah:
  ```bash
  ls /dev/tty.usbserial-*
  ls /dev/cu.usbserial-*
  ```

---

## 3. Cara Menjalankan Mode Pengembangan (Dev Mode)

Untuk menjalankan server backend dan aplikasi desktop:

1. Jalankan backend server:
   ```bash
   python3 localhost_server.py
   ```
2. Di terminal terpisah, jalankan GUI Desktop pembungkus:
   ```bash
   python3 AnalistProStudioApp.py
   ```
3. Atau buka web browser Anda dan akses `http://127.0.0.1:8080` untuk masuk ke Dashboard JRT Tect.

---

## 4. Troubleshooting & Logging

Jika terjadi pemutusan koneksi (disconnect), Anda dapat memeriksa log detail dengan timestamp di:
* file log: `logs/ecu_connection.log` (dibuat otomatis di dalam folder project).
* Endpoint API log: `http://127.0.0.1:8080/api/log`
