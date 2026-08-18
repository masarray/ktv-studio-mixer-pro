# K500 BIT-PERFECT AI PRESET MODIFICATION & AUDIO SIGNAL FLOW GUIDE

> **Purpose** — This document is the single technical reference for AI-assisted `.k500` preset analysis, simulation, modification, auditing, and cross-firmware porting.
>
> The primary rule is simple: **preserve first, understand second, modify third, validate last.**

---

## 1. Scope

This guide documents the currently proven K500 preset container and the engineering rules required to modify it safely.

It covers:

- `.k500` binary structure;
- checksum and name handling;
- known scalar controls;
- PEQ and crossover encoding;
- Main / Center / Surround / Sub / Reverb / Echo routing;
- cumulative audio signal flow;
- serial vs parallel transfer-function analysis;
- bit-perfect patch methodology;
- simulation methodology;
- firmware V2.00 compatibility strategy;
- AI-specific safety and validation rules;
- audio-tuning lessons learned from real-device listening.

This document is intentionally conservative. **Unknown bytes remain unknown until proven by controlled delta testing.**

---

# 2. Golden Rules for AI Modification

Every AI or automation modifying K500 presets MUST obey these rules.

## 2.1 Start from the exact source bytes

Always begin from the original preset byte array:

```text
source bytes -> explicit patch -> checksum -> diff audit -> output
```

Do **not** deserialize the complete preset to a normalized object and then serialize the whole object back unless byte-perfect round-trip behavior has been proven for every field.

## 2.2 No-op means byte-identical

If no user-visible parameter is intentionally changed, the output MUST be bit-for-bit identical to the input.

A parser/serializer that produces a different binary after a no-op round trip is not bit-perfect.

## 2.3 Patch whitelist only

Before modifying a file, create an explicit whitelist of offsets allowed to change.

After writing:

```text
changed_offsets = diff(source, output)
unexpected = changed_offsets - allowed_offsets
assert unexpected == empty
```

Any unexpected byte difference is a failure.

## 2.4 Preserve unknown/reserved bytes

Never zero, normalize, average, reorder, or regenerate bytes whose semantics have not been proven.

This is especially important for:

- reserved bytes inside EQ crossover footers;
- `mainAlt`;
- `surroundAlt`;
- `centerAlt`;
- `subAlt`;
- firmware-specific unknown blocks;
- duplicate/mirrored values not yet proven to be authoritative.

## 2.5 Listening beats simulation

The canonical software simulation is useful for relative design and auditing, but real K500 hardware listening is the final authority.

Use simulation to answer:

- what changed;
- where energy moved;
- whether cumulative EQ is excessive;
- whether one version is brighter/warmer/deeper than another;
- whether wet-mid energy is likely to mask dry vocal.

Do **not** claim that simulation proves the exact hardware DSP coefficients or acoustic response.

---

# 3. K500 Preset Container

## 3.1 File size

Known K500 preset files are:

```text
1144 bytes decimal
0x478 bytes hexadecimal
```

## 3.2 Checksum

Checksum byte:

```text
CHECKSUM_OFFSET = 0x0475
```

A valid preset satisfies:

```text
sum(all 1144 bytes) % 256 == 0
```

Safe checksum update:

```python
data[0x0475] = 0
data[0x0475] = (-sum(data)) & 0xFF
assert sum(data) % 256 == 0
```

The checksum MUST be recomputed after all other modifications.

## 3.3 Name field

```text
NAME_OFFSET = 0x0454
NAME_LENGTH = 0x21   # 33 bytes
```

Important:

- device-visible names are commonly kept at **16 characters or fewer**;
- padding style can vary between preset/firmware generations;
- do not rewrite the name field unless requested or required;
- when porting to an old firmware preset, preserve the old firmware's padding convention when possible.

Observed old V2.00 style can use a 16-byte space-padded visible name followed by zeroes.

---

# 4. Critical Round-Trip Hazards

## 4.1 PEQ `P` aliases

The following raw type values are all observed as peaking/parametric `P`:

```text
0x0000 -> P
0x0001 -> P
0x0002 -> P
0x0003 -> P
```

Shelves:

```text
0x0100 -> LS
0x0200 -> HS
```

If the user only changes gain/frequency/Q, **preserve the exact original typeRaw**.

Do not normalize `0x0001`, `0x0002`, or `0x0003` back to `0x0000` merely because all display as `P`.

## 4.2 FBX bytes are independently stored

Known bytes:

```text
0x001B
0x001C
```

The UI may expose them as one shared FBX/depth value, but real presets can contain different raw values.

Therefore:

- do not average and rewrite both bytes during an unrelated edit;
- preserve each raw byte independently unless the FBX parameter is explicitly changed.

## 4.3 Name padding is not semantically neutral

Two names that render identically can have different trailing-space/zero layouts.

Preserve the original binary name field unless a rename is explicitly needed.

## 4.4 Crossover mirrors exist

Many crossover frequencies exist both as scalar/global copies and inside EQ section footers.

When intentionally changing a crossover, update all **proven mirrors** consistently.

When not changing it, preserve every raw copy.

---

# 5. EQ Section Binary Layout

Each known EQ section begins with:

```text
+0x00  enabledFlag : uint16 LE
```

Each EQ band is 8 bytes:

```text
+0x00  typeRaw      : uint16 LE
+0x02  frequencyHz  : uint16 LE
+0x04  qRaw         : uint16 LE   # Q = qRaw / 10
+0x06  gainRaw      : int16 LE    # gain dB = gainRaw / 10
```

After the last band, a 12-byte crossover footer is present:

```text
+0x00  LP type raw  : uint16 LE
+0x02  LP frequency : uint16 LE
+0x04  UNKNOWN      : 4 bytes - preserve exactly
+0x08  HP type raw  : uint16 LE
+0x0A  HP frequency : uint16 LE
```

Do not overwrite the unknown middle four bytes.

---

# 6. EQ Section Map

| Section | Offset | Bands | Status |
|---|---:|---:|---|
| Mic A | `0x00F0` | 10 | proven primary |
| Mic B | `0x0150` | 10 | proven primary |
| Music | `0x01B0` | 7 | proven primary |
| Main | `0x01F8` | 7 | proven primary |
| Main Alt | `0x0240` | 7 | **role not fully proven** |
| Surround | `0x0288` | 5 | proven primary |
| Surround Alt | `0x02C0` | 5 | **role not fully proven** |
| Center | `0x02F8` | 5 | proven primary |
| Center Alt | `0x0330` | 5 | **role not fully proven** |
| Subwoofer | `0x0368` | 5 | proven primary |
| Sub Alt | `0x03A0` | 5 | **role not fully proven** |
| Reverb | `0x03D8` | 5 | proven primary |
| Echo | `0x0410` | 5 | proven primary |

### AI rule for `*Alt` blocks

Until their runtime semantics are proven:

> **READ is allowed. WRITE is forbidden unless a controlled hardware delta test specifically targets the block.**

---

# 7. Crossover Type Encoding

The low byte encodes the filter family/order.

| Code | Filter |
|---:|---|
| `1` | Bessel 2nd order / 12 dB |
| `2` | Butterworth 2nd order / 12 dB |
| `3` | Bessel 3rd order / 18 dB |
| `4` | Butterworth 3rd order / 18 dB |
| `5` | Bessel 4th order / 24 dB |
| `6` | Butterworth 4th order / 24 dB |
| `7` | Linkwitz-Riley 4th order / 24 dB |

Raw values:

```text
LP raw = 0x0300 | code
HP raw = 0x0400 | code
```

Examples:

```text
0x0306 = LP Butterworth 4th order
0x0407 = HP Linkwitz-Riley 4th order
```

---

# 8. Proven Scalar Crossover Mirrors

## Mic

```text
Mic A/B HPF  0x0098
Mic A/B LPF  0x009A
```

## Music

```text
Music HPF    0x009C
Music LPF    0x009E
```

## Main

```text
Main HPF     0x00A0
MainAlt HPF  0x00A2
Main LPF     0x00A4
MainAlt LPF  0x00A6
```

## Surround

```text
Surround HPF     0x00A8
SurroundAlt HPF  0x00AA
Surround LPF     0x00AC
SurroundAlt LPF  0x00AE
```

## Center

```text
Center HPF     0x00B0
CenterAlt HPF  0x00B2
Center LPF     0x00B4
CenterAlt LPF  0x00B6
```

## Sub

```text
Sub HPF     0x00B8
SubAlt HPF  0x00BA
Sub LPF     0x00BC
SubAlt LPF  0x00BE
```

## FX

```text
Reverb HPF  0x00C0
Reverb LPF  0x00C2
Echo HPF    0x00C4
Echo LPF    0x00C6
```

When changing a primary crossover, patch both its scalar copy and its EQ-footer mirror.

Do not automatically rewrite the corresponding `Alt` scalar unless its linkage is proven.

---

# 9. Known System / Mic / Music Scalars

## System

```text
0x0008  topMusicVol
0x0009  topMicVol
0x000A  topEffectVol
0x000B  musicInitVol
0x000C  musicMaxVol
0x0012  micInitVol
0x0013  micMaxVol
0x001D  effectInitLevel
0x0095  U-Disk record raw, UI = raw + 1
0x0096  USB record raw, UI = raw + 1
```

## Mic

```text
0x0014  Mic A volume
0x0015  Mic B volume
0x0016  noise gate raw, dB = raw - 81
0x0017  compressor threshold raw, dB = raw - 50
0x0018  compressor ratio
0x0019  compressor attack ms
0x001A  compressor release, sec = raw / 10
0x001B  FBX raw A
0x001C  FBX raw B
0x0092  Mic A/B EQ link flag, 1 = linked
0x0098  Mic HPF
0x009A  Mic LPF
```

## Music

Source:

```text
0x000E
0 = Input 1
1 = Input 2
2 = Bluetooth
3 = U-Disk
4 = Digital
```

Key:

```text
0x0011
UI key = raw - 7
```

Input trims:

```text
0x001E  Input 1 gain, dB = raw - 12
0x001F  Input 2 gain, dB = raw - 12
0x0020  Bluetooth gain, dB = raw - 12
0x0021  U-Disk gain, dB = raw - 12
0x0022  Digital gain, dB = raw - 12
```

---

# 10. Output Gain Encoding

Known output-volume encoding:

```text
dB = (raw - 75) / 2
raw = round(dB * 2 + 75)
```

Example:

```text
raw 99 -> +12 dB
```

---

# 11. Main Output Map

```text
0x0024  Main L volume
0x0026  Main R volume
0x0028  Main Mic Direct
0x002A  Main Music level
0x002C  Main Reverb return
0x002E  Main Echo return
0x0030  Main compressor threshold raw, dB = raw - 50
0x0031  Main compressor ratio
0x0032  Main compressor attack ms
0x0033  Main compressor release sec = raw / 10
```

---

# 12. Surround Output Map

```text
0x0038  Surround L volume
0x003A  Surround R volume
0x003C  Surround Mic Direct
0x003E  Surround Music level
0x0040  Surround Reverb level
0x0042  Surround Echo level
0x0044  Surround compressor threshold raw, dB = raw - 50
0x0045  Surround compressor ratio
0x0046  Surround compressor attack ms
0x0047  Surround compressor release sec = raw / 10
0x00D8  Surround L delay ms, uint16 LE
0x00DA  Surround R delay ms, uint16 LE
```

### Recommended conceptual role

Surround should normally be designed as:

```text
width + ambience + 3D halo
```

not as a second Main output.

Typical luxury-system strategy:

- lower direct Mic/Music than Main;
- relatively stronger wet Reverb/Echo;
- modest asymmetric L/R delay for decorrelation;
- HPF high enough to avoid competing with Main/Sub bass;
- recessed wet mid so the rear/side field is felt rather than heard as a second singer.

---

# 13. Center Output Map

```text
0x004C  Center output volume
0x0050  Center Mic Direct
0x0052  Center Music level
0x0054  Center Reverb level
0x0056  Center Echo level
0x0058  Center compressor threshold raw, dB = raw - 50
0x0059  Center compressor ratio
0x005A  Center compressor attack ms
0x005B  Center compressor release sec = raw / 10
```

### Recommended conceptual role

Center should normally act as:

```text
lead / vocal anchor
```

It should not simply duplicate Main at equal level.

---

# 14. Subwoofer Output Map

```text
0x0060  Sub output volume
0x0064  Sub Mic Direct
0x0066  Sub Music level
0x0068  Sub Reverb level
0x006A  Sub Echo level
0x006C  Sub compressor threshold raw, dB = raw - 50
0x006D  Sub compressor ratio
0x006E  Sub compressor attack ms
0x006F  Sub compressor release sec = raw / 10
0x00B8  Sub HPF
0x00BC  Sub LPF
```

### Recommended conceptual role

For polished karaoke/music playback:

```text
Main = tonal body and punch
Sub  = deep low-frequency foundation
```

Avoid using the Sub as an upper-bass duplicate of Main.

A useful design target is often to emphasize roughly 40–70 Hz while controlling 80–120 Hz overlap, but final crossover/level depends strongly on the room, speakers, polarity, phase, and placement.

For clean karaoke presets, Mic/Reverb/Echo feeds to Sub are usually best kept at zero unless a specific effect is proven beneficial.

---

# 15. Reverb Map

```text
0x0074  internal Reverb level
0x00C0  Reverb HPF
0x00C2  Reverb LPF
0x00C8  decay ms, uint16 LE
0x00CA  predelay ms, uint16 LE
```

Main/Center/Surround each have independent Reverb return levels.

---

# 16. Echo Map

```text
0x007B  internal Echo level
0x007C  Echo repeat
0x00C4  Echo HPF
0x00C6  Echo LPF
0x00CC  left/primary delay ms, uint16 LE
```

Main/Center/Surround each have independent Echo return levels.

---

# 17. Canonical Audio Signal Flow

This topology is the authoritative model for preset analysis unless new hardware evidence disproves it.

## 17.1 Music path

```text
Input / Bluetooth / Digital / U-Disk
    -> source/input level
    -> Music PEQ + HPF/LPF
    -> output routing
    -> Main PEQ + HPF/LPF
    -> Main output volume
    -> Main output
```

For tonal analysis of Music through Main:

```text
Music -> Music EQ -> Main EQ
```

The serial magnitude response is cumulative.

## 17.2 Mic dry path

```text
Mic A/B
    -> mic gain / gate / compressor / FBX
    -> Mic PEQ + HPF/LPF
    -> output routing
    -> Main PEQ
    -> Main output volume
    -> Main output
```

For static tonal analysis:

```text
Mic -> Mic EQ -> Main EQ
```

## 17.3 FX branches

Reverb and Echo receive the mic after Mic PEQ.

Conceptually:

```text
Mic -> Mic PEQ -> +---------------- dry -------------------+
                  |                                        |
                  +-> Reverb -> Reverb EQ -> return -------+-> output bus -> output EQ -> volume
                  |                                        |
                  +-> Echo   -> Echo EQ   -> return -------+

Music -> Music PEQ ----------------------------------------+
```

The dry, Reverb, and Echo paths are **parallel**, not serial.

---

# 18. Serial vs Parallel Analysis

## 18.1 Serial EQ stages

For serial linear filters:

```text
H_total(f) = H1(f) * H2(f) * H3(f)
```

Magnitude in dB:

```text
G_total_dB(f) = G1_dB(f) + G2_dB(f) + G3_dB(f)
```

Examples:

```text
Music -> Music PEQ -> Main PEQ
Mic   -> Mic PEQ   -> Main PEQ
```

It is correct to add their magnitude responses in dB for static tonal analysis.

## 18.2 Parallel dry / Reverb / Echo branches

Do **not** do this:

```text
Dry_dB + Reverb_dB + Echo_dB
```

That is mathematically wrong because the branches are parallel and time-dependent.

For preset auditing, report them separately:

- Dry Mic -> Main tonal response;
- Reverb wet tonal response;
- Echo wet tonal response;
- return levels;
- delay / predelay / decay / repeats.

Full summation would require complex transfer functions plus time-domain behavior and relative phase.

---

# 19. Canonical EQ Simulation Model

The Studio EQ graph uses a 48 kHz digital model.

Recommended analysis grid:

```text
sample rate = 48000 Hz
frequency range = 20 Hz .. 20 kHz
log grid = 4096 points for response plots
```

Use RBJ-style digital biquads for:

- Peaking EQ;
- Low Shelf;
- High Shelf.

For crossover analysis:

- Butterworth uses its standard order response;
- Bessel is normalized to approximately the -3 dB cutoff convention used by the Studio model;
- LR24 is modeled as two cascaded Butterworth 2nd-order stages, giving approximately -6 dB at Fc.

### Important limitation

This simulation is a **canonical software model**, not proof that every K500 firmware revision uses identical internal biquad coefficients or sample rate.

---

# 20. Relative Broadband EQ-Gain Audit

A useful theoretical metric for comparing presets is:

```text
10 * log10(mean(10 ** (response_db / 10)))
```

Use a linear frequency grid over approximately 20 Hz–20 kHz.

This metric is useful for relative comparison of broadband EQ amplification.

It is **NOT** a measured hardware noise floor.

Never report it as measured hiss/noise in dB.

---

# 21. Dynamics Are Not Static EQ

Do not mix dynamics into static frequency-response arithmetic.

These controls are level/time dependent:

- noise gate;
- compressor;
- FBX;
- limiter-like output compression;
- Echo repeats;
- Reverb decay.

A static response plot can show PEQ and crossovers, but not fully predict:

- perceived vocal effort;
- pumping;
- sustain;
- phrase support;
- transient impact;
- feedback stability.

---

# 22. Proven Bit-Perfect Patch Workflow

Use this workflow for every generated preset.

## Step 1 — Load source

```python
source = Path(file).read_bytes()
assert len(source) == 1144
assert sum(source) % 256 == 0
working = bytearray(source)
```

## Step 2 — Declare allowed bytes

```python
allowed = set()
```

Every setter must register the exact byte offsets it writes.

## Step 3 — Patch only requested fields

Example gain patch:

```python
struct.pack_into('<h', working, gain_offset, round(gain_db * 10))
allowed.update({gain_offset, gain_offset + 1})
```

## Step 4 — Patch proven mirrors

If changing a crossover, update the scalar copy and primary EQ-footer mirror.

Do not modify an unknown `Alt` copy unless proven.

## Step 5 — Checksum last

```python
working[0x0475] = 0
working[0x0475] = (-sum(working)) & 0xFF
allowed.add(0x0475)
```

## Step 6 — Validate

```python
assert len(working) == 1144
assert sum(working) % 256 == 0
```

## Step 7 — Diff audit

```python
diffs = [i for i in range(1144) if source[i] != working[i]]
unexpected = [i for i in diffs if i not in allowed]
assert not unexpected
```

## Step 8 — Protected-region assertions

If a task modifies only Mic/Reverb, explicitly assert unrelated blocks remain identical.

Example:

```python
assert working[MUSIC_START:MAIN_END] == source[MUSIC_START:MAIN_END]
assert working[SUB_START:SUB_END] == source[SUB_START:SUB_END]
```

The more surgical the change, the stronger the protected-region checks should be.

---

# 23. Safe Cross-Firmware Porting

A firmware revision MUST NOT be assumed compatible merely because the device name is the same.

First audit:

1. file length;
2. checksum rule;
3. name offset;
4. EQ section offsets;
5. PEQ raw encodings;
6. crossover encodings;
7. output scalar offsets;
8. controlled delta behavior if hardware is available.

## 23.1 Firmware V2.00 finding

A known K500 firmware V2.00 preset was observed with:

```text
size            = 1144 bytes
checksum rule   = same modulo-256 rule
name field      = same offset/length
primary EQ map  = same offsets
P/LS/HS types   = same encoding family
HP/LP types     = same 0x04xx / 0x03xx family
output scalars  = same known offsets
```

This strongly supports structural compatibility.

### V2.00 porting rule

Build every old-firmware preset from an **old-firmware source container**:

```text
V2.00 source bytes
    -> copy only proven semantic controls from tuned reference
    -> preserve V2.00 unknown/reserved/Alt bytes
    -> recompute checksum
```

Do NOT simply rename a newer-firmware binary and assume it is safe.

---

# 24. Output-System Design Philosophy

For a polished multi-output K500 system, treat outputs as one coordinated sound field.

```text
                     +-> MAIN ------> primary tonal focus / front image
Music + Vocal + FX --+-> CENTER ----> lead / vocal anchor
                     +-> SURROUND --> width / ambience / 3D halo
Music ----------------> SUB --------> deep low-frequency foundation
```

The goal is not to make every speaker equally loud.

The goal is:

```text
Main       = focus
Center     = anchor
Surround   = space
Sub        = foundation
```

---

# 25. Audio-Tuning Lessons from Real K500 Listening

These are practical listening lessons and should influence future AI tuning.

## 25.1 Do not force every genre to match one numerical body target

A previous tuning approach attempted to make all modes equal to a reference preset in 130–300 Hz energy.

Real listening showed this can make some genres too thick or too forward in low-mid.

Correct principle:

> **Preserve a consistent quality standard, not identical frequency energy.**

Pop, Rock, Jazz, Qori, MC, Dangdut, and Reggae should not have identical body contours.

## 25.2 Warm/deep body belongs mainly to dry vocal

For a polished anti-thin vocal:

```text
~100–180 Hz  = chest / authority
~180–350 Hz  = warmth / body
~400–800 Hz  = monitor carefully for boxiness/mud
```

Do not create warmth mainly by letting Reverb carry excessive low-mid.

## 25.3 Audible Reverb mid causes a floating vocal

A recurring listening problem is a vocal that sounds slightly `ngambang` / detached.

Typical cause:

```text
wet 1–3 kHz too audible
+ Center wet mid
+ Surround wet mid
```

The correction is normally:

- keep dry body;
- high-pass Reverb more strongly;
- recess Reverb around 1–3 kHz;
- recess Center/Surround wet mid;
- reduce wet return slightly if needed;
- preserve upper-air tail.

The goal is:

> **hear the vocal, feel the room.**

Not:

> **hear the vocal and hear a second midrange reverb layer.**

## 25.4 Crisp and airy are not the same as sibilant

Useful conceptual regions:

```text
3–6 kHz    = articulation / crispness
8–10 kHz   = common S / SH risk region
12–16 kHz  = air / gloss / expensive tail
```

A successful polished vocal can therefore use:

```text
controlled 8–10 kHz pocket
+ recovered 12–16 kHz air
```

Do not solve sibilance by closing the entire treble range.

## 25.5 Effortless projection is a system behavior

A singer feeling that they do not need to `ngotot` is not caused by one EQ band.

It depends on the combination of:

- dry body;
- presence balance;
- compressor threshold/ratio/attack/release;
- Center support;
- Reverb predelay;
- wet return amount;
- wet mid masking;
- Echo thickness;
- Main cumulative EQ.

Treat `easy singing` as a whole-path property.

## 25.6 Predelay protects pitch/control cues

A modest predelay allows the dry vocal to arrive clearly before the Reverb field.

Too little predelay can mask self-monitoring and make pitch control feel harder.

Too much can make the Reverb feel disconnected.

Use real-device listening to tune the balance.

## 25.7 MC / Podcast / Radio should be exciting without obvious reverb

For MC / podcast / radio / trailer voice:

- deep dry chest is desirable;
- compression can add authority;
- articulation and air should remain crisp;
- ambience should normally be **felt, not clearly heard**;
- use shorter decay;
- higher Reverb HPF;
- lower Reverb return;
- very small slap/echo, if any;
- preserve direct Center anchoring.

The target is:

```text
deep + close + crisp + airy + alive
```

not:

```text
deep voice + karaoke reverb
```

## 25.8 Dangdut, Pop, Rock, Qori etc. share quality goals, not identical voicing

A useful common vocal-quality target is:

```text
deep body
-> effortless projection
-> crisp articulation
-> controlled S
-> airy tail
-> FX support
-> easy pitch control
```

But genre blending still matters.

Examples:

- Dangdut can be wetter and more rhythmic;
- modern Pop can be glossy and wide;
- Rock should be tighter and forward;
- Jazz should retain dynamics/naturalness;
- Acoustic should remain close and transparent;
- Qori can be spacious/syahdu but direct makhraj must stay anchored;
- MC should be much drier and clearer;
- Reggae may use more rhythmic Echo and deeper bass.

---

# 26. Noise / Headroom Audit Philosophy

A preset can sound impressive yet have excessive cumulative boost.

Audit at minimum:

```text
Music EQ
Main EQ
Music -> Main cumulative response
Mic EQ
Mic -> Main cumulative response
Reverb wet EQ
Echo wet EQ
output gains
compressor thresholds
```

Large positive cumulative gain can increase:

- headroom pressure;
- clipping risk;
- noise audibility;
- feedback sensitivity.

However, do not optimize solely for the smallest numerical gain.

The target is a **sonic-benefit / noise-headroom sweet spot**.

---

# 27. AI Anti-Patterns — Never Do These

## Binary anti-patterns

- deserialize everything and rewrite everything;
- normalize all `P` aliases to `0x0000`;
- average FBX bytes and rewrite both during unrelated edits;
- zero unknown footer bytes;
- rewrite `*Alt` blocks because they look similar;
- rewrite the whole name field unnecessarily;
- skip checksum validation;
- skip post-write byte diff;
- assume new and old firmware containers are interchangeable without audit.

## Audio anti-patterns

- add dry + Reverb + Echo dB responses as if serial;
- call theoretical broadband EQ gain a measured noise floor;
- force every genre to the same response target;
- solve thin vocal only with low-mid Reverb;
- solve sibilance by killing all high frequencies;
- make Surround a duplicate of Main;
- make Sub a duplicate of Main upper bass;
- judge a dynamic compressor from a static EQ plot;
- override real listening feedback because a simulation looks better.

---

# 28. Recommended AI Audit Report

Every modified preset should report at least:

```text
Source file
Output file
File size
Checksum valid / invalid
SHA-256
Changed byte count
Unexpected changed byte count
Protected blocks confirmed unchanged
```

Then list intentional audio changes:

```text
Mic PEQ
Music PEQ
Main PEQ
Reverb PEQ / HPF / LPF / decay / predelay / return
Echo PEQ / HPF / LPF / delay / repeats / return
Center routing/EQ
Surround routing/EQ/delay
Sub routing/EQ/crossover
Dynamics changes
```

For simulation, report useful normalized key frequencies instead of only one composite score.

---

# 29. Suggested New-Thread Handoff Prompt

When starting a new AI discussion, use this short instruction:

```text
Read docs/K500_BIT_PERFECT_AI_PRESET_GUIDE.md first.
Treat it as the authoritative K500 binary/signal-flow reference.
Use source-byte patching, explicit offset whitelists, checksum validation,
post-write diff audits, and preserve all unknown/Alt bytes.
Listening feedback from the real K500 device overrides simulation.
```

If a task involves a new firmware revision, add:

```text
Do not assume binary compatibility. Audit the new firmware preset against
this guide before porting any semantic controls.
```

---

# 30. Repository Reference

Current implementation reference:

```text
src/features/k500/parser.ts
src/features/k500/filterTypes.ts
src/features/k500/filterRanges.ts
src/features/k500/live/
```

The parser currently confirms the known 1144-byte map, checksum/name offsets, EQ section offsets, output scalar mappings, and filter decoding described above.

This guide is deliberately stricter than a normal UI serializer because AI preset generation must preserve unmodified binary state exactly.

---

# 31. Status of Knowledge

## Proven / high confidence

- 1144-byte preset size;
- checksum rule;
- name location;
- primary EQ offsets/layout;
- P/LS/HS encoding;
- primary crossover family encoding;
- Mic/Music/Main/Surround/Center/Sub/Reverb/Echo scalar mapping listed here;
- serial Music/Mic + Main EQ behavior for tonal simulation;
- dry/Reverb/Echo parallel-path concept;
- V2.00 structural compatibility observed on a real old-firmware preset.

## Known but use cautiously

- exact hardware filter coefficients vs canonical 48 kHz software model;
- perceptual meaning of every compressor value across firmware revisions;
- exact acoustic outcome of Surround delay without speaker geometry;
- exact Main/Sub integration without room measurement.

## Not yet fully proven

- semantic role of `mainAlt`;
- semantic role of `surroundAlt`;
- semantic role of `centerAlt`;
- semantic role of `subAlt`;
- all reserved/unknown bytes;
- whether every firmware revision uses exactly the same DSP algorithm despite structurally compatible preset containers.

Until proven otherwise, **preserve them bit-perfectly**.

---

# 32. Final Engineering Principle

The correct K500 AI workflow is:

```text
PRESERVE
   -> DECODE
      -> MODEL THE REAL SIGNAL FLOW
         -> MODIFY ONLY WHAT IS INTENDED
            -> SIMULATE
               -> VALIDATE BINARY
                  -> LISTEN ON REAL HARDWARE
                     -> ITERATE SURGICALLY
```

A good K500 preset is not merely a collection of attractive EQ curves.

It is a coordinated system of:

```text
gain structure
+ dry tonal balance
+ dynamics
+ FX spectral shaping
+ FX timing
+ output routing
+ Center anchoring
+ Surround depth
+ Sub integration
+ headroom
+ real-device psychoacoustics
```

And a good AI modification is only successful when it improves the sound **without changing a single unrelated byte**.
