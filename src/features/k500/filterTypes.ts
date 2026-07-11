export type CrossoverFilterKind = "hpf" | "lpf";
export type CrossoverFilterFamily = "bessel" | "butter" | "lr";

export interface CrossoverFilterDescriptor {
  code: number;
  order: 2 | 3 | 4;
  family: CrossoverFilterFamily;
  label: string;
}

const DESCRIPTORS: Readonly<Record<number, Omit<CrossoverFilterDescriptor, "code" | "label">>> = Object.freeze({
  0x01: Object.freeze({ family: "bessel", order: 2 }),
  0x02: Object.freeze({ family: "butter", order: 2 }),
  0x03: Object.freeze({ family: "bessel", order: 3 }),
  0x04: Object.freeze({ family: "butter", order: 3 }),
  0x05: Object.freeze({ family: "bessel", order: 4 }),
  0x06: Object.freeze({ family: "butter", order: 4 }),
  0x07: Object.freeze({ family: "lr", order: 4 }),
});

function prefix(kind: CrossoverFilterKind): "HP" | "LP" {
  return kind === "hpf" ? "HP" : "LP";
}

function familyLabel(family: CrossoverFilterFamily): string {
  if (family === "bessel") return "Bessel";
  if (family === "lr") return "LR";
  return "Butter";
}

function slopeDb(order: number): number {
  return order * 6;
}

export function crossoverFilterLabel(kind: CrossoverFilterKind, code: number): string {
  const spec = DESCRIPTORS[code] ?? DESCRIPTORS[0x02];
  return `${prefix(kind)} ${familyLabel(spec.family)} ${slopeDb(spec.order)}`;
}

export const FILTER_TYPE_OPTIONS: Readonly<Record<CrossoverFilterKind, readonly string[]>> = Object.freeze({
  hpf: Object.freeze([1, 2, 3, 4, 5, 6, 7].map((code) => crossoverFilterLabel("hpf", code))),
  lpf: Object.freeze([1, 2, 3, 4, 5, 6, 7].map((code) => crossoverFilterLabel("lpf", code))),
});

const LABEL_TO_CODE: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(
    (["hpf", "lpf"] as const).flatMap((kind) =>
      [1, 2, 3, 4, 5, 6, 7].map((code) => [crossoverFilterLabel(kind, code), code]),
    ),
  ),
);

export function crossoverFilterCode(label: unknown, raw?: unknown, fallback = 0x02): number {
  const fromLabel = LABEL_TO_CODE[String(label ?? "")];
  if (fromLabel !== undefined) return fromLabel;
  const lowByte = Number(raw) & 0xff;
  return DESCRIPTORS[lowByte] ? lowByte : fallback;
}

export function crossoverFilterRaw(kind: CrossoverFilterKind, label: unknown, raw?: unknown): number {
  const code = crossoverFilterCode(label, raw);
  return (kind === "hpf" ? 0x0400 : 0x0300) | code;
}

export function describeCrossoverFilter(kind: CrossoverFilterKind, label: unknown, raw?: unknown): CrossoverFilterDescriptor {
  const code = crossoverFilterCode(label, raw);
  const spec = DESCRIPTORS[code] ?? DESCRIPTORS[0x02];
  return {
    code,
    family: spec.family,
    order: spec.order,
    label: crossoverFilterLabel(kind, code),
  };
}

export const FILTER_TYPE_TO_UI = new Map<number, string>(
  (["hpf", "lpf"] as const).flatMap((kind) =>
    [1, 2, 3, 4, 5, 6, 7].map((code) => [
      (kind === "hpf" ? 0x0400 : 0x0300) | code,
      crossoverFilterLabel(kind, code),
    ] as const),
  ),
);

export const UI_TO_FILTER_TYPE: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(
    (["hpf", "lpf"] as const).flatMap((kind) =>
      [1, 2, 3, 4, 5, 6, 7].map((code) => [
        crossoverFilterLabel(kind, code),
        (kind === "hpf" ? 0x0400 : 0x0300) | code,
      ]),
    ),
  ),
);
