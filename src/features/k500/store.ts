import { create } from "zustand";
import {
  parseK500Preset,
  serializeK500Preset,
  SECTIONS_BY_PAGE,
  EQ_SECTIONS,
} from "./parser";
import type { Preset, PageKey, EqSection } from "./types";
import { clampFilterPathValue } from "./filterRanges";
import { crossoverFilterRaw } from "./filterTypes";
import { useK500Live } from "./live/liveStore";
import sampleUrl from "@/assets/sample.k500?url";
import { buildPresetFromLiveMemory } from "./live/liveMemory";

interface StudioState {
  preset: Preset | null;
  originalBytes: Uint8Array | null;
  sourceName: string;
  page: PageKey;
  eqKey: string;
  selectedBand: number;
  dirty: boolean;
  // actions
  importBuffer: (buffer: ArrayBuffer, name?: string) => void;
  importLiveMemory: (memory: ArrayBuffer, name?: string) => Promise<void>;
  importDefaultFlat: () => Promise<void>;
  exportPreset: () => void;
  setPage: (p: PageKey) => void;
  setEqKey: (k: string) => void;
  selectBand: (i: number) => void;
  setBandValue: (i: number, field: "type" | "frequencyHz" | "q" | "gainDb", value: any) => void;
  setBandValues: (i: number, values: Partial<{ type: string; frequencyHz: number; q: number; gainDb: number }>) => void;
  setPath: (path: string, value: any) => void;
  toggle: (path: string) => void;
  setMusicSource: (src: string) => void;
  setMusicKey: (k: number) => void;
  setName: (n: string) => void;
  copyMicAtoB: () => void;
  resetSelectedBand: () => void;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function getPath(obj: any, path: string) {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}
function setPathOn(obj: any, path: string, value: any) {
  const keys = path.split(".");
  const last = keys.pop()!;
  const parent = keys.reduce((acc, key) => acc[key], obj);
  const old = parent[last];
  parent[last] = typeof old === "number" ? Number(value) : value;
}

function eqKeysTouchedByPath(path: string): string[] {
  const eqMatch = /^eq\.([^.]+)\./.exec(path);
  if (eqMatch) return eqMatch[1] === "micA" || eqMatch[1] === "micB" ? ["micA", "micB"] : [eqMatch[1]];
  if (path === "mic.hpfHz" || path === "mic.lpfHz") return ["micA", "micB"];
  if (path === "outputs.sub.hpfHz" || path === "outputs.sub.lpfHz") return ["sub"];
  if (path === "effects.reverb.hpfHz" || path === "effects.reverb.lpfHz") return ["reverb"];
  if (path === "effects.echo.hpfHz" || path === "effects.echo.lpfHz") return ["echo"];
  return [];
}

/** Refresh only edited EQ section identities so the large graph does not
 * repaint when an unrelated mixer fader changes. */
function refreshEqSectionIdentity(preset: Preset, keys: string[]) {
  const unique = [...new Set(keys)].filter((key) => preset.eq[key]);
  if (!unique.length) return;
  const eq = { ...preset.eq };
  for (const key of unique) {
    const section = eq[key];
    eq[key] = { ...section, bands: [...section.bands], crossover: { ...section.crossover } };
  }
  preset.eq = eq;
}

function setFilterPathWithAliases(preset: Preset, path: string, value: any) {
  const typeMatch = /^eq\.([^.]+)\.crossover\.(hpType|lpType)$/.exec(path);
  if (typeMatch) {
    const eqKey = typeMatch[1];
    const field = typeMatch[2] as "hpType" | "lpType";
    const kind = field === "hpType" ? "hpf" : "lpf";
    const rawField = field === "hpType" ? "hpTypeRaw" : "lpTypeRaw";
    const section = preset.eq[eqKey];
    if (!section?.crossover) return;

    section.crossover[field] = String(value);
    section.crossover[rawField] = crossoverFilterRaw(kind, value, section.crossover[rawField]);

    // The native Mic filter is shared. Keep both PEQ views visually and
    // serially consistent when its type changes from either Mic A or Mic B.
    if (eqKey === "micA" || eqKey === "micB") {
      for (const key of ["micA", "micB"] as const) {
        preset.eq[key].crossover[field] = String(value);
        preset.eq[key].crossover[rawField] = crossoverFilterRaw(kind, value, preset.eq[key].crossover[rawField]);
      }
    }
    return;
  }

  const safeValue = clampFilterPathValue(path, value);
  setPathOn(preset, path, safeValue);

  const eqMatch = /^eq\.([^.]+)\.crossover\.(hpfHz|lpfHz)$/.exec(path);
  if (eqMatch) {
    const eqKey = eqMatch[1];
    const field = eqMatch[2] as "hpfHz" | "lpfHz";
    const numeric = Number(safeValue);

    if (eqKey === "micA" || eqKey === "micB") {
      preset.eq.micA.crossover[field] = numeric;
      preset.eq.micB.crossover[field] = numeric;
      preset.mic[field] = numeric;
      return;
    }
    if (eqKey === "sub") {
      preset.outputs.sub[field] = numeric;
      return;
    }
    if (eqKey === "reverb") {
      preset.effects.reverb[field] = numeric;
      return;
    }
    if (eqKey === "echo") {
      preset.effects.echo[field] = numeric;
      return;
    }
    return;
  }

  const sharedMatch = /^(mic|outputs\.sub|effects\.reverb|effects\.echo)\.(hpfHz|lpfHz)$/.exec(path);
  if (!sharedMatch) return;
  const owner = sharedMatch[1];
  const field = sharedMatch[2] as "hpfHz" | "lpfHz";
  const numeric = Number(safeValue);

  if (owner === "mic") {
    preset.eq.micA.crossover[field] = numeric;
    preset.eq.micB.crossover[field] = numeric;
  } else if (owner === "outputs.sub") {
    preset.eq.sub.crossover[field] = numeric;
  } else if (owner === "effects.reverb") {
    preset.eq.reverb.crossover[field] = numeric;
  } else if (owner === "effects.echo") {
    preset.eq.echo.crossover[field] = numeric;
  }
}


function encodeMusicSourceRaw(label: string): number {
  const map: Record<string, number> = { "Input 1": 0, "Input 2": 1, Bluetooth: 2, UDisk: 3, Digital: 4 };
  return map[label] ?? 2;
}

function clonePreset(preset: Preset): Preset {
  return structuredClone(preset);
}

function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function cloneEqBandForLive(band: EqSection["bands"][number]) {
  return { type: band.type, frequencyHz: band.frequencyHz, q: band.q, gainDb: band.gainDb };
}

function mirrorEqBand(target: EqSection["bands"][number] | undefined, source: EqSection["bands"][number]) {
  if (!target) return;
  target.type = source.type;
  target.typeRaw = source.typeRaw;
  target.frequencyHz = source.frequencyHz;
  target.q = source.q;
  target.gainDb = source.gainDb;
}

function applyMicEqLinkMirror(preset: Preset, eqKey: string, bandIndex: number, band: EqSection["bands"][number]) {
  const writes = [{ eqKey, band: cloneEqBandForLive(band) }];
  if (preset.mic.eqLink && (eqKey === "micA" || eqKey === "micB")) {
    const otherKey = eqKey === "micA" ? "micB" : "micA";
    const otherBand = preset.eq[otherKey]?.bands?.[bandIndex];
    mirrorEqBand(otherBand, band);
    if (otherBand) writes.push({ eqKey: otherKey, band: cloneEqBandForLive(otherBand) });
  }
  return writes;
}

function sendEqLiveWrites(writes: Array<{ eqKey: string; band: Pick<EqSection["bands"][number], "type" | "frequencyHz" | "q" | "gainDb"> }>, bandIndex?: number) {
  const selected = typeof bandIndex === "number" ? bandIndex : useStudio.getState().selectedBand;
  const live = useK500Live.getState();
  for (const write of writes) void live.sendEqBand(write.eqKey, selected, write.band);
}


function flattenPreset(preset: Preset): Preset {
  const freq10 = [80, 125, 250, 500, 1000, 2000, 4000, 6300, 10000, 12500];
  const freq7 = [80, 160, 315, 630, 1250, 2500, 8000];
  const freq5 = [125, 250, 1000, 2500, 8000];

  Object.values(preset.eq).forEach((section) => {
    const defaults = section.bands.length >= 10 ? freq10 : section.bands.length >= 7 ? freq7 : freq5;
    section.enabledFlag = 0;
    section.bands.forEach((band, idx) => {
      band.type = "P";
      band.typeRaw = 0;
      band.frequencyHz = defaults[idx] ?? 1000;
      band.q = 1;
      band.gainDb = 0;
    });

    // Keep crossover handles outside the audible area for a truly flat default view,
    // except subwoofer, where a realistic bass band limit is useful.
    section.crossover.lpTypeRaw = section.crossover.lpTypeRaw || 0x0302;
    section.crossover.hpTypeRaw = section.crossover.hpTypeRaw || 0x0402;
    section.crossover.lpType = section.crossover.lpType || "LP Butter 12";
    section.crossover.hpType = section.crossover.hpType || "HP Butter 12";
    section.crossover.hpfHz = section.key === "sub" || section.key === "subAlt" ? 40 : 20;
    section.crossover.lpfHz = section.key === "sub" || section.key === "subAlt" ? 120 : 20000;
  });

  preset.name = "DEFAULT FLAT";
  preset.checksumOk = true;

  // Critical: normalize back through the binary serializer/parser so every view,
  // graph, inspector and exported byte array reads the exact same flat state.
  const bytes = serializeK500Preset(structuredClone(preset));
  const reparsed = parseK500Preset(new Uint8Array(bytes).buffer);
  reparsed.name = "DEFAULT FLAT";
  reparsed.checksumOk = true;
  return reparsed;
}

export const useStudio = create<StudioState>((set, get) => ({
  preset: null,
  originalBytes: null,
  sourceName: "No preset loaded",
  page: "music",
  eqKey: "music",
  selectedBand: 0,
  dirty: false,

  importBuffer: (buffer, name = "Imported preset") => {
    const preset = parseK500Preset(buffer);
    set({
      preset,
      originalBytes: new Uint8Array(preset.bytes),
      sourceName: name,
      page: "music",
      eqKey: "music",
      selectedBand: 0,
      dirty: false,
    });
  },

  importLiveMemory: async (memory, name = "K500 DEVICE LIVE") => {
    const current = get().preset;
    let baseBytes: Uint8Array;
    if (current?.bytes?.length) {
      baseBytes = new Uint8Array(current.bytes);
    } else {
      const res = await fetch(sampleUrl);
      const buf = await res.arrayBuffer();
      baseBytes = new Uint8Array(buf);
    }
    const preset = buildPresetFromLiveMemory(baseBytes, new Uint8Array(memory));
    // Keep the user's current page/section/band selection so a device sync
    // doesn't yank them back to the Mic page mid-session.
    const { page, eqKey, selectedBand } = get();
    const keys = (SECTIONS_BY_PAGE as Record<string, string[]>)[page] || [];
    const nextEqKey = preset.eq[eqKey] ? eqKey : (keys[0] ?? "music");
    const bandCount = preset.eq[nextEqKey]?.bands?.length ?? 0;
    set({
      preset,
      originalBytes: new Uint8Array(preset.bytes),
      sourceName: name,
      page,
      eqKey: nextEqKey,
      selectedBand: Math.min(selectedBand, Math.max(0, bandCount - 1)),
      dirty: false,
    });
  },

  importDefaultFlat: async () => {
    if (get().preset) return;
    const res = await fetch(sampleUrl);
    const buf = await res.arrayBuffer();
    const preset = flattenPreset(parseK500Preset(buf));
    set({
      preset,
      originalBytes: new Uint8Array(preset.bytes),
      sourceName: "DEFAULT FLAT",
      page: "music",
      eqKey: "music",
      selectedBand: 0,
      dirty: false,
    });
  },

  exportPreset: () => {
    const { preset } = get();
    if (!preset) return;
    const bytes = serializeK500Preset(clonePreset(preset));
    const safe = (preset.name || "K500_PRESET").replace(/[^a-z0-9_-]+/gi, "_");
    downloadBytes(bytes, `${safe}.k500`);
    preset.bytes = bytes;
    preset.checksumOk = true;
    set({ preset: { ...preset }, dirty: false });
  },

  setPage: (page) => {
    const keys = (SECTIONS_BY_PAGE as Record<string, string[]>)[page] || [];
    let { eqKey } = get();
    if (keys.length && !keys.includes(eqKey)) eqKey = keys[0];
    set({ page, eqKey, selectedBand: 0 });
  },

  setEqKey: (eqKey) => set({ eqKey, selectedBand: 0 }),
  selectBand: (i) => set({ selectedBand: i }),

  setBandValue: (i, field, value) => {
    const { preset, eqKey } = get();
    if (!preset) return;
    const section = preset.eq[eqKey];
    const band = section?.bands?.[i];
    if (!band) return;
    if (field === "type") band.type = value;
    if (field === "frequencyHz") band.frequencyHz = clamp(Math.round(Number(value) || 20), 20, 20000);
    if (field === "q") band.q = clamp(Number(value) || 0.1, 0.1, 30);
    if (field === "gainDb") band.gainDb = clamp(Number(value) || 0, -24, 24);
    const liveWrites = applyMicEqLinkMirror(preset, eqKey, i, band);
    refreshEqSectionIdentity(preset, liveWrites.map((write) => write.eqKey));
    set({ preset: { ...preset }, dirty: true });
    sendEqLiveWrites(liveWrites, i);
  },

  // DAW-style drag updates: apply freq + gain (+ q/type) as ONE state update and
  // ONE live serial frame per tick instead of two, halving BT traffic while dragging.
  setBandValues: (i, values) => {
    const { preset, eqKey } = get();
    if (!preset) return;
    const band = preset.eq[eqKey]?.bands?.[i];
    if (!band) return;
    if (values.type !== undefined) band.type = values.type;
    if (values.frequencyHz !== undefined) band.frequencyHz = clamp(Math.round(Number(values.frequencyHz) || 20), 20, 20000);
    if (values.q !== undefined) band.q = clamp(Number(values.q) || 0.1, 0.1, 30);
    if (values.gainDb !== undefined) band.gainDb = clamp(Number(values.gainDb) || 0, -24, 24);
    const liveWrites = applyMicEqLinkMirror(preset, eqKey, i, band);
    refreshEqSectionIdentity(preset, liveWrites.map((write) => write.eqKey));
    set({ preset: { ...preset }, dirty: true });
    sendEqLiveWrites(liveWrites, i);
  },

  setPath: (path, value) => {
    const { preset } = get();
    if (!preset) return;
    setFilterPathWithAliases(preset, path, value);
    refreshEqSectionIdentity(preset, eqKeysTouchedByPath(path));
    set({ preset: { ...preset }, dirty: true });
    void useK500Live.getState().sendPathUpdate(path, preset);
  },

  toggle: (path) => {
    const { preset } = get();
    if (!preset) return;
    setPathOn(preset, path, !getPath(preset, path));
    set({ preset: { ...preset }, dirty: true });
    void useK500Live.getState().sendPathUpdate(path, preset);
  },

  setMusicSource: (src) => {
    const { preset } = get();
    if (!preset) return;
    preset.music.source = src;
    preset.music.sourceRaw = encodeMusicSourceRaw(src);
    set({ preset: { ...preset }, dirty: true });
    void useK500Live.getState().sendPathUpdate("music.source", preset);
  },

  setMusicKey: (k) => {
    const { preset } = get();
    if (!preset) return;
    preset.music.key = k;
    set({ preset: { ...preset }, dirty: true });
    void useK500Live.getState().sendPathUpdate("music.key", preset);
  },

  setName: (n) => {
    const { preset } = get();
    if (!preset) return;
    preset.name = n;
    set({ preset: { ...preset }, dirty: true });
  },

  copyMicAtoB: () => {
    const { preset } = get();
    if (!preset) return;
    preset.eq.micB.bands = structuredClone(preset.eq.micA.bands);
    preset.mic.eqLink = true;
    refreshEqSectionIdentity(preset, ["micB"]);
    set({ preset: { ...preset }, dirty: true });
  },

  resetSelectedBand: () => {
    const { preset, eqKey, selectedBand } = get();
    if (!preset) return;
    const band = preset.eq[eqKey]?.bands?.[selectedBand];
    if (!band) return;
    band.type = "P"; band.frequencyHz = 1000; band.q = 1; band.gainDb = 0;
    const liveWrites = applyMicEqLinkMirror(preset, eqKey, selectedBand, band);
    refreshEqSectionIdentity(preset, liveWrites.map((write) => write.eqKey));
    set({ preset: { ...preset }, dirty: true });
    sendEqLiveWrites(liveWrites, selectedBand);
  },
}));

export function changedByteCount(preset: Preset | null, original: Uint8Array | null): number {
  if (!preset || !original) return 0;
  try {
    const now = serializeK500Preset(clonePreset(preset));
    const max = Math.max(now.length, original.length);
    let changed = 0;
    for (let i = 0; i < max; i++) if ((now[i] ?? -1) !== (original[i] ?? -1)) changed++;
    return changed;
  } catch {
    return 0;
  }
}

export { EQ_SECTIONS, SECTIONS_BY_PAGE };
export type { EqSection };
