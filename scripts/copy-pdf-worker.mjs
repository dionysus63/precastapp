import { copyFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const workerSource = path.join(
  projectRoot,
  "node_modules",
  "pdfjs-dist",
  "build",
  "pdf.worker.min.mjs",
);
const workerTarget = path.join(projectRoot, "public", "pdf.worker.min.mjs");

mkdirSync(path.dirname(workerTarget), { recursive: true });
copyFileSync(workerSource, workerTarget);
console.log("Copied pdf.worker.min.mjs to public/");
