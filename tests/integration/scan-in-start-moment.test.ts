import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAppSettings } from "@/lib/app-settings";
import { prisma } from "@/lib/prisma";

/**
 * The Scan In migration notes the moment it ran (AppSettings.scanInStartedAt):
 * tickets delivered before that moment stay off Still Out. The app reads
 * timestamps as UTC, and PostgreSQL on the office PCs keeps Eastern time, so
 * a plain CURRENT_TIMESTAMP in a migration lands four or five hours early.
 * The test database keeps UTC, which hides that: this test turns the clock.
 */

const MIGRATION = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20261113190000_ticket_scan_in",
  "migration.sql",
);

/** Thrown to leave the transaction without keeping what it wrote. */
class LeaveNoTrace extends Error {}

async function startMoment(
  tx: Pick<typeof prisma, "appSettings">,
): Promise<number> {
  const row = await tx.appSettings.findUniqueOrThrow({
    where: { id: "default" },
    select: { scanInStartedAt: true },
  });
  return row.scanInStartedAt.getTime();
}

describe("the moment Scan In started, as its migration stamps it", () => {
  it("is the true moment on a database that keeps Eastern time", async () => {
    await getAppSettings();
    const sql = await readFile(MIGRATION, "utf8");
    const statement = /UPDATE "AppSettings"\s+SET "scanInStartedAt"[^;]*;/.exec(sql)?.[0];
    expect(statement, "the migration stamps the settings row").toBeTruthy();

    let plain = 0;
    let stamped = 0;
    const before = Date.now();
    await prisma
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL TIME ZONE 'America/New_York'`);
        // What a migration writes with no time zone named: hours early.
        await tx.$executeRawUnsafe(
          `UPDATE "AppSettings" SET "scanInStartedAt" = CURRENT_TIMESTAMP`,
        );
        plain = await startMoment(tx);
        // What the Scan In migration writes.
        await tx.$executeRawUnsafe(statement!);
        stamped = await startMoment(tx);
        throw new LeaveNoTrace();
      })
      .catch((error) => {
        if (!(error instanceof LeaveNoTrace)) {
          throw error;
        }
      });
    const after = Date.now();

    // New York is four or five hours behind UTC all year.
    expect(before - plain).toBeGreaterThan(3 * 3_600_000);
    expect(stamped).toBeGreaterThanOrEqual(before - 60_000);
    expect(stamped).toBeLessThanOrEqual(after + 60_000);
  });
});
