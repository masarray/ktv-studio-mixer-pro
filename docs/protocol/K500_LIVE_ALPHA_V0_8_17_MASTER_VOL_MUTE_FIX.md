# K500 Live Alpha v0.8.17 — Master Volume Mute Bug Fix (CMD 0x02 verified)

## Gejala
Geser fader Music (Master strip) sedikit → device senyap total, menaikkan
volume tidak menolong. Recovery: power-cycle KTV (nilai rusak hanya di RAM).

## Akar masalah
Layout blok Music CMD 0x02 di builder v0.8.16 salah di 4 posisi. Layout benar
(terverifikasi dari sniff Master_Music_Vol_84_to_min_0 / _0_to_max_84, 06.07,
dikorelasikan dengan readback USB_Connect 04.07 — gain live 0x16..0x1A =
09 09 09 08 08 = -3,-3,-3,-4,-4 persis UI native, encoding gain+12):

  AA 0D 00 02 [vol] [init] [max] [src] [g1 g2 gBT gUD gDig] [key+7] [gate] [type] CS

v0.8.16 mengirim:              Seharusnya:
  [1]  topMicVol                 musicInitVol   (live 0x03)
  [2]  topEffectVol              musicMaxVol    (live 0x04) → tertimpa = cap volume
  [10] micMaxVol (84!)           NOISE GATE     (live 0x1B, OFF = 0x00)
  [11] musicInitVol              filter type    (live 0x07)

Byte [10] adalah pembunuhnya: menulis 84 ke field noise gate = semua audio
music di-gate = senyap permanen. Persis gejala yang dilaporkan.

## Desain fix — safe by construction
- Field yang jarang diubah ([1][2][10][11]) di-MIRROR dari byte mentah device:
  cache scalar live 0x00..0x3F di-seed saat connect readback dan di-refresh
  (read 0x40 tunggal, TTL 4 s) sebelum burst write blok — aplikasi tidak
  pernah bisa menimpa setting device dengan nilai model yang salah parse.
- Field yang diedit UI ([0] vol, [3] source, [4..8] gains, [9] key) dikirim
  dari model dengan encoding terverifikasi.
- Range master volume dikunci 0..84 (0x54) di builder (clamp) dan fader UI
  (sebelumnya 0..100 — overrange).
- Clamp 0..84 juga diterapkan ke blok Mic (0x05) dan Effect (0x09).

## Verifikasi
Simulasi builder → framing USB menghasilkan frame BYTE-IDENTIK dengan seluruh
frame TX di kedua sniff (5/5, termasuk checksum): 82, 62, 2, 0, dan 84.
