# K500 BT COM18 Action Capture Analysis

## Ringkasan

Semua file aksi terbaca. Frame tetap memakai pola `AA ... checksum` untuk PC → K500 dan `55 ... checksum` untuk ACK/status dari K500. Checksum valid: jumlah byte setelah header sampai checksum = `0x00` modulo 256.

## Command yang ditemukan

| Capture | Aksi | TX frame penting | Decode awal | ACK |
|---|---|---|---|---|
| `01_MUSIC_VOL_25_TO_26` | Music volume 25→26 | `aa 0d 02 1a 19 54 02 09 09 09 08 08 07 15 00 21` | CMD `0x02` Music block; byte pertama payload = `0x1A` (26) | expected `0xFD` |
| `02_MIC_VOL_25_TO_26` | Mic volume 25→26 | `aa 0e 05 1a 19 54 0b 00 00 60 60 26 03 0a 02 00 66` | CMD `0x05` Mic block; byte pertama payload = `0x1A` (26) | expected `0xFA` |
| `03_EFFECT_VOL_25_TO_26` | Effect volume 25→26 | `aa 03 09 1a 19 c1` | CMD `0x09` Effect/top-FX block; payload `1A 19` | expected `0xF6` |
| `04_MUSIC_EQ_B1_GAIN_-7_TO_-6` | Music EQ B1 gain sweep | `aa 09 03 02 00 c8 32 14 80 45 60 bf` | CMD `0x03` Music EQ band; freq=13000 Hz, Q=2.0, gain raw sign=0x80, mag=69 ≈ -6.9 dB | expected `0xFC` |
| `04_MUSIC_EQ_B1_GAIN_-7_TO_-6` | Music EQ B1 gain sweep | `aa 09 03 02 00 c8 32 14 80 44 60 c0` | CMD `0x03` Music EQ band; freq=13000 Hz, Q=2.0, gain raw sign=0x80, mag=68 ≈ -6.8 dB | expected `0xFC` |
| `04_MUSIC_EQ_B1_GAIN_-7_TO_-6` | Music EQ B1 gain sweep | `aa 09 03 02 00 c8 32 14 80 43 60 c1` | CMD `0x03` Music EQ band; freq=13000 Hz, Q=2.0, gain raw sign=0x80, mag=67 ≈ -6.7 dB | expected `0xFC` |
| `04_MUSIC_EQ_B1_GAIN_-7_TO_-6` | Music EQ B1 gain sweep | `aa 09 03 02 00 c8 32 14 80 42 60 c2` | CMD `0x03` Music EQ band; freq=13000 Hz, Q=2.0, gain raw sign=0x80, mag=66 ≈ -6.6 dB | expected `0xFC` |
| `04_MUSIC_EQ_B1_GAIN_-7_TO_-6` | Music EQ B1 gain sweep | `aa 09 03 02 00 c8 32 14 80 41 60 c3` | CMD `0x03` Music EQ band; freq=13000 Hz, Q=2.0, gain raw sign=0x80, mag=65 ≈ -6.5 dB | expected `0xFC` |
| `04_MUSIC_EQ_B1_GAIN_-7_TO_-6` | Music EQ B1 gain sweep | `aa 09 03 02 00 c8 32 14 80 40 60 c4` | CMD `0x03` Music EQ band; freq=13000 Hz, Q=2.0, gain raw sign=0x80, mag=64 ≈ -6.4 dB | expected `0xFC` |
| `04_MUSIC_EQ_B1_GAIN_-7_TO_-6` | Music EQ B1 gain sweep | `aa 09 03 02 00 c8 32 14 80 3f 60 c5` | CMD `0x03` Music EQ band; freq=13000 Hz, Q=2.0, gain raw sign=0x80, mag=63 ≈ -6.3 dB | expected `0xFC` |
| `04_MUSIC_EQ_B1_GAIN_-7_TO_-6` | Music EQ B1 gain sweep | `aa 09 03 02 00 c8 32 14 80 3e 60 c6` | CMD `0x03` Music EQ band; freq=13000 Hz, Q=2.0, gain raw sign=0x80, mag=62 ≈ -6.2 dB | expected `0xFC` |
| `04_MUSIC_EQ_B1_GAIN_-7_TO_-6` | Music EQ B1 gain sweep | `aa 09 03 02 00 c8 32 14 80 3d 60 c7` | CMD `0x03` Music EQ band; freq=13000 Hz, Q=2.0, gain raw sign=0x80, mag=61 ≈ -6.1 dB | expected `0xFC` |
| `04_MUSIC_EQ_B1_GAIN_-7_TO_-6` | Music EQ B1 gain sweep | `aa 09 03 02 00 c8 32 14 80 3c 60 c8` | CMD `0x03` Music EQ band; freq=13000 Hz, Q=2.0, gain raw sign=0x80, mag=60 ≈ -6.0 dB | expected `0xFC` |

## Pola protocol

TX frame: `AA LL CMD payload... CS`. `CS = (-sum(LL..payload)) & 0xFF`. ACK dari device memakai command code komplemen: response byte umumnya `0xFF - CMD`.

Contoh: `AA 03 09 1A 19 C1` untuk Effect menghasilkan ACK response code `0xF6`, karena `0xFF - 0x09 = 0xF6`.

## Temuan mapping awal

- `0x1C` = heartbeat/status poll. Frame: `AA 01 1C E3`.
- `0x02` = Music block. Saat Music volume 25→26, frame action: `AA 0D 02 1A ...`.
- `0x05` = Mic block. Saat Mic volume 25→26, frame action: `AA 0E 05 1A ...`.
- `0x09` = Effect/top-FX block. Saat Effect volume 25→26, frame action: `AA 03 09 1A 19 C1`.
- `0x03` = Music EQ band write. Saat Music EQ B1 gain diubah, software mengirim 10 frame berturut dari raw magnitude `0x45` sampai `0x3C`, cocok dengan perubahan bertahap -6.9 dB sampai -6.0 dB.

## Format Music EQ live band sementara

Frame contoh akhir gain -6.0 dB:

`AA 09 03 02 00 C8 32 14 80 3C 60 C8`


Payload 8 byte setelah `CMD 03` dibaca sementara sebagai:


| Byte | Nilai | Dugaan |
|---|---:|---|
| 0 | `02` | tipe band / P |
| 1 | `00` | flag/index/unused |
| 2-3 | `C8 32` | freq little-endian = 13000 Hz |
| 4 | `14` | Q x10 = 2.0 |
| 5 | `80` | sign negatif untuk gain |
| 6 | `3C` | gain magnitude x10 = 60 → -6.0 dB |
| 7 | `60` | kemungkinan target/page/band bank flag; perlu capture band lain untuk mengunci |


## Capture lanjutan yang disarankan

Untuk mengunci format EQ dan target band/channel, capture pendek berikut: Music EQ B2 gain -1.7→-1.0, Music EQ B1 frequency 13000→12000, Music EQ B1 Q 2.0→1.9, dan pindah Type P→LS→HS. Untuk output/mic, capture satu parameter serupa agar command family-nya terpetakan.