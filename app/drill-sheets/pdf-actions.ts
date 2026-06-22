"use server";

import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import {
  buildDrillSheetDetail,
  drillSheetDetailInclude,
} from "@/lib/drill-sheet-detail";
import { buildDrillSheetPdfHtml } from "@/lib/drill-sheet-pdf-html";
import {
  DRILL_SHEET_PDF_JOB_SUBFOLDER,
  buildDrillSheetPdfBaseName,
  resolveDrillSheetPdfDirectory,
  resolveDrillSheetPdfOutputPath,
} from "@/lib/drill-sheet-pdf-path";
import { writeQuotePdfFromHtml } from "@/lib/quote-pdf";
import { registerJobFile } from "@/lib/job-files-service";
import { launchWindowsFile } from "@/lib/windows-explorer";
import { withDatabaseRetry } from "@/lib/prisma";

export type GenerateDrillSheetPdfResult =
  | { success: true; filePath: string }
  | { success: false; error: string };

export async function generateDrillSheetPdf(
  drillSheetId: string,
): Promise<GenerateDrillSheetPdfResult> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  if (!drillSheetId.trim()) {
    return { success: false, error: "Drill sheet id is required." };
  }

  try {
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

    const html = await buildDrillSheetPdfHtml(detail.meta, detail.result);
    const baseName = buildDrillSheetPdfBaseName(
      detail.meta.manholeNumber,
      detail.meta.project,
    );
    const outputDirectory = resolveDrillSheetPdfDirectory(jobFolderPath);
    const outputPath = await resolveDrillSheetPdfOutputPath(
      outputDirectory,
      baseName,
    );

    await writeQuotePdfFromHtml(html, outputPath);

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

    // Reveal the saved PDF in Explorer. The file is already written, so a
    // launch failure (e.g. non-Windows host) should not fail generation.
    try {
      await launchWindowsFile(outputPath);
    } catch {
      // Ignore: the PDF was saved and its path is returned to the caller.
    }

    return { success: true, filePath: outputPath };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate drill sheet PDF.";
    return { success: false, error: message };
  }
}
