[CmdletBinding()]
param(
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if ($env:OS -ne 'Windows_NT') {
  throw 'Portable Windows EXE harus dibangun di Windows.'
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js 22 atau lebih baru belum terpasang.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'npm tidak ditemukan.'
}

Write-Host '==> SONKUPIK STUDIO: portable single EXE' -ForegroundColor Cyan
if (-not $SkipInstall) {
  Write-Host '==> Installing locked dependencies'
  npm ci
  if ($LASTEXITCODE -ne 0) { throw 'npm ci gagal.' }
}

Write-Host '==> Building production app'
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Production build gagal.' }

Write-Host '==> Validating embedded desktop server'
npm run test:desktop-server
if ($LASTEXITCODE -ne 0) { throw 'Desktop server validation gagal.' }

Write-Host '==> Packaging sonkupik_karaoke.exe'
npx electron-builder --win portable --x64 --publish never
if ($LASTEXITCODE -ne 0) { throw 'electron-builder portable gagal.' }

$Output = Join-Path $RepoRoot 'release\sonkupik_karaoke.exe'
if (-not (Test-Path $Output)) {
  throw "Portable executable tidak ditemukan: $Output"
}

Write-Host ''
Write-Host 'BUILD SUCCESS' -ForegroundColor Green
Write-Host $Output -ForegroundColor Yellow
