# SONKUPIK STUDIO — Karaoke Processor

Professional K500 karaoke processor preset editor with live USB HID / Bluetooth control, PEQ, crossover, dynamics, mixer controls, device preset recall/save, and mass upload.

## Built-in PC Mode preset

The Windows desktop application ships with `KARAOKE ARTIST LUXURY`. Factory
presets are stored separately from the user-owned
`Documents\SONKUPIK STUDIO Presets` library and appear with a `FACTORY` badge
in PC Mode. v0.8.44+ checks the public preset catalog after startup, validates
every download with SHA-256 plus the K500 checksum, and never blocks an offline
launch. `Save to PC` always writes a `USER` preset to Documents.

See [`docs/PRESET_CATALOG_SYNC.md`](docs/PRESET_CATALOG_SYNC.md) for publishing
new factory presets to every v0.8.44+ desktop user.

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

> For daily use, the **Setup installer is recommended**. A portable single EXE
> must unpack its embedded Electron runtime on every cold start, while the
> installed build launches directly from its permanent application directory.

Double-click:

```text
build-portable-single-exe.cmd
```

Output:

```text
release\SONKUPIK-STUDIO-<version>-Portable.exe
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
release\SONKUPIK-STUDIO-<version>-Portable.exe
release\SONKUPIK-STUDIO-<version>-Setup.exe
```

To build only the recommended fast-start installer, double-click:

```text
build-installer.cmd
```

## Automated release

`.github/workflows/release-windows.yml` builds both artifacts when run manually or when a `v*` tag is pushed. Windows code signing is intentionally not required; signing can be added later through electron-builder environment secrets without changing the app code.

### Dependency/network behavior

The Windows builders use the public npm registry (`https://registry.npmjs.org/`) and automatically remove inaccessible internal registry URLs from `package-lock.json`. If `node_modules` already contains the required build tools, the builder skips `npm ci`, so repeat builds do not require a network connection. Use `-ForceInstall` only when dependencies must be refreshed.
