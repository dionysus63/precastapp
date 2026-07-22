import type { PrismaClient } from "@/app/generated/prisma/client";
import type { Prisma } from "@/app/generated/prisma/client";
import type {
  JobProgressLine,
  JobProgressSummary,
  JobProgressView,
  JobStatusVariant,
  JobStructureProgressLine,
} from "@/components/jobs/job-utils";
import {
  structureNeedsDrillSheet,
  structureStatusOptions,
} from "@/components/structures/structure-utils";
import { getQuoteLineFulfillmentAndScheduled } from "@/lib/delivery-fulfillment";
import { resolveCreateDrillSheetHref } from "@/lib/needs-drill-sheet";

type DbClient = PrismaClient | Prisma.TransactionClient;

const structureStatusLabels: Record<string, string> = Object.fromEntries(
  structureStatusOptions.map((option) => [option.value, option.label]),
);

const SUBMITTAL_DOCUMENT_TYPES = new Set([
  "JOB_SPECIFIC_SUBMITTAL",
  "APPROVED_SUBMITTAL",
]);

function structureStatusVariant(status: string): JobStatusVariant {
  switch (status) {
    case "MADE":
    case "SHIPPED":
      return "success";
    case "APPROVED":
    case "IN_PRODUCTION":
      return "info";
    case "SUBMITTED":
      return "warning";
    default:
      return "neutral";
  }
}

function submittalStatusVariant(status: string): JobStatusVariant {
  switch (status) {
    case "APPROVED":
    case "IN_PRODUCTION":
    case "MADE":
    case "SHIPPED":
      return "success";
    case "SUBMITTED":
      return "warning";
    default:
      return "neutral";
  }
}

function submittalStatusLabel(
  needsSubmittal: boolean,
  structureStatus: string | null,
): string {
  if (!needsSubmittal) {
    return "—";
  }

  if (!structureStatus || structureStatus === "NOT_SUBMITTED") {
    return "Not Submitted";
  }

  if (structureStatus === "SUBMITTED") {
    return "Submitted";
  }

  if (
    structureStatus === "APPROVED" ||
    structureStatus === "IN_PRODUCTION" ||
    structureStatus === "MADE" ||
    structureStatus === "SHIPPED"
  ) {
    return "Approved";
  }

  return structureStatusLabels[structureStatus] ?? structureStatus;
}

function formatQty(value: number, unit: string): string {
  const formatted = value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatStockLevel(
  lineType: string,
  currentStock: number | null,
  isDrainRing: boolean,
  drainRingOptions: { currentStock: number | null; trackInventory: boolean }[],
  isCastingAssembly: boolean,
  castingComponentOptions: {
    currentStock: number | null;
    trackInventory: boolean;
  }[],
): string {
  if (lineType === "STOCK_PRODUCT" && currentStock != null) {
    return String(currentStock);
  }

  if (isDrainRing && drainRingOptions.length > 0) {
    const stocked = drainRingOptions.filter(
      (option) => option.trackInventory && option.currentStock != null,
    );
    if (stocked.length === 0) {
      return "—";
    }
    const total = stocked.reduce(
      (sum, option) => sum + (option.currentStock ?? 0),
      0,
    );
    return String(total);
  }

  if (isCastingAssembly && castingComponentOptions.length > 0) {
    const stocked = castingComponentOptions.filter(
      (option) => option.trackInventory && option.currentStock != null,
    );
    if (stocked.length === 0) {
      return "—";
    }
    const minStock = Math.min(...stocked.map((option) => option.currentStock ?? 0));
    return `${minStock} min`;
  }

  return "—";
}

function buildSummary(lines: JobProgressLine[]): JobProgressSummary {
  let fullyShippedLines = 0;
  let partiallyShippedLines = 0;
  let notShippedLines = 0;

  for (const line of lines) {
    const awarded = Number.parseFloat(line.awardedQty.replace(/[^\d.-]/g, ""));
    const shipped = Number.parseFloat(line.shippedQty.replace(/[^\d.-]/g, ""));

    if (!Number.isFinite(awarded) || awarded <= 0) {
      continue;
    }

    if (shipped >= awarded) {
      fullyShippedLines += 1;
    } else if (shipped > 0) {
      partiallyShippedLines += 1;
    } else {
      notShippedLines += 1;
    }
  }

  return {
    totalLines: lines.length,
    fullyShippedLines,
    partiallyShippedLines,
    notShippedLines,
  };
}

const EMPTY_PROGRESS: JobProgressView = {
  quoteId: null,
  quoteNumber: null,
  lines: [],
  summary: {
    totalLines: 0,
    fullyShippedLines: 0,
    partiallyShippedLines: 0,
    notShippedLines: 0,
  },
  structureLines: [],
};

/**
 * Progress for jobs without a won quote (detailing flow: structures created
 * straight on the job): production progress per structure, from the Daily
 * Production log.
 */
async function getStructureProgressLines(
  client: DbClient,
  jobId: string,
): Promise<JobStructureProgressLine[]> {
  const structures = await client.jobStructure.findMany({
    where: { jobId },
    orderBy: [{ structureNumber: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      structureNumber: true,
      description: true,
      quantity: true,
      unit: true,
      status: true,
      pieces: { select: { madeDate: true } },
    },
  });
  if (structures.length === 0) {
    return [];
  }

  const madeSums = await client.dailyProductionStructureLine.groupBy({
    by: ["jobStructureId"],
    where: { jobStructureId: { in: structures.map((row) => row.id) } },
    _sum: { quantityMade: true },
  });
  const madeByStructure = new Map(
    madeSums.map((row) => [
      row.jobStructureId,
      row._sum.quantityMade?.toNumber() ?? 0,
    ]),
  );

  return structures.map((structure) => {
    const unit = structure.unit ?? "";
    const qty = structure.quantity?.toNumber() ?? null;
    const complete =
      structure.status === "MADE" || structure.status === "SHIPPED";
    let made: number;
    if (structure.pieces.length > 0) {
      made = structure.pieces.filter((piece) => piece.madeDate != null).length;
    } else if (complete) {
      // Marked made without (or before) a production log — show it complete.
      made = qty ?? 1;
    } else {
      made = madeByStructure.get(structure.id) ?? 0;
    }
    const total = structure.pieces.length > 0 ? structure.pieces.length : qty;
    const pieceUnit = structure.pieces.length > 0 ? "pcs" : unit;
    return {
      id: structure.id,
      structureNumber: structure.structureNumber ?? "—",
      description: structure.description ?? "—",
      quantity: total != null ? formatQty(total, pieceUnit) : "—",
      madeSoFar: formatQty(made, pieceUnit),
      remainingToMake:
        total != null ? formatQty(Math.max(0, total - made), pieceUnit) : "—",
      statusLabel: structureStatusLabels[structure.status] ?? structure.status,
      statusVariant: structureStatusVariant(structure.status),
    };
  });
}

export async function getJobProgress(
  client: DbClient,
  jobId: string,
): Promise<JobProgressView> {
  const wonQuote = await client.quote.findFirst({
    where: { jobId, status: "WON" },
    orderBy: { revisionNumber: "desc" },
    select: { id: true, quoteNumber: true },
  });

  if (!wonQuote) {
    return {
      ...EMPTY_PROGRESS,
      structureLines: await getStructureProgressLines(client, jobId),
    };
  }

  const { fulfillment, scheduled: scheduledMap } =
    await getQuoteLineFulfillmentAndScheduled(client, wonQuote.id);

  const structureIds = [
    ...new Set(
      fulfillment
        .map((line) => line.jobStructureId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const structures =
    structureIds.length > 0
      ? await client.jobStructure.findMany({
          where: { id: { in: structureIds } },
          select: {
            id: true,
            status: true,
            needsSubmittal: true,
            needsCutSheet: true,
            structureTemplateId: true,
            structureType: true,
            quoteId: true,
            documents: { select: { documentType: true } },
            quoteLineItems: {
              select: { structureConfigJson: true },
              take: 1,
            },
          },
        })
      : [];

  const structureById = new Map(structures.map((structure) => [structure.id, structure]));

  const lines: JobProgressLine[] = fulfillment.map((line) => {
    const structure = line.jobStructureId
      ? structureById.get(line.jobStructureId)
      : null;
    const submittalDocCount = structure
      ? structure.documents.filter((document) =>
          SUBMITTAL_DOCUMENT_TYPES.has(document.documentType),
        ).length
      : 0;
    const structureStatus = structure?.status ?? line.jobStructureStatus;
    const needsSubmittal = structure?.needsSubmittal ?? false;
    const scheduledQty = scheduledMap.get(line.quoteLineItemId) ?? 0;
    const needsDrillSheet = structure
      ? structureNeedsDrillSheet(structure)
      : false;
    const createDrillSheetHref =
      needsDrillSheet && structure
        ? resolveCreateDrillSheetHref(
            structure.id,
            structure.quoteId,
            structure.quoteLineItems[0]?.structureConfigJson ?? null,
          )
        : null;

    return {
      quoteLineItemId: line.quoteLineItemId,
      lineNumber: line.lineNumber,
      itemCode: line.itemCode,
      description: line.description ?? "—",
      displayName: line.displayName,
      unit: line.unit,
      awardedQty: formatQty(line.quotedQty, line.unit),
      shippedQty: formatQty(line.shippedQty, line.unit),
      scheduledQty: formatQty(scheduledQty, line.unit),
      remainingQty: formatQty(line.remainingQty, line.unit),
      stockLevel: formatStockLevel(
        line.lineType,
        line.currentStock,
        line.isDrainRing,
        line.drainRingOptions,
        line.isCastingAssembly,
        line.castingComponentOptions,
      ),
      submittalStatus: submittalStatusLabel(
        needsSubmittal,
        structureStatus,
      ),
      submittalStatusVariant: needsSubmittal
        ? submittalStatusVariant(structureStatus ?? "NOT_SUBMITTED")
        : "neutral",
      submittalDocCount,
      // "Not Submitted" is misleading while the cut sheet doesn't exist yet.
      structureStatus: needsDrillSheet
        ? "Needs drill sheet"
        : structureStatus
          ? (structureStatusLabels[structureStatus] ?? structureStatus)
          : "—",
      structureStatusVariant: needsDrillSheet
        ? "warning"
        : structureStatus
          ? structureStatusVariant(structureStatus)
          : "neutral",
      lineType: line.lineType,
      jobStructureId: line.jobStructureId,
      needsDrillSheet,
      createDrillSheetHref,
    };
  });

  return {
    quoteId: wonQuote.id,
    quoteNumber: wonQuote.quoteNumber,
    lines,
    summary: buildSummary(lines),
    structureLines: [],
  };
}
