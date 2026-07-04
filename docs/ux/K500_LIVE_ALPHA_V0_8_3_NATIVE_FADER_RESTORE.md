# K500 Live Alpha v0.8.3 — Native EXE Fader Restore

## Scope

This patch restores the fader visual geometry from the previously built Electron `app.asar` UX.

## What changed

- Restored the native EXE vertical fader input geometry:
  - `width: 40px`
  - centered `margin: 0 auto`
  - 8px rounded track
  - 24px × 16px rounded thumb
  - WebKit thumb offset `margin-left: -8px`
- Restored readout alignment:
  - fixed 58px readout width
  - centered inline-flex content
  - no accidental left/right margin drift
- Restored fader shell centering:
  - 42px track shell
  - grid centering for the slider

## Regression guard

This is a CSS-only patch. No files under `src/features/k500/live` or `src/features/k500/protocol` were modified, so the v0.8.1/v0.8.2 BT/USB connection and heartbeat fixes remain intact.
