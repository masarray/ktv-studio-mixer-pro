import { memo, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/* ============== Panel ============== */
export function Panel({
  eyebrow,
  title,
  right,
  className,
  bodyClassName,
  children,
}: {
  eyebrow?: string;
  title?: string;
  right?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={cn("panel-bevel flex flex-col", className)}>
      {(eyebrow || title || right) && (
        <header className="flex items-end justify-between gap-3 px-4 pt-3 pb-2 border-b border-[color:var(--bevel-hi)]">
          <div className="eyebrow panel-heading-label" title={title || eyebrow}>
            {title || eyebrow}
          </div>
          {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ============== LED ============== */
export function Led({ color = "amber", on = true, className }: { color?: "amber" | "cyan" | "green" | "red"; on?: boolean; className?: string }) {
  const cls =
    color === "cyan" ? "text-[color:var(--cyan)]"
    : color === "green" ? "text-[color:var(--meter-green)]"
    : color === "red" ? "text-[color:var(--meter-red)]"
    : "text-[color:var(--amber)]";
  return (
    <span
      className={cn("led-dot", on ? cls : "text-[color:var(--muted-foreground)] opacity-30", className)}
      aria-hidden
    />
  );
}

/* ============== LED Readout ============== */
export function LedReadout({
  value,
  unit,
  color = "amber",
  className,
  size = "md",
}: {
  value: string | number;
  unit?: string;
  color?: "amber" | "cyan";
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeCls = size === "lg" ? "text-2xl px-3 py-1.5" : size === "sm" ? "text-[11px] px-2 py-1" : "text-sm px-2.5 py-1";
  const ledCls = color === "cyan" ? "led-cyan" : "led-amber";
  return (
    <div className={cn("panel-inset readout inline-flex items-baseline gap-1", sizeCls, ledCls, className)}>
      <span>{value}</span>
      {unit && <span className="text-[0.7em] opacity-80">{unit}</span>}
    </div>
  );
}

/* ============== Vertical Fader ============== */
export const VerticalFader = memo(function VerticalFader({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  badge,
  format,
  disabled,
  height = 126,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange?: (v: number) => void;
  badge?: string;
  format?: (v: number) => string;
  disabled?: boolean;
  height?: number;
}) {
  const display = format ? format(value) : `${value}${unit ? ` ${unit}` : ""}`;
  return (
    <div className="fader-strip flex flex-col items-center gap-1.5 px-1.5 py-1.5 rounded-lg overflow-visible">
      <div className="fader-label-slot flex flex-col items-center gap-0.5">
        <div className="fader-label text-[10px] font-semibold tracking-wider uppercase text-center font-display text-muted-foreground">{label}</div>
        {badge && <div className="eyebrow text-[9px] text-muted-foreground/80">{badge}</div>}
      </div>
      <div className="relative mx-auto fader-track-shell" style={{ height, width: 42 }}>
        <div className="absolute inset-y-1 -left-2 flex flex-col justify-between pointer-events-none">
          {[0,1,2,3,4,5,6].map((i) => (
            <span key={i} className="block h-px w-2 bg-[color:var(--bevel-hi)]" />
          ))}
        </div>
        <div className="absolute inset-y-1 -right-2 flex flex-col justify-between pointer-events-none">
          {[0,1,2,3,4,5,6].map((i) => (
            <span key={i} className="block h-px w-2 bg-[color:var(--bevel-hi)]" />
          ))}
        </div>
        <input
          className="fader-input"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={`${label} fader`}
          aria-valuetext={display}
          onChange={(e) => onChange?.(Number(e.target.value))}
          onWheel={(e) => {
            if (disabled || !onChange) return;
            e.preventDefault();
            const dir = e.deltaY < 0 ? 1 : -1;
            const baseStep = Number(step) || 1;
            const wheelStep = e.shiftKey ? baseStep / 10 : baseStep;
            const next = Math.max(Number(min), Math.min(Number(max), Number(value) + dir * wheelStep));
            onChange(baseStep >= 1 ? Math.round(next) : Number(next.toFixed(2)));
          }}
        />
      </div>
      <LedReadout className="fader-readout justify-center" value={display.replace(/ .*$/, "")} unit={unit || (typeof display === "string" ? display.split(" ")[1] : "")} size="sm" />
    </div>
  );
}, (previous, next) => (
  previous.label === next.label
  && previous.value === next.value
  && previous.min === next.min
  && previous.max === next.max
  && previous.step === next.step
  && previous.unit === next.unit
  && previous.badge === next.badge
  && previous.disabled === next.disabled
  && previous.height === next.height
  && String(previous.format) === String(next.format)
));

/* ============== Knob (rotary) ============== */
export const Knob = memo(function Knob({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  format,
  size = 64,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange?: (v: number) => void;
  format?: (v: number) => string;
  size?: number;
}) {
  const t = (value - min) / (max - min || 1);
  const angle = -135 + t * 270;
  const display = format ? format(value) : `${value}${unit ? ` ${unit}` : ""}`;
  const ref = useRef<HTMLDivElement | null>(null);
  const dragging = useRef<{ y: number; v: number } | null>(null);
  const onChangeRef = useRef(onChange);
  const pendingValue = useRef<number | null>(null);
  const changeFrame = useRef<number | null>(null);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    const scheduleChange = (next: number) => {
      pendingValue.current = next;
      if (changeFrame.current !== null) return;
      changeFrame.current = window.requestAnimationFrame(() => {
        changeFrame.current = null;
        const pending = pendingValue.current;
        pendingValue.current = null;
        if (pending !== null) onChangeRef.current?.(pending);
      });
    };
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dy = dragging.current.y - e.clientY;
      const range = max - min;
      const sensitivity = e.shiftKey ? 0.25 : 1;
      const delta = (dy / 180) * range * sensitivity;
      let next = dragging.current.v + delta;
      if (step >= 1) next = Math.round(next);
      else next = Math.round(next / step) * step;
      next = Math.max(min, Math.min(max, next));
      scheduleChange(Number(next.toFixed(2)));
    };
    const up = () => { dragging.current = null; document.body.style.cursor = ""; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (changeFrame.current !== null) window.cancelAnimationFrame(changeFrame.current);
      changeFrame.current = null;
      pendingValue.current = null;
    };
  }, [min, max, step]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="eyebrow text-[9px]">{label}</div>
      <div
        ref={ref}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          dragging.current = { y: e.clientY, v: value };
          document.body.style.cursor = "ns-resize";
        }}
        onDoubleClick={() => onChange?.(min + (max - min) / 2)}
        onWheel={(e) => {
          e.preventDefault();
          const dir = e.deltaY < 0 ? 1 : -1;
          let next = value + dir * (e.shiftKey ? step : Math.max(step, (max - min) / 100));
          next = Math.max(min, Math.min(max, next));
          onChange?.(Number(next.toFixed(2)));
        }}
        className="knob-control relative select-none cursor-ns-resize"
        style={{ width: size, height: size }}
        role="slider"
        tabIndex={0}
        aria-label={`${label} knob`}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={display}
        onKeyDown={(e) => {
          if (e.key !== "ArrowUp" && e.key !== "ArrowRight" && e.key !== "ArrowDown" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          const dir = e.key === "ArrowUp" || e.key === "ArrowRight" ? 1 : -1;
          const next = Math.max(min, Math.min(max, value + dir * step));
          onChange?.(Number(next.toFixed(2)));
        }}
      >
        <svg viewBox="0 0 100 100" width={size} height={size}>
          <defs>
            <radialGradient id="knobFace" cx="50%" cy="35%" r="65%">
              <stop offset="0" stopColor="oklch(0.42 0.015 250)" />
              <stop offset="0.7" stopColor="oklch(0.22 0.015 250)" />
              <stop offset="1" stopColor="oklch(0.12 0.015 250)" />
            </radialGradient>
          </defs>
          {/* arc track */}
          <path d="M 18 82 A 36 36 0 1 1 82 82" fill="none" stroke="oklch(0 0 0 / 60%)" strokeWidth="4" strokeLinecap="round" />
          {/* arc value */}
          <path
            d="M 18 82 A 36 36 0 1 1 82 82"
            fill="none"
            stroke="oklch(0.85 0.14 200 / 16%)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="170"
            strokeDashoffset={170 - t * 170}
          />
          <path
            d="M 18 82 A 36 36 0 1 1 82 82"
            fill="none"
            stroke="var(--cyan)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="170"
            strokeDashoffset={170 - t * 170}
          />
          <circle cx="50" cy="64" r="24.5" fill="url(#knobFace)" stroke="oklch(0 0 0 / 70%)" />
          <g transform={`rotate(${angle} 50 64)`}>
            <line x1="50" y1="43" x2="50" y2="53" stroke="var(--amber)" strokeWidth="3" strokeLinecap="round" />
          </g>
        </svg>
      </div>
      <LedReadout value={display.replace(new RegExp(`\\s*${unit}$`), "")} unit={unit} size="sm" />
    </div>
  );
}, (previous, next) => (
  previous.label === next.label
  && previous.value === next.value
  && previous.min === next.min
  && previous.max === next.max
  && previous.step === next.step
  && previous.unit === next.unit
  && previous.size === next.size
  && String(previous.format) === String(next.format)
));

/* ============== Toggle ============== */
export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn("chrome-btn flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium",
        value && "chrome-btn-active")}
    >
      <span className="font-display">{label}</span>
      <Led color={value ? "cyan" : "amber"} on={value} />
    </button>
  );
}

/* ============== Mini number input ============== */
export function NumberField({
  label, value, min, max, step = 1, unit, onChange, className,
}: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void;
  className?: string;
}) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => setLocal(String(value)), [value]);
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="eyebrow">{label}{unit ? ` · ${unit}` : ""}</span>
      <input
        type="number"
        className="studio-input"
        min={min} max={max} step={step}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onChange(Number(local))}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      />
    </label>
  );
}

/* ============== Select ============== */
export function SelectField({
  label, value, options, onChange,
}: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="eyebrow">{label}</span>
      <select className="studio-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
