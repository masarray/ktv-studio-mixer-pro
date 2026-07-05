# K500 Live Alpha v0.8.10 — System Lower Rack Align

Scope: UI-only alignment patch for the System page.

## Fix

- Aligns `system-startup-panel` and `system-record-panel` with the right-side `master-bottom-strip`.
- Locks the System page lower rack row to the same 304px height used by the Master Strip.
- Keeps Startup Limits and Recording Levels always visible at the bottom of the System page, matching other sections.
- Removes the earlier responsive shrink of the System lower rack row so it does not drift away from the Master Strip.

## Non-regression

This patch only changes CSS and documentation. It does not touch:

- `tools/k500-bridge.mjs`
- BT/USB native bridge connection
- USB HID framing
- heartbeat
- sync/readback
- live parameter mapping
- protocol command builders
