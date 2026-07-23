import { useEffect, useState } from "react";
import { useStudio, changedByteCount } from "@/features/k500/store";
import { Panel, VerticalFader, LedReadout, Led, SelectField, NumberField } from "./primitives";

/**
 * Exact binary diffing serializes the entire preset. Keep that work outside
 * the hot fader/knob path and calculate only after input has settled.
 */
function DeferredByteDiff() {
  const preset = useStudio((s) => s.preset);
  const original = useStudio((s) => s.originalBytes);
  const dirty = useStudio((s) => s.dirty);
  const [diff, setDiff] = useState(0);

  useEffect(() => {
    if (!dirty || !preset || !original) {
      setDiff(0);
      return;
    }
    const timer = window.setTimeout(() => {
      setDiff(changedByteCount(preset, original));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [dirty, original, preset]);

  return <span>{dirty ? `${diff || "…"} B` : "0 B"}</span>;
}

function PresetContextPanel() {
  const presetName = useStudio((s) => s.preset?.name ?? "");
  const checksumOk = useStudio((s) => Boolean(s.preset?.checksumOk));
  const dirty = useStudio((s) => s.dirty);
  const sourceName = useStudio((s) => s.sourceName);
  const setName = useStudio((s) => s.setName);

  return (
    <Panel
      eyebrow="Preset"
      title={presetName}
      className="master-preset-panel"
      right={
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <Led color={checksumOk ? "green" : "red"} />
          <span className={checksumOk ? "text-[color:var(--meter-green)]" : "text-[color:var(--meter-red)]"}>
            {checksumOk ? "OK" : "DIRTY"}
          </span>
        </div>
      }
    >
      <label className="flex flex-col gap-1.5 mb-2">
        <span className="eyebrow">Preset name</span>
        <input
          className="studio-input"
          maxLength={33}
          value={presetName}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] font-mono">
        <span className="text-muted-foreground">Source</span>
        <span className="text-foreground truncate">{sourceName}</span>
        <span className="text-muted-foreground">Status</span>
        <span className={dirty ? "text-[color:var(--amber)]" : "text-[color:var(--meter-green)]"}>
          {dirty ? "MODIFIED" : "CLEAN"}
        </span>
        <span className="text-muted-foreground">Diff</span>
        <DeferredByteDiff />
      </div>
    </Panel>
  );
}

function BandInspector() {
  const section = useStudio((s) => s.preset?.eq?.[s.eqKey]);
  const selectedBand = useStudio((s) => s.selectedBand);
  const setBandValue = useStudio((s) => s.setBandValue);
  const resetSelectedBand = useStudio((s) => s.resetSelectedBand);
  const band = section?.bands?.[selectedBand];

  if (!band || !section) return null;
  return (
    <Panel eyebrow="Band Inspector" title={`${section.label} · B${band.index}`} className="master-band-inspector">
      <div className="flex items-baseline justify-between mb-3">
        <LedReadout value={`${band.gainDb > 0 ? "+" : ""}${band.gainDb.toFixed(1)}`} unit="dB" size="lg" />
        <span className="text-[11px] font-mono text-muted-foreground">
          {band.type} · {band.frequencyHz}Hz · Q{band.q.toFixed(1)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SelectField
          label="Type"
          value={band.type as string}
          options={["P", "LS", "HS"]}
          onChange={(value) => setBandValue(selectedBand, "type", value)}
        />
        <NumberField
          label="Freq"
          unit="Hz"
          min={20}
          max={20000}
          step={1}
          value={band.frequencyHz}
          onChange={(value) => setBandValue(selectedBand, "frequencyHz", value)}
        />
        <NumberField
          label="Q"
          min={0.1}
          max={30}
          step={0.1}
          value={band.q}
          onChange={(value) => setBandValue(selectedBand, "q", value)}
        />
        <NumberField
          label="Gain"
          unit="dB"
          min={-24}
          max={24}
          step={0.1}
          value={band.gainDb}
          onChange={(value) => setBandValue(selectedBand, "gainDb", value)}
        />
      </div>
      <p className="mt-2 text-[10px] font-mono text-muted-foreground">drag node = freq/gain · alt+wheel = Q</p>
      <button onClick={resetSelectedBand} className="mt-2 chrome-btn w-full py-1.5 text-[11px] font-display">
        Reset band
      </button>
    </Panel>
  );
}

type MasterVolumeField = "topMusicVol" | "topMicVol" | "topEffectVol";

function MasterVolumeFader({ label, field }: { label: string; field: MasterVolumeField }) {
  const value = useStudio((s) => Number(s.preset?.system[field] ?? 0));
  const setPath = useStudio((s) => s.setPath);
  return (
    <VerticalFader
      label={label}
      value={value}
      min={0}
      max={84}
      onChange={(next) => setPath(`system.${field}`, next)}
      height={126}
    />
  );
}

function MasterStrip() {
  return (
    <Panel
      eyebrow="Master Section"
      title="Master Strip"
      className="master-bottom-strip h-full"
      bodyClassName="flex-1 min-h-0 flex items-center justify-center overflow-visible"
      right={<Led color="amber" />}
    >
      <div className="flex items-stretch justify-around gap-2">
        <MasterVolumeFader label="MUSIC" field="topMusicVol" />
        <MasterVolumeFader label="MIC" field="topMicVol" />
        <MasterVolumeFader label="FX" field="topEffectVol" />
      </div>
    </Panel>
  );
}

export function MasterSection() {
  const hasPreset = useStudio((s) => Boolean(s.preset));

  if (!hasPreset) {
    return (
      <aside className="master-rail flex flex-col gap-3 shrink-0 min-h-0 overflow-hidden">
        <Panel eyebrow="Master" title="Idle">
          <p className="text-xs text-muted-foreground">Load a preset to wake the console.</p>
        </Panel>
      </aside>
    );
  }

  return (
    <aside className="master-rail grid gap-3 shrink-0 relative min-h-0 overflow-hidden">
      <div className="absolute -left-1.5 top-2 bottom-2 w-px bg-linear-to-b from-transparent via-[color:var(--gold)] to-transparent opacity-40" />
      <div className="master-context-rail right-rail-scroll flex flex-col gap-2.5 min-h-0 overflow-y-auto pr-1">
        <PresetContextPanel />
        <BandInspector />
      </div>
      <MasterStrip />
    </aside>
  );
}
