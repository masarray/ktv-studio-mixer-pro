# K500 Live Alpha v0.8.20 — HPF/LPF Live Fix (CMD 0x11 verified)

## Gejala
HPF dan LPF di section/tab tidak mengubah device saat live edit. Sub HPF/LPF
lebih berisiko karena path `outputs.sub.hpfHz/lpfHz` sebelumnya tertangkap oleh
output-block writer `CMD 0x0E`, padahal filter bukan bagian dari output mixer
block.

## Bukti dari sniff native app
Empat sniff USB native app `Music_HPF_20_to_20000`, `Music_HPF_20000_to_20`,
`Music_LPF_20_to_20000`, dan `Music_LPF_20000_to_20` menunjukkan HPF/LPF memakai
command pendek `CMD 0x11`:

```text
USB: AA 06 00 11 [02=HPF | 03=LPF] [section] [freq u16 LE] 04 CS
BT : AA 06    11 [02=HPF | 03=LPF] [section] [freq u16 LE] 04 CS
```

Untuk Music, section = `0x02`, sama dengan section id Music pada PEQ live write.
Contoh frame native:

```text
Music HPF 20000 Hz: AA 06 00 11 02 02 20 4E 04 73
Music LPF 20000 Hz: AA 06 00 11 03 02 20 4E 04 72
Music HPF 20 Hz   : AA 06 00 11 02 02 14 00 04 CD
Music LPF 20 Hz   : AA 06 00 11 03 02 02 14 00 04 CC
```

Catatan: byte akhir payload selalu `0x04` di semua sniff, termasuk LPF, sehingga
belum dianggap sebagai filter-type selector. Path `hpType/lpType` tetap tidak
dikirim live sampai ada sniff khusus type change.

## Perubahan implementasi
- Tambah `buildCrossoverWrite(eqKey, kind, hz)` di `commands.ts`.
- Tambah router path HPF/LPF di `liveStore.ts` sebelum output-block routing.
- `eq.<section>.crossover.hpfHz/lpfHz` kini mengirim `CMD 0x11`.
- `mic.hpfHz/lpfHz` mengirim ke Mic A dan Mic B karena UI Mic memakai satu nilai
  shared, sementara live section map terverifikasi memisahkan Mic A `0x00` dan
  Mic B `0x01`.
- `outputs.sub.hpfHz/lpfHz` kini diarahkan ke section Sub `0x08`, bukan lagi
  `CMD 0x0E` output block.
- `effects.reverb.hpfHz/lpfHz` dan `effects.echo.hpfHz/lpfHz` diarahkan ke
  section Reverb `0x09` dan Echo `0x0A`.

## Verifikasi byte
Replay builder terhadap sniff Music:

- Music LPF 20→20000: 9/9 byte-identik
- Music LPF 20000→20: 11/11 byte-identik
- Music HPF 20→20000: 10/10 byte-identik
- Music HPF 20000→20: 10/10 byte-identik

Total: 40/40 frame native cocok byte-per-byte, termasuk checksum.

## Batas kepastian
Music HPF/LPF sudah terverifikasi byte-per-byte dari sniff native app. Section
lain memakai section id dari PEQ live mapping yang sudah terverifikasi dan map
scalar readback aktif. Ini adalah inferensi paling aman saat ini, tetapi untuk
claim 100% semua section tetap idealnya ditambah sniff native per-section.
