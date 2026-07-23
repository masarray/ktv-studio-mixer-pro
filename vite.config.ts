import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/** Starts the K500 native bridge alongside `vite dev` so Connect can scan
 *  COM/HID devices from Node — zero browser permission popups. */
function k500BridgePlugin(): Plugin {
  return {
    name: "k500-bridge",
    async configureServer() {
      try {
        const { startBridge } = await import("./tools/k500-bridge.mjs");
        await startBridge();
      } catch (err) {
        console.warn("[k500-bridge] tidak aktif:", (err as Error)?.message);
        console.warn("[k500-bridge] jalankan `npm install` untuk dependensi bridge (ws, serialport, node-hid)");
      }
    },
  };
}

export default defineConfig({
  plugins: [
    k500BridgePlugin(),
    tanstackStart({
      server: { entry: "server" },
      // The desktop app has one deterministic shell. Render it once at build
      // time so every installed launch can serve index.html directly instead
      // of booting the SSR bundle for the first document.
      prerender: {
        enabled: true,
        crawlLinks: false,
      },
      pages: [{ path: "/" }],
      sitemap: { enabled: false },
    }),
    viteReact(),
    tailwindcss(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
