# K500 Bluetooth COM Reverse Engineering — Channel EQ Mapping Update

Date: 2026-07-03  
Source: Device Monitoring Studio captures from Professional Audio System via Bluetooth COM18.

## Key result

The captured files confirm that **all visible EQ pages use the same live EQ write command**:

```text
AA 09 03 SS BI FL FH QQ TG GG TT CS
```

Where:

| Byte | Meaning | Notes |
|---|---|---|
| `AA` | PC → K500 frame header | fixed |
| `09` | body length | command body from `CMD` through `TT` |
| `03` | EQ write command | same command for Mic, Music, Main, Surround, Center, Sub, Reverb, Echo |
| `SS` | section / channel id | see table below |
| `BI` | band index | zero-based; B1 = `00`, B2 = `01` |
| `FL FH` | frequency | uint16 little-endian |
| `QQ` | Q raw | `Q × 10` |
| `TG` | type + gain sign | see type/sign table |
| `GG` | gain magnitude | `abs(gain dB) × 10` |
| `TT` | target / bank flag | `00` for captured Mic/Output/FX pages; Music previously observed as `60` |
| `CS` | checksum | two's complement of `LL + CMD + payload`: `sum(frame[1:]) % 256 == 0` |

## Confirmed section id mapping

| Section ID | Section | Evidence |
|---:|---|---|
| `0x00` | Mic A EQ | Mic A B1 gain/freq/Q/type captures |
| `0x01` | Mic B EQ | Mic B B1 gain capture |
| `0x02` | Music EQ | earlier Music EQ captures |
| `0x03` | Main EQ | Main B1 gain capture |
| `0x05` | Surround EQ | Surround B1 gain capture |
| `0x07` | Center EQ | Center B1 gain capture |
| `0x08` | Subwoofer EQ | Sub B1 gain capture |
| `0x09` | Reverb EQ | Reverb B1 gain capture |
| `0x0A` | Echo EQ | Echo B1 gain capture |

Likely skipped IDs:
- `0x04` may be Main alternate bank.
- `0x06` may be Surround alternate bank.

This inference matches the earlier `.k500` binary map, where Main and Surround have alternate EQ banks before Center/Sub/FX. It still needs live capture verification.

## Type/sign byte

Confirmed:

| Type | Positive | Negative |
|---|---:|---:|
| P / bell | `0x00` | `0x80` |
| LS / low shelf | `0x10` | `0x90` |
| HS / high shelf | `0x20` | `0xA0` inferred from formula; positive `0x20` confirmed |

Formula:

```ts
const typeNibble = { P: 0x00, LS: 0x10, HS: 0x20 }[type];
const signBit = gainDb < 0 ? 0x80 : 0x00;
const typeSign = typeNibble | signBit;
const gainMagnitude = Math.round(Math.abs(gainDb) * 10);
```

## Decoded capture summary

| Capture | Section | Frame count | Decoded final command |
|---|---:|---:|---|
| `19_ECHO_EQ_B1_GAIN_5_TO_6(1)` | Echo (`0x0A`) | 10 | `AA 09 03 0A 00 9E 04 04 00 3C 00 08` → B1, 1182 Hz, Q 0.4, P, +6.0 dB, TT `0x00` |
| `18_REVERB_EQ_B1_GAIN_11.8_TO_11` | Reverb (`0x09`) | 8 | `AA 09 03 09 00 B0 04 1B 80 6E 00 2E` → B1, 1200 Hz, Q 2.7, P, -11.0 dB, TT `0x00` |
| `17_SUB_EQ_B1_GAIN_0_TO_1` | Subwoofer (`0x08`) | 10 | `AA 09 03 08 00 35 00 0A 00 0A 00 A3` → B1, 53 Hz, Q 1.0, P, +1.0 dB, TT `0x00` |
| `16_CENTER_EQ_B1_GAIN_6_TO_7` | Center (`0x07`) | 10 | `AA 09 03 07 00 91 00 07 10 46 00 FF` → B1, 145 Hz, Q 0.7, LS, +7.0 dB, TT `0x00` |
| `15_SURROUND_EQ_B1_GAIN_7_TO_6` | Surround (`0x05`) | 9 | `AA 09 03 05 00 8F 00 05 10 3C 00 0F` → B1, 143 Hz, Q 0.5, LS, +6.0 dB, TT `0x00` |
| `14_MAIN_EQ_B1_GAIN_21_TO_20` | Main (`0x03`) | 10 | `AA 09 03 03 00 50 00 06 10 C8 00 C3` → B1, 80 Hz, Q 0.6, LS, +20.0 dB, TT `0x00` |
| `13_MIC_B_EQ_B1_GAIN_-8.0_TO_-7.0` | Mic B (`0x01`) | 1 | `AA 09 03 01 00 C4 09 13 90 46 00 3D` → B1, 2500 Hz, Q 1.9, LS, -7.0 dB, TT `0x00` |
| `12_MIC_A_EQ_B1_GAIN_-7.0_TO_-8.0` | Mic A (`0x00`) | 1 | `AA 09 03 00 00 C4 09 13 90 50 00 34` → B1, 2500 Hz, Q 1.9, LS, -8.0 dB, TT `0x00` |
| `11_MIC_EQ_LINK_ON_TO_OFF` | `MIC_EQ_LINK?` | 1 | `AA 04 3C 00 00 C4 FC` payload `00 00 C4` |
| `10_MIC_LINK_ON_B1_GAIN_-8.0_TO_-7.0` | Mic A (`0x00`) | 1 | `AA 09 03 00 00 C4 09 13 90 46 00 3E` → B1, 2500 Hz, Q 1.9, LS, -7.0 dB, TT `0x00` |
| `MIC_A_EQ_B1_TYPE_P_TO_LS` | Mic A (`0x00`) | 1 | `AA 09 03 00 00 C4 09 13 90 46 00 3E` → B1, 2500 Hz, Q 1.9, LS, -7.0 dB, TT `0x00` |
| `MIC_A_EQ_B1_Q_2.0_TO_1.9` | Mic A (`0x00`) | 1 | `AA 09 03 00 00 C4 09 13 80 46 00 4E` → B1, 2500 Hz, Q 1.9, P, -7.0 dB, TT `0x00` |
| `MIC_A_EQ_B1_FREQ_2550_TO_2500` | Mic A (`0x00`) | 1 | `AA 09 03 00 00 C4 09 14 80 46 00 4D` → B1, 2500 Hz, Q 2.0, P, -7.0 dB, TT `0x00` |
| `MIC_A_EQ_B1_GAIN_-8.0_TO_-7.0` | Mic A (`0x00`) | 10 | `AA 09 03 00 00 F6 09 14 80 46 00 1B` → B1, 2550 Hz, Q 2.0, P, -7.0 dB, TT `0x00` |


## Mic EQ Link

Captured command:

```text
AA 04 3C 00 00 C4 FC
```

Current interpretation:

| Byte | Meaning |
|---|---|
| `AA` | PC → K500 |
| `04` | body length |
| `3C` | Mic EQ Link command |
| `00 00 C4` | payload observed for Link ON → OFF |
| `FC` | checksum |

Notes:
- This strongly indicates `CMD 0x3C` controls Mic EQ Link.
- OFF state payload appears to include `00`.
- Need one more capture for **Mic EQ Link OFF → ON** before finalizing the ON payload.
- When Mic EQ Link was ON and Mic A B1 was edited, the app still sent only `SS=0x00` once. This suggests the device may internally mirror Mic A to Mic B when link is enabled, rather than the PC app sending two EQ write commands.

## Important examples

### Mic A B1, P, 2550 Hz, Q 2.0, -7.0 dB

```text
AA 09 03 00 00 F6 09 14 80 46 00 1B
```

### Mic A B1, P → LS, 2500 Hz, Q 1.9, -7.0 dB

```text
AA 09 03 00 00 C4 09 13 90 46 00 3E
```

### Main B1, LS, 80 Hz, Q 0.6, +20.0 dB

```text
AA 09 03 03 00 50 00 06 10 C8 00 C3
```

### Subwoofer B1, P, 53 Hz, Q 1.0, +1.0 dB

```text
AA 09 03 08 00 35 00 0A 00 0A 00 A3
```

### Echo B1, P, 1182 Hz, Q 0.4, +6.0 dB

```text
AA 09 03 0A 00 9E 04 04 00 3C 00 08
```

## TypeScript builder

```ts
export type K500EqType = "P" | "LS" | "HS";

export interface K500EqWrite {
  sectionId: number;
  bandIndex: number;      // zero-based
  frequencyHz: number;
  q: number;
  type: K500EqType;
  gainDb: number;
  target?: number;        // use 0x00 for most sections; Music observed as 0x60
}

function checksumBody(bytes: number[]): number {
  const sum = bytes.reduce((acc, b) => (acc + (b & 0xff)) & 0xff, 0);
  return (-sum) & 0xff;
}

export function buildEqWriteFrame(input: K500EqWrite): Uint8Array {
  const typeNibble = input.type === "LS" ? 0x10 : input.type === "HS" ? 0x20 : 0x00;
  const signBit = input.gainDb < 0 ? 0x80 : 0x00;
  const typeSign = typeNibble | signBit;
  const freq = Math.max(20, Math.min(20000, Math.round(input.frequencyHz)));
  const qRaw = Math.max(1, Math.min(300, Math.round(input.q * 10)));
  const gainRaw = Math.max(0, Math.min(240, Math.round(Math.abs(input.gainDb) * 10)));
  const body = [
    0x09,
    0x03,
    input.sectionId & 0xff,
    input.bandIndex & 0xff,
    freq & 0xff,
    (freq >> 8) & 0xff,
    qRaw & 0xff,
    typeSign & 0xff,
    gainRaw & 0xff,
    input.target ?? 0x00,
  ];
  return Uint8Array.from([0xaa, ...body, checksumBody(body)]);
}
```

## Caveats

- Reverb capture name says `11.8_TO_11`, but the live byte `TG=0x80` means the captured value is **negative**. Treat that capture as `-11.8 → -11.0` unless confirmed otherwise from UI.
- `10_MIC_A_EQ_B1_GAIN_-6_TO_-5` produced no useful `AA` command and was ignored.
- Some captures have only a single final command rather than a full sweep. That is acceptable because the final command still locks the format.

## Next capture priorities

1. `MIC_EQ_LINK_OFF_TO_ON` — finalize payload for command `0x3C`.
2. `MUSIC_EQ_B1_TYPE_HS_NEGATIVE` or any HS with negative gain — validate inferred `0xA0`.
3. Output mixer captures:
   - Main L/R volume
   - Main mic/music/reverb/echo level
   - Center/Sub output volume
4. Compressor captures:
   - Main threshold / ratio / attack / release
   - Surround/Center/Sub threshold
5. Crossover/filters:
   - Mic HPF/LPF
   - Sub HPF/LPF
   - Main HPF/LPF
