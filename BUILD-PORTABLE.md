# Build portable Windows

1. Install Node.js 22 x64 or newer.
2. Extract this project to a normal local folder, for example `D:\Git\ktv-studio-mixer-pro`.
3. Double-click `build-portable-single-exe.cmd`.
4. The result is `release\SONKUPIK-STUDIO-<version>-Portable.exe`.

If an older build is currently stopped at `Downloading Electron binary...`,
press `Ctrl+C` and use this updated project. An interrupted Electron download
is now detected before native validation, progress is printed every 10 seconds,
and stalled operations are stopped with a clear timeout instead of waiting
forever.

Python and Visual Studio Build Tools are not required. The builder uses the
prebuilt Windows N-API binaries supplied by `node-hid` and `serialport`.
During build it only checks that those binary files exist. It does not launch
Electron or enumerate USB/HID hardware, because some Windows HID drivers can
block enumeration even though the module itself is valid.

If a previous dependency installation is incomplete, delete `node_modules`
manually and run the CMD again. The script repairs inaccessible internal npm
registry URLs in `package-lock.json` and installs from `registry.npmjs.org`.
