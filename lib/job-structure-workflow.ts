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

type StructureLinkClient = Pick<
  PrismaClient,
  "quote" | "jobStructure" | "quoteLineItem"
>;

/**
 * When a quote is WON, create JobStructure rows for configurable/custom lines
 * and link them on QuoteLineItem.jobStructureId.
 */
export async function linkJobStructuresFromQuoteInTransaction(
  client: StructureLinkClient,
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

export async function linkJobStructuresFromQuote(
  client: PrismaClient,
  quoteId: string,
): Promise<number> {
  return linkJobStructuresFromQuoteInTransaction(client, quoteId);
}

export async function setJobStructureStatus(
  client: PrismaClient,
  jobStructureId: string,
  status: StructureStatus,
): Promise<void> {
  const now = new Date();
  const data: {
    status: StructureStatus;
    submittedDate?: Date;
    approvedDate?: Date;
    productionDate?: Date;
    madeDate?: Date;
    shippedDate?: Date;
  } = { status };

  if (status === "SUBMITTED") {
    data.submittedDate = now;
  } else if (status === "APPROVED") {
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

export async function submitJobStructureForApproval(
  client: PrismaClient,
  jobStructureId: string,
): Promise<void> {
  const structure = await client.jobStructure.findUnique({
    where: { id: jobStructureId },
    select: { status: true, needsSubmittal: true },
  });

  if (!structure) {
    throw new Error("Structure was not found.");
  }

  if (structure.status !== "NOT_SUBMITTED") {
    throw new Error("Only not-submitted structures can be marked as submitted.");
  }

  if (structure.needsSubmittal) {
    const { countJobSpecificSubmittals } = await import(
      "@/lib/job-structure-documents-service"
    );
    const submittalCount = await countJobSpecificSubmittals(
      client,
      jobStructureId,
    );
    if (submittalCount === 0) {
      throw new Error(
        "Upload at least one job-specific submittal before marking as submitted.",
      );
    }
  }

  await setJobStructureStatus(client, jobStructureId, "SUBMITTED");
}

export async function approveJobStructureForProduction(
  client: PrismaClient,
  jobStructureId: string,
): Promise<void> {
  const structure = await client.jobStructure.findUnique({
    where: { id: jobStructureId },
    select: { status: true, needsSubmittal: true },
  });

  if (!structure) {
    throw new Error("Structure was not found.");
  }

  if (structure.needsSubmittal && structure.status !== "SUBMITTED") {
    throw new Error(
      "Structure must be submitted before it can be approved for production.",
    );
  }

  if (
    !structure.needsSubmittal &&
    structure.status !== "SUBMITTED" &&
    structure.status !== "NOT_SUBMITTED"
  ) {
    throw new Error("Structure cannot be approved from its current status.");
  }

  if (structure.needsSubmittal) {
    const { countJobSpecificSubmittals } = await import(
      "@/lib/job-structure-documents-service"
    );
    const submittalCount = await countJobSpecificSubmittals(
      client,
      jobStructureId,
    );
    if (submittalCount === 0) {
      throw new Error(
        "Upload at least one job-specific submittal before approving for production.",
      );
    }
  }

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
