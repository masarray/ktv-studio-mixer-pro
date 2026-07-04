# K500 Bluetooth COM18 — EQ/Mute Action Analysis

## Kesimpulan singkat

Log baru berhasil dibaca. Jalur protokol tetap konsisten:

- PC → K500: `AA LL CMD ... CS`
- K500 → PC: `55 LEN_LO LEN_HI RSP ... CS`
- Checksum: jumlah byte setelah header sampai checksum = `0x00` modulo 256.
- ACK response cocok dengan pola `RSP = 0xFF - CMD`.

## Frame aksi penting

| Aksi | Frame PC → K500 | Decode awal |
|---|---|---|
| Music EQ B2 gain menuju -1.0 dB | `AA 09 03 02 01 75 00 14 80 0A 60 7E` | `CMD 03`, band index `01`, freq `0x0075=117 Hz`, Q `0x14=2.0`, gain negative `0x80`, magnitude `0x0A=1.0 dB` |
| Music EQ B1 freq 12000 Hz | `AA 09 03 02 00 E0 2E 14 80 3C 60 B4` | band index `00`, freq `0x2EE0=12000 Hz`, Q `2.0`, gain `-6.0 dB` |
| Music EQ B1 Q 1.9 | `AA 09 03 02 00 E0 2E 13 80 3C 60 B5` | Q byte `0x13=19`, berarti `Q = raw / 10` |
| Music EQ B1 type LS | `AA 09 03 02 00 E0 2E 13 90 3C 60 A5` | byte gain/type berubah `0x80 → 0x90`, artinya type LS + negative gain |
| Mute | `AA 03 15 01 00 E7` | `CMD 15`, payload `01 00`; kemungkinan mute ON |

## Format sementara Music EQ write

```text
AA 09 03 SS BI FF FF QQ TG GG TT CS
```

Field sementara:

- `AA` = header PC → device
- `09` = panjang body, termasuk CMD
- `03` = command Music EQ write
- `SS` = section/source, untuk Music EQ terlihat `02`
- `BI` = band index zero-based: B1=`00`, B2=`01`
- `FF FF` = frequency little-endian
- `QQ` = Q x10
- `TG` = type/sign byte
- `GG` = gain magnitude x10
- `TT` = target/bank flag, untuk Music terlihat `60`
- `CS` = checksum

## Type/sign byte sementara

Dari capture:

- `0x80` = Parametric/P + gain negatif
- `0x90` = Low Shelf/LS + gain negatif

Dugaan lanjutan yang perlu divalidasi:

- `0x00` = Parametric/P + gain positif
- `0x10` = Low Shelf/LS + gain positif
- `0x20` = High Shelf/HS + gain positif
- `0xA0` = High Shelf/HS + gain negatif

## ACK yang terlihat

- CMD `0x03` dibalas `0xFC`
- CMD `0x15` dibalas `0xEA`
- CMD `0x1C` dibalas `0xE3`

Pola:

```text
ACK = 0xFF - CMD
```

## Langkah berikut yang paling berguna

Untuk mengunci type/sign byte, capture:
1. Music EQ B1 gain dari `-6.0` ke `+1.0`
2. Music EQ B1 type `LS → HS`
3. Music EQ B1 type `HS → P`
4. Mute OFF kalau capture tadi adalah Mute ON
