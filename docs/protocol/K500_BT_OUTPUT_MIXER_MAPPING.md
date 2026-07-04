# K500 BT/RFCOMM Protocol — Output Mixer and Mic EQ Link Update

This note summarizes the capture batch received after the EQ section mapping pass. Transport remains Bluetooth RFCOMM on COM18 with the same framing and checksum rules.

## Confirmed framing

PC to device:

```text
AA LL CMD PAYLOAD... CS
```

Checksum remains valid for every decoded command in this batch:

```text
sum(LL + CMD + PAYLOAD + CS) & 0xFF == 0
```

Device acknowledgement for `CMD 0x0E` is consistently:

```text
55 0E 00 F1 00 05 08 07 66 66 66 66 66 66 66 00 00 23
```

`0xF1` follows the previously observed response pattern:

```text
0xFF - 0x0E = 0xF1
```

## New command: output block write `CMD 0x0E`

Output/mixer edits are not sent as tiny single-field frames. The original PC software sends a **40-byte padded frame** with a complete output block snapshot:

```text
AA 25 0E SS B0 B1 B2 ... B34 CS
```

Where:

```text
25 = body length, decimal 37
0E = output block write command
SS = output section id
B0..B34 = output block payload
CS = two's-complement checksum
```

Captured output section IDs:

| Section id | Output page |
|---:|---|
| `0x00` | Main |
| `0x04` | Center |
| `0x05` | Subwoofer |

Surround output block is still not captured in this batch.

## Main output block fields captured

For `SS = 0x00`, the first 16 bytes after section id match the Main scalar block previously seen in the preset map.

| Block index | Inferred field | Evidence |
|---:|---|---|
| `B0` | Main L output volume raw | changed in `MAIN_L_VOL_12_TO_11` |
| `B2` | Main R output volume raw | changed in `MAIN_R_VOL_12_TO_11` |
| `B4` | Main Mic level % | changed in `MAIN_MIC_LEVEL_100_TO_90` |
| `B6` | Main Music level % | changed in `MAIN_MUSIC_LEVEL_100_TO_95` |
| `B8` | Main Reverb level % | matches known snapshot value |
| `B10` | Main Echo level % | matches known snapshot value |
| `B12` | Main compressor threshold raw | known snapshot `0x2F` = -3 dB if raw-50 |
| `B13` | Main compressor ratio | known snapshot `0x12` = 18 |
| `B14` | Main compressor attack ms | known snapshot `0x07` = 7 ms |
| `B15` | Main compressor release x10 | known snapshot `0x01` = 0.1 s |

Output dB raw mapping remains:

```text
raw = dB * 2 + 75
```

Examples:

```text
12 dB => 99 decimal => 0x63
11 dB => 97 decimal => 0x61
10 dB => 95 decimal => 0x5F
```

## Captured examples

### Main L output volume

Final captured frame for Main L around 11 dB:

```text
AA 25 0E 00 61 63 63 63 64 32 64 32 5A 32 5F 32 2F 12 07 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 B1
```

`B0 = 0x61` maps to 11 dB.

### Main R output volume

Final relevant frame:

```text
AA 25 0E 00 61 63 61 63 64 32 64 32 5A 32 5F 32 2F 12 07 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 B3
```

`B2 = 0x61` maps to 11 dB.

### Main Mic level

Final frame for Main Mic level 90%:

```text
AA 25 0E 00 61 63 61 63 5A 32 64 32 5A 32 5F 32 2F 12 07 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 BD
```

`B4 = 0x5A = 90`.

### Main Music level

Final frame for Main Music level 95%:

```text
AA 25 0E 00 61 63 61 63 5A 32 5F 32 5A 32 5F 32 2F 12 07 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 C2
```

`B6 = 0x5F = 95`.

## Center and Subwoofer output volume

Center uses `SS = 0x04` and Subwoofer uses `SS = 0x05`.

### Center volume 12 dB to 11 dB

Final relevant frame:

```text
AA 25 0E 04 61 63 63 63 58 32 55 32 57 32 55 32 1E 64 01 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 9A
```

`B0 = 0x61` maps to 11 dB.

### Sub volume 12 dB to 10 dB

Final relevant frame:

```text
AA 25 0E 05 5F 4B 4B 4B 00 32 58 32 00 32 00 32 1E 64 19 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 CC
```

`B0 = 0x5F` maps to 10 dB.

## Mic EQ Link OFF to ON

Captured frame:

```text
AA 04 3C 01 01 9E 20
```

Earlier ON to OFF capture was:

```text
AA 04 3C 00 00 C4 FC
```

Current inference:

| Action | Frame | Status |
|---|---|---|
| Mic EQ Link OFF -> ON | `AA 04 3C 01 01 9E 20` | confirmed action, payload meaning partly unresolved |
| Mic EQ Link ON -> OFF | `AA 04 3C 00 00 C4 FC` | from previous capture, payload meaning partly unresolved |

The first two payload bytes appear to carry the link state. The third payload byte changes as well (`0x9E` vs `0xC4`), so it should be treated as part of the official command payload, not ignored.

## TypeScript command builder draft

```ts
export function checksumBody(body: number[]): number {
  return (-body.reduce((sum, b) => (sum + b) & 0xff, 0)) & 0xff;
}

export function buildFrame(cmd: number, payload: number[]): Uint8Array {
  const body = [1 + payload.length, cmd, ...payload];
  return Uint8Array.from([0xaa, ...body, checksumBody(body)]);
}

export function outputDbToRaw(db: number): number {
  return Math.max(0, Math.min(255, Math.round(db * 2 + 75)));
}

export function rawToOutputDb(raw: number): number {
  return (raw - 75) / 2;
}

export function buildOutputBlock(sectionId: number, block: number[]): Uint8Array {
  if (block.length !== 35) throw new Error('K500 output block must contain 35 bytes after section id');
  return buildFrame(0x0e, [sectionId, ...block]);
}

export function setMainLVolume(block: number[], db: number): number[] {
  const next = [...block];
  next[0] = outputDbToRaw(db);
  return next;
}

export function setMainRVolume(block: number[], db: number): number[] {
  const next = [...block];
  next[2] = outputDbToRaw(db);
  return next;
}

export function setMainMicLevel(block: number[], percent: number): number[] {
  const next = [...block];
  next[4] = Math.max(0, Math.min(100, Math.round(percent)));
  return next;
}

export function setMainMusicLevel(block: number[], percent: number): number[] {
  const next = [...block];
  next[6] = Math.max(0, Math.min(100, Math.round(percent)));
  return next;
}
```

## Open items

Capture still needed:

```text
SURROUND_L_VOL_<actual>_TO_<actual>
SURROUND_R_VOL_<actual>_TO_<actual>
MAIN_REVERB_LEVEL_<actual>_TO_<actual>
MAIN_ECHO_LEVEL_<actual>_TO_<actual>
MAIN_COMP_THRESHOLD_<actual>_TO_<actual>
MAIN_COMP_RATIO_<actual>_TO_<actual>
MAIN_COMP_ATTACK_<actual>_TO_<actual>
MAIN_COMP_RELEASE_<actual>_TO_<actual>
```

The next most valuable capture is **Main compressor threshold** because `CMD 0x0E` already carries compressor bytes inside the same output block.


---

# Update v0.6 — Surround Output, Main FX Send, Main Compressor

This update is based on the capture batch:

```text
SURROUND_L_VOL_12_TO_10
SURROUND_R_VOL_12_TO_9
MAIN_REVERB_LEVEL_90_TO_100
MAIN_ECHO_LEVEL_95_TO_100
MAIN_COMP_THRESHOLD_-3db_TO_-5db
MAIN_COMP_RATIO_1_18_TO_1_4
MAIN_COMP_ATTACK_7ms_TO_15ms
MAIN_COMP_RELEASE_0_1s_TO_0_2s
```

## Confirmed: Surround output block section id

Surround output block uses:

```text
CMD = 0x0E
SS  = 0x02
```

This is different from the EQ write section id, where Surround EQ used `SS=0x05`. Do not reuse EQ section ids for output block writes.

## Confirmed output block section ids

| Output block SS | Page |
|---:|---|
| `0x00` | Main |
| `0x02` | Surround |
| `0x04` | Center |
| `0x05` | Subwoofer |

## Confirmed output block field map

The output command format remains:

```text
AA 25 0E SS D0 D1 D2 D3 D4 D5 D6 D7 D8 D9 D10 D11 D12 D13 D14 D15 ... D34 CS
```

### Common first block bytes

These byte positions are now confirmed for Main and mostly aligned for Surround/Center/Sub:

| D byte | Main | Surround | Center/Sub notes |
|---:|---|---|---|
| D0 | L output raw dB | L output raw dB | Center/Sub output raw dB |
| D2 | R output raw dB | R output raw dB | unused/paired field in mono outputs |
| D4 | Mic level % | Mic level % | Mic level % |
| D6 | Music level % | Music level % | Music level % |
| D8 | Reverb level % | Reverb level % | Reverb level % |
| D10 | Echo level % | Echo level % | Echo level % |
| D12 | Compressor threshold raw | Compressor threshold raw | Compressor threshold raw |
| D13 | Compressor ratio | Compressor ratio | Compressor ratio |
| D14 | Compressor attack ms | Compressor attack ms | Compressor attack ms |
| D15 | Compressor release raw | Compressor release raw | Compressor release raw |
| D16-D17 | unknown/zero in Main | L delay uint16 LE | channel-specific / unknown |
| D18-D19 | unknown/zero in Main | R delay uint16 LE | channel-specific / unknown |

## Main FX send and compressor bytes confirmed

| Field | D byte | Formula | Evidence |
|---|---:|---|---|
| Main Reverb level | D8 | direct percent | `MAIN_REVERB_LEVEL_90_TO_100` |
| Main Echo level | D10 | direct percent | `MAIN_ECHO_LEVEL_95_TO_100` |
| Main Comp Threshold | D12 | `thresholdDb = raw - 50` | `MAIN_COMP_THRESHOLD_-3db_TO_-5db` |
| Main Comp Ratio | D13 | `ratio = raw`, displayed as `1:raw` | `MAIN_COMP_RATIO_1_18_TO_1_4` |
| Main Comp Attack | D14 | ms direct | `MAIN_COMP_ATTACK_7ms_TO_15ms` |
| Main Comp Release | D15 | `releaseSec = raw / 10` | `MAIN_COMP_RELEASE_0_1s_TO_0_2s` |

## Surround bytes confirmed

| Field | D byte | Formula | Evidence |
|---|---:|---|---|
| Surround L output | D0 | `dB = (raw - 75) / 2` | `SURROUND_L_VOL_12_TO_10` |
| Surround R output | D2 | `dB = (raw - 75) / 2` | `SURROUND_R_VOL_12_TO_9` |
| Surround L delay | D16-D17 | uint16 LE ms | observed `03 00` = 3 ms |
| Surround R delay | D18-D19 | uint16 LE ms | observed `04 00` = 4 ms |

## Implementation rule

Because `CMD 0x0E` sends a full block, the implementation must preserve unknown/paired bytes:

```text
read/keep latest 35-byte block per output section
patch only the mapped D byte(s)
recalculate checksum
send full AA 25 0E block
```

Never rebuild the block from only known fields unless all fields are mapped.

See appendix:

```text
docs/protocol/appendix/k500_bt_output_comp_surround_analysis.md
docs/protocol/appendix/k500_bt_output_comp_surround_summary.csv
docs/protocol/appendix/k500_bt_output_comp_surround_packets.csv
```

## Remaining useful captures

The highest-value next captures are:

```text
SURROUND_COMP_THRESHOLD_<actual>_TO_<actual>
CENTER_COMP_THRESHOLD_<actual>_TO_<actual>
SUB_COMP_THRESHOLD_<actual>_TO_<actual>
SURROUND_DELAY_L_<actual>_TO_<actual>
SURROUND_DELAY_R_<actual>_TO_<actual>
SUB_HPF_<actual>_TO_<actual>
SUB_LPF_<actual>_TO_<actual>
MIC_COMP_THRESHOLD_<actual>_TO_<actual>
REVERB_DECAY_<actual>_TO_<actual>
ECHO_DELAY_<actual>_TO_<actual>
```
