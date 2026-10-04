// Copies sheet PDF sets from their old git-tracked folder
// (assets/templates/rect-pdf-sets) into git-ignored storage/rect-pdf-sets,
// where uploads now go. Never overwrites: a file already in storage/ is
// newer than anything left behind in the old folder. Safe to re-run;
// deploy-app.ps1 runs it on every deploy.
//
//   node scripts/migrate-rect-pdf-sets.mjs

import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const legacyRoot = path.join(repoRoot, "assets", "templates", "rect-pdf-sets");
const storageRoot = path.join(repoRoot, "storage", "rect-pdf-sets");

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(legacyRoot))) {
  console.log("No legacy rect PDF sets folder; nothing to migrate.");
  process.exit(0);
}

let copied = 0;
let kept = 0;
for (const setDir of await readdir(legacyRoot, { withFileTypes: true })) {
  if (!setDir.isDirectory()) continue;
  for (const file of await readdir(path.join(legacyRoot, setDir.name), {
    withFileTypes: true,
  })) {
    if (!file.isFile() || !file.name.toLowerCase().endsWith(".pdf")) continue;
    const target = path.join(storageRoot, setDir.name, file.name);
    if (await exists(target)) {
      kept += 1;
      continue;
    }
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(legacyRoot, setDir.name, file.name), target);
    copied += 1;
  }
}

console.log(
  `Rect PDF sets: copied ${copied} into storage/rect-pdf-sets, ${kept} already there.`,
);
