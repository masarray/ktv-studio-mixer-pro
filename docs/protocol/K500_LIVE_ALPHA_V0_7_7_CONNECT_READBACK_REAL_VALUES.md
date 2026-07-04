# K500 Live Alpha v0.7.7 — Connect Readback Real Values + DAW PEQ

## Root cause v0.7.6: Connect selalu crash

`liveStore.ts` memanggil `appendLog`, `writeRaw`, `enqueueWrite`, `closeInternal`
tetapi keempat fungsi itu **tidak pernah didefinisikan**. Klik Connect langsung
`ReferenceError` sebelum handshake jalan. v0.7.7 mengimplementasikan keempatnya
(log berstempel waktu, TX serial via write queue, teardown port yang bersih).

## Fix mapping live memory (verifikasi dari capture COM `connect` 03.07.2026)

Live memory device MELEWATKAN tepat 1 byte relatif terhadap file .k500
(file `0x0097` tidak punya padanan live):

```text
live[0x0000..0x008e] == file[0x0008..0x0096]   (delta +8)
live[0x008f..0x00e6] == file[0x0098..0x00ef]   (delta +9)
```

Delta flat +8 (v0.7.6) membuat semua field setelah 0x0097 korup:
Mic HPF terbaca 45056 Hz, Sub xover, Reverb/Echo filter & decay, Surround delay.

## Crossover per-section kini dibaca dari device

Frekuensi HP/LP semua section ada di scalar block (offset file, u16 LE):

| Section | HPF | LPF |
|---|---|---|
| micA/micB | 0x0098 | 0x009a |
| music | 0x009c | 0x009e |
| main / mainAlt | 0x00a0 / 0x00a2 | 0x00a4 / 0x00a6 |
| surround / surroundAlt | 0x00a8 / 0x00aa | 0x00ac / 0x00ae |
| center / centerAlt | 0x00b0 / 0x00b2 | 0x00b4 / 0x00b6 |
| sub / subAlt | 0x00b8 / 0x00ba | 0x00bc / 0x00be |
| reverb | 0x00c0 | 0x00c2 |
| echo | 0x00c4 | 0x00c6 |

Nilai-nilai ini dipatch ke footer tiap section EQ saat sync, jadi handle HP/LP
di graph menampilkan kondisi device (Main: HP 40 Hz / LP 20 kHz, persis UI asli),
independen dari base preset (DEFAULT FLAT sekalipun).

Hasil verifikasi terhadap capture + screenshot UI asli (Main):
80/LS/+20/Q0.6 · 609/P/-2.5/Q1 · 1753/P/-5.6/Q1.2 · 3900/P/-5.7/Q2 ·
7300/P/-6.5/Q2 · 13500/P/-6.5/Q1.7 · 207/HS/+21/Q0.4 — 100% match.
Output Main: L/R 11 dB, mic 90%, music 95%, comp -5 dB 1:4 15 ms 0.2 s. Match.

## PEQ ala DAW

- Drag node = freq + gain, kini SATU update state + SATU frame serial per tick.
- Wheel di graph = Q band terpilih (Shift = halus). Ctrl/Cmd+drag vertikal = Q.
- Shift+drag = fine mode (25% kecepatan pointer). Snap magnetik 0 dB (±0.3).
- Double-click node = kembali ke 0 dB.
- Handle HP/LP bisa di-drag di garis 0 dB (seperti puck kuning app asli) dengan
  label frekuensi live. Edit crossover masih file-model-only (belum ada command
  live crossover yang ter-capture — tidak dikirim ke device).
- Live write EQ di-throttle 45 ms dengan coalescing per band + trailing flush,
  supaya drag mulus tidak membanjiri link BT SPP.
- Sync dari device tidak lagi melempar user balik ke halaman Mic.

## Tidak berubah

Urutan connect tetap mengikuti capture asli (0x1C → 0x3F → blok 0x40 mode 0x63,
0x0000..0x03aa). Save permanen/upload tetap dinonaktifkan.
