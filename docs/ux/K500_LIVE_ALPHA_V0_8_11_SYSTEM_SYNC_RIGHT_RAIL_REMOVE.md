# K500 Live Alpha v0.8.11 — System Sync + Right Rail Removal

Scope: UX and active-memory hydration only. BT/USB native bridge, heartbeat,
sync/readback commands, HID framing, and live parameter mapping are unchanged.

## Fixes

1. System section no longer shows the right-side rail.
   - The Preset/Band Inspector/Master Strip rail is useful for audio editing
     sections, but it creates noise in System.
   - `StudioShell` now hides `MasterSection` when `page === "system"` so the
     System page gets the full editor width.

2. Equipment Mode is hydrated from device readback.
   - The native K500 active memory contains a fixed-width equipment-mode name
     table at live offset `0x0290`.
   - Each entry is 16 ASCII bytes.
   - The active mode name in the observed readback is a fixed 16-byte field at
     `0x02c0`.
   - The old code used a 33-byte C-string read from `0x02c0`, which over-read
     into the next mode name and produced incorrect UI text such as:
     `KARAOKE ARTIST AKUSTIK GEN3...`.
   - v0.8.11 reads fixed-width labels instead, so Connect hydrates the dropdown
     and preset library rows like the native application.

3. System BT/BLE names are hydrated from device readback.
   - BT name: live `0x0385`.
   - BLE name: live `0x0398`.

## Files changed

- `src/components/studio/StudioShell.tsx`
- `src/components/studio/pages.tsx`
- `src/features/k500/types.ts`
- `src/features/k500/parser.ts`
- `src/features/k500/live/liveMemory.ts`

## Validation

- `npm ci --ignore-scripts` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed.

Known warning remains the old `INEFFECTIVE_DYNAMIC_IMPORT` warning and is not
related to this patch.
