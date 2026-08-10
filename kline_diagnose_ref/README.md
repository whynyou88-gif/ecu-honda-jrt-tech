# KLine_Diagnose_MotorCycle
Aplikasi Windows Form untuk berkomunikasi dengan ECU Honda melalui Protokol Kline pada baudrate 10400, serial Port 'COM4'.
Cara menggunakan :
Clone semua file kedalam 1 folder dan gunakan file '.sln' untuk menyusun kembali script.
rebuild semua script dan Selamat Menggunakan.

Untuk Modul Interface, saya menggunakan Modul Interface FTDI type FT232RL dan Logic Converter 2 channel.
Dimana RX-TX pada modul FTDI digabung menjadi satu dengan penambahann dioda IN4007 untuk menghindari konfilk.
RX-TX digabung dan disematkan pada LV1 Logic Converter. Vcc FTDI disematkan pada LV2 dan Ground FTDI pada Ground.
Kline pada soket DLC disematkan pada HV1, Ground pada Ground dan 12+ Volt pada HV2.
penyematan pin jangan terbalik karena akan menyebabkan Modul FTDI menjadi terbakar (hangus).

Tampilan Aplikasi akan seperti dibawah ini :
<img width="1157" height="694" alt="image" src="https://github.com/user-attachments/assets/a48a8f5b-1456-493e-b670-5bdfe5502c5a" />
<img width="1157" height="693" alt="image" src="https://github.com/user-attachments/assets/be32aef2-13a4-4cf0-830e-fec7cdc5b324" />

Note:
perlu pengembangan lebih lanjut untuk semua tombol pada group Box 'Tools'.
Silahkan dikembangkan.
