# SONKUPIK STUDIO v0.8.42 — FBX, Filter Rail, and Offline Performance Audit

Date: 2026-07-14  
Target: Windows Electron desktop, disconnected/offline state, 1486 × 923 content viewport.

## Findings and fixes

### 1. FBX was intentionally stubbed, not device-locked

The Mic UI used a hardcoded `value={0}`, empty `onChange`, and `disabled` flag. The preset format already reserves file bytes `0x001B` and `0x001C`, which map through the verified scalar `+8` offset to live bytes `0x13` and `0x14`. Native Mic block payload positions `[4]` and `[5]` were previously forced to zero.

v0.8.42 adds one shared `mic.fbxLevel` control (0–20), reads the average of the two file bytes, writes the selected value back to both channels, and sends it in both native Mic block positions. The UI labels the shared control `A+B` so the coupling is explicit.

Hardware note: the byte placement follows the verified file/live scalar layout and native Mic block shape. Final acoustic behavior still needs one physical K500 A/B check because no fresh FBX-only USB capture was available in this workspace.

### 2. HPF/LPF rails consumed too much lower-rack width

The frequency rails used fixed columns up to 292 px. v0.8.42 reduces numeric frequency editors to about 42–52% of the rail width, pairs Reverb/Echo frequency and type fields by filter, and keeps the longer filter-type selectors readable. Output sections retain their native delay/type ordering while using a compact 212 px rail.

### 3. Compressor knob face still intersected the value arc

The knob face moved from center `y=61`, radius `25.5` to center `y=64`, radius `24.5`; its pointer rotates around the same new center. The cyan arc now remains visually continuous. Release readouts also no longer split `100 ms` into `100 m s`.

### 4. Offline desktop work was doing avoidable rendering and networking

Root causes found:

- a render-blocking Google Fonts stylesheet made cold start depend on network availability;
- a full-screen SVG `feTurbulence` texture plus fixed background forced expensive compositing;
- `StudioShell`, `PageContent`, `TransportBar`, and `EqGraph` subscribed to the whole preset, so unrelated fader changes propagated into the PEQ tree;
- knob pointer events could exceed the screen refresh rate and repeatedly reattach listeners because inline callbacks changed identity.

Fixes:

- Windows-native Segoe UI / Cascadia font fallbacks, with no external stylesheet;
- two static radial gradients, no SVG noise filter and no fixed background layer;
- stable boolean/name selectors at shell level and section-only EqGraph subscription;
- touched EQ sections receive new identities only when their values change;
- knob pointer updates coalesce through `requestAnimationFrame` and use a stable callback ref;
- fader/knob/range paint containment limits invalidation to the moving control.

## Runtime evidence

Production build, Chromium/Electron-equivalent renderer, disconnected state:

| Check | Result |
|---|---:|
| 42 consecutive FBX updates | 730.1 ms total |
| Average animation frame | 16.59 ms |
| Frames slower than 25 ms | 0 |
| Long tasks | 0 |
| External stylesheets | 0 |
| Failed requests | 0 |
| Console errors | 0 |
| Section navigation, two-frame settled | 9.1–34.3 ms |

Raw data: `audit/ux-v0.8.42/runtime-audit.json` in the delivery workspace.

## Regression coverage

- `test:v0842-hardening` protects build ignore patterns, FBX parser/serializer/live mapping, compact rail markup, knob geometry, stable EQ subscriptions, offline fonts, and removal of the full-screen noise filter.
- The Windows workflow and both PowerShell build entry points run this check before packaging.
- Existing metadata, packaging, System layout, UX controls, built-in preset, desktop server, production build, and TypeScript checks remain green.
