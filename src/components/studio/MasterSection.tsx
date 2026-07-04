import { useStudio, changedByteCount, EQ_SECTIONS } from "@/features/k500/store";
import { Panel, VerticalFader, LedReadout, Led, SelectField, NumberField } from "./primitives";

export function MasterSection() {
  const preset = useStudio((s) => s.preset);
  const original = useStudio((s) => s.originalBytes);
  const dirty = useStudio((s) => s.dirty);
  const sourceName = useStudio((s) => s.sourceName);
  const eqKey = useStudio((s) => s.eqKey);
  const selectedBand = useStudio((s) => s.selectedBand);
  const setPath = useStudio((s) => s.setPath);
  const setBandValue = useStudio((s) => s.setBandValue);
  const setName = useStudio((s) => s.setName);
  const copyMicAtoB = useStudio((s) => s.copyMicAtoB);
  const resetSelectedBand = useStudio((s) => s.resetSelectedBand);
  const exportPreset = useStudio((s) => s.exportPreset);

  if (!preset) {
    return (
      <aside className="flex flex-col gap-3 w-[320px] shrink-0 min-h-0 overflow-hidden">
        <Panel eyebrow="Master" title="Idle">
          <p className="text-xs text-muted-foreground">Load a preset to wake the console.</p>
        </Panel>
      </aside>
    );
  }

  const section = preset.eq[eqKey];
  const band = section?.bands?.[selectedBand];
  const diff = dirty ? changedByteCount(preset, original) : 0;

  const warnings: string[] = [];
  Object.values(preset.eq).forEach((eq) =>
    eq.bands.forEach((b) => {
      if (Math.abs(b.gainDb) >= 14) warnings.push(`${eq.label} B${b.index} ${b.gainDb > 0 ? "+" : ""}${b.gainDb.toFixed(1)} dB`);
    }),
  );

  return (
    <aside className="grid grid-rows-[minmax(0,1fr)_304px] gap-3 w-[300px] shrink-0 relative min-h-0 overflow-hidden">
      <div className="absolute -left-1.5 top-2 bottom-2 w-px bg-linear-to-b from-transparent via-[color:var(--gold)] to-transparent opacity-40" />

      <div className="right-rail-scroll flex flex-col gap-2.5 min-h-0 overflow-y-auto pr-1">
        <Panel eyebrow="Preset" title={preset.name}
          right={
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <Led color={preset.checksumOk ? "green" : "red"} />
              <span className={preset.checksumOk ? "text-[color:var(--meter-green)]" : "text-[color:var(--meter-red)]"}>
                {preset.checksumOk ? "OK" : "DIRTY"}
              </span>
            </div>
          }
        >
          <label className="flex flex-col gap-1.5 mb-2">
            <span className="eyebrow">Preset name</span>
            <input className="studio-input" maxLength={33} value={preset.name}
              onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] font-mono">
            <span className="text-muted-foreground">Source</span><span className="text-foreground truncate">{sourceName}</span>
            <span className="text-muted-foreground">Status</span>
            <span className={dirty ? "text-[color:var(--amber)]" : "text-[color:var(--meter-green)]"}>{dirty ? "MODIFIED" : "CLEAN"}</span>
            <span className="text-muted-foreground">Diff</span><span>{diff} B</span>
          </div>
        </Panel>

        {band && section && (
          <Panel eyebrow="Band Inspector" title={`${section.label} · B${band.index}`}>
            <div className="flex items-baseline justify-between mb-3">
              <LedReadout value={`${band.gainDb > 0 ? "+" : ""}${band.gainDb.toFixed(1)}`} unit="dB" size="lg" />
              <span className="text-[11px] font-mono text-muted-foreground">{band.type} · {band.frequencyHz}Hz · Q{band.q.toFixed(1)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SelectField label="Type" value={band.type as string} options={["P", "LS", "HS"]}
                onChange={(v) => setBandValue(selectedBand, "type", v)} />
              <NumberField label="Freq" unit="Hz" min={20} max={20000} step={1} value={band.frequencyHz}
                onChange={(v) => setBandValue(selectedBand, "frequencyHz", v)} />
              <NumberField label="Q" min={0.1} max={30} step={0.1} value={band.q}
                onChange={(v) => setBandValue(selectedBand, "q", v)} />
              <NumberField label="Gain" unit="dB" min={-24} max={24} step={0.1} value={band.gainDb}
                onChange={(v) => setBandValue(selectedBand, "gainDb", v)} />
            </div>
            <p className="mt-2 text-[10px] font-mono text-muted-foreground">drag node = freq/gain · alt+wheel = Q</p>
            <button onClick={resetSelectedBand}
              className="mt-2 chrome-btn w-full py-1.5 text-[11px] font-display">Reset band</button>
          </Panel>
        )}

        <Panel eyebrow="Sonic Guard"
          title={warnings.length ? `${warnings.length} high-gain bands` : "Safe response"}
          right={<Led color={warnings.length ? "red" : "green"} />}
        >
          {warnings.length ? (
            <div className="flex flex-col gap-1 text-[11px] font-mono text-[color:var(--meter-red)]">
              {warnings.slice(0, 3).map((w, i) => <span key={i}>{w}</span>)}
            </div>
          ) : (
            <p className="text-[11px] font-mono text-muted-foreground">No extreme EQ gain detected.</p>
          )}
        </Panel>
        <span className="hidden">{Object.keys(EQ_SECTIONS).length}</span>
      </div>

      <Panel eyebrow="Master Section" title="Master Strip" className="master-bottom-strip h-full"
        bodyClassName="flex-1 min-h-0 flex items-center justify-center overflow-visible"
        right={<Led color="amber" />}
      >
        <div className="flex items-stretch justify-around gap-2">
          <VerticalFader label="MUSIC" value={preset.system.topMusicVol} min={0} max={100}
            onChange={(v) => setPath("system.topMusicVol", v)} height={126} />
          <VerticalFader label="MIC" value={preset.system.topMicVol} min={0} max={100}
            onChange={(v) => setPath("system.topMicVol", v)} height={126} active />
          <VerticalFader label="FX" value={preset.system.topEffectVol} min={0} max={100}
            onChange={(v) => setPath("system.topEffectVol", v)} height={126} />
        </div>
      </Panel>
    </aside>
  );
}
