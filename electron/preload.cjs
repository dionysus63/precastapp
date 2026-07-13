// Sandboxed preload: exposes the minimal desktop bridge the web app uses to
// open network files/folders on THIS machine (server actions run on the
// office server, which cannot open Explorer here).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("precastOpsDesktop", {
  /** Resolves to "" on success or a readable error message. */
  openPath: (targetPath) => ipcRenderer.invoke("desktop:open-path", targetPath),
});
