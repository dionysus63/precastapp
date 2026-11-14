import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  BACKUP_MAX_AGE_HOURS,
  clearBackupHealthCache,
  describeBackupHealth,
  evaluateBackupHealth,
  formatBackupAge,
  getBackupDir,
  getBackupHealth,
  parseBackupLog,
  problemFromLogMessage,
  readBackupFacts,
  type BackupFacts,
  type BackupLogEntry,
} from "@/lib/backup-status";

/**
 * The stale backup warning: what the app reads from the backup folder and
 * what it tells an admin. The log lines are the ones backup-database.ps1
 * writes (the first two as the office server wrote them, bucket renamed).
 */

const HOUR = 3_600_000;
const DIR = "C:\\Backups\\precastapp";
const now = new Date(2026, 10, 14, 9, 0, 0);
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * HOUR);

const RCLONE_LINE =
  "2026-11-13T16:37:25 WARN precastapp_2026-11-13_1637.dump 0.5MB, storage 14MB (pruned 0), signed tickets 11 files (0 new); upload to b2:office-backups/precastapp failed: rclone not found at C:\\Program Files\\rclone\\rclone.exe";
const OK_LINE =
  "2026-11-13T16:53:59 OK precastapp_2026-11-13_1653.dump 0.5MB, storage 14MB (pruned 0), signed tickets 11 files (0 new); uploaded to Backblaze bucket office-backups, 11 new signed tickets";

function facts(overrides: Partial<BackupFacts> = {}): BackupFacts {
  return { dir: DIR, folder: "ok", newestDumpAt: hoursAgo(7), lastLogEntry: null, ...overrides };
}

function entry(status: BackupLogEntry["status"], at: Date, message = "details"): BackupLogEntry {
  return { at, status, message };
}

describe("where the backups are", () => {
  it("uses BACKUP_DIR when .env sets it", () => {
    expect(getBackupDir({ BACKUP_DIR: " D:\\Backups\\app " }, "win32")).toBe("D:\\Backups\\app");
    expect(getBackupDir({ BACKUP_DIR: "/srv/backups" }, "linux")).toBe("/srv/backups");
  });

  it("drops quotes around the value, as the backup script does", () => {
    expect(getBackupDir({ BACKUP_DIR: '"D:\\Backups\\app"' }, "win32")).toBe("D:\\Backups\\app");
    expect(getBackupDir({ BACKUP_DIR: "'/srv/backups'" }, "linux")).toBe("/srv/backups");
    expect(getBackupDir({ BACKUP_DIR: '""' }, "linux")).toBeNull();
  });

  it("falls back to the backup script's own default on Windows only", () => {
    expect(getBackupDir({}, "win32")).toBe(DIR);
    expect(getBackupDir({ BACKUP_DIR: "  " }, "win32")).toBe(DIR);
    expect(getBackupDir({}, "linux")).toBeNull();
  });
});

describe("reading backup.log", () => {
  it("takes the last run's line, in the server's own time", () => {
    const parsed = parseBackupLog(`${RCLONE_LINE}\r\n${OK_LINE}\r\n`);
    expect(parsed?.status).toBe("OK");
    expect(parsed?.at).toEqual(new Date(2026, 10, 13, 16, 53, 59));
    expect(parsed?.message).toMatch(/^precastapp_2026-11-13_1653\.dump/);
  });

  it("reads a file that starts with a byte order mark", () => {
    expect(parseBackupLog(`\uFEFF${RCLONE_LINE}`)?.status).toBe("WARN");
  });

  it("skips the extra lines a message with line breaks leaves behind", () => {
    const text = [
      OK_LINE,
      "2026-11-14T02:00:04 FAIL pg_dump exited with code 1",
      "At C:\\Apps\\precastapp\\scripts\\backup-database.ps1:224 char:13",
      "+             throw \"pg_dump exited with code $LASTEXITCODE\"",
      "+             ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "",
    ].join("\n");
    const parsed = parseBackupLog(text);
    expect(parsed?.status).toBe("FAIL");
    expect(parsed?.message).toBe("pg_dump exited with code 1");
    expect(parsed?.at).toEqual(new Date(2026, 10, 14, 2, 0, 4));
  });

  it("finds nothing in a log with no run in it", () => {
    expect(parseBackupLog("")).toBeNull();
    expect(parseBackupLog("not a log line\n2026-11-14 02:00 OK no T, no seconds\n")).toBeNull();
  });
});

describe("the problem a WARN or FAIL line reports", () => {
  it("leaves out what was made", () => {
    expect(problemFromLogMessage(RCLONE_LINE.split(" WARN ")[1])).toBe(
      "upload to b2:office-backups/precastapp failed: rclone not found at C:\\Program Files\\rclone\\rclone.exe",
    );
  });

  it("is not fooled by a copy or an upload that worked", () => {
    expect(
      problemFromLogMessage(
        "db.dump 0.5MB, storage 14MB (pruned 0); copied to \\\\NAS\\Backups (pruned 0), 2 new signed tickets; upload to Backblaze bucket office-backups failed: Backblaze sign-in failed: 401 bad_auth_token: Invalid applicationKeyId and/or applicationKey",
      ),
    ).toBe(
      "upload to Backblaze bucket office-backups failed: Backblaze sign-in failed: 401 bad_auth_token: Invalid applicationKeyId and/or applicationKey",
    );
    expect(
      problemFromLogMessage(
        "db.dump 0.5MB, storage 14MB (pruned 0), signed tickets 3 files (1 new); uploaded to Backblaze bucket office-backups; signed tickets not uploaded to Backblaze bucket office-backups: 1 of 3 file(s) not uploaded, first: precastapp/signed-tickets/2026/T20005.pdf (timeout)",
      ),
    ).toMatch(/^signed tickets not uploaded to Backblaze bucket office-backups: 1 of 3/);
  });

  it("keeps every problem when there are several", () => {
    expect(
      problemFromLogMessage(
        "db.dump 0.5MB, no storage/ folder (pruned 0); copy to \\\\NAS\\Backups failed: path not found; cloud upload is not set up: .env still has BACKUP_RCLONE_REMOTE",
      ),
    ).toBe(
      "copy to \\\\NAS\\Backups failed: path not found; cloud upload is not set up: .env still has BACKUP_RCLONE_REMOTE",
    );
  });

  it("gives the whole message when it is only a problem", () => {
    expect(problemFromLogMessage("pg_dump exited with code 1")).toBe("pg_dump exited with code 1");
  });

  it("cuts a very long problem short", () => {
    const problem = problemFromLogMessage(`a.dump 1MB; upload to x failed: ${"y".repeat(500)}`);
    expect(problem.length).toBe(303);
    expect(problem.endsWith("...")).toBe(true);
  });
});

describe("what counts as a healthy backup", () => {
  it("is healthy with a backup from last night", () => {
    const health = evaluateBackupHealth(
      facts({ lastLogEntry: entry("OK", hoursAgo(7)) }),
      now,
      { production: true },
    );
    expect(health).toEqual({ kind: "ok", dir: DIR, lastBackupAt: hoursAgo(7) });
  });

  it(`is stale once the newest backup is more than ${BACKUP_MAX_AGE_HOURS} hours old`, () => {
    const atLimit = facts({ newestDumpAt: hoursAgo(BACKUP_MAX_AGE_HOURS) });
    expect(evaluateBackupHealth(atLimit, now, { production: true }).kind).toBe("ok");

    const pastLimit = facts({ newestDumpAt: new Date(hoursAgo(BACKUP_MAX_AGE_HOURS).getTime() - 60_000) });
    expect(evaluateBackupHealth(pastLimit, now, { production: true })).toEqual({
      kind: "stale",
      dir: DIR,
      lastBackupAt: pastLimit.newestDumpAt,
    });
  });

  it("stays stale whatever that old run's own line said", () => {
    for (const status of ["OK", "WARN"] as const) {
      const old = facts({ newestDumpAt: hoursAgo(840), lastLogEntry: entry(status, hoursAgo(840)) });
      expect(evaluateBackupHealth(old, now, { production: true }).kind).toBe("stale");
    }
  });

  it("reports a folder with no backup in it", () => {
    expect(evaluateBackupHealth(facts({ newestDumpAt: null }), now, { production: false })).toEqual({
      kind: "none",
      dir: DIR,
      folderMissing: false,
    });
  });

  it("reports a backup that was made but not fully copied off the server", () => {
    const health = evaluateBackupHealth(
      facts({ lastLogEntry: entry("WARN", hoursAgo(7), RCLONE_LINE.split(" WARN ")[1]) }),
      now,
      { production: true },
    );
    expect(health).toMatchObject({ kind: "not-uploaded", lastBackupAt: hoursAgo(7) });
    expect(health.kind === "not-uploaded" && health.reason).toMatch(/^upload to b2:office-backups/);
  });

  it("reports a failed run, with the last backup file if there is one", () => {
    const failed = evaluateBackupHealth(
      facts({
        newestDumpAt: hoursAgo(31),
        lastLogEntry: entry("FAIL", hoursAgo(7), "pg_dump exited with code 1"),
      }),
      now,
      { production: true },
    );
    expect(failed).toEqual({
      kind: "failed",
      dir: DIR,
      failedAt: hoursAgo(7),
      reason: "pg_dump exited with code 1",
      lastBackupAt: hoursAgo(31),
    });

    const never = evaluateBackupHealth(
      facts({ newestDumpAt: null, lastLogEntry: entry("FAIL", hoursAgo(7), "DATABASE_URL not found") }),
      now,
      { production: true },
    );
    expect(never).toMatchObject({ kind: "failed", lastBackupAt: null });
  });

  it("does not read an earlier run's line as the result of a run still going", () => {
    // Tonight's file is written, its uploads are still running, and the log
    // still ends with last night's failure.
    const running = facts({
      newestDumpAt: hoursAgo(0.01),
      lastLogEntry: entry("FAIL", hoursAgo(24), "pg_dump exited with code 1"),
    });
    expect(evaluateBackupHealth(running, now, { production: true }).kind).toBe("ok");

    // The line is written a few seconds after the file: that one counts.
    const done = facts({
      newestDumpAt: hoursAgo(7),
      lastLogEntry: entry("WARN", new Date(hoursAgo(7).getTime() + 6_000), "a.dump 1MB; upload to x failed: y"),
    });
    expect(evaluateBackupHealth(done, now, { production: true }).kind).toBe("not-uploaded");
  });

  it("treats a missing or closed folder as an alarm on the server only", () => {
    const missing = facts({ folder: "missing", newestDumpAt: null });
    expect(evaluateBackupHealth(missing, now, { production: true })).toEqual({
      kind: "none",
      dir: DIR,
      folderMissing: true,
    });
    expect(evaluateBackupHealth(missing, now, { production: false })).toEqual({ kind: "not-set-up" });

    const closed = facts({ folder: "unreadable", newestDumpAt: null });
    expect(evaluateBackupHealth(closed, now, { production: true })).toEqual({ kind: "unreadable", dir: DIR });
    expect(evaluateBackupHealth(closed, now, { production: false })).toEqual({ kind: "not-set-up" });
  });

  it("has nothing to say on a machine with no backup folder at all", () => {
    const none: BackupFacts = { dir: null, folder: "missing", newestDumpAt: null, lastLogEntry: null };
    expect(evaluateBackupHealth(none, now, { production: true })).toEqual({ kind: "not-set-up" });
  });
});

describe("what an admin is told", () => {
  it("says nothing while the backup is healthy or not set up here", () => {
    expect(describeBackupHealth({ kind: "ok", dir: DIR, lastBackupAt: hoursAgo(7) }, now)).toBeNull();
    expect(describeBackupHealth({ kind: "not-set-up" }, now)).toBeNull();
  });

  it("names the last backup and how long ago it was", () => {
    const notice = describeBackupHealth(
      { kind: "stale", dir: DIR, lastBackupAt: new Date(2026, 9, 10, 2, 0, 3) },
      now,
    );
    expect(notice?.tone).toBe("red");
    expect(notice?.headline).toBe("No backup since Oct 10, 2026, 2:00 AM (35 days ago).");
    expect(notice?.detail).toContain("The nightly backup on the server is not running.");
    expect(notice?.detail).toContain(".\\scripts\\deploy\\check-backup.ps1");
  });

  it("says where it looked when there is no backup", () => {
    expect(describeBackupHealth({ kind: "none", dir: DIR, folderMissing: false }, now)).toMatchObject({
      tone: "red",
      headline: "No backup found.",
      detail: expect.stringContaining(`The backup folder ${DIR} holds no backup.`),
    });
    expect(
      describeBackupHealth({ kind: "none", dir: DIR, folderMissing: true }, now)?.detail,
    ).toContain(`The backup folder ${DIR} does not exist on the server.`);
  });

  it("gives the script's own reason for a failed run", () => {
    const notice = describeBackupHealth(
      {
        kind: "failed",
        dir: DIR,
        failedAt: new Date(2026, 10, 14, 2, 0, 4),
        reason: "pg_dump exited with code 1",
        lastBackupAt: hoursAgo(31),
      },
      now,
    );
    expect(notice?.tone).toBe("red");
    expect(notice?.headline).toBe("The last backup failed (Nov 14, 2026, 2:00 AM, 6 hours ago).");
    expect(notice?.detail.startsWith("pg_dump exited with code 1. On the server,")).toBe(true);
  });

  it("adds that nothing has run since when the failure is days old", () => {
    const notice = describeBackupHealth(
      {
        kind: "failed",
        dir: DIR,
        failedAt: new Date(2026, 9, 10, 2, 0, 4),
        reason: "pg_dump exited with code 1",
        lastBackupAt: new Date(2026, 9, 9, 2, 0, 3),
      },
      now,
    );
    expect(notice?.headline).toBe("The last backup failed (Oct 10, 2026, 2:00 AM, 35 days ago).");
    expect(notice?.detail.startsWith("pg_dump exited with code 1. No backup has run since. On the server,")).toBe(
      true,
    );
  });

  it("is amber when the backup was made but not all of it left the server", () => {
    const notice = describeBackupHealth(
      {
        kind: "not-uploaded",
        dir: DIR,
        lastBackupAt: new Date(2026, 10, 14, 2, 0, 3),
        reason: "upload to Backblaze bucket office-backups failed: 503 service_unavailable",
      },
      now,
    );
    expect(notice?.tone).toBe("amber");
    expect(notice?.headline).toBe(
      "The last backup was not fully copied off the server (Nov 14, 2026, 2:00 AM).",
    );
    expect(notice?.detail).toBe(
      "The backup itself was made. The copy off the server had a problem: upload to Backblaze bucket office-backups failed: 503 service_unavailable. On the server, open PowerShell as administrator in the app folder and run .\\scripts\\deploy\\check-backup.ps1 to see why.",
    );
  });

  it("says so when it cannot look", () => {
    expect(describeBackupHealth({ kind: "unreadable", dir: DIR }, now)).toEqual({
      tone: "amber",
      headline: "The backup cannot be checked.",
      detail: `The app is not allowed to read the backup folder ${DIR}, so it cannot tell whether backups are running. On the server, open PowerShell as administrator in the app folder and run .\\scripts\\deploy\\check-backup.ps1 to check them there.`,
    });
  });

  it("words an age in hours up to two days, then in days", () => {
    expect(formatBackupAge(hoursAgo(0.5), now)).toBe("less than an hour ago");
    expect(formatBackupAge(hoursAgo(1), now)).toBe("1 hour ago");
    expect(formatBackupAge(hoursAgo(27), now)).toBe("27 hours ago");
    expect(formatBackupAge(hoursAgo(49), now)).toBe("2 days ago");
    // A clock that was set back must not show a negative age.
    expect(formatBackupAge(hoursAgo(-3), now)).toBe("less than an hour ago");
  });
});

describe("looking at the backup folder", () => {
  let scratch: string;
  let dir: string;
  const dumpBytes = Buffer.alloc(2048, 7);

  async function writeDump(name: string, modified: Date, bytes: Buffer = dumpBytes) {
    const file = path.join(dir, name);
    await writeFile(file, bytes);
    await utimes(file, modified, modified);
  }

  beforeAll(async () => {
    scratch = await mkdtemp(path.join(os.tmpdir(), "backup-status-"));
  });

  beforeEach(async () => {
    dir = path.join(scratch, "backups");
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    clearBackupHealthCache();
  });

  afterEach(() => {
    delete process.env.BACKUP_DIR;
    clearBackupHealthCache();
  });

  afterAll(async () => {
    await rm(scratch, { recursive: true, force: true });
  });

  it("finds the newest dump and the last log line", async () => {
    await writeDump("precastapp_2026-11-12_0200.dump", new Date(2026, 10, 12, 2, 0, 3));
    await writeDump("precastapp_2026-11-13_1653.dump", new Date(2026, 10, 13, 16, 53, 55));
    await writeFile(path.join(dir, "precastapp-storage_2026-11-13_1653.zip"), "zip");
    await writeFile(path.join(dir, "backup.log"), `\uFEFF${RCLONE_LINE}\r\n${OK_LINE}\r\n`);

    const found = await readBackupFacts(dir);
    expect(found.folder).toBe("ok");
    expect(found.newestDumpAt).toEqual(new Date(2026, 10, 13, 16, 53, 55));
    expect(found.lastLogEntry).toMatchObject({ status: "OK", at: new Date(2026, 10, 13, 16, 53, 59) });
  });

  it("does not count an empty dump, another kind of file, or a folder", async () => {
    await writeDump("precastapp_2026-11-14_0200.dump", new Date(2026, 10, 14, 2, 0, 0), Buffer.alloc(0));
    await writeFile(path.join(dir, "precastapp-storage_2026-11-14_0200.zip"), "zip");
    await mkdir(path.join(dir, "old.dump"));
    await mkdir(path.join(dir, "signed-tickets"));

    const found = await readBackupFacts(dir);
    expect(found).toMatchObject({ folder: "ok", newestDumpAt: null, lastLogEntry: null });
  });

  it("tells a missing folder from an empty one", async () => {
    expect(await readBackupFacts(path.join(scratch, "nowhere"))).toMatchObject({ folder: "missing" });
    // A file where the folder should be.
    await writeFile(path.join(scratch, "a-file"), "x");
    expect(await readBackupFacts(path.join(scratch, "a-file", "backups"))).toMatchObject({
      folder: "missing",
    });
    expect(await readBackupFacts(null)).toMatchObject({ dir: null });
  });

  it("reads only the end of a very long log", async () => {
    const old = `${RCLONE_LINE}\n`.repeat(2000);
    await writeFile(path.join(dir, "backup.log"), `${old}${OK_LINE}\n`);
    expect((await readBackupFacts(dir)).lastLogEntry?.status).toBe("OK");
  });

  it("answers from the folder BACKUP_DIR names, and not more often than every few seconds", async () => {
    process.env.BACKUP_DIR = dir;
    const start = new Date(2026, 10, 14, 9, 0, 0);

    expect(await getBackupHealth(start)).toEqual({ kind: "none", dir, folderMissing: false });

    await writeDump("precastapp_2026-11-14_0200.dump", new Date(2026, 10, 14, 2, 0, 3));
    // Asked again a moment later: still the earlier answer.
    expect((await getBackupHealth(new Date(start.getTime() + 5_000))).kind).toBe("none");
    // Asked again later: the folder is read again.
    expect(await getBackupHealth(new Date(start.getTime() + 20_000))).toEqual({
      kind: "ok",
      dir,
      lastBackupAt: new Date(2026, 10, 14, 2, 0, 3),
    });
  });

  it("stays quiet outside the server when the folder is not there", async () => {
    process.env.BACKUP_DIR = path.join(scratch, "nowhere");
    expect(await getBackupHealth()).toEqual({ kind: "not-set-up" });
  });
});
