# BUILD.md — JRT Tech ANALIST Pro 3.4

Panduan lengkap build dari source code hingga installer siap distribusi.

---

## Arsitektur Build

```
AnalistProStudioApp.py   ──► PyInstaller (onedir) ──► dist/JRT Tech ANALIST Pro/
                                                          │
                                                          ▼
                                                    Inno Setup (iscc) ──► JRT_Tech_ANALIST_Pro_v3.4_Setup.exe
```

**Kenapa onedir, bukan onefile?**
- Onefile: setiap kali exe dibuka, harus extract ~50-100MB ke temp folder dulu → startup lambat 5-15 detik
- Onedir: file sudah ter-extract permanen di folder install → startup instan < 2 detik
- Inno Setup mengompres folder onedir menjadi satu file installer → user download 1 file saja

---

## Prasyarat (Windows)

| Software | Versi Minimum | Install |
|----------|---------------|---------|
| Python | 3.10+ | [python.org](https://www.python.org/downloads/) |
| PyInstaller | 6.0+ | `pip install pyinstaller` |
| Inno Setup | 6.0+ | [jrsoftware.org](https://jrsoftware.org/isdl.php) |

### Install Semua Dependencies Python

```bat
pip install pyinstaller pywebview aiohttp pyserial pylibftdi pythonnet bottle
```

---

## Langkah Build (Manual di Windows)

### Step 1: Build PyInstaller Onedir

```bat
cd /d "C:\path\to\remap-ecu-honda-main"
pyinstaller analist_pro.spec --clean --noconfirm
```

Output: `dist\JRT Tech ANALIST Pro\` (folder berisi exe + semua DLL + data)

### Step 2: Verifikasi Build

```bat
REM Test jalankan exe langsung
"dist\JRT Tech ANALIST Pro\JRT Tech ANALIST Pro.exe"
```

Pastikan:
- ✅ Window aplikasi muncul (pywebview window)
- ✅ Tidak ada `ModuleNotFoundError` di console
- ✅ UI web frontend ter-load dengan benar
- ✅ Koneksi serial port terdeteksi (jika adapter terhubung)

### Step 3: Build Installer dengan Inno Setup

```bat
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer.iss
```

Atau buka `installer.iss` di Inno Setup GUI → klik Compile.

Output: `Output\JRT_Tech_ANALIST_Pro_v3.4_Setup.exe`

### Step 4: Test Installer

1. Jalankan `JRT_Tech_ANALIST_Pro_v3.4_Setup.exe`
2. Ikuti wizard instalasi (tidak perlu admin/UAC)
3. Setelah selesai, aplikasi otomatis terbuka
4. Cek shortcut di Desktop dan Start Menu
5. Test uninstall via "Add or Remove Programs"

---

## Build via GitHub Actions (Otomatis)

Push tag versi baru untuk trigger build otomatis:

```bash
git tag v3.4.1
git push origin v3.4.1
```

GitHub Actions akan:
1. Setup Python 3.11 + install dependencies
2. Jalankan `pyinstaller analist_pro.spec --clean`
3. Install Inno Setup via Chocolatey
4. Compile `installer.iss` → `Setup.exe`
5. Upload ke GitHub Releases

Download installer dari: [GitHub Releases](https://github.com/whynyou88-gif/ecu-honda-jrt-tech/releases)

---

## Checklist Sebelum Distribusi

### Fungsional
- [ ] Exe berjalan tanpa error `ModuleNotFoundError`
- [ ] UI frontend tampil lengkap (semua tab: Connect, Flash, Live Data, DTC, Analyzer)
- [ ] Koneksi K-Line ke ECU berfungsi (jika hardware tersedia)
- [ ] Read DTC berfungsi tanpa error
- [ ] Flash Read membuat backup file .bin
- [ ] Live Data menampilkan grafik real-time

### Ukuran & Performa
- [ ] Folder onedir total < 150 MB
- [ ] Installer (.exe) < 60 MB (dengan lzma2 compression)
- [ ] Waktu startup < 3 detik (dari klik exe sampai window muncul)

### Keamanan
- [ ] Windows Defender tidak menandai exe sebagai malware
- [ ] Scan dengan VirusTotal — max 2-3 false positive (normal untuk PyInstaller)
- [ ] UPX tidak mengompres DLL yang di-exclude (Qt, Python core, VCRT)

### Installer
- [ ] Install berhasil TANPA admin privilege (ke user folder)
- [ ] Shortcut Desktop dan Start Menu terbuat
- [ ] Aplikasi otomatis terbuka setelah install
- [ ] Uninstall bersih via Control Panel

---

## Struktur File Build

```
remap-ecu-honda-main/
├── analist_pro.spec          ← PyInstaller spec file (ONEDIR)
├── installer.iss             ← Inno Setup installer script
├── icon.ico                  ← Application icon
├── EULA_LICENSE.txt          ← License shown in installer
├── AnalistProStudioApp.py    ← Main entry point
├── localhost_server.py       ← Backend HTTP server
├── seed_key_provider.py      ← ECU authentication
├── drivers/                  ← ECU driver modules
├── protocols/                ← K-Line protocol implementation
├── framework/                ← Core framework (flash, transport, etc.)
├── plugins/                  ← Plugin JSON configs
├── HondaECUTool/
│   └── data/
│       ├── web/              ← Frontend HTML/CSS/JS
│       └── definitions/      ← ECU model database JSON
├── dist/                     ← [BUILD OUTPUT] PyInstaller output
│   └── JRT Tech ANALIST Pro/
└── Output/                   ← [BUILD OUTPUT] Inno Setup installer
    └── JRT_Tech_ANALIST_Pro_v3.4_Setup.exe
```

---

## Troubleshooting

### Error: `ModuleNotFoundError: No module named 'xxx'`
Tambahkan module ke `hidden_imports_list` di `analist_pro.spec`, lalu rebuild.

### Error: Windows Defender blokir exe
1. Pastikan UPX tidak mengompres DLL yang ada di `upx_exclude`
2. Submit false positive report ke Microsoft: https://www.microsoft.com/wdsi/filesubmission
3. Pertimbangkan code signing certificate

### Installer tidak bisa dibuka / "Windows protected your PC"
1. Klik "More info" → "Run anyway"
2. Ini normal untuk unsigned installer
3. Solusi permanen: beli code signing certificate (Sectigo, DigiCert)

### Startup lambat (> 5 detik)
1. Pastikan menggunakan onedir, BUKAN onefile
2. Pastikan `console=False` di spec (windowed mode, tanpa terminal)
3. Cek apakah antivirus sedang scan file — whitelist folder instalasi
