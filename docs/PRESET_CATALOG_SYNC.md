# Factory preset sync

SONKUPIK STUDIO v0.8.44 and newer can receive factory preset updates without
reinstalling the application. The desktop app reads the committed manifest at:

`https://raw.githubusercontent.com/masarray/ktv-studio-mixer-pro/main/preset-catalog/presets-manifest.json`

The check runs after the window and native bridge are ready, at most once every
six hours. Offline failures are silent and retried later. Downloads must be
exactly 1144 bytes and pass both the K500 checksum and the SHA-256 recorded in
the manifest.

## Publish your latest presets

Run this from the repository in Windows PowerShell. It copies all PC Mode
presets that you have saved locally into the factory source, regenerates the
manifest, validates it, and shows the exact files that will be committed.

```powershell
$Repo = 'C:\Git\ktv-studio'
$UserPresets = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'SONKUPIK STUDIO Presets'
Set-Location $Repo
Copy-Item (Join-Path $UserPresets '*.k500') (Join-Path $Repo 'resources\presets') -Force
npm run presets:catalog
npm run test:preset-catalog
git status --short -- resources/presets preset-catalog/presets-manifest.json
```

Review those files, then commit and push them to `main`. Users receive them on
the next catalog check or after restarting the app once the six-hour cache has
expired. The `Refresh` button updates the visible library after a completed
background check; it does not bypass the network cache.

## Safety model

- Factory files use the app-managed `Factory Presets` directory.
- Personal presets use `Documents\SONKUPIK STUDIO Presets`.
- `Save to PC` cannot overwrite an app-managed factory file.
- If an unknown local edit is detected in the factory directory, it is copied
  into Documents with a `_LOCAL_BACKUP_...` suffix before the factory update.
- A missing network, HTTP error, invalid filename, oversized manifest, invalid
  K500 checksum, or SHA-256 mismatch leaves the last valid presets available.

Set `SONKUPIK_PRESET_SYNC_DISABLED=1` before launching the app to disable all
online preset checks. A staging catalog can be tested with
`SONKUPIK_PRESET_CATALOG_URL`.
