import { app, dialog } from "electron";
import pkg from "electron-updater";

const { autoUpdater } = pkg;

/** @type {import("electron").BrowserWindow | null} */
let updateWindow = null;

function getWindow() {
  return updateWindow;
}

/**
 * @param {import("electron").BrowserWindow} mainWindow
 * @param {() => string} getServerUrl
 */
export function initAutoUpdater(mainWindow, getServerUrl) {
  if (!app.isPackaged) {
    return;
  }

  updateWindow = mainWindow;

  const feedUrl = `${getServerUrl()}/updates`;
  autoUpdater.setFeedURL({
    provider: "generic",
    url: feedUrl,
  });

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on("update-available", (info) => {
    const win = getWindow();
    if (!win) {
      return;
    }

    void dialog.showMessageBox(win, {
      type: "info",
      title: "Precast Ops update",
      message: `Version ${info.version} is available.`,
      detail: "Downloading in the background. You can keep working.",
      buttons: ["OK"],
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    const win = getWindow();
    if (!win) {
      return;
    }

    void dialog
      .showMessageBox(win, {
        type: "info",
        title: "Precast Ops update ready",
        message: `Version ${info.version} is ready to install.`,
        detail: "Restart the app to finish updating.",
        buttons: ["Restart now", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      });
  });

  autoUpdater.on("error", (error) => {
    console.error("[Precast Ops updater]", error.message);
  });

  const check = () => {
    void autoUpdater.checkForUpdates().catch((error) => {
      console.error("[Precast Ops updater]", error.message);
    });
  };

  // Wait for the app to finish loading before checking the LAN update server.
  setTimeout(check, 15_000);

  // Check again every 4 hours while the app is open.
  setInterval(check, 4 * 60 * 60 * 1000);
}

let manualCheckRunning = false;

/**
 * Menu-triggered check. Unlike the background check, this always answers:
 * "up to date", "found one" (the update-available/downloaded dialogs take
 * over from there), or a readable error.
 */
export async function checkForUpdatesManually() {
  const win = getWindow();

  if (!app.isPackaged) {
    if (win) {
      void dialog.showMessageBox(win, {
        type: "info",
        title: "Precast Ops update",
        message: "Update checks are disabled in development builds.",
        buttons: ["OK"],
      });
    }
    return;
  }

  if (manualCheckRunning) {
    return;
  }
  manualCheckRunning = true;

  try {
    const result = await autoUpdater.checkForUpdates();
    const latest = result?.updateInfo?.version ?? null;

    if (win && (!latest || latest === app.getVersion())) {
      void dialog.showMessageBox(win, {
        type: "info",
        title: "Precast Ops update",
        message: `You're on the latest version (v${app.getVersion()}).`,
        buttons: ["OK"],
      });
    }
    // A newer version triggers the update-available / update-downloaded
    // dialogs registered above; nothing more to do here.
  } catch (error) {
    if (win) {
      void dialog.showMessageBox(win, {
        type: "warning",
        title: "Precast Ops update",
        message: "Could not check for updates.",
        detail: `${error instanceof Error ? error.message : String(error)}\n\nCheck that the office server is reachable.`,
        buttons: ["OK"],
      });
    }
  } finally {
    manualCheckRunning = false;
  }
}
