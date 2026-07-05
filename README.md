# K500 Preset Studio — Live Alpha

K500 Preset Studio is a professional karaoke processor preset editor with DAW-style UX, live USB HID / Bluetooth transport, preset import/export, parametric EQ, dynamics, filters, and mixer controls.

## Current focus

- Native-style fader and mixer layout restoration
- USB HID smart connect and heartbeat stability
- Bluetooth transport continuity
- K500 preset editing workflow

## Scripts

```bash
npm install
npm run dev
npm run build
```

## Notes

The live connection engine is intentionally separated from visual UX work. UI styling changes should not touch the USB/BT transport, heartbeat, HID write, sync, or protocol modules unless the task explicitly targets connection behavior.
