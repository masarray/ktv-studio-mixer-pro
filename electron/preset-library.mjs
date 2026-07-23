import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

export function provisionBuiltInPresets({ sourceRoot, presetRoot, logger = console }) {
  mkdirSync(presetRoot, { recursive: true });
  if (!existsSync(sourceRoot)) {
    logger.warn?.(`[desktop] built-in preset folder not found: ${sourceRoot}`);
    return { installed: [], preserved: [] };
  }

  const installed = [];
  const preserved = [];
  for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".k500")) continue;
    const destination = path.join(presetRoot, entry.name);
    // Factory presets live in an app-managed directory. The separate Documents
    // library remains user-owned and is never overwritten by provisioning.
    if (existsSync(destination)) {
      preserved.push(entry.name);
      continue;
    }
    copyFileSync(path.join(sourceRoot, entry.name), destination);
    installed.push(entry.name);
    logger.log?.(`[desktop] installed built-in preset: ${destination}`);
  }

  return { installed, preserved };
}
