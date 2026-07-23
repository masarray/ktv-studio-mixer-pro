import path from "node:path";
import { mkdirSync } from "node:fs";
import { app, BrowserWindow, dialog, shell } from "electron";
import { startAppServer } from "./local-server.mjs";
import { provisionBuiltInPresets } from "./preset-library.mjs";
import { syncFactoryPresetCatalog } from "./preset-catalog.mjs";

const APP_ID = "com.masari.sonkupik.karaoke";
let mainWindow = null;
let appServer = null;
let bridgeServer = null;
let bridgeStartPromise = null;

app.setAppUserModelId(APP_ID);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

function assetPath(...parts) {
  return path.join(app.getAppPath(), ...parts);
}

function builtInPresetPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "presets")
    : assetPath("resources", "presets");
}

async function startNativeBridge() {
  if (bridgeStartPromise) return bridgeStartPromise;
  bridgeStartPromise = (async () => {
    const presetRoot = path.join(app.getPath("documents"), "SONKUPIK STUDIO Presets");
    const factoryPresetRoot = path.join(app.getPath("userData"), "Factory Presets");
    mkdirSync(presetRoot, { recursive: true });
    provisionBuiltInPresets({ sourceRoot: builtInPresetPath(), presetRoot: factoryPresetRoot });
    process.env.K500_PRESET_ROOT ||= presetRoot;
    process.env.K500_FACTORY_PRESET_ROOT ||= factoryPresetRoot;
    process.env.K500_BRIDGE_PORT ||= "8500";

    // Keep the native transport stack out of the first-render critical path.
    // node-hid/serialport are still loaded lazily by the bridge only when the
    // user presses Connect, while the bridge WebSocket becomes available a
    // moment after the renderer has painted.
    const { startBridge } = await import("../tools/k500-bridge.mjs");
    bridgeServer = await startBridge({ port: 8500, presetRoot, factoryPresetRoot });

    // The editor and native bridge are already usable before any network I/O.
    // Catalog errors are stored as status only; an offline launch remains fast
    // and the bundled factory preset continues to work.
    if (process.env.SONKUPIK_PRESET_SYNC_DISABLED !== "1") {
      setImmediate(() => {
        void syncFactoryPresetCatalog({ factoryRoot: factoryPresetRoot, userPresetRoot: presetRoot });
      });
    }
    return bridgeServer;
  })();
  return bridgeStartPromise;
}

async function createMainWindow() {
  // Start SSR/static initialization in parallel with BrowserWindow creation.
  // Previously the window did not even exist until the whole server module
  // had loaded, adding avoidable time to every cold start.
  const serverPromise = appServer
    ? Promise.resolve(appServer)
    : startAppServer({ appRoot: app.getAppPath() }).then((server) => {
        appServer = server;
        return server;
      });

  mainWindow = new BrowserWindow({
    title: "SONKUPIK STUDIO — Karaoke Processor",
    width: 1500,
    height: 960,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    backgroundColor: "#070a0e",
    autoHideMenuBar: true,
    icon: assetPath("build", "sonkupik-icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => { mainWindow = null; });
  const server = await serverPromise;
  await mainWindow.loadURL(server.origin);
}

app.whenReady().then(async () => {
  try {
    await createMainWindow();

    // The editor is usable while the hardware bridge initializes. A bridge
    // failure must never block opening or editing a local preset.
    setImmediate(() => {
      void startNativeBridge().catch((error) => {
        bridgeStartPromise = null;
        console.warn("[desktop] native bridge unavailable:", error instanceof Error ? error.message : String(error));
      });
    });
  } catch (error) {
    console.error("[desktop] startup failed", error);
    dialog.showErrorBox("SONKUPIK STUDIO", error instanceof Error ? error.message : String(error));
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  void appServer?.close?.();
  try { bridgeServer?.close?.(); } catch {}
});
