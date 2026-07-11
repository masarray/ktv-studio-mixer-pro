[CmdletBinding()]
param(
  [switch]$SkipInstall,
  [switch]$ForceInstall
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Invoke-WithHeartbeat {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$Activity,
    [int]$TimeoutMinutes = 15
  )
  $Started = Get-Date
  $Process = Start-Process -FilePath $FilePath -ArgumentList $Arguments -NoNewWindow -PassThru
  while (-not $Process.HasExited) {
    if ($Process.WaitForExit(10000)) { break }
    $Elapsed = [int]((Get-Date) - $Started).TotalSeconds
    Write-Host ("    {0} masih berjalan... {1} detik" -f $Activity, $Elapsed) -ForegroundColor DarkGray
    if ($Elapsed -ge ($TimeoutMinutes * 60)) {
      try { $Process.Kill() } catch { }
      throw "$Activity melewati batas waktu $TimeoutMinutes menit. Proses dihentikan."
    }
  }
  $Process.WaitForExit()
  return $Process.ExitCode
}

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
Write-Host ("    Node {0} | npm {1}" -f (& node --version), (& npm --version)) -ForegroundColor DarkGray
if (-not $SkipInstall) {
  Write-Host '[1/5] Checking project dependencies' -ForegroundColor Cyan
  & (Join-Path $PSScriptRoot 'ensure-node-dependencies.ps1') -ForceInstall:$ForceInstall
}

Write-Host '[2/5] Building production web app' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Production build gagal.' }

Write-Host '[3/5] Validating embedded desktop server' -ForegroundColor Cyan
& node (Join-Path $RepoRoot 'scripts\test-desktop-server.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Desktop server validation gagal.' }

$ElectronBuilder = Join-Path $RepoRoot 'node_modules\.bin\electron-builder.cmd'
if (-not (Test-Path $ElectronBuilder)) { throw 'electron-builder lokal tidak ditemukan.' }
$ElectronExe = Join-Path $RepoRoot 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path $ElectronExe)) {
  throw 'Electron belum terpasang lengkap (electron.exe tidak ditemukan). Jalankan build kembali tanpa opsi SkipInstall.'
}

Write-Host '[4/5] Checking packaged Windows native module binaries' -ForegroundColor Cyan
$NodeHidBinaries = @(Get-ChildItem (Join-Path $RepoRoot 'node_modules\node-hid') -Recurse -Filter '*.node' -File -ErrorAction SilentlyContinue)
$SerialBinaries = @(Get-ChildItem (Join-Path $RepoRoot 'node_modules') -Recurse -Filter '*.node' -File -ErrorAction SilentlyContinue | Where-Object {
  $_.FullName -match '[\\/](serialport|@serialport)[\\/]'
})
if ($NodeHidBinaries.Count -eq 0 -or $SerialBinaries.Count -eq 0) {
  throw @'
Binary Windows node-hid atau serialport tidak ditemukan di node_modules.
Hapus folder node_modules lalu jalankan build-portable-single-exe.cmd kembali.
'@
}
Write-Host ("      node-hid: {0} binary | serialport: {1} binary" -f $NodeHidBinaries.Count, $SerialBinaries.Count) -ForegroundColor Green
Write-Host '      Hardware tidak dipindai saat build; koneksi K500 baru diuji ketika aplikasi dijalankan.' -ForegroundColor DarkGray

Write-Host '[5/5] Packaging versioned portable EXE' -ForegroundColor Cyan
Write-Host '      Tahap ini dapat memerlukan beberapa menit. Output Electron Builder akan tetap terlihat.' -ForegroundColor DarkGray
$BuilderCli = Join-Path $RepoRoot 'node_modules\electron-builder\cli.js'
if (-not (Test-Path $BuilderCli)) { throw 'electron-builder CLI tidak ditemukan.' }
$PackageExit = Invoke-WithHeartbeat -FilePath (Get-Command node).Source -Arguments @(('"{0}"' -f $BuilderCli), '--win', 'portable', '--x64', '--publish', 'never') -Activity 'Electron packaging' -TimeoutMinutes 20
if ($PackageExit -ne 0) { throw 'electron-builder portable gagal.' }

$Output = Get-ChildItem (Join-Path $RepoRoot 'release\SONKUPIK-STUDIO-*-Portable.exe') -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $Output) { throw 'Portable executable tidak ditemukan di folder release.' }

Write-Host ''
Write-Host 'BUILD SUCCESS' -ForegroundColor Green
Write-Host $Output.FullName -ForegroundColor Yellow
