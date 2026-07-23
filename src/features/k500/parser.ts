// @ts-nocheck
import { clampFilterHz } from "./filterRanges";
import { FILTER_TYPE_TO_UI, UI_TO_FILTER_TYPE } from "./filterTypes";
const CHECKSUM_OFFSET = 0x0475;
const NAME_OFFSET = 0x0454;
const NAME_LENGTH = 0x21;

const EQ_TYPE_TO_UI = new Map([
  [0x0000, "P"],
  [0x0001, "P"],
  [0x0002, "P"],
  [0x0003, "P"],
  [0x0100, "LS"],
  [0x0200, "HS"],
]);

const UI_TO_EQ_TYPE = {
  P: 0x0000,
  LS: 0x0100,
  HS: 0x0200,
};

const EQ_SECTIONS = Object.freeze({
  micA: { label: "Mic A", offset: 0x00f0, bands: 10, channel: "mic" },
  micB: { label: "Mic B", offset: 0x0150, bands: 10, channel: "mic" },
  music: { label: "Music", offset: 0x01b0, bands: 7, channel: "music" },
  main: { label: "Main", offset: 0x01f8, bands: 7, channel: "output" },
  mainAlt: { label: "Main Alt", offset: 0x0240, bands: 7, channel: "output" },
  surround: { label: "Surround", offset: 0x0288, bands: 5, channel: "output" },
  surroundAlt: { label: "Surround Alt", offset: 0x02c0, bands: 5, channel: "output" },
  center: { label: "Center", offset: 0x02f8, bands: 5, channel: "output" },
  centerAlt: { label: "Center Alt", offset: 0x0330, bands: 5, channel: "output" },
  sub: { label: "Subwoofer", offset: 0x0368, bands: 5, channel: "output" },
  subAlt: { label: "Sub Alt", offset: 0x03a0, bands: 5, channel: "output" },
  reverb: { label: "Reverb", offset: 0x03d8, bands: 5, channel: "fx" },
  echo: { label: "Echo", offset: 0x0410, bands: 5, channel: "fx" },
});

const SECTIONS_BY_PAGE = Object.freeze({
  mic: ["micA", "micB"],
  music: ["music"],
  main: ["main"],
  surround: ["surround"],
  center: ["center"],
  sub: ["sub"],
  reverb: ["reverb"],
  echo: ["echo"],
});

const DEFAULT_DEVICE_MODE_NAMES = Object.freeze([
  "ARTIST GEN3 ARI",
  "PODCAST REBORN",
  "DANGDUT GEN3 ARI",
  "KARAOKE ARTIST",
  "AKUSTIK GEN3 ARI",
  "IMAM QORI GEN 3",
  "JAZZ GEN3 ARI",
  "ROCK GEN3 ARI",
  "MC CERAMAH GEN 3",
  "ADZAN MEKAH GEN3",
]);

function defaultDeviceModeIndex(presetName) {
  const clean = String(presetName || "").trim().toUpperCase();
  const idx = DEFAULT_DEVICE_MODE_NAMES.findIndex((name) => name.toUpperCase() === clean);
  return idx >= 0 ? idx + 1 : 4;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function readCString(bytes, offset, length) {
  const slice = bytes.slice(offset, offset + length);
  const zero = slice.indexOf(0);
  const usable = zero >= 0 ? slice.slice(0, zero) : slice;
  return new TextDecoder("ascii").decode(usable).trimEnd();
}

function writeFixedAscii(bytes, offset, length, text) {
  const clean = String(text ?? "").replace(/[^\x20-\x7e]/g, "").slice(0, length);
  bytes.fill(0, offset, offset + length);
  const encoded = new TextEncoder().encode(clean.padEnd(Math.min(length, clean.length + 2), " "));
  bytes.set(encoded.slice(0, length), offset);
}

function readEqBand(view, offset, index) {
  const typeRaw = view.getUint16(offset + 0, true);
  return {
    index,
    typeRaw,
    type: EQ_TYPE_TO_UI.get(typeRaw) ?? `0x${typeRaw.toString(16).padStart(4, "0")}`,
    frequencyHz: view.getUint16(offset + 2, true),
    q: view.getUint16(offset + 4, true) / 10,
    gainDb: view.getInt16(offset + 6, true) / 10,
  };
}

function writeEqBand(view, offset, band) {
  const typeRaw = UI_TO_EQ_TYPE[band.type] ?? (Number(band.typeRaw) || 0);
  view.setUint16(offset + 0, typeRaw, true);
  view.setUint16(offset + 2, clamp(Math.round(Number(band.frequencyHz) || 20), 20, 20000), true);
  view.setUint16(offset + 4, clamp(Math.round((Number(band.q) || 0.1) * 10), 1, 300), true);
  view.setInt16(offset + 6, clamp(Math.round((Number(band.gainDb) || 0) * 10), -240, 240), true);
}

function readCrossover(view, start) {
  const lpTypeRaw = view.getUint16(start + 0, true);
  const hpTypeRaw = view.getUint16(start + 8, true);
  return {
    lpTypeRaw,
    lpType: FILTER_TYPE_TO_UI.get(lpTypeRaw) ?? `0x${lpTypeRaw.toString(16).padStart(4, "0")}`,
    lpfHz: view.getUint16(start + 2, true),
    hpTypeRaw,
    hpType: FILTER_TYPE_TO_UI.get(hpTypeRaw) ?? `0x${hpTypeRaw.toString(16).padStart(4, "0")}`,
    hpfHz: view.getUint16(start + 10, true),
  };
}

function writeCrossover(view, start, crossover, eqKey = "") {
  if (!crossover) return;
  const lpRaw = UI_TO_FILTER_TYPE[crossover.lpType] ?? Number(crossover.lpTypeRaw) ?? 0;
  const hpRaw = UI_TO_FILTER_TYPE[crossover.hpType] ?? Number(crossover.hpTypeRaw) ?? 0;
  view.setUint16(start + 0, lpRaw, true);
  view.setUint16(start + 2, clampFilterHz(eqKey, "lpf", Math.round(Number(crossover.lpfHz) || 20000)), true);
  view.setUint16(start + 8, hpRaw, true);
  view.setUint16(start + 10, clampFilterHz(eqKey, "hpf", Math.round(Number(crossover.hpfHz) || 20)), true);
}

function readEqSection(view, key, descriptor) {
  const offset = descriptor.offset;
  const bands = [];
  for (let i = 0; i < descriptor.bands; i++) {
    bands.push(readEqBand(view, offset + 2 + i * 8, i + 1));
  }
  const footerStart = offset + 2 + descriptor.bands * 8;
  return {
    key,
    label: descriptor.label,
    offset,
    enabledFlag: view.getUint16(offset, true),
    bands,
    crossover: readCrossover(view, footerStart),
  };
}

function writeEqSection(view, section) {
  view.setUint16(section.offset, section.enabledFlag ?? 0, true);
  section.bands.forEach((band, i) => writeEqBand(view, section.offset + 2 + i * 8, band));
  writeCrossover(view, section.offset + 2 + section.bands.length * 8, section.crossover, section.key);
}

function u8(view, offset) {
  return view.getUint8(offset);
}
function setU8(view, offset, value) {
  view.setUint8(offset, clamp(Math.round(Number(value) || 0), 0, 255));
}
function u16(view, offset) {
  return view.getUint16(offset, true);
}
function setU16(view, offset, value) {
  view.setUint16(offset, clamp(Math.round(Number(value) || 0), 0, 65535), true);
}
function outDbFromRaw(raw) {
  return (raw - 75) / 2;
}
function outDbToRaw(db) {
  return clamp(Math.round(Number(db) * 2 + 75), 0, 255);
}

function decodeMusicSource(raw) {
  return ["Input 1", "Input 2", "Bluetooth", "UDisk", "Digital"][raw] ?? `Unknown ${raw}`;
}
function encodeMusicSource(label) {
  return { "Input 1": 0, "Input 2": 1, Bluetooth: 2, UDisk: 3, Digital: 4 }[label] ?? 2;
}

function checksum(bytes) {
  return bytes.reduce((sum, b) => (sum + b) & 0xff, 0);
}

function updateChecksum(bytes) {
  bytes[CHECKSUM_OFFSET] = 0;
  const sum = checksum(bytes);
  bytes[CHECKSUM_OFFSET] = (256 - sum) & 0xff;
  return bytes[CHECKSUM_OFFSET];
}

function validateChecksum(bytes) {
  return checksum(bytes) === 0;
}

function parseK500Preset(buffer) {
  const bytes = new Uint8Array(buffer.slice(0));
  const view = new DataView(bytes.buffer);
  const eq = {};
  Object.entries(EQ_SECTIONS).forEach(([key, descriptor]) => {
    eq[key] = readEqSection(view, key, descriptor);
  });

  const preset = {
    bytes,
    length: bytes.length,
    name: readCString(bytes, NAME_OFFSET, NAME_LENGTH),
    checksum: u8(view, CHECKSUM_OFFSET),
    checksumOk: validateChecksum(bytes),
    system: {
      topMusicVol: u8(view, 0x0008),
      topMicVol: u8(view, 0x0009),
      topEffectVol: u8(view, 0x000a),
      musicInitVol: u8(view, 0x000b),
      musicMaxVol: u8(view, 0x000c),
      micInitVol: u8(view, 0x0012),
      micMaxVol: u8(view, 0x0013),
      effectInitLevel: u8(view, 0x001d),
      uDiskRecordVol: u8(view, 0x0095) + 1,
      usbRecordVol: u8(view, 0x0096) + 1,
      deviceModeIndex: defaultDeviceModeIndex(readCString(bytes, NAME_OFFSET, NAME_LENGTH)),
      deviceModeNames: [...DEFAULT_DEVICE_MODE_NAMES],
      btName: "KTV_BT_00AB12",
      bleName: "KTV_BLE_00AB12",
      danceMicThresholdDb: -50,
      danceMicTimeSec: 6,
    },
    mic: {
      micAVol: u8(view, 0x0014),
      micBVol: u8(view, 0x0015),
      // Native Mic block payload bytes [4]/[5] mirror file bytes 0x1B/0x1C.
      // The original editor exposes these as one shared FBX depth control.
      fbxLevel: Math.round((u8(view, 0x001b) + u8(view, 0x001c)) / 2),
      noiseGateDb: u8(view, 0x0016) - 81,
      compThresholdDb: u8(view, 0x0017) - 50,
      compRatio: u8(view, 0x0018),
      attackMs: u8(view, 0x0019),
      releaseSec: u8(view, 0x001a) / 10,
      eqLink: u8(view, 0x0092) === 1,
      hpfHz: u16(view, 0x0098),
      lpfHz: u16(view, 0x009a),
    },
    music: {
      sourceRaw: u8(view, 0x000e),
      source: decodeMusicSource(u8(view, 0x000e)),
      key: u8(view, 0x0011) - 7,
      input1GainDb: u8(view, 0x001e) - 12,
      input2GainDb: u8(view, 0x001f) - 12,
      btGainDb: u8(view, 0x0020) - 12,
      uDiskGainDb: u8(view, 0x0021) - 12,
      digitalGainDb: u8(view, 0x0022) - 12,
      noiseGateDb: -70,
      bassDb: 0,
      midDb: 0,
      midFreqHz: 1000,
      trebleDb: 0,
    },
    outputs: {
      main: {
        lVolDb: outDbFromRaw(u8(view, 0x0024)),
        rVolDb: outDbFromRaw(u8(view, 0x0026)),
        micDirect: u8(view, 0x0028),
        musicLevel: u8(view, 0x002a),
        reverbLevel: u8(view, 0x002c),
        echoLevel: u8(view, 0x002e),
        compThresholdDb: u8(view, 0x0030) - 50,
        compRatio: u8(view, 0x0031),
        attackMs: u8(view, 0x0032),
        releaseSec: u8(view, 0x0033) / 10,
      },
      surround: {
        lVolDb: outDbFromRaw(u8(view, 0x0038)),
        rVolDb: outDbFromRaw(u8(view, 0x003a)),
        micDirect: u8(view, 0x003c),
        musicLevel: u8(view, 0x003e),
        reverbLevel: u8(view, 0x0040),
        echoLevel: u8(view, 0x0042),
        compThresholdDb: u8(view, 0x0044) - 50,
        compRatio: u8(view, 0x0045),
        attackMs: u8(view, 0x0046),
        releaseSec: u8(view, 0x0047) / 10,
        lDelayMs: u16(view, 0x00d8),
        rDelayMs: u16(view, 0x00da),
      },
      center: {
        outputVolDb: outDbFromRaw(u8(view, 0x004c)),
        micDirect: u8(view, 0x0050),
        musicLevel: u8(view, 0x0052),
        reverbLevel: u8(view, 0x0054),
        echoLevel: u8(view, 0x0056),
        compThresholdDb: u8(view, 0x0058) - 50,
        compRatio: u8(view, 0x0059),
        attackMs: u8(view, 0x005a),
        releaseSec: u8(view, 0x005b) / 10,
      },
      sub: {
        outputVolDb: outDbFromRaw(u8(view, 0x0060)),
        micDirect: u8(view, 0x0064),
        musicLevel: u8(view, 0x0066),
        reverbLevel: u8(view, 0x0068),
        echoLevel: u8(view, 0x006a),
        compThresholdDb: u8(view, 0x006c) - 50,
        compRatio: u8(view, 0x006d),
        attackMs: u8(view, 0x006e),
        releaseSec: u8(view, 0x006f) / 10,
        hpfHz: u16(view, 0x00b8),
        lpfHz: u16(view, 0x00bc),
      },
    },
    effects: {
      reverb: {
        level: u8(view, 0x0074),
        hpfHz: u16(view, 0x00c0),
        lpfHz: u16(view, 0x00c2),
        decayMs: u16(view, 0x00c8),
        predelayMs: u16(view, 0x00ca),
      },
      echo: {
        level: u8(view, 0x007b),
        repeat: u8(view, 0x007c),
        hpfHz: u16(view, 0x00c4),
        lpfHz: u16(view, 0x00c6),
        leftDelayMs: u16(view, 0x00cc),
      },
    },
    eq,
  };
  return preset;
}

function serializeK500Preset(preset) {
  const bytes = new Uint8Array(preset.bytes);
  const view = new DataView(bytes.buffer);

  writeFixedAscii(bytes, NAME_OFFSET, NAME_LENGTH, preset.name);

  setU8(view, 0x0008, preset.system.topMusicVol);
  setU8(view, 0x0009, preset.system.topMicVol);
  setU8(view, 0x000a, preset.system.topEffectVol);
  setU8(view, 0x000b, preset.system.musicInitVol);
  setU8(view, 0x000c, preset.system.musicMaxVol);
  setU8(view, 0x0012, preset.system.micInitVol);
  setU8(view, 0x0013, preset.system.micMaxVol);
  setU8(view, 0x001d, preset.system.effectInitLevel);
  setU8(view, 0x0095, preset.system.uDiskRecordVol - 1);
  setU8(view, 0x0096, preset.system.usbRecordVol - 1);

  setU8(view, 0x0014, preset.mic.micAVol);
  setU8(view, 0x0015, preset.mic.micBVol);
  setU8(view, 0x001b, clamp(preset.mic.fbxLevel, 0, 20));
  setU8(view, 0x001c, clamp(preset.mic.fbxLevel, 0, 20));
  setU8(view, 0x0016, preset.mic.noiseGateDb + 81);
  setU8(view, 0x0017, preset.mic.compThresholdDb + 50);
  setU8(view, 0x0018, preset.mic.compRatio);
  setU8(view, 0x0019, preset.mic.attackMs);
  setU8(view, 0x001a, Math.round(preset.mic.releaseSec * 10));
  setU8(view, 0x0092, preset.mic.eqLink ? 1 : 0);
  setU16(view, 0x0098, clampFilterHz("micA", "hpf", preset.mic.hpfHz));
  setU16(view, 0x009a, clampFilterHz("micA", "lpf", preset.mic.lpfHz));

  setU8(view, 0x000e, encodeMusicSource(preset.music.source));
  setU8(view, 0x0011, preset.music.key + 7);
  setU8(view, 0x001e, preset.music.input1GainDb + 12);
  setU8(view, 0x001f, preset.music.input2GainDb + 12);
  setU8(view, 0x0020, preset.music.btGainDb + 12);
  setU8(view, 0x0021, preset.music.uDiskGainDb + 12);
  setU8(view, 0x0022, preset.music.digitalGainDb + 12);

  setU8(view, 0x0024, outDbToRaw(preset.outputs.main.lVolDb));
  setU8(view, 0x0026, outDbToRaw(preset.outputs.main.rVolDb));
  setU8(view, 0x0028, preset.outputs.main.micDirect);
  setU8(view, 0x002a, preset.outputs.main.musicLevel);
  setU8(view, 0x002c, preset.outputs.main.reverbLevel);
  setU8(view, 0x002e, preset.outputs.main.echoLevel);
  setU8(view, 0x0030, preset.outputs.main.compThresholdDb + 50);
  setU8(view, 0x0031, preset.outputs.main.compRatio);
  setU8(view, 0x0032, preset.outputs.main.attackMs);
  setU8(view, 0x0033, Math.round(preset.outputs.main.releaseSec * 10));

  setU8(view, 0x0038, outDbToRaw(preset.outputs.surround.lVolDb));
  setU8(view, 0x003a, outDbToRaw(preset.outputs.surround.rVolDb));
  setU8(view, 0x003c, preset.outputs.surround.micDirect);
  setU8(view, 0x003e, preset.outputs.surround.musicLevel);
  setU8(view, 0x0040, preset.outputs.surround.reverbLevel);
  setU8(view, 0x0042, preset.outputs.surround.echoLevel);
  setU8(view, 0x0044, preset.outputs.surround.compThresholdDb + 50);
  setU8(view, 0x0045, preset.outputs.surround.compRatio);
  setU8(view, 0x0046, preset.outputs.surround.attackMs);
  setU8(view, 0x0047, Math.round(preset.outputs.surround.releaseSec * 10));
  setU16(view, 0x00d8, preset.outputs.surround.lDelayMs);
  setU16(view, 0x00da, preset.outputs.surround.rDelayMs);

  setU8(view, 0x004c, outDbToRaw(preset.outputs.center.outputVolDb));
  setU8(view, 0x0050, preset.outputs.center.micDirect);
  setU8(view, 0x0052, preset.outputs.center.musicLevel);
  setU8(view, 0x0054, preset.outputs.center.reverbLevel);
  setU8(view, 0x0056, preset.outputs.center.echoLevel);
  setU8(view, 0x0058, preset.outputs.center.compThresholdDb + 50);
  setU8(view, 0x0059, preset.outputs.center.compRatio);
  setU8(view, 0x005a, preset.outputs.center.attackMs);
  setU8(view, 0x005b, Math.round(preset.outputs.center.releaseSec * 10));

  setU8(view, 0x0060, outDbToRaw(preset.outputs.sub.outputVolDb));
  setU8(view, 0x0064, preset.outputs.sub.micDirect);
  setU8(view, 0x0066, preset.outputs.sub.musicLevel);
  setU8(view, 0x0068, preset.outputs.sub.reverbLevel);
  setU8(view, 0x006a, preset.outputs.sub.echoLevel);
  setU8(view, 0x006c, preset.outputs.sub.compThresholdDb + 50);
  setU8(view, 0x006d, preset.outputs.sub.compRatio);
  setU8(view, 0x006e, preset.outputs.sub.attackMs);
  setU8(view, 0x006f, Math.round(preset.outputs.sub.releaseSec * 10));
  setU16(view, 0x00b8, clampFilterHz("sub", "hpf", preset.outputs.sub.hpfHz));
  setU16(view, 0x00bc, clampFilterHz("sub", "lpf", preset.outputs.sub.lpfHz));

  setU8(view, 0x0074, preset.effects.reverb.level);
  setU16(view, 0x00c0, clampFilterHz("reverb", "hpf", preset.effects.reverb.hpfHz));
  setU16(view, 0x00c2, clampFilterHz("reverb", "lpf", preset.effects.reverb.lpfHz));
  setU16(view, 0x00c8, preset.effects.reverb.decayMs);
  setU16(view, 0x00ca, preset.effects.reverb.predelayMs);

  setU8(view, 0x007b, preset.effects.echo.level);
  setU8(view, 0x007c, preset.effects.echo.repeat);
  setU16(view, 0x00c4, clampFilterHz("echo", "hpf", preset.effects.echo.hpfHz));
  setU16(view, 0x00c6, clampFilterHz("echo", "lpf", preset.effects.echo.lpfHz));
  setU16(view, 0x00cc, preset.effects.echo.leftDelayMs);

  Object.values(preset.eq).forEach((section) => writeEqSection(view, section));

  // Known duplicated UI/global crossover copies from delta test.
  view.setUint16(0x0144, clampFilterHz("micA", "lpf", preset.mic.lpfHz), true);
  view.setUint16(0x01a4, clampFilterHz("micB", "lpf", preset.mic.lpfHz), true);
  view.setUint16(0x014c, clampFilterHz("micA", "hpf", preset.mic.hpfHz), true);
  view.setUint16(0x01ac, clampFilterHz("micB", "hpf", preset.mic.hpfHz), true);

  view.setUint16(0x0394, clampFilterHz("sub", "lpf", preset.outputs.sub.lpfHz), true);
  view.setUint16(0x039c, clampFilterHz("sub", "hpf", preset.outputs.sub.hpfHz), true);
  view.setUint16(0x0404, clampFilterHz("reverb", "lpf", preset.effects.reverb.lpfHz), true);
  view.setUint16(0x040c, clampFilterHz("reverb", "hpf", preset.effects.reverb.hpfHz), true);
  view.setUint16(0x043c, clampFilterHz("echo", "lpf", preset.effects.echo.lpfHz), true);
  view.setUint16(0x0444, clampFilterHz("echo", "hpf", preset.effects.echo.hpfHz), true);

  updateChecksum(bytes);
  return bytes;
}

export {
  CHECKSUM_OFFSET,
  EQ_SECTIONS,
  SECTIONS_BY_PAGE,
  parseK500Preset,
  serializeK500Preset,
  updateChecksum,
  validateChecksum,
};
