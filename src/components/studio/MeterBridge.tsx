import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/features/k500/store";

interface MeterDef { label: string; getLevel: () => number; }

function levelFromPct(pct: number) {
  // 0..100 -> 0..1 with slight breathing
  const base = Math.max(0, Math.min(1, pct / 100));
  return Math.min(1, base * (0.85 + Math.random() * 0.18));
}
function levelFromDb(db: number) {
  // -37.5..24 -> 0..1
  const t = (Math.min(24, Math.max(-37.5, db)) + 37.5) / (24 + 37.5);
  return Math.min(1, t * (0.85 + Math.random() * 0.18));
}

function Meter({ label, level, peak }: { label: string; level: number; peak: number }) {
  const segs = 14;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[9px] font-display tracking-wider uppercase text-muted-foreground">{label}</div>
      <div className="panel-inset w-5 h-24 flex flex-col-reverse gap-px p-[3px]">
        {Array.from({ length: segs }).map((_, i) => {
          const t = i / (segs - 1);
          const lit = level >= t - 0.001;
          const color = t > 0.85 ? "var(--meter-red)" : t > 0.7 ? "var(--meter-yellow)" : "var(--meter-green)";
          return (
            <div key={i} className="flex-1 rounded-[1px]"
              style={{
                background: lit ? color : "oklch(0 0 0 / 60%)",
                boxShadow: lit ? `0 0 5px ${color}` : "inset 0 0 1px oklch(0 0 0 / 80%)",
                opacity: lit ? 1 : 0.6,
              }}
            />
          );
        })}
      </div>
      <div className="text-[9px] font-mono text-amber" style={{ color: "var(--amber)" }}>
        {Math.round(peak * 100)}
      </div>
    </div>
  );
}

export function MeterBridge() {
  const preset = useStudio((s) => s.preset);
  const [tick, setTick] = useState(0);
  const peaksRef = useRef<Record<string, number>>({});
  const levelsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 80) { setTick((v) => v + 1); last = t; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const meters: { label: string; raw: number; kind: "pct" | "db" }[] = preset ? [
    { label: "MIC A", raw: preset.mic.micAVol, kind: "pct" },
    { label: "MIC B", raw: preset.mic.micBVol, kind: "pct" },
    { label: "MUSIC", raw: preset.system.topMusicVol, kind: "pct" },
    { label: "MAIN L", raw: preset.outputs.main.lVolDb, kind: "db" },
    { label: "MAIN R", raw: preset.outputs.main.rVolDb, kind: "db" },
    { label: "SUR L", raw: preset.outputs.surround.lVolDb, kind: "db" },
    { label: "SUR R", raw: preset.outputs.surround.rVolDb, kind: "db" },
    { label: "CTR", raw: preset.outputs.center.outputVolDb, kind: "db" },
    { label: "SUB", raw: preset.outputs.sub.outputVolDb, kind: "db" },
    { label: "REV", raw: preset.effects.reverb.level, kind: "pct" },
    { label: "ECHO", raw: preset.effects.echo.level, kind: "pct" },
  ] : [];

  // compute levels per tick
  for (const m of meters) {
    const target = m.kind === "db" ? levelFromDb(m.raw) : levelFromPct(m.raw);
    const cur = levelsRef.current[m.label] ?? 0;
    levelsRef.current[m.label] = cur + (target - cur) * 0.45;
    const pk = peaksRef.current[m.label] ?? 0;
    peaksRef.current[m.label] = Math.max(levelsRef.current[m.label], pk - 0.012);
  }

  return (
    <div className="panel-bevel px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="eyebrow">Meter Bridge</div>
          <h2 className="font-display text-xs font-semibold">All Buses · Live</h2>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
          <span className="led-dot" style={{ color: "var(--meter-green)" }} /> SIGNAL
          <span className="led-dot ml-2" style={{ color: "var(--meter-yellow)" }} /> -6 dB
          <span className="led-dot ml-2" style={{ color: "var(--meter-red)" }} /> CLIP
        </div>
      </div>
      <div className="flex items-end gap-2 overflow-x-auto pb-1">
        {meters.length ? meters.map((m) => (
          <Meter
            key={m.label}
            label={m.label}
            level={levelsRef.current[m.label] ?? 0}
            peak={peaksRef.current[m.label] ?? 0}
          />
        )) : (
          <div className="text-xs text-muted-foreground font-mono py-6">— meter bridge idle, load a preset —</div>
        )}
        {/* tick reference to keep TS happy */}
        <span className="hidden">{tick}</span>
      </div>
    </div>
  );
}
