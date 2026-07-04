
import { parseK500Preset, serializeK500Preset } from "@/features/k500/parser";
import type { Preset } from "@/features/k500/types";

const NAME_OFFSET = 0x0454;
const NAME_LENGTH = 0x21;

// The live active-memory map omits exactly one byte relative to the .k500 file
// (the file byte at 0x0097 has no live counterpart). Verified against the
// COM18 connect capture vs sample.k500:
//   live[0x0000..0x008e] == file[0x0008..0x0096]  (delta +8)
//   live[0x008f..0x00e6] == file[0x0098..0x00ef]  (delta +9)
// The compact EQ region starting at live 0x00e7 also lines up with file 0x00f0
// under the same +9 shift. Using a flat +8 (v0.7.6) corrupted every field past
// 0x0097: mic HPF/LPF, sub crossover, reverb/echo filters and surround delays.
const LIVE_SCALAR_DELTA_LOW = 0x08;
const LIVE_SCALAR_SPLIT = 0x8f;
const LIVE_SCALAR_DELTA_HIGH = 0x09;

// Per-section crossover frequencies live in the shared scalar block. These
// .k500 file offsets were verified byte-for-byte between the connect readback
// and the section footers in sample.k500 (Main HPF 40 Hz / LPF 20 kHz exactly
// as shown by the original Professional Audio System UI).
const SECTION_XOVER_SCALARS: Record<string, { hpf: number; lpf: number }> = {
  micA: { hpf: 0x0098, lpf: 0x009a },
  micB: { hpf: 0x0098, lpf: 0x009a },
  music: { hpf: 0x009c, lpf: 0x009e },
  main: { hpf: 0x00a0, lpf: 0x00a4 },
  mainAlt: { hpf: 0x00a2, lpf: 0x00a6 },
  surround: { hpf: 0x00a8, lpf: 0x00ac },
  surroundAlt: { hpf: 0x00aa, lpf: 0x00ae },
  center: { hpf: 0x00b0, lpf: 0x00b4 },
  centerAlt: { hpf: 0x00b2, lpf: 0x00b6 },
  sub: { hpf: 0x00b8, lpf: 0x00bc },
  subAlt: { hpf: 0x00ba, lpf: 0x00be },
  reverb: { hpf: 0x00c0, lpf: 0x00c2 },
  echo: { hpf: 0x00c4, lpf: 0x00c6 },
};

// Live device memory uses compact EQ bands:
// freq uint16 LE, Qx10 uint8, type/sign uint8, gain magnitude x10 uint8.
const LIVE_EQ_SECTIONS: Record<string, { liveOffset: number; fileOffset: number; bands: number }> = {
  micA: { liveOffset: 0x00e7, fileOffset: 0x00f0, bands: 10 },
  micB: { liveOffset: 0x0119, fileOffset: 0x0150, bands: 10 },
  music: { liveOffset: 0x014b, fileOffset: 0x01b0, bands: 7 },
  main: { liveOffset: 0x016e, fileOffset: 0x01f8, bands: 7 },
  mainAlt: { liveOffset: 0x0191, fileOffset: 0x0240, bands: 7 },
  surround: { liveOffset: 0x01b4, fileOffset: 0x0288, bands: 5 },
  surroundAlt: { liveOffset: 0x01cd, fileOffset: 0x02c0, bands: 5 },
  center: { liveOffset: 0x01e6, fileOffset: 0x02f8, bands: 5 },
  centerAlt: { liveOffset: 0x01ff, fileOffset: 0x0330, bands: 5 },
  sub: { liveOffset: 0x0218, fileOffset: 0x0368, bands: 5 },
  subAlt: { liveOffset: 0x0231, fileOffset: 0x03a0, bands: 5 },
  reverb: { liveOffset: 0x024a, fileOffset: 0x03d8, bands: 5 },
  echo: { liveOffset: 0x0263, fileOffset: 0x0410, bands: 5 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function setU16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, clamp(Math.round(value), 0, 0xffff), true);
}

function setI16(view: DataView, offset: number, value: number) {
  view.setInt16(offset, clamp(Math.round(value), -32768, 32767), true);
}

function fileEqTypeFromLive(typeSign: number): number {
  const typeNibble = typeSign & 0x70;
  if (typeNibble === 0x10) return 0x0100; // LS
  if (typeNibble === 0x20) return 0x0200; // HS
  return 0x0000; // P / bell
}

function readCString(bytes: Uint8Array, offset: number, length: number): string {
  if (offset < 0 || offset >= bytes.length) return "";
  const slice = bytes.slice(offset, Math.min(bytes.length, offset + length));
  const zero = slice.indexOf(0);
  const usable = zero >= 0 ? slice.slice(0, zero) : slice;
  return new TextDecoder("ascii").decode(usable).replace(/[^\x20-\x7e]/g, "").trim();
}

function writeFixedAscii(bytes: Uint8Array, offset: number, length: number, text: string) {
  const clean = String(text ?? "").replace(/[^\x20-\x7e]/g, "").slice(0, length);
  bytes.fill(0, offset, offset + length);
  bytes.set(new TextEncoder().encode(clean).slice(0, length), offset);
}

function patchCompactEqSection(fileBytes: Uint8Array, live: Uint8Array, liveOffset: number, fileOffset: number, bands: number) {
  const view = new DataView(fileBytes.buffer);
  for (let i = 0; i < bands; i++) {
    const src = liveOffset + i * 5;
    const dst = fileOffset + 2 + i * 8;
    if (src + 4 >= live.length || dst + 7 >= fileBytes.length) continue;

    const freq = live[src] | (live[src + 1] << 8);
    const qRaw = live[src + 2];
    const typeSign = live[src + 3];
    const gainMag = live[src + 4];
    const sign = (typeSign & 0x80) ? -1 : 1;

    setU16(view, dst + 0, fileEqTypeFromLive(typeSign));
    setU16(view, dst + 2, clamp(freq, 20, 20000));
    setU16(view, dst + 4, clamp(qRaw, 1, 300));
    setI16(view, dst + 6, sign * clamp(gainMag, 0, 240));
  }
}

/**
 * Convert K500 active device memory read via BT command 0x40 into the normal
 * .k500 preset model used by the editor.
 *
 * Important:
 * - The live memory map is shorter than the .k500 file.
 * - Scalar fields mostly map to .k500 offset + 0x08.
 * - EQ bands are compact 5-byte live records and must be expanded to .k500 8-byte records.
 * - Save/store-to-device is still disabled; this is for UI synchronization and RAM live edit only.
 */
export function buildPresetFromLiveMemory(basePresetBytes: Uint8Array, liveMemory: Uint8Array): Preset {
  const bytes = new Uint8Array(basePresetBytes);
  const scalarLen = Math.min(liveMemory.length, 0x00e7);

  // Patch scalar/device control memory into the .k500-shaped byte array using
  // the verified split delta (+8 below the split, +9 from the split onward).
  for (let i = 0; i < scalarLen; i++) {
    const delta = i < LIVE_SCALAR_SPLIT ? LIVE_SCALAR_DELTA_LOW : LIVE_SCALAR_DELTA_HIGH;
    const fileOffset = i + delta;
    if (fileOffset < bytes.length) bytes[fileOffset] = liveMemory[i];
  }

  // Expand live compact EQ records into the .k500 EQ blocks.
  for (const section of Object.values(LIVE_EQ_SECTIONS)) {
    patchCompactEqSection(bytes, liveMemory, section.liveOffset, section.fileOffset, section.bands);
  }

  // Propagate the device crossover frequencies from the scalar block into each
  // EQ section footer, so the PEQ graph HP/LP handles show the device truth
  // instead of whatever the base preset happened to contain (e.g. DEFAULT FLAT).
  {
    const view = new DataView(bytes.buffer);
    for (const [key, section] of Object.entries(LIVE_EQ_SECTIONS)) {
      const scalars = SECTION_XOVER_SCALARS[key];
      if (!scalars) continue;
      const footer = section.fileOffset + 2 + section.bands * 8;
      if (footer + 11 >= bytes.length) continue;
      const hpf = clamp(view.getUint16(scalars.hpf, true), 20, 20000);
      const lpf = clamp(view.getUint16(scalars.lpf, true), 20, 20000);
      view.setUint16(footer + 2, lpf, true); // footer: lpType, lpfHz, ..., hpType, hpfHz
      view.setUint16(footer + 10, hpf, true);
    }
  }

  // Device readback includes the active preset name around 0x02c0 in observed captures.
  const liveName = readCString(liveMemory, 0x02c0, 0x21);
  if (liveName) writeFixedAscii(bytes, NAME_OFFSET, NAME_LENGTH, liveName);

  // Parse and immediately serialize to normalize checksum and duplicated known fields.
  let preset = parseK500Preset(new Uint8Array(bytes).buffer);
  const normalized = serializeK500Preset(structuredClone(preset));
  preset = parseK500Preset(new Uint8Array(normalized).buffer);
  preset.checksumOk = true;
  return preset;
}
