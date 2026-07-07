"use server";

import { revalidatePath } from "next/cache";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { createJobStructureFromQuoteConfig } from "@/lib/drill-sheet-persistence";
import { createRectJobStructureFromQuoteConfig } from "@/lib/rect-sheet-persistence";
import { prisma } from "@/lib/prisma";
import { parseStructureConfigJson } from "@/lib/quotes/structure-workbook";
import { parseRectStructureConfigJson } from "@/lib/quotes/rect-structure-workbook";

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
    const rectConfig = config
      ? null
      : parseRectStructureConfigJson(line.structureConfigJson);
    if (
      (!config || config.detailLevel !== "DRILL_SHEET") &&
      (!rectConfig || rectConfig.detailLevel !== "FULL")
    ) {
      continue;
    }

    // Won-quote linking may have created a placeholder structure for this
    // line; upgrade it in place so status, documents, and delivery links
    // are preserved instead of creating a duplicate.
    const createOptions = {
      quoteId: quote.id,
      jobId: quote.jobId,
      structureNumber: line.itemCode,
      quantity: Number(line.quantity),
      contractorName: quote.customerName,
      projectName: quote.projectName,
      upgradeJobStructureId: line.jobStructure?.id ?? null,
    };
    const jobStructureId = rectConfig
      ? await createRectJobStructureFromQuoteConfig(rectConfig, createOptions)
      : await createJobStructureFromQuoteConfig(config!, createOptions);

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
