import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncFactoryPresetCatalog } from "../electron/preset-catalog.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mainSource = readFileSync(path.join(projectRoot, "electron", "main.mjs"), "utf8");
const bridgeSource = readFileSync(path.join(projectRoot, "tools", "k500-bridge.mjs"), "utf8");
const uiSource = readFileSync(path.join(projectRoot, "src", "components", "studio", "pages.tsx"), "utf8");
const factoryName = "KARAOKE_ARTIST_LUXURY.k500";
const factoryBytes = readFileSync(path.join(projectRoot, "resources", "presets", factoryName));
const digest = createHash("sha256").update(factoryBytes).digest("hex");
const sandbox = mkdtempSync(path.join(tmpdir(), "sonkupik-catalog-"));
const factoryRoot = path.join(sandbox, "factory");
const userRoot = path.join(sandbox, "user");
const logger = { log() {}, warn() {} };
let corruptManifest = false;

assert.ok(
  mainSource.indexOf("bridgeServer = await startBridge") < mainSource.lastIndexOf("syncFactoryPresetCatalog"),
  "online sync harus dimulai setelah native bridge siap",
);
assert.match(mainSource, /setImmediate\(\(\) => \{\s*void syncFactoryPresetCatalog/, "online sync tidak boleh memblokir startup");
assert.match(mainSource, /app\.getPath\("userData"\), "Factory Presets"/, "factory dan user preset harus dipisahkan");
assert.match(bridgeSource, /presetPath\(msg\.file, "user"\)/, "Save to PC hanya boleh menulis user library");
assert.match(bridgeSource, /msg\.source === "factory"/, "bridge harus membaca sumber factory secara eksplisit");
assert.match(uiSource, /source: item\.source/, "UI harus mengirim identitas factory atau user ketika membaca preset");
assert.match(uiSource, /item\.source === "factory" \? "FACTORY" : "USER"/, "PC Mode harus membedakan preset factory dan user");

const server = createServer((request, response) => {
  if (request.url === `/files/${factoryName}`) {
    response.writeHead(200, { "content-type": "application/octet-stream", "content-length": factoryBytes.length });
    response.end(factoryBytes);
    return;
  }
  if (request.url === "/manifest.json") {
    const address = server.address();
    const manifest = {
      schemaVersion: 1,
      catalogVersion: "test-2",
      downloadBaseUrl: `http://127.0.0.1:${address.port}/files/`,
      presets: [{
        id: "karaoke-artist-luxury",
        file: factoryName,
        name: "KARAOKE ARTIST LUXURY",
        version: "test-2",
        size: factoryBytes.length,
        sha256: corruptManifest ? "0".repeat(64) : digest,
      }],
    };
    const body = Buffer.from(JSON.stringify(manifest));
    response.writeHead(200, { "content-type": "application/json", "content-length": body.length, etag: '"test-2"' });
    response.end(body);
    return;
  }
  response.writeHead(404).end();
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const manifestUrl = `http://127.0.0.1:${server.address().port}/manifest.json`;

try {
  const first = await syncFactoryPresetCatalog({
    factoryRoot,
    userPresetRoot: userRoot,
    manifestUrl,
    force: true,
    now: Date.UTC(2026, 6, 22, 8),
    logger,
  });
  assert.deepEqual(first.installed, [factoryName], "factory preset tidak diunduh pada sync pertama");
  assert.deepEqual(readFileSync(path.join(factoryRoot, factoryName)), factoryBytes, "factory download berubah");

  const cached = await syncFactoryPresetCatalog({
    factoryRoot,
    userPresetRoot: userRoot,
    manifestUrl,
    now: Date.UTC(2026, 6, 22, 8, 1),
    logger,
  });
  assert.equal(cached.skipped, true, "catalog harus memakai cache agar startup tidak polling terus");

  const localEdit = Buffer.from(factoryBytes);
  localEdit[10] = (localEdit[10] + 1) & 0xff;
  localEdit[11] = (localEdit[11] + 255) & 0xff;
  writeFileSync(path.join(factoryRoot, factoryName), localEdit);
  const repaired = await syncFactoryPresetCatalog({
    factoryRoot,
    userPresetRoot: userRoot,
    manifestUrl,
    force: true,
    now: Date.UTC(2026, 6, 22, 9),
    logger,
  });
  assert.deepEqual(repaired.updated, [factoryName], "factory preset edit tidak dipulihkan");
  assert.equal(repaired.preserved.length, 1, "edit lokal harus dibackup ke user library");
  assert.deepEqual(readFileSync(path.join(userRoot, repaired.preserved[0])), localEdit, "backup edit lokal berbeda");
  assert.deepEqual(readFileSync(path.join(factoryRoot, factoryName)), factoryBytes, "factory preset tidak kembali ke catalog");

  corruptManifest = true;
  const rejected = await syncFactoryPresetCatalog({
    factoryRoot,
    userPresetRoot: userRoot,
    manifestUrl,
    force: true,
    now: Date.UTC(2026, 6, 22, 10),
    logger,
  });
  assert.equal(rejected.status, "error", "manifest SHA-256 rusak harus ditolak");
  assert.deepEqual(readFileSync(path.join(factoryRoot, factoryName)), factoryBytes, "catalog rusak menimpa preset valid");
  assert.ok(readdirSync(factoryRoot).includes(".catalog-state.json"), "catalog state tidak tersimpan");
} finally {
  await new Promise((resolve) => server.close(resolve));
  rmSync(sandbox, { recursive: true, force: true });
}

console.log("[preset-sync] background catalog, cache, checksum, backup, and corruption checks passed");
