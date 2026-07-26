"use server";

import { revalidatePath } from "next/cache";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import {
  parseDrillSheetPayloadData,
  updateJobStructureFromPayload,
} from "@/lib/drill-sheet-persistence";
import {
  parseRectSheetPayloadData,
  updateRectJobStructureFromPayload,
} from "@/lib/rect-sheet-persistence";
import { prisma, withDatabaseRetry } from "@/lib/prisma";

export type BulkSheetRowInput = {
  structureId: string;
  /** ISO timestamp from load time; save fails if the row changed since. */
  expectedUpdatedAt: string;
  /** Sheet payload object (same shape the single-edit forms post as JSON). */
  payload: unknown;
};

export type BulkSheetRowResult = {
  structureId: string;
  ok: boolean;
  error?: string;
  /** New baseline for a successfully saved row. */
  updatedAt?: string;
};

const MAX_BULK_ROWS = 200;

async function runBulkUpdate(
  jobId: string,
  rows: BulkSheetRowInput[],
  updateRow: (row: BulkSheetRowInput) => Promise<void>,
): Promise<BulkSheetRowResult[]> {
  if (!jobId.trim()) {
    throw new Error("Job is required.");
  }
  if (rows.length > MAX_BULK_ROWS) {
    throw new Error(`Too many rows in one save (max ${MAX_BULK_ROWS}).`);
  }

  const jobStructures = await withDatabaseRetry((client) =>
    client.jobStructure.findMany({
      where: { jobId },
      select: { id: true },
    }),
  );
  const jobStructureIds = new Set(jobStructures.map((entry) => entry.id));

  const results: BulkSheetRowResult[] = [];
  // Sequential on purpose: each update is its own transaction, and rows can
  // share templates/products — parallel writes would just contend.
  for (const row of rows) {
    if (!jobStructureIds.has(row.structureId)) {
      results.push({
        structureId: row.structureId,
        ok: false,
        error: "Structure does not belong to this job.",
      });
      continue;
    }
    try {
      await updateRow(row);
      const updated = await prisma.jobStructure.findUnique({
        where: { id: row.structureId },
        select: { updatedAt: true },
      });
      results.push({
        structureId: row.structureId,
        ok: true,
        updatedAt: updated?.updatedAt.toISOString(),
      });
    } catch (error) {
      results.push({
        structureId: row.structureId,
        ok: false,
        error:
          error instanceof Error ? error.message : "Could not save this row.",
      });
    }
  }

  if (results.some((entry) => entry.ok)) {
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath(`/jobs/${jobId}/structures/bulk-edit`);
    revalidatePath("/drill-sheets");
    revalidatePath("/production");
  }

  return results;
}

export async function bulkUpdateDrillSheets(
  jobId: string,
  rows: BulkSheetRowInput[],
): Promise<BulkSheetRowResult[]> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  return runBulkUpdate(jobId, rows, async (row) => {
    const payload = parseDrillSheetPayloadData(row.payload);
    // The grid edits structures in place — never let a row detach from its job.
    payload.jobId = jobId;
    await updateJobStructureFromPayload(
      row.structureId,
      payload,
      row.expectedUpdatedAt,
    );
  });
}

export async function bulkUpdateRectSheets(
  jobId: string,
  rows: BulkSheetRowInput[],
): Promise<BulkSheetRowResult[]> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  return runBulkUpdate(jobId, rows, async (row) => {
    const payload = parseRectSheetPayloadData(row.payload);
    payload.jobId = jobId;
    await updateRectJobStructureFromPayload(
      row.structureId,
      payload,
      row.expectedUpdatedAt,
    );
  });
}
