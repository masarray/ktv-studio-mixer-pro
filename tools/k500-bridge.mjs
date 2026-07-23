/**
 * K500 Native Bridge — zero-popup smart connect.
 *
 * Runs inside the Vite dev server (see k500BridgePlugin in vite.config.ts) or
 * standalone via `npm run bridge`. Because this code runs in Node, it can do
 * what the browser sandbox forbids: enumerate every COM port and HID device
 * and pick the KTV PRO K500 on its own — exactly like the native app.
 *
 * Wire protocol (JSON over WebSocket, ws://127.0.0.1:8500/k500):
 *   client → bridge : {t:"connect", mode:"bt"|"usb"} | {t:"tx", hex} | {t:"disconnect"}
 *   bridge → client : {t:"hello"} | {t:"status", msg} | {t:"connected", transport, label}
 *                     {t:"rx", hex} | {t:"error", msg} | {t:"closed", msg?}
 *
 * The web app always sends BT-framed commands (AA len8 body cs). For the USB
 * HID transport this bridge converts to the sniffed USB framing
 * (AA len16LE body cs, 0x40 mode byte 0x00) and pads into 64-byte reports.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const K500_USB_VENDOR_ID = 0x10c4;
const K500_USB_PRODUCT_ID = 0x0321;
const LAST_GOOD_FILE = path.join(tmpdir(), "k500-bridge-last-port.json");
let PRESET_ROOT = path.resolve(process.env.K500_PRESET_ROOT || process.cwd());
let FACTORY_PRESET_ROOT = process.env.K500_FACTORY_PRESET_ROOT
  ? path.resolve(process.env.K500_FACTORY_PRESET_ROOT)
  : null;
const PRESET_NAME_OFFSET = 0x0454;
const PRESET_NAME_LENGTH = 0x21;

const hex = (buf) => Buffer.from(buf).toString("hex").replace(/(..)/g, "$1 ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildHeartbeatBt() { return Buffer.from([0xaa, 0x01, 0x1c, 0xe3]); }

/** BT frame (AA len8 body cs) → USB frame (AA len16LE body cs). */
function toUsbFrame(bt) {
  if (bt[0] !== 0xaa) return bt;
  const bodyLen = bt[1];
  const body = Array.from(bt.subarray(2, 2 + bodyLen));
  if (body[0] === 0x40 && body.length === 6) body[5] = 0x00; // read-block mode byte
  const out = [0xaa, bodyLen & 0xff, (bodyLen >> 8) & 0xff, ...body];
  let sum = 0;
  for (let i = 1; i < out.length; i++) sum = (sum + out[i]) & 0xff;
  out.push((0x100 - sum) & 0xff);
  return Buffer.from(out);
}

/** Scan an RX byte stream for a complete 0x55 frame with the given rsp code. */
function makeRspDetector(rsp) {
  let buf = Buffer.alloc(0);
  return (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 5) {
      const idx = buf.indexOf(0x55);
      if (idx < 0) { buf = Buffer.alloc(0); return false; }
      if (idx > 0) buf = buf.subarray(idx);
      if (buf.length < 5) return false;
      const len = buf[1] | (buf[2] << 8);
      const total = 3 + len + 1;
      if (len > 1024) { buf = buf.subarray(1); continue; }
      if (buf.length < total) return false;
      if (buf[3] === rsp) return true;
      buf = buf.subarray(total);
    }
    return false;
  };
}

function loadLastGood() {
  try { return JSON.parse(readFileSync(LAST_GOOD_FILE, "utf8")); } catch { return {}; }
}
function saveLastGood(mode, id) {
  try {
    const cur = loadLastGood();
    cur[mode] = id;
    writeFileSync(LAST_GOOD_FILE, JSON.stringify(cur));
  } catch {}
}


function decodeAscii(buf) {
  const zero = buf.indexOf(0);
  const usable = zero >= 0 ? buf.subarray(0, zero) : buf;
  return usable.toString("ascii").replace(/[^\x20-\x7e]/g, "").trim();
}

function safePresetFileName(file) {
  const base = path.basename(String(file || "")).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  if (!base) return null;
  return base.toLowerCase().endsWith(".k500") ? base : `${base}.k500`;
}

function presetPath(file, source = "user") {
  const safe = safePresetFileName(file);
  if (!safe) throw new Error("Nama preset tidak valid.");
  const root = source === "factory" ? FACTORY_PRESET_ROOT : PRESET_ROOT;
  if (!root) throw new Error("Factory preset root tidak tersedia.");
  const full = path.join(root, safe);
  if (path.dirname(full) !== root) throw new Error("Path preset tidak valid.");
  return full;
}

function readPresetLabel(filePath) {
  try {
    const bytes = readFileSync(filePath);
    if (bytes.length >= PRESET_NAME_OFFSET + 1) {
      const name = decodeAscii(bytes.subarray(PRESET_NAME_OFFSET, Math.min(bytes.length, PRESET_NAME_OFFSET + PRESET_NAME_LENGTH)));
      if (name) return name;
    }
  } catch {}
  return path.basename(filePath, path.extname(filePath)).replace(/[_-]+/g, " ").trim();
}

function listPresetRoot(root, source) {
  if (!root || !existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".k500"))
    .map((entry) => {
      const full = path.join(root, entry.name);
      const st = statSync(full);
      return {
        file: entry.name,
        name: readPresetLabel(full),
        source,
        digest: createHash("sha256").update(readFileSync(full)).digest("hex"),
        size: st.size,
        mtimeMs: st.mtimeMs,
      };
    });
}

function listPcPresets() {
  const factory = listPresetRoot(FACTORY_PRESET_ROOT, "factory");
  const factoryDigests = new Map(factory.map((item) => [item.file.toLowerCase(), item.digest]));
  // v0.8.43 seeded the bundled preset into Documents. Hide that exact legacy
  // duplicate, while still showing a same-name file if the user edited it.
  const user = listPresetRoot(PRESET_ROOT, "user").filter(
    (item) => factoryDigests.get(item.file.toLowerCase()) !== item.digest,
  );
  return [...factory, ...user]
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === "factory" ? -1 : 1;
      return a.file.localeCompare(b.file, undefined, { numeric: true, sensitivity: "base" });
    })
    .map(({ digest: _digest, ...item }, idx) => ({ slot: idx + 1, ...item }));
}

function presetCatalogStatus() {
  if (!FACTORY_PRESET_ROOT) return { status: "unavailable" };
  try {
    const value = JSON.parse(readFileSync(path.join(FACTORY_PRESET_ROOT, ".catalog-state.json"), "utf8"));
    return {
      status: String(value.status || "bundled"),
      catalogVersion: String(value.catalogVersion || ""),
      lastCheckedAt: String(value.lastCheckedAt || ""),
      lastError: String(value.lastError || ""),
    };
  } catch {
    return { status: "bundled", catalogVersion: "", lastCheckedAt: "", lastError: "" };
  }
}

function bytesToHex(buf) { return Buffer.from(buf).toString("hex"); }
function hexToBuffer(raw) {
  const clean = String(raw || "").replace(/\s+/g, "");
  if (!/^[0-9a-f]*$/i.test(clean) || clean.length % 2) throw new Error("Preset hex tidak valid.");
  return Buffer.from(clean, "hex");
}

// ---------------------------------------------------------------------------
// Transports
// ---------------------------------------------------------------------------

class BtTransport {
  constructor(serialPort, label) { this.port = serialPort; this.label = label; this.kind = "bt"; }
  write(btFrame) { return new Promise((res, rej) => this.port.write(btFrame, (e) => (e ? rej(e) : res()))); }
  onData(cb) { this.port.on("data", cb); }
  async close() { await new Promise((r) => this.port.close(() => r())); }
}

class UsbTransport {
  constructor(hidDev, label) { this.dev = hidDev; this.label = label; this.kind = "usb"; }
  async write(btFrame) {
    const usb = toUsbFrame(btFrame);
    for (let offset = 0; offset < usb.length; offset += 64) {
      const report = Buffer.alloc(65); // [reportId 0x00] + 64 data bytes
      usb.subarray(offset, offset + 64).copy(report, 1);
      this.dev.write(Array.from(report));
    }
  }
  onData(cb) { this.dev.on("data", cb); }
  async close() { try { this.dev.close(); } catch {} }
}

async function probe(transport, attempts = 2, timeoutMs = 1300) {
  for (let i = 0; i < attempts; i++) {
    const detect = makeRspDetector(0xe3);
    const got = await new Promise((resolve) => {
      const timer = setTimeout(() => { cleanup(); resolve(false); }, timeoutMs);
      const onData = (chunk) => { if (detect(chunk)) { cleanup(); resolve(true); } };
      const cleanup = () => { clearTimeout(timer); off(); };
      const off = attachTemp(transport, onData);
      transport.write(buildHeartbeatBt()).catch(() => { cleanup(); resolve(false); });
    });
    if (got) return true;
    await sleep(150);
  }
  return false;
}

function attachTemp(transport, cb) {
  const target = transport.kind === "bt" ? transport.port : transport.dev;
  target.on("data", cb);
  return () => target.off?.("data", cb) ?? target.removeListener("data", cb);
}

// ---------------------------------------------------------------------------
// Smart scanners — this is the part the browser can never do by itself.
// ---------------------------------------------------------------------------

async function scanBluetooth(status) {
  const { SerialPort } = await import("serialport");
  const all = await SerialPort.list();
  // Windows Bluetooth SPP COM ports enumerate under BTHENUM.
  let candidates = all.filter((p) => /BTHENUM/i.test(p.pnpId || "") || /bluetooth/i.test(p.friendlyName || p.manufacturer || ""));
  if (!candidates.length) candidates = all; // fall back to every port
  const lastGood = loadLastGood().bt;
  candidates.sort((a, b) => (a.path === lastGood ? -1 : b.path === lastGood ? 1 : 0));
  status(`BT scan: ${candidates.length} kandidat COM (${candidates.map((c) => c.path).join(", ")})`);

  for (const cand of candidates) {
    status(`Probing ${cand.path}...`);
    let sp;
    try {
      sp = await new Promise((res, rej) => {
        const p = new SerialPort({ path: cand.path, baudRate: 115200, autoOpen: false });
        const timer = setTimeout(() => { p.close(() => {}); rej(new Error("open timeout")); }, 7000);
        p.open((e) => { clearTimeout(timer); e ? rej(e) : res(p); });
      });
    } catch { continue; } // busy / offline / incoming-only
    const t = new BtTransport(sp, `${cand.path} · KTV Bluetooth SPP`);
    if (await probe(t, cand.path === lastGood ? 3 : 2)) {
      saveLastGood("bt", cand.path);
      return t;
    }
    await t.close();
  }
  return null;
}

async function scanUsb(status) {
  const HID = (await import("node-hid")).default;
  const devices = HID.devices().filter((d) => d.vendorId === K500_USB_VENDOR_ID && d.productId === K500_USB_PRODUCT_ID);
  status(`USB scan: ${devices.length} device DSP AUDIO (VID 10C4 PID 0321)`);
  for (const info of devices) {
    try {
      const dev = new HID.HID(info.path);
      const t = new UsbTransport(dev, `${info.product || "USB HID DSP AUDIO"} · USB`);
      if (await probe(t, 2, 1500)) {
        saveLastGood("usb", info.path);
        return t;
      }
      await t.close();
    } catch { /* held by another app */ }
  }
  return null;
}

// ---------------------------------------------------------------------------
// WebSocket server
// ---------------------------------------------------------------------------

export async function startBridge({
  host = "127.0.0.1",
  port = Number(process.env.K500_BRIDGE_PORT || 8500),
  presetRoot = process.env.K500_PRESET_ROOT || process.cwd(),
  factoryPresetRoot = process.env.K500_FACTORY_PRESET_ROOT || null,
} = {}) {
  PRESET_ROOT = path.resolve(presetRoot);
  FACTORY_PRESET_ROOT = factoryPresetRoot ? path.resolve(factoryPresetRoot) : null;
  mkdirSync(PRESET_ROOT, { recursive: true });
  if (FACTORY_PRESET_ROOT) mkdirSync(FACTORY_PRESET_ROOT, { recursive: true });
  const { WebSocketServer } = await import("ws");
  const wss = new WebSocketServer({ host, port, path: "/k500" });

  let active = null; // { ws, transport }

  wss.on("connection", (ws) => {
    const send = (obj) => { try { ws.send(JSON.stringify(obj)); } catch {} };
    send({ t: "hello", version: "1.0" });

    ws.on("message", async (raw) => {
      let msg;
      try { msg = JSON.parse(String(raw)); } catch { return; }

      if (msg.t === "listPcPresets") {
        try {
          send({
            t: "pcPresets",
            id: msg.id,
            root: PRESET_ROOT,
            factoryRoot: FACTORY_PRESET_ROOT,
            catalog: presetCatalogStatus(),
            items: listPcPresets(),
          });
        } catch (err) {
          send({ t: "error", id: msg.id, msg: `PC preset scan gagal: ${err?.message || err}` });
        }
        return;
      }

      if (msg.t === "readPcPreset") {
        try {
          const source = msg.source === "factory" ? "factory" : "user";
          const full = presetPath(msg.file, source);
          const bytes = readFileSync(full);
          send({ t: "pcPresetBytes", id: msg.id, file: path.basename(full), source, name: readPresetLabel(full), hex: bytesToHex(bytes) });
        } catch (err) {
          send({ t: "error", id: msg.id, msg: `PC preset read gagal: ${err?.message || err}` });
        }
        return;
      }

      if (msg.t === "savePcPreset") {
        try {
          const full = presetPath(msg.file, "user");
          const bytes = hexToBuffer(msg.hex);
          writeFileSync(full, bytes);
          send({ t: "pcPresetSaved", id: msg.id, file: path.basename(full), source: "user", root: PRESET_ROOT, items: listPcPresets() });
        } catch (err) {
          send({ t: "error", id: msg.id, msg: `PC preset save gagal: ${err?.message || err}` });
        }
        return;
      }

      if (msg.t === "connect") {
        const status = (s) => send({ t: "status", msg: s });
        try {
          if (active?.transport) { await active.transport.close().catch(() => {}); active = null; }
          const transport = msg.mode === "usb" ? await scanUsb(status) : await scanBluetooth(status);
          if (!transport) {
            send({ t: "error", msg: msg.mode === "usb"
              ? "DSP AUDIO (VID 10C4 PID 0321) tidak ditemukan / tidak merespon. Cek kabel & tutup app native."
              : "Tidak ada COM Bluetooth yang merespon protokol K500. Pastikan KTV menyala & ter-pair." });
            return;
          }
          active = { ws, transport };
          transport.onData((chunk) => send({ t: "rx", hex: Buffer.from(chunk).toString("hex") }));
          send({ t: "connected", transport: transport.kind, label: transport.label });
        } catch (err) {
          send({ t: "error", msg: `Bridge scan gagal: ${err?.message || err}` });
        }
        return;
      }

      if (msg.t === "tx" && active?.transport && active.ws === ws) {
        try { await active.transport.write(Buffer.from(msg.hex, "hex")); }
        catch (err) { send({ t: "error", msg: `TX gagal: ${err?.message || err}` }); }
        return;
      }

      if (msg.t === "disconnect") {
        if (active?.transport && active.ws === ws) { await active.transport.close().catch(() => {}); active = null; }
        send({ t: "closed" });
      }
    });

    ws.on("close", async () => {
      if (active?.ws === ws) {
        await active.transport?.close().catch(() => {});
        active = null;
      }
    });
  });

  wss.on("error", (err) => {
    if (err?.code === "EADDRINUSE") console.log("[k500-bridge] already running — reusing existing instance");
    else console.warn("[k500-bridge] error:", err?.message || err);
  });

  // Do not open the desktop window until the bridge has either started or a
  // previously-running bridge owns the port. This removes the startup race
  // with the renderer's short WebSocket discovery timeout.
  await new Promise((resolve, reject) => {
    if (wss.address()) { resolve(); return; }
    wss.once("listening", resolve);
    wss.once("error", (err) => err?.code === "EADDRINUSE" ? resolve() : reject(err));
  });
  if (wss.address()) console.log(`[k500-bridge] listening on ws://${host}:${port}/k500`);

  return wss;
}

// Standalone: `node tools/k500-bridge.mjs`
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"))) {
  startBridge();
}
