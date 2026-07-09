import { access, mkdir, readdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import type { PrismaClient, ProductDocumentType } from "@/app/generated/prisma/client";
import { getStockSubmittalsRoot } from "@/lib/app-settings";
import { assertPathUnderStockSubmittalsRoot } from "@/lib/product-path-security";
import { assertUploadAllowed } from "@/lib/upload-validation";
import {
  resolveUniqueFilePath,
  sanitizeFileName,
} from "@/lib/file-upload-utils";
import {
  buildQuotePdfBaseName,
  sanitizeFilenamePart,
} from "@/lib/quote-pdf-path";

export const PRODUCT_SUBMITTAL_DOCUMENT_TYPES: ProductDocumentType[] = [
  "GENERIC_SUBMITTAL",
];

const VALID_DOCUMENT_TYPES = new Set<ProductDocumentType>([
  "GENERIC_SUBMITTAL",
  "SHOP_DRAWING",
  "CUT_SHEET_TEMPLATE",
  "SPEC_SHEET",
  "INSTALLATION_INSTRUCTIONS",
  "OTHER",
]);

function normalizePath(value: string) {
  return path.normalize(value.trim());
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function submittalFileBase(productCode: string) {
  const base = sanitizeFilenamePart(productCode);
  if (!base) {
    throw new Error("Product code is required to resolve submittal files.");
  }
  return base;
}

/** Legacy layout: one folder per product code. Still scanned, no longer written to. */
export async function getProductSubmittalDir(productCode: string) {
  const root = await getStockSubmittalsRoot();
  return path.join(root, submittalFileBase(productCode));
}

/**
 * Flat layout: files live directly in the submittals root, named after the
 * product code — `EJ103.pdf`, plus `EJ103 <anything>.pdf` for extra documents.
 */
function matchesProductCode(fileName: string, codeBase: string) {
  const base = path.parse(fileName).name.toLowerCase();
  const codeLower = codeBase.toLowerCase();
  return base === codeLower || base.startsWith(`${codeLower} `);
}

/**
 * Names a product's submittal files can carry: the product code, plus the
 * manufacturer code when one is set (supplier PDFs often keep that name).
 */
function submittalNameBases(product: {
  productCode: string;
  manufacturerCode?: string | null;
}): string[] {
  const bases = [submittalFileBase(product.productCode)];
  const manufacturerBase = sanitizeFilenamePart(product.manufacturerCode ?? "");
  if (
    manufacturerBase &&
    manufacturerBase.toLowerCase() !== bases[0].toLowerCase()
  ) {
    bases.push(manufacturerBase);
  }
  return bases;
}

async function assertProductExists(client: PrismaClient, productId: string) {
  const product = await client.product.findUnique({
    where: { id: productId },
    select: { id: true, productCode: true, name: true, manufacturerCode: true },
  });

  if (!product) {
    throw new Error("Product was not found.");
  }

  return product;
}

function parseDocumentType(value: string): ProductDocumentType {
  const trimmed = value.trim().toUpperCase() as ProductDocumentType;
  if (!VALID_DOCUMENT_TYPES.has(trimmed)) {
    throw new Error(`Invalid document type: ${value}`);
  }
  return trimmed;
}

export async function uploadProductDocument(
  client: PrismaClient,
  productId: string,
  documentType: string,
  file: File,
) {
  assertUploadAllowed(file);

  const product = await assertProductExists(client, productId);
  const parsedType = parseDocumentType(documentType);
  const root = await getStockSubmittalsRoot();
  const codeBase = submittalFileBase(product.productCode);

  await mkdir(root, { recursive: true });

  // Flat layout: first upload becomes <code>.<ext>; further uploads keep the
  // original name behind a "<code> - " prefix so scans still match them.
  const safeName = sanitizeFileName(file.name);
  const ext = path.extname(safeName);
  const preferredPath = path.join(root, `${codeBase}${ext}`);
  const outputPath = normalizePath(
    (await pathExists(preferredPath))
      ? await resolveUniqueFilePath(root, `${codeBase} - ${safeName}`)
      : preferredPath,
  );
  assertPathUnderStockSubmittalsRoot(root, outputPath);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(outputPath, buffer);

  try {
    const existing = await client.productDocument.findFirst({
      where: { productId, filePath: outputPath },
    });

    if (existing) {
      return await client.productDocument.update({
        where: { id: existing.id },
        data: {
          documentName: path.basename(outputPath),
          documentType: parsedType,
          fileSize: buffer.length,
          mimeType: file.type || null,
          updatedAt: new Date(),
        },
      });
    }

    return await client.productDocument.create({
      data: {
        productId,
        documentType: parsedType,
        documentName: path.basename(outputPath),
        filePath: outputPath,
        fileSize: buffer.length,
        mimeType: file.type || null,
      },
    });
  } catch (error) {
    // DB registration failed; remove the just-written file (the path is
    // unique to this upload) so no orphan is left on disk.
    await unlink(outputPath).catch(() => {});
    throw error;
  }
}

type SubmittalDiskFile = { filePath: string; fileName: string };

async function listRootEntries(root: string) {
  if (!(await pathExists(root))) {
    return [];
  }
  return readdir(root, { withFileTypes: true });
}

async function collectSubmittalFilesForCode(
  root: string,
  codeBases: string[],
  rootEntries: Awaited<ReturnType<typeof listRootEntries>>,
): Promise<SubmittalDiskFile[]> {
  const filesByPath = new Map<string, SubmittalDiskFile>();

  // Flat layout: files named after the product or manufacturer code, directly
  // in the root.
  for (const entry of rootEntries) {
    if (
      entry.isFile() &&
      codeBases.some((codeBase) => matchesProductCode(entry.name, codeBase))
    ) {
      const filePath = normalizePath(path.join(root, entry.name));
      filesByPath.set(filePath, { filePath, fileName: entry.name });
    }
  }

  // Legacy layout: a per-product-code folder from before the flat convention.
  const legacyDir = path.join(root, codeBases[0]);
  assertPathUnderStockSubmittalsRoot(root, legacyDir);
  if (await pathExists(legacyDir)) {
    const entries = await readdir(legacyDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = normalizePath(path.join(legacyDir, entry.name));
        filesByPath.set(filePath, { filePath, fileName: entry.name });
      }
    }
  }

  return [...filesByPath.values()];
}

async function syncProductDocumentRows(
  client: PrismaClient,
  productId: string,
  files: SubmittalDiskFile[],
) {
  const diskPaths = new Set<string>();
  let added = 0;

  for (const { filePath, fileName } of files) {
    diskPaths.add(filePath);

    const existing = await client.productDocument.findFirst({
      where: { productId, filePath },
    });

    if (existing) {
      const fileStat = await stat(filePath);
      if (
        existing.documentName !== fileName ||
        existing.fileSize !== fileStat.size
      ) {
        await client.productDocument.update({
          where: { id: existing.id },
          data: {
            documentName: fileName,
            fileSize: fileStat.size,
            updatedAt: new Date(),
          },
        });
      }
      continue;
    }

    const fileStat = await stat(filePath);
    await client.productDocument.create({
      data: {
        productId,
        documentType: "GENERIC_SUBMITTAL",
        documentName: fileName,
        filePath,
        fileSize: fileStat.size,
        mimeType: null,
      },
    });
    added += 1;
  }

  const registered = await client.productDocument.findMany({
    where: { productId },
    select: { id: true, filePath: true },
  });

  let removed = 0;
  for (const row of registered) {
    if (!diskPaths.has(normalizePath(row.filePath))) {
      await client.productDocument.delete({ where: { id: row.id } });
      removed += 1;
    }
  }

  return { added, removed };
}

export async function scanProductDocuments(
  client: PrismaClient,
  productId: string,
) {
  const product = await assertProductExists(client, productId);
  const root = await getStockSubmittalsRoot();
  const rootEntries = await listRootEntries(root);
  const files = await collectSubmittalFilesForCode(
    root,
    submittalNameBases(product),
    rootEntries,
  );
  return syncProductDocumentRows(client, productId, files);
}

/** One pass over the whole catalog: match every product against the flat submittals folder. */
export async function scanAllProductSubmittals(client: PrismaClient) {
  const root = await getStockSubmittalsRoot();
  const rootEntries = await listRootEntries(root);
  const products = await client.product.findMany({
    select: { id: true, productCode: true, manufacturerCode: true },
  });

  let added = 0;
  let removed = 0;
  let productsWithFiles = 0;

  for (const product of products) {
    if (!sanitizeFilenamePart(product.productCode)) {
      continue;
    }
    const files = await collectSubmittalFilesForCode(
      root,
      submittalNameBases(product),
      rootEntries,
    );
    if (files.length > 0) {
      productsWithFiles += 1;
    }
    const result = await syncProductDocumentRows(client, product.id, files);
    added += result.added;
    removed += result.removed;
  }

  return { added, removed, productsWithFiles };
}

export async function getProductDocumentForOpen(
  client: PrismaClient,
  documentId: string,
) {
  const document = await client.productDocument.findUnique({
    where: { id: documentId },
    include: {
      product: {
        select: { productCode: true, name: true },
      },
    },
  });

  if (!document) {
    throw new Error("Document was not found.");
  }

  const root = await getStockSubmittalsRoot();
  assertPathUnderStockSubmittalsRoot(root, document.filePath);

  if (!(await pathExists(document.filePath))) {
    throw new Error(`File not found on disk: ${document.documentName}`);
  }

  return document;
}

export async function deleteProductDocument(
  client: PrismaClient,
  documentId: string,
) {
  const document = await getProductDocumentForOpen(client, documentId);
  const root = await getStockSubmittalsRoot();
  assertPathUnderStockSubmittalsRoot(root, document.filePath);

  try {
    await unlink(document.filePath);
  } catch {
    // File may already be gone on disk; still remove the DB row.
  }

  await client.productDocument.delete({ where: { id: documentId } });
}

export function buildSubmittalPackageBaseName(
  quoteNumber: string,
  customerName: string,
) {
  return buildQuotePdfBaseName(
    `Submittal Package - ${quoteNumber}`,
    customerName,
    "Submittals",
  );
}

export function isSubmittalDocumentType(documentType: string) {
  return PRODUCT_SUBMITTAL_DOCUMENT_TYPES.includes(
    documentType as ProductDocumentType,
  );
}
