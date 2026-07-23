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
  # Windows PowerShell 5.1 can return a Process object whose ExitCode remains
  # null when Start-Process is polled manually. Use ProcessStartInfo directly
  # so a successful native exit is always returned as the integer 0.
  $StartInfo = New-Object System.Diagnostics.ProcessStartInfo
  $StartInfo.FileName = $FilePath
  $StartInfo.Arguments = ($Arguments -join ' ')
  $StartInfo.WorkingDirectory = (Get-Location).Path
  $StartInfo.UseShellExecute = $false
  $StartInfo.CreateNoWindow = $true

  $Process = New-Object System.Diagnostics.Process
  $Process.StartInfo = $StartInfo
  try {
    if (-not $Process.Start()) { throw "Gagal memulai $Activity." }
    while (-not $Process.WaitForExit(10000)) {
      $Elapsed = [int]((Get-Date) - $Started).TotalSeconds
      Write-Host ("    {0} masih berjalan... {1} detik" -f $Activity, $Elapsed) -ForegroundColor DarkGray
      if ($Elapsed -ge ($TimeoutMinutes * 60)) {
        try { $Process.Kill() } catch { }
        $Process.WaitForExit()
        throw "$Activity melewati batas waktu $TimeoutMinutes menit. Proses dihentikan."
      }
    }
    $Process.WaitForExit()
    $Process.Refresh()
    return [int]$Process.ExitCode
  } finally {
    $Process.Dispose()
  }
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

# This public build has no Windows code-signing certificate. Prevent
# electron-builder from spending minutes discovering/retrying local signers.
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'

Write-Host '==> SONKUPIK STUDIO: portable single EXE' -ForegroundColor Cyan
Write-Host ("    Node {0} | npm {1}" -f (& node --version), (& npm --version)) -ForegroundColor DarkGray
if (-not $SkipInstall) {
  Write-Host '[1/6] Checking project dependencies' -ForegroundColor Cyan
  & (Join-Path $PSScriptRoot 'ensure-node-dependencies.ps1') -ForceInstall:$ForceInstall
}

Write-Host '[2/6] Building production web app' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Production build gagal.' }

Write-Host '[3/6] Validating built-in PC Mode presets' -ForegroundColor Cyan
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

Write-Host '[4/6] Validating embedded desktop server' -ForegroundColor Cyan
& node (Join-Path $RepoRoot 'scripts\test-desktop-server.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Desktop server validation gagal.' }

$ElectronBuilder = Join-Path $RepoRoot 'node_modules\.bin\electron-builder.cmd'
if (-not (Test-Path $ElectronBuilder)) { throw 'electron-builder lokal tidak ditemukan.' }
$ElectronExe = Join-Path $RepoRoot 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path $ElectronExe)) {
  throw 'Electron belum terpasang lengkap (electron.exe tidak ditemukan). Jalankan build kembali tanpa opsi SkipInstall.'
}

Write-Host '[5/6] Checking packaged Windows native module binaries' -ForegroundColor Cyan
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

Write-Host '[6/6] Packaging versioned portable EXE' -ForegroundColor Cyan
Write-Host '      Tahap ini dapat memerlukan beberapa menit. Output Electron Builder akan tetap terlihat.' -ForegroundColor DarkGray
npm run desktop:prepare
if ($LASTEXITCODE -ne 0) { throw 'Electron package metadata cleanup gagal.' }
npm run test:windows-packaging
if ($LASTEXITCODE -ne 0) { throw 'Konfigurasi unsigned Windows package tidak valid.' }
$BuilderCli = Join-Path $RepoRoot 'node_modules\electron-builder\cli.js'
if (-not (Test-Path $BuilderCli)) { throw 'electron-builder CLI tidak ditemukan.' }
$PackageVersion = (Get-Content (Join-Path $RepoRoot 'package.json') -Raw | ConvertFrom-Json).version
$ExpectedOutput = Join-Path $RepoRoot "release\SONKUPIK-STUDIO-$PackageVersion-Portable.exe"
if (Test-Path $ExpectedOutput) {
  Remove-Item $ExpectedOutput -Force
}
$PackagingStarted = Get-Date
$PackageExit = Invoke-WithHeartbeat -FilePath (Get-Command node).Source -Arguments @(('"{0}"' -f $BuilderCli), '--win', 'portable', '--x64', '--publish', 'never') -Activity 'Electron packaging' -TimeoutMinutes 20
if ($null -eq $PackageExit) {
  # Defensive fallback for unusual Windows hosts: accept only a newly-created,
  # non-trivial artifact. The exact-version stale artifact was removed above.
  $GeneratedOutput = Get-Item $ExpectedOutput -ErrorAction SilentlyContinue
  if ($GeneratedOutput -and $GeneratedOutput.Length -gt 10MB -and $GeneratedOutput.LastWriteTime -ge $PackagingStarted.AddSeconds(-2)) {
    Write-Warning 'Exit code native process tidak tersedia, tetapi artifact baru berhasil dibuat; melanjutkan validasi package.'
    $PackageExit = 0
  } else {
    throw 'electron-builder selesai tanpa exit code dan tidak menghasilkan artifact baru yang valid.'
  }
}
if ($PackageExit -ne 0) { throw "electron-builder portable gagal (exit code $PackageExit)." }

$Output = Get-Item $ExpectedOutput -ErrorAction SilentlyContinue
if (-not $Output) { throw 'Portable executable tidak ditemukan di folder release.' }
$PackagedPreset = Join-Path $RepoRoot 'release\win-unpacked\resources\presets\KARAOKE_ARTIST_LUXURY.k500'
if (-not (Test-Path $PackagedPreset)) { throw 'Built-in KARAOKE ARTIST LUXURY tidak ikut ke package.' }
$PresetBytes = [IO.File]::ReadAllBytes($PackagedPreset)
$PresetChecksum = 0
foreach ($Byte in $PresetBytes) { $PresetChecksum = ($PresetChecksum + $Byte) -band 0xff }
if ($PresetBytes.Length -ne 1144 -or $PresetChecksum -ne 0) { throw 'Built-in preset package tidak valid.' }

Write-Host ''
Write-Host 'BUILD SUCCESS' -ForegroundColor Green
Write-Host $Output.FullName -ForegroundColor Yellow
