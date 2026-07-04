# K500 BT Reverse Engineering — Output Mixer, Surround, Main FX Send, Main Compressor

Batch ini membaca capture berikut:

- `SURROUND_L_VOL_12_TO_10`
- `SURROUND_R_VOL_12_TO_9`
- `MAIN_REVERB_LEVEL_90_TO_100`
- `MAIN_ECHO_LEVEL_95_TO_100`
- `MAIN_COMP_THRESHOLD_-3db_TO_-5db`
- `MAIN_COMP_RATIO_1_18_TO_1_4`
- `MAIN_COMP_ATTACK_7ms_TO_15ms`
- `MAIN_COMP_RELEASE_0_1s_TO_0_2s`

## Kesimpulan cepat

Command output block tetap memakai:

```text
AA 25 0E SS D0 D1 D2 D3 ... D34 CS
```

- `0x0E` = output/mixer block write.
- `SS=0x00` = Main output block.
- `SS=0x02` = Surround output block.
- Checksum tetap two's complement: `sum(LL + CMD + payload + CS) & 0xFF == 0`.
- Software mengirim **satu block lengkap** setiap ada perubahan parameter, bukan single parameter write.

## Mapping byte yang bertambah

### Surround output block (`CMD 0x0E`, `SS=0x02`)

| Byte | Meaning | Evidence |
|---:|---|---|
| D0 | Surround L output raw dB | `SURROUND_L_VOL_12_TO_10`, raw turun `0x62 → 0x5F` |
| D2 | Surround R output raw dB | `SURROUND_R_VOL_12_TO_9`, raw turun `0x62 → 0x5D` |
| D4 | Surround mic level % | observed existing block value |
| D6 | Surround music level % | observed existing block value |
| D8 | Surround reverb level % | observed existing block value |
| D10 | Surround echo level % | observed existing block value |
| D12 | Surround compressor threshold raw | observed existing block value |
| D13 | Surround compressor ratio | observed existing block value |
| D14 | Surround compressor attack ms | observed existing block value |
| D15 | Surround compressor release raw | observed existing block value |
| D16-D17 | Surround L delay uint16 LE | observed `03 00` = 3 ms |
| D18-D19 | Surround R delay uint16 LE | observed `04 00` = 4 ms |

Output raw dB formula:

```text
raw = dB * 2 + 75
dB = (raw - 75) / 2
```

### Main output block (`CMD 0x0E`, `SS=0x00`)

| Byte | Meaning | Evidence |
|---:|---|---|
| D0 | Main L output raw dB | prior capture `MAIN_L_VOL_12_TO_11` |
| D2 | Main R output raw dB | prior capture `MAIN_R_VOL_12_TO_11` |
| D4 | Main Mic level % | prior capture `MAIN_MIC_LEVEL_100_TO_90` |
| D6 | Main Music level % | prior capture `MAIN_MUSIC_LEVEL_100_TO_95` |
| D8 | Main Reverb level % | new capture `MAIN_REVERB_LEVEL_90_TO_100` |
| D10 | Main Echo level % | new capture `MAIN_ECHO_LEVEL_95_TO_100` |
| D12 | Main compressor threshold raw | new capture `MAIN_COMP_THRESHOLD_-3db_TO_-5db` |
| D13 | Main compressor ratio | new capture `MAIN_COMP_RATIO_1_18_TO_1_4` |
| D14 | Main compressor attack ms | new capture `MAIN_COMP_ATTACK_7ms_TO_15ms` |
| D15 | Main compressor release raw | new capture `MAIN_COMP_RELEASE_0_1s_TO_0_2s` |

Compressor formulas:

```text
thresholdDb = raw - 50
ratio       = raw           // UI 1:raw
attackMs    = raw
releaseSec  = raw / 10
```

## Action summary

| Capture | Mapped location | Changed bytes | Final frame |
|---|---|---|---|
| `SURROUND_L_VOL_12_TO_10` | SS=0x02, D0 | D0:0x62->0x5F | `AA 25 0E 02 5F 63 63 63 57 32 55 32 50 32 4B 32 1E 64 01 01 03 00 04 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 A9` |
| `SURROUND_R_VOL_12_TO_9` | SS=0x02, D2 | D2:0x62->0x5D | `AA 25 0E 02 5F 63 5D 63 57 32 55 32 50 32 4B 32 1E 64 01 01 03 00 04 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 AF` |
| `MAIN_REVERB_LEVEL_90_TO_100` | SS=0x00, D8 | D8:0x63->0x64 | `AA 25 0E 00 61 63 61 63 5A 32 5F 32 64 32 5F 32 2F 12 07 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 B8` |
| `MAIN_ECHO_LEVEL_95_TO_100` | SS=0x00, D10 | D10:0x61->0x64 | `AA 25 0E 00 61 63 61 63 5A 32 5F 32 64 32 64 32 2F 12 07 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 B3` |
| `MAIN_COMP_THRESHOLD_-3db_TO_-5db` | SS=0x00, D12 | D12:0x2E->0x2D | `AA 25 0E 00 61 63 61 63 5A 32 5F 32 64 32 64 32 2D 12 07 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 B5` |
| `MAIN_COMP_RATIO_1_18_TO_1_4` | SS=0x00, D13 | D13:0x11->0x04 | `AA 25 0E 00 61 63 61 63 5A 32 5F 32 64 32 64 32 2D 04 07 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 C3` |
| `MAIN_COMP_ATTACK_7ms_TO_15ms` | SS=0x00, D14 | D14:0x08->0x0F | `AA 25 0E 00 61 63 61 63 5A 32 5F 32 64 32 64 32 2D 04 0F 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 BB` |
| `MAIN_COMP_RELEASE_0_1s_TO_0_2s` | SS=0x00, D15 | (single/final only) | `AA 25 0E 00 61 63 61 63 5A 32 5F 32 64 32 64 32 2D 04 0F 02 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 BA` |


## Notes

- Some captures start after the first slider increment, so the first logged frame may not show the original UI value. The changed byte index is still reliable because the same byte continues changing through the action.
- For `MAIN_COMP_RATIO_1_18_TO_1_4`, the log starts at raw `0x11` then decrements to `0x04`; it still confirms D13 as compressor ratio.
- For `MAIN_COMP_THRESHOLD_-3db_TO_-5db`, the log shows raw `0x2E → 0x2D` after the first decrement; it confirms D12 and formula `raw = dB + 50`.
- Odd bytes between primary values, for example D1/D3/D5/D7/D9/D11, are still marked as unknown/paired fields. Do not overwrite them blindly; preserve the current block and only patch the specific mapped byte before sending.

## Implementation recommendation

For live editing output/mixer/compressor:

1. Maintain the latest output block per section (`SS`).
2. When a mapped parameter changes, patch only the mapped D-byte.
3. Rebuild checksum.
4. Send the entire `AA 25 0E ...` frame.
5. Preserve all unknown D-bytes exactly from readback/current block.

Pseudo:

```ts
function buildOutputBlock(section: number, d: number[]): Uint8Array {
  const payload = [0x25, 0x0e, section, ...d];
  const checksum = (-payload.reduce((a, b) => (a + b) & 0xff, 0)) & 0xff;
  return Uint8Array.from([0xaa, ...payload, checksum]);
}
```
