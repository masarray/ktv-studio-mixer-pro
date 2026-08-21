# Native UI Design Notes

## Product character

**Obsidian Console** — quiet, precise, high-density, tactile and premium.

The visual system deliberately borrows interaction principles rather than branding or pixel geometry from existing products:

- FabFilter Pro-Q: graph-first equalizer workflow, direct band manipulation and contextual selected-band controls.
- Yamaha DM7: selected-channel immediacy and high information density without turning the workspace into a dashboard.
- SSL UF8: long-fader / encoder hierarchy and clear level / pan / routing feedback.

## Rules

- Plus Jakarta Sans only.
- Controls first; explanation is documentation, not workspace content.
- PEQ receives the largest visual area.
- Active state earns color; idle state stays calm.
- Avoid glow as a default state.
- No huge cards or oversized headings.
- Numeric readouts remain proportional, not monospaced.
- Motion should communicate continuity, not decorate the UI.
- Prefer Qt Quick scene-graph friendly geometry and simple opacity/position transitions.

## Prototype interaction

- Drag PEQ nodes on X/Y to change frequency/gain.
- Drag knobs vertically; hold Shift for fine control; double-click resets.
- Mouse wheel adjusts knobs/faders; Shift gives fine adjustment.
- Faders track pointer immediately and retain a smoothed visual cap.
- Level meters use smooth tracking and peak hold.
