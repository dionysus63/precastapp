import { spawn } from "child_process";
import path from "path";

/**
 * Opens a local folder in Windows Explorer.
 *
 * Uses spawn (no shell) so folderPath is passed as a literal argument and
 * can't be interpreted as shell syntax, regardless of its contents.
 *
 * explorer.exe routinely exits with a non-zero code even when it opens the
 * folder successfully, so we only treat a failure to launch the process
 * (e.g. explorer.exe missing) as an error, not its exit code.
 */
export async function launchWindowsFolder(folderPath: string): Promise<void> {
  const normalizedPath = path.normalize(folderPath.trim());

  await new Promise<void>((resolve, reject) => {
    const child = spawn("explorer.exe", [normalizedPath], {
      windowsHide: true,
      detached: true,
      stdio: "ignore",
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
