# SONKUPIK STUDIO Native UI Prototype

This folder is a **visual-first Qt 6 / QML prototype**. It intentionally does not connect to K500 yet. The goal is to approve the premium mixer UI, interaction density, motion and control feel before porting the communication engine.

## Visual direction

- PEQ is the dominant hero control, with direct draggable bands and a compact selected-band control strip.
- Faders and rotary controls use restrained depth, fine highlights and small active accents rather than heavy skeuomorphism.
- Compressor behavior is visible through a live transfer curve.
- Music key remains a first-class operator control.
- Level meters use smooth motion plus peak hold and only introduce warm warning colors near headroom.
- No dashboard cards, onboarding copy, large explanatory text, mono fonts, particles or decorative animation.

## Font

The prototype uses **Plus Jakarta Sans** everywhere, including numeric readouts. Install Plus Jakarta Sans on the test PC before judging typography. The repository does not bundle a font binary at this stage.

## Requirements

- Qt 6.8 or newer
- Qt Quick + Qt Quick Controls 2
- CMake 3.21+
- Ninja
- A Desktop MSVC 2022 Qt kit on Windows

## Windows build

Example from Command Prompt:

```bat
set CMAKE_PREFIX_PATH=C:\Qt\6.8.3\msvc2022_64
build-windows.cmd
```

Or directly:

```bat
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
```

The prototype opens with animated mock meters. PEQ nodes, knobs, faders and Music Key are interactive, but nothing is transmitted to hardware.

## Next phase after visual approval

1. Extract visual/state models from mock properties.
2. Port K500 frame/command/parser logic to C++.
3. Add Bluetooth serial and USB HID transports.
4. Coalesce high-rate UI edits before hardware transmission.
5. Replace mock meter input with KTV telemetry when the new device protocol exposes it.
