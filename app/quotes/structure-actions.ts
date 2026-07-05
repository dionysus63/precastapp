"use server";

import { revalidatePath } from "next/cache";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { createJobStructureFromQuoteConfig } from "@/lib/drill-sheet-persistence";
import { prisma } from "@/lib/prisma";
import { parseStructureConfigJson } from "@/lib/quotes/structure-workbook";

export async function createDrillSheetsFromQuote(quoteId: string) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      lineItems: {
        where: { lineType: "CONFIGURABLE_STRUCTURE" },
        orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }],
        include: {
          jobStructure: {
            select: { id: true, structureTemplateId: true },
          },
        },
      },
    },
  });

  if (!quote) {
    throw new Error("Quote not found.");
  }

  let created = 0;

  for (const line of quote.lineItems) {
    // Already a real drill sheet — nothing to do.
    if (line.jobStructure?.structureTemplateId) {
      continue;
    }

    const config = parseStructureConfigJson(line.structureConfigJson);
    if (!config || config.detailLevel !== "DRILL_SHEET") {
      continue;
    }

    // Won-quote linking may have created a placeholder structure for this
    // line; upgrade it in place so status, documents, and delivery links
    // are preserved instead of creating a duplicate.
    const jobStructureId = await createJobStructureFromQuoteConfig(config, {
      quoteId: quote.id,
      jobId: quote.jobId,
      structureNumber: line.itemCode,
      quantity: Number(line.quantity),
      contractorName: quote.customerName,
      projectName: quote.projectName,
      upgradeJobStructureId: line.jobStructure?.id ?? null,
    });

    if (!line.jobStructureId) {
      await prisma.quoteLineItem.update({
        where: { id: line.id },
        data: { jobStructureId },
      });
    }

    created += 1;
  }

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath(`/quotes/${quoteId}/edit`);
  revalidatePath("/drill-sheets");
  if (quote.jobId) {
    revalidatePath(`/jobs/${quote.jobId}`);
  }

  return { created };
}
