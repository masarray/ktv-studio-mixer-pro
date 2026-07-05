# K500 Live Alpha v0.8.14 — Music filter no-cut + 10 device slots

## Fixes

- Music page `Filters / HPF-LPF` no longer cuts off the bottom controls in the 304px lower rack.
- HPF and LPF now use one compact slider + editable numeric field per value. Both controls write the same `eq.music.crossover.*` paths, so the EQ graph HP/LP handles remain synchronized.
- Removed the duplicate bottom HPF/LPF number-field block that consumed height and caused clipping.
- Equipment / Device Mode now always renders exactly 10 internal KTV preset slots.
- Live-memory mode-name parsing preserves fixed slot indexes instead of dropping empty slot records, preventing slot 10 from disappearing when a device returns a blank or partially blank row.

## Guardrails

The following were intentionally not changed:

- Native bridge zero-popup connect flow.
- BT/USB heartbeat.
- USB HID framing.
- Sync/readback transport.
- Live mapping command builders.
- Device destructive commands such as Recall/Save/Reset all remain disabled until verified.
