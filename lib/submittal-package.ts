import { readFile, unlink, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { PDFDocument } from "pdf-lib";
import type { PrismaClient } from "@/app/generated/prisma/client";
import {
  getJobsRoot,
  getQuotePdfFallbackDir,
  getStockSubmittalsRoot,
  getSubmittalsJobSubfolder,
} from "@/lib/app-settings";
import { assertPathUnderJobsRoot } from "@/lib/job-path-security";
import { assertPathUnderStockSubmittalsRoot } from "@/lib/product-path-security";
import { registerJobFile } from "@/lib/job-files-service";
import {
  buildSubmittalPackageBaseName,
  isSubmittalDocumentType,
  PRODUCT_SUBMITTAL_DOCUMENT_TYPES,
} from "@/lib/product-submittals-service";
import { resolveQuotePdfOutputPath } from "@/lib/quote-pdf-path";
import { writeQuotePdfFromHtml } from "@/lib/quote-pdf";
import {
  buildSubmittalCoverHtml,
  type SubmittalCoverProduct,
} from "@/lib/submittal-package-html";

type QuoteWithProducts = Awaited<
  ReturnType<typeof fetchQuoteForSubmittalPackage>
>;

export type SubmittalStatusQuote = {
  lineItems: Array<{
    product?: {
      id?: string;
      productCode: string;
      name: string;
      documents?: Array<{
        documentName: string;
        documentType: string;
        filePath: string;
      }>;
    } | null;
  }>;
};

function productDedupeKey(product: { id?: string; productCode: string }) {
  return product.id ?? product.productCode;
}

export async function fetchDeliveryTicketForSubmittalPackage(
  client: PrismaClient,
  ticketId: string,
) {
  return client.deliveryTicket.findUnique({
    where: { id: ticketId },
    include: {
      lineItems: {
        where: { productId: { not: null } },
        orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }],
        include: {
          product: {
            include: {
              documents: {
                where: {
                  documentType: { in: PRODUCT_SUBMITTAL_DOCUMENT_TYPES },
                },
                orderBy: { uploadedAt: "asc" },
              },
            },
          },
        },
      },
    },
  });
}

export async function fetchQuoteForSubmittalPackage(
  client: PrismaClient,
  quoteId: string,
) {
  return client.quote.findUnique({
    where: { id: quoteId },
    include: {
      lineItems: {
        where: { productId: { not: null } },
        orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }],
        include: {
          product: {
            include: {
              documents: {
                where: {
                  documentType: { in: PRODUCT_SUBMITTAL_DOCUMENT_TYPES },
                },
                orderBy: { uploadedAt: "asc" },
              },
            },
          },
        },
      },
    },
  });
}

export function collectSubmittalSources(quote: SubmittalStatusQuote) {
  const seen = new Set<string>();
  const products: SubmittalCoverProduct[] = [];
  const missing: string[] = [];
  const files: { productCode: string; documentName: string; filePath: string }[] =
    [];

  for (const line of quote.lineItems) {
    const product = line.product;
    if (!product) {
      continue;
    }

    const key = productDedupeKey(product);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const submittalDocs = (product.documents ?? []).filter((doc) =>
      isSubmittalDocumentType(doc.documentType),
    );

    if (submittalDocs.length === 0) {
      missing.push(product.productCode);
      continue;
    }

    products.push({
      productCode: product.productCode,
      productName: product.name,
      documentNames: submittalDocs.map((doc) => doc.documentName),
    });

    for (const doc of submittalDocs) {
      files.push({
        productCode: product.productCode,
        documentName: doc.documentName,
        filePath: doc.filePath,
      });
    }
  }

  return { products, missing, files };
}

export function formatSubmittalsStatus(quote: SubmittalStatusQuote) {
  const hasProductData = quote.lineItems.some((line) => line.product !== undefined);
  if (!hasProductData) {
    return "Not generated";
  }

  const { missing, files } = collectSubmittalSources(quote);

  if (quote.lineItems.length === 0) {
    return "No linked products";
  }

  if (files.length === 0) {
    return missing.length > 0 ? "Not on file" : "Not generated";
  }

  if (missing.length > 0) {
    return `${files.length} on file (${missing.length} missing)`;
  }

  return `${files.length} on file`;
}

async function resolveSubmittalPackageDirectory(jobFolderPath: string | null) {
  const trimmed = jobFolderPath?.trim();
  if (trimmed) {
    const subfolder = await getSubmittalsJobSubfolder();
    return path.join(trimmed, subfolder);
  }

  return getQuotePdfFallbackDir();
}

async function appendPdfFile(merged: PDFDocument, filePath: string) {
  const bytes = await readFile(filePath);
  const source = await PDFDocument.load(bytes);
  const pages = await merged.copyPages(source, source.getPageIndices());
  for (const page of pages) {
    merged.addPage(page);
  }
}

async function appendImageFile(merged: PDFDocument, filePath: string) {
  const bytes = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".png") {
    const image = await merged.embedPng(bytes);
    const page = merged.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    return;
  }

  if (ext === ".jpg" || ext === ".jpeg") {
    const image = await merged.embedJpg(bytes);
    const page = merged.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    return;
  }

  throw new Error(`Unsupported image type: ${path.basename(filePath)}`);
}

async function mergeSubmittalPdfBytes(input: {
  ticketNumber: string;
  customerName: string;
  projectName: string;
  deliveryDate: Date | null;
  products: SubmittalCoverProduct[];
  missing: string[];
  files: { productCode: string; documentName: string; filePath: string }[];
}): Promise<{ pdfBytes: Uint8Array; missing: string[]; skipped: string[] }> {
  const coverHtml = await buildSubmittalCoverHtml({
    quoteNumber: input.ticketNumber,
    customerName: input.customerName,
    projectName: input.projectName,
    quoteDate: input.deliveryDate
      ? new Intl.DateTimeFormat("en-US").format(input.deliveryDate)
      : "—",
    products: input.products,
    missingProducts: input.missing,
  });

  const tempCoverPath = path.join(
    os.tmpdir(),
    `precast-submittal-cover-${randomUUID()}.pdf`,
  );

  const merged = await PDFDocument.create();
  const skipped: string[] = [];
  const stockSubmittalsRoot = await getStockSubmittalsRoot();

  try {
    await writeQuotePdfFromHtml(coverHtml, tempCoverPath);
    await appendPdfFile(merged, tempCoverPath);

    for (const file of input.files) {
      const ext = path.extname(file.filePath).toLowerCase();
      try {
        assertPathUnderStockSubmittalsRoot(stockSubmittalsRoot, file.filePath);
        if (ext === ".pdf") {
          await appendPdfFile(merged, file.filePath);
        } else if (ext === ".png" || ext === ".jpg" || ext === ".jpeg") {
          await appendImageFile(merged, file.filePath);
        } else {
          skipped.push(`${file.productCode}: ${file.documentName}`);
        }
      } catch {
        skipped.push(`${file.productCode}: ${file.documentName}`);
      }
    }

    const pdfBytes = await merged.save();
    return { pdfBytes, missing: input.missing, skipped };
  } finally {
    await unlink(tempCoverPath).catch(() => undefined);
  }
}

export async function buildSubmittalPackagePdfBytesForDeliveryTicket(
  client: PrismaClient,
  ticketId: string,
): Promise<{
  pdfBytes: Uint8Array;
  ticketNumber: string;
  missing: string[];
  skipped: string[];
}> {
  const ticket = await fetchDeliveryTicketForSubmittalPackage(client, ticketId);
  if (!ticket) {
    throw new Error("Delivery ticket not found.");
  }

  const { products, missing, files } = collectSubmittalSources(ticket);
  const { pdfBytes, missing: missingProducts, skipped } =
    await mergeSubmittalPdfBytes({
      ticketNumber: ticket.ticketNumber,
      customerName: ticket.customerName,
      projectName: ticket.projectName,
      deliveryDate: ticket.deliveryDate,
      products,
      missing,
      files,
    });

  return {
    pdfBytes,
    ticketNumber: ticket.ticketNumber,
    missing: missingProducts,
    skipped,
  };
}

export async function generateSubmittalPackageForDeliveryTicket(
  client: PrismaClient,
  ticketId: string,
) {
  const ticket = await fetchDeliveryTicketForSubmittalPackage(client, ticketId);
  if (!ticket) {
    throw new Error("Delivery ticket not found.");
  }

  const { products, missing, files } = collectSubmittalSources(ticket);

  let jobFolderPath: string | null = null;
  if (ticket.jobId) {
    const job = await client.job.findUnique({
      where: { id: ticket.jobId },
      select: { folderPath: true },
    });
    jobFolderPath = job?.folderPath ?? null;
  }

  const { pdfBytes, skipped } = await mergeSubmittalPdfBytes({
    ticketNumber: ticket.ticketNumber,
    customerName: ticket.customerName,
    projectName: ticket.projectName,
    deliveryDate: ticket.deliveryDate,
    products,
    missing,
    files,
  });

  const outputDirectory = await resolveSubmittalPackageDirectory(jobFolderPath);
  const baseName = buildSubmittalPackageBaseName(
    ticket.ticketNumber,
    ticket.customerName,
  );
  const outputPath = await resolveQuotePdfOutputPath(outputDirectory, baseName);

  if (jobFolderPath) {
    assertPathUnderJobsRoot(await getJobsRoot(), outputPath);
  }

  await writeFile(outputPath, pdfBytes);

  if (ticket.jobId && jobFolderPath) {
    const submittalsSubfolder = await getSubmittalsJobSubfolder();
    await registerJobFile(client, ticket.jobId, outputPath, submittalsSubfolder);
  }

  return {
    filePath: outputPath,
    missing,
    skipped,
    includedCount: files.length - skipped.length,
  };
}

export async function generateSubmittalPackageForQuote(
  client: PrismaClient,
  quoteId: string,
) {
  const quote = await fetchQuoteForSubmittalPackage(client, quoteId);
  if (!quote) {
    throw new Error("Quote not found.");
  }

  const { products, missing, files } = collectSubmittalSources(quote);

  let jobFolderPath: string | null = null;
  if (quote.jobId) {
    const job = await client.job.findUnique({
      where: { id: quote.jobId },
      select: { folderPath: true },
    });
    jobFolderPath = job?.folderPath ?? null;
  }

  const coverHtml = await buildSubmittalCoverHtml({
    quoteNumber: quote.quoteNumber,
    customerName: quote.customerName,
    projectName: quote.projectName,
    quoteDate: quote.quoteDate
      ? new Intl.DateTimeFormat("en-US").format(quote.quoteDate)
      : "—",
    products,
    missingProducts: missing,
  });

  const tempCoverPath = path.join(
    os.tmpdir(),
    `precast-submittal-cover-${randomUUID()}.pdf`,
  );

  const merged = await PDFDocument.create();
  const skipped: string[] = [];
  const stockSubmittalsRoot = await getStockSubmittalsRoot();

  try {
    await writeQuotePdfFromHtml(coverHtml, tempCoverPath);
    await appendPdfFile(merged, tempCoverPath);

    for (const file of files) {
      const ext = path.extname(file.filePath).toLowerCase();
      try {
        // filePath comes from the DB; only read documents that live under the
        // stock submittals root so a poisoned path can't exfiltrate other files.
        assertPathUnderStockSubmittalsRoot(stockSubmittalsRoot, file.filePath);
        if (ext === ".pdf") {
          await appendPdfFile(merged, file.filePath);
        } else if (ext === ".png" || ext === ".jpg" || ext === ".jpeg") {
          await appendImageFile(merged, file.filePath);
        } else {
          skipped.push(`${file.productCode}: ${file.documentName}`);
        }
      } catch {
        skipped.push(`${file.productCode}: ${file.documentName}`);
      }
    }

    const outputDirectory = await resolveSubmittalPackageDirectory(jobFolderPath);
    const baseName = buildSubmittalPackageBaseName(
      quote.quoteNumber,
      quote.customerName,
    );
    const outputPath = await resolveQuotePdfOutputPath(outputDirectory, baseName);

    // The job folder comes from the DB; keep the write inside the jobs root.
    if (jobFolderPath) {
      assertPathUnderJobsRoot(await getJobsRoot(), outputPath);
    }

    const pdfBytes = await merged.save();
    await writeFile(outputPath, pdfBytes);

    if (quote.jobId && jobFolderPath) {
      const submittalsSubfolder = await getSubmittalsJobSubfolder();
      await registerJobFile(
        client,
        quote.jobId,
        outputPath,
        submittalsSubfolder,
      );
    }

    return {
      filePath: outputPath,
      missing,
      skipped,
      includedCount: files.length - skipped.length,
    };
  } finally {
    await unlink(tempCoverPath).catch(() => undefined);
  }
}
