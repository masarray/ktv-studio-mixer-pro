# Build portable Windows

For the fastest normal startup, use `build-installer.cmd` and install the
generated `SONKUPIK-STUDIO-<version>-Setup.exe`. The single-file portable build
is intended for no-install situations and Windows extracts it on every launch.

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

This public build is intentionally unsigned because the project does not ship
a private Windows signing certificate. Certificate autodiscovery and code
signing are disabled explicitly, so packaging does not spend minutes retrying
`signtool.exe`. Executable resource editing remains enabled; the application
icon, product name, and version are still embedded. Windows SmartScreen can
therefore show an "Unknown publisher" warning until an Authenticode certificate
is configured for an official signed release.

The portable wrapper uses the native process API instead of `Start-Process` so
Windows PowerShell 5.1 cannot turn a successful exit code `0` into an empty
value and report a false `BUILD FAILED`. Before each package run, only the
exact current-version output is removed; the script then verifies that the new
versioned EXE was actually created.

If a previous dependency installation is incomplete, delete `node_modules`
manually and run the CMD again. The script repairs inaccessible internal npm
registry URLs in `package-lock.json` and installs from `registry.npmjs.org`.
