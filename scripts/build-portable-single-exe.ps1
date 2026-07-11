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
$ElectronCli = Join-Path $RepoRoot 'node_modules\electron\cli.js'
$ElectronExe = Join-Path $RepoRoot 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path $ElectronCli) -or -not (Test-Path $ElectronExe)) {
  throw 'Electron belum terpasang lengkap (electron.exe tidak ditemukan). Jalankan build kembali tanpa opsi SkipInstall.'
}

Write-Host '[4/5] Testing USB HID and Serial native modules in Electron' -ForegroundColor Cyan
$VerifyScript = Join-Path $RepoRoot 'scripts\verify-electron-native-modules.mjs'
$NativeExit = Invoke-WithHeartbeat -FilePath (Get-Command node).Source -Arguments @(('"{0}"' -f $ElectronCli), ('"{0}"' -f $VerifyScript)) -Activity 'Native module test' -TimeoutMinutes 3
if ($NativeExit -ne 0) {
  throw @'
Native module tidak kompatibel atau instalasinya tidak lengkap.
Jalankan kembali build-portable-single-exe.cmd dan pilih Force Install bila diminta.
Python/Visual Studio tidak diperlukan oleh konfigurasi build ini.
'@
}

Write-Host '[5/5] Packaging portable sonkupik_karaoke.exe' -ForegroundColor Cyan
Write-Host '      Tahap ini dapat memerlukan beberapa menit. Output Electron Builder akan tetap terlihat.' -ForegroundColor DarkGray
$BuilderCli = Join-Path $RepoRoot 'node_modules\electron-builder\cli.js'
if (-not (Test-Path $BuilderCli)) { throw 'electron-builder CLI tidak ditemukan.' }
$PackageExit = Invoke-WithHeartbeat -FilePath (Get-Command node).Source -Arguments @(('"{0}"' -f $BuilderCli), '--win', 'portable', '--x64', '--publish', 'never') -Activity 'Electron packaging' -TimeoutMinutes 20
if ($PackageExit -ne 0) { throw 'electron-builder portable gagal.' }

$Output = Join-Path $RepoRoot 'release\sonkupik_karaoke.exe'
if (-not (Test-Path $Output)) {
  throw "Portable executable tidak ditemukan: $Output"
}

Write-Host ''
Write-Host 'BUILD SUCCESS' -ForegroundColor Green
Write-Host $Output -ForegroundColor Yellow
