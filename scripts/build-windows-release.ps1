[CmdletBinding()]
param(
  [string]$Version = '',
  [ValidateSet('Both', 'Installer', 'Portable')]
  [string]$Target = 'Both',
  [switch]$SkipInstall,
  [switch]$ForceInstall
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if ($env:OS -ne 'Windows_NT') {
  throw 'Release Windows harus dibangun di Windows.'
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js 22 atau lebih baru belum terpasang.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'npm tidak ditemukan.'
}

# This public build has no Windows code-signing certificate. Keep executable
# resource editing, but skip certificate discovery and code-signing retries.
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
if ($Version) {
  $CleanVersion = $Version.TrimStart('v')
  npm version $CleanVersion --no-git-tag-version --allow-same-version
  if ($LASTEXITCODE -ne 0) { throw 'Gagal menerapkan version release.' }
}
if (-not $SkipInstall) {
  & (Join-Path $PSScriptRoot 'ensure-node-dependencies.ps1') -ForceInstall:$ForceInstall
}

npm run build
if ($LASTEXITCODE -ne 0) { throw 'Production build gagal.' }
npm run test:builtin-presets
if ($LASTEXITCODE -ne 0) { throw 'Built-in preset validation gagal.' }
npm run test:preset-catalog
if ($LASTEXITCODE -ne 0) { throw 'Online factory preset catalog validation gagal.' }
npm run test:system-layout
if ($LASTEXITCODE -ne 0) { throw 'Responsive System layout validation gagal.' }
npm run test:ux-controls
if ($LASTEXITCODE -ne 0) { throw 'Unified UX control validation gagal.' }
npm run test:v0842-hardening
if ($LASTEXITCODE -ne 0) { throw 'v0.8.42 hardening regression test gagal.' }
npm run test:v0843-performance
if ($LASTEXITCODE -ne 0) { throw 'v0.8.43 performance hardening regression test gagal.' }
npm run test:desktop-server
if ($LASTEXITCODE -ne 0) { throw 'Desktop server validation gagal.' }

$ElectronBuilder = Join-Path $RepoRoot 'node_modules\.bin\electron-builder.cmd'
if (-not (Test-Path $ElectronBuilder)) { throw 'electron-builder lokal tidak ditemukan.' }
npm run desktop:prepare
if ($LASTEXITCODE -ne 0) { throw 'Electron package metadata cleanup gagal.' }
npm run test:windows-packaging
if ($LASTEXITCODE -ne 0) { throw 'Konfigurasi unsigned Windows package tidak valid.' }
# Windows PowerShell 5.1 unwraps a one-item switch result into a scalar. The
# previous target splat consequently passed only the first character
# ("n") of "nsis" to electron-builder. Keep every native argument explicit so
# Installer, Portable, and Both behave identically on PowerShell 5.1 and 7+.
switch ($Target) {
  'Installer' {
    & $ElectronBuilder '--win' 'nsis' '--x64' '--publish' 'never'
  }
  'Portable' {
    & $ElectronBuilder '--win' 'portable' '--x64' '--publish' 'never'
  }
  default {
    & $ElectronBuilder '--win' 'portable' 'nsis' '--x64' '--publish' 'never'
  }
}
$PackagingExitCode = $LASTEXITCODE
if ($PackagingExitCode -ne 0) { throw "Packaging Windows gagal (exit code $PackagingExitCode)." }

$PackageVersion = (Get-Content (Join-Path $RepoRoot 'package.json') -Raw | ConvertFrom-Json).version
$PortablePath = Join-Path $RepoRoot "release\SONKUPIK-STUDIO-$PackageVersion-Portable.exe"
$InstallerPath = Join-Path $RepoRoot "release\SONKUPIK-STUDIO-$PackageVersion-Setup.exe"
$Portable = if ($Target -ne 'Installer') { Get-Item $PortablePath -ErrorAction SilentlyContinue }
$Installer = if ($Target -ne 'Portable') { Get-Item $InstallerPath -ErrorAction SilentlyContinue }
if ($Target -ne 'Installer' -and -not $Portable) { throw 'Portable single EXE tidak ditemukan.' }
if ($Target -ne 'Portable' -and -not $Installer) { throw 'Installer EXE tidak ditemukan.' }
$PackagedPreset = Join-Path $RepoRoot 'release\win-unpacked\resources\presets\KARAOKE_ARTIST_LUXURY.k500'
if (-not (Test-Path $PackagedPreset)) { throw 'Built-in KARAOKE ARTIST LUXURY tidak ikut ke package.' }
$PresetBytes = [IO.File]::ReadAllBytes($PackagedPreset)
$PresetChecksum = 0
foreach ($Byte in $PresetBytes) { $PresetChecksum = ($PresetChecksum + $Byte) -band 0xff }
if ($PresetBytes.Length -ne 1144 -or $PresetChecksum -ne 0) { throw 'Built-in preset package tidak valid.' }

Write-Host ''
Write-Host 'WINDOWS RELEASE SUCCESS' -ForegroundColor Green
if ($Portable) { Write-Host $Portable.FullName -ForegroundColor Yellow }
if ($Installer) { Write-Host $Installer.FullName -ForegroundColor Yellow }
