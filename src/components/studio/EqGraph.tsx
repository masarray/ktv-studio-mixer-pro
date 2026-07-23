import { useEffect, useMemo, useRef } from "react";
import { useStudio } from "@/features/k500/store";
import { EQ_SECTIONS } from "@/features/k500/parser";
import type { EqBand, EqCrossover } from "@/features/k500/types";
import { filterRangeForEqKey } from "@/features/k500/filterRanges";
import { describeCrossoverFilter } from "@/features/k500/filterTypes";
import { cn } from "@/lib/utils";

const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const MIN_GAIN = -24;
const MAX_GAIN = 24;
const W = 1040;
const H = 354;
const PAD = { left: 56, right: 22, top: 24, bottom: 38 };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dbToLin = (db: number) => Math.pow(10, db / 20);
const safeQ = (q: number) => clamp(Number(q) || 0.7, 0.1, 30);

function freqToX(freq: number) {
  const mn = Math.log10(MIN_FREQ), mx = Math.log10(MAX_FREQ);
  const t = (Math.log10(clamp(freq, MIN_FREQ, MAX_FREQ)) - mn) / (mx - mn);
  return PAD.left + t * (W - PAD.left - PAD.right);
}
function xToFreq(x: number) {
  const mn = Math.log10(MIN_FREQ), mx = Math.log10(MAX_FREQ);
  const t = clamp((x - PAD.left) / (W - PAD.left - PAD.right), 0, 1);
  const raw = Math.pow(10, mn + t * (mx - mn));
  if (raw < 100) return Math.round(raw);
  if (raw < 1000) return Math.round(raw / 5) * 5;
  return Math.round(raw / 10) * 10;
}
function gainToY(g: number) {
  const t = (clamp(g, MIN_GAIN, MAX_GAIN) - MIN_GAIN) / (MAX_GAIN - MIN_GAIN);
  return H - PAD.bottom - t * (H - PAD.top - PAD.bottom);
}
function yToGain(y: number) {
  const t = clamp((H - PAD.bottom - y) / (H - PAD.top - PAD.bottom), 0, 1);
  return Math.round((MIN_GAIN + t * (MAX_GAIN - MIN_GAIN)) * 10) / 10;
}
function formatFreq(f: number) {
  return f >= 1000 ? `${Number.isInteger(f / 1000) ? f / 1000 : (f / 1000).toFixed(1)}k` : `${f}`;
}

function biquadMagDb(coeff: any, freq: number, sr = 48000) {
  const omega = 2 * Math.PI * clamp(freq, 1, sr / 2 - 1) / sr;
  const c1 = Math.cos(omega), s1 = Math.sin(omega);
  const c2 = Math.cos(2 * omega), s2 = Math.sin(2 * omega);
  const bRe = coeff.b0 + coeff.b1 * c1 + coeff.b2 * c2;
  const bIm = -(coeff.b1 * s1 + coeff.b2 * s2);
  const aRe = 1 + coeff.a1 * c1 + coeff.a2 * c2;
  const aIm = -(coeff.a1 * s1 + coeff.a2 * s2);
  const m2 = (bRe ** 2 + bIm ** 2) / Math.max(1e-12, aRe ** 2 + aIm ** 2);
  return 10 * Math.log10(Math.max(m2, 1e-12));
}
function peakingCoeffs(freq: number, q: number, gainDb: number, sr = 48000) {
  const A = dbToLin(gainDb / 2);
  const w0 = 2 * Math.PI * clamp(freq, 1, sr / 2 - 1) / sr;
  const alpha = Math.sin(w0) / (2 * safeQ(q));
  const cw = Math.cos(w0);
  const a0 = 1 + alpha / A;
  return {
    b0: (1 + alpha * A) / a0,
    b1: (-2 * cw) / a0,
    b2: (1 - alpha * A) / a0,
    a1: (-2 * cw) / a0,
    a2: (1 - alpha / A) / a0,
  };
}
function shelfCoeffs(freq: number, q: number, gainDb: number, kind: "LS" | "HS", sr = 48000) {
  const A = dbToLin(gainDb / 2);
  const w0 = 2 * Math.PI * clamp(freq, 1, sr / 2 - 1) / sr;
  const cw = Math.cos(w0);
  const sw = Math.sin(w0);
  const slope = clamp(safeQ(q), 0.1, 10);
  const alpha = sw / 2 * Math.sqrt((A + 1 / A) * (1 / slope - 1) + 2);
  const beta = 2 * Math.sqrt(A) * alpha;
  if (kind === "LS") {
    const a0 = (A + 1) + (A - 1) * cw + beta;
    return {
      b0: (A * ((A + 1) - (A - 1) * cw + beta)) / a0,
      b1: (2 * A * ((A - 1) - (A + 1) * cw)) / a0,
      b2: (A * ((A + 1) - (A - 1) * cw - beta)) / a0,
      a1: (-2 * ((A - 1) + (A + 1) * cw)) / a0,
      a2: ((A + 1) + (A - 1) * cw - beta) / a0,
    };
  }
  const a0 = (A + 1) - (A - 1) * cw + beta;
  return {
    b0: (A * ((A + 1) + (A - 1) * cw + beta)) / a0,
    b1: (-2 * A * ((A - 1) + (A + 1) * cw)) / a0,
    b2: (A * ((A + 1) + (A - 1) * cw - beta)) / a0,
    a1: (2 * ((A - 1) - (A + 1) * cw)) / a0,
    a2: ((A + 1) - (A - 1) * cw - beta) / a0,
  };
}
function bandResponseDbAt(band: EqBand, freq: number) {
  if (Math.abs(band.gainDb) < 0.001) return 0;
  const coeff = band.type === "LS" ? shelfCoeffs(band.frequencyHz, band.q, band.gainDb, "LS")
    : band.type === "HS" ? shelfCoeffs(band.frequencyHz, band.q, band.gainDb, "HS")
    : peakingCoeffs(band.frequencyHz, band.q, band.gainDb);
  return biquadMagDb(coeff, freq);
}
const BESSEL_COEFFICIENTS: Readonly<Record<2 | 3 | 4, readonly number[]>> = Object.freeze({
  2: Object.freeze([3, 3, 1]),
  3: Object.freeze([15, 15, 6, 1]),
  4: Object.freeze([105, 105, 45, 10, 1]),
});

// Scales reverse-Bessel polynomials so the selected cutoff remains the
// conventional -3 dB point. This makes Bessel/Butter/LR choices visibly and
// technically distinct without changing the cutoff handle position.
const BESSEL_3DB_SCALE: Readonly<Record<2 | 3 | 4, number>> = Object.freeze({
  2: 1.3616541287161308,
  3: 1.7556723686812106,
  4: 2.113917674904216,
});

function besselLowpassMagnitude(order: 2 | 3 | 4, normalizedFrequency: number): number {
  const x = Math.max(0, normalizedFrequency) * BESSEL_3DB_SCALE[order];
  const coefficients = BESSEL_COEFFICIENTS[order];
  let re = 0;
  let im = 0;
  for (let power = 0; power < coefficients.length; power++) {
    const magnitude = coefficients[power] * Math.pow(x, power);
    const phase = power * Math.PI / 2;
    re += magnitude * Math.cos(phase);
    im += magnitude * Math.sin(phase);
  }
  return coefficients[0] / Math.max(1e-12, Math.hypot(re, im));
}

function crossoverFilterDb(kind: "hpf" | "lpf", typeLabel: string, typeRaw: number, cutoff: number, freq: number): number {
  const spec = describeCrossoverFilter(kind, typeLabel, typeRaw);
  const ratio = kind === "lpf"
    ? Math.max(freq, 1) / Math.max(cutoff, 1)
    : Math.max(cutoff, 1) / Math.max(freq, 1);

  let magnitude: number;
  if (spec.family === "bessel") {
    magnitude = besselLowpassMagnitude(spec.order, ratio);
  } else if (spec.family === "lr") {
    // LR24 = two cascaded Butterworth 12 dB sections; -6 dB at crossover.
    const butter12 = 1 / Math.sqrt(1 + Math.pow(ratio, 4));
    magnitude = butter12 * butter12;
  } else {
    magnitude = 1 / Math.sqrt(1 + Math.pow(ratio, 2 * spec.order));
  }
  return 20 * Math.log10(Math.max(magnitude, 1e-12));
}

function crossoverResponseDbAt(crossover: EqCrossover | undefined, freq: number) {
  if (!crossover) return 0;
  let db = 0;
  const hp = Number(crossover.hpfHz) || MIN_FREQ;
  const lp = Number(crossover.lpfHz) || MAX_FREQ;
  if (hp > MIN_FREQ) db += crossoverFilterDb("hpf", crossover.hpType, crossover.hpTypeRaw, hp, freq);
  if (lp < MAX_FREQ) db += crossoverFilterDb("lpf", crossover.lpType, crossover.lpTypeRaw, lp, freq);
  return db;
}


const GRID_FREQS = [20, 30, 50, 70, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const GRID_DBS = [-24, -18, -12, -6, 0, 6, 12, 18, 24];

export function EqGraph() {
  const eqKey = useStudio((s) => s.eqKey);
  const section = useStudio((s) => s.preset?.eq?.[s.eqKey]);
  const micEqLinked = useStudio((s) => Boolean(s.preset?.mic.eqLink));
  const page = useStudio((s) => s.page);
  const selectedBand = useStudio((s) => s.selectedBand);
  const selectBand = useStudio((s) => s.selectBand);
  const setBandValue = useStudio((s) => s.setBandValue);
  const setBandValues = useStudio((s) => s.setBandValues);
  const setPath = useStudio((s) => s.setPath);
  const setEqKey = useStudio((s) => s.setEqKey);
  const resetSelectedBand = useStudio((s) => s.resetSelectedBand);
  const toggle = useStudio((s) => s.toggle);

  const eqKeys: string[] = (section && page in ({ mic:1,music:1,main:1,surround:1,center:1,sub:1,reverb:1,echo:1 } as any))
    ? ((page === "mic") ? ["micA", "micB"] : [page === "main" ? "main" : page === "surround" ? "surround" : page === "center" ? "center" : page === "sub" ? "sub" : page === "music" ? "music" : page === "reverb" ? "reverb" : "echo"])
    : [];

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<
    | { kind: "band"; idx: number; lastX: number; lastY: number }
    | { kind: "hp" | "lp" }
    | null
  >(null);
  const sectionRef = useRef(section);
  const setBandValuesRef = useRef(setBandValues);
  const setPathRef = useRef(setPath);
  sectionRef.current = section;
  setBandValuesRef.current = setBandValues;
  setPathRef.current = setPath;

  const points = useMemo(() => {
    const arr: number[] = [];
    const mn = Math.log10(MIN_FREQ), mx = Math.log10(MAX_FREQ);
    // 280 log-spaced samples are visually continuous at this viewport while
    // reducing biquad response work by ~22% on every live EQ frame.
    for (let i = 0; i < 280; i++) arr.push(Math.pow(10, mn + (i / 279) * (mx - mn)));
    return arr;
  }, []);

  // Band edits mutate the section in place (only `preset` identity changes),
  // so depending on `section` alone leaves the curve memos stale while dots
  // move. Recompute from a value signature instead — FabFilter-style live curve.
  const curveSig = section
    ? section.bands.map((b) => `${b.type}|${b.frequencyHz}|${b.q}|${b.gainDb}`).join(";")
      + `#${section.crossover?.hpfHz}|${section.crossover?.lpfHz}|${section.crossover?.hpType}|${section.crossover?.lpType}|${section.crossover?.hpTypeRaw}|${section.crossover?.lpTypeRaw}`
    : "";

  const compositePath = useMemo(() => {
    if (!section) return "";
    return points.map((f, i) => {
      const sum = section.bands.reduce((acc, b) => acc + bandResponseDbAt(b, f), 0) + crossoverResponseDbAt(section.crossover, f);
      return `${i ? "L" : "M"} ${freqToX(f).toFixed(2)} ${gainToY(sum).toFixed(2)}`;
    }).join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, curveSig, points]);

  const crossoverPath = useMemo(() => {
    if (!section) return "";
    return points.map((f, i) => `${i ? "L" : "M"} ${freqToX(f).toFixed(2)} ${gainToY(crossoverResponseDbAt(section.crossover, f)).toFixed(2)}`).join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, curveSig, points]);

  const bandCurves = useMemo(() => {
    if (!section) return [] as { d: string; idx: number }[];
    return section.bands.map((band, idx) => {
      if (Math.abs(band.gainDb) < 0.05) return { d: "", idx };
      const d = points.map((f, i) => `${i ? "L" : "M"} ${freqToX(f).toFixed(2)} ${gainToY(bandResponseDbAt(band, f)).toFixed(2)}`).join(" ");
      return { d, idx };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, curveSig, points]);

  useEffect(() => {
    type PointerSample = Pick<PointerEvent, "clientX" | "clientY" | "shiftKey" | "ctrlKey" | "metaKey">;
    let pending: PointerSample | null = null;
    let moveFrame: number | null = null;

    const processMove = (e: PointerSample) => {
      const drag = dragRef.current;
      const activeSection = sectionRef.current;
      if (!drag || !activeSection || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      const y = ((e.clientY - rect.top) / rect.height) * H;

      // Draggable HP/LP crossover handles, like the yellow pucks in the
      // original Professional Audio System UI. Ranges must match the native
      // section limits: normal sections are 20..20000 Hz, Reverb/Echo use a
      // narrower effect-filter range.
      if (drag.kind !== "band") {
        const freq = xToFreq(x);
        const hpRange = filterRangeForEqKey(activeSection.key, "hpf");
        const lpRange = filterRangeForEqKey(activeSection.key, "lpf");
        if (drag.kind === "hp") {
          // HPF and LPF are independent native parameters. Do not constrain
          // one against the other: the device allows them to cross/overlap.
          setPathRef.current(`eq.${activeSection.key}.crossover.hpfHz`, clamp(freq, hpRange.min, hpRange.max));
        } else {
          setPathRef.current(`eq.${activeSection.key}.crossover.lpfHz`, clamp(freq, lpRange.min, lpRange.max));
        }
        return;
      }

      const band = activeSection.bands[drag.idx];
      if (!band) return;
      const fine = e.shiftKey;

      // Ctrl/Cmd + vertical drag = Q, FabFilter style.
      if (e.ctrlKey || e.metaKey) {
        const dy = y - drag.lastY;
        drag.lastX = x; drag.lastY = y;
        const factor = Math.exp(-dy * (fine ? 0.003 : 0.012));
        const nextQ = Math.round(clamp(safeQ(band.q) * factor, 0.1, 30) * 100) / 100;
        setBandValuesRef.current(drag.idx, { q: nextQ });
        return;
      }

      let nextFreq: number;
      let nextGain: number;
      if (fine) {
        // Fine mode: incremental, 25% pointer speed for surgical moves.
        const dx = (x - drag.lastX) * 0.25;
        const dy = (y - drag.lastY) * 0.25;
        nextFreq = xToFreq(freqToX(band.frequencyHz) + dx);
        nextGain = Math.round((band.gainDb + (yToGain(gainToY(band.gainDb) + dy) - band.gainDb)) * 10) / 10;
      } else {
        nextFreq = xToFreq(x);
        nextGain = yToGain(y);
        // Magnetic 0 dB snap for an easy return to flat (hold Shift to bypass).
        if (Math.abs(nextGain) < 0.3) nextGain = 0;
      }
      drag.lastX = x; drag.lastY = y;
      // One visual update per animation frame, even on a 500/1000 Hz mouse.
      setBandValuesRef.current(drag.idx, { frequencyHz: nextFreq, gainDb: nextGain });
    };

    const flushPendingMove = () => {
      moveFrame = null;
      const sample = pending;
      pending = null;
      if (sample) processMove(sample);
    };

    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      pending = {
        clientX: e.clientX,
        clientY: e.clientY,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
      };
      if (moveFrame === null) moveFrame = window.requestAnimationFrame(flushPendingMove);
    };
    const onUp = () => {
      if (pending) flushPendingMove();
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (moveFrame !== null) window.cancelAnimationFrame(moveFrame);
      moveFrame = null;
      pending = null;
    };
  }, []);

  if (!section) return null;
  const band = section.bands[selectedBand] ?? section.bands[0];
  const bandX = freqToX(band.frequencyHz);
  const bandY = gainToY(band.gainDb);
  // FabFilter-like floating editor: stay close to the selected node,
  // but never cover the main curve more than necessary. Prefer below the dot;
  // flip above only when the node is near the bottom of the canvas.
  const cardX = clamp(bandX, 190, W - 190);
  const placeBelow = bandY < H - 132;
  const cardY = placeBelow ? bandY + 18 : bandY - 18;
  const cardLeft = (cardX / W) * 100;
  const cardTop = clamp((cardY / H) * 100, 9, 88);

  return (
    <div className="panel-bevel overflow-hidden min-h-0 grid grid-rows-[auto_minmax(0,1fr)_auto]">
      <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 border-b border-[color:var(--bevel-hi)]">
        <div className="min-w-0">
          <div className="eyebrow">Parametric EQ · {section.bands.length} bands</div>
          <h3 className="font-display text-sm font-semibold truncate">{section.label}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {eqKeys.length > 1 && eqKeys.map((k) => (
            <button key={k} onClick={() => setEqKey(k)} className={cn("chrome-btn px-3 py-1 text-[11px] font-display", eqKey === k && "chrome-btn-active")}>
              {(EQ_SECTIONS as Record<string, { label: string }>)[k]?.label || k}
            </button>
          ))}
          {page === "mic" && (
            <label className={cn("mic-eq-link-control", micEqLinked && "active")} title="Link Mic A dan Mic B agar setiap edit PEQ dikirim ke kedua channel">
              <input type="checkbox" checked={micEqLinked} onChange={() => toggle("mic.eqLink")} />
              <span className="mic-eq-link-led" />
              <span>EQ LINK</span>
            </label>
          )}
        </div>
      </header>
      <div className="p-3 min-h-0">
        <div className="panel-inset relative h-full min-h-[280px] overflow-hidden">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="absolute inset-0 w-full h-full block"
            preserveAspectRatio="none"
            onWheel={(e) => {
              // DAW behavior: scrolling over the graph adjusts the selected band's Q.
              // The studio layout is fixed-height, so no scroll conflict exists.
              e.preventDefault();
              const active = section.bands[selectedBand];
              if (!active) return;
              const dir = e.deltaY < 0 ? 1 : -1;
              const precision = e.shiftKey ? 0.02 : 0.1;
              const nextQ = Math.round(clamp((Number(active.q) || 1) + dir * precision, 0.1, 30) * 100) / 100;
              setBandValue(selectedBand, "q", nextQ);
            }}
          >
            <defs>
              {/* userSpaceOnUse is essential for a perfectly-flat path: its
                  object bounding box has zero height, which makes the default
                  objectBoundingBox gradient invalid and hides the 0 dB curve. */}
              <linearGradient id="eqCompositeStroke" gradientUnits="userSpaceOnUse" x1={PAD.left} x2={W - PAD.right} y1={gainToY(0)} y2={gainToY(0)}>
                <stop offset="0" stopColor="oklch(0.85 0.14 200)" />
                <stop offset="0.55" stopColor="oklch(0.82 0.18 78)" />
                <stop offset="1" stopColor="oklch(0.85 0.14 200)" />
              </linearGradient>
              <linearGradient id="eqCompositeFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="oklch(0.85 0.14 200 / 24%)" />
                <stop offset="0.55" stopColor="oklch(0.85 0.14 200 / 8%)" />
                <stop offset="1" stopColor="oklch(0.85 0.14 200 / 0%)" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width={W} height={H} rx="10" fill="oklch(0.08 0.012 250 / 82%)" />
            {GRID_FREQS.map((f) => (
              <g key={`f${f}`}>
                <line x1={freqToX(f)} x2={freqToX(f)} y1={PAD.top} y2={H - PAD.bottom} stroke="oklch(1 0 0 / 5%)" strokeWidth={1} />
                <text x={freqToX(f)} y={H - 12} fill="oklch(0.66 0.018 250)" fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle">{formatFreq(f)}</text>
              </g>
            ))}
            {GRID_DBS.map((db) => (
              <g key={`db${db}`}>
                <line x1={PAD.left} x2={W - PAD.right} y1={gainToY(db)} y2={gainToY(db)} stroke={db === 0 ? "oklch(0.85 0.14 200 / 20%)" : "oklch(1 0 0 / 5%)"} strokeWidth={db === 0 ? 1.1 : 1} />
                <text x={12} y={gainToY(db) + 3} fill="oklch(0.66 0.018 250)" fontSize="10" fontFamily="JetBrains Mono">{db > 0 ? `+${db}` : db}</text>
              </g>
            ))}
            {bandCurves.map(({ d, idx }) => d && (
              <path key={idx} d={d} fill="none" stroke={idx === selectedBand ? "oklch(0.82 0.18 78 / 65%)" : "oklch(0.85 0.14 200 / 13%)"} strokeWidth={idx === selectedBand ? 1.6 : 1} strokeDasharray={idx === selectedBand ? "" : "3 5"} />
            ))}
            <path d={crossoverPath} fill="none" stroke="oklch(0.82 0.18 78 / 40%)" strokeWidth={1.2} strokeDasharray="6 6" />
            {compositePath && (
              <>
                <path d={`${compositePath} L ${freqToX(MAX_FREQ).toFixed(2)} ${gainToY(0).toFixed(2)} L ${freqToX(MIN_FREQ).toFixed(2)} ${gainToY(0).toFixed(2)} Z`} fill="url(#eqCompositeFill)" />
                {/* Dark separation stroke keeps a completely-flat EQ visible above the 0 dB grid line. */}
                <path d={compositePath} fill="none" stroke="oklch(0.015 0.004 250 / 88%)" strokeWidth={6.2} strokeLinecap="round" strokeLinejoin="round" />
                <path d={compositePath} fill="none" stroke="oklch(0.85 0.14 200 / 18%)" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
                <path d={compositePath} fill="none" stroke="url(#eqCompositeStroke)" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
              </>
            )}
            {section.crossover && ([
              { kind: "hp" as const, freq: section.crossover.hpfHz, label: "HP", sub: `${Math.round(section.crossover.hpfHz)}` },
              { kind: "lp" as const, freq: section.crossover.lpfHz, label: "LP", sub: formatFreq(Math.round(section.crossover.lpfHz)) },
            ].map(({ kind, freq, label, sub }) => {
              const cx = freqToX(freq);
              const cy = gainToY(0);
              const dragging = dragRef.current?.kind === kind;
              const beginCrossoverDrag = (e: React.PointerEvent<SVGElement>) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                dragRef.current = { kind };
              };
              return (
                <g key={kind}>
                  <line x1={cx} x2={cx} y1={PAD.top} y2={H - PAD.bottom} stroke="oklch(0.82 0.18 78 / 35%)" strokeDasharray="4 5" pointerEvents="none" />
                  <text x={kind === "hp" ? cx + 12 : cx - 12} y={PAD.top + 14} fontSize="9" fontFamily="JetBrains Mono" fill="oklch(0.82 0.18 78 / 85%)" textAnchor={kind === "hp" ? "start" : "end"} pointerEvents="none">{sub} Hz</text>
                  {/* Wide invisible hit target: the full vertical HP/LP line is draggable, not only the puck. */}
                  <line
                    x1={cx} x2={cx} y1={PAD.top} y2={H - PAD.bottom}
                    stroke="transparent" strokeWidth={24}
                    pointerEvents="stroke"
                    style={{ cursor: "ew-resize", touchAction: "none" }}
                    onPointerDown={beginCrossoverDrag}
                  />
                  {/* Draggable crossover puck on the 0 dB line, like the native app */}
                  <circle cx={cx} cy={cy} r={dragging ? 16 : 13} fill="oklch(0.82 0.18 78 / 16%)" pointerEvents="none" />
                  <circle
                    cx={cx} cy={cy} r={9}
                    fill="oklch(0.82 0.18 78)"
                    stroke="oklch(0 0 0 / 75%)" strokeWidth={1.5}
                    style={{ cursor: "ew-resize", touchAction: "none" }}
                    onPointerDown={beginCrossoverDrag}
                  />
                  <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize="8" fontFamily="JetBrains Mono" fontStyle="italic" fill="oklch(0.1 0 0)" fontWeight="800" pointerEvents="none">{label}</text>
                </g>
              );
            }))}
            {section.bands.map((node, idx) => {
              const x = freqToX(node.frequencyHz);
              const y = gainToY(node.gainDb);
              const isSel = idx === selectedBand;
              return (
                <g key={idx}>
                  <circle
                    cx={x}
                    cy={y}
                    r={isSel ? 18 : 13}
                    fill={isSel ? "oklch(0.85 0.14 200 / 17%)" : "oklch(0.82 0.18 78 / 12%)"}
                    pointerEvents="none"
                  />
                  <circle cx={x} cy={y} r={isSel ? 10.5 : 8}
                    fill={isSel ? "oklch(0.85 0.14 200)" : "oklch(0.78 0.17 70)"}
                    stroke="oklch(0 0 0 / 75%)" strokeWidth={1.5}
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => {
                      (e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId);
                      const rect = svgRef.current?.getBoundingClientRect();
                      const px = rect ? ((e.clientX - rect.left) / rect.width) * W : x;
                      const py = rect ? ((e.clientY - rect.top) / rect.height) * H : y;
                      dragRef.current = { kind: "band", idx, lastX: px, lastY: py };
                      selectBand(idx);
                    }}
                    onDoubleClick={(e) => {
                      // DAW convention: double-click a node returns it to 0 dB.
                      e.preventDefault();
                      selectBand(idx);
                      setBandValues(idx, { gainDb: 0 });
                    }}
                    onClick={() => selectBand(idx)}
                  />
                  <text x={x} y={y + 3.5} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fill="oklch(0.1 0 0)" fontWeight="800" pointerEvents="none">{node.index}</text>
                </g>
              );
            })}
          </svg>
          <div className={cn("eq-floating-card", placeBelow ? "below" : "above")} style={{ left: `${cardLeft}%`, top: `${cardTop}%` }}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div><div className="eyebrow">Band {band.index}</div><strong className="font-display text-sm">{band.type === "P" ? "Bell" : band.type === "LS" ? "Low Shelf" : "High Shelf"}</strong></div>
              <button onClick={resetSelectedBand} className="chrome-btn px-2 py-1 text-[10px]">Reset</button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <label><span>Type</span><select className="studio-select" value={band.type as string} onChange={(e) => setBandValue(selectedBand, "type", e.target.value)}><option>P</option><option>LS</option><option>HS</option></select></label>
              <label><span>Freq</span><input className="studio-input" type="number" value={band.frequencyHz} min={20} max={20000} onChange={(e) => setBandValue(selectedBand, "frequencyHz", e.target.value)} /></label>
              <label><span>Q</span><input className="studio-input" type="number" value={band.q} min={0.1} max={30} step={0.1} onChange={(e) => setBandValue(selectedBand, "q", e.target.value)} /></label>
              <label><span>Gain</span><input className="studio-input" type="number" value={band.gainDb} min={-24} max={24} step={0.1} onChange={(e) => setBandValue(selectedBand, "gainDb", e.target.value)} /></label>
            </div>
          </div>
        </div>
      </div>
      <footer className="px-3 pb-3 flex items-center gap-2 overflow-hidden">
        <div className="eq-band-dock flex-1 min-w-0">
          {section.bands.map((b, idx) => (
            <button key={idx} onClick={() => selectBand(idx)} className={cn("eq-band-pill", idx === selectedBand && "active")}>
              <span>B{b.index}</span><strong>{b.type}</strong><em>{formatFreq(b.frequencyHz)}</em><small>{b.gainDb > 0 ? "+" : ""}{b.gainDb.toFixed(1)}</small>
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
