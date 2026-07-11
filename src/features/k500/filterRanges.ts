export type FilterKind = "hpf" | "lpf";

export type FilterRange = Readonly<{ min: number; max: number }>;

const FULL_RANGE: Record<FilterKind, FilterRange> = Object.freeze({
  hpf: Object.freeze({ min: 20, max: 20000 }),
  lpf: Object.freeze({ min: 20, max: 20000 }),
});

const FX_RANGE: Record<FilterKind, FilterRange> = Object.freeze({
  hpf: Object.freeze({ min: 20, max: 1000 }),
  lpf: Object.freeze({ min: 4000, max: 16000 }),
});

function clamp(value: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function filterRangeForEqKey(eqKey: string, kind: FilterKind): FilterRange {
  return eqKey === "reverb" || eqKey === "echo" ? FX_RANGE[kind] : FULL_RANGE[kind];
}

export function clampFilterHz(eqKey: string, kind: FilterKind, hz: number): number {
  const range = filterRangeForEqKey(eqKey, kind);
  return clamp(hz, range.min, range.max);
}

export function filterRangeForPath(path: string): FilterRange | null {
  const eqMatch = /^eq\.([^.]+)\.crossover\.(hpfHz|lpfHz)$/.exec(path);
  if (eqMatch) return filterRangeForEqKey(eqMatch[1], eqMatch[2] === "hpfHz" ? "hpf" : "lpf");

  if (path === "mic.hpfHz") return FULL_RANGE.hpf;
  if (path === "mic.lpfHz") return FULL_RANGE.lpf;
  if (path === "outputs.sub.hpfHz") return FULL_RANGE.hpf;
  if (path === "outputs.sub.lpfHz") return FULL_RANGE.lpf;

  if (path === "effects.reverb.hpfHz" || path === "effects.echo.hpfHz") return FX_RANGE.hpf;
  if (path === "effects.reverb.lpfHz" || path === "effects.echo.lpfHz") return FX_RANGE.lpf;

  return null;
}

export function clampFilterPathValue(path: string, value: unknown): unknown {
  const range = filterRangeForPath(path);
  if (!range) return value;
  return clamp(Number(value), range.min, range.max);
}
