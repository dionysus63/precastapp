import { open, readdir, stat } from "fs/promises";
import path from "path";

/**
 * The state of the server's nightly backup, as far as the app can see it.
 *
 * scripts/backup-database.ps1 (run by the "PrecastApp DB Backup" scheduled
 * task) writes one .dump file per run into the backup folder and appends one
 * line per run to backup.log there. This module only reads those two things:
 * it never runs, changes or deletes a backup.
 *
 * It exists because the scheduled task once disappeared from the server and
 * nothing said so for five weeks. The app shell shows what this reports to
 * admins on every page (components/dashboard/backup-warning.tsx), and the
 * Settings page shows it as a status chip.
 */

/**
 * How old the newest backup may be. The task runs every 24 hours;
 * scripts/deploy/check-backup.ps1 allows the same 26.
 */
export const BACKUP_MAX_AGE_HOURS = 26;

/** backup-database.ps1's own default when .env has no BACKUP_DIR. */
const DEFAULT_WINDOWS_BACKUP_DIR = "C:\\Backups\\precastapp";
const BACKUP_LOG_NAME = "backup.log";
/** Plenty for the last entry: a line is a few hundred bytes. */
const LOG_TAIL_BYTES = 64 * 1024;
/** The folder is read at most this often, however many pages are opened. */
const CACHE_MS = 15_000;
const HOUR_MS = 3_600_000;
const REASON_MAX_LENGTH = 300;

export type BackupLogStatus = "OK" | "WARN" | "FAIL";

export type BackupLogEntry = {
  /** When the run wrote its line, by the server's own clock. */
  at: Date;
  status: BackupLogStatus;
  /** The rest of the line, as the script wrote it. */
  message: string;
};

export type BackupFacts = {
  /** null when this machine has no backup folder to look at. */
  dir: string | null;
  folder: "ok" | "missing" | "unreadable";
  /** Modified time of the newest .dump file that is not empty. */
  newestDumpAt: Date | null;
  lastLogEntry: BackupLogEntry | null;
};

export type BackupHealth =
  | { kind: "ok"; dir: string; lastBackupAt: Date }
  /** Nothing to report: a PC used for development, with no backups. */
  | { kind: "not-set-up" }
  | { kind: "none"; dir: string; folderMissing: boolean }
  | { kind: "stale"; dir: string; lastBackupAt: Date }
  | {
      kind: "failed";
      dir: string;
      failedAt: Date;
      reason: string;
      lastBackupAt: Date | null;
    }
  /** The backup was made, but not all of it was copied off the server. */
  | { kind: "not-uploaded"; dir: string; lastBackupAt: Date; reason: string }
  | { kind: "unreadable"; dir: string };

export type BackupNotice = {
  tone: "red" | "amber";
  headline: string;
  detail: string;
};

/**
 * Where the backups are written: BACKUP_DIR from .env, read the way the
 * backup script reads it (quotes around the value dropped), or the script's
 * default on Windows. Nowhere on any other system unless BACKUP_DIR says so.
 */
export function getBackupDir(
  env: Record<string, string | undefined> = process.env,
  platform: string = process.platform,
): string | null {
  const configured = (env.BACKUP_DIR ?? "")
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/^'+|'+$/g, "");
  if (configured) {
    return configured;
  }
  return platform === "win32" ? DEFAULT_WINDOWS_BACKUP_DIR : null;
}

const LOG_LINE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}) (OK|WARN|FAIL)(?: (.*))?$/;

/**
 * The last run's line in backup.log. A message that held line breaks leaves
 * extra lines behind its own; those, and anything else that is not a run's
 * line, are skipped.
 */
export function parseBackupLog(text: string): BackupLogEntry | null {
  const lines = text.split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index--) {
    const match = LOG_LINE_PATTERN.exec(lines[index].replace(/^\uFEFF/, "").trimEnd());
    if (!match) {
      continue;
    }
    const [, year, month, day, hour, minute, second, status, message] = match;
    // The script stamps each line with the server's own clock and no zone.
    const at = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
    if (Number.isNaN(at.getTime())) {
      continue;
    }
    return { at, status: status as BackupLogStatus, message: (message ?? "").trim() };
  }
  return null;
}

/**
 * How backup-database.ps1 starts each problem it reports. A WARN or FAIL line
 * is "<what was made>; <problem>; <problem>", and what was made can hold "; "
 * itself ("; uploaded to ...", "; copied to ..."), so the problems are found
 * by how they start.
 */
const PROBLEM_STARTS = [
  "signed tickets not ",
  "copy to ",
  "upload to ",
  "cloud upload is not set up",
];

/** The problem part of a WARN or FAIL line, or the whole message. */
export function problemFromLogMessage(message: string): string {
  let start = -1;
  for (const marker of PROBLEM_STARTS) {
    const index = message.indexOf(`; ${marker}`);
    if (index >= 0 && (start < 0 || index < start)) {
      start = index;
    }
  }
  const problem = (start >= 0 ? message.slice(start + 2) : message).trim();
  return problem.length > REASON_MAX_LENGTH
    ? `${problem.slice(0, REASON_MAX_LENGTH).trimEnd()}...`
    : problem;
}

async function readTail(filePath: string, maxBytes: number): Promise<string | null> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(filePath, "r");
    const { size } = await handle.stat();
    const length = Math.min(size, maxBytes);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, size - length);
    return buffer.toString("utf8");
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

/** Looks at the backup folder. Reads only; never throws. */
export async function readBackupFacts(dir: string | null): Promise<BackupFacts> {
  if (!dir) {
    return { dir: null, folder: "missing", newestDumpAt: null, lastLogEntry: null };
  }

  let dumpNames: string[];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    dumpNames = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".dump"))
      .map((entry) => entry.name);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    return {
      dir,
      folder: code === "ENOENT" || code === "ENOTDIR" ? "missing" : "unreadable",
      newestDumpAt: null,
      lastLogEntry: null,
    };
  }

  let newest: number | null = null;
  for (const name of dumpNames) {
    try {
      const info = await stat(path.join(dir, name));
      // An empty file is what a dump that never started leaves behind.
      if (info.size > 0 && (newest === null || info.mtimeMs > newest)) {
        newest = info.mtimeMs;
      }
    } catch {
      // Pruned between the listing and now.
    }
  }

  const logText = await readTail(path.join(dir, BACKUP_LOG_NAME), LOG_TAIL_BYTES);
  return {
    dir,
    folder: "ok",
    newestDumpAt: newest === null ? null : new Date(newest),
    lastLogEntry: logText ? parseBackupLog(logText) : null,
  };
}

/**
 * The log's last line counts only when it is about the newest backup file or
 * a later run. While a run is still uploading, its file is there but its line
 * is not, and the line before it must not be read as today's result.
 */
function relevantLogEntry(facts: BackupFacts): BackupLogEntry | null {
  const entry = facts.lastLogEntry;
  if (!entry) {
    return null;
  }
  if (!facts.newestDumpAt) {
    return entry;
  }
  return entry.at.getTime() >= facts.newestDumpAt.getTime() - 60_000 ? entry : null;
}

export function evaluateBackupHealth(
  facts: BackupFacts,
  now: Date,
  options: { production: boolean },
): BackupHealth {
  const { dir } = facts;
  if (!dir) {
    return { kind: "not-set-up" };
  }
  if (facts.folder !== "ok") {
    // A PC used for development has no backups, and that is fine. On the
    // server, a folder that is missing or closed to the app is the alarm.
    if (!options.production) {
      return { kind: "not-set-up" };
    }
    return facts.folder === "missing"
      ? { kind: "none", dir, folderMissing: true }
      : { kind: "unreadable", dir };
  }

  const lastBackupAt = facts.newestDumpAt;
  const entry = relevantLogEntry(facts);
  if (entry?.status === "FAIL") {
    return {
      kind: "failed",
      dir,
      failedAt: entry.at,
      reason: problemFromLogMessage(entry.message),
      lastBackupAt,
    };
  }
  if (!lastBackupAt) {
    return { kind: "none", dir, folderMissing: false };
  }
  if (now.getTime() - lastBackupAt.getTime() > BACKUP_MAX_AGE_HOURS * HOUR_MS) {
    return { kind: "stale", dir, lastBackupAt };
  }
  if (entry?.status === "WARN") {
    return {
      kind: "not-uploaded",
      dir,
      lastBackupAt,
      reason: problemFromLogMessage(entry.message),
    };
  }
  return { kind: "ok", dir, lastBackupAt };
}

/** "Nov 13, 2026, 4:53 PM", by the server's own clock. */
export function formatBackupMoment(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "5 hours ago", "2 days ago". */
export function formatBackupAge(date: Date, now: Date): string {
  const hours = Math.max(0, Math.floor((now.getTime() - date.getTime()) / HOUR_MS));
  if (hours < 1) {
    return "less than an hour ago";
  }
  if (hours < 48) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  return `${Math.floor(hours / 24)} days ago`;
}

const CHECK_COMMAND =
  "On the server, open PowerShell as administrator in the app folder and run .\\scripts\\deploy\\check-backup.ps1";
const HOW_TO_CHECK = `${CHECK_COMMAND} to see why.`;

function withFullStop(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** What to tell an admin, or null when there is nothing to tell. */
export function describeBackupHealth(health: BackupHealth, now: Date): BackupNotice | null {
  switch (health.kind) {
    case "ok":
    case "not-set-up":
      return null;
    case "none":
      return {
        tone: "red",
        headline: "No backup found.",
        detail: `${
          health.folderMissing
            ? `The backup folder ${health.dir} does not exist on the server.`
            : `The backup folder ${health.dir} holds no backup.`
        } ${HOW_TO_CHECK}`,
      };
    case "stale":
      return {
        tone: "red",
        headline: `No backup since ${formatBackupMoment(health.lastBackupAt)} (${formatBackupAge(health.lastBackupAt, now)}).`,
        detail: `The nightly backup on the server is not running. ${HOW_TO_CHECK}`,
      };
    case "failed": {
      // A failure from days ago means nothing has run since, either.
      const nothingSince =
        now.getTime() - health.failedAt.getTime() > BACKUP_MAX_AGE_HOURS * HOUR_MS
          ? "No backup has run since. "
          : "";
      return {
        tone: "red",
        headline: `The last backup failed (${formatBackupMoment(health.failedAt)}, ${formatBackupAge(health.failedAt, now)}).`,
        detail: `${health.reason ? `${withFullStop(health.reason)} ` : ""}${nothingSince}${HOW_TO_CHECK}`,
      };
    }
    case "not-uploaded":
      return {
        tone: "amber",
        headline: `The last backup was not fully copied off the server (${formatBackupMoment(health.lastBackupAt)}).`,
        detail: `The backup itself was made. The copy off the server had a problem${
          health.reason ? `: ${withFullStop(health.reason)}` : "."
        } ${HOW_TO_CHECK}`,
      };
    case "unreadable":
      return {
        tone: "amber",
        headline: "The backup cannot be checked.",
        detail: `The app is not allowed to read the backup folder ${health.dir}, so it cannot tell whether backups are running. ${CHECK_COMMAND} to check them there.`,
      };
  }
}

let cached: { dir: string | null; at: number; health: BackupHealth } | null = null;

/** Tests only. */
export function clearBackupHealthCache(): void {
  cached = null;
}

/**
 * The backup's state right now, read from disk at most every few seconds.
 * Never throws: a problem with this check must not keep a page from loading.
 */
export async function getBackupHealth(now: Date = new Date()): Promise<BackupHealth> {
  const dir = getBackupDir();
  if (cached && cached.dir === dir && Math.abs(now.getTime() - cached.at) < CACHE_MS) {
    return cached.health;
  }
  let health: BackupHealth;
  try {
    health = evaluateBackupHealth(await readBackupFacts(dir), now, {
      production: process.env.NODE_ENV === "production",
    });
  } catch (error) {
    console.error("Backup status check failed", error);
    health = { kind: "not-set-up" };
  }
  cached = { dir, at: now.getTime(), health };
  return health;
}
