"use server";

import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { mapQuoteToDetailView } from "@/lib/quote-mapper";
import { buildQuotePdfHtml } from "@/lib/quote-pdf-html";
import {
  buildQuotePdfBaseName,
  resolveQuotePdfDirectory,
  resolveQuotePdfOutputPath,
} from "@/lib/quote-pdf-path";
import { getQuotePdfJobSubfolder } from "@/lib/app-settings";
import { writeQuotePdfFromHtml } from "@/lib/quote-pdf";
import { registerJobFile } from "@/lib/job-files-service";
import { generateSubmittalPackageForQuote } from "@/lib/submittal-package";
import { withDatabaseRetry } from "@/lib/prisma";

export type GenerateQuotePdfResult =
  | { success: true; filePath: string }
  | { success: false; error: string };

export async function generateQuotePdf(
  quoteId: string,
): Promise<GenerateQuotePdfResult> {
  await requirePermission(AppPermission.QUOTES_MANAGE);
  if (!quoteId.trim()) {
    return { success: false, error: "Quote id is required." };
  }

  try {
    const quote = await withDatabaseRetry((prisma) =>
      prisma.quote.findUnique({
        where: { id: quoteId },
        include: {
          lineItems: {
            orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }],
          },
        },
      }),
    );

    if (!quote) {
      return { success: false, error: "Quote not found." };
    }

    let jobFolderPath: string | null = null;
    if (quote.jobId) {
      const job = await withDatabaseRetry((prisma) =>
        prisma.job.findUnique({
          where: { id: quote.jobId! },
          select: { folderPath: true },
        }),
      );
      jobFolderPath = job?.folderPath ?? null;
    }

    const detail = mapQuoteToDetailView(quote);
    const html = await buildQuotePdfHtml(detail);
    const baseName = buildQuotePdfBaseName(
      quote.quoteNumber,
      quote.customerName,
      quote.projectName,
    );
    const outputDirectory = await resolveQuotePdfDirectory(jobFolderPath);
    const outputPath = await resolveQuotePdfOutputPath(outputDirectory, baseName);

    await writeQuotePdfFromHtml(html, outputPath);

    if (quote.jobId && jobFolderPath) {
      const quoteSubfolder = await getQuotePdfJobSubfolder();
      await withDatabaseRetry((client) =>
        registerJobFile(
          client,
          quote.jobId!,
          outputPath,
          quoteSubfolder,
        ),
      );
    }

    return { success: true, filePath: outputPath };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate quote PDF.";
    return { success: false, error: message };
  }
}

export type GenerateSubmittalPackageResult =
  | {
      success: true;
      filePath: string;
      missing: string[];
      skipped: string[];
      includedCount: number;
    }
  | { success: false; error: string };

export async function generateSubmittalPackage(
  quoteId: string,
): Promise<GenerateSubmittalPackageResult> {
  await requirePermission(AppPermission.QUOTES_MANAGE);
  if (!quoteId.trim()) {
    return { success: false, error: "Quote id is required." };
  }

  try {
    const result = await withDatabaseRetry((client) =>
      generateSubmittalPackageForQuote(client, quoteId),
    );

    return {
      success: true,
      filePath: result.filePath,
      missing: result.missing,
      skipped: result.skipped,
      includedCount: result.includedCount,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate submittal package.";
    return { success: false, error: message };
  }
}
