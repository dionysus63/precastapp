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

export type JobCustomStructureImportCandidate = {
  structureNumber: string;
  description: string;
  qty: string;
  weight: string;
  yards: string;
  statusLabel: string;
};

function toPlainNumberString(value: { toString(): string } | null): string {
  if (value == null) {
    return "";
  }
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? String(parsed) : "";
}

/**
 * Custom structures on the job (bulk-added or hand-created) that no quote
 * has picked up yet, as prefill rows for the quote form's custom-structure
 * editor. Item codes match structure numbers, so winning the quote adopts
 * these exact structures — statuses and production progress stay put.
 */
export async function loadJobCustomStructureImportCandidates(
  jobId: string,
): Promise<JobCustomStructureImportCandidate[]> {
  await requirePermission(AppPermission.QUOTES_MANAGE);

  const structures = await prisma.jobStructure.findMany({
    where: {
      jobId,
      quoteId: null,
      quoteLineItems: { none: {} },
      structureType: "CUSTOM_STRUCTURE",
      structureNumber: { not: null },
    },
    orderBy: [{ structureNumber: "asc" }, { createdAt: "asc" }],
    select: {
      structureNumber: true,
      description: true,
      quantity: true,
      weight: true,
      yards: true,
      status: true,
    },
  });

  return structures
    .filter((structure) => structure.structureNumber?.trim())
    .map((structure) => ({
      structureNumber: structure.structureNumber!.trim(),
      description: structure.description ?? "",
      qty: toPlainNumberString(structure.quantity) || "1",
      weight: toPlainNumberString(structure.weight),
      yards: toPlainNumberString(structure.yards),
      statusLabel: STATUS_LABELS[structure.status] ?? structure.status,
    }));
}
