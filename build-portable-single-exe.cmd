@echo off
setlocal
cd /d "%~dp0"
title SONKUPIK STUDIO - Build Portable Single EXE
powershell -NoProfile -Command "$Host.UI.RawUI.WindowTitle='SONKUPIK STUDIO - Build Portable Single EXE'; Write-Host 'Starting portable build...' -ForegroundColor Cyan"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-portable-single-exe.ps1"
if errorlevel 1 (
  echo.
  echo BUILD FAILED
  pause
  exit /b 1
)
echo.
echo Output: release\sonkupik_karaoke.exe
pause
