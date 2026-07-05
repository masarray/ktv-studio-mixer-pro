# K500 Live Alpha v0.8.6 — Smart Connect Restore

## Problem

After the documented live mapping patch, the Connect flow still obeyed the selected transport too strictly:

- If the stored mode was `bt`, Connect entered the Web Serial chooser immediately when no remembered BT port was available.
- USB HID remembered devices were not tried before that BT chooser.
- The UX therefore felt like it regressed from the native app: the user had to choose from a noisy Chrome serial-port list.

## Important browser limitation

A browser app cannot silently select a first-time Bluetooth SPP serial port by name. Chrome/Edge require `navigator.serial.requestPort()` to show a chooser at least once. The app can only become zero-dialog after the user grants the port once; then `navigator.serial.getPorts()` can return it for automatic probing.

USB HID is better because the chooser can be filtered to the K500 identity:

- VID `0x10C4`
- PID `0x0321`
- Product observed as `USB HID DSP AUDIO`

A packaged native Electron build can eventually do a fuller native-style scan with Node serial/HID libraries, but the browser build must respect Web Serial/WebHID permissions.

## Changes

### 1. Split auto-scan from permission chooser

`connectBluetooth()` and `connectUsbHid()` now accept `allowChooser`.

- `allowChooser = false`: scan only already-granted devices; never opens a browser dialog.
- `allowChooser = true`: after auto-scan fails, open the required one-time permission chooser.

### 2. Smart Connect tries both transports first

Clicking **Connect** now does this:

1. Close any stale transport.
2. Scan remembered devices for the preferred transport.
3. Scan remembered devices for the other transport.
4. If a K500 heartbeat response is found, connect immediately with no chooser.
5. Only if nothing remembered works, ask one-time permission for the preferred transport, then fallback to the other supported transport if needed.

The app identifies the device by the same protocol signature as before:

- TX heartbeat `0x1C`
- RX response `0xE3`

### 3. Successful transport becomes the new remembered preference

If Smart Connect finds USB while the UI was set to BT, the UI/store switches to USB after connection and saves that preference. Same for BT.

## Files changed

- `src/features/k500/live/liveStore.ts`
- `src/components/studio/LiveDevicePanel.tsx`
- `docs/protocol/K500_LIVE_ALPHA_V0_8_6_SMART_CONNECT_RESTORE.md`

## Non-regression promise

This patch does not change:

- USB HID framing
- heartbeat frame contents
- USB direct heartbeat path
- BT serial framing
- sync/readback sequence
- documented live parameter mapping
- EQ throttling
- block-write coalescing

## Expected behavior

### If K500 BT/USB was already granted once

Click **Connect** → app scans remembered BT + USB → connects automatically without Chrome chooser.

### If BT has never been granted

Chrome must show the serial-port chooser once. Pick the `KTV_BT...` entry. Later Connect clicks should be automatic.

### If USB HID has never been granted

Chrome should show a filtered WebHID chooser for the K500 USB HID identity. Later Connect clicks should be automatic.
