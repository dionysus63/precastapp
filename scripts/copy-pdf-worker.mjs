import { copyFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
// Legacy build, matching the `pdfjs-dist/legacy/build/pdf.mjs` the preview
// components import. The modern worker calls native Uint8Array.toHex(),
// which older Chromium (e.g. the Electron shell) lacks — the legacy build
// polyfills it ("a.toHex is not a function" on PDF previews otherwise).
const workerSource = path.join(
  projectRoot,
  "node_modules",
  "pdfjs-dist",
  "legacy",
  "build",
  "pdf.worker.min.mjs",
);
const workerTarget = path.join(projectRoot, "public", "pdf.worker.min.mjs");

mkdirSync(path.dirname(workerTarget), { recursive: true });
copyFileSync(workerSource, workerTarget);
console.log("Copied pdf.worker.min.mjs to public/");
