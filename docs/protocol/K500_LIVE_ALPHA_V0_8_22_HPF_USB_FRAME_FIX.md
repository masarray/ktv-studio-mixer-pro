# K500 Live Alpha v0.8.22 — HPF USB Frame Fix

## Root cause

The v0.8.20/v0.8.21 crossover builder accidentally emitted an invalid BT frame:

```text
AA 11 [02=HPF] [section] [freq LE] 04 CS
```

The USB bridge/HID layer treats byte 1 as the BT body length. Therefore `0x11` was converted into a USB length field and produced the broken appclone sniff pattern:

```text
AA 11 00 02 02 14 00 04 D3 00 ...
```

That is not a valid native HPF write. The old BT checksum becomes part of the USB payload and the new checksum becomes `00`, so the device can parse a corrupted command and disturb live audio state.

## Native app evidence

The current native HPF sniff uses compact CMD `0x11` with USB length `0x06`:

```text
AA 06 00 11 02 02 14 00 09 C8   # Music HPF 20 Hz, mode/slot 09
AA 06 00 11 02 02 D0 07 09 05   # Music HPF 2000 Hz, mode/slot 09
AA 06 00 11 02 02 20 4E 09 6E   # Music HPF 20000 Hz, mode/slot 09
```

Older Music HPF/LPF sniffs used the same layout but mode/slot byte `0x04`. This last byte must follow the active equipment mode / preset slot (`preset.system.deviceModeIndex`), not a hardcoded filter type constant.

## Fixed builder

BT frame:

```text
AA 06 11 [02=HPF|03=LPF] [section] [freq u16 LE] [mode] CS
```

USB HID frame after bridge conversion:

```text
AA 06 00 11 [02=HPF|03=LPF] [section] [freq u16 LE] [mode] CS
```

Music HPF UI range is also corrected from `20..2000 Hz` to `20..20000 Hz`, and the EQ graph HP handle clamp now allows the same range.
