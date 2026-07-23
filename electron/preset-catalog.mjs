import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PRESET_CATALOG_URL =
  "https://raw.githubusercontent.com/masarray/ktv-studio-mixer-pro/main/preset-catalog/presets-manifest.json";

const STATE_FILE = ".catalog-state.json";
const K500_SIZE = 1144;
const MAX_MANIFEST_BYTES = 128 * 1024;
const MAX_PRESETS = 100;
const SUCCESS_INTERVAL_MS = 6 * 60 * 60 * 1000;
const FAILURE_INTERVAL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12_000;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const checksum = (bytes) => bytes.reduce((sum, value) => (sum + value) & 0xff, 0);

function iso(now) {
  return new Date(now).toISOString();
}

function safeFileName(value) {
  const raw = String(value || "");
  const base = path.basename(raw);
  if (!base || base !== raw || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.k500$/i.test(base)) {
    throw new Error(`Nama file catalog tidak aman: ${raw || "(kosong)"}`);
  }
  return base;
}

function validatePreset(bytes, entry) {
  if (bytes.length !== K500_SIZE || entry.size !== K500_SIZE) {
    throw new Error(`${entry.file}: ukuran preset harus ${K500_SIZE} byte.`);
  }
  if (checksum(bytes) !== 0) {
    throw new Error(`${entry.file}: checksum internal K500 tidak valid.`);
  }
  const digest = sha256(bytes);
  if (digest !== entry.sha256) {
    throw new Error(`${entry.file}: SHA-256 tidak cocok.`);
  }
  return digest;
}

function validateManifest(value, manifestUrl) {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.presets)) {
    throw new Error("Format preset catalog tidak didukung.");
  }
  if (!value.presets.length || value.presets.length > MAX_PRESETS) {
    throw new Error(`Preset catalog harus berisi 1-${MAX_PRESETS} item.`);
  }

  const manifestLocation = new URL(manifestUrl);
  const downloadBase = new URL(String(value.downloadBaseUrl || ""));
  if (downloadBase.protocol !== "https:" && manifestLocation.protocol !== "http:") {
    throw new Error("Preset catalog hanya boleh memakai HTTPS.");
  }
  if (downloadBase.origin !== manifestLocation.origin) {
    throw new Error("Origin file preset harus sama dengan origin manifest.");
  }
  if (
    downloadBase.hostname === "raw.githubusercontent.com" &&
    !downloadBase.pathname.startsWith("/masarray/ktv-studio-mixer-pro/")
  ) {
    throw new Error("Preset catalog menunjuk ke repository yang tidak dipercaya.");
  }

  const seen = new Set();
  const presets = value.presets.map((raw) => {
    const file = safeFileName(raw?.file);
    if (seen.has(file.toLowerCase())) throw new Error(`Nama preset duplikat: ${file}`);
    seen.add(file.toLowerCase());
    const entry = {
      id: String(raw?.id || path.basename(file, path.extname(file))),
      file,
      name: String(raw?.name || path.basename(file, path.extname(file))).slice(0, 64),
      version: String(raw?.version || value.catalogVersion || "1").slice(0, 32),
      size: Number(raw?.size),
      sha256: String(raw?.sha256 || "").toLowerCase(),
    };
    if (!/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error(`${file}: SHA-256 catalog tidak valid.`);
    if (entry.size !== K500_SIZE) throw new Error(`${file}: ukuran catalog tidak valid.`);
    return { ...entry, url: new URL(encodeURIComponent(file), downloadBase).href };
  });

  return {
    schemaVersion: 1,
    catalogVersion: String(value.catalogVersion || "1").slice(0, 32),
    presets,
  };
}

async function readJson(file, fallback = {}) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeAtomic(target, bytes) {
  await mkdir(path.dirname(target), { recursive: true });
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const temporary = `${target}.${token}.tmp`;
  const backup = `${target}.${token}.bak`;
  await writeFile(temporary, bytes);
  let movedExisting = false;
  try {
    try {
      await rename(target, backup);
      movedExisting = true;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await rename(temporary, target);
    if (movedExisting) await rm(backup, { force: true });
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    if (movedExisting) await rename(backup, target).catch(() => {});
    throw error;
  }
}

async function writeState(statePath, state) {
  await writeAtomic(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

async function fetchResponse(fetchImpl, url, { headers = {}, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { headers, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

async function responseBytes(response, maxBytes) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new Error(`Download melewati batas ${maxBytes} byte.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) throw new Error(`Download melewati batas ${maxBytes} byte.`);
  return bytes;
}

async function existingDigest(file) {
  try {
    const info = await stat(file);
    if (!info.isFile()) return null;
    return sha256(await readFile(file));
  } catch {
    return null;
  }
}

async function preserveLocalEdit(source, userPresetRoot, file, now) {
  if (!userPresetRoot) return null;
  await mkdir(userPresetRoot, { recursive: true });
  const parsed = path.parse(file);
  const stamp = iso(now).replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const backupName = `${parsed.name}_LOCAL_BACKUP_${stamp}${parsed.ext}`;
  await copyFile(source, path.join(userPresetRoot, backupName));
  return backupName;
}

export async function readPresetCatalogState(factoryRoot) {
  return readJson(path.join(factoryRoot, STATE_FILE), { status: "bundled" });
}

export async function syncFactoryPresetCatalog({
  factoryRoot,
  userPresetRoot,
  manifestUrl = process.env.SONKUPIK_PRESET_CATALOG_URL || DEFAULT_PRESET_CATALOG_URL,
  fetchImpl = globalThis.fetch,
  force = false,
  now = Date.now(),
  logger = console,
} = {}) {
  if (!factoryRoot) throw new Error("Factory preset root belum ditentukan.");
  if (typeof fetchImpl !== "function") throw new Error("Runtime tidak menyediakan fetch.");
  await mkdir(factoryRoot, { recursive: true });
  const statePath = path.join(factoryRoot, STATE_FILE);
  const previous = await readJson(statePath, {});

  if (!force && Number(previous.nextCheckAt || 0) > now) {
    return { ...previous, status: previous.status === "error" ? "offline" : "fresh", skipped: true };
  }

  const checking = {
    ...previous,
    status: "checking",
    lastAttemptAt: iso(now),
    manifestUrl,
    lastError: "",
  };
  await writeState(statePath, checking);

  try {
    const headers = { Accept: "application/json", "User-Agent": "SONKUPIK-STUDIO-Preset-Sync" };
    if (previous.etag) headers["If-None-Match"] = previous.etag;
    const response = await fetchResponse(fetchImpl, manifestUrl, { headers });
    if (response.status === 304) {
      const current = {
        ...previous,
        status: "current",
        lastAttemptAt: iso(now),
        lastCheckedAt: iso(now),
        nextCheckAt: now + SUCCESS_INTERVAL_MS,
        lastError: "",
      };
      await writeState(statePath, current);
      return { ...current, installed: [], updated: [], preserved: [] };
    }
    if (!response.ok) throw new Error(`Manifest HTTP ${response.status}.`);
    const manifestBytes = await responseBytes(response, MAX_MANIFEST_BYTES);
    const manifest = validateManifest(JSON.parse(manifestBytes.toString("utf8")), manifestUrl);

    const staged = [];
    const installed = [];
    const updated = [];
    const preserved = [];
    const files = { ...(previous.files || {}) };

    for (const entry of manifest.presets) {
      const target = path.join(factoryRoot, entry.file);
      const localDigest = await existingDigest(target);
      if (localDigest === entry.sha256) {
        files[entry.file] = { ...entry, url: undefined, installedAt: files[entry.file]?.installedAt || iso(now) };
        continue;
      }

      const presetResponse = await fetchResponse(fetchImpl, entry.url, {
        headers: { Accept: "application/octet-stream", "User-Agent": "SONKUPIK-STUDIO-Preset-Sync" },
      });
      if (!presetResponse.ok) throw new Error(`${entry.file}: HTTP ${presetResponse.status}.`);
      const bytes = await responseBytes(presetResponse, K500_SIZE);
      validatePreset(bytes, entry);
      staged.push({ entry, target, bytes, localDigest });
    }

    for (const item of staged) {
      const priorDigest = previous.files?.[item.entry.file]?.sha256;
      if (item.localDigest && item.localDigest !== priorDigest) {
        const backupName = await preserveLocalEdit(item.target, userPresetRoot, item.entry.file, now);
        if (backupName) preserved.push(backupName);
      }
      await writeAtomic(item.target, item.bytes);
      if (item.localDigest) updated.push(item.entry.file);
      else installed.push(item.entry.file);
      files[item.entry.file] = { ...item.entry, url: undefined, installedAt: iso(now) };
    }

    const finalState = {
      schemaVersion: 1,
      status: staged.length ? "updated" : "current",
      catalogVersion: manifest.catalogVersion,
      manifestUrl,
      etag: response.headers.get("etag") || "",
      lastAttemptAt: iso(now),
      lastCheckedAt: iso(now),
      nextCheckAt: now + SUCCESS_INTERVAL_MS,
      lastError: "",
      files,
    };
    await writeState(statePath, finalState);
    logger.log?.(`[preset-sync] ${manifest.catalogVersion}: ${installed.length} installed, ${updated.length} updated`);
    return { ...finalState, installed, updated, preserved };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failedState = {
      ...previous,
      status: "error",
      manifestUrl,
      lastAttemptAt: iso(now),
      nextCheckAt: now + FAILURE_INTERVAL_MS,
      lastError: message.slice(0, 300),
    };
    await writeState(statePath, failedState).catch(() => {});
    logger.warn?.(`[preset-sync] ${message}`);
    return { ...failedState, installed: [], updated: [], preserved: [], error: message };
  }
}
