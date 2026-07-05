import { useCallback, useEffect, useMemo, useState } from "react";
import { useStudio } from "@/features/k500/store";
import { serializeK500Preset } from "@/features/k500/parser";
import { Panel, VerticalFader, Knob, NumberField, Toggle, LedReadout, SelectField } from "./primitives";
import { CompressorGraph } from "./CompressorGraph";
import { cn } from "@/lib/utils";

const fmtRelease = (v: number) => (v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(1)} s`);

function FaderRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("fader-row flex items-stretch gap-1.5 justify-around", className)}>{children}</div>;
}


function InlineSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  valueClassName,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  valueClassName?: string;
}) {
  const decimals = step < 1 ? 1 : 0;
  const normalized = Number.isFinite(Number(value)) ? Number(value) : min;
  const commit = (raw: number) => {
    const clamped = Math.max(min, Math.min(max, raw));
    const stepped = step >= 1 ? Math.round(clamped) : Math.round(clamped / step) * step;
    onChange(Number(stepped.toFixed(decimals)));
  };

  return (
    <label className="music-inline-slider grid grid-cols-[78px_1fr_74px] gap-2 items-center">
      <span className="eyebrow truncate">{label}</span>
      <input
        className="music-horizontal-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={normalized}
        onChange={(e) => commit(Number(e.target.value))}
        onWheel={(e) => {
          e.preventDefault();
          const dir = e.deltaY < 0 ? 1 : -1;
          commit(Number(normalized) + dir * step);
        }}
      />
      <span className={cn("music-inline-field", valueClassName)}>
        <input
          className="studio-input music-inline-input"
          type="number"
          min={min}
          max={max}
          step={step}
          value={decimals ? normalized.toFixed(decimals) : Math.round(normalized)}
          onChange={(e) => commit(Number(e.currentTarget.value))}
          onWheel={(e) => {
            e.preventDefault();
            const dir = e.deltaY < 0 ? 1 : -1;
            commit(Number(normalized) + dir * step);
          }}
        />
        {unit && <span>{unit}</span>}
      </span>
    </label>
  );
}

function CompressorPanel({
  title, pathPrefix, comp, includeGate = false, gateDb,
}: {
  title: string;
  pathPrefix: string;
  comp: { compThresholdDb: number; compRatio: number; attackMs: number; releaseSec: number };
  includeGate?: boolean;
  gateDb?: number;
}) {
  const setPath = useStudio((s) => s.setPath);
  return (
    <Panel
      eyebrow="Dynamics"
      title={title}
      className="rack-panel h-full"
      bodyClassName="rack-panel-body flex-1 min-h-0 flex items-center overflow-visible"
      right={
        <div className="flex items-center gap-1.5">
          <LedReadout value={`TH ${comp.compThresholdDb}`} unit="dB" size="sm" />
          <LedReadout value={`1:${comp.compRatio}`} size="sm" color="cyan" />
        </div>
      }
    >
      <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
        <CompressorGraph thresholdDb={comp.compThresholdDb} ratio={comp.compRatio} />
        <div className="flex gap-4">
          {includeGate && (
            <Knob label="GATE" value={gateDb ?? -60} min={-80} max={0} step={1} unit="dB"
              onChange={(v) => setPath(`${pathPrefix}.noiseGateDb`, v)} />
          )}
          <Knob label="THRES" value={comp.compThresholdDb} min={-50} max={0} step={1} unit="dB"
            onChange={(v) => setPath(`${pathPrefix}.compThresholdDb`, v)} />
          <Knob label="RATIO" value={comp.compRatio} min={1} max={100} step={1}
            onChange={(v) => setPath(`${pathPrefix}.compRatio`, v)}
            format={(v) => `1:${v}`} />
          <Knob label="ATTACK" value={comp.attackMs} min={1} max={100} step={1} unit="ms"
            onChange={(v) => setPath(`${pathPrefix}.attackMs`, v)} />
          <Knob label="RELEASE" value={comp.releaseSec} min={0.1} max={5} step={0.1} unit="s"
            onChange={(v) => setPath(`${pathPrefix}.releaseSec`, v)} format={fmtRelease} />
        </div>
      </div>
    </Panel>
  );
}

/* =================== MIC =================== */
export function MicPage() {
  const preset = useStudio((s) => s.preset)!;
  const setPath = useStudio((s) => s.setPath);
  const toggle = useStudio((s) => s.toggle);
  const p = preset.mic;
  return (
    <div className="grid grid-cols-[280px_1fr_240px] gap-3 h-full items-stretch">
      <Panel eyebrow="Input mixer" title="Mic Inputs" className="rack-panel h-full" bodyClassName="rack-panel-body flex-1 min-h-0 flex items-center overflow-visible">
        <FaderRow>
          <VerticalFader label="MIC A" value={p.micAVol} min={0} max={100} onChange={(v) => setPath("mic.micAVol", v)} active />
          <VerticalFader label="MIC B" value={p.micBVol} min={0} max={100} onChange={(v) => setPath("mic.micBVol", v)} />
          <VerticalFader label="FBX" value={0} min={0} max={20} onChange={() => {}} disabled badge="read-only" />
        </FaderRow>
      </Panel>
      <CompressorPanel title="Vocal Dynamics" pathPrefix="mic" comp={p} includeGate gateDb={p.noiseGateDb} />
      <Panel eyebrow="Filters" title="Band Limits" className="rack-panel h-full">
        <div className="grid grid-cols-1 gap-3">
          <NumberField label="HPF" unit="Hz" min={20} max={1000} value={p.hpfHz} onChange={(v) => setPath("mic.hpfHz", v)} />
          <NumberField label="LPF" unit="Hz" min={1000} max={20000} value={p.lpfHz} onChange={(v) => setPath("mic.lpfHz", v)} />
          <Toggle label="Mic EQ Link A↔B" value={p.eqLink} onChange={() => toggle("mic.eqLink")} />
        </div>
      </Panel>
    </div>
  );
}

/* =================== MUSIC =================== */
export function MusicPage() {
  const preset = useStudio((s) => s.preset)!;
  const setPath = useStudio((s) => s.setPath);
  const setMusicSource = useStudio((s) => s.setMusicSource);
  const setMusicKey = useStudio((s) => s.setMusicKey);
  const p = preset.music;
  const musicEq = preset.eq.music;
  const c = musicEq.crossover;
  const sources: [string, string, keyof typeof p][] = [
    ["Input 1", "IN 1", "input1GainDb"],
    ["Input 2", "IN 2", "input2GainDb"],
    ["Bluetooth", "BT", "btGainDb"],
    ["UDisk", "UDISK", "uDiskGainDb"],
    ["Digital", "DIG", "digitalGainDb"],
  ];
  const steps = Array.from({ length: 15 }, (_, i) => i - 7);
  const keyLabel = (n: number) => n < 0 ? `♭${Math.abs(n)}` : n > 0 ? `♯${n}` : "0";

  return (
    <div className="music-page grid grid-cols-[minmax(520px,1fr)_278px_260px] gap-3 h-full items-stretch">
      <Panel eyebrow="Source Router" title="Music Input" className="rack-panel h-full" bodyClassName="rack-panel-body flex-1 min-h-0 flex items-center overflow-visible">
        <FaderRow className="w-full justify-evenly gap-3">
          {sources.map(([src, label, field]) => (
            <div key={src} className="flex flex-col items-stretch gap-2">
              <button
                onClick={() => setMusicSource(src)}
                className={cn("chrome-btn px-2 py-1 text-[10px] font-display tracking-wider", p.source === src && "chrome-btn-active")}
              >
                {label}
              </button>
              <VerticalFader
                label={label}
                value={p[field] as number}
                min={-12}
                max={12}
                unit="dB"
                onChange={(v) => setPath(`music.${String(field)}`, v)}
                active={p.source === src}
              />
            </div>
          ))}
        </FaderRow>
      </Panel>

      <Panel eyebrow="Karaoke Key" title="Pitch Shifter" className="rack-panel h-full" right={<LedReadout value={p.key === 0 ? "ORIG" : keyLabel(p.key)} color="cyan" />}>
        <div className="grid grid-cols-5 gap-1.5 mb-3">
          {steps.map((step) => (
            <button key={step} onClick={() => setMusicKey(step)} className={cn("chrome-btn py-2 text-xs font-mono", Number(p.key) === step && "chrome-btn-active")}>
              {keyLabel(step)}
            </button>
          ))}
        </div>
        <div className="music-filter-stack grid gap-2">
          <InlineSlider label="Noise Gate" value={p.noiseGateDb ?? -70} min={-80} max={0} unit="dB" onChange={(v) => setPath("music.noiseGateDb", v)} />
          <InlineSlider label="Bass" value={p.bassDb ?? 0} min={-12} max={12} step={0.5} unit="dB" onChange={(v) => setPath("music.bassDb", v)} />
          <InlineSlider label="Mid" value={p.midDb ?? 0} min={-12} max={12} step={0.5} unit="dB" onChange={(v) => setPath("music.midDb", v)} />
          <InlineSlider label="Mid Freq" value={p.midFreqHz ?? 1000} min={100} max={8000} unit="Hz" onChange={(v) => setPath("music.midFreqHz", v)} />
          <InlineSlider label="Treble" value={p.trebleDb ?? 0} min={-12} max={12} step={0.5} unit="dB" onChange={(v) => setPath("music.trebleDb", v)} />
        </div>
      </Panel>

      <Panel eyebrow="Filters" title="HPF / LPF" className="rack-panel music-filter-panel h-full" bodyClassName="music-filter-panel-body flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
        <InlineSlider label="LPF" value={c.lpfHz} min={1000} max={20000} unit="Hz" onChange={(v) => setPath("eq.music.crossover.lpfHz", v)} />
        <SelectField label="LP Type" value={c.lpType} options={["LP Butter 12", "LP Butter 24", "LP Bessel 12", "LP Bessel 24", "LP LR 24", "Butter 12", c.lpType].filter((v, i, a) => v && a.indexOf(v) === i)} onChange={(v) => setPath("eq.music.crossover.lpType", v)} />
        <InlineSlider label="HPF" value={c.hpfHz} min={20} max={2000} unit="Hz" onChange={(v) => setPath("eq.music.crossover.hpfHz", v)} />
        <SelectField label="HP Type" value={c.hpType} options={["HP Butter 12", "HP Butter 24", "HP Bessel 12", "HP Bessel 24", "HP LR 24", "Butter 12", c.hpType].filter((v, i, a) => v && a.indexOf(v) === i)} onChange={(v) => setPath("eq.music.crossover.hpType", v)} />
      </Panel>
    </div>
  );
}

/* =================== OUTPUT (main/surround/center/sub) =================== */
type OutKey = "main" | "surround" | "center" | "sub";
export function OutputPage({ which }: { which: OutKey }) {
  const preset = useStudio((s) => s.preset)!;
  const setPath = useStudio((s) => s.setPath);
  const o = preset.outputs[which] as any;

  const title = which === "main" ? "Main Bus" : which === "surround" ? "Surround Bus" : which === "center" ? "Center Bus" : "Subwoofer Bus";
  const eyebrow = which === "main" ? "front output" : which === "surround" ? "rear field" : which === "center" ? "vocal anchor" : "bass management";

  const faders =
    which === "main" || which === "surround"
      ? [
          { label: "L", path: `outputs.${which}.lVolDb`, value: o.lVolDb, min: -37.5, max: 24, step: 0.5, unit: "dB" },
          { label: "R", path: `outputs.${which}.rVolDb`, value: o.rVolDb, min: -37.5, max: 24, step: 0.5, unit: "dB" },
          { label: "MIC", path: `outputs.${which}.micDirect`, value: o.micDirect, min: 0, max: 100, step: 1, unit: "%" },
          { label: "MUSIC", path: `outputs.${which}.musicLevel`, value: o.musicLevel, min: 0, max: 100, step: 1, unit: "%" },
          { label: "REV", path: `outputs.${which}.reverbLevel`, value: o.reverbLevel, min: 0, max: 100, step: 1, unit: "%" },
          { label: "ECHO", path: `outputs.${which}.echoLevel`, value: o.echoLevel, min: 0, max: 100, step: 1, unit: "%" },
        ]
      : [
          { label: which === "center" ? "CTR" : "SUB", path: `outputs.${which}.outputVolDb`, value: o.outputVolDb, min: -37.5, max: 24, step: 0.5, unit: "dB" },
          { label: "MIC", path: `outputs.${which}.micDirect`, value: o.micDirect, min: 0, max: 100, step: 1, unit: "%" },
          { label: "MUSIC", path: `outputs.${which}.musicLevel`, value: o.musicLevel, min: 0, max: 100, step: 1, unit: "%" },
          { label: "REV", path: `outputs.${which}.reverbLevel`, value: o.reverbLevel, min: 0, max: 100, step: 1, unit: "%" },
          { label: "ECHO", path: `outputs.${which}.echoLevel`, value: o.echoLevel, min: 0, max: 100, step: 1, unit: "%" },
        ];

  // Filters
  const filters = (() => {
    if (which === "main") {
      const c = preset.eq.main.crossover;
      return [
        { label: "HPF", path: "eq.main.crossover.hpfHz", value: c.hpfHz, min: 20, max: 1000 },
        { label: "LPF", path: "eq.main.crossover.lpfHz", value: c.lpfHz, min: 2000, max: 20000 },
      ];
    }
    if (which === "surround") {
      const c = preset.eq.surround.crossover;
      return [
        { label: "L Delay", unit: "ms", path: "outputs.surround.lDelayMs", value: o.lDelayMs, min: 0, max: 50 },
        { label: "R Delay", unit: "ms", path: "outputs.surround.rDelayMs", value: o.rDelayMs, min: 0, max: 50 },
        { label: "HPF", path: "eq.surround.crossover.hpfHz", value: c.hpfHz, min: 20, max: 2000 },
        { label: "LPF", path: "eq.surround.crossover.lpfHz", value: c.lpfHz, min: 1000, max: 20000 },
      ];
    }
    if (which === "center") {
      const c = preset.eq.center.crossover;
      return [
        { label: "HPF", path: "eq.center.crossover.hpfHz", value: c.hpfHz, min: 20, max: 2000 },
        { label: "LPF", path: "eq.center.crossover.lpfHz", value: c.lpfHz, min: 1000, max: 20000 },
      ];
    }
    return [
      { label: "HPF", path: "outputs.sub.hpfHz", value: o.hpfHz, min: 20, max: 300 },
      { label: "LPF", path: "outputs.sub.lpfHz", value: o.lpfHz, min: 40, max: 500 },
    ];
  })();

  return (
    <div className="grid grid-cols-[1fr_1fr_280px] gap-3 h-full items-stretch">
      <Panel eyebrow={eyebrow} title={title} className="rack-panel h-full" bodyClassName="rack-panel-body flex-1 min-h-0 flex items-center overflow-visible">
        <FaderRow>
          {faders.map((f) => (
            <VerticalFader key={f.label} label={f.label} value={f.value} min={f.min} max={f.max} step={f.step} unit={f.unit}
              onChange={(v) => setPath(f.path, v)} />
          ))}
        </FaderRow>
      </Panel>
      <CompressorPanel title="Output Compressor" pathPrefix={`outputs.${which}`} comp={o} />
      <Panel eyebrow="Crossover" title="Band Limits / Delay" className="rack-panel h-full">
        <div className="grid grid-cols-1 gap-3">
          {filters.map((f) => (
            <NumberField key={f.label} label={f.label} unit={(f as any).unit || "Hz"} min={f.min} max={f.max} value={f.value}
              onChange={(v) => setPath(f.path, v)} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* =================== REVERB =================== */
export function ReverbPage() {
  const preset = useStudio((s) => s.preset)!;
  const setPath = useStudio((s) => s.setPath);
  const r = preset.effects.reverb;
  return (
    <div className="grid grid-cols-[1fr_320px] gap-3 h-full items-stretch">
      <Panel eyebrow="Room engine" title="Reverb" className="rack-panel h-full" bodyClassName="rack-panel-body flex-1 min-h-0 flex items-center overflow-visible">
        <FaderRow>
          <VerticalFader label="LEVEL" value={r.level} min={0} max={100} unit="%" onChange={(v) => setPath("effects.reverb.level", v)} active />
          <VerticalFader label="DECAY" value={r.decayMs} min={100} max={5000} unit="ms" onChange={(v) => setPath("effects.reverb.decayMs", v)} />
          <VerticalFader label="PRE" value={r.predelayMs} min={0} max={300} unit="ms" onChange={(v) => setPath("effects.reverb.predelayMs", v)} />
        </FaderRow>
      </Panel>
      <Panel eyebrow="Effect filters" title="Tone" className="rack-panel h-full">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="HPF" unit="Hz" min={20} max={2000} value={r.hpfHz} onChange={(v) => setPath("effects.reverb.hpfHz", v)} />
          <NumberField label="LPF" unit="Hz" min={1000} max={20000} value={r.lpfHz} onChange={(v) => setPath("effects.reverb.lpfHz", v)} />
        </div>
      </Panel>
    </div>
  );
}

/* =================== ECHO =================== */
export function EchoPage() {
  const preset = useStudio((s) => s.preset)!;
  const setPath = useStudio((s) => s.setPath);
  const e = preset.effects.echo;
  return (
    <div className="grid grid-cols-[1fr_320px] gap-3 h-full items-stretch">
      <Panel eyebrow="Delay engine" title="Echo" className="rack-panel h-full" bodyClassName="rack-panel-body flex-1 min-h-0 flex items-center overflow-visible">
        <FaderRow>
          <VerticalFader label="LEVEL" value={e.level} min={0} max={100} unit="%" onChange={(v) => setPath("effects.echo.level", v)} active />
          <VerticalFader label="REPEAT" value={e.repeat} min={0} max={100} onChange={(v) => setPath("effects.echo.repeat", v)} />
          <VerticalFader label="DELAY" value={e.leftDelayMs} min={0} max={1000} unit="ms" onChange={(v) => setPath("effects.echo.leftDelayMs", v)} />
        </FaderRow>
      </Panel>
      <Panel eyebrow="Delay filters" title="Tone" className="rack-panel h-full">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="HPF" unit="Hz" min={20} max={2000} value={e.hpfHz} onChange={(v) => setPath("effects.echo.hpfHz", v)} />
          <NumberField label="LPF" unit="Hz" min={1000} max={20000} value={e.lpfHz} onChange={(v) => setPath("effects.echo.lpfHz", v)} />
        </div>
      </Panel>
    </div>
  );
}

/* =================== SYSTEM =================== */
type PcPresetItem = {
  slot: number;
  file: string;
  name: string;
  size: number;
  mtimeMs: number;
};

type BridgeMessage = Record<string, unknown>;

const BRIDGE_URL = "ws://127.0.0.1:8500/k500";

function makeBridgeId() {
  return `ui-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function bridgeRequest<T extends BridgeMessage>(payload: BridgeMessage, expectedType: string, timeoutMs = 3200): Promise<T> {
  if (typeof window === "undefined") return Promise.reject(new Error("Bridge hanya tersedia di client."));
  return new Promise((resolve, reject) => {
    let ws: WebSocket;
    const id = makeBridgeId();
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      try { ws.close(); } catch {}
      fn();
    };
    const timer = window.setTimeout(() => finish(() => reject(new Error("Native bridge tidak merespon."))), timeoutMs);
    try {
      ws = new WebSocket(BRIDGE_URL);
    } catch (err) {
      window.clearTimeout(timer);
      reject(err);
      return;
    }
    ws.onopen = () => ws.send(JSON.stringify({ ...payload, id }));
    ws.onerror = () => finish(() => reject(new Error("Native bridge offline. Jalankan npm run dev / npm run bridge.")));
    ws.onmessage = (ev) => {
      let msg: any;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      if (msg.id && msg.id !== id) return;
      if (msg.t === "error") finish(() => reject(new Error(String(msg.msg || "Bridge error"))));
      if (msg.t === expectedType) finish(() => resolve(msg as T));
    };
  });
}

function hexToArrayBuffer(raw: string): ArrayBuffer {
  const clean = raw.replace(/\s+/g, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes.buffer;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function safePresetFileName(name: string) {
  const base = String(name || "K500_PRESET")
    .replace(/[^a-z0-9 _-]+/gi, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 48) || "K500_PRESET";
  return base.toLowerCase().endsWith(".k500") ? base : `${base}.k500`;
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size)) return "";
  if (size < 1024) return `${size} B`;
  return `${(size / 1024).toFixed(1)} KB`;
}

function SystemButton({
  children,
  active = false,
  disabled = false,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={cn("chrome-btn system-btn px-3 py-1.5 text-[11px] font-display", active && "chrome-btn-active")}
    >
      {children}
    </button>
  );
}

function SystemTextField({
  label,
  value,
  defaultValue,
  onChange,
  disabled = false,
  type = "text",
}: {
  label: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (v: string) => void;
  disabled?: boolean;
  type?: "text" | "password" | "number";
}) {
  return (
    <label className="system-field">
      <span>{label}</span>
      <input
        className="studio-input system-input"
        type={type}
        value={value as any}
        defaultValue={defaultValue as any}
        disabled={disabled}
        onChange={(e) => onChange?.(e.currentTarget.value)}
      />
    </label>
  );
}

function SystemCheck({
  label,
  defaultChecked = false,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  defaultChecked?: boolean;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label className={cn("system-check", disabled && "opacity-45")}>
      <input
        type="checkbox"
        checked={checked}
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        disabled={disabled}
        readOnly={checked !== undefined && !onChange}
        onChange={(e) => onChange?.(e.currentTarget.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

const FALLBACK_SYSTEM_MODE_NAMES = [
  "ARTIST GEN3 ARI",
  "PODCAST REBORN",
  "DANGDUT GEN3 ARI",
  "KARAOKE ARTIST",
  "AKUSTIK GEN3 ARI",
  "IMAM QORI GEN 3",
  "JAZZ GEN3 ARI",
  "ROCK GEN3 ARI",
  "MC CERAMAH GEN 3",
  "ADZAN MEKAH GEN3",
];

function normalizeModeName(name: string) {
  return String(name || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function usePcPresetLibrary() {
  const importBuffer = useStudio((state) => state.importBuffer);
  const exportPreset = useStudio((state) => state.exportPreset);
  const preset = useStudio((state) => state.preset);
  const [items, setItems] = useState<PcPresetItem[]>([]);
  const [root, setRoot] = useState<string>("");
  const [status, setStatus] = useState("Scanning PC preset root...");
  const [busyFile, setBusyFile] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("Scanning PC preset root...");
    try {
      const msg = await bridgeRequest<{ t: "pcPresets"; root: string; items: PcPresetItem[] }>({ t: "listPcPresets" }, "pcPresets");
      setItems(msg.items || []);
      setRoot(msg.root || "");
      setStatus((msg.items || []).length ? `${msg.items.length} preset file ditemukan` : "Tidak ada file .k500 di root aplikasi");
    } catch (err) {
      setItems([]);
      setRoot("");
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const load = useCallback(async (file: string) => {
    setBusyFile(file);
    setStatus(`Loading ${file}...`);
    try {
      const msg = await bridgeRequest<{ t: "pcPresetBytes"; file: string; name: string; hex: string }>({ t: "readPcPreset", file }, "pcPresetBytes", 5000);
      importBuffer(hexToArrayBuffer(msg.hex), msg.file || file);
      setStatus(`Loaded ${msg.file || file}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyFile(null);
    }
  }, [importBuffer]);

  const saveCurrent = useCallback(async () => {
    if (!preset) return;
    const file = safePresetFileName(preset.name || "K500_PRESET");
    setBusyFile(file);
    setStatus(`Saving ${file}...`);
    try {
      const bytes = serializeK500Preset(structuredClone(preset));
      const msg = await bridgeRequest<{ t: "pcPresetSaved"; file: string; root: string; items: PcPresetItem[] }>({
        t: "savePcPreset",
        file,
        hex: bytesToHex(bytes),
      }, "pcPresetSaved", 5000);
      setItems(msg.items || []);
      setRoot(msg.root || root);
      setStatus(`Saved ${msg.file}`);
    } catch (err) {
      // Browser/Electron-web fallback: still allow the user to save the preset.
      setStatus(err instanceof Error ? `${err.message}; fallback download dipakai` : "Bridge save gagal; fallback download dipakai");
      exportPreset();
    } finally {
      setBusyFile(null);
    }
  }, [exportPreset, preset, root]);

  return { items, root, status, busyFile, refresh, load, saveCurrent };
}

export function SystemPage() {
  const preset = useStudio((s) => s.preset)!;
  const sourceName = useStudio((s) => s.sourceName);
  const setPath = useStudio((s) => s.setPath);
  const setName = useStudio((s) => s.setName);
  const s = preset.system;
  const pc = usePcPresetLibrary();
  const modeNames = useMemo(() => {
    const deviceNames = Array.isArray(s.deviceModeNames) ? s.deviceModeNames : [];
    return Array.from({ length: 10 }, (_, idx) => {
      const fromDevice = String(deviceNames[idx] || "").trim();
      const fromFallback = FALLBACK_SYSTEM_MODE_NAMES[idx] || `PRESET ${idx + 1}`;
      return fromDevice || fromFallback;
    });
  }, [s.deviceModeNames]);
  const activeModeIndex = Math.min(Math.max(Number(s.deviceModeIndex || 4), 1), 10);
  const [selectedModeIndex, setSelectedModeIndex] = useState(activeModeIndex);

  useEffect(() => {
    setSelectedModeIndex(activeModeIndex);
  }, [activeModeIndex, modeNames.join("|")]);

  const selectedModeName = modeNames[selectedModeIndex - 1] || preset.name || "KARAOKE ARTIST";
  const activeModeName = modeNames[activeModeIndex - 1] || preset.name || "KARAOKE ARTIST";
  const selectedPcFile = pc.items.find((item) => normalizeModeName(item.file) === normalizeModeName(sourceName));

  return (
    <div className="system-page h-full min-h-0 grid gap-3 overflow-hidden">
      <Panel
        eyebrow="PC Mode"
        title="Preset Files"
        className="system-pc-panel h-full min-h-0"
        bodyClassName="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden"
      >
        <div className="system-panel-summary shrink-0">
          <div className="min-w-0">
            <div className="font-display led-cyan text-sm font-semibold truncate">PC PRESET ROOT</div>
            <div className="eyebrow mt-1 truncate" title={pc.root || pc.status}>{pc.root || pc.status}</div>
          </div>
          <SystemButton active onClick={pc.refresh}>Refresh</SystemButton>
        </div>

        <div className="system-preset-list system-pc-list panel-inset flex-1 min-h-0 overflow-y-auto p-2">
          {pc.items.length ? pc.items.map((item) => {
            const loaded = selectedPcFile?.file === item.file || normalizeModeName(sourceName) === normalizeModeName(item.file);
            return (
              <button
                type="button"
                key={item.file}
                className={cn("system-preset-row system-pc-row", loaded && "active loaded")}
                onClick={() => void pc.load(item.file)}
                title={`${item.file} · ${formatFileSize(item.size)}`}
              >
                <span className="slot">{item.slot}</span>
                <span className="name">{item.name || item.file}</span>
                {pc.busyFile === item.file ? <span className="tag">LOAD</span> : loaded ? <span className="tag">LOADED</span> : <span className="file-ext">.K500</span>}
              </button>
            );
          }) : (
            <div className="system-empty-state">
              <div className="font-display led-amber">NO PC PRESET FILE</div>
              <p>{pc.status}</p>
              <p>Letakkan file <b>.k500</b> satu folder dengan app/bridge root agar muncul di sini.</p>
            </div>
          )}
        </div>

        <div className="system-status-line shrink-0 truncate" title={pc.status}>{pc.status}</div>
        <div className="grid grid-cols-3 gap-2 shrink-0">
          <SystemButton onClick={pc.saveCurrent}>Save to PC</SystemButton>
          <SystemButton disabled title="Upload permanen ke device belum diaktifkan sampai command store diverifikasi.">Upload to device</SystemButton>
          <SystemButton disabled title="Mass upload belum diaktifkan sampai command store/slot diverifikasi.">Mass upload</SystemButton>
        </div>
      </Panel>

      <Panel
        eyebrow="Equipment / Device Mode"
        title="Device Preset Slots"
        className="system-device-panel h-full min-h-0"
        bodyClassName="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden"
      >
        <div className="system-device-titlebar shrink-0">
          <div className="font-display led-cyan text-sm font-semibold truncate">{activeModeIndex} · {activeModeName}</div>
        </div>

        <div className="system-preset-list system-device-list panel-inset flex-1 min-h-0 overflow-hidden p-2">
          {modeNames.map((name, idx) => {
            const slot = idx + 1;
            const active = slot === activeModeIndex || normalizeModeName(name) === normalizeModeName(preset.name);
            const selected = slot === selectedModeIndex;
            return (
              <button
                type="button"
                key={`${slot}-${name}`}
                className={cn("system-preset-row system-device-row", selected && "selected", active && "active")}
                onClick={() => setSelectedModeIndex(slot)}
              >
                <span className="slot">{slot}</span>
                <span className="name">{name}</span>
                {active ? <span className="tag">ACTIVE</span> : selected ? <span className="tag subdued">SELECT</span> : <span />}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-[86px_1fr] gap-2 shrink-0 items-end">
          <SystemTextField label="Slot" value={selectedModeIndex} disabled />
          <SystemTextField label="Name" value={selectedModeName} onChange={(v) => setName(v)} />
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <SystemCheck label="Use init vol" />
          <SystemCheck label="USB" checked />
          <SystemCheck label="BT" />
        </div>
        <div className="grid grid-cols-3 gap-2 shrink-0">
          <SystemButton disabled title="Recall slot permanen belum diaktifkan sampai command native diverifikasi.">Recall</SystemButton>
          <SystemButton disabled title="Save slot permanen belum diaktifkan sampai command native diverifikasi.">Save</SystemButton>
          <SystemButton disabled title="Reset all setting belum diaktifkan sampai command native diverifikasi.">Reset all</SystemButton>
        </div>
      </Panel>

      <div className="system-side-stack min-h-0 grid gap-3 overflow-hidden">
        <Panel eyebrow="Bluetooth" title="BT Name" className="system-side-card min-h-0" bodyClassName="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
          <SystemTextField label="BT Name" value={s.btName || ""} onChange={(v) => setPath("system.btName", v)} />
          <SystemTextField label="BLE Name" value={s.bleName || ""} onChange={(v) => setPath("system.bleName", v)} />
          <div className="grid grid-cols-2 gap-2 mt-auto">
            <SystemButton>Modify</SystemButton>
            <SystemButton>Reset</SystemButton>
          </div>
        </Panel>

        <Panel eyebrow="Access" title="Lock / Admin" className="system-side-card min-h-0" bodyClassName="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
          <div className="grid grid-cols-2 gap-2">
            <SystemTextField label="Lock Key" type="password" defaultValue="0000" />
            <SystemTextField label="Admin" type="password" defaultValue="0000" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <SystemCheck label="Unlock" defaultChecked />
            <SystemCheck label="Lock" />
            <SystemCheck label="Admin" defaultChecked />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2 mt-auto items-end">
            <SystemTextField label="New Password" type="password" defaultValue="" />
            <SystemButton disabled>Modify</SystemButton>
          </div>
        </Panel>
      </div>

      <Panel
        eyebrow="Safe Boot"
        title="Startup Limits"
        className="system-startup-panel h-full min-h-0"
        bodyClassName="rack-panel-body flex-1 min-h-0 flex items-center overflow-visible"
      >
        <FaderRow className="w-full justify-evenly gap-4">
          <VerticalFader label="MUSIC INIT" value={s.musicInitVol} min={0} max={84} onChange={(v) => setPath("system.musicInitVol", v)} active height={150} />
          <VerticalFader label="MUSIC MAX" value={s.musicMaxVol} min={0} max={84} onChange={(v) => setPath("system.musicMaxVol", v)} height={150} />
          <VerticalFader label="MIC INIT" value={s.micInitVol} min={0} max={84} onChange={(v) => setPath("system.micInitVol", v)} height={150} />
          <VerticalFader label="MIC MAX" value={s.micMaxVol} min={0} max={84} onChange={(v) => setPath("system.micMaxVol", v)} height={150} />
          <VerticalFader label="EFFECT INIT" value={s.effectInitLevel} min={0} max={84} onChange={(v) => setPath("system.effectInitLevel", v)} height={150} />
        </FaderRow>
      </Panel>

      <Panel
        eyebrow="USB / UDisk"
        title="Recording Levels"
        className="system-record-panel h-full min-h-0"
        bodyClassName="rack-panel-body flex-1 min-h-0 flex items-center overflow-visible"
      >
        <FaderRow className="w-full justify-evenly gap-8">
          <VerticalFader label="UDISK REC" value={s.uDiskRecordVol} min={1} max={12} onChange={(v) => setPath("system.uDiskRecordVol", v)} height={150} />
          <VerticalFader label="USB REC" value={s.usbRecordVol} min={1} max={12} onChange={(v) => setPath("system.usbRecordVol", v)} active height={150} />
        </FaderRow>
      </Panel>

      <Panel
        eyebrow="Dance Mode"
        title="Mic Trigger"
        className="system-dance-panel h-full min-h-0"
        bodyClassName="rack-panel-body flex-1 min-h-0 flex items-center overflow-visible"
      >
        <FaderRow className="w-full justify-evenly gap-6">
          <VerticalFader label="MIC THRES" value={s.danceMicThresholdDb ?? -50} min={-80} max={0} unit="dB" onChange={(v) => setPath("system.danceMicThresholdDb", v)} height={150} active />
          <VerticalFader label="MIC TIME" value={s.danceMicTimeSec ?? 6} min={0} max={20} unit="s" onChange={(v) => setPath("system.danceMicTimeSec", v)} height={150} />
        </FaderRow>
      </Panel>
    </div>
  );
}
