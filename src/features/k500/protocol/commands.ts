import type { EqBand, EqCrossover, Preset } from "@/features/k500/types";
import { buildFrame, byte } from "./frame";
import { clampFilterHz } from "@/features/k500/filterRanges";
import { crossoverFilterCode } from "@/features/k500/filterTypes";

export const EQ_SECTION_ID: Record<string, number> = Object.freeze({
  micA: 0x00,
  micB: 0x01,
  music: 0x02,
  main: 0x03,
  surround: 0x05,
  center: 0x07,
  sub: 0x08,
  reverb: 0x09,
  echo: 0x0a,
});

export const EQ_TARGET_BYTE: Record<string, number> = Object.freeze({
  music: 0x60,
});

const OUTPUT_SECTION_ID: Record<string, number> = Object.freeze({
  main: 0x00,
  surround: 0x02,
  center: 0x04,
  sub: 0x05,
});

const OUTPUT_FILE_BASE: Record<string, number> = Object.freeze({
  main: 0x0024,
  surround: 0x0038,
  center: 0x004c,
  sub: 0x0060,
});

const OUTPUT_DATA_LEN = 35;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function outDbToRaw(db: number): number {
  return byte(Math.round(Number(db) * 2 + 75));
}

function u16le(value: number): [number, number] {
  const v = Math.max(0, Math.min(65535, Math.round(Number(value) || 0)));
  return [v & 0xff, (v >> 8) & 0xff];
}

export function buildHeartbeat(): Uint8Array {
  return buildFrame([0x01, 0x1c]);
}

export function buildHandshake(): Uint8Array {
  return buildFrame([0x01, 0x3f]);
}

export const DEVICE_ROUTE_USB = 0x01;
export const DEVICE_ROUTE_BT = 0x02;

function routeMaskByte(mask: number): number {
  return byte(Number(mask) & (DEVICE_ROUTE_USB | DEVICE_ROUTE_BT));
}

/**
 * Recall one of the ten Equipment Mode slots. Native USB captures prove the
 * payload is `[slotZeroBased, routeMask]`:
 *
 *   Mode 1, USB+BT: AA 03 00 01 00 03 F9
 *   Mode 4, USB   : AA 03 00 01 03 01 F8
 *
 * `toUsbFrame()` inserts the USB length high-byte; this builder intentionally
 * stays in the shared BT-style framing used by every command builder.
 */
export function buildRecallMode(slotOneBased: number, routeMask: number): Uint8Array {
  const slotZeroBased = byte(clamp(Math.round(Number(slotOneBased) || 1), 1, 10) - 1);
  return buildFrame([0x03, 0x01, slotZeroBased, routeMaskByte(routeMask)]);
}

/** Native recall refresh handshake, sent immediately after CMD 0x01. */
export function buildRecallHandshake(routeMask: number): Uint8Array {
  return buildFrame([0x03, 0x3f, 0x00, routeMaskByte(routeMask)]);
}

/**
 * Native `Use init vol` toggle. The final byte is the same USB/BT destination
 * mask used by Recall, not a hard-coded USB-only flag.
 *
 *   OFF, USB: AA 03 00 12 00 01 EA
 *   ON,  USB: AA 03 00 12 01 01 E9
 */
export function buildUseInitVolume(enabled: boolean, routeMask: number): Uint8Array {
  return buildFrame([0x03, 0x12, enabled ? 0x01 : 0x00, routeMaskByte(routeMask)]);
}

export const DEVICE_SLOT_IMAGE_LENGTH = 0x0290;
export const DEVICE_SLOT_WRITE_CHUNK = 0x003c;
export type DeviceStoreChain = readonly [number, number, number];

function imageChecksum8(image: Uint8Array): number {
  let sum = 0;
  for (const value of image) sum = (sum + value) & 0xff;
  return (-sum) & 0xff;
}

function assertSlotImage(image: Uint8Array) {
  if (image.length !== DEVICE_SLOT_IMAGE_LENGTH) {
    throw new Error(`Device slot image must be ${DEVICE_SLOT_IMAGE_LENGTH} bytes; got ${image.length}`);
  }
}

/** Native permanent-store begin (CMD 0x41). */
export function buildStoreBegin(image: Uint8Array, chain: DeviceStoreChain = [0x00, 0x00, 0x00]): Uint8Array {
  assertSlotImage(image);
  return buildFrame([
    0x08, 0x41, 0x90, 0x02, imageChecksum8(image), 0x00,
    byte(chain[0]), byte(chain[1]), byte(chain[2]),
  ]);
}

/**
 * Native permanent-store data block (CMD 0x42). The shared frame uses the
 * native body length includes four reserved zero bytes after the payload,
 * producing AA 45 00 for 60-byte chunks and AA 41 00 for the final 56-byte
 * chunk exactly as captured.
 */
export function buildStoreChunk(offset: number, data: Uint8Array): Uint8Array {
  if (data.length < 1 || data.length > DEVICE_SLOT_WRITE_CHUNK) throw new Error(`Invalid store chunk length: ${data.length}`);
  const [ol, oh] = u16le(offset);
  const [ll, lh] = u16le(data.length);
  const bodyLength = 1 + 2 + 2 + data.length + 4;
  return buildFrame([bodyLength, 0x42, ol, oh, ll, lh, ...data, 0x00, 0x00, 0x00, 0x00]);
}

/** Native permanent-store commit (CMD 0x43). */
export function buildStoreCommit(slotOneBased: number, image: Uint8Array): Uint8Array {
  assertSlotImage(image);
  const slotZeroBased = byte(clamp(Math.round(Number(slotOneBased) || 1), 1, 10) - 1);
  const finalLength = DEVICE_SLOT_IMAGE_LENGTH % DEVICE_SLOT_WRITE_CHUNK || DEVICE_SLOT_WRITE_CHUNK;
  const finalOffset = DEVICE_SLOT_IMAGE_LENGTH - finalLength;
  return buildFrame([
    0x07, 0x43, slotZeroBased, 0x00, finalLength & 0xff, (finalLength >> 8) & 0xff,
    image[finalOffset], image[finalOffset + 1],
  ]);
}

export function buildMute(mute: boolean): Uint8Array {
  return buildFrame([0x03, 0x15, mute ? 0x01 : 0x00, 0x00]);
}

export type PlayerCommand = "rewind" | "forward" | "playPause";

const PLAYER_ACTION: Readonly<Record<PlayerCommand, number>> = Object.freeze({
  rewind: 0x00,
  forward: 0x01,
  playPause: 0x02,
});

/**
 * Native media transport command (CMD 0x06). USB captures supplied
 * 11.07.2026 prove the same fixed tail byte 0x05 for all three actions:
 *
 *   Rewind    AA 03 00 06 00 05 F2
 *   Forward   AA 03 00 06 01 05 F1
 *   Play/Pause AA 03 00 06 02 05 F0
 *
 * Play and Pause deliberately use the same toggle command; clicking twice in
 * the native app emits the exact same frame twice.
 */
export function buildPlayerCommand(command: PlayerCommand): Uint8Array {
  return buildFrame([0x03, 0x06, PLAYER_ACTION[command], 0x05]);
}

export function buildReadBlock(offset: number, length: number): Uint8Array {
  const [ol, oh] = u16le(offset);
  const [ll, lh] = u16le(length);
  return buildFrame([0x06, 0x40, ol, oh, ll, lh, 0x63]);
}

function eqTypeNibble(type: string): number {
  if (type === "LS") return 0x10;
  if (type === "HS") return 0x20;
  return 0x00;
}

export function buildEqWrite(eqKey: string, bandIndexZeroBased: number, band: Pick<EqBand, "type" | "frequencyHz" | "q" | "gainDb">): Uint8Array {
  const section = EQ_SECTION_ID[eqKey];
  if (section === undefined) throw new Error(`Unsupported EQ live section: ${eqKey}`);
  const [fl, fh] = u16le(band.frequencyHz);
  // Live Q is a single byte (Q x 10) — verified across every EQ sniff. Values
  // above 25.5 would wrap the byte and send garbage Q, so live writes clamp
  // to 0.1..25.0 (the .k500 file format itself still stores u16 Q).
  const q = byte(Math.round(clamp(band.q, 0.1, 25) * 10));
  const gain = Number(band.gainDb) || 0;
  const typeSign = eqTypeNibble(String(band.type)) | (gain < 0 ? 0x80 : 0x00);
  const gainMagnitude = byte(Math.round(Math.abs(clamp(gain, -24, 24)) * 10));
  const target = EQ_TARGET_BYTE[eqKey] ?? 0x00;
  return buildFrame([
    0x09,
    0x03,
    section,
    byte(bandIndexZeroBased),
    fl,
    fh,
    q,
    typeSign,
    gainMagnitude,
    target,
  ]);
}

export type CrossoverLiveKind = "hpf" | "lpf";

type CrossoverCommandSpec = Readonly<Record<CrossoverLiveKind, number>>;

/**
 * CMD 0x11 does not use the PEQ section id. The first payload byte after the
 * command is a dedicated filter selector which encodes both section + HP/LP.
 *
 * Directly verified from native-app USB sniffs:
 *   Music HPF 0x02, Music LPF 0x03
 *   Main LPF 0x05
 *   Surround LPF 0x09
 *   Center LPF 0x0D
 *   Sub LPF 0x0F
 *
 * The paired HP selectors are the adjacent even selector used by the native
 * protocol's section pair. Reverb/Echo/Mic follow the same contiguous native
 * selector table. Keeping this table separate from EQ_SECTION_ID prevents the
 * old bug where Main/Surround/Center/Sub sent PEQ section ids as filter types.
 */
export const CROSSOVER_SELECTOR: Readonly<Record<string, CrossoverCommandSpec>> = Object.freeze({
  mic: Object.freeze({ hpf: 0x00, lpf: 0x01 }),
  micA: Object.freeze({ hpf: 0x00, lpf: 0x01 }),
  micB: Object.freeze({ hpf: 0x00, lpf: 0x01 }),
  music: Object.freeze({ hpf: 0x02, lpf: 0x03 }),
  main: Object.freeze({ hpf: 0x04, lpf: 0x05 }),
  reverb: Object.freeze({ hpf: 0x06, lpf: 0x07 }),
  surround: Object.freeze({ hpf: 0x08, lpf: 0x09 }),
  echo: Object.freeze({ hpf: 0x0a, lpf: 0x0b }),
  center: Object.freeze({ hpf: 0x0c, lpf: 0x0d }),
  sub: Object.freeze({ hpf: 0x0e, lpf: 0x0f }),
});

// Native-app USB sniffs supplied 06/07.07.2026 prove HPF/LPF frequency is
// NOT a top/music/output block write. It is a compact CMD 0x11 write.
//
// BT frame body is 6 bytes:
//   AA 06 11 [section+kind selector] [filter type] [freq u16 LE] [state] CS
//
// USB HID is produced from that BT frame by toUsbFrame():
//   AA 06 00 11 [section+kind selector] [filter type] [freq u16 LE] [state] CS
//
// Critical bug fixed in v0.8.22: the previous implementation returned
// buildFrame([0x11, ...]) without the BT length byte. On USB this was
// reframed as AA 11 00 ... (length 0x11) and the old BT checksum became a
// payload byte, exactly matching the broken appclone sniff and capable of
// corrupting/muting live device state.
//
// The byte immediately after the selector is the filter type code (01 Bessel
// 12, 02 Butter 12, 06 Butter 24, 07 LR24). This is why the native Main LPF
// frame is `... 05 02 ...`, Surround is `... 09 01 ...`, and Sub is
// `... 0F 06 ...`.
//
// The final payload byte is section-specific. It is NOT the Equipment Mode
// index: native Music captures show 0x04, 0x09 and 0x32 in different device
// states, while every verified Main/Surround/Center/Sub LPF capture uses 0x00.
// The live layer therefore mirrors the current Music state byte read from the
// device instead of inventing it from the selected preset slot. 0x32 is only
// the disconnected/no-readback fallback because that is the value present in
// the latest native type-change captures supplied on 11.07.2026.
function crossoverTailByte(eqKey: string, musicStateByte?: number): number {
  if (eqKey !== "music") return 0x00;
  const n = Number(musicStateByte);
  return byte(Number.isFinite(n) ? n : 0x32);
}

function crossoverTypeByte(crossover: EqCrossover | undefined, kind: CrossoverLiveKind): number {
  if (!crossover) return 0x02;
  const label = kind === "hpf" ? crossover.hpType : crossover.lpType;
  const raw = kind === "hpf" ? crossover.hpTypeRaw : crossover.lpTypeRaw;
  return crossoverFilterCode(label, raw, 0x02);
}

export function supportsCrossoverWrite(eqKey: string): boolean {
  return CROSSOVER_SELECTOR[eqKey] !== undefined;
}

export function buildCrossoverWrite(
  eqKey: string,
  kind: CrossoverLiveKind,
  hz: number,
  crossover?: EqCrossover,
  musicStateByte?: number,
): Uint8Array {
  const spec = CROSSOVER_SELECTOR[eqKey];
  if (!spec) throw new Error(`Unsupported crossover live section: ${eqKey}`);
  const selector = spec[kind];
  const typeCode = crossoverTypeByte(crossover, kind);
  const safeHz = clampFilterHz(eqKey, kind, hz);
  const [fl, fh] = u16le(safeHz);
  return buildFrame([0x06, 0x11, selector, typeCode, fl, fh, crossoverTailByte(eqKey, musicStateByte)]);
}


function outputBaseData(preset: Preset, which: "main" | "surround" | "center" | "sub"): number[] {
  const base = OUTPUT_FILE_BASE[which];
  const source = preset.bytes?.slice(base, base + OUTPUT_DATA_LEN) ?? new Uint8Array(OUTPUT_DATA_LEN);
  const data = Array.from(source, byte);
  while (data.length < OUTPUT_DATA_LEN) data.push(0x00);
  return data.slice(0, OUTPUT_DATA_LEN);
}

export function buildOutputBlock(which: "main" | "surround" | "center" | "sub", preset: Preset): Uint8Array {
  const ss = OUTPUT_SECTION_ID[which];
  if (ss === undefined) throw new Error(`Unsupported output block: ${which}`);
  const data = outputBaseData(preset, which);

  if (which === "main") {
    const o = preset.outputs.main;
    data[0] = outDbToRaw(o.lVolDb);
    data[2] = outDbToRaw(o.rVolDb);
    data[4] = byte(o.micDirect);
    data[6] = byte(o.musicLevel);
    data[8] = byte(o.reverbLevel);
    data[10] = byte(o.echoLevel);
    data[12] = byte(o.compThresholdDb + 50);
    data[13] = byte(o.compRatio);
    data[14] = byte(o.attackMs);
    data[15] = byte(Math.round(o.releaseSec * 10));
  }

  if (which === "surround") {
    const o = preset.outputs.surround;
    data[0] = outDbToRaw(o.lVolDb);
    data[2] = outDbToRaw(o.rVolDb);
    data[4] = byte(o.micDirect);
    data[6] = byte(o.musicLevel);
    data[8] = byte(o.reverbLevel);
    data[10] = byte(o.echoLevel);
    data[12] = byte(o.compThresholdDb + 50);
    data[13] = byte(o.compRatio);
    data[14] = byte(o.attackMs);
    data[15] = byte(Math.round(o.releaseSec * 10));
    const [ldl, ldh] = u16le(o.lDelayMs);
    const [rdl, rdh] = u16le(o.rDelayMs);
    data[16] = ldl; data[17] = ldh;
    data[18] = rdl; data[19] = rdh;
  }

  if (which === "center") {
    const o = preset.outputs.center;
    data[0] = outDbToRaw(o.outputVolDb);
    data[4] = byte(o.micDirect);
    data[6] = byte(o.musicLevel);
    data[8] = byte(o.reverbLevel);
    data[10] = byte(o.echoLevel);
    data[12] = byte(o.compThresholdDb + 50);
    data[13] = byte(o.compRatio);
    data[14] = byte(o.attackMs);
    data[15] = byte(Math.round(o.releaseSec * 10));
  }

  if (which === "sub") {
    const o = preset.outputs.sub;
    data[0] = outDbToRaw(o.outputVolDb);
    data[4] = byte(o.micDirect);
    data[6] = byte(o.musicLevel);
    data[8] = byte(o.reverbLevel);
    data[10] = byte(o.echoLevel);
    data[12] = byte(o.compThresholdDb + 50);
    data[13] = byte(o.compRatio);
    data[14] = byte(o.attackMs);
    data[15] = byte(Math.round(o.releaseSec * 10));
  }

  return buildFrame([0x25, 0x0e, ss, ...data]);
}

export function buildMicEqLink(enabled: boolean): Uint8Array {
  // Confirmed by capture:
  // OFF: AA 04 3C 00 00 C4 FC
  // ON : AA 04 3C 01 01 9E 20
  return buildFrame(enabled ? [0x04, 0x3c, 0x01, 0x01, 0x9e] : [0x04, 0x3c, 0x00, 0x00, 0xc4]);
}


function musicSourceRaw(preset: Preset): number {
  const fromLabel: Record<string, number> = {
    "Input 1": 0,
    "Input 2": 1,
    Bluetooth: 2,
    UDisk: 3,
    Digital: 4,
  };
  const labelRaw = fromLabel[String(preset.music.source)] ;
  if (labelRaw !== undefined) return labelRaw;
  return clamp(Number(preset.music.sourceRaw ?? 2), 0, 4);
}

/** Master volume range on the device: 0..84 (0x54), verified from the native
 *  UI and the Master_Music_Vol sniffs (max frame value 0x54). */
export const TOP_VOL_MAX = 84;

/**
 * Music block CMD 0x02 — layout verified byte-for-byte against the
 * Master_Music_Vol_84_to_min_0 / _0_to_max_84 USB sniffs (06.07.2026),
 * cross-correlated with the USB_Connect readback (04.07.2026) where the
 * gains at live 0x16..0x1A read 09 09 09 08 08 = -3,-3,-3,-4,-4 exactly as
 * the native Music tab showed:
 *
 *   AA 0D 00 02 [vol] [init] [max] [src] [g1 g2 gBT gUD gDig] [key+7] [gate] [type] CS
 *
 * v0.8.16 sent topMicVol/topEffectVol/micMaxVol/musicInitVol into positions
 * [1][2][10][11]. Position [10] is the noise gate (sniff/native UI: OFF =
 * 0x00); writing micMaxVol=84 there gated ALL music audio — the permanent
 * mute bug. Rarely-edited fields ([1][2][10][11]) are therefore mirrored
 * from the device's own scalar bytes (connect readback / refresh), never
 * from possibly-misparsed model fields.
 *
 * `deviceScalars` = raw live bytes 0x00..0x3F from the device.
 */
export function buildTopMusicBlock(preset: Preset, deviceScalars: Uint8Array | null): Uint8Array {
  const s = preset.system;
  const raw = (liveOff: number, fallback: number) =>
    deviceScalars && liveOff < deviceScalars.length ? deviceScalars[liveOff] : fallback;
  return buildFrame([
    0x0d,
    0x02,
    byte(clamp(s.topMusicVol, 0, TOP_VOL_MAX)),      // [0] master music volume
    raw(0x03, byte(s.musicInitVol)),                  // [1] music init vol (device-mirrored)
    raw(0x04, TOP_VOL_MAX),                           // [2] music max vol (device-mirrored)
    byte(musicSourceRaw(preset)),                     // [3] active source (BT=0x02, ...)
    byte(preset.music.input1GainDb + 12),             // [4..8] gains, encoding gain+12
    byte(preset.music.input2GainDb + 12),
    byte(preset.music.btGainDb + 12),
    byte(preset.music.uDiskGainDb + 12),
    byte(preset.music.digitalGainDb + 12),
    byte(preset.music.key + 7),                       // [9] music key + 7
    raw(0x1b, 0x00),                                  // [10] noise gate (device-mirrored; 0x00 = OFF)
    raw(0x07, 0x02),                                  // [11] filter type code (device-mirrored)
  ]);
}

/**
 * Mic block CMD 0x05 — layout verified byte-for-byte against the
 * Master_Mic_Vol_84_to_min_0 / _0_to_max_84 USB sniffs (06.07.2026),
 * cross-correlated with the USB_Connect readback: constants 19 54 0b 60 60
 * 26 03 0a 02 map exactly to live 0x0A (micInit=25), 0x0B (micMax=84),
 * 0x0E, 0x0C/0x0D (micA/micB vol = 96/96 as in the native UI), and the
 * verified compressor encodings (TH -12 → +50 = 0x26, ratio 3, attack 10,
 * release 0.2 s → ×10 = 2):
 *
 *   AA 0E 00 05 [vol] [init] [max] [gate] [fbxA] [fbxB] [micA] [micB]
 *               [compTH+50] [ratio] [attack] [rel×10] [00] CS
 *
 * The previous builder put topMusicVol/topEffectVol at [1][2] (device fields
 * micInit/micMax), micAVol at [3] (unknown device field), micBVol at [6][7],
 * and eqLink at [12] — every mic fader move corrupted five device fields.
 * Bytes [4]/[5] map to live scalar 0x13/0x14 (file 0x1B/0x1C). The native
 * UI presents them as one FBX depth, so the shared editor value is written
 * to both channels. Rarely-edited fields are mirrored from the device cache.
 */
export function buildTopMicBlock(preset: Preset, deviceScalars: Uint8Array | null): Uint8Array {
  const m = preset.mic;
  const raw = (liveOff: number, fallback: number) =>
    deviceScalars && liveOff < deviceScalars.length ? deviceScalars[liveOff] : fallback;
  return buildFrame([
    0x0e,
    0x05,
    byte(clamp(preset.system.topMicVol, 0, TOP_VOL_MAX)), // [0] master mic volume
    raw(0x0a, byte(preset.system.micInitVol)),            // [1] mic init vol (device-mirrored)
    raw(0x0b, TOP_VOL_MAX),                               // [2] mic max vol (device-mirrored)
    raw(0x0e, 0x0b),                                      // [3] noise gate (device-mirrored)
    byte(clamp(m.fbxLevel, 0, 20)),                       // [4] FBX Mic A (live 0x13)
    byte(clamp(m.fbxLevel, 0, 20)),                       // [5] FBX Mic B (live 0x14)
    byte(m.micAVol),                                      // [6] mic A input volume (live 0x0C)
    byte(m.micBVol),                                      // [7] mic B input volume (live 0x0D)
    byte(m.compThresholdDb + 50),                         // [8] comp threshold, TH+50
    byte(m.compRatio),                                    // [9] comp ratio
    byte(m.attackMs),                                     // [10] comp attack ms
    byte(Math.round(m.releaseSec * 10)),                  // [11] comp release ×10
    0x00,                                                 // [12] 0x00 in all sniffed frames (NOT eqLink)
  ]);
}

/**
 * Effect block CMD 0x09 — verified against Master_Effect_Vol sniffs
 * (06.07.2026): AA 03 00 09 [vol] [effectInit] CS, effectInit = live 0x15
 * (0x19 = 25 in both sessions). Init is device-mirrored so a stale model
 * value can never overwrite it.
 */
export function buildTopEffectBlock(preset: Preset, deviceScalars: Uint8Array | null): Uint8Array {
  const init = deviceScalars && deviceScalars.length > 0x15 ? deviceScalars[0x15] : byte(preset.system.effectInitLevel);
  return buildFrame([0x03, 0x09, byte(clamp(preset.system.topEffectVol, 0, TOP_VOL_MAX)), init]);
}
