import { useEffect } from "react";
import { Bluetooth, Cable, Power, Radio, Trash2, Usb } from "lucide-react";
import { useK500Live } from "@/features/k500/live/liveStore";
import { cn } from "@/lib/utils";
import { Led, LedReadout, Panel } from "./primitives";

export function LiveDevicePill() {
  const status = useK500Live((s) => s.status);
  const liveEnabled = useK500Live((s) => s.liveEnabled);
  const connect = useK500Live((s) => s.connect);
  const disconnect = useK500Live((s) => s.disconnect);
  const setLiveEnabled = useK500Live((s) => s.setLiveEnabled);
  const lastError = useK500Live((s) => s.lastError);
  const transportMode = useK500Live((s) => s.transportMode);
  const setTransportMode = useK500Live((s) => s.setTransportMode);
  const hydrateTransportMode = useK500Live((s) => s.hydrateTransportMode);

  useEffect(() => {
    hydrateTransportMode();
  }, [hydrateTransportMode]);

  const connected = status === "connected";
  const busy = status === "connecting";
  const unsupported = status === "unsupported";
  const error = status === "error";
  const liveLedColor = error ? "red" : liveEnabled && connected ? "green" : "amber";

  return (
    <div className={cn("panel-inset h-[34px] px-2 flex items-center gap-2 min-w-[365px]", connected && "ring-1 ring-[color:var(--cyan)]/25")}
      title={unsupported ? "Web Serial/WebHID tidak tersedia. Pakai Chrome/Edge di localhost." : lastError || "K500 Smart Connect · scans remembered BT + USB first"}
    >
      <button
        type="button"
        disabled={!connected}
        onClick={() => setLiveEnabled(!liveEnabled)}
        className={cn(
          "flex items-center gap-1.5 shrink-0 rounded-md px-1.5 py-1 transition-colors",
          connected ? "hover:bg-white/5" : "cursor-default",
        )}
        title={connected ? `Live edit ${liveEnabled ? "aktif" : "pause"} · klik untuk ${liveEnabled ? "pause" : "aktifkan"}` : "Hubungkan device untuk live edit"}
        aria-pressed={connected && liveEnabled}
      >
        <Led color={liveLedColor} on={(connected && liveEnabled) || error} />
        <span className={cn("eyebrow text-[9px]", connected && liveEnabled && "text-[color:var(--meter-green)]")}>LIVE</span>
      </button>

      {/* Preferred transport. Connect still smart-scans remembered BT + USB before asking permission. */}
      <div className="flex items-center rounded-md border border-border/60 bg-black/30 p-[2px] gap-[2px]" role="tablist" aria-label="Transport">
        <button
          role="tab"
          aria-selected={transportMode === "bt"}
          disabled={connected || busy}
          onClick={() => setTransportMode("bt")}
          className={cn("px-1.5 py-[3px] rounded-[5px] text-[9px] font-display inline-flex items-center gap-1 transition-colors",
            transportMode === "bt" ? "bg-[color:var(--cyan)]/15 text-[color:var(--cyan)] shadow-[inset_0_0_0_1px_var(--cyan)]/30" : "text-muted-foreground hover:text-foreground")}
          title="Prefer Bluetooth SPP. Smart Connect tetap scan USB remembered juga."
        >
          <Bluetooth size={11} /> BT
        </button>
        <button
          role="tab"
          aria-selected={transportMode === "usb"}
          disabled={connected || busy}
          onClick={() => setTransportMode("usb")}
          className={cn("px-1.5 py-[3px] rounded-[5px] text-[9px] font-display inline-flex items-center gap-1 transition-colors",
            transportMode === "usb" ? "bg-[color:var(--cyan)]/15 text-[color:var(--cyan)] shadow-[inset_0_0_0_1px_var(--cyan)]/30" : "text-muted-foreground hover:text-foreground")}
          title="Prefer USB HID DSP AUDIO. Smart Connect tetap scan BT remembered juga."
        >
          <Usb size={11} /> USB
        </button>
      </div>

      <button
        onClick={() => connected ? disconnect() : connect()}
        disabled={busy || unsupported}
        className={cn("chrome-btn px-2 py-1 text-[10px] font-display inline-flex items-center gap-1", connected && "chrome-btn-active")}
      >
        {connected ? <Power size={12} /> : busy ? <Radio size={12} className="animate-pulse" /> : <Cable size={12} />}
        {busy ? "Scanning" : connected ? "Disconnect" : "Connect"}
      </button>

      <LedReadout
        value={unsupported ? "NO WEB SERIAL" : error ? "ERROR" : connected ? (liveEnabled ? "SYNC" : "READY") : "OFFLINE"}
        color={connected ? "cyan" : "amber"}
        size="sm"
        className="ml-auto"
      />
    </div>
  );
}

export function LiveDeviceInspector() {
  const status = useK500Live((s) => s.status);
  const transportMode = useK500Live((s) => s.transportMode);
  const liveEnabled = useK500Live((s) => s.liveEnabled);
  const portLabel = useK500Live((s) => s.portLabel);
  const lastTx = useK500Live((s) => s.lastTx);
  const lastRx = useK500Live((s) => s.lastRx);
  const lastError = useK500Live((s) => s.lastError);
  const log = useK500Live((s) => s.log);
  const clearLog = useK500Live((s) => s.clearLog);

  return (
    <Panel
      eyebrow="Device"
      title="K500 Live Sync"
      right={<Led color={status === "connected" ? "green" : status === "error" ? "red" : "amber"} />}
      className="shrink-0"
      bodyClassName="p-3"
    >
      <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-x-2 gap-y-1 text-[10px] font-mono">
        <span className="text-muted-foreground">Status</span><span className={status === "connected" ? "text-[color:var(--meter-green)]" : status === "error" ? "text-[color:var(--meter-red)]" : "text-[color:var(--amber)]"}>{status.toUpperCase()}</span>
        <span className="text-muted-foreground">Live edit</span><span className={liveEnabled ? "text-[color:var(--cyan)]" : "text-muted-foreground"}>{liveEnabled ? "ON" : "OFF"}</span>
        <span className="text-muted-foreground">Transport</span><span>{transportMode === "usb" ? "USB HID · DSP AUDIO" : "Bluetooth SPP"}</span>
        <span className="text-muted-foreground">Port</span><span className="truncate">{portLabel}</span>
        <span className="text-muted-foreground">Last TX</span><span className="truncate">{lastTx || "—"}</span>
        <span className="text-muted-foreground">Last RX</span><span className="truncate">{lastRx || "—"}</span>
      </div>
      {lastError && <p className="mt-2 text-[10px] font-mono text-[color:var(--meter-red)]">{lastError}</p>}
      <div className="mt-3 flex items-center justify-between">
        <span className="eyebrow">Serial log</span>
        <button onClick={clearLog} className="chrome-btn px-2 py-1 text-[10px] inline-flex items-center gap-1"><Trash2 size={11}/> Clear</button>
      </div>
      <div className="mt-2 panel-inset max-h-[118px] overflow-auto p-2 font-mono text-[9.5px] leading-relaxed">
        {log.length === 0 ? <span className="text-muted-foreground">No serial activity yet.</span> : log.slice(0, 18).map((line, i) => (
          <div key={`${line.ts}-${i}`} className={cn("grid grid-cols-[58px_34px_1fr] gap-1", line.dir === "TX" ? "text-[color:var(--cyan)]" : line.dir === "RX" ? "text-[color:var(--meter-green)]" : line.dir === "ERR" ? "text-[color:var(--meter-red)]" : "text-muted-foreground")}>
            <span>{line.ts}</span><span>{line.dir}</span><span className="truncate">{line.label}{line.data ? ` · ${line.data}` : ""}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground leading-snug">
        Connect auto-scans remembered ports and identifies the K500 by its heartbeat signature — the chooser only appears once per port (browser security). Live edit writes RAM/current state. Save and Mass Upload use the native verified permanent slot protocol over USB.
      </p>
    </Panel>
  );
}
