import type { EqBand, Preset } from "@/features/k500/types";
import { buildFrame, byte } from "./frame";

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

export function buildMute(mute: boolean): Uint8Array {
  return buildFrame([0x03, 0x15, mute ? 0x01 : 0x00, 0x00]);
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

const CROSSOVER_LIVE_PARAM: Record<CrossoverLiveKind, number> = Object.freeze({
  hpf: 0x02,
  lpf: 0x03,
});

// Native-app USB sniffs supplied 06/07.07.2026 prove HPF/LPF frequency is
// NOT a top/music/output block write. It is a compact CMD 0x11 write.
//
// BT frame body is 6 bytes:
//   AA 06 11 [02=HPF|03=LPF] [section] [freq u16 LE] [mode] CS
//
// USB HID is produced from that BT frame by toUsbFrame():
//   AA 06 00 11 [02=HPF|03=LPF] [section] [freq u16 LE] [mode] CS
//
// Critical bug fixed in v0.8.22: the previous implementation returned
// buildFrame([0x11, ...]) without the BT length byte. On USB this was
// reframed as AA 11 00 ... (length 0x11) and the old BT checksum became a
// payload byte, exactly matching the broken appclone sniff and capable of
// corrupting/muting live device state.
//
// The last payload byte is not a fixed filter-type constant. The older Music
// HPF/LPF native sniff used 0x04, while the latest Native_App_HPF sniff uses
// 0x09. This matches the active Equipment Mode / preset slot byte, so live
// crossover writes must use preset.system.deviceModeIndex rather than a
// hardcoded 0x04.
function crossoverModeByte(modeIndex?: number): number {
  return byte(clamp(Number(modeIndex) || 4, 1, 10));
}

export function buildCrossoverWrite(eqKey: string, kind: CrossoverLiveKind, hz: number, modeIndex?: number): Uint8Array {
  const section = EQ_SECTION_ID[eqKey];
  if (section === undefined) throw new Error(`Unsupported crossover live section: ${eqKey}`);
  const param = CROSSOVER_LIVE_PARAM[kind];
  const [fl, fh] = u16le(clamp(hz, 20, 20000));
  return buildFrame([0x06, 0x11, param, section, fl, fh, crossoverModeByte(modeIndex)]);
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
 *   AA 0E 00 05 [vol] [init] [max] [x0E] [00] [00] [micA] [micB]
 *               [compTH+50] [ratio] [attack] [rel×10] [00] CS
 *
 * The previous builder put topMusicVol/topEffectVol at [1][2] (device fields
 * micInit/micMax), micAVol at [3] (unknown device field), micBVol at [6][7],
 * and eqLink at [12] — every mic fader move corrupted five device fields.
 * Rarely-edited fields are mirrored from the device scalar cache.
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
    raw(0x0e, 0x0b),                                      // [3] unknown field (device-mirrored)
    0x00,                                                 // [4] 0x00 in all sniffed frames
    0x00,                                                 // [5] 0x00 in all sniffed frames
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
