import { useStudio } from "@/features/k500/store";
import { cn } from "@/lib/utils";
import { Panel } from "./primitives";

export function BandTable() {
  const preset = useStudio((s) => s.preset);
  const eqKey = useStudio((s) => s.eqKey);
  const selectedBand = useStudio((s) => s.selectedBand);
  const selectBand = useStudio((s) => s.selectBand);
  const setBandValue = useStudio((s) => s.setBandValue);

  const section = preset?.eq?.[eqKey];
  if (!section) return null;

  return (
    <Panel eyebrow="Band Matrix" title={`${section.label} · ${section.bands.length} bands`} bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 w-10">B</th>
              <th className="px-2 py-2 w-16">Type</th>
              <th className="px-2 py-2">Freq (Hz)</th>
              <th className="px-2 py-2">Q</th>
              <th className="px-2 py-2">Gain (dB)</th>
              <th className="px-3 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {section.bands.map((band, idx) => {
              const sel = idx === selectedBand;
              return (
                <tr
                  key={idx}
                  onClick={() => selectBand(idx)}
                  className={cn(
                    "border-t border-[color:var(--bevel-hi)] cursor-pointer transition-colors",
                    sel ? "bg-[oklch(0.85_0.14_200/0.07)]" : "hover:bg-[oklch(1_0_0/0.025)]",
                  )}
                >
                  <td className="px-3 py-1.5">
                    <span className={cn("inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold readout",
                      sel ? "bg-[color:var(--cyan)] text-[color:var(--primary-foreground)]"
                          : "bg-[oklch(0_0_0/0.4)] text-[color:var(--amber)]")}>{band.index}</span>
                  </td>
                  <td className="px-2 py-1.5">
                    <select className="studio-select" value={band.type as string}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setBandValue(idx, "type", e.target.value)}>
                      {["P", "LS", "HS"].map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" min={20} max={20000} className="studio-input"
                      value={band.frequencyHz}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setBandValue(idx, "frequencyHz", e.target.value)} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" min={0.1} max={30} step={0.1} className="studio-input"
                      value={band.q}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setBandValue(idx, "q", e.target.value)} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" min={-24} max={24} step={0.1} className="studio-input"
                      value={band.gainDb}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setBandValue(idx, "gainDb", e.target.value)} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {Math.abs(band.gainDb) >= 14 && (
                      <span className="led-dot text-[color:var(--meter-red)]" title="High gain" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
