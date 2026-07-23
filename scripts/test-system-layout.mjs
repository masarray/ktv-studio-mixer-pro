import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = readFileSync(path.join(projectRoot, "src", "components", "studio", "pages.tsx"), "utf8");
const shell = readFileSync(path.join(projectRoot, "src", "components", "studio", "StudioShell.tsx"), "utf8");
const css = readFileSync(path.join(projectRoot, "src", "styles.css"), "utf8");

assert.match(
  css,
  /grid-template-areas:\s*\n\s*"pc device side"\s*\n\s*"startup record master"/,
  "System desktop harus memakai grid 3 kolom x 2 baris tanpa cell kosong",
);
assert.match(css, /\.system-master-slot\s*\{\s*grid-area:\s*master;/, "Master Strip harus menjadi cell System");
assert.match(css, /\.system-master-slot \.master-context-rail\s*\{\s*display:\s*none !important;/, "Rail konteks kosong harus dihapus pada System");
assert.doesNotMatch(css, /\.studio-workspace-system \.master-rail/, "System tidak boleh memakai master rail eksternal lama");

assert.match(pages, /SystemPage\(\{ masterSlot \}/, "SystemPage harus menerima Master Strip sebagai slot");
assert.match(pages, /className="system-master-slot/, "SystemPage harus merender master grid slot");
assert.match(pages, /system-record-trigger-grid/, "Recording dan Mic Trigger harus tetap tersedia dalam satu cell");
assert.doesNotMatch(pages, /system-dance-panel/, "Mic Trigger tidak boleh kembali menjadi panel ketujuh yang merusak grid");

assert.match(shell, /page === "system" \? <MasterSection \/> : undefined/, "Master Strip harus dimasukkan ke SystemPage");
assert.match(shell, /page !== "system" && <MasterSection \/>/, "Section PEQ harus tetap memakai master rail normal");

console.log("[system-layout] adaptive 3x2 grid, embedded Master Strip, and preserved Mic Trigger checks passed");
