# AGENTS.md — SonkuPik Studio / KTV Mixer Production Engineering Contract

These rules apply to every AI/code agent working in this repository. This application combines React/TypeScript UI, Electron desktop runtime, serial/HID/WebSocket device communication, preset/data processing, packaging, and native dependencies. Responsiveness, device reliability, bounded memory, startup performance, and regression safety are product requirements from the first implementation.

## 1. Prime directive

Do not begin with a deliberately naive, disposable, prototype-only, or intentionally simplified implementation when the production architecture is knowable.

Choose the smallest production-quality solution that satisfies the requirement without speculative over-engineering.

Priority order:
1. correctness of device/preset/audio-control semantics;
2. crash/failure containment;
3. regression compatibility;
4. UI responsiveness and startup latency;
5. bounded memory/CPU/event throughput;
6. maintainability and testability.

Never make a control look correct while its device command, preset state, or desktop transport remains wrong.

## 2. Mandatory workflow

For non-trivial work:

RECONNAISSANCE -> REPRODUCE/BASELINE -> ROOT CAUSE -> INVARIANTS -> ARCHITECTURE IMPACT -> IMPLEMENT -> REGRESSION TEST -> FAILURE-PATH TEST -> PERFORMANCE CHECK -> BUILD/PACKAGE -> REAL WORKFLOW VALIDATION

Before editing:
- locate the authoritative state store and device transport path;
- trace UI -> state -> IPC/bridge -> serial/HID/WebSocket/native path when applicable;
- identify existing tests and packaging/runtime constraints;
- identify which existing behavior must not change;
- determine root cause before applying a visual or timing patch;
- reuse existing abstractions rather than creating a second transport/store/preset parser.

If an attempted fix fails, stop and reassess assumptions. Do not stack workaround on workaround.

## 3. Architecture boundaries

Keep responsibilities separated:

React presentation
-> application/state layer
-> device/service adapters
-> Electron IPC/main-process/native/platform integration

Rules:
- React components must not directly own long-lived serial/HID/socket resources;
- one authoritative device/session state model should drive the UI;
- avoid duplicate mutable copies of fader, DSP, preset, connection, or lock state;
- transport parsing and command framing must be outside rendering code;
- Electron main-process responsibilities must not leak into renderer code except through narrow validated APIs;
- do not add architectural layers without a current purpose.

## 4. Defensive JavaScript/TypeScript

Treat device, IPC, file, preset, storage, network, and native-module data as fallible.

Use:
- optional chaining (`?.`) and nullish coalescing (`??`) where appropriate;
- Zod or equivalent runtime schema validation at untrusted boundaries already supported by the project;
- explicit type guards and range checks;
- finite-number validation for DSP/fader parameters;
- bounds checks before indexing arrays/buffers;
- timeout/cancellation/abort handling for long-running operations.

Do not use non-null assertions as a substitute for validating data that can genuinely be missing.

Do not wrap every function in generic `try/catch`. Catch at meaningful I/O, IPC, native, parsing, or transport boundaries. Do not silently swallow errors.

One malformed preset, device response, or native-module failure must not crash the whole application when safe isolation is possible.

## 5. Zero renderer/UI blocking

The renderer thread exists for user interaction and rendering.

Never perform synchronous long-running:
- filesystem traversal or large file parsing;
- native-module initialization that may block;
- serial/HID discovery loops;
- network/WebSocket setup/retry loops;
- large preset generation/serialization;
- heavy DSP math or bulk data transforms

on the React renderer/UI path.

For a 60 Hz interface, ~16.7 ms is the total frame budget, not permission for each handler to consume 16 ms.

Use asynchronous I/O. Move CPU-heavy work to a worker or main-process/background execution when it measurably exceeds the interactive budget.

Never use synchronous busy waiting or arbitrary delays to hide race conditions.

## 6. High-frequency device data: batching and backpressure

Serial, HID, WebSocket, native callbacks, meters, faders, or other high-frequency events must not cause one full React update per incoming event.

Use bounded buffering, coalescing, latest-value semantics, batching, throttling, or backpressure according to semantics.

Rules:
- no unbounded event queues;
- no one Promise/task/timer per packet when sustained traffic is possible;
- separate device acquisition frequency from presentation refresh rate;
- preserve the final exact user-controlled value after drag/coalescing;
- stale visual telemetry may be dropped/coalesced when loss is acceptable;
- command/ack flows requiring lossless ordering must use explicit bounded queues and acknowledgements.

## 7. React rendering discipline

Avoid broad rerenders for local control changes.

Prefer:
- narrow selectors for Zustand or other stores;
- stable component boundaries;
- memoization only when it prevents proven/reasonable expensive rerender work;
- virtualization for large lists/tables/preset catalogs/logs;
- immutable updates with minimal changed state;
- decoupled meter/visual telemetry from static configuration UI.

Do not put rapidly changing meter/device values into a giant global object that causes unrelated controls to rerender.

Do not recreate expensive chart data, option arrays, schema objects, or large derived collections on every render when they can be retained/derived narrowly.

## 8. Device transport and reconnect rules

Never assume the K500/device/serial/HID/WebSocket/native endpoint behaves perfectly.

Handle explicitly:
- device missing at startup;
- permission/access failure;
- disconnect during command;
- reconnect;
- partial/truncated frame;
- invalid command response;
- timeout;
- duplicate/stale response;
- unsupported firmware/device variant;
- application shutdown while I/O is pending.

Reconnect must be bounded and state-driven. Do not create runaway polling/reconnect loops.

Transport callbacks must not directly perform expensive React work.

A disconnected device must not freeze the app or make the renderer progressively heavier.

## 9. IPC and Electron boundary

Keep Electron renderer privileges minimal and interfaces explicit.

Rules:
- validate IPC payloads on both sides where practical;
- do not expose raw Node/Electron capabilities to renderer code unnecessarily;
- avoid sending huge payloads repeatedly across IPC;
- batch/coalesce high-frequency IPC telemetry;
- do not use synchronous IPC for work that can block;
- release listeners when windows/components/services are destroyed;
- avoid duplicate IPC listener registration after hot reload/navigation/reconnect.

Never fix device access by weakening the desktop security boundary without a documented reason and focused review.

## 10. Native module lifecycle

`node-hid`, `serialport`, and other native modules may block, fail to load, or behave differently in packaged builds.

Keep native access behind owned service boundaries.

Validate:
- module load failure;
- device enumeration failure;
- packaged resource path differences;
- architecture/ABI mismatch;
- shutdown while handles are open;
- installer vs portable runtime behavior.

Every device/file/socket/native handle must be closed deterministically.

Do not let native errors become unhandled promise rejections or renderer crashes.

## 11. Preset/data integrity

Preset generation/import/export must be deterministic.

Validate schema, ranges, missing fields, version compatibility, and device-specific assumptions before application.

Do not invent values for corrupted preset fields without an explicit migration/default rule.

Keep built-in preset source and generated catalog behavior synchronized through existing generation/check scripts.

A UI display state must not silently diverge from the actual preset/device value.

## 12. Large data and visualization

Large preset catalogs, logs, histories, tables, or chart datasets must not be rendered eagerly in full.

Use virtualization/lazy loading/paging/downsampling where relevant.

Dense charts should render a bounded representation appropriate to visible pixel width rather than all historical samples.

Avoid keeping duplicate full-size transformed copies of large datasets if a view/index can serve the same purpose.

## 13. Memory and lifecycle

Avoid repeated allocation and listener churn in hot paths.

Release/cleanup:
- timers/intervals;
- AbortControllers;
- WebSocket connections;
- serial/HID handles;
- Electron IPC listeners;
- native callbacks;
- subscriptions;
- worker threads;
- file handles;
- large temporary buffers.

Every subscription or listener added by a component/service must have a matching cleanup path.

Do not use generic object pooling unless profiling shows allocation pressure and the lifecycle remains clear.

## 14. Startup and idle performance

The application must remain light even while disconnected.

Do not run high-frequency polling, animation, reconnection, chart updates, or repeated device scans when no device/session requires them.

Prefer event-driven or adaptive low-frequency idle behavior.

Startup should defer non-critical work until after the interactive shell is ready when safe to do so.

Do not preload large optional data/native work just because it may be used later.

## 15. Packaging is part of the product

Web/dev-server success does not prove Electron portable/installer correctness.

When relevant, validate:
- Vite production build;
- Electron runtime startup;
- native module loading;
- device discovery/connection in packaged mode;
- portable package;
- NSIS installer;
- clean-machine/resource-path assumptions.

Do not declare a desktop connectivity bug fixed using only the web app.

Packaging work must not silently change runtime/device behavior.

## 16. Performance contract

For performance-sensitive changes, measure relevant signals when practical:
- renderer frame/jank behavior;
- React render frequency;
- idle CPU usage;
- memory working set;
- event queue depth;
- device update rate versus UI refresh rate;
- startup-to-interactive time;
- reconnect latency;
- native module load time;
- portable/installer startup behavior.

Do not claim optimization without evidence.

Prefer reducing work and state propagation over adding more threads, caches, or memoization blindly.

## 17. Regression prevention

Every bug fix should add/update a regression test or deterministic source/runtime check when practical.

Protect exact known failure modes: packaged-device connection, preset state parity, fader selection behavior, locked-control behavior, system layout, startup/idle performance, native module handling, IPC/listener duplication, and packaging metadata.

Use the existing test scripts in `package.json` and extend them rather than creating redundant one-off checks when possible.

Do not change preset format, device command mapping, persistent settings, or packaging semantics without compatibility analysis.

## 18. Change discipline

Prefer the smallest coherent root-cause fix.

Do not:
- mix unrelated UI redesign with a device transport bug fix;
- duplicate Zustand stores/services/transports;
- add polling because existing state synchronization is not understood;
- rewrite a working subsystem simply because the current bug is difficult;
- add dependencies without evaluating bundle size, native packaging risk, maintenance, security, and runtime overhead;
- add caches/workers/pools without identifying the bottleneck they solve.

## 19. Definition of done

A task is not complete because `npm run build` passes.

Validate as applicable:
LINT/STATIC CHECKS
+ UNIT/SOURCE TESTS
+ REGRESSION TEST
+ FAILURE-PATH TEST
+ VITE PRODUCTION BUILD
+ ELECTRON STARTUP
+ PACKAGED NATIVE-MODULE CHECK
+ DEVICE/TRANSPORT WORKFLOW
+ PERFORMANCE/IDLE CHECK
+ PORTABLE/INSTALLER VALIDATION

Never claim a check was run when it was not.

## 20. Agent completion report

Report:
- Changed;
- Root cause;
- architecture/state ownership decision;
- regression protection;
- performance impact;
- exact validation executed;
- remaining genuine limitations.

## Final rule

Think like the maintainer supporting a live desktop device-control product on real Windows machines for years, not like a prototype generator optimizing for one screenshot.

Understand state ownership first. Keep transport bounded. Keep renderer work minimal. Clean up resources. Validate packaged behavior. Fix root causes. Prevent regressions.
