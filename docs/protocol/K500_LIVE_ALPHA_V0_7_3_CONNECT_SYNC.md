# K500 Live Alpha v0.7.3 — Connect Sync

## Why v0.7.3 exists

v0.7.1 made the COM connection passive to reduce flicker, but that was the wrong workflow for the real device. The original PC software shows the device as connected and immediately reads active values after connecting.

The correct direction is:

```text
Connect
→ handshake
→ read active memory map
→ convert live device memory to editor preset model
→ show EQ and all current parameters without requiring manual preset load
```

## Implemented behavior

On Connect, the app now:

1. Opens the selected Bluetooth serial COM port at `115200 8N1`.
2. Sends handshake `0x3F` and waits for response `0xC0`.
3. Reads active memory using command `0x40`:
   - blocks of `0x3A` bytes
   - address range `0x0000..0x03AA`
   - response code `0xBF`
4. Reconstructs the editor state from the live memory map.
5. Loads the editor UI with source name `K500 DEVICE LIVE`.

## Important protocol detail

The active device memory is not identical to the `.k500` file:

- scalar fields mostly map to `.k500 offset + 0x08`
- live EQ bands are compact 5-byte records:
  - frequency uint16 LE
  - Q x10 uint8
  - type/sign uint8
  - gain magnitude x10 uint8

The app converts this live format into the normal `.k500` editor model.

## Safety

- No periodic heartbeat is used.
- No permanent save/store/upload is enabled.
- Live edit is still user-controlled by `LIVE ON`.
