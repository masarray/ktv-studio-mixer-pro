@echo off
setlocal
cd /d "%~dp0"
title SONKUPIK STUDIO - Build Portable and Installer
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-windows-release.ps1"
if errorlevel 1 (
  echo.
  echo BUILD FAILED
  pause
  exit /b 1
)
echo.
echo Output tersedia di folder release.
pause
