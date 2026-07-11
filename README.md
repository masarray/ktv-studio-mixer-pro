# SONKUPIK STUDIO — Karaoke Processor

Professional K500 karaoke processor preset editor with live USB HID / Bluetooth control, PEQ, crossover, dynamics, mixer controls, device preset recall/save, and mass upload.

## Development

```bash
npm ci
npm run dev
```

The Vite development server also starts the native K500 bridge.

## Production web build

```bash
npm run build
npm run test:desktop-server
```

## Windows portable single EXE

Double-click:

```text
build-portable-single-exe.cmd
```

Output:

```text
release\sonkupik_karaoke.exe
```

The portable EXE contains its own Chromium and Node runtime. The target PC does not need Node.js installed.

## Windows portable + installer

Double-click:

```text
build-windows-release.cmd
```

Or run:

```bash
npm run dist:windows
```

Outputs:

```text
release\sonkupik_karaoke.exe
release\sonkupik_karaoke_setup_<version>.exe
```

## Automated release

`.github/workflows/release-windows.yml` builds both artifacts when run manually or when a `v*` tag is pushed. Windows code signing is intentionally not required; signing can be added later through electron-builder environment secrets without changing the app code.
