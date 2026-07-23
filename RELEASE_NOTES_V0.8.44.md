# SONKUPIK STUDIO v0.8.44

## Windows build fix

- Fixed `Unknown target: n` in `build-installer.cmd` on Windows PowerShell 5.1.
- Installer, Portable, and combined packaging now pass explicit native
  arguments to Electron Builder.
- Artifact validation now checks the current package version, so an old EXE in
  `release` cannot produce a false success.
- Setup and Portable remain separate release assets.

## Factory preset delivery

- Added a background public preset catalog for v0.8.44+ desktop users.
- Factory and user preset storage are isolated.
- Downloads are bounded, validated with SHA-256 and the K500 checksum, then
  installed with recoverable atomic replacement.
- The last valid factory preset remains available offline.
- Unknown local factory edits are backed up to Documents before an update.
- PC Mode labels each entry as `FACTORY` or `USER` and Mass Upload preserves
  that identity.

## Validation completed

- Production Vite client, SSR, and prerender build.
- Built-in preset generation/checksum/no-overwrite regression.
- Background catalog install/cache/backup/corruption regression.
- Windows PowerShell 5.1 packaging target regression.
- System layout, unified UX, v0.8.42 hardware hardening, v0.8.43 performance,
  desktop server, and Electron metadata regression suites.
