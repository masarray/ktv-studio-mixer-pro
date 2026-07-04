import { createFileRoute } from "@tanstack/react-router";
import { StudioShell } from "@/components/studio/StudioShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "K500 Preset Studio — Karaoke Processor Console" },
      { name: "description", content: "DAW-grade editor for KTV K500 karaoke processor presets — EQ, dynamics, routing, checksum-safe export." },
      { property: "og:title", content: "K500 Preset Studio" },
      { property: "og:description", content: "DAW-grade editor for KTV K500 karaoke processor presets." },
    ],
  }),
  component: Index,
});

function Index() {
  return <StudioShell />;
}
