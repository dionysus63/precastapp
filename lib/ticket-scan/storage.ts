import { randomUUID } from "crypto";
import {
  access,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  unlink,
  writeFile,
} from "fs/promises";
import path from "path";

/**
 * Where Scan In keeps its files, all under the app's git-ignored storage
 * folder:
 *
 *   storage/ticket-scans/<scan id>/<file id>.pdf   uploaded scans, deleted
 *                                                  once their pages are filed
 *   storage/signed-tickets/<year>/<number>.pdf     one signed PDF per ticket,
 *                                                  kept for good
 *   storage/signed-tickets/cleared-<stamp>/...     signed PDFs of tickets that
 *                                                  Settings > Data Reset
 *                                                  deleted, kept as they were
 *
 * Paths stored in the database are relative to storage/signed-tickets and use
 * "/" on every platform.
 */

/** Tests point this somewhere else; the app itself never sets it. */
const STORAGE_DIR_ENV = "PRECASTAPP_STORAGE_DIR";

export function getStorageRoot(): string {
  const override = process.env[STORAGE_DIR_ENV]?.trim();
  return override ? path.resolve(override) : path.join(process.cwd(), "storage");
}

export function getTicketScansRoot(): string {
  return path.join(getStorageRoot(), "ticket-scans");
}

export function getSignedTicketsRoot(): string {
  return path.join(getStorageRoot(), "signed-tickets");
}

const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function assertSafeId(id: string, what: string): void {
  if (!SAFE_ID_PATTERN.test(id)) {
    throw new Error(`Invalid ${what}.`);
  }
}

function resolveUnder(root: string, relativePath: string, what: string): string {
  const resolvedRoot = path.resolve(root);
  // Stored paths use "/" on every platform.
  const resolvedPath = path.resolve(resolvedRoot, ...relativePath.split("/"));
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`File path is outside the ${what} folder.`);
  }
  return resolvedPath;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

const BUSY_FILE_CODES = new Set(["EBUSY", "EPERM", "EACCES"]);
/** Waits between tries, in milliseconds: about a second and a half in all. */
const BUSY_FILE_WAITS_MS = [40, 120, 300, 1000];
/** The same patience for removing a whole folder (fs.rm counts its own tries). */
const BUSY_FOLDER_RETRY = { maxRetries: 5, retryDelay: 100 } as const;

/**
 * Windows refuses to rename or delete a file while something else holds it
 * open, if only for a moment: the antivirus looking at a file just written,
 * the search indexer, a backup, someone's PDF viewer. Try again a few times
 * before giving up. Any other failure is passed on at once.
 */
export async function retryWhileFileBusy<T>(
  operation: () => Promise<T>,
  waitsMs: readonly number[] = BUSY_FILE_WAITS_MS,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const code =
        typeof error === "object" && error !== null
          ? (error as NodeJS.ErrnoException).code
          : undefined;
      const wait = waitsMs[attempt];
      if (wait === undefined || !code || !BUSY_FILE_CODES.has(code)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

/** Writes next to the target and renames, so a reader never sees half a file. */
async function writeFileWhole(filePath: string, bytes: Uint8Array): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const partial = `${filePath}.${randomUUID()}.part`;
  try {
    await writeFile(partial, bytes);
    await retryWhileFileBusy(() => rename(partial, filePath));
  } catch (error) {
    await unlink(partial).catch(() => undefined);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Uploaded scans (storage/ticket-scans/<scan id>/<file id>.pdf)
// ---------------------------------------------------------------------------

export function newScanSourceId(): string {
  return randomUUID();
}

function scanFolder(batchId: string): string {
  assertSafeId(batchId, "scan id");
  return path.join(getTicketScansRoot(), batchId);
}

function scanSourcePath(batchId: string, sourceId: string): string {
  assertSafeId(sourceId, "scan file id");
  return path.join(scanFolder(batchId), `${sourceId}.pdf`);
}

export async function writeScanSource(
  batchId: string,
  sourceId: string,
  bytes: Uint8Array,
): Promise<void> {
  await writeFileWhole(scanSourcePath(batchId, sourceId), bytes);
}

export async function readScanSource(
  batchId: string,
  sourceId: string,
): Promise<Buffer> {
  try {
    return await readFile(scanSourcePath(batchId, sourceId));
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error(
        "The uploaded scan is no longer on the server. Remove this scan and drop the file again.",
      );
    }
    throw error;
  }
}

export async function deleteScanSource(
  batchId: string,
  sourceId: string,
): Promise<void> {
  const filePath = scanSourcePath(batchId, sourceId);
  await retryWhileFileBusy(() => unlink(filePath)).catch((error) => {
    if (!isMissingFileError(error)) {
      throw error;
    }
  });
}

/** Removes a scan's whole upload folder (after its last page is filed). */
export async function deleteScanFolder(batchId: string): Promise<void> {
  await rm(scanFolder(batchId), {
    recursive: true,
    force: true,
    ...BUSY_FOLDER_RETRY,
  });
}

/** Removes every uploaded scan (Settings > Data Reset deletes all tickets). */
export async function deleteAllScanUploads(): Promise<void> {
  await rm(getTicketScansRoot(), {
    recursive: true,
    force: true,
    ...BUSY_FOLDER_RETRY,
  });
}

// ---------------------------------------------------------------------------
// Signed tickets (storage/signed-tickets/<year>/<number>.pdf)
// ---------------------------------------------------------------------------

/** A ticket number as a file name: letters, digits and dashes only. */
export function signedTicketFileStem(ticketNumber: string): string {
  const stem = ticketNumber
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!stem) {
    throw new Error("This ticket has no number yet, so it cannot be filed.");
  }
  return stem;
}

/** "2026/T10189.pdf": where a ticket's current signed copy lives. */
export function signedTicketRelativePath(
  year: number,
  ticketNumber: string,
): string {
  if (!Number.isInteger(year) || year < 2000 || year > 2999) {
    throw new Error("Invalid year for the signed ticket.");
  }
  return `${year}/${signedTicketFileStem(ticketNumber)}.pdf`;
}

export function resolveSignedTicketPath(relativePath: string): string {
  return resolveUnder(getSignedTicketsRoot(), relativePath, "signed tickets");
}

export async function readSignedTicket(relativePath: string): Promise<Buffer> {
  try {
    return await readFile(resolveSignedTicketPath(relativePath));
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error("The signed ticket file is missing from the server.");
    }
    throw error;
  }
}

export async function writeSignedTicket(
  relativePath: string,
  bytes: Uint8Array,
): Promise<void> {
  await writeFileWhole(resolveSignedTicketPath(relativePath), bytes);
}

/**
 * Moves a signed copy that is about to be replaced out of the way, keeping
 * it: "2026/T10189.pdf" becomes "2026/T10189 (earlier version 1).pdf" (the
 * first number not taken). Returns the new relative path, or null when the
 * file was not there to move.
 */
export async function setAsideSignedTicket(
  relativePath: string,
): Promise<string | null> {
  const currentPath = resolveSignedTicketPath(relativePath);
  if (!(await pathExists(currentPath))) {
    return null;
  }
  const slash = relativePath.lastIndexOf("/");
  const folder = slash >= 0 ? relativePath.slice(0, slash + 1) : "";
  const stem = relativePath.slice(slash + 1).replace(/\.pdf$/i, "");
  for (let version = 1; version <= 999; version += 1) {
    const candidate = `${folder}${stem} (earlier version ${version}).pdf`;
    const candidatePath = resolveSignedTicketPath(candidate);
    if (await pathExists(candidatePath)) {
      continue;
    }
    await retryWhileFileBusy(() => rename(currentPath, candidatePath));
    return candidate;
  }
  throw new Error("Too many earlier versions of this signed ticket.");
}

/** Puts a set-aside file back under its old name (undoing a failed filing). */
export async function moveSignedTicket(
  fromRelativePath: string,
  toRelativePath: string,
): Promise<void> {
  const fromPath = resolveSignedTicketPath(fromRelativePath);
  const toPath = resolveSignedTicketPath(toRelativePath);
  await retryWhileFileBusy(() => rename(fromPath, toPath));
}

export async function removeSignedTicket(relativePath: string): Promise<void> {
  const filePath = resolveSignedTicketPath(relativePath);
  await retryWhileFileBusy(() => unlink(filePath)).catch((error) => {
    if (!isMissingFileError(error)) {
      throw error;
    }
  });
}

const CLEARED_FOLDER_PREFIX = "cleared-";

function clearedFolderStamp(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

/**
 * Moves every signed ticket into storage/signed-tickets/cleared-<stamp>/,
 * keeping the files as they were. Settings > Data Reset calls this after it
 * deletes every ticket and starts the numbering over, so the year folders
 * hold only the signed copies of tickets that still exist. Returns the new
 * folder's name, or null when there was nothing to move.
 */
export async function setAsideAllSignedTickets(
  now: Date = new Date(),
): Promise<string | null> {
  const root = getSignedTicketsRoot();
  let names: string[];
  try {
    names = await readdir(root);
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }
    throw error;
  }
  const toMove = names.filter((name) => !name.startsWith(CLEARED_FOLDER_PREFIX));
  if (toMove.length === 0) {
    return null;
  }

  const stamp = clearedFolderStamp(now);
  let folderName = `${CLEARED_FOLDER_PREFIX}${stamp}`;
  for (let copy = 2; await pathExists(path.join(root, folderName)); copy += 1) {
    folderName = `${CLEARED_FOLDER_PREFIX}${stamp}-${copy}`;
  }
  const folder = path.join(root, folderName);
  await mkdir(folder, { recursive: true });
  for (const name of toMove) {
    await retryWhileFileBusy(() =>
      rename(path.join(root, name), path.join(folder, name)),
    );
  }
  return folderName;
}

// ---------------------------------------------------------------------------
// The copy in the job folder
// ---------------------------------------------------------------------------

/** "T10189 - Signed.pdf": the name of the copy saved into the job folder. */
export function signedTicketJobCopyName(ticketNumber: string): string {
  return `${signedTicketFileStem(ticketNumber)} - Signed.pdf`;
}

export async function writeJobFolderCopy(
  filePath: string,
  bytes: Uint8Array,
): Promise<void> {
  await writeFileWhole(filePath, bytes);
}

export { pathExists as storagePathExists };
