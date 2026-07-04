# K500 Live Alpha v0.7.6 — Connect Button + Real Flat Fix

## Fixes

### 1. Connect button runtime check

Web Serial availability is now checked only when the user clicks Connect in the browser.
The initial Zustand store state no longer depends on server-side `navigator` checks.

If Web Serial is unavailable, the app now writes an error to the serial log and shows a browser alert.

### 2. Default Flat is now really flat

The previous DEFAULT FLAT state renamed the preset but did not reliably normalize the byte/model state used by the PEQ graph.

v0.7.6 now:

1. Mutates every EQ section to:
   - type `P`
   - gain `0 dB`
   - Q `1.0`
   - sensible default frequencies
2. Pushes the state through `serializeK500Preset()`
3. Parses it back again with `parseK500Preset()`

This ensures the graph, band dock, inspector and exported byte model all read the same flat state.

### 3. Demo button renamed

The toolbar `Demo` button is now `Flat`.
It resets the editor to DEFAULT FLAT instead of presenting the app as a demo/landing page.

## Still unchanged

Connect still follows the captured original PC sequence:

```text
AA 01 1C E3
AA 01 3F C0
AA 06 40 <offset> <len> 63 <checksum>
```

Permanent save/store/upload remains disabled.
