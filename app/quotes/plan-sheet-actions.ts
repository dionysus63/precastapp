"use server";

import { access, mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import {
  AppPermission,
  PlanSheetSourceType,
  Prisma,
} from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import {
  assertJobFolderPath,
  listJobFiles,
  registerJobFile,
  uploadJobFile,
} from "@/lib/job-files-service";
import { assertPathUnderJobFolder } from "@/lib/job-path-security";
import {
  buildPlanSheetBaseName,
  resolvePlanSheetDirectory,
  resolvePlanSheetOutputPath,
} from "@/lib/plan-sheet-path";
import {
  parsePlanSheetMarkup,
  type PlanSheetMarkup,
} from "@/lib/quotes/plan-sheet-markup";
import {
  assertUploadAllowed,
} from "@/lib/upload-validation";
import { sanitizeFileName } from "@/lib/file-upload-utils";
import { withDatabaseRetry } from "@/lib/prisma";

const CONSTRUCTION_PLANS = "01 Construction Plans";

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export type PlanSheetRecord = {
  id: string;
  quoteId: string | null;
  jobId: string | null;
  sourceType: PlanSheetSourceType;
  filePath: string;
  originalName: string;
  pageNumber: number;
  markup: PlanSheetMarkup;
};

function mapPlanSheetRow(row: {
  id: string;
  quoteId: string | null;
  jobId: string | null;
  sourceType: PlanSheetSourceType;
  filePath: string;
  originalName: string;
  pageNumber: number;
  markupJson: unknown;
}): PlanSheetRecord {
  return {
    id: row.id,
    quoteId: row.quoteId,
    jobId: row.jobId,
    sourceType: row.sourceType,
    filePath: row.filePath,
    originalName: row.originalName,
    pageNumber: row.pageNumber,
    markup: parsePlanSheetMarkup(row.markupJson),
  };
}

export async function getPlanSheetForQuote(
  quoteId: string,
): Promise<PlanSheetRecord | null> {
  await requirePermission(AppPermission.QUOTES_MANAGE);
  const row = await withDatabaseRetry((client) =>
    client.planSheet.findFirst({
      where: { quoteId },
      orderBy: { updatedAt: "desc" },
    }),
  );
  return row ? mapPlanSheetRow(row) : null;
}

export async function listJobConstructionPlanPdfs(jobId: string) {
  await requirePermission(AppPermission.QUOTES_MANAGE);
  const files = await withDatabaseRetry((client) =>
    listJobFiles(client, jobId, CONSTRUCTION_PLANS),
  );
  return files
    .filter((file) => file.fileName.toLowerCase().endsWith(".pdf"))
    .map((file) => ({
      id: file.id,
      fileName: file.fileName,
      filePath: file.filePath,
    }));
}

async function saveUploadedPlanPdf(
  file: File,
  jobId: string | null,
): Promise<{ filePath: string; originalName: string; jobId: string | null }> {
  assertUploadAllowed(file, {
    allowedExtensions: [".pdf"],
  });

  if (jobId) {
    const jobFile = await withDatabaseRetry((client) =>
      uploadJobFile(client, jobId, CONSTRUCTION_PLANS, file),
    );
    return {
      filePath: jobFile.filePath,
      originalName: jobFile.fileName,
      jobId,
    };
  }

  const outputDirectory = resolvePlanSheetDirectory(null);
  await mkdir(outputDirectory, { recursive: true });

  const safeName = sanitizeFileName(file.name);
  const baseName = buildPlanSheetBaseName(safeName);
  const outputPath = await resolvePlanSheetOutputPath(
    outputDirectory,
    `${baseName}.pdf`,
  );
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(outputPath, buffer);

  return {
    filePath: outputPath,
    originalName: path.basename(outputPath),
    jobId: null,
  };
}

export async function uploadPlanSheet(formData: FormData) {
  await requirePermission(AppPermission.QUOTES_MANAGE);

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("Choose a PDF plan sheet to upload.");
  }

  const quoteId = String(formData.get("quoteId") ?? "").trim() || null;
  const jobId = String(formData.get("jobId") ?? "").trim() || null;

  const saved = await saveUploadedPlanPdf(file, jobId);

  const planSheet = await withDatabaseRetry((client) =>
    client.planSheet.create({
      data: {
        quoteId,
        jobId: saved.jobId,
        sourceType: PlanSheetSourceType.UPLOAD,
        filePath: saved.filePath,
        originalName: saved.originalName,
        markupJson: Prisma.JsonNull,
      },
    }),
  );

  if (quoteId) {
    revalidatePath(`/quotes/${quoteId}/edit/structures`);
  }

  return mapPlanSheetRow(planSheet);
}

export async function selectJobPlanSheet(
  jobId: string,
  filePath: string,
  quoteId?: string | null,
) {
  await requirePermission(AppPermission.QUOTES_MANAGE);

  const job = await withDatabaseRetry((client) =>
    assertJobFolderPath(client, jobId),
  );
  assertPathUnderJobFolder(job.folderPath, filePath);

  if (!(await pathExists(filePath))) {
    throw new Error("Plan file was not found on disk.");
  }

  if (!filePath.toLowerCase().endsWith(".pdf")) {
    throw new Error("Plan takeoff requires a PDF file.");
  }

  await withDatabaseRetry((client) =>
    registerJobFile(
      client,
      jobId,
      filePath,
      CONSTRUCTION_PLANS,
      path.basename(filePath),
    ),
  );

  const planSheet = await withDatabaseRetry((client) =>
    client.planSheet.create({
      data: {
        quoteId: quoteId ?? null,
        jobId,
        sourceType: PlanSheetSourceType.JOB_FILE,
        filePath,
        originalName: path.basename(filePath),
        markupJson: Prisma.JsonNull,
      },
    }),
  );

  if (quoteId) {
    revalidatePath(`/quotes/${quoteId}/edit/structures`);
  }

  return mapPlanSheetRow(planSheet);
}

export async function savePlanSheetMarkup(
  planSheetId: string,
  markup: PlanSheetMarkup,
) {
  await requirePermission(AppPermission.QUOTES_MANAGE);

  const updated = await withDatabaseRetry((client) =>
    client.planSheet.update({
      where: { id: planSheetId },
      data: {
        markupJson: markup as unknown as Prisma.InputJsonValue,
      },
    }),
  );

  return mapPlanSheetRow(updated);
}

export async function linkPlanSheetToQuote(
  planSheetId: string | null | undefined,
  quoteId: string,
  jobId: string | null,
) {
  if (!planSheetId?.trim()) {
    return;
  }

  await requirePermission(AppPermission.QUOTES_MANAGE);

  await withDatabaseRetry(async (client) => {
    const planSheet = await client.planSheet.findUnique({
      where: { id: planSheetId },
      select: { id: true },
    });
    if (!planSheet) {
      return;
    }

    await client.planSheet.update({
      where: { id: planSheetId },
      data: {
        quoteId,
        jobId: jobId ?? undefined,
      },
    });

    // Detach any older plan sheets for this quote so only one is active.
    await client.planSheet.updateMany({
      where: {
        quoteId,
        id: { not: planSheetId },
      },
      data: { quoteId: null },
    });
  });

  revalidatePath(`/quotes/${quoteId}/edit/structures`);
}

export async function getPlanSheetForOpen(planSheetId: string) {
  await requirePermission(AppPermission.QUOTES_MANAGE);

  const planSheet = await withDatabaseRetry((client) =>
    client.planSheet.findUnique({ where: { id: planSheetId } }),
  );

  if (!planSheet) {
    throw new Error("Plan sheet was not found.");
  }

  if (planSheet.jobId) {
    const job = await withDatabaseRetry((client) =>
      assertJobFolderPath(client, planSheet.jobId!),
    );
    assertPathUnderJobFolder(job.folderPath, planSheet.filePath);
  }

  if (!(await pathExists(planSheet.filePath))) {
    throw new Error(`Plan file not found on disk: ${planSheet.originalName}`);
  }

  return planSheet;
}
