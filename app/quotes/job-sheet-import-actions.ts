"use server";

import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  mapCircularSheetToWorkbookRow,
  mapRectSheetToWorkbookRow,
} from "@/lib/quotes/job-sheet-import";
import type { StructureWorkbookRow } from "@/lib/quotes/structure-workbook";
import type { RectWorkbookRow } from "@/lib/quotes/rect-structure-workbook";

export type JobSheetImportCandidate<Row> = {
  structureNumber: string;
  templateName: string;
  statusLabel: string;
  openingCount: number;
  row: Row;
};

export type JobSheetImportCandidates = {
  rect: JobSheetImportCandidate<RectWorkbookRow>[];
  circular: JobSheetImportCandidate<StructureWorkbookRow>[];
};

const STATUS_LABELS: Record<string, string> = {
  NOT_SUBMITTED: "Not submitted",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  IN_PRODUCTION: "In production",
  MADE: "Made",
  SHIPPED: "Shipped",
};

/**
 * Drill-sheet structures on the job that no quote has picked up yet, mapped
 * to workbook rows. "Not picked up" mirrors quote-won adoption's filter
 * (no quote, no line): importing these creates matching structure lines, and
 * winning the quote links them back to these exact structures by number.
 */
export async function loadJobSheetImportCandidates(
  jobId: string,
): Promise<JobSheetImportCandidates> {
  await requirePermission(AppPermission.QUOTES_MANAGE);

  const sheets = await prisma.jobStructure.findMany({
    where: {
      jobId,
      quoteId: null,
      quoteLineItems: { none: {} },
      calc: { isNot: null },
      structureTemplateId: { not: null },
    },
    orderBy: { createdAt: "asc" },
    include: {
      structureTemplate: { select: { name: true, shape: true } },
      calc: true,
      dimensions: true,
      openings: { orderBy: { openingNumber: "asc" } },
      castings: true,
    },
  });

  const result: JobSheetImportCandidates = { rect: [], circular: [] };
  for (const sheet of sheets) {
    const base = {
      structureNumber: sheet.structureNumber ?? "",
      templateName: sheet.structureTemplate?.name ?? "",
      statusLabel: STATUS_LABELS[sheet.status] ?? sheet.status,
      openingCount: sheet.openings.length,
    };
    if (sheet.structureTemplate?.shape === "RECTANGULAR") {
      result.rect.push({ ...base, row: mapRectSheetToWorkbookRow(sheet) });
    } else if (sheet.structureTemplate?.shape === "CIRCULAR") {
      result.circular.push({
        ...base,
        row: mapCircularSheetToWorkbookRow(sheet),
      });
    }
  }
  return result;
}
