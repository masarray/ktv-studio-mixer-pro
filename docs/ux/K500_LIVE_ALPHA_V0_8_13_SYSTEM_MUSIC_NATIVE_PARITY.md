# K500 Live Alpha v0.8.13 — System + Music Native-Parity UX Correction

Scope: UX/layout only plus safe UI state fields. No changes to the native bridge, BT/USB transport, heartbeat, sync/readback, or documented live mapping command builders.

## System page
- Master Strip is visible again on the System section.
- Dance Mode / Mic Trigger was moved out of the upper side stack and into the lower mixer rack.
- Dance Mic Thres and Mic Time now use vertical faders so the System lower rack follows the same mixer language as Startup Limits, Recording Levels, and Master Strip.
- Startup Limits, Recording Levels, Dance Mode, and Master Strip share the same lower-rack height.

## Music page
- Music page now exposes the native-app style field set instead of only Source Router + Pitch Shifter.
- Added lower-panel controls for:
  - Noise Gate
  - LPF / LP Type
  - HPF / HP Type
  - Bass
  - Mid
  - Mid Freq
  - Treble
- HPF and LPF controls are bound to `eq.music.crossover.hpfHz` and `eq.music.crossover.lpfHz`, so the EQ graph yellow HP/LP handles and crossover curve update from the bottom panel.

## Safety
- Bass/Mid/Treble/Noise Gate and Dance Mode fields are UI-state only until native live/write mapping is confirmed.
- HPF/LPF are file-model edits, matching the existing EQ graph crossover behavior.
- Connection engine was not touched.
