@echo off
setlocal
cd /d "%~dp0"

where cmake >nul 2>nul || (
  echo [SONKUPIK] CMake tidak ditemukan.
  echo Install Qt 6.8+ Desktop MSVC 2022 melalui Qt Online Installer.
  pause
  exit /b 1
)

set "BUILD_DIR=build"

if not defined CMAKE_PREFIX_PATH (
  echo [SONKUPIK] CMAKE_PREFIX_PATH belum diset ke folder Qt MSVC.
  echo Contoh:
  echo   set CMAKE_PREFIX_PATH=C:\Qt\6.8.3\msvc2022_64
  echo lalu jalankan kembali file ini.
  pause
  exit /b 1
)

cmake -S . -B "%BUILD_DIR%" -G Ninja -DCMAKE_BUILD_TYPE=Release || exit /b 1
cmake --build "%BUILD_DIR%" --config Release || exit /b 1

echo.
echo [SONKUPIK] Build selesai:
echo   %CD%\%BUILD_DIR%\SONKUPIK-STUDIO-Native-UI.exe
pause
