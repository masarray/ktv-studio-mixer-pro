import { create } from "zustand";
import type { EqBand, Preset } from "@/features/k500/types";
import { buildEqWrite, buildHeartbeat, buildHandshake, buildMicEqLink, buildMute, buildOutputBlock, buildReadBlock, buildTopEffectBlock, buildTopMicBlock, buildTopMusicBlock } from "@/features/k500/protocol/commands";
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
  log: LiveLogLine[];
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  setTransportMode: (mode: "bt" | "usb") => void;
  hydrateTransportMode: () => void;
  setLiveEnabled: (enabled: boolean) => void;
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

async function importLiveMemoryIntoStudio(memory: Uint8Array) {
  const { useStudio } = await import("@/features/k500/store");
  const copy = new Uint8Array(memory);
  await useStudio.getState().importLiveMemory(copy.buffer, "K500 DEVICE LIVE");
}

async function syncFromDevice(set: any, get: any) {
  appendLog(set, get, { dir: "SYS", label: "sync from device", data: "heartbeat + handshake + read active memory" });
  try {
    // Match the original Professional Audio System connect sequence:
    // 1) AA 01 1C E3 heartbeat/status
    // 2) AA 01 3F C0 handshake
    // 3) sequential 0x40 read blocks with mode byte 0x63
    await requestResponse(buildHeartbeat(), "Initial status 0x1C", 0xe3, set, get, 2500);
    await requestResponse(buildHandshake(), "Handshake 0x3F", 0xc0, set, get, 2500);

    const total = 0x03ab; // confirmed connect readback: 0x0000..0x03aa
    const block = 0x3a;
    const memory = new Uint8Array(total);

    for (let offset = 0; offset < total; offset += block) {
      const len = Math.min(block, total - offset);
      const resp = await requestResponse(buildReadBlock(offset, len), `Read 0x${offset.toString(16).padStart(4, "0")} len ${len}`, 0xbf, set, get, 2500);
      memory.set(resp.data.slice(0, len), offset);
      await sleep(35);
    }

    await importLiveMemoryIntoStudio(memory);
    set({ lastError: null });
    appendLog(set, get, { dir: "SYS", label: "sync complete", data: `${memory.length} bytes loaded into editor` });
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
  if (path.startsWith("outputs.sub.")) return "sub";
  return null;
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

async function probeK500(set: any, get: any, timeoutMs = 1500): Promise<boolean> {
  try {
    await requestResponse(buildHeartbeat(), "Probe heartbeat 0x1C", 0xe3, set, get, timeoutMs);
    return true;
  } catch {
    return false;
  }
}

function serialPortLabel(p: SerialPort): string {
  const info: any = p.getInfo?.() ?? {};
  if (info.bluetoothServiceClassId) return "KTV Bluetooth SPP";
  if (info.usbVendorId) return `USB ${info.usbVendorId.toString(16).padStart(4, "0")}:${(info.usbProductId ?? 0).toString(16).padStart(4, "0")}`;
  return "Serial port";
}

/** BT mode: silently probe every previously-granted port first (zero-dialog
 *  reconnect), then fall back to a chooser filtered to Bluetooth SPP only. */
async function connectBluetooth(set: any, get: any): Promise<boolean> {
  const serial = (globalThis.navigator as any).serial;

  const granted: SerialPort[] = await serial.getPorts().catch(() => []);
  if (granted.length) {
    appendLog(set, get, { dir: "SYS", label: "auto-scan", data: `probing ${granted.length} remembered port(s) for K500 signature` });
    for (let i = 0; i < granted.length; i++) {
      set({ portLabel: `Scanning ${i + 1}/${granted.length}...` });
      try {
        await openSerial(granted[i], set, get);
        if (await probeK500(set, get, 1400)) {
          set({ portLabel: `${serialPortLabel(granted[i])} · auto` });
          appendLog(set, get, { dir: "SYS", label: "K500 found", data: "auto-connected to remembered port (no chooser)" });
          return true;
        }
        appendLog(set, get, { dir: "SYS", label: `port ${i + 1} silent`, data: "no 0xE3 status reply, trying next" });
      } catch {
        // port busy or vanished — skip
      }
      await releaseSerialOnly();
    }
  }

  // First time (or device moved): one-time chooser, filtered to Bluetooth SPP
  // so USB-COM clutter is hidden. Browser security requires this single pick;
  // every later Connect is fully automatic via the granted-port scan above.
  appendLog(set, get, { dir: "SYS", label: "chooser", data: "pilih port KTV sekali saja — koneksi berikutnya otomatis" });
  let picked: SerialPort;
  try {
    picked = await serial.requestPort({ filters: [{ bluetoothServiceClassId: SPP_SERVICE_CLASS }] });
  } catch (err: any) {
    if (err?.name === "NotFoundError") throw err; // user cancelled
    // Older Chromium without BT service-class filters: show unfiltered list.
    picked = await serial.requestPort();
  }
  await openSerial(picked, set, get);
  if (!(await probeK500(set, get, 2000))) {
    await releaseSerialOnly();
    throw new Error("Port terbuka tapi tidak merespon protokol K500 (heartbeat 0x1C tanpa balasan 0xE3). Kemungkinan port SPP lain — klik Connect lagi dan pilih entri KTV_BT satunya.");
  }
  set({ portLabel: serialPortLabel(picked) });
  return true;
}

/** USB mode: the K500 enumerates as "USB HID DSP AUDIO" (VID 10C4 PID 0321).
 *  Auto-scan matches by VID/PID first, then verifies with the heartbeat probe
 *  — same identify-by-protocol rule as the BT path. */
async function connectUsbHid(set: any, get: any): Promise<boolean> {
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
    const ok = await probeK500(set, get, 1800);
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

  // 2) First time: chooser filtered to the DSP AUDIO identity only.
  appendLog(set, get, { dir: "SYS", label: "chooser USB", data: "pilih USB HID DSP AUDIO sekali saja — berikutnya otomatis" });
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
    const mode = get().transportMode;
    if (mode === "bt" && !serialSupported()) {
      const message = "Web Serial API is not available in this browser/session. Use Chrome or Edge on localhost and close the original K500 app.";
      set({ status: "unsupported", lastError: message });
      appendLog(set, get, { dir: "ERR", label: "web serial unavailable", data: message });
      try { window.alert(message); } catch {}
      return;
    }
    if (mode === "usb" && !hidSupported()) {
      const message = "WebHID API tidak tersedia di browser ini. Pakai Chrome/Edge, atau pindah ke mode BT.";
      set({ status: "unsupported", lastError: message });
      appendLog(set, get, { dir: "ERR", label: "webhid unavailable", data: message });
      return;
    }
    await closeInternal();
    set({ status: "connecting", lastError: null, portLabel: "Auto-scanning..." });
    try {
      if (mode === "bt") await connectBluetooth(set, get);
      else await connectUsbHid(set, get);

      set({ status: "connected", lastError: null });
      appendLog(set, get, { dir: "SYS", label: "connected", data: mode === "bt" ? "115200 8N1 · Bluetooth SPP" : "USB HID transport" });
      startHeartbeatLoop(set, get);
      await syncFromDevice(set, get);
    } catch (err) {
      await closeInternal();
      const cancelled = (err as any)?.name === "NotFoundError";
      const message = cancelled ? "Pemilihan port dibatalkan." : err instanceof Error ? err.message : String(err);
      set({ status: cancelled ? "disconnected" : "error", lastError: cancelled ? null : message, portLabel: "No port" });
      appendLog(set, get, { dir: cancelled ? "SYS" : "ERR", label: cancelled ? "chooser cancelled" : "connect failed", data: message });
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

  sendHeartbeat: async () => sendHeartbeatKeepAlive(set, get, "Manual heartbeat 0x1C"),
  sendHandshake: async () => enqueueWrite(buildHandshake(), "Handshake 0x3F", set, get),

  toggleMute: async () => {
    const next = !get().mute;
    set({ mute: next });
    await enqueueWrite(buildMute(next), next ? "Mute ON" : "Mute OFF", set, get);
  },

  sendEqBand: async (eqKey, bandIndexZeroBased, band) => {
    if (!get().liveEnabled || get().status !== "connected") return;
    // Coalesced + throttled so DAW-style node dragging never floods the BT link.
    queueEqBandWrite(eqKey, bandIndexZeroBased, band, set, get);
  },

  sendPathUpdate: async (path, preset) => {
    if (!get().liveEnabled || get().status !== "connected") return;
    try {
      const outputSection = outputPathToSection(path);
      if (outputSection) {
        await enqueueWrite(buildOutputBlock(outputSection, preset), `Output block ${outputSection}`, set, get);
        return;
      }
      if (path === "mic.eqLink") {
        await enqueueWrite(buildMicEqLink(preset.mic.eqLink), `Mic EQ Link ${preset.mic.eqLink ? "ON" : "OFF"}`, set, get);
        return;
      }
      if (path === "system.topMusicVol") {
        await enqueueWrite(buildTopMusicBlock(preset), "Top Music block", set, get);
        return;
      }
      if (path === "system.topMicVol") {
        await enqueueWrite(buildTopMicBlock(preset), "Top Mic block", set, get);
        return;
      }
      if (path === "system.topEffectVol") {
        await enqueueWrite(buildTopEffectBlock(preset), "Top Effect block", set, get);
        return;
      }
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
  if (hidDevice) {
    // USB HID transport: re-frame for USB (16-bit length) and pad to the
    // 64-byte interrupt report, exactly as in the native-app USB sniff.
    const usbFrame = toUsbFrame(frame);
    const payload = new Uint8Array(Math.max(HID_REPORT_SIZE, usbFrame.length));
    payload.set(usbFrame, 0);
    const uh = hex(usbFrame);
    set({ lastTx: uh });
    appendLog(set, get, { dir: "TX", label: `${label} · USB`, data: uh });
    await hidDevice.sendReport(HID_REPORT_ID, payload);
    return;
  }
  if (!writer) throw new Error("Serial writer not available (port closed?)");
  set({ lastTx: h });
  appendLog(set, get, { dir: "TX", label, data: h });
  await writer.write(frame);
}

function enqueueWrite(frame: Uint8Array, label: string, set: any, get: any): Promise<void> {
  const task = sendQueue.then(async () => {
    if (!writer && !hidDevice) return;
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
  pendingEqWrites.clear();
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
// Throttled EQ band writes: DAW-style node dragging produces dozens of updates
// per second, far more than the K500 BT SPP link can absorb. Coalesce to the
// latest value per band and flush at most every EQ_SEND_INTERVAL_MS with a
// trailing send, so the final drag position always reaches the device.
// ---------------------------------------------------------------------------

const EQ_SEND_INTERVAL_MS = 45;
let eqFlushTimer: number | null = null;
let lastEqFlushAt = 0;
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
