// Sandboxed preload: exposes the minimal desktop bridge the web app uses to
// open network files/folders on THIS machine (server actions run on the
// office server, which cannot open Explorer here) and to drag server files
// out as real OS files (Outlook attachments, desktop copies).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("precastOpsDesktop", {
  /** Resolves to "" on success or a readable error message. */
  openPath: (targetPath) => ipcRenderer.invoke("desktop:open-path", targetPath),
  /**
   * Download a server file to a local temp path so a following startFileDrag
   * attaches instantly. Resolves to "" on success or a readable error.
   */
  prepareFileDrag: (url, fileName) =>
    ipcRenderer.invoke("desktop:prepare-drag-file", url, fileName),
  /**
   * Begin a native OS file drag for a server file. Must be called from a
   * dragstart handler (after preventDefault) while the mouse is held.
   */
  startFileDrag: (url, fileName) => {
    ipcRenderer.send("desktop:start-drag-file", url, fileName);
  },
});
