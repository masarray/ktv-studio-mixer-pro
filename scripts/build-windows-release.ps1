[CmdletBinding()]
param(
  [string]$Version = '',
  [switch]$SkipInstall
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
if ($Version) {
  $CleanVersion = $Version.TrimStart('v')
  npm version $CleanVersion --no-git-tag-version
  if ($LASTEXITCODE -ne 0) { throw 'Gagal menerapkan version release.' }
}
if (-not $SkipInstall) {
  npm ci
  if ($LASTEXITCODE -ne 0) { throw 'npm ci gagal.' }
}

npm run build
if ($LASTEXITCODE -ne 0) { throw 'Production build gagal.' }
npm run test:desktop-server
if ($LASTEXITCODE -ne 0) { throw 'Desktop server validation gagal.' }

npx electron-builder --win portable nsis --x64 --publish never
if ($LASTEXITCODE -ne 0) { throw 'Packaging Windows gagal.' }

$Portable = Join-Path $RepoRoot 'release\sonkupik_karaoke.exe'
$Installer = Get-ChildItem (Join-Path $RepoRoot 'release\sonkupik_karaoke_setup_*.exe') -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not (Test-Path $Portable)) { throw 'Portable single EXE tidak ditemukan.' }
if (-not $Installer) { throw 'Installer EXE tidak ditemukan.' }

Write-Host ''
Write-Host 'WINDOWS RELEASE SUCCESS' -ForegroundColor Green
Write-Host $Portable -ForegroundColor Yellow
Write-Host $Installer.FullName -ForegroundColor Yellow
