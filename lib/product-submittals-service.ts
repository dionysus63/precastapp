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

export async function getProductSubmittalDir(productCode: string) {
  const root = await getStockSubmittalsRoot();
  const folderName = sanitizeFilenamePart(productCode);
  if (!folderName) {
    throw new Error("Product code is required to resolve the submittals folder.");
  }
  return path.join(root, folderName);
}

async function assertProductExists(client: PrismaClient, productId: string) {
  const product = await client.product.findUnique({
    where: { id: productId },
    select: { id: true, productCode: true, name: true },
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
  const productDir = await getProductSubmittalDir(product.productCode);
  const root = await getStockSubmittalsRoot();

  await mkdir(productDir, { recursive: true });

  const safeName = sanitizeFileName(file.name);
  const outputPath = normalizePath(
    await resolveUniqueFilePath(productDir, safeName),
  );
  assertPathUnderStockSubmittalsRoot(root, outputPath);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(outputPath, buffer);

  const existing = await client.productDocument.findFirst({
    where: { productId, filePath: outputPath },
  });

  if (existing) {
    return client.productDocument.update({
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

  return client.productDocument.create({
    data: {
      productId,
      documentType: parsedType,
      documentName: path.basename(outputPath),
      filePath: outputPath,
      fileSize: buffer.length,
      mimeType: file.type || null,
    },
  });
}

export async function scanProductDocuments(
  client: PrismaClient,
  productId: string,
) {
  const product = await assertProductExists(client, productId);
  const productDir = await getProductSubmittalDir(product.productCode);
  const root = await getStockSubmittalsRoot();
  assertPathUnderStockSubmittalsRoot(root, productDir);

  if (!(await pathExists(productDir))) {
    await mkdir(productDir, { recursive: true });
    return { added: 0, removed: 0 };
  }

  const entries = await readdir(productDir, { withFileTypes: true });
  const diskPaths = new Set<string>();
  let added = 0;

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const filePath = normalizePath(path.join(productDir, entry.name));
    diskPaths.add(filePath);

    const existing = await client.productDocument.findFirst({
      where: { productId, filePath },
    });

    if (existing) {
      const fileStat = await stat(filePath);
      if (
        existing.documentName !== entry.name ||
        existing.fileSize !== fileStat.size
      ) {
        await client.productDocument.update({
          where: { id: existing.id },
          data: {
            documentName: entry.name,
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
        documentName: entry.name,
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
