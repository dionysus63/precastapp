import type { PrismaClient, StructureStatus } from "@/app/generated/prisma/client";
import {
  buildDrillSheetFormValues,
  drillSheetDetailInclude,
  type DrillSheetFormValues,
} from "@/lib/drill-sheet-detail";
import {
  buildRectSheetFormValues,
  rectSheetDetailInclude,
} from "@/lib/rect-sheet-detail";
import type { RectSheetFormValues } from "@/components/drill-sheets/rect-sheet-form";

export type BulkEditRowInfo = {
  structureId: string;
  /** ISO timestamp for the optimistic-concurrency guard on save. */
  updatedAt: string;
  status: StructureStatus;
  quantity: number | null;
  /** Set when the structure (or any piece) is already poured or shipped. */
  isProduced: boolean;
};

export type CircularBulkEditRow = BulkEditRowInfo & {
  values: DrillSheetFormValues;
};

export type RectBulkEditRow = BulkEditRowInfo & {
  values: RectSheetFormValues;
};

export type JobStructuresBulkEditData = {
  circular: CircularBulkEditRow[];
  rect: RectBulkEditRow[];
  /** Structures without a completed sheet — not editable in the grid. */
  skipped: { structureId: string; label: string }[];
};

function rowInfo(structure: {
  id: string;
  updatedAt: Date;
  status: StructureStatus;
  quantity: { toString(): string } | null;
  madeDate: Date | null;
  shippedDate: Date | null;
}): BulkEditRowInfo {
  return {
    structureId: structure.id,
    updatedAt: structure.updatedAt.toISOString(),
    status: structure.status,
    quantity: structure.quantity === null ? null : Number(structure.quantity),
    isProduced:
      structure.status === "MADE" ||
      structure.status === "SHIPPED" ||
      structure.madeDate !== null ||
      structure.shippedDate !== null,
  };
}

export async function loadJobStructuresForBulkEdit(
  client: PrismaClient,
  jobId: string,
): Promise<JobStructuresBulkEditData> {
  const [circularSheets, rectSheets, templates, allStructures] =
    await Promise.all([
      client.jobStructure.findMany({
        where: {
          jobId,
          structureTemplate: { shape: "CIRCULAR" },
          calc: { isNot: null },
        },
        include: drillSheetDetailInclude,
        orderBy: [{ structureNumber: "asc" }, { createdAt: "asc" }],
      }),
      client.jobStructure.findMany({
        where: {
          jobId,
          structureTemplate: { shape: "RECTANGULAR" },
          calc: { isNot: null },
        },
        include: rectSheetDetailInclude,
        orderBy: [{ structureNumber: "asc" }, { createdAt: "asc" }],
      }),
      client.structureTemplate.findMany({
        where: { shape: "CIRCULAR" },
        select: {
          id: true,
          diameters: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, insideDiameterFeet: true },
          },
        },
      }),
      client.jobStructure.findMany({
        where: { jobId },
        select: {
          id: true,
          structureNumber: true,
          description: true,
          structureTemplateId: true,
          calc: { select: { id: true } },
        },
        orderBy: [{ structureNumber: "asc" }, { createdAt: "asc" }],
      }),
    ]);

  const diametersByTemplate = new Map(
    templates.map((template) => [
      template.id,
      template.diameters.map((diameter) => ({
        id: diameter.id,
        insideDiameterFeet: Number(diameter.insideDiameterFeet),
      })),
    ]),
  );

  const circular: CircularBulkEditRow[] = circularSheets.map((sheet) => ({
    ...rowInfo(sheet),
    values: buildDrillSheetFormValues(
      sheet,
      diametersByTemplate.get(sheet.structureTemplateId ?? "") ?? [],
    ),
  }));

  const rect: RectBulkEditRow[] = rectSheets.map((sheet) => ({
    ...rowInfo(sheet),
    values: buildRectSheetFormValues(sheet),
  }));

  const editableIds = new Set([
    ...circular.map((row) => row.structureId),
    ...rect.map((row) => row.structureId),
  ]);
  const skipped = allStructures
    .filter((structure) => !editableIds.has(structure.id))
    .map((structure) => ({
      structureId: structure.id,
      label:
        [structure.structureNumber, structure.description]
          .filter(Boolean)
          .join(" — ") || "Unnamed structure",
    }));

  return { circular, rect, skipped };
}
