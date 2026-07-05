# K500 Live Alpha v0.8.4 — Source Cleanup

## Scope

This patch removes external builder metadata and project branding artifacts from the repository while keeping the K500 live transport engine intact.

## Removed / changed

- Removed external builder metadata directory.
- Removed project guidance file tied to the previous external builder workflow.
- Replaced the wrapped Vite config with a standard Vite + TanStack Start config.
- Renamed the app error reporter module to a neutral project-owned name.
- Updated README text to describe the K500 app directly.
- Removed old Bun lock/config files that contained external builder cache references.
- Cleaned `package.json` and `package-lock.json` so the project no longer depends on that external builder package.

## Connection safety

The following K500 connection/protocol files are unchanged from v0.8.3:

- `src/features/k500/live/liveStore.ts`
- `src/features/k500/protocol/commands.ts`
- `src/features/k500/protocol/frame.ts`
- `src/features/k500/parser.ts`
- `src/features/k500/store.ts`

USB HID, Bluetooth, heartbeat, sync, and write paths were not modified.

## Validation

- `npm ci --ignore-scripts` passed.
- `npm run build` passed.
- Source grep confirms no external-builder brand text remains outside generated dependency folders.
