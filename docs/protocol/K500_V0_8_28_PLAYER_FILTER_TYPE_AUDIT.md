# K500 v0.8.28 — Native Player and HPF/LPF Type Audit

Date: 11 July 2026

## Native player transport

The supplied USBPcap exports contain these outbound HID frames:

| Action | Native USB frame |
|---|---|
| Rewind / previous | `AA 03 00 06 00 05 F2` |
| Forward / next | `AA 03 00 06 01 05 F1` |
| Play / pause toggle | `AA 03 00 06 02 05 F0` |

Play and pause are not separate commands. Two clicks in the supplied capture emit the same `... 06 02 05 ...` frame twice.

Shared command body:

```text
BT : AA 03 06 [00 rewind / 01 forward / 02 play-pause] 05 CS
USB: AA 03 00 06 [00 rewind / 01 forward / 02 play-pause] 05 CS
```

## Native crossover type codes

The byte following the HPF/LPF selector is the filter-type code:

| Code | Filter |
|---:|---|
| `01` | Bessel 12 dB/oct |
| `02` | Butterworth 12 dB/oct |
| `03` | Bessel 18 dB/oct |
| `04` | Butterworth 18 dB/oct |
| `05` | Bessel 24 dB/oct |
| `06` | Butterworth 24 dB/oct |
| `07` | Linkwitz–Riley 24 dB/oct |

Verified examples from the supplied Music captures:

```text
HP Bessel 24 : AA 06 00 11 02 05 2E 00 32 82
HP Bessel 12 : AA 06 00 11 02 01 2E 00 32 86
LP LR 24     : AA 06 00 11 03 07 20 4E 32 3F
LP Butter 24 : AA 06 00 11 03 06 20 4E 32 40
LP Bessel 24 : AA 06 00 11 03 05 20 4E 32 41
LP Butter 18 : AA 06 00 11 03 04 20 4E 32 42
LP Bessel 18 : AA 06 00 11 03 03 20 4E 32 43
LP Butter 12 : AA 06 00 11 03 02 20 4E 32 44
LP Bessel 12 : AA 06 00 11 03 01 20 4E 32 45
```

The final Music payload byte is state-dependent, not a preset-slot index. Native captures from different device states contain `04`, `09`, and `32`. The live implementation now mirrors the current device Music-state byte from readback instead of deriving it from Equipment Mode. Output/FX/Mic crossover captures continue to use `00` in that position.

## Graph response model

The visual crossover curve is recalculated immediately when type changes:

- Butterworth: orders 2/3/4 for 12/18/24 dB per octave.
- Bessel: reverse-Bessel orders 2/3/4, frequency-normalized to the -3 dB cutoff.
- Linkwitz–Riley 24: two cascaded Butterworth second-order sections, -6 dB at crossover.

This visual model is for editor feedback. The device remains the authoritative DSP implementation.

## Validation

- Native player command replay: `3/3` frames byte-identical.
- Native HPF/LPF type replay: `9/9` supplied frames byte-identical when using the captured Music state byte `0x32`.
- TypeScript check: passed.
- Client and SSR production build: passed.
