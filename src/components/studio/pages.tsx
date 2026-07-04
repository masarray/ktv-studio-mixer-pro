import { useStudio } from "@/features/k500/store";
import { Panel, VerticalFader, Knob, NumberField, Toggle, LedReadout } from "./primitives";
import { CompressorGraph } from "./CompressorGraph";
import { cn } from "@/lib/utils";

const fmtRelease = (v: number) => (v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(1)} s`);

function FaderRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("fader-row flex items-stretch gap-1.5 justify-around", className)}>{children}</div>;
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
  const sources: [string, string, string, keyof typeof p][] = [
    ["Input 1", "Input 1", "IN 1", "input1GainDb"],
    ["Input 2", "Input 2", "IN 2", "input2GainDb"],
    ["Bluetooth", "BT", "BT", "btGainDb"],
    ["UDisk", "UDISK", "USB", "uDiskGainDb"],
    ["Digital", "DIG", "DIG", "digitalGainDb"],
  ];
  const steps = Array.from({ length: 15 }, (_, i) => i - 7);
  const keyLabel = (n: number) => n < 0 ? `♭${Math.abs(n)}` : n > 0 ? `♯${n}` : "0";
  return (
    <div className="grid grid-cols-[1fr_320px] gap-3 h-full items-stretch">
      <Panel eyebrow="Source router" title="Music Inputs" className="rack-panel h-full" bodyClassName="rack-panel-body flex-1 min-h-0 flex items-center overflow-visible">
        <FaderRow>
          {sources.map(([src, , label, field]) => (
            <div key={src} className={cn("flex flex-col items-stretch gap-2",
              p.source === src && "")}>
              <button
                onClick={() => setMusicSource(src)}
                className={cn("chrome-btn px-2 py-1 text-[10px] font-display tracking-wider",
                  p.source === src && "chrome-btn-active")}
              >
                {label}
              </button>
              <VerticalFader label={label} value={p[field] as number} min={-12} max={12} unit="dB"
                onChange={(v) => setPath(`music.${String(field)}`, v)}
                active={p.source === src} />
            </div>
          ))}
        </FaderRow>
      </Panel>
      <Panel eyebrow="Karaoke key" title="Pitch Shifter" className="rack-panel h-full"
        right={<LedReadout value={p.key === 0 ? "ORIG" : keyLabel(p.key)} color="cyan" />}
      >
        <div className="grid grid-cols-5 gap-1.5">
          {steps.map((step) => (
            <button key={step}
              onClick={() => setMusicKey(step)}
              className={cn("chrome-btn py-2 text-xs font-mono", Number(p.key) === step && "chrome-btn-active")}
            >
              {keyLabel(step)}
            </button>
          ))}
        </div>
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
export function SystemPage() {
  const preset = useStudio((s) => s.preset)!;
  const setPath = useStudio((s) => s.setPath);
  const s = preset.system;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Panel eyebrow="Safe boot" title="Startup Limits">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Music Init" min={0} max={100} value={s.musicInitVol} onChange={(v) => setPath("system.musicInitVol", v)} />
          <NumberField label="Music Max" min={0} max={100} value={s.musicMaxVol} onChange={(v) => setPath("system.musicMaxVol", v)} />
          <NumberField label="Mic Init" min={0} max={100} value={s.micInitVol} onChange={(v) => setPath("system.micInitVol", v)} />
          <NumberField label="Mic Max" min={0} max={100} value={s.micMaxVol} onChange={(v) => setPath("system.micMaxVol", v)} />
          <NumberField label="Effect Init" min={0} max={100} value={s.effectInitLevel} onChange={(v) => setPath("system.effectInitLevel", v)} />
        </div>
      </Panel>
      <Panel eyebrow="USB / UDisk" title="Recording">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="UDisk Record" min={1} max={12} value={s.uDiskRecordVol} onChange={(v) => setPath("system.uDiskRecordVol", v)} />
          <NumberField label="USB Record" min={1} max={12} value={s.usbRecordVol} onChange={(v) => setPath("system.usbRecordVol", v)} />
        </div>
      </Panel>
    </div>
  );
}
