# K500 Live Alpha v0.8.5 — Documented Live Mapping Pass

Tujuan patch ini adalah menutup gap antara dokumentasi reverse-engineering yang sudah ada dan router live update di aplikasi.

## Yang diaudit

Dokumentasi yang dipakai sebagai sumber utama:

- `docs/protocol/K500_BT_PROTOCOL_REVERSE_ENGINEERING.md`
- `docs/protocol/appendix/k500_bt_action_analysis.md`
- `docs/protocol/K500_BT_OUTPUT_MIXER_MAPPING.md`
- `docs/protocol/appendix/k500_bt_output_comp_surround_analysis.md`
- `docs/protocol/K500_BT_CHANNEL_EQ_MAPPING.md`
- `docs/protocol/K500_LIVE_ALPHA_IMPLEMENTATION.md`

Kesimpulan audit: command builder untuk beberapa block utama sudah ada, tetapi `sendPathUpdate()` belum meroute banyak path UI ke builder tersebut.

## Mapping live yang ditambahkan

### Music block — `CMD 0x02`

Sekarang path berikut mengirim `buildTopMusicBlock()`:

```text
system.topMusicVol
music.source
music.key
music.input1GainDb
music.input2GainDb
music.btGainDb
music.uDiskGainDb
music.digitalGainDb
```

Bug tambahan yang diperbaiki:

```text
setMusicSource() sekarang mengupdate music.sourceRaw juga.
```

Sebelumnya UI source bisa berubah, tetapi live command masih berisiko memakai `sourceRaw` lama.

### Mic block — `CMD 0x05`

Sekarang path berikut mengirim `buildTopMicBlock()`:

```text
system.topMicVol
mic.micAVol
mic.micBVol
mic.compThresholdDb
mic.compRatio
mic.attackMs
mic.releaseSec
```

Catatan: `mic.noiseGateDb`, `mic.hpfHz`, dan `mic.lpfHz` masih sengaja tidak dimapping live karena command write-nya belum cukup terkunci dari capture. Nilainya tetap bisa diedit di UI/preset, tetapi belum dikirim sebagai RAM live write.

### Effect top block — `CMD 0x09`

Sekarang path berikut mengirim `buildTopEffectBlock()`:

```text
system.topEffectVol
system.effectInitLevel
```

### Output block — `CMD 0x0E`

Output block yang sudah ada tetap dipakai untuk:

```text
outputs.main.*
outputs.surround.*
outputs.center.*
outputs.sub.*
```

Mapping ini tetap mencakup fader output, send mic/music/reverb/echo, compressor, dan surround delay sesuai dokumen output mixer.

### Mic EQ Link — `CMD 0x3C`

Mic EQ Link tetap memakai command khusus:

```text
AA 04 3C 01 01 9E 20  // ON
AA 04 3C 00 00 C4 FC  // OFF
```

## Proteksi anti flood

Patch ini menambah coalescing block write:

```text
BLOCK_SEND_INTERVAL_MS = 55
```

Slider/fader dapat mengirim banyak event saat digeser. Untuk Music/Mic/Effect/Output block, aplikasi sekarang menyimpan frame terakhir per block dan mengirim maksimal per interval pendek. Ini menjaga feeling live tetap responsif tanpa membanjiri BT SPP.

EQ band coalescing lama tetap terpisah:

```text
EQ_SEND_INTERVAL_MS = 45
```

## Yang tidak disentuh

Patch ini tidak mengubah:

```text
BT connect/probe/reader
USB HID connect/probe/inputreport
USB framing AA len16LE
USB heartbeat direct path
syncFromDevice/readback
writeRaw transport wrapper
```

Dengan kata lain, fix v0.8.1/v0.8.4 untuk BT/USB connection tetap dipertahankan.

## Status setelah patch

Lebih dekat ke digital mixer live editor:

```text
EQ live semua section       : sudah
Output mixer live           : sudah
Music source/gain/key live  : sudah
Mic A/B fader live          : sudah
Mic compressor live         : sudah
Top Music/Mic/Effect live   : sudah
Effect init/top live        : sudah
```

Masih belum dikunci untuk live write:

```text
Mic noise gate
Mic HPF/LPF
Music/System startup limit tertentu
Reverb internal detail: decay/predelay/filter
Echo internal detail: repeat/delay/filter
Main/Surround/Center crossover HPF/LPF
Sub HPF/LPF via dedicated filter command
Permanent save / preset slot recall
```
