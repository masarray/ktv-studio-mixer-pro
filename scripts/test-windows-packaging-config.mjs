import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builderConfig = readFileSync(path.join(projectRoot, "electron-builder.yml"), "utf8");
const portableScript = readFileSync(
  path.join(projectRoot, "scripts", "build-portable-single-exe.ps1"),
  "utf8",
);
const releaseScript = readFileSync(
  path.join(projectRoot, "scripts", "build-windows-release.ps1"),
  "utf8",
);

assert.match(
  builderConfig,
  /^  signExecutable:\s*false\s*$/m,
  "win.signExecutable harus false agar public build tidak mencoba code signing",
);
assert.doesNotMatch(
  builderConfig,
  /^  signAndEditExecutable:\s*false\s*$/m,
  "signAndEditExecutable jangan dimatikan karena icon dan metadata EXE harus tetap ditulis",
);
for (const [name, script] of [
  ["portable", portableScript],
  ["release", releaseScript],
]) {
  assert.match(
    script,
    /\$env:CSC_IDENTITY_AUTO_DISCOVERY\s*=\s*'false'/,
    `${name} script harus menonaktifkan certificate autodiscovery`,
  );
}

assert.match(
  portableScript,
  /System\.Diagnostics\.ProcessStartInfo/,
  "portable wrapper harus memakai native ProcessStartInfo agar exit code Windows PowerShell stabil",
);
assert.match(
  portableScript,
  /return \[int\]\$Process\.ExitCode/,
  "portable wrapper harus mengembalikan exit code bertipe integer",
);
assert.match(
  portableScript,
  /if \(\$null -eq \$PackageExit\)/,
  "portable wrapper harus menangani exit code kosong tanpa false BUILD FAILED",
);

assert.doesNotMatch(
  releaseScript,
  /@BuilderTargets/,
  "release wrapper tidak boleh splat target scalar pada Windows PowerShell 5.1",
);
assert.match(
  releaseScript,
  /'Installer'\s*\{\s*& \$ElectronBuilder '--win' 'nsis' '--x64' '--publish' 'never'/,
  "installer target harus diteruskan sebagai argumen native eksplisit",
);
assert.match(
  releaseScript,
  /'Portable'\s*\{\s*& \$ElectronBuilder '--win' 'portable' '--x64' '--publish' 'never'/,
  "portable target harus diteruskan sebagai argumen native eksplisit",
);
assert.match(
  releaseScript,
  /& \$ElectronBuilder '--win' 'portable' 'nsis' '--x64' '--publish' 'never'/,
  "combined release harus tetap menghasilkan portable dan installer terpisah",
);
assert.match(
  releaseScript,
  /\$PackagingExitCode = \$LASTEXITCODE/,
  "exit code packaging harus disimpan sebelum diperiksa",
);
assert.match(
  releaseScript,
  /SONKUPIK-STUDIO-\$PackageVersion-Setup\.exe/,
  "installer validation harus memeriksa artifact versi aktif, bukan file release lama",
);

console.log("[windows] unsigned packaging, PowerShell 5.1 target arguments, and native exit-code checks passed");
