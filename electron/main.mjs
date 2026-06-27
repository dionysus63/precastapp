import { app, BrowserWindow, dialog, shell } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { loadConfig, validateServerUrl } from "./config.mjs";
import { initAutoUpdater } from "./updater.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {BrowserWindow | null} */
let mainWindow = null;

function getServerOrigin() {
  const { serverUrl } = loadConfig();
  return validateServerUrl(serverUrl).origin;
}

function getServerUrl() {
  const { serverUrl } = loadConfig();
  validateServerUrl(serverUrl);
  return serverUrl.replace(/\/+$/, "");
}

function isAllowedNavigation(targetUrl, serverOrigin) {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol === "about:") {
      return true;
    }
    return parsed.origin === serverOrigin;
  } catch {
    return false;
  }
}

function showConnectionError(message) {
  dialog.showErrorBox(
    "Precast Ops — Cannot connect",
    `${message}\n\nCheck that you are on the office network (or VPN) and the server is running.`,
  );
}

function createWindow() {
  let serverOrigin;
  let startUrl;

  try {
    serverOrigin = getServerOrigin();
    startUrl = getServerUrl();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid configuration.";
    showConnectionError(message);
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Precast Ops",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigation(url, serverOrigin)) {
      return { action: "allow" };
    }
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigation(url, serverOrigin)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      if (errorCode === -3) {
        return;
      }
      showConnectionError(
        `Failed to load ${validatedURL}\n${errorDescription} (${errorCode})`,
      );
    },
  );

  void mainWindow.loadURL(startUrl);

  initAutoUpdater(mainWindow, getServerUrl);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

if (process.platform === "win32") {
  app.setAppUserModelId("com.li-precast.precastops");
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
