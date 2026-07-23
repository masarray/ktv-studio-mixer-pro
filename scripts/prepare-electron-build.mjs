import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageFile = path.resolve(process.env.SONKUPIK_PACKAGE_FILE || path.join(projectRoot, "package.json"));
const builderFile = path.resolve(process.env.SONKUPIK_BUILDER_FILE || path.join(projectRoot, "electron-builder.yml"));

if (!existsSync(builderFile)) {
  throw new Error(`electron-builder.yml tidak ditemukan: ${builderFile}`);
}

const metadata = JSON.parse(readFileSync(packageFile, "utf8"));
if (Object.prototype.hasOwnProperty.call(metadata, "directories")) {
  // `directories` is valid inside electron-builder configuration, but current
  // electron-builder rejects the same key as top-level npm package metadata.
  // npm init and some package tools can add it back, so every desktop package
  // run removes only this deprecated root property before invoking builder.
  delete metadata.directories;
  writeFileSync(packageFile, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log("[desktop] removed deprecated package.json root property: directories");
} else {
  console.log("[desktop] package metadata clean (no root directories property)");
}
