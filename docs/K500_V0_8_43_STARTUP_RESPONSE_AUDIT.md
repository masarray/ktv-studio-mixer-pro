# SONKUPIK STUDIO v0.8.43 — Startup and Response Audit

## Outcome

The application remains Electron + React. A C++/JUCE rewrite is not required
for responsive editing or fast installed startup. The slow portable cold start
is primarily the NSIS portable wrapper extracting Electron on every launch.
The Setup build is therefore the recommended daily-use package.

## Measured cold document path

Measured locally from `startAppServer()` through the complete first-document
response using the same production output:

| Build path | Server ready | First document | Total |
| --- | ---: | ---: | ---: |
| v0.8.42 runtime SSR path | 7.29 ms | 258.43 ms | 265.72 ms |
| v0.8.43 prerendered path | 5.84 ms | 17.52 ms | 23.36 ms |

The local server-to-document critical path is 91.2% shorter. These numbers do
not include Windows process creation or portable extraction; measure those on
the final Windows artifact because they depend on disk, antivirus, and host.

## Startup findings and fixes

1. **Native bridge blocked window creation.** The desktop process awaited the
   WebSocket bridge before creating its BrowserWindow. The window now loads
   first and the bridge starts with a deferred dynamic import. Device bridge
   failure no longer prevents local preset editing.
2. **SSR ran on every cold launch.** The only desktop route is prerendered at
   build time. `index.html` is served directly and the SSR bundle is retained
   only as a lazy fallback.
3. **Oversized logo payload.** A 1254 px source was loaded into a 32 px toolbar
   slot and duplicated in the production output. Runtime UI now uses the 128 px
   icon and the copied client payload is approximately half its previous size.
4. **Deprecated Vite path plugin.** The redundant plugin was removed in favor
   of Vite's native `resolve.tsconfigPaths`, eliminating repeated build warnings.

## Interaction findings and fixes

1. **Preset binary diff on every input event.** Exact diffing serialized the
   complete preset during fader movement. It is now isolated and computed 180
   ms after input settles.
2. **PEQ pointer listener churn.** Pointer listeners were detached and attached
   again whenever the EQ section identity changed. Stable refs now keep one
   listener pair for the component lifetime.
3. **High-rate pointer events.** 500/1000 Hz mouse events are coalesced to one
   state update per animation frame. The live-device queue retains its trailing
   update so the final position still reaches the K500.
4. **Unchanged controls rerendered.** Vertical faders and knobs are memoized;
   only controls whose displayed value or state changed repaint.
5. **Dynamic SVG filters.** PEQ, compressor, and knob drop-shadow filters were
   replaced with lightweight layered strokes/circles. The visual glow remains
   without allocating a filter surface during every frame.
6. **Curve workload.** The PEQ curve uses 280 log-spaced samples instead of 360,
   reducing response calculations by about 22% with no meaningful visual loss
   at the supported viewport.

## Packaging decision

- `SONKUPIK-STUDIO-<version>-Setup.exe`: recommended, permanent extraction and
  the fastest repeated startup.
- `SONKUPIK-STUDIO-<version>-Portable.exe`: supported for no-install use; cold
  start remains inherently slower because its application directory is removed
  and extracted again on every launch.
- `build-installer.cmd`: new one-click installer-only build path.

## Validation

- TypeScript `--noEmit`: passed.
- Production client, SSR, and prerender build: passed.
- Embedded desktop server and shutdown: passed.
- Windows packaging configuration: passed.
- Existing v0.8.42 feature hardening: passed.
- New v0.8.43 performance regression checks: passed.

Physical Windows cold-start timing and K500 transport behavior should be
confirmed once on the generated Setup artifact and real hardware.
