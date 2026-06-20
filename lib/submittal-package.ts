import { readFile, unlink, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { PDFDocument } from "pdf-lib";
import type { PrismaClient } from "@/app/generated/prisma/client";
import {
  getQuotePdfFallbackDir,
  getSubmittalsJobSubfolder,
} from "@/lib/app-settings";
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

  try {
    await writeQuotePdfFromHtml(coverHtml, tempCoverPath);
    await appendPdfFile(merged, tempCoverPath);

    for (const file of files) {
      const ext = path.extname(file.filePath).toLowerCase();
      try {
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
