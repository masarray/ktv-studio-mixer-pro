# K500 Live Alpha v0.8.0 — USB HID Smart Connect (verified dari sniff)

## Identitas device USB
Sniff `USB_Connect` (04.07.2026) mengonfirmasi K500 via USB = "USB HID DSP AUDIO":
`VID 0x10C4, PID 0x0321`, interrupt report IN/OUT 64 byte, report id 0.

## Framing USB (beda dari BT hanya di TX)
- TX: `AA <len u16 LE> <body> <cs>` — length 16-bit. BT memakai length 8-bit.
  Heartbeat USB: `AA 01 00 1C E3`. Checksum rule sama (two's complement atas
  semua byte setelah 0xAA).
- Read block 0x40: mode byte `0x00` di USB (BT: `0x63`).
  Contoh: `AA 06 00 40 00 00 3A 00 00 80`.
- RX: identik dengan BT (`55 len16 rsp .. cs`) → parser bersama dipakai apa adanya.
- Payload frame di offset 0 report, zero-padded ke 64 byte, TANPA report ID.

Implementasi `toUsbFrame()` mengonversi builder BT existing ke framing USB;
diverifikasi byte-per-byte terhadap SEMUA frame TX di sniff (6/6 match,
termasuk kasus checksum 0x00 pada read offset 0x027E).

## Smart engine USB
1. `hid.getDevices()` → device granted diurutkan: VID/PID K500 dulu → probe
   heartbeat → connect tanpa dialog.
2. Pertama kali: `hid.requestDevice` DIFILTER `{vendorId:0x10C4, productId:0x0321}`
   sehingga chooser hanya menampilkan DSP AUDIO — tidak ada kebingungan memilih.
3. Identitas final tetap diverifikasi via protokol (heartbeat → 0xE3), sama
   seperti mode BT.
4. Pesan error spesifik bila device dipegang aplikasi native (HID exclusive).

## Urutan connect USB (dari sniff — sama dengan BT)
heartbeat 0x1C → handshake 0x3F → 17× read 0x40 (0x0000..0x03AA) →
heartbeat loop. Disconnect tanpa command teardown.

## Catatan
Frame selain 0x1C/0x3F/0x40 (EQ write 0x41 dst.) belum pernah ter-sniff via
USB; diasumsikan mengikuti transformasi length-16-bit yang sama. Kalau live
edit via USB tidak bereaksi, kirim sniff USB saat menggeser EQ di app native.
