# K500 Live Alpha v0.8.9 — System UX Restore + Transparent EQ Card

Scope: UI-only patch on top of v0.8.8 native bridge zero-popup baseline.

## What changed

1. EQ floating editor card
   - The floating EQ editor shell is now fully transparent.
   - The opaque gradient, border, arrow, blur, and shadow are removed so the EQ graph remains visible behind the controls.
   - Only the actual input/select controls keep a subtle dark surface for readability.

2. System section UX restore
   - Restored the System page toward the earlier EXE-style layout.
   - Added native-like grouped sections:
     - PC Mode / Preset Library
     - Equipment Mode / Device Profile
     - Bluetooth / BT Name
     - Access / Lock / Admin
     - Dance Mode / Mic Trigger
     - Safe Boot / Startup Limits
     - USB / UDisk / Recording Levels
   - Startup Limits and Recording Levels now use the same vertical fader UX as the rest of the mixer, instead of plain number fields.
   - The layout fills the available mixer workspace instead of leaving a large blank area.

## Transport safety

This patch does not modify:

- `tools/k500-bridge.mjs`
- `src/features/k500/live/liveStore.ts`
- `src/features/k500/protocol/commands.ts`
- USB HID framing
- BT serial framing
- heartbeat
- sync/readback
- documented live mapping

## Validation

- `npm ci --ignore-scripts` passed
- `npx tsc --noEmit` passed
- `npm run build` passed

The existing `INEFFECTIVE_DYNAMIC_IMPORT` warning remains and is unrelated to this UI patch.
