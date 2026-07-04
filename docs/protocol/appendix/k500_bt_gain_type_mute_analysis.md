# K500 Bluetooth COM18 — Gain/Type/Mute Analysis
## Confirmed command patterns
- PC → device frame: `AA LL CMD PAYLOAD... CS`
- Checksum: `sum(LL + CMD + payload + CS) & 0xFF == 0`
- Device response: `55 LEN_LO LEN_HI ACK DATA... CS`
- ACK pattern: `ACK = 0xFF - CMD` (`0x03→0xFC`, `0x15→0xEA`, `0x1C→0xE3`).

## Music EQ write frame
`AA 09 03 SS BI FL FH QQ TG GG TT CS`

| Byte | Meaning | Confirmed value/example |
|---|---|---|
| `09` | body length | fixed for Music EQ write |
| `03` | command | EQ write |
| `SS` | section/source | `02` = Music EQ |
| `BI` | band index | zero-based, B1=`00`, B2=`01` |
| `FL FH` | frequency | uint16 little-endian, `E0 2E` = 12000 Hz |
| `QQ` | Q | Q×10, `13` = 1.9 |
| `TG` | type + sign | type nibble + sign bit |
| `GG` | gain magnitude | dB×10, `0A` = 1.0 dB |
| `TT` | target/bank | `60` for Music EQ in these captures |

## Confirmed TG byte
| Type | Positive | Negative |
|---|---:|---:|
| P | `00` | `80` |
| LS | `10` | `90` |
| HS | `20` | `A0` (inferred; validate with negative HS) |

## Key frames
- `AA 09 03 02 00 E0 2E 13 90 3B 60 A6` → Music EQ write: section=0x02, B1, LS, 12000Hz, Q 1.9, gain -5.9dB, target=0x60
- `AA 09 03 02 00 E0 2E 13 90 01 60 E0` → Music EQ write: section=0x02, B1, LS, 12000Hz, Q 1.9, gain -0.1dB, target=0x60
- `AA 09 03 02 00 E0 2E 13 10 00 60 61` → Music EQ write: section=0x02, B1, LS, 12000Hz, Q 1.9, gain +0.0dB, target=0x60
- `AA 09 03 02 00 E0 2E 13 10 0A 60 57` → Music EQ write: section=0x02, B1, LS, 12000Hz, Q 1.9, gain +1.0dB, target=0x60
- `AA 09 03 02 00 E0 2E 13 00 0A 60 67` → Music EQ write: section=0x02, B1, P, 12000Hz, Q 1.9, gain +1.0dB, target=0x60
- `AA 09 03 02 00 E0 2E 13 20 0A 60 47` → Music EQ write: section=0x02, B1, HS, 12000Hz, Q 1.9, gain +1.0dB, target=0x60
- `AA 03 15 00 00 E8` → Mute write: OFF, flag2=0x00

## Implementation formula
```js
function checksum(body) {
  return (-body.reduce((s, b) => (s + b) & 0xff, 0)) & 0xff;
}

function buildFrame(cmd, payload) {
  const body = [payload.length + 1, cmd, ...payload];
  return Uint8Array.from([0xaa, ...body, checksum(body)]);
}

function musicEqTypeGainByte(type, gainDb) {
  const typeNibble = { P: 0x00, LS: 0x10, HS: 0x20 }[type] ?? 0x00;
  const signBit = gainDb < 0 ? 0x80 : 0x00;
  return typeNibble | signBit;
}
```
