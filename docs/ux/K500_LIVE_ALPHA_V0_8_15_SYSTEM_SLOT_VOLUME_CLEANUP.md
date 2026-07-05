# K500 Live Alpha v0.8.15 — System Slot + Volume Cleanup

## Scope

UI/workflow cleanup only. This patch does not touch:

- native bridge zero-popup connection
- BT/USB heartbeat
- USB HID framing
- sync/readback transport
- live mapping commands

## Fixes

### 1. Device Preset Slots

The System page Equipment / Device Mode list now reserves enough vertical space to show all 10 internal K500 mode slots without clipping slot 10.

The redundant text line `ACTIVE DEVICE SLOT · K500 DEVICE LIVE` was removed. Active state is shown only by the useful ACTIVE badge/row indicator.

### 2. PC Mode noise cleanup

PC Mode remains a PC-root `.k500` file view, but empty-state helper text was shortened to reduce visual noise.

### 3. Native System Volume Config travel

The System lower rack fader ranges now follow the native app travel points:

- Music Init Vol: 0–84
- Music Max Vol: 0–84
- Mic Init Vol: 0–84
- Mic Max Vol: 0–84
- Effect Init Level: 0–84
- UDisk Record Vol: 1–6
- USB Record Vol: 1–6
- Dance Mic Time: 0–30 s

This makes the fader endpoint match the native app instead of using a generic 0–100 range.
