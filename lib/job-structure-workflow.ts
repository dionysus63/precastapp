import type { PrismaClient } from "@/app/generated/prisma/client";
import type {
  QuoteLineType,
  StructureStatus,
  StructureType,
} from "@/app/generated/prisma/client";

const STRUCTURE_LINE_TYPES: QuoteLineType[] = [
  "CONFIGURABLE_STRUCTURE",
  "CUSTOM_STRUCTURE",
];

function mapLineTypeToStructureType(lineType: QuoteLineType): StructureType {
  if (lineType === "CONFIGURABLE_STRUCTURE") {
    return "CONFIGURABLE_PRODUCT";
  }
  return "CUSTOM_STRUCTURE";
}

/**
 * When a quote is WON, create JobStructure rows for configurable/custom lines
 * and link them on QuoteLineItem.jobStructureId.
 */
export async function linkJobStructuresFromQuote(
  client: PrismaClient,
  quoteId: string,
): Promise<number> {
  const quote = await client.quote.findUnique({
    where: { id: quoteId },
    include: {
      lineItems: {
        where: {
          lineType: { in: STRUCTURE_LINE_TYPES },
          jobStructureId: null,
        },
        orderBy: { lineNumber: "asc" },
      },
    },
  });

  if (!quote) {
    throw new Error("Quote not found.");
  }

  let created = 0;

  for (const line of quote.lineItems) {
    const structure = await client.jobStructure.create({
      data: {
        jobId: quote.jobId,
        quoteId: quote.id,
        productId: line.productId,
        structureType: mapLineTypeToStructureType(line.lineType),
        structureNumber: line.itemCode,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        weight: line.weight,
        yards: line.yards,
        status: "NOT_SUBMITTED",
        needsCutSheet:
          line.lineType === "CONFIGURABLE_STRUCTURE" ||
          line.lineType === "CUSTOM_STRUCTURE",
        needsSubmittal: line.lineType === "CUSTOM_STRUCTURE",
      },
    });

    await client.quoteLineItem.update({
      where: { id: line.id },
      data: { jobStructureId: structure.id },
    });

    created += 1;
  }

  return created;
}

export async function setJobStructureStatus(
  client: PrismaClient,
  jobStructureId: string,
  status: StructureStatus,
): Promise<void> {
  const now = new Date();
  const data: {
    status: StructureStatus;
    approvedDate?: Date;
    productionDate?: Date;
    madeDate?: Date;
    shippedDate?: Date;
  } = { status };

  if (status === "APPROVED") {
    data.approvedDate = now;
  } else if (status === "IN_PRODUCTION") {
    data.productionDate = now;
  } else if (status === "MADE") {
    data.madeDate = now;
  } else if (status === "SHIPPED") {
    data.shippedDate = now;
  }

  await client.jobStructure.update({
    where: { id: jobStructureId },
    data,
  });
}

export async function approveJobStructureForProduction(
  client: PrismaClient,
  jobStructureId: string,
): Promise<void> {
  await setJobStructureStatus(client, jobStructureId, "APPROVED");
}

export async function startJobStructureProduction(
  client: PrismaClient,
  jobStructureId: string,
): Promise<void> {
  await setJobStructureStatus(client, jobStructureId, "IN_PRODUCTION");
}

export async function markJobStructureMade(
  client: PrismaClient,
  jobStructureId: string,
): Promise<void> {
  await setJobStructureStatus(client, jobStructureId, "MADE");
}

export async function markJobStructureShipped(
  client: PrismaClient,
  jobStructureId: string,
): Promise<void> {
  await setJobStructureStatus(client, jobStructureId, "SHIPPED");
}
