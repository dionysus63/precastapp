import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } from "electron";
import { existsSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadConfig, validateServerUrl } from "./config.mjs";
import { checkForUpdatesManually, initAutoUpdater } from "./updater.mjs";

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

  const windowTitle = `Precast Ops — v${app.getVersion()}`;

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: windowTitle,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  // The loaded page would overwrite the window title with its own <title>;
  // keep the shell version visible in the title bar instead.
  mainWindow.on("page-title-updated", (event) => {
    event.preventDefault();
    mainWindow?.setTitle(windowTitle);
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

// File types the bridge opens with their default app; anything else is
// selected in Explorer instead so a hostile path can never execute.
const OPENABLE_FILE_EXTENSIONS = new Set([
  ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".txt", ".csv",
  ".doc", ".docx", ".xls", ".xlsx", ".eml", ".msg", ".dwg", ".dxf", ".zip",
]);

function registerDesktopBridge() {
  ipcMain.handle("desktop:open-path", async (_event, targetPath) => {
    if (typeof targetPath !== "string" || !targetPath.trim() || targetPath.length > 1024) {
      return "Invalid path.";
    }
    const normalized = path.normalize(targetPath.trim());
    if (!existsSync(normalized)) {
      return `Path not found from this PC: ${normalized}`;
    }

    try {
      const stats = statSync(normalized);
      if (stats.isDirectory()) {
        return await shell.openPath(normalized);
      }
      const extension = path.extname(normalized).toLowerCase();
      if (OPENABLE_FILE_EXTENSIONS.has(extension)) {
        return await shell.openPath(normalized);
      }
      shell.showItemInFolder(normalized);
      return "";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  });
}

function showAboutDialog() {
  let serverUrl = "(not configured)";
  try {
    serverUrl = getServerUrl();
  } catch {
    // keep placeholder
  }

  const target = mainWindow;
  const details = [
    `Version: ${app.getVersion()}`,
    `Server: ${serverUrl}`,
    `Electron: ${process.versions.electron}`,
    `Chromium: ${process.versions.chrome}`,
    `Installed at: ${app.getPath("exe")}`,
  ].join("\n");

  const options = {
    type: /** @type {const} */ ("info"),
    title: "About Precast Ops",
    message: "Precast Ops desktop client",
    detail: details,
    buttons: ["OK"],
  };
  void (target ? dialog.showMessageBox(target, options) : dialog.showMessageBox(options));
}

function buildApplicationMenu() {
  return Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [{ role: "quit", label: "Exit" }],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload", label: "Reload (clear cache)" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        { label: `Precast Ops v${app.getVersion()}`, enabled: false },
        { type: "separator" },
        {
          label: "Check for Updates…",
          click: () => {
            void checkForUpdatesManually();
          },
        },
        {
          label: "About Precast Ops",
          click: () => {
            showAboutDialog();
          },
        },
      ],
    },
  ]);
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
    Menu.setApplicationMenu(buildApplicationMenu());
    registerDesktopBridge();

    // Outlook draft downloads (.eml from Send Quote) open seamlessly: save
    // silently to temp and hand off to the default mail app — no save
    // prompt. Every other download keeps the normal save dialog.
    session.defaultSession.on("will-download", (_event, item) => {
      const filename = item.getFilename();
      if (!filename.toLowerCase().endsWith(".eml")) {
        return;
      }
      const target = path.join(
        app.getPath("temp"),
        `precastops-${Date.now()}-${filename}`,
      );
      item.setSavePath(target);
      item.once("done", (_doneEvent, state) => {
        if (state === "completed") {
          void shell.openPath(target);
        }
      });
    });

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
