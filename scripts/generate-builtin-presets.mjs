import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFile = path.join(projectRoot, "src", "assets", "sample.k500");
const outputDir = path.join(projectRoot, "resources", "presets");
const outputFile = path.join(outputDir, "KARAOKE_ARTIST_LUXURY.k500");

const PRESET_LENGTH = 1144;
const NAME_OFFSET = 0x0454;
const NAME_LENGTH = 0x21;
const CHECKSUM_OFFSET = 0x0475;

const TYPE = Object.freeze({
  P: 0x0000,
  LS: 0x0100,
  HS: 0x0200,
});

const FILTER = Object.freeze({
  LP_BUTTER_12: 0x0302,
  LP_BUTTER_24: 0x0306,
  HP_BUTTER_12: 0x0402,
  HP_BUTTER_24: 0x0406,
});

const SECTIONS = Object.freeze({
  micA: { offset: 0x00f0, bands: 10, hpfScalar: 0x0098, lpfScalar: 0x009a },
  micB: { offset: 0x0150, bands: 10, hpfScalar: 0x0098, lpfScalar: 0x009a },
  music: { offset: 0x01b0, bands: 7, hpfScalar: 0x009c, lpfScalar: 0x009e },
  main: { offset: 0x01f8, bands: 7, hpfScalar: 0x00a0, lpfScalar: 0x00a4 },
  surround: { offset: 0x0288, bands: 5, hpfScalar: 0x00a8, lpfScalar: 0x00ac },
  center: { offset: 0x02f8, bands: 5, hpfScalar: 0x00b0, lpfScalar: 0x00b4 },
  sub: { offset: 0x0368, bands: 5, hpfScalar: 0x00b8, lpfScalar: 0x00bc },
  reverb: { offset: 0x03d8, bands: 5, hpfScalar: 0x00c0, lpfScalar: 0x00c2 },
  echo: { offset: 0x0410, bands: 5, hpfScalar: 0x00c4, lpfScalar: 0x00c6 },
});

const band = (type, frequencyHz, gainDb, q) => ({ type, frequencyHz, gainDb, q });

// The Luxury preset deliberately uses broad, moderate moves. Character is
// built across Mic -> Music -> Main instead of stacking the original +/-20 dB
// filters in a single section. The original sample.k500 remains untouched.
const LUXURY_EQ = Object.freeze({
  micA: [
    band("P", 170, +1.0, 0.8),
    band("P", 315, -2.0, 1.0),
    band("P", 520, +0.8, 0.9),
    band("P", 850, -0.5, 1.1),
    band("P", 1900, +1.5, 0.8),
    band("P", 3400, +0.9, 1.0),
    band("P", 4800, -1.0, 1.3),
    band("P", 6800, -1.4, 1.6),
    band("P", 9500, +0.6, 0.9),
    band("HS", 12500, +2.8, 0.6),
  ],
  music: [
    band("LS", 72, +2.6, 0.7),
    band("P", 125, +1.1, 0.8),
    band("P", 310, -1.3, 1.0),
    band("P", 720, -0.4, 0.9),
    band("P", 2200, -1.1, 0.9),
    band("P", 6200, +0.7, 0.8),
    band("HS", 12500, +1.8, 0.6),
  ],
  main: [
    band("LS", 78, +1.4, 0.7),
    band("P", 280, -0.7, 0.9),
    band("P", 520, +0.3, 0.9),
    band("P", 2100, +0.4, 0.8),
    band("P", 4200, -0.5, 1.0),
    band("P", 7600, +0.4, 0.8),
    band("HS", 13000, +1.2, 0.6),
  ],
  surround: [
    band("LS", 120, +0.8, 0.7),
    band("P", 400, -0.8, 0.9),
    band("P", 1800, -0.6, 0.9),
    band("P", 4500, -0.8, 1.0),
    band("HS", 11000, +0.5, 0.6),
  ],
  center: [
    band("P", 170, +0.7, 0.8),
    band("P", 330, -1.2, 1.0),
    band("P", 1900, +0.8, 0.8),
    band("P", 4300, -0.7, 1.1),
    band("HS", 12000, +0.8, 0.6),
  ],
  sub: [
    band("P", 45, 0.0, 1.0),
    band("P", 60, +1.2, 0.9),
    band("P", 75, +0.7, 0.9),
    band("P", 90, -0.4, 1.0),
    band("P", 110, -1.0, 1.0),
  ],
  reverb: [
    band("P", 350, -1.0, 0.8),
    band("P", 1200, -1.2, 0.9),
    band("P", 2800, -1.8, 1.0),
    band("P", 5200, -1.2, 1.1),
    band("HS", 9000, -1.5, 0.7),
  ],
  echo: [
    band("P", 900, -0.8, 0.8),
    band("P", 1800, -1.3, 0.9),
    band("P", 3000, -1.2, 1.0),
    band("P", 4800, -1.8, 1.1),
    band("HS", 7000, -2.0, 0.7),
  ],
});

const XOVERS = Object.freeze({
  micA: { hpfHz: 90, lpfHz: 16000, hpType: FILTER.HP_BUTTER_24, lpType: FILTER.LP_BUTTER_12 },
  micB: { hpfHz: 90, lpfHz: 16000, hpType: FILTER.HP_BUTTER_24, lpType: FILTER.LP_BUTTER_12 },
  music: { hpfHz: 20, lpfHz: 20000, hpType: FILTER.HP_BUTTER_12, lpType: FILTER.LP_BUTTER_12 },
  main: { hpfHz: 35, lpfHz: 20000, hpType: FILTER.HP_BUTTER_12, lpType: FILTER.LP_BUTTER_12 },
  surround: { hpfHz: 100, lpfHz: 16000, hpType: FILTER.HP_BUTTER_12, lpType: FILTER.LP_BUTTER_12 },
  center: { hpfHz: 90, lpfHz: 16000, hpType: FILTER.HP_BUTTER_12, lpType: FILTER.LP_BUTTER_12 },
  sub: { hpfHz: 38, lpfHz: 98, hpType: FILTER.HP_BUTTER_24, lpType: FILTER.LP_BUTTER_24 },
  reverb: { hpfHz: 220, lpfHz: 10500, hpType: FILTER.HP_BUTTER_12, lpType: FILTER.LP_BUTTER_12 },
  echo: { hpfHz: 650, lpfHz: 5000, hpType: FILTER.HP_BUTTER_12, lpType: FILTER.LP_BUTTER_12 },
});

function checksum(bytes) {
  return bytes.reduce((sum, value) => (sum + value) & 0xff, 0);
}

function setU8(view, offset, value) {
  view.setUint8(offset, Math.max(0, Math.min(255, Math.round(value))));
}

function setU16(view, offset, value) {
  view.setUint16(offset, Math.max(0, Math.min(65535, Math.round(value))), true);
}

function setI16(view, offset, value) {
  view.setInt16(offset, Math.max(-32768, Math.min(32767, Math.round(value))), true);
}

function setOutputDb(view, offset, db) {
  setU8(view, offset, Math.round(db * 2 + 75));
}

function writeName(bytes, name) {
  bytes.fill(0, NAME_OFFSET, NAME_OFFSET + NAME_LENGTH);
  const encoded = Buffer.from(name.replace(/[^\x20-\x7e]/g, ""), "ascii");
  bytes.set(encoded.subarray(0, NAME_LENGTH), NAME_OFFSET);
}

function writeEqSection(view, key, bands, crossover) {
  const section = SECTIONS[key];
  if (!section || bands.length !== section.bands) {
    throw new Error(`Definisi EQ ${key} tidak lengkap.`);
  }

  view.setUint16(section.offset, 0, true);
  bands.forEach((item, index) => {
    const offset = section.offset + 2 + index * 8;
    view.setUint16(offset, TYPE[item.type] ?? TYPE.P, true);
    setU16(view, offset + 2, item.frequencyHz);
    setU16(view, offset + 4, item.q * 10);
    setI16(view, offset + 6, item.gainDb * 10);
  });

  const footer = section.offset + 2 + section.bands * 8;
  view.setUint16(footer, crossover.lpType, true);
  setU16(view, footer + 2, crossover.lpfHz);
  view.setUint16(footer + 8, crossover.hpType, true);
  setU16(view, footer + 10, crossover.hpfHz);
  setU16(view, section.hpfScalar, crossover.hpfHz);
  setU16(view, section.lpfScalar, crossover.lpfHz);
}

function generateLuxuryPreset() {
  const bytes = new Uint8Array(readFileSync(sourceFile));
  if (bytes.length !== PRESET_LENGTH) {
    throw new Error(`sample.k500 harus ${PRESET_LENGTH} byte, ditemukan ${bytes.length}.`);
  }
  if (checksum(bytes) !== 0) {
    throw new Error("Checksum sample.k500 tidak valid; generator dihentikan.");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  writeName(bytes, "KARAOKE ARTIST LUXURY");

  // Vocal dynamics: less limiting, slower attack and stable linked channels.
  setU8(view, 0x0014, 94);
  setU8(view, 0x0015, 94);
  setU8(view, 0x0016, -70 + 81);
  setU8(view, 0x0017, -18 + 50);
  setU8(view, 0x0018, 2);
  setU8(view, 0x0019, 20);
  setU8(view, 0x001a, 2);
  setU8(view, 0x0092, 1);

  // Main routing and bus compression retain the familiar K500 loudness while
  // reserving more transient headroom than the original 18:1 limiter-like map.
  setOutputDb(view, 0x0024, 12);
  setOutputDb(view, 0x0026, 12);
  setU8(view, 0x0028, 100);
  setU8(view, 0x002a, 100);
  setU8(view, 0x002c, 82);
  setU8(view, 0x002e, 80);
  setU8(view, 0x0030, -10 + 50);
  setU8(view, 0x0031, 3);
  setU8(view, 0x0032, 15);
  setU8(view, 0x0033, 2);

  setU8(view, 0x003c, 80);
  setU8(view, 0x003e, 82);
  setU8(view, 0x0040, 70);
  setU8(view, 0x0042, 65);
  setU8(view, 0x0044, -10 + 50);
  setU8(view, 0x0045, 2);
  setU8(view, 0x0046, 20);
  setU8(view, 0x0047, 2);

  setU8(view, 0x0050, 92);
  setU8(view, 0x0052, 78);
  setU8(view, 0x0054, 75);
  setU8(view, 0x0056, 72);
  setU8(view, 0x0058, -10 + 50);
  setU8(view, 0x0059, 2);
  setU8(view, 0x005a, 18);
  setU8(view, 0x005b, 2);

  setU8(view, 0x0064, 0);
  setU8(view, 0x0066, 88);
  setU8(view, 0x0068, 0);
  setU8(view, 0x006a, 0);

  // Dark, short universal ambience: present behind the dry vocal instead of
  // becoming a second lead signal. Echo remains filtered and tempo-neutral.
  setU8(view, 0x0074, 88);
  setU16(view, 0x00c8, 1650);
  setU16(view, 0x00ca, 32);
  setU8(view, 0x007b, 82);
  setU8(view, 0x007c, 10);
  setU16(view, 0x00cc, 400);

  for (const [key, bands] of Object.entries(LUXURY_EQ)) {
    writeEqSection(view, key, bands, XOVERS[key]);
  }
  // Mic B intentionally mirrors Mic A for the factory universal reference.
  writeEqSection(view, "micB", LUXURY_EQ.micA, XOVERS.micB);

  bytes[CHECKSUM_OFFSET] = 0;
  bytes[CHECKSUM_OFFSET] = (256 - checksum(bytes)) & 0xff;
  if (checksum(bytes) !== 0) throw new Error("Checksum Luxury preset gagal dinormalisasi.");

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputFile, bytes);
  return bytes;
}

const generated = generateLuxuryPreset();
console.log(`[preset] generated ${path.relative(projectRoot, outputFile)} (${generated.length} bytes, checksum OK)`);
