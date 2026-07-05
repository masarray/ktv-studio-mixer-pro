# K500 Live Alpha v0.8.7 — Zero-Chooser Reconnect

## Kenapa chooser tetap sering muncul di v0.8.6
1. Probe terlalu tidak sabar. `open()` port Bluetooth SPP di Windows memicu
   pembentukan kanal RFCOMM secara lazy (2–5 detik dari idle). Heartbeat
   pertama sering hilang saat link masih warm-up, satu kali timeout 1.4 s →
   port KTV yang benar divonis "silent" → jatuh ke chooser. App native sabar.
2. Grant Web Serial/WebHID per-ORIGIN. `localhost:5173` ≠ `localhost:8080`.
   Ganti port dev server = izin mulai dari nol. Gunakan satu origin tetap.

## Perbaikan
- `probeK500(timeout, attempts)`: heartbeat di-retry (port terakhir yang sukses:
  3×, port lain: 2×, pilihan manual: 4×), jeda 150 ms antar percobaan.
- `openSerialWithTimeout`: open dibatasi 7–10 s supaya device paired yang mati
  tidak menggantung auto-scan.
- Indeks port granted yang terakhir menjawab disimpan (`k500.btLastPortIndex`)
  dan diprobe PERTAMA pada Connect berikutnya → hampir selalu direct hit.
- Probe USB HID granted juga retry 2×.

## Batas platform (jujur, tidak bisa dilewati)
Popup pemilihan device pada IZIN PERTAMA adalah keharusan security Chrome —
web app tidak boleh memberi izin ke dirinya sendiri; app native tidak terikat
aturan ini. Setelah satu kali pilih (per origin): Connect = langsung nyambung
tanpa popup, selama origin tidak berubah dan izin tidak di-reset dari ikon
gembok Chrome. Mode USB: chooser difilter VID 10C4/PID 0321 sehingga daftar
hanya berisi "USB HID DSP AUDIO".
