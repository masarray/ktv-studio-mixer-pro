import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useStudio } from "@/features/k500/store";
import type { PageKey } from "@/features/k500/types";
import { cn } from "@/lib/utils";
import {
  Mic2, Music2, Speaker, Waves, RadioTower, Activity, Sparkles, Repeat, Settings2,
  Upload, Download, SkipBack, SkipForward, Play, VolumeX,
} from "lucide-react";
import { LedReadout } from "./primitives";
import { MasterSection } from "./MasterSection";
import { EqGraph } from "./EqGraph";
import { MicPage, MusicPage, OutputPage, ReverbPage, EchoPage, SystemPage } from "./pages";
import { LiveDevicePill } from "./LiveDevicePanel";
import { useK500Live } from "@/features/k500/live/liveStore";

const sonkupikLogo = "/sonkupik-icon-128.png";

const NAV: { key: PageKey; label: string; desc: string; Icon: any }[] = [
  { key: "music", label: "Music", desc: "Source & tone", Icon: Music2 },
  { key: "mic", label: "Mic", desc: "Dual vocal input", Icon: Mic2 },
  { key: "reverb", label: "Reverb", desc: "Room tail", Icon: Sparkles },
  { key: "echo", label: "Echo", desc: "Delay engine", Icon: Repeat },
  { key: "main", label: "Main", desc: "Front output", Icon: Speaker },
  { key: "surround", label: "Surround", desc: "Rear field", Icon: Waves },
  { key: "center", label: "Center", desc: "Vocal focus", Icon: RadioTower },
  { key: "sub", label: "Sub", desc: "Bass management", Icon: Activity },
  { key: "system", label: "System", desc: "Global setup", Icon: Settings2 },
];

function PlayerTransportControls() {
  const status = useK500Live((s) => s.status);
  const sendPlayerCommand = useK500Live((s) => s.sendPlayerCommand);
  const toggleMute = useK500Live((s) => s.toggleMute);
  const mute = useK500Live((s) => s.mute);
  const connected = status === "connected";

  const buttonClass = "transport-icon-btn chrome-btn grid place-items-center";
  return (
    <div className="player-transport-cluster panel-inset flex items-center gap-1 p-1 shrink-0" aria-label="Player transport">
      <button type="button" className={buttonClass} disabled={!connected} onClick={() => void sendPlayerCommand("rewind")} title="Previous / rewind">
        <SkipBack size={14} fill="currentColor" />
      </button>
      <button type="button" className={cn(buttonClass, "transport-play-btn")} disabled={!connected} onClick={() => void sendPlayerCommand("playPause")} title="Play / pause">
        <Play size={15} fill="currentColor" />
      </button>
      <button type="button" className={buttonClass} disabled={!connected} onClick={() => void sendPlayerCommand("forward")} title="Next / forward">
        <SkipForward size={14} fill="currentColor" />
      </button>
      <span className="player-transport-divider" />
      <button type="button" className={cn(buttonClass, mute && "chrome-btn-active player-mute-active")} disabled={!connected} onClick={() => void toggleMute()} title={mute ? "Unmute" : "Mute"}>
        <VolumeX size={14} />
      </button>
    </div>
  );
}

function TransportBar() {
  const presetName = useStudio((s) => s.preset?.name ?? "— NO PRESET —");
  const hasPreset = useStudio((s) => Boolean(s.preset));
  const importBuffer = useStudio((s) => s.importBuffer);
  const exportPreset = useStudio((s) => s.exportPreset);
  const fileRef = useRef<HTMLInputElement | null>(null);

  return (
    <header className="panel-bevel px-4 py-2.5 flex items-center gap-4 h-[52px] shrink-0">
      <div className="flex items-center gap-3 shrink-0 w-[300px]">
        <div className="brushed-metal w-10 h-10 grid place-items-center rounded-md border border-[color:var(--bevel-hi)] overflow-hidden bg-[oklch(1_0_0/0.04)]"
          style={{ boxShadow: "inset 0 1px 0 oklch(1 0 0 / 18%), 0 2px 6px oklch(0 0 0 / 60%)" }}>
          <img src={sonkupikLogo} alt="Sonkupik" className="w-8 h-8 object-contain" />
        </div>
        <div>
          <h1 className="font-display text-sm font-bold leading-none tracking-tight">
            SONKUPIK <span className="text-[color:var(--gold)]">STUDIO</span>
          </h1>
          <div className="eyebrow mt-0.5">Karaoke Processor</div>
        </div>
      </div>

      <div className="flex items-center gap-2 mx-auto min-w-0">
        <PlayerTransportControls />
        <LedReadout value={presetName} size="md" color="amber" className="max-w-[260px] truncate" />
        <LiveDevicePill />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <input ref={fileRef} type="file" accept=".k500,application/octet-stream" hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = () => importBuffer(reader.result as ArrayBuffer, f.name);
            reader.readAsArrayBuffer(f);
            e.target.value = "";
          }}
        />
        <button onClick={() => fileRef.current?.click()} className="chrome-btn px-3 py-1.5 text-xs font-display flex items-center gap-1.5">
          <Upload size={14} /> Import
        </button>
        <button
          onClick={exportPreset}
          disabled={!hasPreset}
          className={cn("chrome-btn px-3 py-1.5 text-xs font-display flex items-center gap-1.5", hasPreset && "chrome-btn-active")}
        >
          <Download size={14} /> Export
        </button>
      </div>
    </header>
  );
}

function RackNav() {
  const page = useStudio((s) => s.page);
  const setPage = useStudio((s) => s.setPage);
  return (
    <nav className="rack-nav panel-bevel shrink-0 p-2 flex flex-col gap-1.5 overflow-hidden">
      <div className="eyebrow px-2 pt-1 pb-2">Sections</div>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-1.5">
        {NAV.map(({ key, label, desc, Icon }) => {
          const active = page === key;
          return (
            <button
              key={key}
              onClick={() => setPage(key)}
              className={cn("group flex items-center gap-3 px-2.5 py-2 rounded-lg border text-left transition",
                active
                  ? "bg-linear-to-r from-[oklch(0.85_0.14_200/0.12)] to-transparent border-[color:var(--cyan)]/40"
                  : "border-transparent hover:bg-[oklch(1_0_0/0.03)]")}
            >
              <span className={cn("w-7 h-7 grid place-items-center rounded-md border",
                active ? "border-[color:var(--cyan)]/60 text-[color:var(--cyan)]"
                       : "border-[color:var(--bevel-hi)] text-muted-foreground group-hover:text-foreground")}>
                <Icon size={14} />
              </span>
              <span>
                <span className={cn("block text-xs font-display font-semibold leading-tight", active ? "led-cyan" : "text-foreground")}>{label}</span>
                <span className="block text-[10px] text-muted-foreground leading-tight">{desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function EmptyState() {
  return <div className="panel-bevel flex-1 min-h-0" />;
}

function PageContent({ systemMaster }: { systemMaster?: ReactNode }) {
  const page = useStudio((s) => s.page);
  const hasPreset = useStudio((s) => Boolean(s.preset));
  if (!hasPreset) return <EmptyState />;

  const showEq = page !== "system";
  const PageBody = (() => {
    switch (page) {
      case "mic": return <MicPage />;
      case "music": return <MusicPage />;
      case "main": return <OutputPage which="main" />;
      case "surround": return <OutputPage which="surround" />;
      case "center": return <OutputPage which="center" />;
      case "sub": return <OutputPage which="sub" />;
      case "reverb": return <ReverbPage />;
      case "echo": return <EchoPage />;
      case "system": return <SystemPage masterSlot={systemMaster} />;
    }
  })();

  return (
    <main className="studio-page-content flex-1 min-h-0 overflow-hidden">
      <div
        className="grid h-full min-h-0 overflow-hidden gap-3"
        style={{ gridTemplateRows: showEq ? "minmax(0, 1fr) 304px" : "1fr" }}
      >
        {showEq && <EqGraph />}
        <div className="rack-row min-h-0 h-full overflow-visible">{PageBody}</div>
      </div>
    </main>
  );
}

export function StudioShell() {
  const hasPreset = useStudio((s) => Boolean(s.preset));
  const page = useStudio((s) => s.page);
  const importDefaultFlat = useStudio((s) => s.importDefaultFlat);
  const liveStatus = useK500Live((s) => s.status);

  useEffect(() => {
    if (!hasPreset) void importDefaultFlat();
  }, [hasPreset, importDefaultFlat]);

  return (
    <div className="studio-shell h-screen w-full p-3 flex flex-col gap-3 overflow-hidden" data-live-status={liveStatus}>
      <TransportBar />
      <div className={cn(
        "studio-workspace flex gap-3 flex-1 min-h-0 overflow-hidden",
        page === "system" ? "studio-workspace-system" : "studio-workspace-peq",
      )}>
        <RackNav />
        <PageContent systemMaster={page === "system" ? <MasterSection /> : undefined} />
        {page !== "system" && <MasterSection />}
      </div>
    </div>
  );
}
