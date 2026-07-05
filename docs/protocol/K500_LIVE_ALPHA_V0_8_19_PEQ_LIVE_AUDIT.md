# K500 Live Alpha v0.8.19 — PEQ Live Audit (Music EQ B1–B7 sweeps)

## Hasil verifikasi — encoder terbukti benar
14 sniff (Music EQ B1..B7, gain ±24 dB dua arah, 06.07.2026) menghasilkan
112 frame unik. `buildEqWrite` + framing USB direplay terhadap SELURUHNYA:
**112/112 byte-identik** (freq/Q/type/gain/checksum). Frekuensi & Q tiap band
cocok persis UI native (13000/117/70/1300/2750/6000/376 Hz; B7 HS).

Format terkonfirmasi (semua transport):
  AA 09 00 03 [section] [band0] [freqLE u16] [Q×10] [type|sign] [|gain|×10] [tail] CS
  section: micA 00 · micB 01 · music 02 · main 03 · surround 05 · center 07 ·
           sub 08 · reverb 09 · echo 0A (cocok capture BT historis di appendix)
  tail   : 0x60 KHUSUS music (BT & USB sama), 0x00 untuk section lain.

## Pipeline runtime — lolos audit statik
store.setBandValue(s) → sendEqBand → coalesce 45 ms → enqueueWrite →
writeRaw (bridge/HID/serial). Guard transport (bekas bug v0.8.16 yang membuang
frame di USB/bridge diam-diam) sudah benar di tree ini sejak v0.8.17.
Kemungkinan besar gejala "PEQ tidak jalan" berasal dari pengujian SEBELUM
perbaikan itu — heartbeat tetap hidup (jalur langsung) sehingga koneksi tampak
sehat sementara EQ tidak pernah terkirim. Mohon retest di build ini.

## Perbaikan yang ditemukan audit
1. Q live-write adalah SATU byte (Q×10): Q > 25.5 dari UI membuat byte wrap →
   Q sampah terkirim. Live write kini clamp Q 0.1..25.0 (file .k500 tetap u16).
2. Section alt (mainAlt/surroundAlt/...) tidak punya command live — kini satu
   notifikasi SYS "file-only", bukan spam ERR tiap flush 45 ms.
3. Serial log memberi label respons: 0xE3 STATUS · 0xBF READ · 0xFD WRITE-ACK.
   Saat menggeser PEQ, tiap TX EQ harus berbalas RX 0xFD — kalau TX muncul
   tanpa WRITE-ACK, masalah ada di transport; kalau TX tidak muncul sama
   sekali, masalah di gating (LIVE OFF / section).
