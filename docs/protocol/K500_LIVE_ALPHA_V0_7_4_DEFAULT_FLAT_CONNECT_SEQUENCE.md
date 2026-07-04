# K500 Live Alpha v0.7.4 — Default Flat + Original Connect Sequence

## UX correction

The app no longer opens with the empty "Wake the console / Load demo" screen.

On startup, it loads a `DEFAULT FLAT` editor state automatically so the user immediately sees:

- PEQ graph
- band nodes
- input mixer
- dynamics
- filters
- master section

This default state is only a UI starting point. It is replaced by real device values after Connect.

## Connect sequence correction

Based on the latest Device Monitoring Studio capture from the original PC application, Connect now follows this sequence:

1. Open Bluetooth COM at `115200 8N1`.
2. Send status/heartbeat:
   - `AA 01 1C E3`
   - wait for response `0xE3`
3. Send handshake:
   - `AA 01 3F C0`
   - wait for response `0xC0`
4. Read active memory blocks using command `0x40`:
   - body format: `06 40 OFFSET_LO OFFSET_HI LEN_LO LEN_HI 63`
   - block size: `0x3A`
   - range: `0x0000..0x03AA`
   - wait for response `0xBF`
5. Convert live memory map into the editor preset model.
6. Start normal heartbeat every ~3.2 s.

## Important fix

Earlier builds used read-block tail byte `0x00`. The original app uses `0x63`.

Example:

```text
AA 06 40 00 00 3A 00 63 1D
```

## Safety

Permanent save/store/upload remains disabled.
