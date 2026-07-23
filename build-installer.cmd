@echo off
setlocal
cd /d "%~dp0"
title SONKUPIK STUDIO - Build Fast Start Installer
powershell -NoProfile -Command "$Host.UI.RawUI.WindowTitle='SONKUPIK STUDIO - Build Fast Start Installer'; Write-Host 'Starting installer build...' -ForegroundColor Cyan"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-windows-release.ps1" -Target Installer
if errorlevel 1 (
  echo.
  echo BUILD FAILED
  pause
  exit /b 1
)
echo.
echo Output: release\SONKUPIK-STUDIO-^<version^>-Setup.exe
pause
