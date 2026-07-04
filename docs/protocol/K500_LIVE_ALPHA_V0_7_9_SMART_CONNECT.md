# K500 Live Alpha v0.7.9 — Smart Connect (BT auto-scan + USB HID)

## Toggle transport BT | USB
Segmented control di pill device (pengganti checkbox USB/BT app native).
Pilihan tersimpan di localStorage (`k500.transportMode`).

## Mode BT — auto-scan, identifikasi via protokol
1. `navigator.serial.getPorts()` → semua port yang PERNAH di-grant di-probe
   berurutan: open 115200 8N1 → kirim heartbeat `AA 01 1C E3` → tunggu status
   `0x55/0xE3` max 1.4 s. Port pertama yang menjawab = K500. Tanpa dialog.
2. Kalau belum ada port granted (pertama kali / device pindah COM): chooser
   difilter `bluetoothServiceClassId 0x1101` (SPP) sehingga hanya port
   Bluetooth yang tampil — USB-COM lain disembunyikan. Fallback tanpa filter
   untuk Chromium lama.
3. Port yang dipilih manual tetap di-probe; kalau diam, error jelas + saran
   pilih entri KTV_BT satunya (Windows membuat 2 COM per device SPP,
   hanya arah "outgoing" yang merespon).

Batasan platform yang tidak bisa dilewati: browser MEWAJIBKAN satu kali
pemilihan port per device (user gesture). Setelah grant pertama, semua
Connect berikutnya 100% otomatis.

## Mode USB — WebHID (EKSPERIMENTAL)
Device Manager menunjukkan K500 via USB enumerasi sebagai HID JieLi
("JL_SPP"/"DSPSPP" tanpa driver), bukan USB-CDC. Implementasi:
- `navigator.hid` getDevices() auto-probe → requestDevice fallback.
- Frame `AA..` yang sama dibungkus output report (report id + size dibaca
  dari descriptor, default 64 byte, zero-padded). Input report diumpankan ke
  parser frame yang sama (scanner header 0x55 toleran padding nol).
- BELUM diverifikasi dengan hardware: framing report USB JieLi belum pernah
  di-capture. Kalau probe gagal, app memberi tahu dan meminta capture
  USBPcap saat app asli connect via USB untuk implementasi penuh.

## Perubahan teknis
- `writeRaw` dispatch serial/HID; `closeInternal` menutup keduanya.
- Cancel chooser tidak lagi dianggap error (status kembali disconnected).
- Label port menampilkan sumber (`· auto` bila hasil auto-scan).
