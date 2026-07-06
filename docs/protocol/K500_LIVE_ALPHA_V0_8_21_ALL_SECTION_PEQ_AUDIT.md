# K500 Live Alpha v0.8.21 — All Section PEQ Live Audit

## Scope

Mas Ari confirmed Music PEQ already works live on the real K500. This audit uses
that Music PEQ path as the golden runtime reference, then checks every visible
PEQ section against the native/capture evidence already stored in this repo.

## Result

The live PEQ command is the same for all visible PEQ pages:

```text
BT : AA 09 03 [section] [band0] [freq u16 LE] [Q×10] [type|sign] [|gain|×10] [tail] CS
USB: AA 09 00 03 [section] [band0] [freq u16 LE] [Q×10] [type|sign] [|gain|×10] [tail] CS
```

Runtime route:

```text
EqGraph / Band inputs
  → store.setBandValue() or store.setBandValues()
  → useK500Live.sendEqBand(eqKey, bandIndex, band)
  → buildEqWrite(eqKey, bandIndex, band)
  → queueEqBandWrite(), coalesced every 45 ms
  → enqueueWrite()
  → bridge / USB HID / Bluetooth SPP
```

## Verified visible section IDs

| Page | eqKey | Section byte | Tail byte | Evidence |
|---|---:|---:|---:|---|
| Mic A | `micA` | `0x00` | `0x00` | Native BT capture |
| Mic B | `micB` | `0x01` | `0x00` | Native BT capture |
| Music | `music` | `0x02` | `0x60` | Native Music PEQ capture and real-device retest |
| Main | `main` | `0x03` | `0x00` | Native BT capture |
| Surround | `surround` | `0x05` | `0x00` | Native BT capture |
| Center | `center` | `0x07` | `0x00` | Native BT capture |
| Sub | `sub` | `0x08` | `0x00` | Native BT capture |
| Reverb | `reverb` | `0x09` | `0x00` | Native BT capture |
| Echo | `echo` | `0x0A` | `0x00` | Native BT capture |

## Byte replay audit

`buildEqWrite()` was replayed against the section examples in
`docs/protocol/appendix/k500_bt_section_eq_summary.csv`.

Result: **13/13 examples byte-identical**, including checksum.

Representative frames:

```text
Mic A B1    : AA 09 03 00 00 C4 09 13 90 50 00 34
Mic B B1    : AA 09 03 01 00 C4 09 13 90 46 00 3D
Main B1     : AA 09 03 03 00 50 00 06 10 C8 00 C3
Surround B1 : AA 09 03 05 00 8F 00 05 10 3C 00 0F
Center B1   : AA 09 03 07 00 91 00 07 10 46 00 FF
Sub B1      : AA 09 03 08 00 35 00 0A 00 0A 00 A3
Reverb B1   : AA 09 03 09 00 B0 04 1B 80 6E 00 2E
Echo B1     : AA 09 03 0A 00 9E 04 04 00 3C 00 08
```

USB HID uses the same body with a 16-bit length field, for example Main B1:

```text
AA 09 00 03 03 00 50 00 06 10 C8 00 C3
```

## Code change in v0.8.21

The core PEQ builder was already correct. The only runtime safety improvement
added here is Mic EQ Link mirroring:

- If `mic.eqLink` is ON, editing Mic A or Mic B now mirrors the edited band in
  the editor model and sends both verified live frames (`0x00` and `0x01`).
- This prevents the UI/model from leaving one mic bank stale and avoids relying
  on undocumented device-side mirroring.
- If `mic.eqLink` is OFF, Mic A and Mic B remain independent.

## Expected live log during testing

For each PEQ movement outside Music, the log should show:

```text
TX EQ main B1 ...
RX RSP 0xFD · WRITE-ACK
```

Replace `main` with the edited section key.

If TX appears but the sound does not change, the issue is likely one of:

1. The tested signal is not routed through that bus/effect path.
2. The physical output/source path is not active.
3. The section has a different hidden active bank than the visible bank.

If TX does not appear at all, check:

1. `LIVE ON` after connect/sync.
2. Correct page/section is selected.
3. The log is not saying `file-only` for an alternate bank.

## Remaining limitation

Alternate hidden banks (`mainAlt`, `surroundAlt`, `centerAlt`, `subAlt`) are not
shown in the current UI and still remain file-only because no native live command
has been captured for section IDs `0x04`/`0x06`/unknown alternates.
