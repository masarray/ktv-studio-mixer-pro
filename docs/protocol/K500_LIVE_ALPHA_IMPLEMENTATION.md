# K500 Live Alpha Implementation Notes

Source files added in v0.7:

```text
src/features/k500/protocol/frame.ts
src/features/k500/protocol/commands.ts
src/features/k500/live/liveStore.ts
src/components/studio/LiveDevicePanel.tsx
src/types/web-serial.d.ts
```

Integration points:

- `src/features/k500/store.ts`
  - after `setBandValue`, sends EQ live command when live mode is ON.
  - after known `setPath`/`toggle`, sends live path updates when live mode is ON.
- `src/components/studio/StudioShell.tsx`
  - adds compact connect/live/ping/mute control in top bar.
- `src/components/studio/MasterSection.tsx`
  - adds live serial inspector/log in right rail.

## Confirmed command builders

### Heartbeat

```text
AA 01 1C E3
```

### Mute

```text
Mute ON  = AA 03 15 01 00 E7
Mute OFF = AA 03 15 00 00 E8
```

### EQ write

```text
AA 09 03 SS BI FL FH QQ TG GG TT CS
```

Section IDs:

```text
00 Mic A
01 Mic B
02 Music
03 Main
05 Surround
07 Center
08 Subwoofer
09 Reverb
0A Echo
```

Type/sign byte:

```text
P  positive = 00
P  negative = 80
LS positive = 10
LS negative = 90
HS positive = 20
HS negative = A0 (inferred)
```

Music target byte uses `TT=60`; other captured sections use `TT=00`.

### Output block

```text
AA 25 0E SS D0 ... D34 CS
```

Output IDs:

```text
00 Main
02 Surround
04 Center
05 Subwoofer
```

Key byte mapping:

```text
D0  output L/mono raw dB
D2  output R raw dB where applicable
D4  Mic level %
D6  Music level %
D8  Reverb level %
D10 Echo level %
D12 Compressor threshold raw = dB + 50
D13 Compressor ratio direct
D14 Compressor attack ms
D15 Compressor release x10
D16-D17 Surround L delay uint16 LE
D18-D19 Surround R delay uint16 LE
```
