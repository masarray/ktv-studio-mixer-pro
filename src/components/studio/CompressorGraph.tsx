const W = 400;
const H = 206;
const PAD = { left: 36, right: 22, top: 18, bottom: 30 };
const MIN = -60, MAX = 0;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const toX = (db: number) => PAD.left + ((db - MIN) / (MAX - MIN)) * (W - PAD.left - PAD.right);
const toY = (db: number) => {
  const t = (clamp(db, MIN, MAX) - MIN) / (MAX - MIN);
  return H - PAD.bottom - t * (H - PAD.top - PAD.bottom);
};

export function CompressorGraph({ thresholdDb, ratio, knee = 4 }: { thresholdDb: number; ratio: number; knee?: number }) {
  const th = clamp(Number(thresholdDb) || -20, MIN, -1);
  const r = clamp(Number(ratio) || 1, 1, 100);
  const out = (input: number) => {
    if (input <= th - knee / 2) return input;
    if (input >= th + knee / 2) return th + (input - th) / r;
    const t = (input - (th - knee / 2)) / knee;
    const hard = th + (input - th) / r;
    return input + (hard - input) * t * t * (3 - 2 * t);
  };
  const pts = Array.from({ length: 140 }, (_, i) => MIN + (i / 139) * (MAX - MIN));
  const ref = pts.map((db, i) => `${i ? "L" : "M"} ${toX(db).toFixed(2)} ${toY(db).toFixed(2)}`).join(" ");
  const curve = pts.map((db, i) => `${i ? "L" : "M"} ${toX(db).toFixed(2)} ${toY(out(db)).toFixed(2)}`).join(" ");
  const postPts = pts.filter((db) => db >= th);
  const fill = postPts.length
    ? `M ${toX(postPts[0]).toFixed(2)} ${toY(postPts[0]).toFixed(2)} ` +
      postPts.map((db) => `L ${toX(db).toFixed(2)} ${toY(out(db)).toFixed(2)}`).join(" ") +
      ` L ${toX(postPts[postPts.length - 1]).toFixed(2)} ${toY(postPts[postPts.length - 1]).toFixed(2)} Z`
    : "";
  const slopeStart = Math.max(th + 4, MIN);
  const slopeEnd = 0;

  return (
    <div className="panel-inset p-2 compressor-slope-shell">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full block" preserveAspectRatio="none">
        <defs>
          <linearGradient id="compStroke" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="oklch(0.85 0.14 200)" />
            <stop offset="0.58" stopColor="oklch(0.78 0.17 70)" />
            <stop offset="1" stopColor="oklch(0.85 0.14 200)" />
          </linearGradient>
          <linearGradient id="compFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="oklch(0.78 0.17 70 / 24%)" />
            <stop offset="1" stopColor="oklch(0.85 0.14 200 / 2%)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={W} height={H} rx="12" fill="oklch(0.08 0.012 250 / 82%)" />
        {[-60, -48, -36, -24, -12, 0].map((db) => (
          <g key={`v${db}`}>
            <line x1={toX(db)} x2={toX(db)} y1={PAD.top} y2={H - PAD.bottom} stroke="oklch(1 0 0 / 5%)" />
            <text x={toX(db)} y={H - 9} fontSize="9" fontFamily="JetBrains Mono" fill="oklch(0.66 0.018 250)" textAnchor="middle">{db}</text>
          </g>
        ))}
        {[-48, -36, -24, -12, 0].map((db) => (
          <g key={`h${db}`}>
            <line x1={PAD.left} x2={W - PAD.right} y1={toY(db)} y2={toY(db)} stroke={db === 0 ? "oklch(1 0 0 / 16%)" : "oklch(1 0 0 / 5%)"} />
            <text x={8} y={toY(db) + 3} fontSize="9" fontFamily="JetBrains Mono" fill="oklch(0.66 0.018 250)">{db}</text>
          </g>
        ))}
        {fill && <path d={fill} fill="url(#compFill)" />}
        <path d={ref} fill="none" stroke="oklch(1 0 0 / 22%)" strokeDasharray="4 4" strokeWidth={1.1} />
        <path d={curve} fill="none" stroke="url(#compStroke)" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 7px oklch(0.85 0.14 200 / 48%))" }} />
        <line x1={toX(th)} x2={toX(th)} y1={PAD.top} y2={H - PAD.bottom} stroke="oklch(0.82 0.18 78)" strokeDasharray="4 4" opacity="0.78" />
        <line x1={toX(slopeStart)} y1={toY(out(slopeStart))} x2={toX(slopeEnd)} y2={toY(out(slopeEnd))} stroke="oklch(0.85 0.14 200 / 42%)" strokeWidth={5} strokeLinecap="round" opacity=".24" />
        <circle cx={toX(th)} cy={toY(th)} r="5" fill="oklch(0.82 0.18 78)" style={{ filter: "drop-shadow(0 0 8px oklch(0.82 0.18 78 / 85%))" }} />
        <text x={toX(th) + 7} y={PAD.top + 13} fontSize="10" fontFamily="JetBrains Mono" fill="oklch(0.82 0.18 78)">TH {th} dB</text>
        <text x={W - PAD.right - 3} y={PAD.top + 13} fontSize="10" fontFamily="JetBrains Mono" fill="oklch(0.85 0.14 200)" textAnchor="end">SLOPE 1:{r}</text>
        <text x={PAD.left + 3} y={PAD.top + 13} fontSize="9" fontFamily="JetBrains Mono" fill="oklch(0.66 0.018 250)">IN → OUT</text>
      </svg>
    </div>
  );
}
