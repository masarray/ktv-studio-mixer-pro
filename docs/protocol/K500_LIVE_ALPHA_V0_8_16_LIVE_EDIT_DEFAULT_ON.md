# K500 Live Alpha v0.8.16 — Live Edit Default ON

## Problem

After the native bridge / USB-BT connection succeeded, the app still left `liveEnabled` as `false`.
The UI showed `READY` and `LIVE OFF`, so fader and PEQ movement updated the editor state only and did not send TX frames to the K500.

This made the app feel like live edit was broken even though the connection, readback, and write builders were still present.

## Fix

- On every successful connect + device sync, the app now automatically enables live RAM edit.
- The top bar changes to `LIVE ON` / `SYNC` after connect, so fader and PEQ edits immediately send current-state commands to the device RAM.
- During a fresh connection attempt or failed connection, live edit is explicitly disabled to avoid stale UI state.
- If a user manually turns `LIVE OFF` and then moves a fader/PEQ point, the app logs a throttled `live edit paused` message instead of failing silently.

## Scope preserved

Unchanged:

- Native bridge zero-popup discovery
- BT serial transport
- USB HID transport and re-framing
- Heartbeat cadence
- Device sync/readback
- Documented live mapping command builders
- UI layout and System/Music pages

## Test checklist

1. Start app with native bridge.
2. Click `Connect`.
3. After readback completes, the top bar should show `LIVE ON` and `SYNC`.
4. Drag an EQ node.
5. Serial log should show `TX · EQ ... bridge` or USB/BT equivalent.
6. Move a mapped fader, such as Music input or Master Strip.
7. Serial log should show `TX · Top Music block`, `Top Mic block`, `Top Effect block`, or `Output block` depending on the parameter.
8. Click `LIVE OFF`, move a control, and confirm the log shows `live edit paused` instead of silent no-op.
