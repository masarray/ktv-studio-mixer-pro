# K500 Live Alpha — Device Connection Test

This build adds a first **live device control** path for KTV K500 through Windows Bluetooth serial / RFCOMM.

## What is implemented

Transport:

- Browser Web Serial API
- K500 Bluetooth COM port, e.g. `Standard Serial over Bluetooth link (COM18/COM19)`
- 115200 baud, 8N1

Protocol:

- TX frame: `AA LL CMD PAYLOAD CS`
- RX frame: `55 ... CS`
- two's-complement checksum
- handshake `CMD 0x3F`
- heartbeat/status `CMD 0x1C`
- EQ live write `CMD 0x03`
- mute `CMD 0x15`
- output block write `CMD 0x0E`
- Mic EQ Link `CMD 0x3C`

Live edit support in this alpha:

- Parametric EQ live write for: Mic A, Mic B, Music, Main, Surround, Center, Subwoofer, Reverb, Echo
- EQ frequency, Q, gain, type P/LS/HS
- Master strip top Music / Mic / Effect, experimental block commands
- Output mixer block write: Main / Surround / Center / Sub
- Main output compressor fields through output block
- Mute ON/OFF

Not enabled yet:

- Permanent save to device
- Full preset upload/store
- Recall preset slot
- USB HID transport
- Reverb/Echo detailed live parameter writes
- Crossover live writes

## How to test

1. Pair the K500 Bluetooth device in Windows first.
2. Close the original K500 PC software so it does not hold the COM port.
3. Run this app on localhost:

```bash
npm install
npm run dev
```

4. Open in Chrome or Edge. Web Serial works only in a secure context; localhost is allowed.
5. Click **Connect** in the `Live Alpha` top bar.
6. Choose the K500 Bluetooth COM port, usually `Standard Serial over Bluetooth link` / COM18 or COM19.
7. Wait for `READY` / serial RX activity.
8. Load/import a `.k500` preset matching the device state as closely as possible.
9. Turn **LIVE ON**.
10. Test safely:
   - Press **Ping** first.
   - Try EQ B1 gain on Music or Main.
   - Try Mute ON/OFF.
   - Try Main output L/R volume.

## Safety rule

This alpha is designed for RAM/current-state live edits only. It does **not** implement permanent save/store, so avoid using it for production setting changes until protocol validation is complete.

If a command behaves unexpectedly, turn **LIVE OFF** or **Disconnect** immediately, then reconnect with the original K500 software.

## Known implementation strategy

Output mixer and compressor commands are sent as full output blocks:

```text
AA 25 0E SS D0 D1 ... D34 CS
```

The app patches known fields and preserves unknown bytes from the loaded preset file. For best results, import a preset that matches the current device setting before enabling live edit.
