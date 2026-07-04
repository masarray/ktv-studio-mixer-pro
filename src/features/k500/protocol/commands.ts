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
  const q = byte(Math.round(clamp(band.q, 0.1, 30) * 10));
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

export function buildTopMusicBlock(preset: Preset): Uint8Array {
  const s = preset.system;
  // Reverse-engineered live command block family. The first byte is top music volume.
  return buildFrame([
    0x0d,
    0x02,
    byte(s.topMusicVol),
    byte(s.topMicVol),
    byte(s.topEffectVol),
    byte(preset.music.sourceRaw ?? 2),
    byte(preset.music.input1GainDb + 12),
    byte(preset.music.input2GainDb + 12),
    byte(preset.music.btGainDb + 12),
    byte(preset.music.uDiskGainDb + 12),
    byte(preset.music.digitalGainDb + 12),
    byte(preset.music.key + 7),
    byte(s.micMaxVol),
    byte(s.musicInitVol),
  ]);
}

export function buildTopMicBlock(preset: Preset): Uint8Array {
  const m = preset.mic;
  // Confirmed block family from Mic volume capture; byte 0 is top/mic current volume.
  return buildFrame([
    0x0e,
    0x05,
    byte(preset.system.topMicVol),
    byte(preset.system.topMusicVol),
    byte(preset.system.topEffectVol),
    byte(m.micAVol),
    0x00,
    0x00,
    byte(m.micBVol),
    byte(m.micBVol),
    byte(m.compThresholdDb + 50),
    byte(m.compRatio),
    byte(m.attackMs),
    byte(Math.round(m.releaseSec * 10)),
    byte(m.eqLink ? 1 : 0),
  ]);
}

export function buildTopEffectBlock(preset: Preset): Uint8Array {
  // Confirmed from Effect volume capture: AA 03 09 <topFx> <init/current> CS.
  return buildFrame([0x03, 0x09, byte(preset.system.topEffectVol), byte(preset.system.effectInitLevel)]);
}
