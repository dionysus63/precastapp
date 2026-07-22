import type { PrismaClient } from "@/app/generated/prisma/client";
import { Prisma } from "@/app/generated/prisma/client";
import { formatQuantity } from "@/lib/format";

/** In-production structure row for the Daily Production page. */
export type DailyProductionStructureRow = {
  jobStructureId: string;
  structureNumber: string;
  description: string | null;
  jobId: string | null;
  jobNumber: string | null;
  projectName: string | null;
  /** Total to make, as displayed ("44"); null when the structure has no quantity. */
  quantity: string | null;
  quantityNumber: number | null;
  madeSoFar: number;
  unit: string | null;
  pieces: {
    id: string;
    name: string;
    made: boolean;
  }[];
};

/** One saved entry shown in the "entered so far" panel for a day. */
export type DailyProductionDayEntry = {
  id: string;
  enteredBy: string | null;
  notes: string | null;
  createdAtLabel: string;
  lines: string[];
};

export async function getStructuresInProductionForDaily(
  client: PrismaClient,
): Promise<DailyProductionStructureRow[]> {
  const structures = await client.jobStructure.findMany({
    where: { status: "IN_PRODUCTION" },
    orderBy: [{ job: { jobNumber: "asc" } }, { structureNumber: "asc" }],
    select: {
      id: true,
      structureNumber: true,
      description: true,
      quantity: true,
      unit: true,
      job: { select: { id: true, jobNumber: true, projectName: true } },
      pieces: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, madeDate: true },
      },
    },
  });

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

  return structures.map((row) => ({
    jobStructureId: row.id,
    structureNumber: row.structureNumber ?? "—",
    description: row.description,
    jobId: row.job?.id ?? null,
    jobNumber: row.job?.jobNumber ?? null,
    projectName: row.job?.projectName ?? null,
    quantity: row.quantity != null ? formatQuantity(row.quantity) : null,
    quantityNumber: row.quantity != null ? row.quantity.toNumber() : null,
    madeSoFar: madeByStructure.get(row.id) ?? 0,
    unit: row.unit,
    pieces: row.pieces.map((piece) => ({
      id: piece.id,
      name: piece.name,
      made: piece.madeDate != null,
    })),
  }));
}

export async function getProductionDayEntries(
  client: PrismaClient,
  productionDate: Date,
): Promise<DailyProductionDayEntry[]> {
  const entries = await client.dailyProductionEntry.findMany({
    where: { productionDate },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      enteredBy: true,
      notes: true,
      createdAt: true,
      lines: {
        select: {
          quantityProduced: true,
          product: { select: { productCode: true, name: true, unit: true } },
        },
      },
      structureLines: {
        select: {
          quantityMade: true,
          jobStructure: {
            select: {
              structureNumber: true,
              job: { select: { jobNumber: true } },
            },
          },
          jobStructurePiece: { select: { name: true } },
        },
      },
    },
  });

  return entries
    .filter(
      (entry) => entry.lines.length > 0 || entry.structureLines.length > 0,
    )
    .map((entry) => ({
      id: entry.id,
      enteredBy: entry.enteredBy,
      notes: entry.notes,
      createdAtLabel: entry.createdAt.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      lines: [
        ...entry.structureLines.map((line) => {
          const jobPrefix = line.jobStructure.job?.jobNumber
            ? `${line.jobStructure.job.jobNumber} `
            : "";
          const label = `${jobPrefix}${line.jobStructure.structureNumber ?? "Structure"}`;
          if (line.jobStructurePiece) {
            return `${label} — ${line.jobStructurePiece.name}`;
          }
          return `${label} ×${formatQuantity(line.quantityMade)}`;
        }),
        ...entry.lines.map(
          (line) =>
            `${line.product.productCode} ×${formatQuantity(line.quantityProduced)}${
              line.product.unit && line.product.unit !== "EA"
                ? ` ${line.product.unit}`
                : ""
            }`,
        ),
      ],
    }));
}

/** Parse a yyyy-mm-dd string the same way the entry writers do. */
export function parseProductionDate(value: string | undefined): Date {
  const raw = (value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  const today = new Date();
  return new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );
}

/** Stock product row for the browse-by-category grid. */
export type DailyProductionStockProduct = {
  id: string;
  productCode: string;
  name: string;
  unit: string;
  categoryId: string;
  subcategoryId: string | null;
};

export async function getStockProductsForDaily(
  client: PrismaClient,
): Promise<DailyProductionStockProduct[]> {
  const products = await client.product.findMany({
    where: { trackInventory: true, status: "ACTIVE" },
    orderBy: [{ productCode: "asc" }],
    select: {
      id: true,
      productCode: true,
      name: true,
      unit: true,
      categoryId: true,
      subcategoryId: true,
    },
  });
  return products;
}
