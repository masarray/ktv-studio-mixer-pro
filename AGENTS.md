# KTV Studio Mixer Pro — Production Engineering Contract

This file is the operating contract for every human or automated coding agent modifying this repository.

## 1. Product posture

KTV Studio Mixer Pro / Sonkupik Studio is production desktop engineering software, not a throwaway Electron prototype.

Every change must preserve device reliability, UI responsiveness, preset integrity, packaging reliability, and operator trust. Do not implement a naive version first and plan to harden it later unless the task is explicitly marked as a disposable experiment.

Prefer the smallest production-quality change that solves the root cause without adding a second state model, parallel implementation, hidden polling loop, or speculative abstraction.

## 2. Mandatory workflow before editing

For every non-trivial change:

1. locate the current implementation and its actual owner;
2. reproduce or characterize the current behavior;
3. identify the invariant that is broken;
4. trace renderer, Electron main/preload, device bridge, persistence, and packaging impact as applicable;
5. define the failure mode and regression test;
6. implement the smallest coherent fix;
7. validate build, tests, runtime behavior, failure path, and performance where applicable.

Bug loop:

`reproduce → minimise → trace → root cause → fix → regression test → validate`

Do not rewrite a working subsystem because a local patch looks easier.

### Three-patch circuit breaker

If three consecutive patches in the same subsystem still chase symptoms, STOP before a fourth patch. Re-audit ownership, state flow, event flow, timing, and architecture. Do not stack more timers, retries, flags, duplicated state, or catch-all handlers.

## 3. Architecture boundaries

Maintain explicit ownership:

```text
Renderer / React UI
        ↓ typed commands + snapshots
Preload / IPC boundary
        ↓
Electron main process
        ↓
Device / transport services
        ↓
HID / serial / network / native modules
```

Rules:

- Renderer code must not become the owner of physical device lifecycle.
- Hardware handles, reconnect state, transport state, and native-module lifetime belong outside React rendering.
- The UI consumes coherent snapshots and sends explicit commands.
- Do not create separate renderer and main-process truths for the same device state.
- One subsystem must own each mutable resource and lifecycle.
- Preset representation must have one authoritative model; UI projections are not alternative preset engines.

## 4. Device communication contract

Treat HID, serial, sockets, K500/KTV hardware, USB devices, and native bridges as unreliable external systems.

Validate:

- device availability and identity;
- frame/message length;
- indexes and bounds;
- version/capability fields;
- malformed or partial responses;
- disconnect during command;
- timeout and cancellation;
- stale handles after reconnect;
- duplicate/out-of-order events where the transport permits them.

Device state should use an explicit state machine such as:

`Disconnected → Connecting → Ready → Recovering → Faulted → Disconnected`

Do not solve races with arbitrary delays.

Reconnect must be bounded and observable. Repeated failures require backoff rather than restart loops.

A failed command must not silently mutate the UI as though the hardware accepted it. Promote candidate state only after the responsible layer has enough evidence to do so.

## 5. Result-oriented failure architecture

Expected runtime failures must use explicit structured outcomes rather than exception-driven normal control flow.

Examples include:

- device not found;
- unsupported command;
- invalid preset;
- malformed frame;
- timeout;
- disconnected transport;
- stale request;
- cancelled operation;
- packaging metadata validation failure.

Use language-appropriate Result/status/discriminated-union patterns with fields such as success/failure code, operation, recoverability, and safe user-facing message.

Exceptions remain appropriate for genuinely exceptional framework/programming faults and build-time fatal configuration errors. Catch infrastructure exceptions at meaningful boundaries, convert expected cases into structured failure, preserve diagnostics, and never silently swallow them.

## 6. Async diagnostics without performance penalty

High-frequency paths must never synchronously format or write verbose diagnostics.

Use bounded diagnostics:

- compact event/status payloads at the producer;
- bounded queue/ring/channel;
- aggregation, deduplication, and rate limiting;
- formatting/file output in background or low-priority work;
- counters for repeated events instead of thousands of identical rows.

Diagnostic failure must not block device I/O or freeze the UI.

Never allow an unbounded log queue.

## 7. Zero UI blocking

The renderer/UI thread is for interaction and presentation.

Do not synchronously perform on the UI path:

- device discovery;
- HID/serial I/O;
- filesystem scans;
- large preset import/export;
- mass upload parsing;
- packaging or native-module work;
- large JSON transforms;
- long-running calculations.

Use async I/O and worker/background execution where appropriate. Keep cancellation explicit.

The 16.7 ms 60 Hz frame time is a total frame budget, not permission for each handler to consume 16 ms.

## 8. High-frequency UI and control updates

Meters, faders, PEQ curves, device telemetry, spectrum-like views, and continuous controls must be bounded.

- Do not render once per device packet.
- Coalesce continuous fader/knob updates where safe.
- Separate acquisition/control frequency from visual refresh frequency.
- Prefer latest-state semantics for visual telemetry.
- Never let visual refresh backpressure block device command processing.
- Avoid rebuilding large React trees for small meter/control changes.
- Memoization is useful only where ownership and measurement justify it; do not cargo-cult memoize everything.

## 9. React state rules

- Keep authoritative domain/device state outside transient component-local copies when multiple surfaces depend on it.
- Derived values should be derived, not independently synchronized by effects.
- Avoid effect chains that bounce state between components/stores.
- Do not create polling effects when a proper event/snapshot source already exists.
- Every subscription/listener/timer must have deterministic cleanup.
- Stable selection identity must not depend solely on mutable array index.

For faders and knobs, selected/highlight state must be explicit and must not leak to unrelated controls.

## 10. DSP/preset integrity

Preset and DSP parameter work must preserve:

- parameter identity and units;
- flat/default semantics;
- PEQ curve visibility and correctness;
- HPF/LPF semantics;
- FBX controllability rules;
- compressor/limiter ranges;
- artist preset data;
- device command mapping;
- serialization compatibility where required.

Do not change audible behavior merely to simplify the UI.

A preset load/import should be treated as candidate state: parse → validate → normalize only when defined → commit atomically. Failed import must leave the last-known-good state intact.

## 11. Native module and Electron boundary

`node-hid`, `serialport`, Electron, and other native modules require explicit lifecycle and packaging validation.

- Do not load/rebuild native modules on hot interaction paths.
- Do not spawn one worker/process per event.
- Keep native-module errors contained at the bridge/service boundary.
- Avoid renderer dependence on Node internals.
- Preserve context isolation/security boundaries already used by the application.
- Installer and portable packages must be tested as packaged apps; browser/dev-server success does not prove device access works in packaged Electron.

## 12. Packaging invariants

The supported Windows release must continue to produce distinct usable artifacts as configured by the repository:

- installer / NSIS artifact;
- portable artifact.

Do not silently collapse them into one ZIP or one ambiguous release asset.

Packaging changes must validate Electron metadata, native modules, device access assumptions, output names, version consistency, and startup behavior.

Do not claim packaging complete because `vite build` succeeds.

## 13. Memory and resource lifecycle

Every long-lived resource needs deterministic ownership and cleanup:

- HID/serial handles;
- sockets/WebSockets;
- timers;
- subscriptions;
- IPC listeners;
- file watchers;
- workers/child processes;
- native resources.

Repeated connect/disconnect, window reopen, preset load, and device switch must not leak listeners or handles.

Use pooling/reuse only when measured allocation pressure justifies the complexity.

## 14. Performance contract

Performance is a feature.

For changes affecting startup, device responsiveness, fader interaction, large panels, presets, or packaging, record before/after evidence where practical.

Track relevant metrics such as:

- cold/warm startup time;
- renderer long tasks;
- interaction latency;
- device command round-trip latency;
- reconnect time;
- idle CPU;
- connected CPU;
- memory after sustained use;
- event/listener count after repeated lifecycle operations.

A repeatable regression above roughly 10% in a relevant metric requires investigation and explicit justification before merge. Do not invent absolute thresholds when no baseline exists.

## 15. Regression protection

Every bug fix should add the highest-value stable regression test practical for the failure mode.

This repository already contains targeted scripts for packaging, layout, UX controls, hardening, performance, presets, and desktop server behavior. Reuse and extend those tests rather than creating duplicate validation systems.

When shared behavior changes, identify all consumers first.

## 16. Change discipline

- smallest coherent change;
- no unrelated refactor;
- no duplicate implementation because it is easier locally;
- no arbitrary sleeps as race fixes;
- no unbounded retry/polling loops;
- no new dependency without clear purpose and runtime/package impact review;
- no speculative cache/worker/pool unless a bottleneck is identified;
- preserve working user flows unless the task explicitly replaces them.

## 17. Definition of done

A meaningful change is done only when applicable evidence exists for:

`BUILD + LINT/STATIC CHECK + TARGETED TEST + REGRESSION + FAILURE PATH + PACKAGED/DESKTOP PATH + PERFORMANCE + LIFECYCLE`

For device work, validate the packaged Electron path when possible; web/dev mode alone is insufficient evidence.

For UI work, validate behavior as well as appearance.

For performance-sensitive changes, compare against a baseline rather than saying “optimized” without measurement.

## 18. Agent patch report

Every substantial patch must report:

1. root cause;
2. changed files and behavior;
3. architecture/state ownership impact;
4. regression protection;
5. performance impact/evidence;
6. validation actually run;
7. remaining limitations or unproven hardware paths.

Never claim completion from a screenshot, successful hot reload, or one happy-path device interaction.

## Final rule

Think like the maintainer responsible for this application during repeated real device sessions and releases.

Understand first. Fix root causes. Keep one state authority. Bound hot paths. Keep device I/O out of React rendering. Preserve package/device behavior. Validate failure paths. Measure regressions. Do not stack patches until the application becomes heavier and harder to reason about.
