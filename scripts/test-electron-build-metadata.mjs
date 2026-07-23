import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prepareScript = path.join(projectRoot, "scripts", "prepare-electron-build.mjs");
const sandbox = mkdtempSync(path.join(tmpdir(), "sonkupik-electron-metadata-"));

try {
  const packageFile = path.join(sandbox, "package.json");
  const builderFile = path.join(sandbox, "electron-builder.yml");
  writeFileSync(packageFile, `${JSON.stringify({
    name: "metadata-test",
    version: "1.0.0",
    directories: { output: "release", buildResources: "build" },
    build: { appId: "com.example.test" },
  }, null, 2)}\n`);
  writeFileSync(builderFile, "appId: com.example.test\n");

  const env = {
    ...process.env,
    SONKUPIK_PACKAGE_FILE: packageFile,
    SONKUPIK_BUILDER_FILE: builderFile,
  };
  const first = spawnSync(process.execPath, [prepareScript], { env, encoding: "utf8" });
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const cleaned = JSON.parse(readFileSync(packageFile, "utf8"));
  assert.equal(Object.hasOwn(cleaned, "directories"), false, "deprecated root directories masih ada");
  assert.deepEqual(cleaned.build, { appId: "com.example.test" }, "supported build configuration ikut terhapus");

  const beforeSecondRun = readFileSync(packageFile, "utf8");
  const second = spawnSync(process.execPath, [prepareScript], { env, encoding: "utf8" });
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.equal(readFileSync(packageFile, "utf8"), beforeSecondRun, "cleanup tidak idempotent");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

console.log("[desktop] deprecated package metadata cleanup and idempotence checks passed");
