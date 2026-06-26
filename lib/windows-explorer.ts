import { randomUUID } from "crypto";
import { stat, unlink, writeFile } from "fs/promises";
import { execFile, spawn } from "child_process";
import os from "os";
import path from "path";
import { promisify } from "util";
import { getJobsRoot } from "@/lib/app-settings";
import { assertPathUnderRoot } from "@/lib/job-path-security";

const execFileAsync = promisify(execFile);

export type ExplorerLaunchMethod =
  | "shell-vbs"
  | "cmd-start"
  | "powershell"
  | "execFile";

export type ExplorerLaunchOptions = {
  onLaunchMethod?: (method: ExplorerLaunchMethod) => void;
  onLaunchAttempt?: (
    method: ExplorerLaunchMethod,
    result: "ok" | "failed",
    error?: Error,
  ) => void;
  /** When set, folder opens are validated against this root instead of jobs root. */
  allowedRoot?: string;
};

type LaunchContext = {
  kind: "folder" | "file";
  normalizedPath: string;
  explorerArgs: string[];
  cmdStartArgs: string[];
};

function normalizePath(value: string) {
  return path.normalize(value.trim());
}

function escapeVbsString(value: string) {
  return value.replace(/"/g, '""');
}

function explorerSelectArg(filePath: string) {
  return `/select,"${filePath.replace(/"/g, '""')}"`;
}

function buildFolderVbs(folderPath: string) {
  const literal = escapeVbsString(folderPath);
  return `Set shell = CreateObject("Shell.Application")
shell.ShellExecute "explorer.exe", "${literal}", "", "open", 1
`;
}

function buildFileSelectVbs(filePath: string) {
  const literal = escapeVbsString(filePath);
  return `Set shell = CreateObject("Shell.Application")
targetPath = "${literal}"
shell.ShellExecute "explorer.exe", "/select,""" & targetPath & """", "", "open", 1
`;
}

async function assertDirectoryExists(folderPath: string) {
  try {
    const fileStat = await stat(folderPath);
    if (!fileStat.isDirectory()) {
      throw new Error(`Not a folder: ${folderPath}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Not a folder:")) {
      throw error;
    }
    throw new Error(`Folder not found: ${folderPath}`);
  }
}

async function assertFileExists(filePath: string) {
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      throw new Error(`Not a file: ${filePath}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Not a file:")) {
      throw error;
    }
    throw new Error(`File not found: ${filePath}`);
  }
}

function isExplorerLaunchFailure(error: unknown) {
  const err = error as NodeJS.ErrnoException & { code?: number | string; killed?: boolean };
  if (err.code === "ENOENT" || err.code === "ENOTFOUND") {
    return true;
  }
  if (err.killed) {
    return true;
  }
  return false;
}

async function launchViaShellVbs(context: LaunchContext) {
  const vbsContent =
    context.kind === "folder"
      ? buildFolderVbs(context.normalizedPath)
      : buildFileSelectVbs(context.normalizedPath);
  const vbsPath = path.join(os.tmpdir(), `precast-explorer-${randomUUID()}.vbs`);

  try {
    await writeFile(vbsPath, vbsContent, "utf8");
    await execFileAsync("wscript.exe", ["//Nologo", vbsPath]);
  } finally {
    await unlink(vbsPath).catch(() => undefined);
  }
}

function startViaCmd(argsAfterStart: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("cmd.exe", ["/c", "start", "", ...argsAfterStart], {
      windowsHide: true,
      stdio: "ignore",
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0 || code === 1) {
        resolve();
        return;
      }
      reject(new Error(`cmd start failed with exit code ${code ?? "unknown"}`));
    });
  });
}

async function launchViaPowerShell(explorerArgs: string[]) {
  const argumentList = explorerArgs
    .map((arg) => `'${arg.replace(/'/g, "''")}'`)
    .join(", ");
  const command = `Start-Process -FilePath 'explorer.exe' -ArgumentList ${argumentList}`;

  try {
    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      command,
    ]);
  } catch (error) {
    if (isExplorerLaunchFailure(error)) {
      throw error;
    }
  }
}

/**
 * explorer.exe often exits with a non-zero code even on success, so we only
 * treat a failure to launch the process as an error, not its exit code.
 */
async function execFileExplorer(args: string[]) {
  try {
    await execFileAsync("explorer.exe", args);
  } catch (error) {
    if (isExplorerLaunchFailure(error)) {
      throw error;
    }
  }
}

async function tryLaunchMethod(
  method: ExplorerLaunchMethod,
  context: LaunchContext,
  options?: ExplorerLaunchOptions,
) {
  switch (method) {
    case "shell-vbs":
      await launchViaShellVbs(context);
      return;
    case "cmd-start":
      await startViaCmd(context.cmdStartArgs);
      return;
    case "powershell":
      await launchViaPowerShell(context.explorerArgs);
      return;
    case "execFile":
      await execFileExplorer(context.explorerArgs);
      return;
    default: {
      const exhaustive: never = method;
      throw new Error(`Unknown launch method: ${exhaustive}`);
    }
  }
}

async function launchExplorer(context: LaunchContext, options?: ExplorerLaunchOptions) {
  const methods: ExplorerLaunchMethod[] = [
    "shell-vbs",
    "cmd-start",
    "powershell",
    "execFile",
  ];
  const errors: string[] = [];

  for (const method of methods) {
    try {
      await tryLaunchMethod(method, context, options);
      options?.onLaunchAttempt?.(method, "ok");
      options?.onLaunchMethod?.(method);
      return;
    } catch (error) {
      const launchError =
        error instanceof Error ? error : new Error(String(error));
      options?.onLaunchAttempt?.(method, "failed", launchError);
      errors.push(`${method}: ${launchError.message}`);
    }
  }

  throw new Error(`Could not open Explorer (${errors.join("; ")})`);
}

/**
 * Opens a local folder in Windows Explorer.
 */
export async function launchWindowsFolder(
  folderPath: string,
  options?: ExplorerLaunchOptions,
): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("Opening folders is supported on Windows only.");
  }

  const normalizedPath = normalizePath(folderPath);
  const root = options?.allowedRoot ?? (await getJobsRoot());
  assertPathUnderRoot(root, normalizedPath);
  await assertDirectoryExists(normalizedPath);
  await launchExplorer(
    {
      kind: "folder",
      normalizedPath,
      explorerArgs: [normalizedPath],
      cmdStartArgs: [normalizedPath],
    },
    options,
  );
}

/**
 * Selects a local file in Windows Explorer.
 *
 * The /select switch and path must be a single argument: /select,"C:\path\file"
 */
export async function launchWindowsFile(
  filePath: string,
  options?: ExplorerLaunchOptions,
): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("Opening files is supported on Windows only.");
  }

  const normalizedPath = normalizePath(filePath);
  const root = options?.allowedRoot ?? (await getJobsRoot());
  assertPathUnderRoot(root, normalizedPath);
  await assertFileExists(normalizedPath);
  const selectArg = explorerSelectArg(normalizedPath);
  await launchExplorer(
    {
      kind: "file",
      normalizedPath,
      explorerArgs: [selectArg],
      cmdStartArgs: ["explorer.exe", selectArg],
    },
    options,
  );
}

export async function assertPathAccessible(
  targetPath: string,
  kind: "file" | "directory",
) {
  if (kind === "file") {
    await assertFileExists(targetPath);
    return;
  }

  await assertDirectoryExists(targetPath);
}
