"use server";

import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { QUOTE_PDF_INCLUDE } from "@/lib/quote-pdf-data";
import { buildAndPersistQuotePdf } from "@/lib/quote-pdf-persist";
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
        include: QUOTE_PDF_INCLUDE,
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

    const persisted = await withDatabaseRetry((client) =>
      buildAndPersistQuotePdf(quote, jobFolderPath, client),
    );

    return { success: true, filePath: persisted.outputPath };
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
