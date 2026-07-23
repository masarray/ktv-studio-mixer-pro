import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

const main = read("electron/main.mjs");
const master = read("src/components/studio/MasterSection.tsx");
const eq = read("src/components/studio/EqGraph.tsx");
const primitives = read("src/components/studio/primitives.tsx");
const shell = read("src/components/studio/StudioShell.tsx");
const rootRoute = read("src/routes/__root.tsx");
const builder = read("electron-builder.yml");
const vite = read("vite.config.ts");
const localServer = read("electron/local-server.mjs");
const installerLauncher = read("build-installer.cmd");

assert.doesNotMatch(main, /^import .*startBridge/m, "native bridge must not be statically imported on the cold-start path");
assert.match(main, /setImmediate\(\(\) =>[\s\S]*startNativeBridge/, "native bridge should start after the first renderer load");
assert.ok(main.indexOf("await createMainWindow()") < main.indexOf("startNativeBridge().catch"), "window must load before bridge startup");
assert.match(main, /const serverPromise = appServer[\s\S]*new BrowserWindow/, "server initialization and BrowserWindow creation should overlap");
assert.match(vite, /prerender:\s*\{[\s\S]*enabled:\s*true/, "desktop shell must be prerendered at build time");
assert.match(vite, /pages:\s*\[\{\s*path:\s*"\/"\s*\}\]/, "root desktop page must be included in prerender output");
assert.match(localServer, /pathname === "\/"[\s\S]*index\.html/, "desktop server must serve prerendered index.html directly");
assert.match(localServer, /const getFetchHandler = async \(\) =>/, "SSR must remain a lazy fallback rather than a cold-start dependency");

assert.match(master, /function DeferredByteDiff\(\)/, "preset byte diff must be isolated from master controls");
assert.match(master, /setTimeout\(\(\) =>[\s\S]*changedByteCount/, "binary diff must be deferred until input settles");
assert.match(master, /function MasterVolumeFader/, "master faders must use narrow primitive selectors");
assert.doesNotMatch(master, /export function MasterSection\(\)[\s\S]{0,220}const preset = useStudio/, "master rail must not subscribe to the complete preset");

assert.match(eq, /requestAnimationFrame\(flushPendingMove\)/, "PEQ pointer changes must be coalesced to animation frames");
assert.match(eq, /sectionRef\.current = section/, "PEQ listeners must read the current section through a stable ref");
assert.match(eq, /\}, \[\]\);/, "PEQ global pointer listeners must be attached once");
assert.match(eq, /i < 280/, "PEQ response curve should use the optimized sample count");
assert.doesNotMatch(eq, /filter:\s*[`"]drop-shadow/, "dynamic PEQ SVG filters should use lightweight glow layers");
assert.doesNotMatch(primitives, /filter:\s*[`"]drop-shadow/, "dynamic knob SVG filters should use lightweight glow layers");
assert.match(primitives, /export const VerticalFader = memo/, "unchanged faders should skip React renders");
assert.match(primitives, /export const Knob = memo/, "unchanged knobs should skip React renders");

assert.match(shell, /const sonkupikLogo = "\/sonkupik-icon-128\.png"/, "toolbar should load the compact logo asset");
assert.match(rootRoute, /const faviconUrl = "\/sonkupik-icon-128\.png"/, "favicon should load the compact logo asset");
assert.ok(statSync(path.join(root, "public/sonkupik-logo.png")).size < 100_000, "copied public logo should remain compact");

assert.match(builder, /target:\s*portable/, "portable target must remain available");
assert.match(builder, /target:\s*nsis/, "fast-start installed target must remain available");
assert.match(installerLauncher, /-Target Installer/, "one-click installer launcher must request installer-only packaging");

console.log("[v0.8.43] cold-start, render isolation, frame coalescing, asset, and installer checks passed");
