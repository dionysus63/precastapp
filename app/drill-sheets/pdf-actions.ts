"use server";

import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import {
  buildDrillSheetDetail,
  drillSheetDetailInclude,
} from "@/lib/drill-sheet-detail";
import { buildDrillSheetPdfBytes } from "@/lib/drill-sheet-pdf-generate";
import { rectSheetDetailInclude } from "@/lib/rect-sheet-detail";
import { buildRectSheetPdfBytes } from "@/lib/rect-sheet-pdf-generate";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import {
  DRILL_SHEET_PDF_JOB_SUBFOLDER,
  buildDrillSheetPdfBaseName,
  resolveDrillSheetPdfDirectory,
  resolveDrillSheetPdfOutputPath,
} from "@/lib/drill-sheet-pdf-path";
import { buildJobDrillSheetsPdfBytes } from "@/lib/job-drill-sheets-pdf";
import { registerJobFile } from "@/lib/job-files-service";
import { launchWindowsFile } from "@/lib/windows-explorer";
import { getJobsRoot } from "@/lib/app-settings";
import { assertPathUnderJobsRoot } from "@/lib/job-path-security";
import { withDatabaseRetry } from "@/lib/prisma";

export type GenerateDrillSheetPdfResult =
  | { success: true; filePath: string; launched: boolean }
  | { success: false; error: string };

export type GenerateJobDrillSheetsPdfResult =
  | {
      success: true;
      filePath: string;
      launched: boolean;
      included: number;
      skipped: string[];
    }
  | { success: false; error: string };

/**
 * Saves one combined PDF with every drill sheet on the job into the job
 * folder's cut-sheets subfolder (fallback directory when the job has no
 * folder), registering it with the job's files.
 */
export async function generateJobDrillSheetsPdf(
  jobId: string,
): Promise<GenerateJobDrillSheetsPdfResult> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  if (!jobId.trim()) {
    return { success: false, error: "Job id is required." };
  }

  try {
    const built = await buildJobDrillSheetsPdfBytes(jobId);
    if (!built.ok) {
      return { success: false, error: built.error };
    }

    const baseName = buildDrillSheetPdfBaseName(
      "Drill Sheets",
      built.jobNumber,
    );
    const outputDirectory = resolveDrillSheetPdfDirectory(built.jobFolderPath);
    const outputPath = await resolveDrillSheetPdfOutputPath(
      outputDirectory,
      baseName,
    );

    if (built.jobFolderPath) {
      assertPathUnderJobsRoot(await getJobsRoot(), outputPath);
    }

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, built.bytes);

    if (built.jobFolderPath) {
      await withDatabaseRetry((client) =>
        registerJobFile(client, jobId, outputPath, DRILL_SHEET_PDF_JOB_SUBFOLDER),
      );
    }

    let launched = false;
    let clientOpenPath = outputPath;
    try {
      const launch = await launchWindowsFile(outputPath);
      launched = launch.launched;
      clientOpenPath = launch.clientOpenPath;
    } catch {
      // Ignore: the PDF was saved and its path is returned to the caller.
    }

    return {
      success: true,
      filePath: clientOpenPath,
      launched,
      included: built.included.length,
      skipped: built.skipped.map(
        (entry) => `${entry.structureNumber} (${entry.reason})`,
      ),
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate the combined drill sheet PDF.";
    return { success: false, error: message };
  }
}

export async function generateDrillSheetPdf(
  drillSheetId: string,
): Promise<GenerateDrillSheetPdfResult> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  if (!drillSheetId.trim()) {
    return { success: false, error: "Drill sheet id is required." };
  }

  try {
    const shapeRow = await withDatabaseRetry((prisma) =>
      prisma.jobStructure.findUnique({
        where: { id: drillSheetId },
        select: { structureTemplate: { select: { shape: true } } },
      }),
    );
    if (!shapeRow) {
      return { success: false, error: "Drill sheet not found." };
    }
    if (shapeRow.structureTemplate?.shape === "RECTANGULAR") {
      return generateRectSheetPdf(drillSheetId);
    }

    const sheet = await withDatabaseRetry((prisma) =>
      prisma.jobStructure.findUnique({
        where: { id: drillSheetId },
        include: drillSheetDetailInclude,
      }),
    );

    if (!sheet) {
      return { success: false, error: "Drill sheet not found." };
    }

    const detail = buildDrillSheetDetail(sheet);
    if (!detail) {
      return {
        success: false,
        error: "This structure is not a circular drill sheet.",
      };
    }

    let jobFolderPath: string | null = null;
    if (sheet.jobId) {
      const job = await withDatabaseRetry((prisma) =>
        prisma.job.findUnique({
          where: { id: sheet.jobId! },
          select: { folderPath: true },
        }),
      );
      jobFolderPath = job?.folderPath ?? null;
    }

    const built = await buildDrillSheetPdfBytes(sheet);
    if (!built) {
      return {
        success: false,
        error: "This structure is not a circular drill sheet.",
      };
    }

    const baseName = buildDrillSheetPdfBaseName(
      detail.meta.manholeNumber,
      detail.meta.project,
    );
    const outputDirectory = resolveDrillSheetPdfDirectory(jobFolderPath);
    const outputPath = await resolveDrillSheetPdfOutputPath(
      outputDirectory,
      baseName,
    );

    if (jobFolderPath) {
      assertPathUnderJobsRoot(await getJobsRoot(), outputPath);
    }

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, built.bytes);

    if (sheet.jobId && jobFolderPath) {
      await withDatabaseRetry((client) =>
        registerJobFile(
          client,
          sheet.jobId!,
          outputPath,
          DRILL_SHEET_PDF_JOB_SUBFOLDER,
        ),
      );
    }

    let launched = false;
    let clientOpenPath = outputPath;
    try {
      const launch = await launchWindowsFile(outputPath);
      launched = launch.launched;
      clientOpenPath = launch.clientOpenPath;
    } catch {
      // Ignore: the PDF was saved and its path is returned to the caller.
    }

    return { success: true, filePath: clientOpenPath, launched };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate drill sheet PDF.";
    return { success: false, error: message };
  }
}

async function generateRectSheetPdf(
  jobStructureId: string,
): Promise<GenerateDrillSheetPdfResult> {
  const sheet = await withDatabaseRetry((prisma) =>
    prisma.jobStructure.findUnique({
      where: { id: jobStructureId },
      include: rectSheetDetailInclude,
    }),
  );
  if (!sheet) {
    return { success: false, error: "Sheet not found." };
  }

  let jobFolderPath: string | null = null;
  if (sheet.jobId) {
    const job = await withDatabaseRetry((prisma) =>
      prisma.job.findUnique({
        where: { id: sheet.jobId! },
        select: { folderPath: true },
      }),
    );
    jobFolderPath = job?.folderPath ?? null;
  }

  const built = await buildRectSheetPdfBytes(sheet);
  if (!built.ok) {
    return { success: false, error: built.error };
  }

  const baseName = buildDrillSheetPdfBaseName(
    built.meta.structureNumber,
    built.meta.project,
  );
  const outputDirectory = resolveDrillSheetPdfDirectory(jobFolderPath);
  const outputPath = await resolveDrillSheetPdfOutputPath(
    outputDirectory,
    baseName,
  );

  if (jobFolderPath) {
    assertPathUnderJobsRoot(await getJobsRoot(), outputPath);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, built.bytes);

  if (sheet.jobId && jobFolderPath) {
    await withDatabaseRetry((client) =>
      registerJobFile(
        client,
        sheet.jobId!,
        outputPath,
        DRILL_SHEET_PDF_JOB_SUBFOLDER,
      ),
    );
  }

  let launched = false;
  let clientOpenPath = outputPath;
  try {
    const launch = await launchWindowsFile(outputPath);
    launched = launch.launched;
    clientOpenPath = launch.clientOpenPath;
  } catch {
    // Ignore: the PDF was saved and its path is returned to the caller.
  }

  return { success: true, filePath: clientOpenPath, launched };
}
