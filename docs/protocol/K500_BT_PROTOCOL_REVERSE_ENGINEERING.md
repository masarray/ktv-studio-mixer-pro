# KTV K500 Bluetooth Serial Protocol Reverse Engineering Notes

Status: working reverse-engineering notes from real captures of the original K500 PC software.  
Transport currently confirmed: **Bluetooth Serial / RFCOMM COM18**.  
Do not treat unknown fields as final until validated with more captures.

## 1. Current conclusion

The original PC software can control the KTV K500 over Bluetooth using a Windows serial port:

```text
Standard Serial over Bluetooth link (COM18)
115200 baud, 8 data bits, no parity, 1 stop bit
```

The control stream is not random BLE UI data. It is a UART-style framed protocol. This matches the Android APK finding where command names were internally labelled `UARTCMD_*` and BLE was likely used as a transport/tunnel.

The USB front port did not appear as a new COM port in Device Manager during testing. For now, **Bluetooth COM18 is the fastest path for live device control**. USB may still be HID/vendor-specific and can be investigated later.

## 2. Frame format

### PC/software → K500

```text
AA LL CMD PAYLOAD... CS
```

Field meaning:

| Field | Meaning |
|---|---|
| `AA` | TX header, PC → device |
| `LL` | body length, including `CMD + payload` |
| `CMD` | command ID |
| `PAYLOAD` | command-specific bytes |
| `CS` | two's-complement checksum |

Checksum rule:

```text
sum(LL + CMD + payload + CS) & 0xFF == 0
CS = (-sum(LL + CMD + payload)) & 0xFF
```

Examples:

```text
AA 01 1C E3
```

`01 + 1C + E3 = 0x100`, so checksum is valid.

```text
AA 06 40 00 00 3A 00 00 80
```

`06 + 40 + 00 + 00 + 3A + 00 + 00 + 80 = 0x100`, so checksum is valid.

### K500 → PC/software

```text
55 LEN_LO LEN_HI RSP DATA... CS
```

Observed response/ACK code usually follows:

```text
RSP = 0xFF - CMD
```

Examples:

| Command | ACK/response code |
|---:|---:|
| `0x03` | `0xFC` |
| `0x15` | `0xEA` |
| `0x1C` | `0xE3` |
| `0x40` | `0xBF` |

Checksum rule also appears to be: sum of bytes after the header up to and including checksum equals `0x00` modulo 256.

## 3. Confirmed / observed command map

| CMD | Name / function | Status | Example |
|---:|---|---|---|
| `0x1C` | heartbeat / status poll | confirmed observed | `AA 01 1C E3` |
| `0x3F` | handshake / device info | observed | `AA 01 3F C0` |
| `0x40` | read block | confirmed observed | `AA 06 40 00 00 3A 00 00 80` |
| `0x02` | Music block | partially mapped | Music volume 25→26 |
| `0x05` | Mic block | partially mapped | Mic volume 25→26 |
| `0x09` | Effect / top FX block | partially mapped | Effect volume 25→26 |
| `0x03` | Music EQ band write | strongly mapped | EQ B1/B2 freq/Q/gain/type |
| `0x15` | Mute | mapped | Mute ON/OFF |

## 4. Read block command `0x40`

Format observed:

```text
AA 06 40 OFFSET_LO OFFSET_HI LEN_LO LEN_HI 00 CS
```

Example:

```text
AA 06 40 00 00 3A 00 00 80
```

Meaning:

```text
CMD    = 0x40
Offset = 0x0000
Length = 0x003A = 58 bytes
Flag   = 0x00
```

Response example shape:

```text
55 3B 00 BF <58 bytes data> CS
```

During connect, the software read repeated blocks:

```text
0x0000 len 58
0x003A len 58
0x0074 len 58
0x00AE len 58
...
0x0366 len 58
0x03A0 len 11
```

Reconstructed live readback size from current captures: **939 bytes**.

Readable strings found in readback:

```text
KARAOKE ARTIST
KTV_BT_00AB12
KTV_BLE_00AB12
```

Important: the live device map readback is currently **939 bytes**, while the `.k500` preset file previously decoded is **1144 bytes**. The live map may be a compact active device state, not the full PC preset file format.

## 5. Top volume / block commands

These are partially mapped. They should be treated as block writes until more fields are decoded.

### Music volume 25 → 26

```text
AA 0D 02 1A 19 54 02 09 09 09 08 08 07 15 00 21
```

Interpretation:

```text
CMD 0x02 = Music block
First payload byte 0x1A = 26
```

### Mic volume 25 → 26

```text
AA 0E 05 1A 19 54 0B 00 00 60 60 26 03 0A 02 00 66
```

Interpretation:

```text
CMD 0x05 = Mic block
First payload byte 0x1A = 26
```

### Effect volume 25 → 26

```text
AA 03 09 1A 19 C1
```

Interpretation:

```text
CMD 0x09 = Effect/top-FX block
Payload 0x1A 0x19
0x1A = 26
```

## 6. Music EQ write command `0x03`

Music EQ write is now strongly mapped from captures covering band index, gain sweep, frequency, Q, type P/LS/HS, positive/negative gain.

### Frame format

```text
AA 09 03 SS BI FL FH QQ TG GG TT CS
```

| Byte | Meaning | Confirmed value/example |
|---|---|---|
| `09` | body length | fixed for this EQ write: `CMD + 8 payload bytes` |
| `03` | command | EQ write |
| `SS` | section/source | `02` = Music EQ |
| `BI` | band index | zero-based, B1=`00`, B2=`01` |
| `FL FH` | frequency | uint16 little-endian, `E0 2E` = 12000 Hz |
| `QQ` | Q | Q×10, `13` = 1.9 |
| `TG` | type + sign | type nibble + sign bit |
| `GG` | gain magnitude | abs(gain dB)×10, `0A` = 1.0 dB |
| `TT` | target/bank | `60` for Music EQ in these captures |
| `CS` | checksum | two's-complement of body |

### Band index

```text
B1 = 00
B2 = 01
```

Likely continues zero-based for remaining bands.

### Frequency

Frequency is uint16 little-endian:

```text
C8 32 = 0x32C8 = 13000 Hz
E0 2E = 0x2EE0 = 12000 Hz
75 00 = 0x0075 = 117 Hz
```

### Q

```text
Q_raw = Q × 10
14 = 20 = Q 2.0
13 = 19 = Q 1.9
```

### Gain

Gain is not signed int16 in the live command. It is split into:

```text
TG = type + sign
GG = magnitude × 10
```

Examples:

```text
TG 90, GG 3B = LS, -5.9 dB
TG 90, GG 01 = LS, -0.1 dB
TG 10, GG 00 = LS, +0.0 dB
TG 10, GG 0A = LS, +1.0 dB
```

### Type/sign byte

| Type | Positive | Negative |
|---|---:|---:|
| P / Parametric | `00` | `80` |
| LS / Low Shelf | `10` | `90` |
| HS / High Shelf | `20` | `A0` inferred, validate with negative HS capture |

Formula:

```text
typeSign = typeNibble | signBit

typeNibble:
P  = 0x00
LS = 0x10
HS = 0x20

signBit:
gain >= 0 = 0x00
gain <  0 = 0x80
```

### Music EQ examples

Music EQ B1, P, 13000 Hz, Q 2.0, -6.0 dB:

```text
AA 09 03 02 00 C8 32 14 80 3C 60 C8
```

Music EQ B2, P, 117 Hz, Q 2.0, -1.0 dB:

```text
AA 09 03 02 01 75 00 14 80 0A 60 7E
```

Music EQ B1, LS, 12000 Hz, Q 1.9, +1.0 dB:

```text
AA 09 03 02 00 E0 2E 13 10 0A 60 57
```

Music EQ B1, HS, 12000 Hz, Q 1.9, +1.0 dB:

```text
AA 09 03 02 00 E0 2E 13 20 0A 60 47
```

Music EQ B1, P, 12000 Hz, Q 1.9, +1.0 dB:

```text
AA 09 03 02 00 E0 2E 13 00 0A 60 67
```

## 7. Mute command `0x15`

Mute ON:

```text
AA 03 15 01 00 E7
```

Mute OFF:

```text
AA 03 15 00 00 E8
```

Interpretation:

```text
CMD 0x15 = mute
01 00 = ON
00 00 = OFF
```

## 8. Implementation helpers

### TypeScript checksum / frame builder

```ts
export function k500Checksum(body: number[]): number {
  const sum = body.reduce((acc, b) => (acc + (b & 0xff)) & 0xff, 0);
  return (-sum) & 0xff;
}

export function buildK500Frame(cmd: number, payload: number[] = []): Uint8Array {
  const body = [payload.length + 1, cmd & 0xff, ...payload.map((b) => b & 0xff)];
  return Uint8Array.from([0xaa, ...body, k500Checksum(body)]);
}

export function verifyK500TxFrame(frame: Uint8Array): boolean {
  if (frame[0] !== 0xaa) return false;
  const body = Array.from(frame.slice(1));
  return body.reduce((acc, b) => (acc + b) & 0xff, 0) === 0;
}
```

### TypeScript Music EQ frame builder

```ts
type EqType = 'P' | 'LS' | 'HS';

const EQ_TYPE_NIBBLE: Record<EqType, number> = {
  P: 0x00,
  LS: 0x10,
  HS: 0x20,
};

export function k500EqTypeSign(type: EqType, gainDb: number): number {
  return EQ_TYPE_NIBBLE[type] | (gainDb < 0 ? 0x80 : 0x00);
}

export function buildMusicEqWrite(params: {
  bandIndex: number;      // zero-based
  type: EqType;
  frequencyHz: number;
  q: number;
  gainDb: number;
}): Uint8Array {
  const freq = Math.round(params.frequencyHz);
  const qRaw = Math.round(params.q * 10);
  const gainMag = Math.round(Math.abs(params.gainDb) * 10);

  return buildK500Frame(0x03, [
    0x02,                         // SS = Music EQ
    params.bandIndex & 0xff,       // BI
    freq & 0xff,                   // FL
    (freq >> 8) & 0xff,            // FH
    qRaw & 0xff,                   // QQ
    k500EqTypeSign(params.type, params.gainDb),
    gainMag & 0xff,                // GG
    0x60,                          // TT = Music target/bank observed
  ]);
}
```

Expected output example:

```ts
buildMusicEqWrite({ bandIndex: 0, type: 'P', frequencyHz: 12000, q: 1.9, gainDb: 1.0 })
// AA 09 03 02 00 E0 2E 13 00 0A 60 67
```

### TypeScript mute builder

```ts
export function buildMuteWrite(on: boolean): Uint8Array {
  return buildK500Frame(0x15, [on ? 0x01 : 0x00, 0x00]);
}
```

### Serial transport design sketch

The app should not let UI components write serial bytes directly. Use a transport + protocol layer:

```ts
export interface K500Transport {
  open(): Promise<void>;
  close(): Promise<void>;
  write(frame: Uint8Array): Promise<void>;
  onData(callback: (chunk: Uint8Array) => void): () => void;
}

export interface K500ProtocolClient {
  heartbeat(): Promise<void>;
  readBlock(offset: number, length: number): Promise<Uint8Array>;
  setMute(on: boolean): Promise<void>;
  writeMusicEqBand(params: {
    bandIndex: number;
    type: EqType;
    frequencyHz: number;
    q: number;
    gainDb: number;
  }): Promise<void>;
}
```

For the current React/Lovable project, the fastest implementation route is likely:

```text
Electron + serialport
```

or later:

```text
Tauri + serial plugin
```

The command builder should remain transport-agnostic so the same commands can later be sent over Bluetooth COM, BLE, or USB HID if needed.

## 9. Safety rules for live editing

Until save/store command is decoded, implement only safe RAM/live writes:

```text
Offline Edit       = no device writes
Live Preview       = send real-time parameter frames, RAM/current state only
Write/Upload       = disabled until block-write is decoded
Store Permanently  = disabled until save command is decoded and verified
```

Do not auto-save permanent changes to the K500 while reverse engineering.

For sliders/EQ drag:

```text
UI drag → update local state immediately → debounce 60–150 ms → send live command → wait ACK → mark Synced
```

For EQ graph sweeps, the original software sends many intermediate frames. Our app can send fewer frames with debounce to avoid flooding the Bluetooth COM channel.

## 10. Next captures needed

To extend beyond Music EQ, capture one-action logs for these:

1. `Mic EQ B1 gain -x → -y`
2. `Mic EQ B1 freq change`
3. `Mic EQ B1 type P → LS → HS`
4. `Main EQ B1 gain/freq/type`
5. `Surround EQ B1 gain/freq/type`
6. `Center EQ B1 gain/freq/type`
7. `Sub EQ B1 gain/freq/type`
8. `Output compressor threshold change`
9. `Output compressor ratio change`
10. `Save / Store to device`
11. `Upload / Send to equipment`

The goal is to determine whether non-Music EQ uses:

```text
same CMD 0x03 + different SS/TT
```

or separate command IDs per section.

## 11. Raw capture files summarized in these notes

Connect/readback:

```text
00_COM18_CONNECT_ONLY
```

Action captures:

```text
01_MUSIC_VOL_25_TO_26
02_MIC_VOL_25_TO_26
03_EFFECT_VOL_25_TO_26
04_MUSIC_EQ_B1_GAIN_-7_TO_-6
05_MUSIC_EQ_B2_GAIN_-1.7_TO_-1.0
06_MUSIC_EQ_B1_FREQ_13000_TO_12000
07_MUSIC_EQ_B1_Q_2.0_TO_1.9
08_MUSIC_EQ_B1_TYPE_P_TO_LS
09_MUTE_ON_OFF
Music EQ B1 gain -6.0 → +1.0
Music EQ B1 type LS → HS
Music EQ B1 type HS → P
Mute OFF
```

Appendix analysis files are stored next to this document where available.


## Update: channel EQ section mapping

See [`K500_BT_CHANNEL_EQ_MAPPING.md`](./K500_BT_CHANNEL_EQ_MAPPING.md) for the latest mapping from Mic A/B, Main, Surround, Center, Subwoofer, Reverb, and Echo EQ captures.

## 2026-07-03 update — Output mixer block write

Additional captures confirmed output/mixer writes using `CMD 0x0E`:

```text
AA 25 0E SS B0 B1 B2 ... B34 CS
```

Captured output section ids:

| Section id | Output page |
|---:|---|
| `0x00` | Main |
| `0x04` | Center |
| `0x05` | Subwoofer |

Key field mapping now confirmed for Main:

| Block index | Field |
|---:|---|
| `B0` | Main L output raw dB |
| `B2` | Main R output raw dB |
| `B4` | Main Mic level % |
| `B6` | Main Music level % |
| `B8` | Main Reverb level % snapshot |
| `B10` | Main Echo level % snapshot |
| `B12` | Main compressor threshold raw snapshot |
| `B13` | Main compressor ratio snapshot |
| `B14` | Main compressor attack snapshot |
| `B15` | Main compressor release snapshot |

See detailed notes in [`K500_BT_OUTPUT_MIXER_MAPPING.md`](./K500_BT_OUTPUT_MIXER_MAPPING.md).

