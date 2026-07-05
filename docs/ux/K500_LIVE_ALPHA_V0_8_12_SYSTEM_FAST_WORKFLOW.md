# K500 Live Alpha v0.8.12 — System Fast Workflow Restore

## Intent

System page must behave like a senior workflow screen, not a duplicated dropdown editor.

- **PC Mode** is now a real PC preset file view.
  - It lists `.k500` files from the app/bridge root folder.
  - The native bridge serves the list via WebSocket so the browser UI can show files without a browser file picker.
  - `Save to PC` writes the current preset to that root when the bridge is available, with browser download fallback.

- **Equipment / Device Mode** is now the KTV internal device-slot list.
  - It renders the 10 device preset names read from the K500 active memory during Connect.
  - It shows an `ACTIVE` badge on the current device slot.
  - It is no longer a dropdown and is no longer reused as PC Mode.

## Native bridge additions

`tools/k500-bridge.mjs` now supports non-invasive PC preset file messages:

- `listPcPresets`
- `readPcPreset`
- `savePcPreset`

These do not touch BT/USB transport, heartbeat, sync/readback, or live mapping.

## Safety

Permanent device-slot destructive actions remain visible but disabled:

- Recall
- Save
- Reset all
- Upload to device
- Mass upload

Reason: repository docs still mark permanent save/store/recall as not decoded/verified. The UI exposes the workflow locations without pretending that destructive device commands are already safe.

## Files changed

- `src/components/studio/pages.tsx`
- `src/styles.css`
- `tools/k500-bridge.mjs`
- `docs/ux/K500_LIVE_ALPHA_V0_8_12_SYSTEM_FAST_WORKFLOW.md`

## Validation

- `npm ci --ignore-scripts`
- `npx tsc --noEmit`
- `npm run build`
- `node --check tools/k500-bridge.mjs`
