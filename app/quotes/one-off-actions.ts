"use server";

import { revalidatePath } from "next/cache";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { createJobStructureFromQuoteConfig } from "@/lib/drill-sheet-persistence";
import { createJobFolders, createJobRecord } from "@/lib/job-create";
import { prisma, withDatabaseRetry } from "@/lib/prisma";
import { parseRectStructureConfigJson } from "@/lib/quotes/rect-structure-workbook";
import { parseStructureConfigJson } from "@/lib/quotes/structure-workbook";
import { findDuplicateStructureNumbers } from "@/lib/quotes/one-off-drill-sheets";
import { createRectJobStructureFromQuoteConfig } from "@/lib/rect-sheet-persistence";
import { returnActionError } from "@/lib/server/action-errors";

export type OneOffJobOption = { id: string; label: string };

export type OneOffCustomerOption = { id: string; name: string };

export type OneOffJobDetails = {
  id: string;
  jobNumber: string;
  customerName: string;
  projectName: string;
  projectAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  /** Structure numbers already on the job, so new ones don't collide. */
  structureNumbers: string[];
  /** Saved drill sheets on the job, which the One-Off page can edit. */
  sheetCount: number;
};

export type OneOffNewJobInput = {
  customerId: string | null;
  customerName: string;
  projectName: string;
  projectAddress: string;
  city: string;
  state: string;
  zip: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
};

export type OneOffCreateInput = {
  job: { mode: "existing"; jobId: string } | ({ mode: "new" } & OneOffNewJobInput);
  sheets: {
    shape: "CIRCULAR" | "RECTANGULAR";
    structureNumber: string;
    config: unknown;
  }[];
};

export type OneOffCreatedSheet = {
  id: string;
  shape: "CIRCULAR" | "RECTANGULAR";
  structureNumber: string;
  templateName: string;
  wallHeightFeet: number | null;
};

export type OneOffCreateResult = {
  jobId: string;
  jobNumber: string;
  projectName: string;
  jobCreated: boolean;
  /** False when a new job's folders couldn't be made on the file share. */
  folderCreated: boolean;
  sheets: OneOffCreatedSheet[];
  errors: string[];
};

export async function searchJobsForOneOff(
  query: string,
): Promise<OneOffJobOption[]> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);

  const trimmed = query.trim();
  const jobs = await withDatabaseRetry((client) =>
    client.job.findMany({
      where: trimmed
        ? {
            OR: [
              { jobNumber: { contains: trimmed, mode: "insensitive" } },
              { projectName: { contains: trimmed, mode: "insensitive" } },
              { customerName: { contains: trimmed, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: [{ year: "desc" }, { sequenceNumber: "desc" }],
      take: 20,
      select: { id: true, jobNumber: true, projectName: true, customerName: true },
    }),
  );

  return jobs.map((job) => ({
    id: job.id,
    label: `${job.jobNumber} — ${job.projectName} (${job.customerName})`,
  }));
}

export async function searchCustomersForOneOff(
  query: string,
): Promise<OneOffCustomerOption[]> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);

  const trimmed = query.trim();
  return withDatabaseRetry((client) =>
    client.customer.findMany({
      where: {
        status: { not: "INACTIVE" },
        ...(trimmed
          ? { name: { contains: trimmed, mode: "insensitive" as const } }
          : {}),
      },
      orderBy: { name: "asc" },
      take: 20,
      select: { id: true, name: true },
    }),
  );
}

export async function getJobForOneOff(jobId: string) {
  return returnActionError(async (): Promise<OneOffJobDetails> => {
    await requirePermission(AppPermission.STRUCTURES_MANAGE);

    const job = await withDatabaseRetry((client) =>
      client.job.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          jobNumber: true,
          customerName: true,
          projectName: true,
          projectAddress: true,
          city: true,
          state: true,
          zip: true,
          contactName: true,
          contactPhone: true,
          contactEmail: true,
          jobStructures: {
            select: { structureNumber: true, calc: { select: { id: true } } },
          },
        },
      }),
    );
    if (!job) {
      throw new Error("That job was not found. It may have been deleted.");
    }

    const { jobStructures, ...details } = job;
    return {
      ...details,
      structureNumbers: jobStructures
        .map((structure) => structure.structureNumber ?? "")
        .filter(Boolean),
      sheetCount: jobStructures.filter((structure) => structure.calc != null)
        .length,
    };
  });
}

function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Creates the One-Off tab's drill sheets: picks or creates the job, then one
 * drill sheet (JobStructure, qty 1) per grid row. Every row is validated
 * before anything is written, so a bad row never leaves a half-made job.
 */
export async function createOneOffDrillSheets(input: OneOffCreateInput) {
  return returnActionError(() => createOneOffDrillSheetsOrThrow(input));
}

async function createOneOffDrillSheetsOrThrow(
  input: OneOffCreateInput,
): Promise<OneOffCreateResult> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  if (input.job.mode === "new") {
    await requirePermission(AppPermission.JOBS_MANAGE);
  }

  if (!Array.isArray(input.sheets) || input.sheets.length === 0) {
    throw new Error("Add at least one structure before creating drill sheets.");
  }

  // Never trust the client-shaped configs: reparse and regate every row.
  const problems: string[] = [];
  const prepared = input.sheets.map((sheet, index) => {
    const structureNumber = String(sheet.structureNumber ?? "").trim();
    const label = structureNumber || `Row ${index + 1}`;
    if (!structureNumber) {
      problems.push(`${label}: enter a structure number.`);
    }
    if (sheet.shape === "RECTANGULAR") {
      const config = parseRectStructureConfigJson(sheet.config);
      if (!config || config.detailLevel !== "FULL" || config.openings.length === 0) {
        problems.push(`${label}: the rectangular sheet isn't complete.`);
      }
      return { shape: sheet.shape, structureNumber, rect: config, circular: null };
    }
    const config = parseStructureConfigJson(sheet.config);
    if (!config || config.detailLevel !== "DRILL_SHEET" || !config.openings?.length) {
      problems.push(`${label}: the circular sheet isn't complete.`);
    }
    return { shape: "CIRCULAR" as const, structureNumber, rect: null, circular: config };
  });

  const duplicates = findDuplicateStructureNumbers(
    prepared.map((sheet) => sheet.structureNumber),
  );
  if (duplicates.length > 0) {
    problems.push(`Structure numbers used twice: ${duplicates.join(", ")}.`);
  }

  let existingJob: {
    id: string;
    jobNumber: string;
    projectName: string;
    customerName: string;
  } | null = null;
  if (input.job.mode === "existing") {
    existingJob = await prisma.job.findUnique({
      where: { id: input.job.jobId },
      select: {
        id: true,
        jobNumber: true,
        projectName: true,
        customerName: true,
        jobStructures: {
          where: { structureNumber: { not: null } },
          select: { structureNumber: true },
        },
      },
    }).then((job) => {
      if (!job) {
        return null;
      }
      const taken = new Set(
        job.jobStructures.map((s) => (s.structureNumber ?? "").trim().toLowerCase()),
      );
      const clashes = prepared
        .map((sheet) => sheet.structureNumber)
        .filter((number) => number && taken.has(number.toLowerCase()));
      if (clashes.length > 0) {
        problems.push(
          `Already on job ${job.jobNumber}: ${clashes.join(", ")}. Renumber those rows.`,
        );
      }
      return job;
    });
    if (!existingJob) {
      throw new Error("That job was not found. It may have been deleted.");
    }
  } else if (!input.job.projectName.trim()) {
    problems.push("Enter a project name for the new job.");
  } else if (!input.job.customerId && !input.job.customerName.trim()) {
    problems.push("Pick or type a contractor for the new job.");
  }

  if (problems.length > 0) {
    throw new Error(problems.join(" "));
  }

  let job = existingJob;
  let folderCreated = true;
  if (input.job.mode === "new") {
    const created = await createJobRecord({
      year: new Date().getFullYear(),
      customerId: input.job.customerId,
      customerName: input.job.customerName.trim(),
      projectName: input.job.projectName.trim(),
      projectAddress: optional(input.job.projectAddress),
      city: optional(input.job.city),
      state: optional(input.job.state),
      zip: optional(input.job.zip),
      // Drill sheets mean the work is ours: start the job as awarded.
      status: "AWARDED",
      bidDate: null,
      awardedDate: new Date(),
      contactName: optional(input.job.contactName),
      contactEmail: optional(input.job.contactEmail),
      contactPhone: optional(input.job.contactPhone),
      notes: null,
    });
    folderCreated = await createJobFolders(created);
    job = created;
  }
  if (!job) {
    throw new Error("Could not find or create the job.");
  }

  const sheets: OneOffCreatedSheet[] = [];
  const errors: string[] = [];
  for (const sheet of prepared) {
    const options = {
      jobId: job.id,
      structureNumber: sheet.structureNumber,
      quantity: 1,
      contractorName: job.customerName,
      projectName: job.projectName,
    };
    try {
      if (sheet.rect) {
        const id = await createRectJobStructureFromQuoteConfig(sheet.rect, options);
        sheets.push({
          id,
          shape: "RECTANGULAR",
          structureNumber: sheet.structureNumber,
          templateName: sheet.rect.templateName ?? "Rectangular",
          wallHeightFeet: sheet.rect.wallHeightFeet ?? null,
        });
      } else if (sheet.circular) {
        const id = await createJobStructureFromQuoteConfig(sheet.circular, options);
        sheets.push({
          id,
          shape: "CIRCULAR",
          structureNumber: sheet.structureNumber,
          templateName: sheet.circular.templateName ?? "Circular",
          wallHeightFeet: sheet.circular.wallHeightFeet ?? null,
        });
      }
    } catch (error) {
      errors.push(
        `${sheet.structureNumber}: ${error instanceof Error ? error.message : "could not create the drill sheet."}`,
      );
    }
  }

  revalidatePath("/drill-sheets");
  revalidatePath("/production");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${job.id}`);

  return {
    jobId: job.id,
    jobNumber: job.jobNumber,
    projectName: job.projectName,
    jobCreated: input.job.mode === "new",
    folderCreated,
    sheets,
    errors,
  };
}
