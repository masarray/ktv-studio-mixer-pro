import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const [gitignore, types, parser, commands, live, pages, primitives, store, graph, shell, root, css] = await Promise.all([
  read(".gitignore"),
  read("src/features/k500/types.ts"),
  read("src/features/k500/parser.ts"),
  read("src/features/k500/protocol/commands.ts"),
  read("src/features/k500/live/liveStore.ts"),
  read("src/components/studio/pages.tsx"),
  read("src/components/studio/primitives.tsx"),
  read("src/features/k500/store.ts"),
  read("src/components/studio/EqGraph.tsx"),
  read("src/components/studio/StudioShell.tsx"),
  read("src/routes/__root.tsx"),
  read("src/styles.css"),
]);

for (const expected of ["release/", "out/", "win-unpacked/", "*.exe", "*.msi", "*.blockmap", "latest*.yml", "*.zip"]) {
  assert.ok(gitignore.includes(expected), `.gitignore harus memblokir artefak build ${expected}`);
}

assert.match(types, /fbxLevel:\s*number/, "Model preset harus memiliki nilai FBX");
assert.match(parser, /fbxLevel:[\s\S]*0x001b[\s\S]*0x001c/, "Parser harus membaca dua byte FBX native");
assert.match(parser, /setU8\(view, 0x001b,[\s\S]*setU8\(view, 0x001c/, "Serializer harus menulis FBX A+B");
assert.match(commands, /m\.fbxLevel[\s\S]*m\.fbxLevel/, "Mic live block harus mengirim FBX ke dua channel");
assert.match(live, /"mic\.fbxLevel"/, "FBX harus masuk daftar path live Mic");
assert.match(pages, /label="FBX" value=\{p\.fbxLevel\}[\s\S]*setPath\("mic\.fbxLevel"/, "Fader FBX harus aktif dan terikat ke store");
assert.doesNotMatch(pages, /label="FBX"[^\n]*disabled/, "Fader FBX tidak boleh disabled");

assert.match(primitives, /cy="64" r="24\.5"/, "Wajah knob harus diturunkan ke geometri v0.8.42");
assert.match(primitives, /requestAnimationFrame/, "Pointer knob harus dikoaleskan ke frame layar");
assert.match(pages, /filter-frequency-field/, "HPF\/LPF harus memakai field kompak");
assert.match(css, /final cascade: compact HPF\/LPF rails/, "Override layout kompak harus menjadi blok cascade final");
assert.match(css, /filter-frequency-readout[\s\S]*39px/, "Readout frekuensi Music harus diperkecil sekitar separuh");

assert.match(store, /refreshEqSectionIdentity/, "Store harus mengisolasi identitas section EQ yang berubah");
assert.match(graph, /s\.preset\?\.eq\?\.\[s\.eqKey\]/, "EqGraph harus berlangganan section aktif, bukan seluruh preset");
assert.doesNotMatch(graph, /const preset = useStudio\(\(s\) => s\.preset\)/, "EqGraph tidak boleh repaint untuk semua perubahan preset");
assert.match(shell, /Boolean\(s\.preset\)/, "Shell harus berlangganan status preset yang stabil");
assert.doesNotMatch(root, /fonts\.googleapis\.com|fonts\.gstatic\.com/, "Cold start desktop tidak boleh bergantung pada font eksternal");
assert.doesNotMatch(css, /feTurbulence/, "Background tidak boleh memakai filter noise SVG full-screen");
assert.doesNotMatch(css, /background-attachment:\s*fixed/, "Background desktop tidak boleh memaksa full repaint fixed layer");

console.log("v0.8.42 hardening regression checks passed");
