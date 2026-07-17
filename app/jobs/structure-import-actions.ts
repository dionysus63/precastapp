"use server";

import { revalidatePath } from "next/cache";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { createJobStructureFromQuoteConfig } from "@/lib/drill-sheet-persistence";
import { createRectJobStructureFromQuoteConfig } from "@/lib/rect-sheet-persistence";
import {
  loadDrillSheetFormOptions,
  loadRectSheetFormOptions,
} from "@/lib/drill-sheet-options";
import { prisma } from "@/lib/prisma";
import { parseStructureConfigJson } from "@/lib/quotes/structure-workbook";
import { parseRectStructureConfigJson } from "@/lib/quotes/rect-structure-workbook";

/** Template/casting/catalog data the job-level import dialog parses against. */
export async function loadJobStructureImportOptions() {
  await requirePermission(AppPermission.STRUCTURES_VIEW);
  const [circular, rect] = await Promise.all([
    loadDrillSheetFormOptions(),
    loadRectSheetFormOptions(),
  ]);
  return {
    circular: {
      templates: circular.templateOptions,
      castings: circular.castingOptions,
      pipeOpeningSizes: circular.pipeOpeningSizes,
      diameterConfigs: circular.diameterConfigs,
    },
    rect: {
      templates: rect.templateOptions,
      castings: rect.castingOptions,
      openingSizes: rect.openingSizes,
    },
  };
}

export type JobStructureImportEntry = {
  structureNumber: string;
  shape: "CIRCULAR" | "RECTANGULAR";
  /** Full-detail workbook config (reparsed and regated server-side). */
  config: unknown;
};

export type JobStructureImportResult = {
  created: number;
  errors: string[];
};

/**
 * Detailing flow: bulk-create real drill sheets straight on a job, no quote
 * involved. Each entry carries a full-detail workbook config; quote-only
 * rows never reach this action (the dialog filters them with a message).
 * When the job is quoted later, quote-won linking adopts these structures
 * by item code instead of duplicating them.
 */
export async function importJobStructuresFromConfigs(
  jobId: string,
  entries: JobStructureImportEntry[],
): Promise<JobStructureImportResult> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, customerName: true, projectName: true },
  });
  if (!job) {
    throw new Error("Job was not found.");
  }

  const errors: string[] = [];
  let created = 0;

  for (const entry of entries) {
    const structureNumber = entry.structureNumber.trim();
    const label = structureNumber || "Structure";

    if (!structureNumber) {
      errors.push("A structure without a number was skipped.");
      continue;
    }

    const existing = await prisma.jobStructure.findFirst({
      where: {
        jobId,
        structureNumber: { equals: structureNumber, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existing) {
      errors.push(`${label}: a structure with this number already exists on the job.`);
      continue;
    }

    try {
      if (entry.shape === "RECTANGULAR") {
        // Never trust the client-shaped config — reparse and regate.
        const config = parseRectStructureConfigJson(entry.config);
        if (
          !config ||
          config.detailLevel !== "FULL" ||
          config.openings.length === 0
        ) {
          errors.push(`${label}: missing full drill-sheet detail.`);
          continue;
        }
        await createRectJobStructureFromQuoteConfig(config, {
          jobId,
          structureNumber,
          quantity: 1,
          contractorName: job.customerName,
          projectName: job.projectName,
        });
      } else {
        const config = parseStructureConfigJson(entry.config);
        if (
          !config ||
          config.detailLevel !== "DRILL_SHEET" ||
          !config.openings?.length
        ) {
          errors.push(`${label}: missing full drill-sheet detail.`);
          continue;
        }
        await createJobStructureFromQuoteConfig(config, {
          jobId,
          structureNumber,
          quantity: 1,
          contractorName: job.customerName,
          projectName: job.projectName,
        });
      }
      created += 1;
    } catch (error) {
      errors.push(
        `${label}: ${error instanceof Error ? error.message : "could not create the drill sheet."}`,
      );
    }
  }

  if (created > 0) {
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/drill-sheets");
    revalidatePath("/production");
  }

  return { created, errors };
}
