import "server-only";

import type { RectSheetFormValues } from "@/components/drill-sheets/rect-sheet-form";
import type { DrillSheetFormValues } from "@/lib/drill-sheet-detail";
import { loadJobStructuresForBulkEdit } from "@/lib/job-structures-bulk-edit";
import { withDatabaseRetry } from "@/lib/prisma";
import {
  ONE_OFF_MAX_OPENINGS,
  circularRowFromSheet,
  rectRowFromSheet,
  type OneOffCircularOptions,
  type OneOffRectOptions,
  type OneOffRow,
} from "@/lib/quotes/one-off-drill-sheets";

export type OneOffEditSheet<Values> = {
  structureId: string;
  /** ISO timestamp for the save's changed-by-someone-else guard. */
  updatedAt: string;
  values: Values;
  row: OneOffRow;
};

export type OneOffEditData = {
  job: { id: string; jobNumber: string; projectName: string; customerName: string };
  circular: OneOffEditSheet<DrillSheetFormValues>[];
  rect: OneOffEditSheet<RectSheetFormValues>[];
  /** Structure numbers on the job that aren't in the grids. */
  otherNumbers: string[];
  /** Structures left out of the grids, and why. */
  notEditable: { label: string; reason: string }[];
};

/**
 * Loads a job's saved drill sheets as One-Off grid rows. `structureIds`
 * narrows it to those sheets (e.g. the ones just created). Sheets already
 * made or shipped, or with more openings than the grid shows, stay out.
 */
export async function loadOneOffEditData(
  jobId: string,
  structureIds: string[] | null,
  circularTemplates: OneOffCircularOptions["templates"],
  rectTemplates: OneOffRectOptions["templates"],
): Promise<OneOffEditData | null> {
  const job = await withDatabaseRetry((client) =>
    client.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        jobNumber: true,
        projectName: true,
        customerName: true,
        jobStructures: { select: { id: true, structureNumber: true } },
      },
    }),
  );
  if (!job) {
    return null;
  }

  const data = await withDatabaseRetry((client) =>
    loadJobStructuresForBulkEdit(client, jobId),
  );
  const wanted = structureIds?.length ? new Set(structureIds) : null;
  const rectTemplateIds = new Set(rectTemplates.map((template) => template.id));
  const notEditable: OneOffEditData["notEditable"] = [];

  function keep(
    row: { structureId: string; isProduced: boolean },
    label: string,
    openingCount: number,
    templateMissing: boolean,
  ): boolean {
    if (wanted && !wanted.has(row.structureId)) {
      return false;
    }
    const reason = row.isProduced
      ? "already made or shipped"
      : openingCount > ONE_OFF_MAX_OPENINGS
        ? `more than ${ONE_OFF_MAX_OPENINGS} openings`
        : templateMissing
          ? "its template is retired"
          : null;
    if (reason) {
      notEditable.push({ label: label || "Unnamed structure", reason });
      return false;
    }
    return true;
  }

  const circular = data.circular
    .filter((sheet) =>
      keep(sheet, sheet.values.manholeNumber, sheet.values.openings.length, false),
    )
    .map((sheet) => ({
      structureId: sheet.structureId,
      updatedAt: sheet.updatedAt,
      values: sheet.values,
      row: circularRowFromSheet(sheet.structureId, sheet.values, circularTemplates),
    }));

  const rect = data.rect
    .filter((sheet) =>
      keep(
        sheet,
        sheet.values.structureNumber,
        sheet.values.openings.length,
        !rectTemplateIds.has(sheet.values.templateId),
      ),
    )
    .map((sheet) => ({
      structureId: sheet.structureId,
      updatedAt: sheet.updatedAt,
      values: sheet.values,
      row: rectRowFromSheet(sheet.structureId, sheet.values),
    }));

  if (!wanted) {
    for (const skipped of data.skipped) {
      notEditable.push({ label: skipped.label, reason: "no drill sheet yet" });
    }
  }

  const inGrid = new Set([
    ...circular.map((sheet) => sheet.structureId),
    ...rect.map((sheet) => sheet.structureId),
  ]);
  const otherNumbers = job.jobStructures
    .filter((structure) => !inGrid.has(structure.id))
    .map((structure) => structure.structureNumber ?? "")
    .filter(Boolean);

  return {
    job: {
      id: job.id,
      jobNumber: job.jobNumber,
      projectName: job.projectName,
      customerName: job.customerName,
    },
    circular,
    rect,
    otherNumbers,
    notEditable,
  };
}
