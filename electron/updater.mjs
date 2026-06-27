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
