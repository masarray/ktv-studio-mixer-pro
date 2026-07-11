[CmdletBinding()]
param(
  [switch]$ForceInstall
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Test-NodeDependencies {
  $Required = @(
    'node_modules\.bin\vite.cmd',
    'node_modules\.bin\electron-builder.cmd',
    'node_modules\electron\package.json',
    'node_modules\electron\dist\electron.exe',
    'node_modules\node-hid\package.json',
    'node_modules\serialport\package.json'
  )
  foreach ($Item in $Required) {
    if (-not (Test-Path (Join-Path $RepoRoot $Item))) { return $false }
  }
  return $true
}

function Invoke-WithHeartbeat {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$Activity,
    [int]$TimeoutMinutes = 20
  )

  $Started = Get-Date
  $Process = Start-Process -FilePath $FilePath -ArgumentList $Arguments -NoNewWindow -PassThru
  while (-not $Process.HasExited) {
    if ($Process.WaitForExit(10000)) { break }
    $Elapsed = [int]((Get-Date) - $Started).TotalSeconds
    Write-Host ("    {0} masih berjalan... {1} detik" -f $Activity, $Elapsed) -ForegroundColor DarkGray
    if ($Elapsed -ge ($TimeoutMinutes * 60)) {
      try { $Process.Kill() } catch { }
      throw "$Activity melewati batas waktu $TimeoutMinutes menit. Proses dihentikan agar tidak menunggu selamanya."
    }
  }
  $Process.WaitForExit()
  return $Process.ExitCode
}

# package-lock.json was previously generated inside an internal build environment.
# Absolute tarball URLs from that environment are unreachable on normal Windows PCs.
$LockPath = Join-Path $RepoRoot 'package-lock.json'
if (Test-Path $LockPath) {
  $LockText = [System.IO.File]::ReadAllText($LockPath)
  $PublicLock = [regex]::Replace(
    $LockText,
    'https://packages\.[^"/]+/artifactory/api/npm/npm-public/',
    'https://registry.npmjs.org/'
  )
  if ($PublicLock -ne $LockText) {
    Write-Host '==> Replacing inaccessible internal npm URLs with registry.npmjs.org' -ForegroundColor Yellow
    [System.IO.File]::WriteAllText($LockPath, $PublicLock, (New-Object System.Text.UTF8Encoding($false)))
  }
}

# A prior interrupted npm install can leave electron/package.json present while
# electron.exe is missing. Repair that specific partial install first instead
# of treating it as complete or downloading every npm package again.
$ElectronPackage = Join-Path $RepoRoot 'node_modules\electron\package.json'
$ElectronExe = Join-Path $RepoRoot 'node_modules\electron\dist\electron.exe'
$ElectronInstall = Join-Path $RepoRoot 'node_modules\electron\install.js'
function Repair-ElectronBinary {
  if (-not (Test-Path $ElectronPackage) -or (Test-Path $ElectronExe) -or -not (Test-Path $ElectronInstall)) { return }

  Write-Warning 'Electron package ditemukan, tetapi electron.exe belum selesai diunduh.'
  Write-Host '==> Downloading Electron binary (status shown every 10 seconds)' -ForegroundColor Cyan
  $env:ELECTRON_GET_USE_PROXY = '1'
  $PreviousMirror = $env:ELECTRON_MIRROR
  Remove-Item Env:ELECTRON_MIRROR -ErrorAction SilentlyContinue
  $RepairExit = 1
  try {
    $RepairExit = Invoke-WithHeartbeat -FilePath (Get-Command node).Source -Arguments @(('"{0}"' -f $ElectronInstall)) -Activity 'Official Electron download' -TimeoutMinutes 5
  } catch {
    Write-Warning $_.Exception.Message
  }

  if ($RepairExit -ne 0 -or -not (Test-Path $ElectronExe)) {
    Write-Warning 'Official GitHub download lambat/gagal. Trying the Electron-documented CDN mirror.'
    $env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
    try {
      $RepairExit = Invoke-WithHeartbeat -FilePath (Get-Command node).Source -Arguments @(('"{0}"' -f $ElectronInstall)) -Activity 'Electron CDN mirror download' -TimeoutMinutes 15
    } catch {
      Write-Warning $_.Exception.Message
      $RepairExit = 1
    }
  }

  if ($null -eq $PreviousMirror) { Remove-Item Env:ELECTRON_MIRROR -ErrorAction SilentlyContinue }
  else { $env:ELECTRON_MIRROR = $PreviousMirror }

  if ($RepairExit -ne 0 -or -not (Test-Path $ElectronExe)) {
    throw @'
Download Electron binary gagal dari server resmi dan mirror CDN.
Periksa firewall/proxy atau coba jaringan lain, lalu jalankan CMD kembali.
Builder sudah menghentikan proses yang tidak bergerak agar tidak menunggu selamanya.
'@
  }
  Write-Host '==> Electron binary download complete' -ForegroundColor Green
}

Repair-ElectronBinary

if ((Test-NodeDependencies) -and -not $ForceInstall) {
  Write-Host '==> Local dependencies complete; skipping npm download' -ForegroundColor Green
  return
}

$env:npm_config_registry = 'https://registry.npmjs.org/'
$env:npm_config_prefer_offline = 'true'
$env:npm_config_fetch_retries = '5'
$env:npm_config_fetch_retry_mintimeout = '20000'
$env:npm_config_fetch_retry_maxtimeout = '120000'
$env:npm_config_audit = 'false'
$env:npm_config_fund = 'false'

Write-Host '==> Installing locked dependencies from public npm registry' -ForegroundColor Cyan
Write-Host '    Package install runs first; Electron binary is downloaded separately with visible status.' -ForegroundColor DarkGray
$env:ELECTRON_SKIP_BINARY_DOWNLOAD = '1'
npm ci --registry=https://registry.npmjs.org/ --prefer-offline --foreground-scripts --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000
$NpmExitCode = $LASTEXITCODE
Remove-Item Env:ELECTRON_SKIP_BINARY_DOWNLOAD -ErrorAction SilentlyContinue
if ($NpmExitCode -ne 0) {
  if (Test-NodeDependencies) {
    Write-Warning 'npm ci gagal, tetapi dependency lokal lengkap. Build dilanjutkan memakai node_modules lokal.'
    return
  }
  throw @'
npm dependency install gagal dan node_modules belum lengkap.

Yang sudah diperbaiki oleh builder:
- internal OpenAI/CAAS registry diganti ke https://registry.npmjs.org/
- retry dan timeout npm diperpanjang
- build berikutnya tidak download ulang jika node_modules sudah lengkap

Periksa koneksi internet/proxy, lalu jalankan kembali build-portable-single-exe.cmd.
'@
}

Repair-ElectronBinary

if (-not (Test-NodeDependencies)) {
  throw 'npm selesai tetapi dependency build penting belum ditemukan.'
}
