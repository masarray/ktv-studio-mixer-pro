# K500 Preset Studio — Lovable UX Correction Pass

This revision keeps the Lovable dark/gold/cyan studio style, but corrects the UX direction to stay faithful to the KTV K500 editor workflow.

## Changed in this pass

- Removed the fake top **MeterBridge / signal / clip** block from the main layout.
- Converted the app shell into a fixed-height DAW-style workspace so the UI no longer becomes a long page.
- Reworked the Parametric EQ editor:
  - No permanent long Band Matrix table in the default view.
  - Selected EQ band now opens a floating FabFilter-style card near the node.
  - Compact band dock at the bottom of the graph.
  - Total response now includes EQ bands plus HPF/LPF crossover approximation.
  - Per-band curves and selected-band curve are displayed in the graph.
- Improved the compressor graph to show a clearer transfer slope:
  - 1:1 reference line.
  - threshold line and dot.
  - compressed slope after threshold.
  - gain-reduction shaded region.
- Preserved the always-visible right master strip and inspector.

## Notes

The EQ and compressor graphs are visual/editor approximations for a better plugin-style UX. The binary parser/export and checksum-safe output remain based on the existing K500 mapping in this project.

## Run

```bash
npm install
npm run dev
```

or use the package manager originally used by the Lovable project.

## K500 UX correction v0.2

- Moved the **Master Strip** to the bottom of the right rail so it aligns visually with the lower Input/Dynamics/Filters rack and stays always visible.
- The right rail now scrolls only the contextual preset/band/channel tools, while the master section remains fixed at the bottom.
- Updated the EQ floating card behavior:
  - The card prefers to appear **below the selected EQ node**.
  - It flips above only near the bottom of the graph.
  - It clamps left/right inside the canvas so it does not leave the graph area.
  - It is narrower and less intrusive so PEQ visibility remains the priority.

## K500 Bluetooth protocol notes

Reverse-engineering notes from the original K500 PC software over Bluetooth COM18 have been added here:

```text
docs/protocol/K500_BT_PROTOCOL_REVERSE_ENGINEERING.md
```

Current confirmed foundation:

- Transport: Bluetooth Serial / RFCOMM `COM18`, 115200 8N1.
- TX frame: `AA LL CMD PAYLOAD... CS`.
- RX frame: `55 LEN_LO LEN_HI RSP DATA... CS`.
- Checksum: two's-complement so body bytes plus checksum equal `0x00` modulo 256.
- Confirmed command families so far: heartbeat/status, read block, Music/Mic/Effect block writes, Music EQ live write, mute ON/OFF.
- Music EQ live write is mapped enough to begin a command-builder implementation for real-time Music EQ preview.

Do not enable permanent device save/store until the save command is captured and verified.


## Protocol reverse-engineering docs

Latest protocol notes are in `docs/protocol/`, including Bluetooth RFCOMM framing, EQ write mapping, output mixer block mapping, and v0.6 output compressor / surround updates.

## K500 Live Alpha v0.7

This revision adds the first testable live-device path through **Bluetooth serial / RFCOMM** using the browser Web Serial API.

Added:

- Top-bar **Live Alpha** connect panel.
- Right-rail serial inspector/log.
- Web Serial connection at 115200 8N1.
- Handshake and heartbeat commands.
- Live EQ write for all mapped EQ sections.
- Mute ON/OFF test command.
- Output block write for Main / Surround / Center / Sub.
- Main output compressor write through output block.
- Master top Music / Mic / Effect experimental block writes.

Safety:

- Permanent save/store/upload is still disabled.
- Use Chrome or Edge on localhost.
- Pair K500 Bluetooth in Windows first, close the original K500 software, then choose the K500 COM port from the browser serial picker.

Usage notes:

```text
docs/protocol/K500_LIVE_ALPHA_USAGE.md
```

Implementation notes:

```text
docs/protocol/K500_LIVE_ALPHA_IMPLEMENTATION.md
```

## v0.7.1 Live Alpha Flicker Fix

- Bluetooth COM connect is now passive by default.
- Removed automatic handshake and periodic heartbeat after Connect.
- Ping is manual only to avoid K500 front-panel connect/flicker behavior during idle testing.
- Permanent save/upload remains disabled.

## v0.7.3 Connect Sync

- Restored correct device workflow: Connect now handshakes and reads active device memory.
- UI loads current device EQ and parameters automatically after connect; no manual preset load required.
- Removed periodic heartbeat loop; readback sync is one-shot on connect.
- Added live-memory-to-.k500 conversion for scalar fields and compact live EQ bands.

## v0.7.4 Default Flat + Original Connect Sequence

- Removed the empty Wake/Load Demo screen.
- App opens directly with a DEFAULT FLAT PEQ/editor state.
- Connect now follows the original PC software sequence: 0x1C status, 0x3F handshake, then 0x40 read blocks using tail byte 0x63.
- After sync, UI is replaced with live device values.
- Heartbeat starts after sync at ~3.2 seconds; permanent save/upload remains disabled.

## v0.7.5 SSR Serial Guard Fix

- Fixed `serialSupported is not defined` during TanStack Start SSR render.
- Kept Default Flat startup and original connect-sync sequence from v0.7.4.

## v0.7.6 Connect + Real Flat Fix

- Fixed Connect runtime Web Serial check and added visible error logging/alert if unavailable.
- DEFAULT FLAT is now truly flat across model, graph, inspector and bytes by serialize/parse normalization.
- Toolbar Demo is renamed to Flat.
