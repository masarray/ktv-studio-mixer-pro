import { create } from "zustand";
import type { EqBand, EqCrossover, Preset } from "@/features/k500/types";
import { DEVICE_ROUTE_BT, DEVICE_ROUTE_USB, DEVICE_SLOT_IMAGE_LENGTH, DEVICE_SLOT_WRITE_CHUNK, EQ_SECTION_ID, buildCrossoverWrite, buildEqWrite, buildHeartbeat, buildHandshake, buildMicEqLink, buildMute, buildOutputBlock, buildReadBlock, buildRecallHandshake, buildRecallMode, buildStoreBegin, buildStoreChunk, buildStoreCommit, buildTopEffectBlock, buildTopMicBlock, buildTopMusicBlock, buildUseInitVolume, supportsCrossoverWrite, type DeviceStoreChain } from "@/features/k500/protocol/commands";
import { buildDeviceSlotImage } from "@/features/k500/live/liveMemory";
import { frameLabel, hex } from "@/features/k500/protocol/frame";

type LiveStatus = "unsupported" | "disconnected" | "connecting" | "connected" | "error";
type LogDir = "TX" | "RX" | "SYS" | "ERR";

export interface LiveLogLine {
  ts: string;
  dir: LogDir;
  label: string;
  data?: string;
}

interface K500LiveState {
  status: LiveStatus;
  liveEnabled: boolean;
  mute: boolean;
  lastError: string | null;
  lastRx: string;
  lastTx: string;
  portLabel: string;
  transportMode: "bt" | "usb";
  useInitVolume: boolean;
  recallBusy: boolean;
  storeBusy: boolean;
  storeProgress: string;
  log: LiveLogLine[];
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  setTransportMode: (mode: "bt" | "usb") => void;
  hydrateTransportMode: () => void;
  setLiveEnabled: (enabled: boolean) => void;
  setUseInitVolume: (enabled: boolean) => Promise<void>;
  recallMode: (slotOneBased: number) => Promise<void>;
  savePresetToSlot: (slotOneBased: number, preset: Preset) => Promise<void>;
  massUploadSlots: (slots: Array<{ slotOneBased: number; preset: Preset }>) => Promise<void>;
  sendHeartbeat: () => Promise<void>;
  sendHandshake: () => Promise<void>;
  toggleMute: () => Promise<void>;
  sendEqBand: (eqKey: string, bandIndexZeroBased: number, band: Pick<EqBand, "type" | "frequencyHz" | "q" | "gainDb">) => Promise<void>;
  sendPathUpdate: (path: string, preset: Preset) => Promise<void>;
  clearLog: () => void;
}

let port: SerialPort | null = null;
let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let readAbort = false;
let heartbeatTimer: number | null = null;
let heartbeatInFlight = false;
let sendQueue: Promise<void> = Promise.resolve();

// USB HID transport — verified against the 04.07.2026 USBPcap sniff of the
// original app connecting to the K500 ("USB HID DSP AUDIO").
//   Device   : VID 0x10C4, PID 0x0321
//   Reports  : 64-byte interrupt IN/OUT, report id 0, frame at offset 0,
//              zero-padded. RX frames are identical to the BT format
//              (55 len16 rsp .. cs), so the shared parser is reused as-is.
//   TX frames: same protocol but with a 16-bit little-endian length field
//              (BT uses 8-bit), e.g. heartbeat AA 01 00 1C E3, and the 0x40
//              read-block mode byte is 0x00 on USB (0x63 on BT).
let hidDevice: any = null;
let hidInputListener: ((e: any) => void) | null = null;
let hidDisconnectListener: ((e: any) => void) | null = null;
const HID_REPORT_ID = 0;
const HID_REPORT_SIZE = 64;
const K500_USB_VENDOR_ID = 0x10c4;
const K500_USB_PRODUCT_ID = 0x0321;
const HEARTBEAT_INTERVAL_MS = 3200;
const HEARTBEAT_WRITE_TIMEOUT_MS = 900;
const LIVE_SKIP_LOG_INTERVAL_MS = 1500;
let lastLiveSkipLogAt = 0;

function isLiveWriteAllowed(set: any, get: any, label: string): boolean {
  if (get().status !== "connected") return false;
  const now = Date.now();
  if (get().recallBusy || get().storeBusy) {
    if (now - lastLiveSkipLogAt > LIVE_SKIP_LOG_INTERVAL_MS) {
      lastLiveSkipLogAt = now;
      const reason = get().storeBusy ? "Save/Mass Upload" : "Recall + refresh memory";
      appendLog(set, get, { dir: "SYS", label: "live edit paused", data: `${label} ditahan selama ${reason}` });
    }
    return false;
  }
  if (get().liveEnabled) return true;
  if (now - lastLiveSkipLogAt > LIVE_SKIP_LOG_INTERVAL_MS) {
    lastLiveSkipLogAt = now;
    appendLog(set, get, { dir: "SYS", label: "live edit paused", data: `${label} tidak dikirim karena LIVE OFF` });
  }
  return false;
}

function enableLiveRamAfterSync(set: any, get: any) {
  if (get().status !== "connected") return;
  if (!get().liveEnabled) {
    set({ liveEnabled: true });
    appendLog(set, get, { dir: "SYS", label: "LIVE EDIT AUTO ON", data: "connect berhasil — perubahan fader/PEQ langsung dikirim ke RAM device" });
  }
}

/** Convert a BT-framed command (AA len8 body cs) into the USB HID framing
 *  (AA len16LE body cs) observed in the USB sniff. */
function toUsbFrame(btFrame: Uint8Array): Uint8Array {
  if (btFrame[0] !== 0xaa) return btFrame;
  const bodyLen = btFrame[1];
  const body = Array.from(btFrame.slice(2, 2 + bodyLen));
  // Read-block mode byte differs per transport: 0x63 over BT, 0x00 over USB.
  if (body[0] === 0x40 && body.length === 6) body[5] = 0x00;
  const out = [0xaa, bodyLen & 0xff, (bodyLen >> 8) & 0xff, ...body];
  let sum = 0;
  for (let i = 1; i < out.length; i++) sum = (sum + out[i]) & 0xff;
  out.push((0x100 - sum) & 0xff);
  return new Uint8Array(out);
}

// K500 Native Bridge (tools/k500-bridge.mjs, auto-started by `vite dev`):
// a Node-side scanner that enumerates COM/HID itself — the zero-popup path.
let bridgeWs: WebSocket | null = null;
const BRIDGE_URL = "ws://127.0.0.1:8500/k500";

function hexToBytes(h: string): Uint8Array {
  const clean = h.replace(/\s+/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Try the native bridge first. Resolves with a label when connected, null
 *  when no bridge is running (fall back to Web Serial/WebHID), and throws
 *  when the bridge is up but the device genuinely can't be found. */
function tryBridgeConnect(mode: "bt" | "usb", set: any, get: any): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket;
    try { ws = new WebSocket(BRIDGE_URL); } catch { resolve(null); return; }
    let settled = false;
    const dialTimer = window.setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) { settled = true; try { ws.close(); } catch {} resolve(null); }
    }, 600);
    // Bridge scan (BT COM sweep) can legitimately take a while.
    const scanTimer = window.setTimeout(() => {
      if (!settled) { settled = true; try { ws.close(); } catch {} reject(new Error("Bridge scan timeout (45 s).")); }
    }, 45000);
    const finish = (fn: () => void) => { window.clearTimeout(dialTimer); window.clearTimeout(scanTimer); fn(); };

    ws.onopen = () => {
      appendLog(set, get, { dir: "SYS", label: "native bridge", data: "terhubung ke k500-bridge — scan mandiri tanpa popup browser" });
      ws.send(JSON.stringify({ t: "connect", mode }));
    };
    ws.onmessage = (ev) => {
      let msg: any;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      if (msg.t === "status") {
        set({ portLabel: msg.msg });
        appendLog(set, get, { dir: "SYS", label: "bridge scan", data: msg.msg });
      } else if (msg.t === "connected" && !settled) {
        settled = true;
        bridgeWs = ws;
        finish(() => resolve(`${msg.label} · bridge`));
      } else if (msg.t === "rx") {
        feedRxBytes(hexToBytes(msg.hex), set, get);
        set({ lastRx: hexToBytes(msg.hex).length ? msg.hex.replace(/(..)/g, "$1 ").trim() : get().lastRx });
      } else if (msg.t === "error" && !settled) {
        settled = true;
        finish(() => { try { ws.close(); } catch {} reject(new Error(msg.msg)); });
      }
    };
    ws.onerror = () => { if (!settled) { settled = true; finish(() => resolve(null)); } };
    ws.onclose = () => {
      if (!settled) { settled = true; finish(() => resolve(null)); return; }
      if (bridgeWs === ws) {
        bridgeWs = null;
        if (get().status === "connected") {
          set({ status: "disconnected", liveEnabled: false, portLabel: "No port", lastError: "Bridge terputus (dev server restart?)." });
          appendLog(set, get, { dir: "ERR", label: "bridge closed", data: "koneksi bridge terputus" });
        }
      }
    };
  });
}

// Raw device scalar bytes (live 0x00..0x3F), seeded at connect readback and
// refreshed before stale block writes. Rarely-edited fields in live command
// blocks are mirrored from here so we can never overwrite a device setting
// with a wrong model value (see buildTopMusicBlock).
let deviceScalarCache: Uint8Array | null = null;
let deviceScalarCacheAt = 0;
const SCALAR_CACHE_TTL_MS = 4000;

async function refreshDeviceScalars(set: any, get: any): Promise<void> {
  if (Date.now() - deviceScalarCacheAt < SCALAR_CACHE_TTL_MS) return;
  try {
    const res = await requestResponse(buildReadBlock(0x0000, 0x40), "Refresh scalar cache 0x00..0x3F", 0xbf, set, get, 2000);
    if (res.checksumOk && res.data.length >= 0x40) {
      deviceScalarCache = new Uint8Array(res.data.slice(0, 0x40));
      deviceScalarCacheAt = Date.now();
    }
  } catch {
    // keep the previous cache; a stale mirror is still device truth
  }
}

const SPP_SERVICE_CLASS = "00001101-0000-1000-8000-00805f9b34fb";
const TRANSPORT_STORAGE_KEY = "k500.transportMode";

function loadTransportMode(): "bt" | "usb" {
  try {
    if (typeof window === "undefined") return "bt";
    return window.localStorage.getItem(TRANSPORT_STORAGE_KEY) === "usb" ? "usb" : "bt";
  } catch {
    return "bt";
  }
}

function saveTransportMode(mode: "bt" | "usb") {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(TRANSPORT_STORAGE_KEY, mode);
  } catch {}
}

function recallRouteMask(): number {
  // Native Save/Mass Upload and Mode 1 Recall captures use destination mask
  // 0x03. This is a device-side destination mask, not the physical PC cable.
  return DEVICE_ROUTE_USB | DEVICE_ROUTE_BT;
}

interface K500Response {
  rsp: number;
  data: Uint8Array;
  raw: Uint8Array;
  checksumOk: boolean;
}

let rxBuffer: number[] = [];
let responseWaiters: Array<{
  rsp?: number;
  resolve: (frame: K500Response) => void;
  reject: (err: Error) => void;
  timer: number;
}> = [];

function clearWaiters(message: string) {
  for (const waiter of responseWaiters) {
    window.clearTimeout(waiter.timer);
    waiter.reject(new Error(message));
  }
  responseWaiters = [];
}

function waitForResponse(rsp?: number, timeoutMs = 1800): Promise<K500Response> {
  return new Promise((resolve, reject) => {
    const waiter = {
      rsp,
      resolve,
      reject,
      timer: window.setTimeout(() => {
        responseWaiters = responseWaiters.filter((w) => w !== waiter);
        reject(new Error(`Timeout waiting for response ${rsp === undefined ? "any" : `0x${rsp.toString(16)}`}`));
      }, timeoutMs),
    };
    responseWaiters.push(waiter);
  });
}

function responseChecksumOk(raw: Uint8Array): boolean {
  let sum = 0;
  for (let i = 1; i < raw.length; i++) sum = (sum + raw[i]) & 0xff;
  return sum === 0;
}

function feedRxBytes(chunk: Uint8Array, set: any, get: any) {
  rxBuffer.push(...chunk);
  while (rxBuffer.length >= 5) {
    const headerIndex = rxBuffer.indexOf(0x55);
    if (headerIndex < 0) {
      rxBuffer = [];
      return;
    }
    if (headerIndex > 0) rxBuffer.splice(0, headerIndex);
    if (rxBuffer.length < 5) return;

    const bodyLen = rxBuffer[1] | (rxBuffer[2] << 8);
    const totalLen = 1 + 2 + bodyLen + 1;
    if (bodyLen <= 0 || bodyLen > 4096) {
      rxBuffer.shift();
      continue;
    }
    if (rxBuffer.length < totalLen) return;

    const raw = new Uint8Array(rxBuffer.splice(0, totalLen));
    const rsp = raw[3];
    const data = raw.slice(4, 3 + bodyLen);
    const frame: K500Response = { rsp, data, raw, checksumOk: responseChecksumOk(raw) };
    const h = hex(raw);
    set({ lastRx: h });
    appendLog(set, get, { dir: "RX", label: `${frameLabel(raw)}${frame.checksumOk ? "" : " BAD-CS"}`, data: h });

    const waiter = responseWaiters.find((w) => w.rsp === undefined || w.rsp === rsp);
    if (waiter) {
      window.clearTimeout(waiter.timer);
      responseWaiters = responseWaiters.filter((w) => w !== waiter);
      waiter.resolve(frame);
    }
  }
}

async function requestResponse(frame: Uint8Array, label: string, rsp: number, set: any, get: any, timeoutMs = 1800): Promise<K500Response> {
  const waiter = waitForResponse(rsp, timeoutMs);
  await writeRaw(frame, label, set, get);
  return waiter;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function sendHeartbeatKeepAlive(set: any, get: any, label = "Heartbeat 0x1C"): Promise<void> {
  if (heartbeatInFlight) return;
  if (get().status !== "connected") return;
  heartbeatInFlight = true;
  try {
    const frame = buildHeartbeat();
    if (hidDevice) {
      // USB keep-alive must not wait behind the shared editor-write queue.
      // If an EQ/import write jams the queue, this direct path still keeps the
      // device LCD linked to the PC, matching the native app heartbeat cadence.
      await withTimeout(writeRaw(frame, `${label} · keepalive`, set, get), HEARTBEAT_WRITE_TIMEOUT_MS, "USB heartbeat write timed out");
    } else {
      await enqueueWrite(frame, label, set, get);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    set({ lastError: message });
    appendLog(set, get, { dir: "ERR", label: "heartbeat failed", data: message });
  } finally {
    heartbeatInFlight = false;
  }
}

function startHeartbeatLoop(set: any, get: any) {
  if (heartbeatTimer) window.clearInterval(heartbeatTimer);
  heartbeatTimer = window.setInterval(() => {
    void sendHeartbeatKeepAlive(set, get);
  }, HEARTBEAT_INTERVAL_MS);
}

async function importLiveMemoryIntoStudio(memory: Uint8Array, activeModeIndex?: number) {
  const { useStudio } = await import("@/features/k500/store");
  const copy = new Uint8Array(memory);
  await useStudio.getState().importLiveMemory(copy.buffer, "K500 DEVICE LIVE");

  // The C0 response after Recall reports the active slot directly. Preserve that
  // authoritative slot instead of relying only on name matching in live memory.
  if (activeModeIndex && activeModeIndex >= 1 && activeModeIndex <= 10) {
    const current = useStudio.getState().preset;
    if (current) {
      const next = structuredClone(current);
      next.system.deviceModeIndex = activeModeIndex;
      useStudio.setState({ preset: next });
    }
  }
}

async function readActiveDeviceMemory(set: any, get: any, activeModeIndex?: number, reason = "sync") {
  const total = 0x03ab; // native readback: 0x0000..0x03AA
  const block = 0x3a;
  const memory = new Uint8Array(total);

  for (let offset = 0; offset < total; offset += block) {
    const len = Math.min(block, total - offset);
    const resp = await requestResponse(
      buildReadBlock(offset, len),
      `Read 0x${offset.toString(16).padStart(4, "0")} len ${len}`,
      0xbf,
      set,
      get,
      2500,
    );
    if (!resp.checksumOk) throw new Error(`Bad checksum while reading device at 0x${offset.toString(16)}`);
    memory.set(resp.data.slice(0, len), offset);
    await sleep(35);
  }

  deviceScalarCache = new Uint8Array(memory.slice(0, 0x40));
  deviceScalarCacheAt = Date.now();
  await importLiveMemoryIntoStudio(memory, activeModeIndex);
  set({ lastError: null });
  appendLog(set, get, { dir: "SYS", label: `${reason} complete`, data: `${memory.length} bytes loaded into editor${activeModeIndex ? ` · active slot ${activeModeIndex}` : ""}` });
}

async function syncFromDevice(set: any, get: any) {
  appendLog(set, get, { dir: "SYS", label: "sync from device", data: "heartbeat + handshake + read active memory" });
  try {
    // Match the original Professional Audio System connect sequence.
    await requestResponse(buildHeartbeat(), "Initial status 0x1C", 0xe3, set, get, 2500);
    await requestResponse(buildHandshake(), "Handshake 0x3F", 0xc0, set, get, 2500);
    await readActiveDeviceMemory(set, get);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    set({ lastError: message });
    appendLog(set, get, { dir: "ERR", label: "sync failed", data: message });
  }
}

function outputPathToSection(path: string): "main" | "surround" | "center" | "sub" | null {
  if (path.startsWith("outputs.main.")) return "main";
  if (path.startsWith("outputs.surround.")) return "surround";
  if (path.startsWith("outputs.center.")) return "center";
  // Sub HPF/LPF are crossover CMD 0x11, not output-block CMD 0x0E.
  if (path === "outputs.sub.hpfHz" || path === "outputs.sub.lpfHz") return null;
  if (path.startsWith("outputs.sub.")) return "sub";
  return null;
}

type CrossoverLiveWrite = { eqKey: string; kind: "hpf" | "lpf"; hz: number; crossover?: EqCrossover };

function crossoverPathToWrites(path: string, preset: Preset): CrossoverLiveWrite[] | null {
  const eqMatch = /^eq\.([^.]+)\.crossover\.(hpfHz|lpfHz)$/.exec(path);
  if (eqMatch) {
    const eqKey = eqMatch[1];
    const field = eqMatch[2] as "hpfHz" | "lpfHz";
    const section = preset.eq[eqKey];
    if (!section) return null;
    return [{ eqKey, kind: field === "hpfHz" ? "hpf" : "lpf", hz: section.crossover[field], crossover: section.crossover }];
  }

  if (path === "mic.hpfHz" || path === "mic.lpfHz") {
    const kind = path.endsWith("hpfHz") ? "hpf" : "lpf";
    const hz = kind === "hpf" ? preset.mic.hpfHz : preset.mic.lpfHz;
    // Native CMD 0x11 uses one shared Mic filter selector pair (00/01), not
    // separate PEQ section ids for Mic A and Mic B.
    return [{ eqKey: "mic", kind, hz, crossover: preset.eq.micA?.crossover }];
  }

  if (path === "outputs.sub.hpfHz" || path === "outputs.sub.lpfHz") {
    const kind = path.endsWith("hpfHz") ? "hpf" : "lpf";
    const hz = kind === "hpf" ? preset.outputs.sub.hpfHz : preset.outputs.sub.lpfHz;
    return [{ eqKey: "sub", kind, hz, crossover: preset.eq.sub?.crossover }];
  }

  if (path === "effects.reverb.hpfHz" || path === "effects.reverb.lpfHz") {
    const kind = path.endsWith("hpfHz") ? "hpf" : "lpf";
    const hz = kind === "hpf" ? preset.effects.reverb.hpfHz : preset.effects.reverb.lpfHz;
    return [{ eqKey: "reverb", kind, hz, crossover: preset.eq.reverb?.crossover }];
  }

  if (path === "effects.echo.hpfHz" || path === "effects.echo.lpfHz") {
    const kind = path.endsWith("hpfHz") ? "hpf" : "lpf";
    const hz = kind === "hpf" ? preset.effects.echo.hpfHz : preset.effects.echo.lpfHz;
    return [{ eqKey: "echo", kind, hz, crossover: preset.eq.echo?.crossover }];
  }

  return null;
}

const TOP_MUSIC_BLOCK_PATHS = new Set([
  "system.topMusicVol",
  "music.source",
  "music.key",
  "music.input1GainDb",
  "music.input2GainDb",
  "music.btGainDb",
  "music.uDiskGainDb",
  "music.digitalGainDb",
]);

const TOP_MIC_BLOCK_PATHS = new Set([
  "system.topMicVol",
  "mic.micAVol",
  "mic.micBVol",
  "mic.compThresholdDb",
  "mic.compRatio",
  "mic.attackMs",
  "mic.releaseSec",
]);

const TOP_EFFECT_BLOCK_PATHS = new Set([
  "system.topEffectVol",
  "system.effectInitLevel",
]);

function describeLivePath(path: string): string {
  return path
    .replace(/^outputs\./, "Output ")
    .replace(/^music\./, "Music ")
    .replace(/^mic\./, "Mic ")
    .replace(/^system\./, "System ")
    .replace(/\./g, " /");
}

function serialSupported(): boolean {
  return typeof globalThis !== "undefined"
    && typeof globalThis.navigator !== "undefined"
    && !!(globalThis.navigator as any).serial;
}

function hidSupported(): boolean {
  return typeof globalThis !== "undefined"
    && typeof globalThis.navigator !== "undefined"
    && !!(globalThis.navigator as any).hid;
}

// ---------------------------------------------------------------------------
// Smart connect: identify the K500 by protocol, not by port name.
// A port "is" the K500 if it answers heartbeat 0xAA 01 1C E3 with a 0x55/0xE3
// status frame — the same signature the original app relies on.
// ---------------------------------------------------------------------------

function startSerialReader(p: SerialPort, set: any, get: any) {
  if (!p.readable) return;
  reader = p.readable.getReader();
  (async () => {
    while (!readAbort && reader) {
      try {
        const { value, done } = await reader.read();
        if (done || !value) break;
        feedRxBytes(value, set, get);
      } catch (err) {
        if (!readAbort) {
          const message = err instanceof Error ? err.message : String(err);
          set({ status: "error", lastError: message });
          appendLog(set, get, { dir: "ERR", label: "read failed", data: message });
        }
        break;
      }
    }
  })();
}

async function openSerial(p: SerialPort, set: any, get: any): Promise<void> {
  await p.open({ baudRate: 115200, dataBits: 8, stopBits: 1, parity: "none", bufferSize: 4096, flowControl: "none" });
  port = p;
  writer = p.writable!.getWriter();
  readAbort = false;
  rxBuffer = [];
  startSerialReader(p, set, get);
}

async function releaseSerialOnly(): Promise<void> {
  readAbort = true;
  clearWaiters("probe closed");
  rxBuffer = [];
  try { await reader?.cancel(); } catch {}
  try { reader?.releaseLock(); } catch {}
  reader = null;
  try { writer?.releaseLock(); } catch {}
  writer = null;
  try { await port?.close(); } catch {}
  port = null;
}

/** Identify the K500 by protocol. Bluetooth SPP links need warm-up after
 *  open() (Windows establishes the RFCOMM channel lazily, 2-5 s from idle),
 *  so the first heartbeat can vanish into the void on a perfectly good port.
 *  The native app is patient; we retry instead of declaring the port silent
 *  after a single attempt — that impatience was the main reason the chooser
 *  kept reappearing even for already-granted KTV ports. */
async function probeK500(set: any, get: any, timeoutMs = 1500, attempts = 1): Promise<boolean> {
  for (let i = 0; i < Math.max(1, attempts); i++) {
    try {
      await requestResponse(buildHeartbeat(), `Probe heartbeat 0x1C${attempts > 1 ? ` (${i + 1}/${attempts})` : ""}`, 0xe3, set, get, timeoutMs);
      return true;
    } catch {
      if (i < attempts - 1) await sleep(150);
    }
  }
  return false;
}

/** Some paired-but-offline BT devices make open() hang for a long time; cap it
 *  so a dead entry in the granted list can't stall the whole auto-scan. */
async function openSerialWithTimeout(p: SerialPort, set: any, get: any, ms = 7000): Promise<void> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, rej) => {
    timer = window.setTimeout(() => rej(new Error("open timeout")), ms);
  });
  try {
    await Promise.race([openSerial(p, set, get), timeout]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

// Remember which granted port answered last time so the very first probe on
// the next Connect is almost always a direct hit.
const BT_LAST_PORT_KEY = "k500.btLastPortIndex";
function loadLastPortIndex(): number {
  try { return Number(window.localStorage.getItem(BT_LAST_PORT_KEY) ?? -1); } catch { return -1; }
}
function saveLastPortIndex(i: number) {
  try { window.localStorage.setItem(BT_LAST_PORT_KEY, String(i)); } catch {}
}

function serialPortLabel(p: SerialPort): string {
  const info: any = p.getInfo?.() ?? {};
  if (info.bluetoothServiceClassId) return "KTV Bluetooth SPP";
  if (info.usbVendorId) return `USB ${info.usbVendorId.toString(16).padStart(4, "0")}:${(info.usbProductId ?? 0).toString(16).padStart(4, "0")}`;
  return "Serial port";
}

/** BT mode: silently probe every previously-granted port first (zero-dialog
 *  reconnect). When allowChooser is true, fall back to Chrome's mandatory
 *  one-time Web Serial chooser. Browser security does not allow selecting a
 *  first-time Bluetooth serial port by name from JavaScript. */
async function connectBluetooth(set: any, get: any, allowChooser = true): Promise<boolean> {
  const serial = (globalThis.navigator as any).serial;

  const granted: SerialPort[] = await serial.getPorts().catch(() => []);
  if (granted.length) {
    // Try the port that answered last time first, then the rest.
    const lastGood = loadLastPortIndex();
    const order = granted.map((_, i) => i);
    if (lastGood >= 0 && lastGood < order.length) {
      order.splice(order.indexOf(lastGood), 1);
      order.unshift(lastGood);
    }
    appendLog(set, get, { dir: "SYS", label: "auto-scan", data: `probing ${granted.length} remembered port(s), last-known KTV first` });
    for (let step = 0; step < order.length; step++) {
      const i = order[step];
      const isLastGood = i === lastGood;
      set({ portLabel: `Scanning ${step + 1}/${order.length}...` });
      try {
        await openSerialWithTimeout(granted[i], set, get, isLastGood ? 9000 : 7000);
        // BT RFCOMM warm-up: give the known-good port three chances, others two.
        if (await probeK500(set, get, 1400, isLastGood ? 3 : 2)) {
          saveLastPortIndex(i);
          set({ portLabel: `${serialPortLabel(granted[i])} · auto` });
          appendLog(set, get, { dir: "SYS", label: "K500 found", data: "auto-connected to remembered port (no chooser)" });
          return true;
        }
        appendLog(set, get, { dir: "SYS", label: `port ${step + 1} silent`, data: "no 0xE3 status reply after retries, trying next" });
      } catch {
        // port busy, offline, or vanished — skip quickly
      }
      await releaseSerialOnly();
    }
  }

  if (!allowChooser) return false;

  // First time (or device moved): one-time chooser. Web Serial cannot choose a
  // Bluetooth SPP port by device name programmatically, so this is the only
  // unavoidable manual step in the browser build. Every later Connect is fully
  // automatic via the granted-port scan above.
  appendLog(set, get, { dir: "SYS", label: "BT permission", data: "Chrome wajib menampilkan daftar port untuk izin pertama. Pilih KTV_BT sekali saja — berikutnya auto." });
  let picked: SerialPort;
  try {
    picked = await serial.requestPort({ filters: [{ bluetoothServiceClassId: SPP_SERVICE_CLASS }] });
  } catch (err: any) {
    if (err?.name === "NotFoundError") throw err; // user cancelled
    // Older Chromium without BT service-class filters: show unfiltered list.
    picked = await serial.requestPort();
  }
  await openSerialWithTimeout(picked, set, get, 10000);
  if (!(await probeK500(set, get, 1600, 4))) {
    await releaseSerialOnly();
    throw new Error("Port terbuka tapi tidak merespon protokol K500 (heartbeat 0x1C tanpa balasan 0xE3). Kemungkinan port SPP lain — klik Connect lagi dan pilih entri KTV_BT satunya.");
  }
  try {
    const after: SerialPort[] = await serial.getPorts();
    const idx = after.indexOf(picked);
    if (idx >= 0) saveLastPortIndex(idx);
  } catch {}
  set({ portLabel: serialPortLabel(picked) });
  return true;
}

/** USB mode: the K500 enumerates as "USB HID DSP AUDIO" (VID 10C4 PID 0321).
 *  Auto-scan matches by VID/PID first, then verifies with the heartbeat probe
 *  — same identify-by-protocol rule as the BT path. When allowChooser is false
 *  this never opens a browser permission dialog. */
async function connectUsbHid(set: any, get: any, allowChooser = true): Promise<boolean> {
  const hid = (globalThis.navigator as any).hid;
  const isK500 = (d: any) => d.vendorId === K500_USB_VENDOR_ID && d.productId === K500_USB_PRODUCT_ID;

  const attach = async (device: any): Promise<boolean> => {
    if (!device.opened) await device.open();
    hidDevice = device;
    rxBuffer = [];
    hidInputListener = (e: any) => {
      feedRxBytes(new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength), set, get);
    };
    device.addEventListener("inputreport", hidInputListener);
    if (!hidDisconnectListener) {
      hidDisconnectListener = (e: any) => {
        if (e.device !== hidDevice) return;
        appendLog(set, get, { dir: "ERR", label: "USB disconnected", data: "HID device was removed or released by the OS" });
        void closeInternal().finally(() => {
          set({ status: "disconnected", liveEnabled: false, portLabel: "No port", lastError: "USB device disconnected." });
        });
      };
      hid.addEventListener("disconnect", hidDisconnectListener);
    }
    const ok = await probeK500(set, get, 1500, 2);
    if (!ok) {
      device.removeEventListener("inputreport", hidInputListener);
      hidInputListener = null;
      try { await device.close(); } catch {}
      hidDevice = null;
    }
    return ok;
  };

  // 1) Zero-dialog path: previously granted devices, K500 VID/PID first.
  const granted: any[] = await hid.getDevices().catch(() => []);
  const ordered = [...granted.filter(isK500), ...granted.filter((d: any) => !isK500(d))];
  if (ordered.length) {
    appendLog(set, get, { dir: "SYS", label: "auto-scan USB", data: `probing ${ordered.length} remembered HID device(s), DSP AUDIO first` });
    for (const device of ordered) {
      set({ portLabel: `Scanning ${device.productName || "HID"}...` });
      try {
        if (await attach(device)) {
          set({ portLabel: `${device.productName || "K500 USB HID DSP AUDIO"} · auto` });
          appendLog(set, get, { dir: "SYS", label: "K500 found", data: `USB HID VID ${device.vendorId.toString(16)} PID ${device.productId.toString(16)} (no chooser)` });
          return true;
        }
      } catch {}
    }
  }

  if (!allowChooser) return false;

  // 2) First time: chooser filtered to the DSP AUDIO identity only.
  appendLog(set, get, { dir: "SYS", label: "USB permission", data: "pilih USB HID DSP AUDIO sekali saja — berikutnya otomatis" });
  const devices: any[] = await hid.requestDevice({
    filters: [{ vendorId: K500_USB_VENDOR_ID, productId: K500_USB_PRODUCT_ID }],
  });
  if (!devices.length) {
    const err: any = new Error("Tidak ada device dipilih.");
    err.name = "NotFoundError";
    throw err;
  }
  for (const device of devices) {
    if (await attach(device)) {
      set({ portLabel: device.productName || "K500 USB HID DSP AUDIO" });
      return true;
    }
  }
  throw new Error("USB HID DSP AUDIO terbuka tapi tidak merespon heartbeat. Pastikan aplikasi native tertutup (device HID hanya bisa dipegang satu aplikasi), lalu coba lagi.");
}


type ConnectedTransport = "bt" | "usb";

async function tryTransport(mode: ConnectedTransport, set: any, get: any, allowChooser: boolean): Promise<boolean> {
  if (mode === "bt") {
    if (!serialSupported()) return false;
    return connectBluetooth(set, get, allowChooser);
  }
  if (!hidSupported()) return false;
  return connectUsbHid(set, get, allowChooser);
}

function transportDescription(mode: ConnectedTransport): string {
  return mode === "bt" ? "115200 8N1 · Bluetooth SPP" : "USB HID transport";
}

function preferredSmartOrder(preferred: ConnectedTransport): ConnectedTransport[] {
  return preferred === "usb" ? ["usb", "bt"] : ["bt", "usb"];
}

async function smartAutoScan(set: any, get: any, preferred: ConnectedTransport): Promise<ConnectedTransport | null> {
  const order = preferredSmartOrder(preferred);
  appendLog(set, get, { dir: "SYS", label: "smart auto-scan", data: `checking remembered ${order.map((m) => m.toUpperCase()).join(" → ")} devices without chooser` });

  for (const mode of order) {
    set({ portLabel: `Auto ${mode.toUpperCase()} scan...` });
    try {
      if (await tryTransport(mode, set, get, false)) return mode;
    } catch (err) {
      appendLog(set, get, { dir: "SYS", label: `${mode.toUpperCase()} auto-scan skipped`, data: err instanceof Error ? err.message : String(err) });
      await closeInternal();
    }
  }
  return null;
}

async function smartPermissionFallback(set: any, get: any, preferred: ConnectedTransport): Promise<ConnectedTransport> {
  const canUsb = hidSupported();
  const canBt = serialSupported();
  const order = preferredSmartOrder(preferred).filter((mode) => mode === "usb" ? canUsb : canBt);

  for (const mode of order) {
    set({ portLabel: mode === "usb" ? "Waiting USB HID permission..." : "Waiting BT serial permission..." });
    try {
      if (await tryTransport(mode, set, get, true)) return mode;
    } catch (err: any) {
      const cancelled = err?.name === "NotFoundError";
      appendLog(set, get, { dir: cancelled ? "SYS" : "ERR", label: cancelled ? `${mode.toUpperCase()} permission cancelled` : `${mode.toUpperCase()} permission failed`, data: err instanceof Error ? err.message : String(err) });
      await closeInternal();
      if (cancelled) throw err;
    }
  }

  throw new Error("Tidak ada transport BT/USB yang berhasil connect ke K500.");
}


function clearPendingLiveWrites() {
  if (eqFlushTimer !== null) window.clearTimeout(eqFlushTimer);
  if (blockFlushTimer !== null) window.clearTimeout(blockFlushTimer);
  eqFlushTimer = null;
  blockFlushTimer = null;
  pendingEqWrites.clear();
  pendingBlockWrites.clear();
}

function assertPermanentStoreReady(get: any) {
  if (get().status !== "connected") throw new Error("Device belum connected.");
  if (get().transportMode !== "usb") {
    throw new Error("Save permanen dan Mass Upload hanya diaktifkan melalui USB HID karena sniff native tersedia dari USB.");
  }
}

async function writePresetSlot(
  slotOneBased: number,
  preset: Preset,
  chain: DeviceStoreChain,
  set: any,
  get: any,
  waitForBeginAck = true,
): Promise<DeviceStoreChain> {
  const slot = Math.max(1, Math.min(10, Math.round(Number(slotOneBased) || 1)));
  const image = buildDeviceSlotImage(preset);
  if (image.length !== DEVICE_SLOT_IMAGE_LENGTH) throw new Error(`Slot ${slot}: image length invalid.`);

  const beginFrame = buildStoreBegin(image, chain);
  if (waitForBeginAck) {
    const beginAck = await requestResponse(
      beginFrame,
      `Store begin slot ${slot} · ${DEVICE_SLOT_IMAGE_LENGTH} bytes`,
      0xbe,
      set,
      get,
      3500,
    );
    if (!beginAck.checksumOk) throw new Error(`Slot ${slot}: begin ACK checksum invalid.`);
  } else {
    // Native single-slot Save sends CMD 0x41 and proceeds directly to the 11
    // block ACKs; only Mass Upload captures return 0xBE for each begin.
    await writeRaw(beginFrame, `Store begin slot ${slot} · ${DEVICE_SLOT_IMAGE_LENGTH} bytes`, set, get);
    await sleep(80);
  }

  let blockIndex = 0;
  const totalBlocks = Math.ceil(DEVICE_SLOT_IMAGE_LENGTH / DEVICE_SLOT_WRITE_CHUNK);
  for (let offset = 0; offset < DEVICE_SLOT_IMAGE_LENGTH; offset += DEVICE_SLOT_WRITE_CHUNK) {
    const data = image.slice(offset, Math.min(DEVICE_SLOT_IMAGE_LENGTH, offset + DEVICE_SLOT_WRITE_CHUNK));
    blockIndex += 1;
    set({ storeProgress: `Slot ${slot} · block ${blockIndex}/${totalBlocks}` });
    const blockAck = await requestResponse(
      buildStoreChunk(offset, data),
      `Store slot ${slot} · 0x${offset.toString(16).padStart(4, "0")} · ${data.length} bytes`,
      0xbd,
      set,
      get,
      3500,
    );
    if (!blockAck.checksumOk) throw new Error(`Slot ${slot}: block 0x${offset.toString(16)} ACK checksum invalid.`);
  }

  const commit = buildStoreCommit(slot, image);
  const commitAck = await requestResponse(
    commit,
    `Store commit slot ${slot}`,
    0xbc,
    set,
    get,
    3500,
  );
  if (!commitAck.checksumOk) throw new Error(`Slot ${slot}: commit ACK checksum invalid.`);

  const finalLength = DEVICE_SLOT_IMAGE_LENGTH % DEVICE_SLOT_WRITE_CHUNK || DEVICE_SLOT_WRITE_CHUNK;
  const finalOffset = DEVICE_SLOT_IMAGE_LENGTH - finalLength;
  return [image[finalOffset], image[finalOffset + 1], commit[commit.length - 1]];
}

export const useK500Live = create<K500LiveState>((set, get) => ({
  status: "disconnected",
  liveEnabled: false,
  mute: false,
  lastError: null,
  lastRx: "",
  lastTx: "",
  portLabel: "No port",
  // Keep SSR/client first render deterministic. The saved user choice is
  // restored by hydrateTransportMode() after React mounts, avoiding the stale
  // BT/USB segmented-control state that required clicking BT before USB.
  transportMode: "bt",
  useInitVolume: false,
  recallBusy: false,
  storeBusy: false,
  storeProgress: "",
  log: [],

  setTransportMode: (mode) => {
    set({ transportMode: mode });
    saveTransportMode(mode);
    appendLog(set, get, { dir: "SYS", label: `transport: ${mode.toUpperCase()}`, data: mode === "bt" ? "Bluetooth SPP (Web Serial)" : "USB HID DSP AUDIO (WebHID · VID 10C4 PID 0321)" });
  },

  hydrateTransportMode: () => {
    const persisted = loadTransportMode();
    if (persisted !== get().transportMode) {
      set({ transportMode: persisted });
      appendLog(set, get, { dir: "SYS", label: `transport restored: ${persisted.toUpperCase()}`, data: persisted === "bt" ? "Bluetooth SPP (Web Serial)" : "USB HID DSP AUDIO (WebHID · VID 10C4 PID 0321)" });
    }
  },

  connect: async () => {
    const preferred = get().transportMode;
    await closeInternal();
    set({ status: "connecting", liveEnabled: false, lastError: null, portLabel: "Smart auto-scan..." });
    try {
      // Path 1 — native bridge (zero popup, true auto-discovery). Only falls
      // through to the browser APIs when no bridge is running on this machine.
      const bridgeLabel = await tryBridgeConnect(preferred, set, get);
      if (bridgeLabel) {
        set({ status: "connected", lastError: null, portLabel: bridgeLabel });
        appendLog(set, get, { dir: "SYS", label: "connected", data: `${bridgeLabel} — dipilih otomatis oleh native bridge` });
        startHeartbeatLoop(set, get);
        await syncFromDevice(set, get);
        enableLiveRamAfterSync(set, get);
        return;
      }
      appendLog(set, get, { dir: "SYS", label: "bridge offline", data: "k500-bridge tidak berjalan — fallback ke izin browser (jalankan `npm run dev` terbaru / `npm run bridge`)" });

      if (!serialSupported() && !hidSupported()) {
        throw new Error("Web Serial/WebHID tidak tersedia di browser ini dan native bridge tidak berjalan. Jalankan `npm run dev` (bridge ikut hidup) atau pakai Chrome/Edge.");
      }

      let connectedMode = await smartAutoScan(set, get, preferred);

      if (!connectedMode) {
        appendLog(set, get, {
          dir: "SYS",
          label: "permission needed",
          data: preferred === "bt"
            ? "Belum ada izin BT yang tersimpan. Browser wajib menampilkan port chooser sekali; pilih KTV_BT, lalu Connect berikutnya otomatis."
            : "Belum ada izin USB HID yang tersimpan. Pilih USB HID DSP AUDIO sekali; Connect berikutnya otomatis.",
        });
        connectedMode = await smartPermissionFallback(set, get, preferred);
      }

      set({ status: "connected", lastError: null, transportMode: connectedMode });
      saveTransportMode(connectedMode);
      appendLog(set, get, { dir: "SYS", label: "connected", data: transportDescription(connectedMode) });
      startHeartbeatLoop(set, get);
      await syncFromDevice(set, get);
      enableLiveRamAfterSync(set, get);
    } catch (err) {
      await closeInternal();
      const cancelled = (err as any)?.name === "NotFoundError";
      const message = cancelled ? "Pemilihan port/device dibatalkan." : err instanceof Error ? err.message : String(err);
      set({ status: cancelled ? "disconnected" : "error", liveEnabled: false, lastError: cancelled ? null : message, portLabel: "No port" });
      appendLog(set, get, { dir: cancelled ? "SYS" : "ERR", label: cancelled ? "permission cancelled" : "connect failed", data: message });
    }
  },

  disconnect: async () => {
    await closeInternal();
    set({ status: "disconnected", liveEnabled: false, portLabel: "No port" });
    appendLog(set, get, { dir: "SYS", label: "disconnected" });
  },

  setLiveEnabled: (enabled) => {
    set({ liveEnabled: enabled });
    appendLog(set, get, { dir: "SYS", label: enabled ? "LIVE EDIT ON" : "LIVE EDIT OFF" });
  },

  setUseInitVolume: async (enabled) => {
    const previous = get().useInitVolume;
    const mask = recallRouteMask();
    if (get().status !== "connected") {
      const message = "Device belum connected; Use init vol tidak dikirim.";
      set({ lastError: message });
      appendLog(set, get, { dir: "ERR", label: "Use init vol blocked", data: message });
      return;
    }

    set({ useInitVolume: enabled, lastError: null });
    try {
      const ack = await requestResponse(
        buildUseInitVolume(enabled, mask),
        `Use init vol ${enabled ? "ON" : "OFF"} · mask 0x${mask.toString(16).padStart(2, "0")}`,
        0xed,
        set,
        get,
        2200,
      );
      if (!ack.checksumOk) throw new Error("Use init vol ACK checksum invalid");
      set({ lastError: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ useInitVolume: previous, lastError: message });
      appendLog(set, get, { dir: "ERR", label: "Use init vol failed", data: message });
    }
  },

  recallMode: async (slotOneBased) => {
    if (get().status !== "connected") {
      const message = "Device belum connected.";
      set({ lastError: message });
      appendLog(set, get, { dir: "ERR", label: "Recall blocked", data: message });
      return;
    }
    const slot = Math.max(1, Math.min(10, Math.round(Number(slotOneBased) || 1)));
    const mask = recallRouteMask();
    set({ recallBusy: true, lastError: null });
    try {
      // Never let a stale fader/PEQ drag flush after the device has changed slot.
      if (eqFlushTimer !== null) window.clearTimeout(eqFlushTimer);
      if (blockFlushTimer !== null) window.clearTimeout(blockFlushTimer);
      eqFlushTimer = null;
      blockFlushTimer = null;
      pendingEqWrites.clear();
      pendingBlockWrites.clear();

      await writeRaw(
        buildRecallMode(slot, mask),
        `Recall slot ${slot} · mask 0x${mask.toString(16).padStart(2, "0")}`,
        set,
        get,
      );
      await sleep(80);

      const hello = await requestResponse(
        buildRecallHandshake(mask),
        `Recall refresh handshake · mask 0x${mask.toString(16).padStart(2, "0")}`,
        0xc0,
        set,
        get,
        3000,
      );
      if (!hello.checksumOk) throw new Error("Recall handshake checksum invalid");
      const activeSlot = Math.max(1, Math.min(10, Number(hello.data[0] ?? (slot - 1)) + 1));
      await readActiveDeviceMemory(set, get, activeSlot, `recall slot ${activeSlot}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ lastError: message });
      appendLog(set, get, { dir: "ERR", label: `Recall slot ${slot} failed`, data: message });
    } finally {
      set({ recallBusy: false });
    }
  },

  savePresetToSlot: async (slotOneBased, preset) => {
    try {
      assertPermanentStoreReady(get);
      if (get().storeBusy || get().recallBusy) throw new Error("Device sedang menjalankan operasi slot lain.");
      clearPendingLiveWrites();
      if (heartbeatTimer) window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
      const slot = Math.max(1, Math.min(10, Math.round(Number(slotOneBased) || 1)));
      set({ storeBusy: true, storeProgress: `Preparing slot ${slot}`, lastError: null });
      await writePresetSlot(slot, preset, [0x00, 0x00, 0x00], set, get, false);
      set({ storeProgress: `Slot ${slot} saved`, lastError: null });
      appendLog(set, get, { dir: "SYS", label: `Save slot ${slot} complete`, data: `${DEVICE_SLOT_IMAGE_LENGTH} bytes committed permanently` });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ lastError: message, storeProgress: "Save failed" });
      appendLog(set, get, { dir: "ERR", label: "Save slot failed", data: message });
    } finally {
      set({ storeBusy: false });
      if (get().status === "connected") startHeartbeatLoop(set, get);
    }
  },

  massUploadSlots: async (slots) => {
    try {
      assertPermanentStoreReady(get);
      if (get().storeBusy || get().recallBusy) throw new Error("Device sedang menjalankan operasi slot lain.");
      const normalized = slots
        .map((item) => ({ slotOneBased: Math.max(1, Math.min(10, Math.round(Number(item.slotOneBased) || 1))), preset: item.preset }))
        .filter((item, index, all) => all.findIndex((candidate) => candidate.slotOneBased === item.slotOneBased) === index)
        .sort((a, b) => b.slotOneBased - a.slotOneBased);
      if (!normalized.length) throw new Error("Tidak ada preset PC untuk Mass Upload.");
      if (normalized.length > 10) throw new Error("Mass Upload maksimum 10 preset.");

      clearPendingLiveWrites();
      if (heartbeatTimer) window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
      set({ storeBusy: true, storeProgress: `Mass upload · ${normalized.length} slot`, lastError: null });

      let chain: DeviceStoreChain = [0x00, 0x00, 0x00];
      let completed = 0;
      for (const item of normalized) {
        set({ storeProgress: `Mass upload ${completed + 1}/${normalized.length} · slot ${item.slotOneBased}` });
        chain = await writePresetSlot(item.slotOneBased, item.preset, chain, set, get);
        completed += 1;
      }
      set({ storeBusy: false, storeProgress: `${completed} slot uploaded · refreshing slot 1` });
      appendLog(set, get, { dir: "SYS", label: "Mass upload committed", data: `${completed} slot · native order ${normalized.map((item) => item.slotOneBased).join("→")}` });
      await get().recallMode(1);
      set({ storeProgress: `${completed} slot uploaded`, lastError: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ lastError: message, storeProgress: "Mass upload failed" });
      appendLog(set, get, { dir: "ERR", label: "Mass upload failed", data: message });
    } finally {
      set({ storeBusy: false });
      if (get().status === "connected") startHeartbeatLoop(set, get);
    }
  },

  sendHeartbeat: async () => sendHeartbeatKeepAlive(set, get, "Manual heartbeat 0x1C"),
  sendHandshake: async () => enqueueWrite(buildHandshake(), "Handshake 0x3F", set, get),

  toggleMute: async () => {
    const next = !get().mute;
    set({ mute: next });
    await enqueueWrite(buildMute(next), next ? "Mute ON" : "Mute OFF", set, get);
  },

  sendEqBand: async (eqKey, bandIndexZeroBased, band) => {
    if (!isLiveWriteAllowed(set, get, `EQ ${eqKey} B${bandIndexZeroBased + 1}`)) return;
    if (EQ_SECTION_ID[eqKey] === undefined) {
      // Alt banks (mainAlt, surroundAlt, ...) have no verified live command —
      // notify once instead of erroring on every flush tick.
      if (!notedUnsupportedEqSections.has(eqKey)) {
        notedUnsupportedEqSections.add(eqKey);
        appendLog(set, get, { dir: "SYS", label: `EQ ${eqKey} file-only`, data: "section ini belum punya command live terverifikasi — edit tersimpan di preset, tidak dikirim ke device" });
      }
      return;
    }
    // Coalesced + throttled so DAW-style node dragging never floods the BT link.
    queueEqBandWrite(eqKey, bandIndexZeroBased, band, set, get);
  },

  sendPathUpdate: async (path, preset) => {
    if (!isLiveWriteAllowed(set, get, path)) return;
    try {
      const crossoverWrites = crossoverPathToWrites(path, preset);
      if (crossoverWrites) {
        for (const write of crossoverWrites) {
          if (!supportsCrossoverWrite(write.eqKey)) {
            if (!notedUnsupportedCrossoverSections.has(write.eqKey)) {
              notedUnsupportedCrossoverSections.add(write.eqKey);
              appendLog(set, get, { dir: "SYS", label: `Crossover ${write.eqKey} file-only`, data: "section ini belum punya command crossover live terverifikasi — edit tersimpan di preset, tidak dikirim ke device" });
            }
            continue;
          }
          queueLiveBlockWrite(
            `xover:${write.eqKey}:${write.kind}`,
            buildCrossoverWrite(write.eqKey, write.kind, write.hz, write.crossover, preset.system.deviceModeIndex),
            `Crossover ${write.eqKey} ${write.kind.toUpperCase()} · ${Math.round(write.hz)}Hz`,
            set,
            get,
          );
        }
        return;
      }

      const outputSection = outputPathToSection(path);
      if (outputSection) {
        queueLiveBlockWrite(
          `output:${outputSection}`,
          buildOutputBlock(outputSection, preset),
          `Output block ${outputSection} · ${describeLivePath(path)}`,
          set,
          get,
        );
        return;
      }
      if (path === "mic.eqLink") {
        queueLiveBlockWrite("mic:eqLink", buildMicEqLink(preset.mic.eqLink), `Mic EQ Link ${preset.mic.eqLink ? "ON" : "OFF"}`, set, get);
        return;
      }
      if (TOP_MUSIC_BLOCK_PATHS.has(path)) {
        await refreshDeviceScalars(set, get);
        queueLiveBlockWrite("top:music", buildTopMusicBlock(preset, deviceScalarCache), `Top Music block · ${describeLivePath(path)}`, set, get);
        return;
      }
      if (TOP_MIC_BLOCK_PATHS.has(path)) {
        await refreshDeviceScalars(set, get);
        queueLiveBlockWrite("top:mic", buildTopMicBlock(preset, deviceScalarCache), `Top Mic block · ${describeLivePath(path)}`, set, get);
        return;
      }
      if (TOP_EFFECT_BLOCK_PATHS.has(path)) {
        await refreshDeviceScalars(set, get);
        queueLiveBlockWrite("top:effect", buildTopEffectBlock(preset, deviceScalarCache), `Top Effect block · ${describeLivePath(path)}`, set, get);
        return;
      }
      appendLog(set, get, { dir: "SYS", label: `live path not mapped yet`, data: path });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ lastError: message });
      appendLog(set, get, { dir: "ERR", label: `unsupported live path: ${path}`, data: message });
    }
  },

  clearLog: () => set({ log: [] }),
}));


// ---------------------------------------------------------------------------
// Serial helpers (v0.7.7): these were referenced but missing in v0.7.6, which
// made Connect crash with a ReferenceError before any readback could happen.
// ---------------------------------------------------------------------------

function nowTs(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function appendLog(set: any, get: any, line: Omit<LiveLogLine, "ts">) {
  const entry: LiveLogLine = { ts: nowTs(), ...line };
  const log = [entry, ...get().log].slice(0, 160);
  set({ log });
}

async function writeRaw(frame: Uint8Array, label: string, set: any, get: any): Promise<void> {
  const h = hex(frame);
  if (bridgeWs && bridgeWs.readyState === WebSocket.OPEN) {
    // Native bridge owns the transport (and USB re-framing) on the Node side.
    set({ lastTx: h });
    appendLog(set, get, { dir: "TX", label: `${label} · bridge`, data: h });
    bridgeWs.send(JSON.stringify({ t: "tx", hex: Array.from(frame).map((b) => b.toString(16).padStart(2, "0")).join("") }));
    return;
  }
  if (hidDevice) {
    // USB HID transport: re-frame for USB (16-bit length) and pad to the
    // 64-byte interrupt report, exactly as in the native-app USB sniff.
    const usbFrame = toUsbFrame(frame);
    const uh = hex(usbFrame);
    set({ lastTx: uh });
    appendLog(set, get, { dir: "TX", label: `${label} · USB`, data: uh });
    // CMD 0x42 is 69 bytes on USB and must be sent as two consecutive
    // 64-byte HID reports (64 + 5), exactly as the native USBPcap trace.
    for (let offset = 0; offset < usbFrame.length; offset += HID_REPORT_SIZE) {
      const payload = new Uint8Array(HID_REPORT_SIZE);
      payload.set(usbFrame.slice(offset, offset + HID_REPORT_SIZE), 0);
      await hidDevice.sendReport(HID_REPORT_ID, payload);
    }
    return;
  }
  if (!writer) throw new Error("Serial writer not available (port closed?)");
  set({ lastTx: h });
  appendLog(set, get, { dir: "TX", label, data: h });
  await writer.write(frame);
}

function enqueueWrite(frame: Uint8Array, label: string, set: any, get: any): Promise<void> {
  const task = sendQueue.then(async () => {
    if (!writer && !hidDevice && !(bridgeWs && bridgeWs.readyState === WebSocket.OPEN)) return;
    try {
      await writeRaw(frame, label, set, get);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ lastError: message });
      appendLog(set, get, { dir: "ERR", label: `write failed: ${label}`, data: message });
    }
  });
  sendQueue = task.catch(() => {});
  return task;
}

async function closeInternal(): Promise<void> {
  readAbort = true;
  deviceScalarCache = null;
  deviceScalarCacheAt = 0;
  if (bridgeWs) {
    const ws = bridgeWs;
    bridgeWs = null;
    try { ws.send(JSON.stringify({ t: "disconnect" })); } catch {}
    try { ws.close(); } catch {}
  }
  heartbeatInFlight = false;
  if (hidDisconnectListener) {
    try { (globalThis.navigator as any)?.hid?.removeEventListener("disconnect", hidDisconnectListener); } catch {}
    hidDisconnectListener = null;
  }
  if (hidDevice) {
    try { if (hidInputListener) hidDevice.removeEventListener("inputreport", hidInputListener); } catch {}
    hidInputListener = null;
    try { await hidDevice.close(); } catch {}
    hidDevice = null;
  }
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (eqFlushTimer !== null) {
    window.clearTimeout(eqFlushTimer);
    eqFlushTimer = null;
  }
  if (blockFlushTimer !== null) {
    window.clearTimeout(blockFlushTimer);
    blockFlushTimer = null;
  }
  pendingEqWrites.clear();
  pendingBlockWrites.clear();
  clearWaiters("Serial port closed");
  rxBuffer = [];
  try { await reader?.cancel(); } catch {}
  try { reader?.releaseLock(); } catch {}
  reader = null;
  try { writer?.releaseLock(); } catch {}
  writer = null;
  try { await port?.close(); } catch {}
  port = null;
  sendQueue = Promise.resolve();
}


// ---------------------------------------------------------------------------
// Throttled block writes: native K500 edits send complete snapshots for Music,
// Mic and Output blocks. Range sliders can emit many changes while dragging, so
// keep only the latest frame per block. This expands live mapping without
// flooding BT SPP, and USB heartbeat remains independent/direct.
// ---------------------------------------------------------------------------

const BLOCK_SEND_INTERVAL_MS = 55;
let blockFlushTimer: number | null = null;
let lastBlockFlushAt = 0;
const pendingBlockWrites = new Map<string, { frame: Uint8Array; label: string }>();

function flushBlockWrites(set: any, get: any) {
  blockFlushTimer = null;
  lastBlockFlushAt = Date.now();
  if (get().status !== "connected" || !get().liveEnabled) {
    pendingBlockWrites.clear();
    return;
  }
  for (const { frame, label } of pendingBlockWrites.values()) {
    void enqueueWrite(frame, label, set, get);
  }
  pendingBlockWrites.clear();
}

function queueLiveBlockWrite(key: string, frame: Uint8Array, label: string, set: any, get: any) {
  pendingBlockWrites.set(key, { frame, label });
  if (blockFlushTimer !== null) return;
  const elapsed = Date.now() - lastBlockFlushAt;
  if (elapsed >= BLOCK_SEND_INTERVAL_MS) {
    flushBlockWrites(set, get);
  } else {
    blockFlushTimer = window.setTimeout(() => flushBlockWrites(set, get), BLOCK_SEND_INTERVAL_MS - elapsed);
  }
}

// ---------------------------------------------------------------------------
// Throttled EQ band writes: DAW-style node dragging produces dozens of updates
// per second, far more than the K500 BT SPP link can absorb. Coalesce to the
// latest value per band and flush at most every EQ_SEND_INTERVAL_MS with a
// trailing send, so the final drag position always reaches the device.
// ---------------------------------------------------------------------------

const EQ_SEND_INTERVAL_MS = 45;
let eqFlushTimer: number | null = null;
let lastEqFlushAt = 0;
const notedUnsupportedEqSections = new Set<string>();
const notedUnsupportedCrossoverSections = new Set<string>();
const pendingEqWrites = new Map<string, { eqKey: string; index: number; band: Pick<EqBand, "type" | "frequencyHz" | "q" | "gainDb"> }>();

function flushEqWrites(set: any, get: any) {
  eqFlushTimer = null;
  lastEqFlushAt = Date.now();
  if (get().status !== "connected" || !get().liveEnabled) {
    pendingEqWrites.clear();
    return;
  }
  for (const { eqKey, index, band } of pendingEqWrites.values()) {
    try {
      void enqueueWrite(
        buildEqWrite(eqKey, index, band),
        `EQ ${eqKey} B${index + 1} · ${Math.round(band.frequencyHz)}Hz ${band.gainDb >= 0 ? "+" : ""}${band.gainDb.toFixed(1)}dB Q${band.q}`,
        set,
        get,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      appendLog(set, get, { dir: "ERR", label: `EQ ${eqKey} B${index + 1}`, data: message });
    }
  }
  pendingEqWrites.clear();
}

function queueEqBandWrite(eqKey: string, index: number, band: Pick<EqBand, "type" | "frequencyHz" | "q" | "gainDb">, set: any, get: any) {
  pendingEqWrites.set(`${eqKey}:${index}`, { eqKey, index, band: { type: band.type, frequencyHz: band.frequencyHz, q: band.q, gainDb: band.gainDb } });
  if (eqFlushTimer !== null) return;
  const elapsed = Date.now() - lastEqFlushAt;
  if (elapsed >= EQ_SEND_INTERVAL_MS) {
    flushEqWrites(set, get);
  } else {
    eqFlushTimer = window.setTimeout(() => flushEqWrites(set, get), EQ_SEND_INTERVAL_MS - elapsed);
  }
}
