import { useCallback, useEffect, useMemo, useState } from "react";
import { useStudio } from "@/features/k500/store";
import { parseK500Preset, serializeK500Preset } from "@/features/k500/parser";
import { Panel, VerticalFader, Knob, NumberField, LedReadout, SelectField } from "./primitives";
import { filterRangeForEqKey } from "@/features/k500/filterRanges";
import { FILTER_TYPE_OPTIONS } from "@/features/k500/filterTypes";
import { useK500Live } from "@/features/k500/live/liveStore";
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


function formatKeyStep(step: number) {
  return step < 0 ? `♭${Math.abs(step)}` : step > 0 ? `♯${step}` : "0";
}

function PitchTapeControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const current = Math.max(-7, Math.min(7, Math.round(Number(value) || 0)));
  const [direction, setDirection] = useState<"left" | "right" | "idle">("idle");

  const commit = (nextValue: number) => {
    const next = Math.max(-7, Math.min(7, Math.round(nextValue)));
    if (next === current) return;
    setDirection(next > current ? "right" : "left");
    onChange(next);
  };

  const windowSteps = Array.from({ length: 5 }, (_, index) => current + index - 2);

  return (
    <div className="pitch-tape-control">
      <div className="pitch-tape-shell">
        <button
          type="button"
          className="pitch-tape-arrow"
          onClick={() => commit(current - 1)}
          disabled={current <= -7}
          aria-label="Turunkan pitch satu semitone"
        >
          &lt;
        </button>

        <div
          className="pitch-tape-window"
          tabIndex={0}
          role="slider"
          aria-label="Karaoke pitch"
          aria-valuemin={-7}
          aria-valuemax={7}
          aria-valuenow={current}
          aria-valuetext={current === 0 ? "Original" : formatKeyStep(current)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
              event.preventDefault();
              commit(current - 1);
            } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
              event.preventDefault();
              commit(current + 1);
            } else if (event.key === "Home") {
              event.preventDefault();
              commit(0);
            }
          }}
          onWheel={(event) => {
            event.preventDefault();
            commit(current + (event.deltaY < 0 ? 1 : -1));
          }}
        >
          <div
            key={`${current}-${direction}`}
            className={cn(
              "pitch-tape-strip",
              direction === "left" && "pitch-tape-slide-left",
              direction === "right" && "pitch-tape-slide-right",
            )}
          >
            {windowSteps.map((step, index) => {
              const available = step >= -7 && step <= 7;
              return available ? (
                <button
                  type="button"
                  key={step}
                  className={cn("pitch-tape-mark", index === 2 && "active")}
                  onClick={() => commit(step)}
                  tabIndex={-1}
                  aria-label={`Set pitch ${step === 0 ? "original" : formatKeyStep(step)}`}
                >
                  {formatKeyStep(step)}
                </button>
              ) : (
                <span key={`empty-${index}`} className="pitch-tape-mark empty" aria-hidden="true">·</span>
              );
            })}
          </div>
          <span className="pitch-tape-center-line" aria-hidden="true" />
        </div>

        <button
          type="button"
          className="pitch-tape-arrow"
          onClick={() => commit(current + 1)}
          disabled={current >= 7}
          aria-label="Naikkan pitch satu semitone"
        >
          &gt;
        </button>
      </div>
      <div className="pitch-tape-status">
        <span>KEY DOWN</span>
        <strong>{current === 0 ? "ORIGINAL" : formatKeyStep(current)}</strong>
        <span>KEY UP</span>
      </div>
    </div>
  );
}

function CompressorPanel({
  title, pathPrefix, comp, includeGate = false, gateDb, className,
}: {
  title: string;
  pathPrefix: string;
  comp: { compThresholdDb: number; compRatio: number; attackMs: number; releaseSec: number };
  includeGate?: boolean;
  gateDb?: number;
  className?: string;
}) {
  const setPath = useStudio((s) => s.setPath);
  return (
    <Panel
      eyebrow="Dynamics"
      title={title}
      className={cn("rack-panel h-full", className)}
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
  const p = preset.mic;
  const c = preset.eq.micA.crossover;
  return (
    <div className="mic-page responsive-rack-page grid gap-3 h-full items-stretch">
      <Panel eyebrow="Input mixer" title="Mic Inputs" className="rack-panel h-full" bodyClassName="rack-panel-body flex-1 min-h-0 flex items-center overflow-visible">
        <FaderRow>
          <VerticalFader label="MIC A" value={p.micAVol} min={0} max={100} onChange={(v) => setPath("mic.micAVol", v)} active />
          <VerticalFader label="MIC B" value={p.micBVol} min={0} max={100} onChange={(v) => setPath("mic.micBVol", v)} />
          <VerticalFader label="FBX" value={0} min={0} max={20} onChange={() => {}} disabled badge="read-only" />
        </FaderRow>
      </Panel>
      <CompressorPanel title="Vocal Dynamics" pathPrefix="mic" comp={p} includeGate gateDb={p.noiseGateDb} />
      <Panel eyebrow="Filters" title="Band Limits" className="rack-panel crossover-panel h-full">
        <div className="grid grid-cols-1 gap-2 crossover-control-stack">
          <NumberField label="HPF" unit="Hz" min={20} max={20000} value={p.hpfHz} onChange={(v) => setPath("mic.hpfHz", v)} />
          <SelectField label="HP Type" value={c.hpType} options={[...FILTER_TYPE_OPTIONS.hpf]} onChange={(v) => setPath("eq.micA.crossover.hpType", v)} />
          <NumberField label="LPF" unit="Hz" min={20} max={20000} value={p.lpfHz} onChange={(v) => setPath("mic.lpfHz", v)} />
          <SelectField label="LP Type" value={c.lpType} options={[...FILTER_TYPE_OPTIONS.lpf]} onChange={(v) => setPath("eq.micA.crossover.lpType", v)} />
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

  return (
    <div className="music-page responsive-rack-page grid gap-3 h-full items-stretch">
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

      <Panel eyebrow="Karaoke Key" title="Pitch Shifter" className="rack-panel h-full">
        <PitchTapeControl value={Number(p.key)} onChange={setMusicKey} />
        <div className="music-filter-stack grid gap-2">
          <InlineSlider label="Noise Gate" value={p.noiseGateDb ?? -70} min={-80} max={0} unit="dB" onChange={(v) => setPath("music.noiseGateDb", v)} />
          <InlineSlider label="Bass" value={p.bassDb ?? 0} min={-12} max={12} step={0.5} unit="dB" onChange={(v) => setPath("music.bassDb", v)} />
          <InlineSlider label="Mid" value={p.midDb ?? 0} min={-12} max={12} step={0.5} unit="dB" onChange={(v) => setPath("music.midDb", v)} />
          <InlineSlider label="Mid Freq" value={p.midFreqHz ?? 1000} min={100} max={8000} unit="Hz" onChange={(v) => setPath("music.midFreqHz", v)} />
          <InlineSlider label="Treble" value={p.trebleDb ?? 0} min={-12} max={12} step={0.5} unit="dB" onChange={(v) => setPath("music.trebleDb", v)} />
        </div>
      </Panel>

      <Panel eyebrow="Filters" title="HPF / LPF" className="rack-panel music-filter-panel crossover-panel h-full" bodyClassName="music-filter-panel-body flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
        <InlineSlider label="LPF" value={c.lpfHz} min={20} max={20000} unit="Hz" onChange={(v) => setPath("eq.music.crossover.lpfHz", v)} />
        <SelectField label="LP Type" value={c.lpType} options={[...FILTER_TYPE_OPTIONS.lpf]} onChange={(v) => setPath("eq.music.crossover.lpType", v)} />
        <InlineSlider label="HPF" value={c.hpfHz} min={20} max={20000} unit="Hz" onChange={(v) => setPath("eq.music.crossover.hpfHz", v)} />
        <SelectField label="HP Type" value={c.hpType} options={[...FILTER_TYPE_OPTIONS.hpf]} onChange={(v) => setPath("eq.music.crossover.hpType", v)} />
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
  const crossover = preset.eq[which].crossover;

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
      const hpRange = filterRangeForEqKey("main", "hpf");
      const lpRange = filterRangeForEqKey("main", "lpf");
      return [
        { label: "HPF", path: "eq.main.crossover.hpfHz", value: c.hpfHz, min: hpRange.min, max: hpRange.max },
        { label: "LPF", path: "eq.main.crossover.lpfHz", value: c.lpfHz, min: lpRange.min, max: lpRange.max },
      ];
    }
    if (which === "surround") {
      const c = preset.eq.surround.crossover;
      const hpRange = filterRangeForEqKey("surround", "hpf");
      const lpRange = filterRangeForEqKey("surround", "lpf");
      return [
        { label: "L Delay", unit: "ms", path: "outputs.surround.lDelayMs", value: o.lDelayMs, min: 0, max: 50 },
        { label: "R Delay", unit: "ms", path: "outputs.surround.rDelayMs", value: o.rDelayMs, min: 0, max: 50 },
        { label: "HPF", path: "eq.surround.crossover.hpfHz", value: c.hpfHz, min: hpRange.min, max: hpRange.max },
        { label: "LPF", path: "eq.surround.crossover.lpfHz", value: c.lpfHz, min: lpRange.min, max: lpRange.max },
      ];
    }
    if (which === "center") {
      const c = preset.eq.center.crossover;
      const hpRange = filterRangeForEqKey("center", "hpf");
      const lpRange = filterRangeForEqKey("center", "lpf");
      return [
        { label: "HPF", path: "eq.center.crossover.hpfHz", value: c.hpfHz, min: hpRange.min, max: hpRange.max },
        { label: "LPF", path: "eq.center.crossover.lpfHz", value: c.lpfHz, min: lpRange.min, max: lpRange.max },
      ];
    }
    const c = preset.eq.sub.crossover;
    const hpRange = filterRangeForEqKey("sub", "hpf");
    const lpRange = filterRangeForEqKey("sub", "lpf");
    return [
      { label: "HPF", path: "eq.sub.crossover.hpfHz", value: c.hpfHz, min: hpRange.min, max: hpRange.max },
      { label: "LPF", path: "eq.sub.crossover.lpfHz", value: c.lpfHz, min: lpRange.min, max: lpRange.max },
    ];
  })();

  return (
    <div className="output-page responsive-rack-page grid gap-3 h-full items-stretch">
      <Panel eyebrow={eyebrow} title={title} className="rack-panel h-full" bodyClassName="rack-panel-body flex-1 min-h-0 flex items-center overflow-visible">
        <FaderRow>
          {faders.map((f) => (
            <VerticalFader key={f.label} label={f.label} value={f.value} min={f.min} max={f.max} step={f.step} unit={f.unit}
              onChange={(v) => setPath(f.path, v)} />
          ))}
        </FaderRow>
      </Panel>
      <CompressorPanel title="Output Compressor" pathPrefix={`outputs.${which}`} comp={o} className="output-dynamics-panel" />
      <Panel eyebrow="Crossover" title="Band Limits / Delay" className="rack-panel crossover-panel output-band-limit-panel h-full">
        <div className="output-band-limit-grid">
          <div className="grid gap-2 crossover-control-stack">
            {filters.map((f) => (
              <NumberField key={f.label} label={f.label} unit={(f as any).unit || "Hz"} min={f.min} max={f.max} value={f.value}
                onChange={(v) => setPath(f.path, v)} />
            ))}
          </div>
          <div className="grid gap-2 crossover-control-stack output-band-limit-types">
            <SelectField label="HP Type" value={crossover.hpType} options={[...FILTER_TYPE_OPTIONS.hpf]} onChange={(v) => setPath(`eq.${which}.crossover.hpType`, v)} />
            <SelectField label="LP Type" value={crossover.lpType} options={[...FILTER_TYPE_OPTIONS.lpf]} onChange={(v) => setPath(`eq.${which}.crossover.lpType`, v)} />
          </div>
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
  const c = preset.eq.reverb.crossover;
  return (
    <div className="effect-page responsive-rack-page grid gap-3 h-full items-stretch">
      <Panel eyebrow="Room engine" title="Reverb" className="rack-panel h-full" bodyClassName="rack-panel-body flex-1 min-h-0 flex items-center overflow-visible">
        <FaderRow>
          <VerticalFader label="LEVEL" value={r.level} min={0} max={100} unit="%" onChange={(v) => setPath("effects.reverb.level", v)} active />
          <VerticalFader label="DECAY" value={r.decayMs} min={100} max={5000} unit="ms" onChange={(v) => setPath("effects.reverb.decayMs", v)} />
          <VerticalFader label="PRE" value={r.predelayMs} min={0} max={300} unit="ms" onChange={(v) => setPath("effects.reverb.predelayMs", v)} />
        </FaderRow>
      </Panel>
      <Panel eyebrow="Effect filters" title="Tone" className="rack-panel crossover-panel h-full">
        <div className="grid grid-cols-2 gap-3 crossover-control-grid">
          <NumberField label="HPF" unit="Hz" min={filterRangeForEqKey("reverb", "hpf").min} max={filterRangeForEqKey("reverb", "hpf").max} value={r.hpfHz} onChange={(v) => setPath("effects.reverb.hpfHz", v)} />
          <NumberField label="LPF" unit="Hz" min={filterRangeForEqKey("reverb", "lpf").min} max={filterRangeForEqKey("reverb", "lpf").max} value={r.lpfHz} onChange={(v) => setPath("effects.reverb.lpfHz", v)} />
          <SelectField label="HP Type" value={c.hpType} options={[...FILTER_TYPE_OPTIONS.hpf]} onChange={(v) => setPath("eq.reverb.crossover.hpType", v)} />
          <SelectField label="LP Type" value={c.lpType} options={[...FILTER_TYPE_OPTIONS.lpf]} onChange={(v) => setPath("eq.reverb.crossover.lpType", v)} />
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
  const c = preset.eq.echo.crossover;
  return (
    <div className="effect-page responsive-rack-page grid gap-3 h-full items-stretch">
      <Panel eyebrow="Delay engine" title="Echo" className="rack-panel h-full" bodyClassName="rack-panel-body flex-1 min-h-0 flex items-center overflow-visible">
        <FaderRow>
          <VerticalFader label="LEVEL" value={e.level} min={0} max={100} unit="%" onChange={(v) => setPath("effects.echo.level", v)} active />
          <VerticalFader label="REPEAT" value={e.repeat} min={0} max={100} onChange={(v) => setPath("effects.echo.repeat", v)} />
          <VerticalFader label="DELAY" value={e.leftDelayMs} min={0} max={1000} unit="ms" onChange={(v) => setPath("effects.echo.leftDelayMs", v)} />
        </FaderRow>
      </Panel>
      <Panel eyebrow="Delay filters" title="Tone" className="rack-panel crossover-panel h-full">
        <div className="grid grid-cols-2 gap-3 crossover-control-grid">
          <NumberField label="HPF" unit="Hz" min={filterRangeForEqKey("echo", "hpf").min} max={filterRangeForEqKey("echo", "hpf").max} value={e.hpfHz} onChange={(v) => setPath("effects.echo.hpfHz", v)} />
          <NumberField label="LPF" unit="Hz" min={filterRangeForEqKey("echo", "lpf").min} max={filterRangeForEqKey("echo", "lpf").max} value={e.lpfHz} onChange={(v) => setPath("effects.echo.lpfHz", v)} />
          <SelectField label="HP Type" value={c.hpType} options={[...FILTER_TYPE_OPTIONS.hpf]} onChange={(v) => setPath("eq.echo.crossover.hpType", v)} />
          <SelectField label="LP Type" value={c.lpType} options={[...FILTER_TYPE_OPTIONS.lpf]} onChange={(v) => setPath("eq.echo.crossover.lpType", v)} />
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

  const readPreset = useCallback(async (file: string) => {
    const msg = await bridgeRequest<{ t: "pcPresetBytes"; file: string; name: string; hex: string }>({ t: "readPcPreset", file }, "pcPresetBytes", 5000);
    return parseK500Preset(hexToArrayBuffer(msg.hex));
  }, []);

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

  return { items, root, status, busyFile, refresh, load, readPreset, saveCurrent, setStatus };
}

function MassUploadDialog({
  open,
  items,
  busy,
  ready,
  onClose,
  onUpload,
}: {
  open: boolean;
  items: PcPresetItem[];
  busy: boolean;
  ready: boolean;
  onClose: () => void;
  onUpload: (items: PcPresetItem[]) => Promise<void>;
}) {
  const [availableFile, setAvailableFile] = useState<string | null>(null);
  const [queuedFile, setQueuedFile] = useState<string | null>(null);
  const [queue, setQueue] = useState<PcPresetItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setQueue(items.slice(0, 10));
    setAvailableFile(items[0]?.file ?? null);
    setQueuedFile(null);
  }, [open, items]);

  if (!open) return null;

  const addItem = (selected: PcPresetItem | undefined) => {
    if (!selected || queue.some((item) => item.file === selected.file) || queue.length >= 10) return;
    setQueue((current) => [...current, selected]);
  };
  const addSelected = () => addItem(items.find((item) => item.file === availableFile));
  const addAll = () => {
    setQueue((current) => {
      const known = new Set(current.map((item) => item.file));
      return [...current, ...items.filter((item) => !known.has(item.file))].slice(0, 10);
    });
  };
  const removeSelected = () => {
    if (!queuedFile) return;
    setQueue((current) => current.filter((item) => item.file !== queuedFile));
    setQueuedFile(null);
  };

  return (
    <div
      className="mass-upload-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section className="mass-upload-dialog panel-bevel" role="dialog" aria-modal="true" aria-label="Mass Upload preset selection">
        <header className="mass-upload-titlebar">
          <div>
            <div className="eyebrow">Device preset transfer</div>
            <h3 className="font-display">Mass Upload</h3>
          </div>
          <button type="button" className="chrome-btn mass-upload-close" disabled={busy} onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="mass-upload-workspace">
          <div className="mass-upload-column">
            <div className="mass-upload-column-title">PC PRESET FILES</div>
            <div className="mass-upload-list panel-inset">
              {items.length ? items.map((item) => (
                <button
                  type="button"
                  key={item.file}
                  className={cn("mass-upload-row", availableFile === item.file && "selected", queue.some((queued) => queued.file === item.file) && "queued")}
                  onClick={() => setAvailableFile(item.file)}
                  onDoubleClick={() => addItem(item)}
                >
                  <span>{String(item.slot).padStart(2, "0")}</span>
                  <strong>{item.name || item.file}</strong>
                  <em>{queue.some((queued) => queued.file === item.file) ? "ADDED" : ".K500"}</em>
                </button>
              )) : <div className="mass-upload-empty">NO .K500 FILE</div>}
            </div>
          </div>

          <div className="mass-upload-transfer-actions">
            <SystemButton disabled={!items.length || queue.length >= 10} onClick={addAll}>Add All</SystemButton>
            <SystemButton disabled={!availableFile || queue.length >= 10} onClick={addSelected}>Add</SystemButton>
            <SystemButton disabled={!queuedFile} onClick={removeSelected}>Del</SystemButton>
          </div>

          <div className="mass-upload-column">
            <div className="mass-upload-column-title">DEVICE QUEUE · MAX 10</div>
            <div className="mass-upload-list panel-inset">
              {queue.length ? queue.map((item, index) => (
                <button
                  type="button"
                  key={item.file}
                  className={cn("mass-upload-row", queuedFile === item.file && "selected")}
                  onClick={() => setQueuedFile(item.file)}
                  onDoubleClick={() => {
                    setQueue((current) => current.filter((queued) => queued.file !== item.file));
                    setQueuedFile(null);
                  }}
                >
                  <span>{index + 1}</span>
                  <strong>{item.name || item.file}</strong>
                  <em>SLOT {index + 1}</em>
                </button>
              )) : <div className="mass-upload-empty">ADD PRESET TO QUEUE</div>}
            </div>
          </div>
        </div>

        <footer className="mass-upload-footer">
          <span className="font-mono text-[10px] text-muted-foreground">
            {ready ? `${queue.length}/10 preset · upload native order 10→1` : "Connect USB HID untuk memulai permanent upload"}
          </span>
          <div className="flex gap-2">
            <SystemButton disabled={busy} onClick={onClose}>Cancel</SystemButton>
            <SystemButton active={busy} disabled={busy || !ready || !queue.length} onClick={() => void onUpload(queue)}>
              {busy ? "Uploading…" : "Mass Upload"}
            </SystemButton>
          </div>
        </footer>
      </section>
    </div>
  );
}

export function SystemPage() {
  const preset = useStudio((s) => s.preset)!;
  const sourceName = useStudio((s) => s.sourceName);
  const setPath = useStudio((s) => s.setPath);
  const liveStatus = useK500Live((s) => s.status);
  const useInitVolume = useK500Live((s) => s.useInitVolume);
  const recallBusy = useK500Live((s) => s.recallBusy);
  const storeBusy = useK500Live((s) => s.storeBusy);
  const storeProgress = useK500Live((s) => s.storeProgress);
  const transportMode = useK500Live((s) => s.transportMode);
  const setUseInitVolume = useK500Live((s) => s.setUseInitVolume);
  const recallMode = useK500Live((s) => s.recallMode);
  const savePresetToSlot = useK500Live((s) => s.savePresetToSlot);
  const massUploadSlots = useK500Live((s) => s.massUploadSlots);
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
  const [massUploadOpen, setMassUploadOpen] = useState(false);

  useEffect(() => {
    setSelectedModeIndex(activeModeIndex);
  }, [activeModeIndex, modeNames.join("|")]);

  const activeModeName = modeNames[activeModeIndex - 1] || preset.name || "KARAOKE ARTIST";
  const selectedPcFile = pc.items.find((item) => normalizeModeName(item.file) === normalizeModeName(sourceName));

  const permanentStoreReady = liveStatus === "connected" && transportMode === "usb" && !recallBusy && !storeBusy;

  const uploadCurrentToSelectedSlot = useCallback(async () => {
    pc.setStatus(`Uploading ${preset.name} to device slot ${selectedModeIndex}...`);
    await savePresetToSlot(selectedModeIndex, preset);
    const live = useK500Live.getState();
    pc.setStatus(live.lastError ? `Upload gagal: ${live.lastError}` : `Preset tersimpan ke device slot ${selectedModeIndex}`);
  }, [pc, preset, savePresetToSlot, selectedModeIndex]);

  const massUploadPcLibrary = useCallback(async (source: PcPresetItem[]) => {
    if (!source.length) {
      pc.setStatus("Tidak ada preset PC untuk Mass Upload.");
      return;
    }
    try {
      pc.setStatus(`Reading ${source.length} preset untuk Mass Upload...`);
      const slots = [];
      for (let index = 0; index < source.length; index++) {
        const item = source[index];
        slots.push({ slotOneBased: index + 1, preset: await pc.readPreset(item.file) });
      }
      await massUploadSlots(slots);
      const live = useK500Live.getState();
      pc.setStatus(live.lastError ? `Mass Upload gagal: ${live.lastError}` : `${source.length} preset dikirim ke device. ${live.storeProgress}`);
      if (!live.lastError) setMassUploadOpen(false);
    } catch (err) {
      pc.setStatus(err instanceof Error ? err.message : String(err));
    }
  }, [massUploadSlots, pc]);

  return (
    <div className="system-page h-full min-h-0 grid gap-3 overflow-hidden">
      <Panel
        eyebrow="PC Mode"
        title="Preset Files"
        className="system-pc-panel h-full min-h-0"
        bodyClassName="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden"
      >
        <div className="system-panel-compact-head shrink-0">
          <div className="font-display led-cyan truncate" title={pc.root || pc.status}>{pc.root || "PC PRESET ROOT"}</div>
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
              <div className="font-display led-amber">NO .K500 FILE</div>
              <p>{pc.status}</p>
            </div>
          )}
        </div>

        <div className="system-critical-actions grid grid-cols-3 gap-2 shrink-0">
          <SystemButton disabled={storeBusy} onClick={pc.saveCurrent}>Save to PC</SystemButton>
          <SystemButton
            active={storeBusy}
            disabled={!permanentStoreReady}
            title={transportMode !== "usb" ? "Pilih dan connect USB HID untuk permanent upload." : `Upload preset editor ke device slot ${selectedModeIndex}.`}
            onClick={() => void uploadCurrentToSelectedSlot()}
          >
            {storeBusy ? "Uploading…" : "Upload to device"}
          </SystemButton>
          <SystemButton
            active={storeBusy}
            disabled={storeBusy || pc.items.length === 0}
            title={permanentStoreReady ? "Pilih maksimal 10 preset lalu upload ke slot device." : "Preset dapat dipilih sekarang; permanent upload dimulai setelah USB HID connected."}
            onClick={() => setMassUploadOpen(true)}
          >
            {storeBusy ? "Uploading…" : "Mass upload"}
          </SystemButton>
        </div>
      </Panel>

      <Panel
        eyebrow="Equipment / Device Mode"
        title="Device Preset Slots"
        className="system-device-panel h-full min-h-0"
        bodyClassName="system-device-body flex-1 min-h-0 flex flex-col gap-2 overflow-hidden"
      >
        <div className="system-device-heading shrink-0">
          <span className="font-display led-cyan truncate">{activeModeIndex} · {activeModeName}</span>
          <span className="system-active-pill">ACTIVE</span>
        </div>

        <div className="system-preset-list system-device-list panel-inset flex-1 min-h-0 overflow-y-auto p-2">
          {modeNames.map((name, idx) => {
            const slot = idx + 1;
            const active = slot === activeModeIndex;
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

        <div className="system-device-footer shrink-0">
          <div className="system-critical-options flex flex-wrap gap-2 shrink-0">
            <SystemCheck
              label="Use init volume"
              checked={useInitVolume}
              disabled={recallBusy || storeBusy || liveStatus !== "connected"}
              onChange={(v) => void setUseInitVolume(v)}
            />
            {(storeBusy || storeProgress) && <span className="system-store-progress">{storeProgress}</span>}
          </div>
          <div className="system-critical-actions grid grid-cols-3 gap-2 shrink-0">
            <SystemButton
              active={recallBusy}
              disabled={liveStatus !== "connected" || recallBusy || storeBusy}
              title={liveStatus !== "connected" ? "Connect ke device dahulu." : "Recall slot terpilih lalu refresh seluruh memory dari device."}
              onClick={() => void recallMode(selectedModeIndex)}
            >
              {recallBusy ? "Recalling…" : "Recall"}
            </SystemButton>
            <SystemButton
              active={storeBusy}
              disabled={!permanentStoreReady}
              title={transportMode !== "usb" ? "Save slot permanen terverifikasi melalui USB HID." : `Save preset editor ke slot ${selectedModeIndex}.`}
              onClick={() => void savePresetToSlot(selectedModeIndex, preset)}
            >
              {storeBusy ? "Saving…" : "Save"}
            </SystemButton>
            <SystemButton disabled title="Reset all setting belum diaktifkan karena belum ada sniff native yang aman.">Reset all</SystemButton>
          </div>
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
          <VerticalFader label="UDISK REC" value={s.uDiskRecordVol} min={1} max={6} onChange={(v) => setPath("system.uDiskRecordVol", v)} height={150} />
          <VerticalFader label="USB REC" value={s.usbRecordVol} min={1} max={6} onChange={(v) => setPath("system.usbRecordVol", v)} active height={150} />
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
          <VerticalFader label="MIC TIME" value={s.danceMicTimeSec ?? 6} min={0} max={30} unit="s" onChange={(v) => setPath("system.danceMicTimeSec", v)} height={150} />
        </FaderRow>
      </Panel>

      <MassUploadDialog
        open={massUploadOpen}
        items={pc.items}
        busy={storeBusy}
        ready={permanentStoreReady}
        onClose={() => setMassUploadOpen(false)}
        onUpload={massUploadPcLibrary}
      />
    </div>
  );
}
