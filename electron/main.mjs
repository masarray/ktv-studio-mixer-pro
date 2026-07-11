import { mkdirSync } from "node:fs";
import path from "node:path";
import { app, BrowserWindow, dialog, shell } from "electron";
import { startAppServer } from "./local-server.mjs";

const APP_ID = "com.masari.sonkupik.karaoke";
let mainWindow = null;
let appServer = null;
let bridgeServer = null;

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

async function startNativeBridge() {
  const presetRoot = path.join(app.getPath("documents"), "SONKUPIK STUDIO Presets");
  mkdirSync(presetRoot, { recursive: true });
  process.env.K500_PRESET_ROOT ||= presetRoot;
  process.env.K500_BRIDGE_PORT ||= "8500";

  try {
    const bridge = await import(assetPath("tools", "k500-bridge.mjs"));
    bridgeServer = await bridge.startBridge();
  } catch (error) {
    // The UI can still fall back to WebHID/Web Serial. Keep startup usable.
    console.warn("[desktop] native bridge unavailable", error);
  }
}

async function createMainWindow() {
  if (!appServer) {
    appServer = await startAppServer({ appRoot: app.getAppPath() });
  }

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
  await mainWindow.loadURL(appServer.origin);
}

app.whenReady().then(async () => {
  try {
    await startNativeBridge();
    await createMainWindow();
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
