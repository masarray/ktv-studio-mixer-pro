# K500 Live Alpha v0.7.5 — SSR Serial Guard Fix

## Fix

v0.7.4 failed during TanStack Start server-side rendering because `serialSupported()` was referenced in the Zustand store initializer but the helper function was missing.

This version restores an SSR-safe helper:

```ts
function serialSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.serial;
}
```

On the server it returns `false` without touching Web Serial. In the browser, the Connect button can still use `navigator.serial`.

## Kept from v0.7.4

- Default Flat editor visible on startup.
- No "Wake the console" landing screen.
- Connect follows the original PC software sequence:
  - `AA 01 1C E3`
  - `AA 01 3F C0`
  - `AA 06 40 ... 63 ...`
- UI syncs from device readback after connect.
