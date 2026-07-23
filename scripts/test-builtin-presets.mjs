import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { provisionBuiltInPresets } from "../electron/preset-library.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(projectRoot, "resources", "presets");
const factoryName = "KARAOKE_ARTIST_LUXURY.k500";
const factoryPath = path.join(sourceRoot, factoryName);
const originalPath = path.join(projectRoot, "src", "assets", "sample.k500");
const expectedOriginalSha = "4313fc8b642f6e541e6728229528a32eaabf647f828b577ed91e2efbeee64c5e";

const checksum = (bytes) => bytes.reduce((sum, value) => (sum + value) & 0xff, 0);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const presetName = (bytes) => bytes.subarray(0x0454, 0x0475).toString("ascii").split("\0")[0].trimEnd();

const original = readFileSync(originalPath);
const factory = readFileSync(factoryPath);
assert.equal(sha256(original), expectedOriginalSha, "sample.k500 original berubah");
assert.equal(factory.length, 1144, "ukuran preset factory salah");
assert.equal(checksum(factory), 0, "checksum preset factory tidak valid");
assert.equal(presetName(factory), "KARAOKE ARTIST LUXURY", "nama internal preset salah");
assert.notEqual(sha256(factory), sha256(original), "Luxury preset masih identik dengan original");

const sandbox = mkdtempSync(path.join(tmpdir(), "sonkupik-presets-"));
try {
  const silentLogger = { log() {}, warn() {} };
  const first = provisionBuiltInPresets({ sourceRoot, presetRoot: sandbox, logger: silentLogger });
  assert.deepEqual(first.installed, [factoryName], "factory preset tidak terpasang pada first run");
  assert.deepEqual(readFileSync(path.join(sandbox, factoryName)), factory, "hasil copy berbeda dari factory preset");

  const locallyEdited = Buffer.from(factory);
  locallyEdited[0] ^= 0xff;
  writeFileSync(path.join(sandbox, factoryName), locallyEdited);
  const second = provisionBuiltInPresets({ sourceRoot, presetRoot: sandbox, logger: silentLogger });
  assert.deepEqual(second.preserved, [factoryName], "preset lokal tidak ditandai untuk dipertahankan");
  assert.deepEqual(readFileSync(path.join(sandbox, factoryName)), locallyEdited, "preset lokal ditimpa saat provisioning ulang");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

console.log("[preset] built-in generation, checksum, first-run copy, and no-overwrite checks passed");
