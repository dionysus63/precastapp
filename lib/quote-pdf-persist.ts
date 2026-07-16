import { writeFile } from "fs/promises";
import {
  buildQuotePdfBaseName,
  resolveQuotePdfDirectory,
  resolveQuotePdfOutputPath,
  sanitizeFilenamePart,
} from "@/lib/quote-pdf-path";
import { getJobsRoot, getQuotePdfJobSubfolder } from "@/lib/app-settings";
import { assertPathUnderJobsRoot } from "@/lib/job-path-security";
import type { DbQuoteForPdf } from "@/lib/quote-pdf-data";
import { generateQuotePdfBytes } from "@/lib/quote-pdf-fill";
import { registerJobFile } from "@/lib/job-files-service";
import type { PrismaClient } from "@/app/generated/prisma/client";

export type PersistedQuotePdf = {
  bytes: Uint8Array;
  outputPath: string;
  attachmentFilename: string;
};

export async function buildAndPersistQuotePdf(
  quote: DbQuoteForPdf,
  jobFolderPath: string | null,
  client: PrismaClient,
): Promise<PersistedQuotePdf> {
  const pdfBytes = await generateQuotePdfBytes(quote);
  const baseName = buildQuotePdfBaseName(
    quote.quoteNumber,
    quote.customerName,
    quote.projectName,
  );
  const outputDirectory = await resolveQuotePdfDirectory(jobFolderPath);
  const outputPath = await resolveQuotePdfOutputPath(outputDirectory, baseName);

  if (jobFolderPath) {
    assertPathUnderJobsRoot(await getJobsRoot(), outputPath);
  }

  await writeFile(outputPath, pdfBytes);

  if (quote.jobId && jobFolderPath) {
    const quoteSubfolder = await getQuotePdfJobSubfolder();
    await registerJobFile(client, quote.jobId, outputPath, quoteSubfolder);
  }

  return {
    bytes: pdfBytes,
    outputPath,
    attachmentFilename: await buildQuoteAttachmentFilename(
      quote,
      baseName,
      client,
    ),
  };
}

/**
 * The emailed attachment is named for the contractor: "{customer nickname
 * (or full name)} - {job name}.pdf". The copy saved in the job folder keeps
 * the quote-numbered base name so the folder stays sortable.
 */
export async function buildQuoteAttachmentFilename(
  quote: Pick<DbQuoteForPdf, "customerId" | "customerName" | "projectName">,
  fallbackBaseName: string,
  client: Pick<PrismaClient, "customer">,
): Promise<string> {
  let contractorName = quote.customerName;
  if (quote.customerId) {
    const customer = await client.customer.findUnique({
      where: { id: quote.customerId },
      select: { nickname: true },
    });
    contractorName = customer?.nickname?.trim() || contractorName;
  }

  const parts = [
    sanitizeFilenamePart(contractorName),
    sanitizeFilenamePart(quote.projectName),
  ].filter(Boolean);

  return `${parts.length > 0 ? parts.join(" - ") : fallbackBaseName}.pdf`;
}
