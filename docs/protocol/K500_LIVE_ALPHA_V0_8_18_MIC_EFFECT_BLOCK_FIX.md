# K500 Live Alpha v0.8.18 — Mic & Effect Block Fix (CMD 0x05 / 0x09 verified)

## Mic block CMD 0x05 — layout terverifikasi
Dari sniff Master_Mic_Vol_84_to_min_0 / _0_to_max_84 (06.07.2026),
dikorelasikan dengan readback USB_Connect: konstanta 19 54 0b 60 60 26 03 0a 02
= live 0x0A (micInit 25), 0x0B (micMax 84), 0x0E, 0x0C/0x0D (micA/micB 96/96),
compTH -12 → +50 = 0x26, ratio 3, attack 10, release 0.2 s → 2.

  AA 0E 00 05 [vol] [init] [max] [x0E] [00] [00] [micA] [micB]
              [compTH+50] [ratio] [attack] [rel×10] [00] CS

Builder lama menempatkan topMusicVol/topEffectVol di [1][2] (field device
micInit/micMax), micAVol di [3] (field lain), micBVol dobel di [6][7], dan
eqLink di [12] — SETIAP geser fader MIC merusak lima field device sekaligus.

## Effect block CMD 0x09
Layout lama sudah benar: AA 03 00 09 [vol] [effectInit] CS. Perbaikan:
effectInit kini device-mirrored (live 0x15) agar nilai model stale tidak bisa
menimpa, dan clamp 0..84 (v0.8.17) menutup overrange fader.

## Pola yang sama dengan v0.8.17
Field yang jarang diubah di-mirror dari cache scalar device (live 0x00..0x3F,
seed saat connect, refresh TTL 4 s sebelum burst). Byte [4][5][12] mic block
bernilai 0x00 di semua frame sniff dan offset live-nya belum teridentifikasi —
dikirim 0x00 apa adanya (sesuai perilaku app native pada sesi sniff).

## Verifikasi
8/8 frame simulasi (MIC: 82, 72, 0, 84 · FX: 82, 0, 84, 37) BYTE-IDENTIK
dengan frame TX sniff, checksum termasuk.
