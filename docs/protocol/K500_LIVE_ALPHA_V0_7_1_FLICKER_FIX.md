# K500 Live Alpha v0.7.1 — Bluetooth Flicker Fix

## Symptom

When the browser app connected to the K500 through Bluetooth Serial / RFCOMM, the hardware connection indicator could flicker every few seconds, as if it briefly disconnected and reconnected.

## Most likely cause

v0.7 opened the serial port and immediately sent:

- handshake `AA 01 3F C0`
- heartbeat `AA 01 1C E3`
- periodic heartbeat every 5 seconds

Although this is useful for protocol testing, it is too aggressive for the first live test. The original application appears to manage the BT session with a broader read/connection state sequence. Sending a repeated bare poll from the browser can make the K500 front-panel indicator blink.

## v0.7.1 change

The app now opens the serial port in **passive mode**:

- no automatic handshake on connect
- no automatic heartbeat on connect
- no periodic heartbeat timer
- `Ping` remains manual only
- live edit commands are sent only after `LIVE ON`

## Recommended first test

1. Pair K500 Bluetooth in Windows.
2. Close the original Professional Audio System application.
3. Open K500 Preset Studio in Chrome/Edge.
4. Click Connect and choose the K500 Bluetooth COM port.
5. Wait 20 seconds.
6. Confirm the K500 hardware indicator does not flicker.
7. Click Ping once and check whether RX appears in the log.
8. Load/import the matching preset.
9. Enable LIVE ON and test a small EQ gain change.

## Safety

Permanent store/save/upload is still disabled.
