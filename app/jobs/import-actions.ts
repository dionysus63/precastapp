"use server";

import { PDFDocument } from "pdf-lib";
import { revalidatePath } from "next/cache";
import { AppPermission, Prisma } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { parseLocalDay } from "@/lib/date-only";
import { createJobFolders, createJobRecord } from "@/lib/job-create";
import { uploadJobFile } from "@/lib/job-files-service";
import {
  IMPORT_DOC_KINDS,
  getImportPhase,
  importFileField,
  isImportPhase,
  isImportStructureStatus,
  parseMoneyInput,
  parseQuantityInput,
  statusDateFields,
  type ImportDocKind,
  type ImportFileInfo,
  type ImportJobPayload,
  type ImportStructureStatus,
} from "@/lib/job-import";
import { uploadJobStructureDocument } from "@/lib/job-structure-documents-service";
import { linkJobStructuresFromQuoteInTransaction } from "@/lib/job-structure-workflow";
import { computeMoneyTotals } from "@/lib/money";
import { extractPdfPages } from "@/lib/pdf-page-extract";
import { PHYSICAL_PRODUCT_TYPES } from "@/lib/product-types";
import { prisma, withDatabaseRetry } from "@/lib/prisma";
import { generateQuoteNumber } from "@/lib/quote-number";
import { computeDeliveryAmount } from "@/lib/quotes/money-rules";
import { plainTextToRichText } from "@/lib/rich-text";
import { returnActionError } from "@/lib/server/action-errors";
import { assertUploadAllowed } from "@/lib/upload-validation";

export type ImportProductOption = {
  id: string;
  label: string;
  code: string;
  description: string;
  unit: string;
};

/** Castings and stock items for the import grid's product rows. */
export async function searchProductsForJobImport(
  query: string,
): Promise<ImportProductOption[]> {
  await requirePermission(AppPermission.QUOTES_MANAGE);
  const trimmed = query.trim();
  const products = await withDatabaseRetry((client) =>
    client.product.findMany({
      where: {
        status: "ACTIVE",
        productType: { in: [...PHYSICAL_PRODUCT_TYPES] },
        ...(trimmed
          ? {
              OR: [
                { productCode: { contains: trimmed, mode: "insensitive" } },
                { name: { contains: trimmed, mode: "insensitive" } },
                { manufacturerCode: { contains: trimmed, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { productCode: "asc" },
      take: 30,
      select: {
        id: true,
        productCode: true,
        name: true,
        description: true,
        unit: true,
      },
    }),
  );
  return products.map((product) => ({
    id: product.id,
    code: product.productCode,
    label: `${product.productCode} — ${product.name}`,
    description: product.description?.trim() || product.name,
    unit: product.unit,
  }));
}

export type ImportJobResult = {
  jobId: string;
  jobNumber: string;
  projectName: string;
  jobCreated: boolean;
  quoteId: string;
  quoteNumber: string;
  structureCount: number;
  productLineCount: number;
  filesSaved: number;
  /** Problems after the job and quote were saved (mostly file writes). */
  errors: string[];
};

const MAX_IMPORT_ROWS = 500;

/** Combined originals are kept whole in the job folder for reference. */
const ORIGINALS_FOLDER: Record<ImportDocKind | "QUOTE", string> = {
  QUOTE: "02 Quotes",
  DRILL_SHEET: "08 Production",
  SUBMITTAL: "03 Submittals",
  APPROVED_SUBMITTAL: "03 Submittals",
};

function optional(value: string | undefined | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

function safeFilePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "-").trim() || "Structure";
}

type PreparedStructure = {
  structureNumber: string;
  description: string;
  quantity: number;
  unitPrice: number;
  weightLbs: number | null;
  status: ImportStructureStatus;
  docs: { kind: ImportDocKind; fileKey: string; pages: number[] | null }[];
};

type PreparedProduct = {
  productId: string;
  itemCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  weight: Prisma.Decimal | null;
  yards: Prisma.Decimal | null;
  taxable: boolean;
};

/**
 * Jobs → Import Existing Job. Creates (or reuses) the job, a quote with one
 * line per structure, casting, and stock item, and — past the Quoted phase —
 * marks it won so the structures exist with their real statuses. Then saves
 * the PDFs: the quote into 02 Quotes, and each structure's drill sheet and
 * submittals onto the structure, cutting pages out of a combined PDF where
 * one covers many structures. Every row and file is checked before anything
 * is written.
 */
export async function importExistingJob(formData: FormData) {
  return returnActionError(() => importExistingJobOrThrow(formData));
}

async function importExistingJobOrThrow(formData: FormData): Promise<ImportJobResult> {
  const actor = await requirePermission(AppPermission.QUOTES_MANAGE);
  await requirePermission(AppPermission.STRUCTURES_MANAGE);

  let payload: ImportJobPayload;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "")) as ImportJobPayload;
  } catch {
    throw new Error("The import form didn't come through. Reload the page and try again.");
  }
  if (payload.job?.mode === "new") {
    await requirePermission(AppPermission.JOBS_MANAGE);
  }
  if (!isImportPhase(payload.phase)) {
    throw new Error("Pick where the job is right now.");
  }
  const phase = getImportPhase(payload.phase);
  const makesStructures = phase.structureStatus !== null;

  const problems: string[] = [];

  // Files: every declared file must have arrived, pass the upload rules,
  // and (when split by page) be a readable PDF.
  const fileInfos = new Map<string, ImportFileInfo>();
  const files = new Map<string, File>();
  const pdfs = new Map<string, PDFDocument>();
  for (const info of Array.isArray(payload.files) ? payload.files : []) {
    const file = formData.get(importFileField(info.key));
    if (!(file instanceof File)) {
      problems.push(`${info.name}: the file didn't upload. Drop it in again.`);
      continue;
    }
    try {
      assertUploadAllowed(file);
    } catch (error) {
      problems.push(`${info.name}: ${error instanceof Error ? error.message : "not allowed."}`);
      continue;
    }
    fileInfos.set(info.key, info);
    files.set(info.key, file);
    if (info.combined) {
      try {
        pdfs.set(
          info.key,
          await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), {
            ignoreEncryption: true,
          }),
        );
      } catch {
        problems.push(`${info.name}: couldn't read it as a PDF, so its pages can't be split.`);
      }
    }
  }

  // Rows.
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (rows.length === 0) {
    problems.push("Add at least one structure or item to the grid.");
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    problems.push(`That's more than ${MAX_IMPORT_ROWS} rows. Split the import in two.`);
  }

  const structures: PreparedStructure[] = [];
  const productRows: { row: (typeof rows)[number] & { kind: "PRODUCT" }; index: number }[] = [];
  const seenNumbers = new Set<string>();
  rows.forEach((row, index) => {
    if (row.kind === "PRODUCT") {
      productRows.push({ row, index });
      return;
    }
    const structureNumber = String(row.structureNumber ?? "").trim();
    const label = structureNumber || `Row ${index + 1}`;
    if (!structureNumber) {
      problems.push(`${label}: enter a structure number.`);
      return;
    }
    const key = structureNumber.toLowerCase();
    if (seenNumbers.has(key)) {
      problems.push(`${label}: that structure number is used twice.`);
      return;
    }
    seenNumbers.add(key);
    const quantity = parseQuantityInput(String(row.quantity ?? ""));
    if (quantity === null || !Number.isInteger(quantity)) {
      problems.push(`${label}: quantity must be a whole number above 0.`);
      return;
    }
    const unitPrice = parseMoneyInput(String(row.unitPrice ?? "")) ?? 0;
    if (unitPrice < 0) {
      problems.push(`${label}: price can't be negative.`);
      return;
    }
    const weightText = String(row.weightLbs ?? "").trim();
    const weightLbs = weightText ? parseQuantityInput(weightText) : null;
    if (weightText && weightLbs === null) {
      problems.push(`${label}: weight must be a number of pounds.`);
      return;
    }
    const status = isImportStructureStatus(row.status)
      ? row.status
      : (phase.structureStatus ?? "NOT_SUBMITTED");

    const docs: PreparedStructure["docs"] = [];
    for (const kind of IMPORT_DOC_KINDS) {
      const ref = row.docs?.[kind.value];
      if (!ref) {
        continue;
      }
      if (!makesStructures) {
        continue;
      }
      const info = fileInfos.get(ref.fileKey);
      if (!info) {
        problems.push(`${label}: its ${kind.label.toLowerCase()} file is missing.`);
        continue;
      }
      let pages: number[] | null = null;
      if (Array.isArray(ref.pages) && ref.pages.length > 0) {
        const pdf = pdfs.get(ref.fileKey);
        if (!pdf) {
          // Already reported above when the PDF couldn't be read.
          continue;
        }
        const count = pdf.getPageCount();
        pages = [...new Set(ref.pages.map(Number))].sort((a, b) => a - b);
        if (pages.some((page) => !Number.isInteger(page) || page < 1 || page > count)) {
          problems.push(`${label}: ${info.name} only has ${count} pages.`);
          continue;
        }
      }
      docs.push({ kind: kind.value, fileKey: ref.fileKey, pages });
    }

    structures.push({
      structureNumber,
      description: String(row.description ?? "").trim(),
      quantity,
      unitPrice,
      weightLbs,
      status,
      docs,
    });
  });

  const productIds = [
    ...new Set(
      productRows
        .map(({ row }) => row.productId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const productsById = new Map(
    (
      await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          productCode: true,
          name: true,
          description: true,
          unit: true,
          weight: true,
          yards: true,
          taxable: true,
        },
      })
    ).map((product) => [product.id, product]),
  );
  const products: PreparedProduct[] = [];
  for (const { row, index } of productRows) {
    const label = row.productLabel?.trim() || `Row ${index + 1}`;
    const product = row.productId ? productsById.get(row.productId) : undefined;
    if (!product) {
      problems.push(`${label}: pick the casting or stock item from the catalog.`);
      continue;
    }
    const quantity = parseQuantityInput(String(row.quantity ?? ""));
    if (quantity === null) {
      problems.push(`${product.productCode}: quantity must be above 0.`);
      continue;
    }
    const unitPrice = parseMoneyInput(String(row.unitPrice ?? "")) ?? 0;
    if (unitPrice < 0) {
      problems.push(`${product.productCode}: price can't be negative.`);
      continue;
    }
    products.push({
      productId: product.id,
      itemCode: product.productCode,
      description:
        String(row.description ?? "").trim() ||
        product.description?.trim() ||
        product.name,
      quantity,
      unitPrice,
      unit: product.unit,
      weight: product.weight,
      yards: product.yards,
      taxable: product.taxable,
    });
  }

  const taxRate = parseMoneyInput(String(payload.quote?.taxRate ?? "")) ?? 0;
  if (taxRate < 0 || taxRate > 25) {
    problems.push("Tax rate should be a percent between 0 and 25.");
  }

  // The job.
  let existingJob: {
    id: string;
    year: number;
    jobNumber: string;
    projectName: string;
    projectAddress: string | null;
    customerId: string | null;
    customerName: string;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
  } | null = null;
  if (payload.job?.mode === "existing") {
    const job = await prisma.job.findUnique({
      where: { id: payload.job.jobId },
      select: {
        id: true,
        year: true,
        jobNumber: true,
        projectName: true,
        projectAddress: true,
        customerId: true,
        customerName: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        jobStructures: {
          where: { structureNumber: { not: null }, quoteId: { not: null } },
          select: { structureNumber: true },
        },
      },
    });
    if (!job) {
      throw new Error("That job was not found. It may have been deleted.");
    }
    // Structures already won on another quote can't be imported twice;
    // unlinked ones (drill sheets made straight on the job) are adopted.
    const taken = new Set(
      job.jobStructures.map((s) => (s.structureNumber ?? "").trim().toLowerCase()),
    );
    const clashes = makesStructures
      ? structures
          .map((s) => s.structureNumber)
          .filter((number) => taken.has(number.toLowerCase()))
      : [];
    if (clashes.length > 0) {
      problems.push(
        `Already on a won quote for job ${job.jobNumber}: ${clashes.join(", ")}. Renumber or remove those rows.`,
      );
    }
    const { jobStructures: _structures, ...rest } = job;
    void _structures;
    existingJob = rest;
  } else if (payload.job?.mode === "new") {
    if (!payload.job.projectName?.trim()) {
      problems.push("Enter a project name for the new job.");
    }
    if (!payload.job.customerId && !payload.job.customerName?.trim()) {
      problems.push("Pick or type a contractor for the new job.");
    }
  } else {
    problems.push("Pick a job or enter a new one.");
  }

  const requestedQuoteNumber = String(payload.quote?.quoteNumber ?? "").trim();
  if (requestedQuoteNumber) {
    const clash = await prisma.quote.findUnique({
      where: { quoteNumber: requestedQuoteNumber },
      select: { id: true },
    });
    if (clash) {
      problems.push(`Quote number ${requestedQuoteNumber} is already used. Change it or leave it blank.`);
    }
  }

  if (problems.length > 0) {
    throw new Error(problems.join(" "));
  }

  // --- Writes start here ---

  let job = existingJob;
  let jobCreated = false;
  const errors: string[] = [];
  if (payload.job.mode === "new") {
    const created = await createJobRecord({
      year: new Date().getFullYear(),
      customerId: payload.job.customerId,
      customerName: payload.job.customerName.trim(),
      projectName: payload.job.projectName.trim(),
      projectAddress: optional(payload.job.projectAddress),
      city: optional(payload.job.city),
      state: optional(payload.job.state),
      zip: optional(payload.job.zip),
      status: phase.jobStatus,
      bidDate: null,
      awardedDate: phase.jobStatus === "QUOTING" ? null : new Date(),
      contactName: optional(payload.job.contactName),
      contactEmail: optional(payload.job.contactEmail),
      contactPhone: optional(payload.job.contactPhone),
      notes: null,
    });
    jobCreated = true;
    if (!(await createJobFolders(created))) {
      errors.push(
        "The job's folders couldn't be made on the file share, so no PDFs were saved. Use Create Folder on the job page, then attach them there.",
      );
    }
    job = {
      id: created.id,
      year: created.year,
      jobNumber: created.jobNumber,
      projectName: created.projectName,
      projectAddress: created.projectAddress,
      customerId: created.customerId,
      customerName: created.customerName,
      contactName: created.contactName,
      contactEmail: created.contactEmail,
      contactPhone: created.contactPhone,
    };
  }
  if (!job) {
    throw new Error("Could not find or create the job.");
  }
  const jobRecord = job;

  // Quote lines: structures first (in grid order), then castings and stock.
  const lines = [
    ...structures.map((structure) => ({
      lineType: "CUSTOM_STRUCTURE" as const,
      productId: null,
      itemCode: structure.structureNumber,
      description: structure.description
        ? plainTextToRichText(structure.description)
        : null,
      quantity: structure.quantity,
      unit: "EA",
      unitPrice: structure.unitPrice,
      weight: structure.weightLbs != null ? new Prisma.Decimal(structure.weightLbs) : null,
      yards: null as Prisma.Decimal | null,
      taxable: true,
    })),
    ...products.map((product) => ({
      lineType: "STOCK_PRODUCT" as const,
      productId: product.productId,
      itemCode: product.itemCode,
      description: plainTextToRichText(product.description),
      quantity: product.quantity,
      unit: product.unit,
      unitPrice: product.unitPrice,
      weight: product.weight,
      yards: product.yards,
      taxable: product.taxable,
    })),
  ];
  const money = computeMoneyTotals(
    lines.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxable: line.taxable,
    })),
    taxRate,
  );
  const deliveryAmount = computeDeliveryAmount(lines, money.lineTotals);
  const totalWeight = lines.reduce(
    (sum, line) => (line.weight ? sum.add(line.weight.mul(line.quantity)) : sum),
    new Prisma.Decimal(0),
  );
  const totalYards = lines.reduce(
    (sum, line) => (line.yards ? sum.add(line.yards.mul(line.quantity)) : sum),
    new Prisma.Decimal(0),
  );
  const quoteDate = parseLocalDay(String(payload.quote?.quoteDate ?? "")) ?? new Date();
  const quoteNumber =
    requestedQuoteNumber ||
    (await generateQuoteNumber(prisma, {
      jobNumber: jobRecord.jobNumber,
      scopeLabel: null,
      contractorName: null,
    }));

  const quote = await prisma.$transaction(
    async (tx) => {
      // The contractor's bid-list entry, when it has no quote yet, owns this
      // one so the job's bidding panel shows it.
      const bidder = jobRecord.customerId
        ? await tx.jobBidder.findFirst({
            where: {
              jobId: jobRecord.id,
              customerId: jobRecord.customerId,
              quotes: { none: {} },
            },
            select: { id: true },
          })
        : null;
      if (bidder && makesStructures) {
        await tx.jobBidder.update({
          where: { id: bidder.id },
          data: { isWinner: true },
        });
      }
      const created = await tx.quote.create({
        data: {
          quoteNumber,
          revisionNumber: 0,
          job: { connect: { id: jobRecord.id } },
          ...(bidder ? { jobBidder: { connect: { id: bidder.id } } } : {}),
          ...(jobRecord.customerId
            ? { customer: { connect: { id: jobRecord.customerId } } }
            : {}),
          createdBy: { connect: { id: actor.id } },
          jobNumber: jobRecord.jobNumber,
          customerName: jobRecord.customerName,
          projectName: jobRecord.projectName,
          projectAddress: jobRecord.projectAddress,
          contactName: jobRecord.contactName,
          contactEmail: jobRecord.contactEmail,
          contactPhone: jobRecord.contactPhone,
          status: makesStructures ? "WON" : "SENT",
          sentAt: quoteDate,
          quoteType: products.length > 0 ? "MIXED" : "CUSTOM_STRUCTURES",
          quoteDate,
          subtotal: money.subtotal,
          discountAmount: new Prisma.Decimal(0),
          deliveryAmount,
          taxableAmount: money.taxableAmount,
          taxRate: new Prisma.Decimal(taxRate),
          salesTax: money.salesTax,
          total: money.total,
          totalWeight,
          totalYards,
          internalNotes:
            "Imported with Jobs → Import Existing Job. The quote PDF in the job folder is the original.",
          lineItems: {
            create: lines.map((line, index) => ({
              lineNumber: index + 1,
              lineType: line.lineType,
              productId: line.productId,
              itemCode: line.itemCode,
              description: line.description,
              quantity: new Prisma.Decimal(line.quantity),
              unit: line.unit,
              unitPrice: new Prisma.Decimal(line.unitPrice),
              weight: line.weight,
              yards: line.yards,
              taxable: line.taxable,
              total: money.lineTotals[index]!,
              sortOrder: index + 1,
            })),
          },
        },
        select: { id: true, quoteNumber: true },
      });

      const structureIds = new Map<string, string>();
      if (makesStructures) {
        await linkJobStructuresFromQuoteInTransaction(tx, created.id);
        const linked = await tx.jobStructure.findMany({
          where: { quoteId: created.id },
          select: { id: true, structureNumber: true },
        });
        for (const structure of linked) {
          structureIds.set((structure.structureNumber ?? "").trim().toLowerCase(), structure.id);
        }
        const now = new Date();
        for (const structure of structures) {
          const id = structureIds.get(structure.structureNumber.toLowerCase());
          if (!id) {
            continue;
          }
          const data: Prisma.JobStructureUpdateInput = { status: structure.status };
          for (const field of statusDateFields(structure.status)) {
            data[field] = now;
          }
          await tx.jobStructure.update({ where: { id }, data });
        }

        // Existing jobs only move forward (a manual On Hold etc. sticks).
        const earlier =
          phase.jobStatus === "ACTIVE"
            ? (["QUOTING", "DETAILING", "AWARDED"] as const)
            : (["QUOTING", "DETAILING"] as const);
        await tx.job.updateMany({
          where: { id: jobRecord.id, status: { in: [...earlier] } },
          data: { status: phase.jobStatus },
        });
        await tx.job.updateMany({
          where: { id: jobRecord.id, awardedDate: null },
          data: { awardedDate: now },
        });
      }
      return { ...created, structureIds };
    },
    { timeout: 60_000 },
  );

  // --- Files (after the records exist; problems are reported, not fatal) ---
  let filesSaved = 0;
  const folderReady = await prisma.job
    .findUnique({ where: { id: jobRecord.id }, select: { folderPath: true } })
    .then((row) => Boolean(row?.folderPath?.trim()));
  const usedWhole = new Set<string>();

  if (folderReady) {
    for (const structure of structures) {
      const structureId = quote.structureIds.get(structure.structureNumber.toLowerCase());
      if (!structureId) {
        continue;
      }
      for (const doc of structure.docs) {
        const kind = IMPORT_DOC_KINDS.find((entry) => entry.value === doc.kind)!;
        const source = files.get(doc.fileKey);
        if (!source) {
          continue;
        }
        try {
          let upload: File = source;
          if (doc.pages) {
            const pdf = pdfs.get(doc.fileKey)!;
            const bytes = await extractPdfPages(pdf, doc.pages);
            upload = new File(
              [bytes as Uint8Array<ArrayBuffer>],
              `${safeFilePart(structure.structureNumber)} ${kind.fileSuffix}.pdf`,
              { type: "application/pdf" },
            );
          } else {
            usedWhole.add(doc.fileKey);
          }
          await uploadJobStructureDocument(prisma, structureId, kind.documentType, upload);
          filesSaved += 1;
        } catch (error) {
          errors.push(
            `${structure.structureNumber} ${kind.label.toLowerCase()}: ${error instanceof Error ? error.message : "could not be saved."}`,
          );
        }
      }
    }

    // The quote PDF, combined originals, and any separate file no row
    // claimed go into the job folder so nothing dropped is lost.
    for (const [key, file] of files) {
      const info = fileInfos.get(key)!;
      if (info.kind !== "QUOTE" && !info.combined && usedWhole.has(key)) {
        continue;
      }
      try {
        await uploadJobFile(prisma, jobRecord.id, ORIGINALS_FOLDER[info.kind], file);
        filesSaved += 1;
      } catch (error) {
        errors.push(
          `${info.name}: ${error instanceof Error ? error.message : "could not be saved to the job folder."}`,
        );
      }
    }
  } else if (files.size > 0 && !jobCreated) {
    errors.push(
      `Job ${jobRecord.jobNumber} has no folder yet, so no PDFs were saved. Use Create Folder on the job page, then attach them there.`,
    );
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobRecord.id}`);
  revalidatePath("/quotes");
  revalidatePath(`/quotes/${quote.id}`);
  revalidatePath("/production");
  revalidatePath("/drill-sheets");

  return {
    jobId: jobRecord.id,
    jobNumber: jobRecord.jobNumber,
    projectName: jobRecord.projectName,
    jobCreated,
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    structureCount: makesStructures ? quote.structureIds.size : 0,
    productLineCount: products.length,
    filesSaved,
    errors,
  };
}
