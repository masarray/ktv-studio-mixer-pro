# K500 Permanent Slot Store Audit — v0.8.26

Native USB captures audited:

- `EQIPMENT_SAVE_BUTTON_CLICK_MODE1`
- `EQIPMENT_SAVE_BUTTON_CLICK_MODE4`
- `MASS_UPLOAD_TO_DEVICE_10_PRESET_INIT_OFF`
- `MODE1_RECALL_INIT_ON`

## Slot image

Each device preset slot is a `0x0290` (656-byte) image. It is the first 656 bytes of the active device-memory representation used by CMD `0x40`, not a raw `.k500` file slice. Scalar fields use the verified split file delta; PEQ bands are compact 5-byte records.

## Permanent save sequence

1. CMD `0x41` begins one 656-byte slot image and carries its 8-bit two's-complement checksum.
2. CMD `0x42` writes ten 60-byte blocks and one final 56-byte block.
3. Every CMD `0x42` body ends with four reserved zero bytes.
4. CMD `0x43` commits the zero-based slot and repeats the first two bytes of the final block.
5. Single-slot Save returns `0xBD` for each block and `0xBC` for commit; its capture has no `0xBE` begin response. Mass Upload additionally returns `0xBE` after each CMD `0x41`.

The 60-byte CMD `0x42` USB frame is 73 bytes, therefore it is transmitted as two HID reports: 64 bytes followed by 9 bytes. The final 56-byte block is 69 bytes: 64 + 5.

## Mass upload

Native order is slot `10 → 1`. The next CMD `0x41` chains the preceding commit's two signature bytes and commit checksum. After slot 1, native behavior recalls slot 1, sends CMD `0x3F`, then refreshes active memory with CMD `0x40`.

## Verification

- Save Mode 1: 13/13 generated frames byte-identical.
- Save Mode 4: 13/13 generated frames byte-identical.
- Mass Upload, 10 presets: 130/130 generated frames byte-identical.
- All observed frame checksums validate to zero.

Permanent store is intentionally enabled only for a USB HID connection because the supplied native evidence is USB capture data.
