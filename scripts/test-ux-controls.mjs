import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => readFileSync(path.join(projectRoot, ...parts), "utf8");
const primitives = read("src", "components", "studio", "primitives.tsx");
const pages = read("src", "components", "studio", "pages.tsx");
const shell = read("src", "components", "studio", "StudioShell.tsx");
const css = read("src", "styles.css");

assert.doesNotMatch(primitives, /active\?: boolean/, "VerticalFader tidak boleh memiliki highlight aktif hardcoded");
assert.match(primitives, /className="fader-label-slot/, "Fader harus memakai slot label dengan tinggi seragam");
assert.match(primitives, /aria-valuetext=\{display\}/, "Fader dan knob harus mengekspos nilai aksesibel");
assert.match(css, /\.fader-strip:focus-within/, "Highlight fader harus mengikuti control yang sedang dipilih");
assert.match(css, /\.fader-readout,[\s\S]*margin-top: auto !important;/, "Readout fader harus menempel pada datum bawah yang sama");

assert.match(primitives, /<circle cx="50" cy="64" r="24\.5"/, "Knob face harus diturunkan agar cyan arc tidak terpotong");
assert.match(primitives, /rotate\(\$\{angle\} 50 64\)/, "Pointer knob harus mengikuti pusat knob yang baru");

assert.match(shell, /className="studio-shell h-screen/, "Shell harus memiliki scope anti text-selection");
assert.match(css, /\.studio-shell,[\s\S]*user-select: none;/, "Text selection harus nonaktif pada surface aplikasi");
assert.match(css, /input:not\(\[type="range"\]\)[\s\S]*user-select: text;/, "Input teks harus tetap dapat diedit");

assert.match(css, /\.system-device-list \{[\s\S]*height: 302px !important;/, "Slot preset desktop harus memakai ruang kosong untuk row yang lebih besar");
assert.match(pages, /setQueue\(items\.slice\(0, 1\)\)/, "Mass Upload harus membuka queue selektif, bukan otomatis memasukkan semua file");
assert.match(pages, />Add All<\/SystemButton>/, "Mass Upload harus menyediakan Add All");
assert.match(pages, />Add<\/SystemButton>/, "Mass Upload harus menyediakan Add");
assert.match(pages, />Del<\/SystemButton>/, "Mass Upload harus menyediakan Delete");
assert.match(pages, /className="mass-upload-table-head"/, "Mass Upload harus memiliki header list yang jelas");
assert.match(pages, /event\.key === "Escape"/, "Mass Upload harus dapat ditutup dengan Escape");

console.log("[ux-controls] preset typography, unified faders, knob clearance, selection lock, and Mass Upload checks passed");
