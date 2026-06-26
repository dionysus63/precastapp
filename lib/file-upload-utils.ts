import { access } from "fs/promises";
import path from "path";

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeFileName(fileName: string): string {
  const base = path.basename(fileName.trim());
  if (!base || base === "." || base === "..") {
    throw new Error("Invalid file name.");
  }
  return base.replace(/[<>:"/\\|?*]/g, "_");
}

/** Pick a non-colliding path under `directory`, appending `-1`, `-2`, … if needed. */
export async function resolveUniqueFilePath(
  directory: string,
  fileName: string,
): Promise<string> {
  const exactPath = path.join(directory, fileName);
  if (!(await pathExists(exactPath))) {
    return exactPath;
  }

  const ext = path.extname(fileName);
  const stem = path.basename(fileName, ext);

  for (let suffix = 1; suffix <= 999; suffix += 1) {
    const candidate = path.join(directory, `${stem}-${suffix}${ext}`);
    if (!(await pathExists(candidate))) {
      return candidate;
    }
  }

  throw new Error(`Could not find an available file name for "${fileName}".`);
}
