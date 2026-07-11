# K500 Live v0.8.24 — Native LPF selectors, free overlap, draggable filter lines

## Native sniff finding

CMD `0x11` does **not** use the PEQ section id for non-Music filters. The first
payload byte after `0x11` is a dedicated section+filter selector, and the next
byte is the filter-type code.

Verified USB frames:

| Section | LPF selector | Type byte in capture | Final byte |
|---|---:|---:|---:|
| Music | `0x03` | `0x02` | active Music slot (`0x04`/`0x09` captured) |
| Main | `0x05` | `0x02` | `0x00` |
| Surround | `0x09` | `0x01` | `0x00` |
| Center | `0x0D` | `0x02` | `0x00` |
| Subwoofer | `0x0F` | `0x06` | `0x00` |

USB layout:

```text
AA 06 00 11 [section+kind selector] [filter type] [frequency u16 LE] [tail] CS
```

The paired HPF selectors are the adjacent even values:

```text
Music 02/03 · Main 04/05 · Surround 08/09 · Center 0C/0D · Sub 0E/0F
```

The filter-type byte is taken from the active crossover type rather than from
the PEQ section id:

```text
01 Bessel 12 · 02 Butterworth 12 · 06 Butterworth 24 · 07 LR24
```

## Bugs fixed

1. Main/Surround/Center/Sub LPF previously sent PEQ section ids as the filter
   type byte, producing invalid native commands.
2. The final Music slot byte was incorrectly reused for output filters; native
   output captures require `0x00`.
3. Graph drag enforced `HPF < LPF` with a 10 Hz gap. Native parameters are
   independent, so HPF and LPF may cross and overlap.
4. Only the yellow puck accepted pointer drag. The full vertical HP/LP line now
   has a wide invisible hit target.
5. Sub/Mic/Reverb/Echo duplicated filter fields are mirrored so graph, controls,
   live command, and preset export cannot drift apart.
6. The separate `LIVE ON/OFF` text button was merged into one compact clickable
   `LIVE` LED indicator. User-facing `Live Alpha` text was removed.

## Verification

- Main/Surround/Center/Sub native LPF sniffs: **72/72 frames byte-identical**.
- Existing Music HPF/LPF sniffs: **65/65 frames byte-identical**.
- Production build: passed.
