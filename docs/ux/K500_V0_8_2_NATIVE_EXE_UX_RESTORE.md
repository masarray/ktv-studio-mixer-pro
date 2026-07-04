# K500 v0.8.2 Native EXE UX Restore

Source reference: extracted `/mnt/data/app.asar` from the previous Electron build.

## UX restored from native EXE

- Main workspace returned to fixed DAW layout: EQ top row + 304px lower rack row.
- Removed separate page title band above EQ so the EQ panel owns the editor header again.
- Restored section order to match native EXE: Mic, Reverb, Echo, Music, Main, Surround, Center, Sub, System.
- Restored right rail geometry: scrollable upper rail + fixed 304px Master Strip.
- Removed large Live Device Inspector from the right rail; live connection controls remain in the top transport bar.
- Restored compact fader geometry: 58px strip, 42px track shell, 126px master-strip fader height.
- Restored bottom mixer panel behavior with `rack-panel`, `rack-panel-body`, `fader-row`, `fader-strip`, `fader-track-shell`, and `fader-readout` classes.
- Restored native-EXE inspired EQ band pill and floating editor styling.

## Connection logic

No USB/BT heartbeat logic was removed. The v0.8.1 WebHID/WebSerial connection and USB heartbeat fix remain in place. This patch is visual/layout-focused.

## Verification notes

The modified TSX files were parsed with the TypeScript compiler API. A full `npm run build` was not run in this sandbox because the zip does not include installed `node_modules`.
