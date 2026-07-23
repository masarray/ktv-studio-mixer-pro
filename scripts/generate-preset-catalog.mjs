import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const presetRoot = path.join(projectRoot, "resources", "presets");
const outputRoot = path.join(projectRoot, "preset-catalog");
const outputFile = path.join(outputRoot, "presets-manifest.json");
const downloadBaseUrl =
  process.env.SONKUPIK_PRESET_DOWNLOAD_BASE_URL ||
  "https://raw.githubusercontent.com/masarray/ktv-studio-mixer-pro/main/resources/presets/";

const checksum = (bytes) => bytes.reduce((sum, value) => (sum + value) & 0xff, 0);
const internalName = (bytes, fallback) =>
  bytes.subarray(0x0454, 0x0475).toString("ascii").split("\0")[0].trim() || fallback;

const presets = readdirSync(presetRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".k500"))
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }))
  .map((entry) => {
    const bytes = readFileSync(path.join(presetRoot, entry.name));
    if (bytes.length !== 1144 || checksum(bytes) !== 0) {
      throw new Error(`${entry.name}: preset harus 1144 byte dengan checksum K500 yang valid.`);
    }
    return {
      id: path.basename(entry.name, path.extname(entry.name)).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      file: entry.name,
      name: internalName(bytes, path.basename(entry.name, path.extname(entry.name))),
      version: packageJson.version,
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  });

if (!presets.length) throw new Error("Tidak ada factory preset .k500 untuk catalog.");

const output = `${JSON.stringify({ schemaVersion: 1, catalogVersion: packageJson.version, downloadBaseUrl, presets }, null, 2)}\n`;
if (process.argv.includes("--check")) {
  let committed = "";
  try { committed = readFileSync(outputFile, "utf8").replace(/\r\n/g, "\n"); } catch {}
  if (committed !== output) {
    throw new Error("Preset catalog belum sinkron. Jalankan npm run presets:catalog lalu commit hasilnya.");
  }
  console.log(`[preset-catalog] committed manifest is current (${presets.length} preset)`);
} else {
  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(outputFile, output);
  console.log(`[preset-catalog] generated ${path.relative(projectRoot, outputFile)} (${presets.length} preset)`);
}
