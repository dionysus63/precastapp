import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import type { PrismaClient } from "@/app/generated/prisma/client";
import { templateVariantKey } from "@/lib/drill-sheet-template-pdf";
import { sanitizeFileName } from "@/lib/file-upload-utils";
import { assertUploadAllowed } from "@/lib/upload-validation";

const PDF_EXTENSIONS = [".pdf"] as const;

export type StructureTemplatePdfRecord = {
  id: string;
  templateId: string;
  hasRiser: boolean;
  hasKey: boolean;
  filePath: string;
  originalName: string;
  fileSize: number | null;
  uploadedAt: Date;
  updatedAt: Date;
};

function normalizePath(filePath: string): string {
  return path.normalize(filePath);
}

export function getStructureTemplatePdfsRoot(): string {
  return path.join(
    process.cwd(),
    "assets",
    "templates",
    "structure-template-pdfs",
  );
}

export function getTemplatePdfDir(templateId: string): string {
  return path.join(getStructureTemplatePdfsRoot(), templateId);
}

export function getTemplatePdfPath(
  templateId: string,
  hasRiser: boolean,
  hasKey: boolean,
): string {
  const variantKey = templateVariantKey(hasRiser, hasKey);
  return path.join(getTemplatePdfDir(templateId), `${variantKey}.pdf`);
}

function assertPathUnderRoot(root: string, filePath: string): void {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(filePath);
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("File path is outside the allowed templates directory.");
  }
}

async function assertTemplateExists(
  client: PrismaClient,
  templateId: string,
): Promise<void> {
  const template = await client.structureTemplate.findUnique({
    where: { id: templateId },
    select: { id: true },
  });
  if (!template) {
    throw new Error("Structure template not found.");
  }
}

export async function saveTemplatePdf(
  client: PrismaClient,
  templateId: string,
  hasRiser: boolean,
  hasKey: boolean,
  file: File,
): Promise<StructureTemplatePdfRecord> {
  assertUploadAllowed(file, { allowedExtensions: PDF_EXTENSIONS });

  await assertTemplateExists(client, templateId);

  const root = getStructureTemplatePdfsRoot();
  const templateDir = getTemplatePdfDir(templateId);
  await mkdir(templateDir, { recursive: true });

  const outputPath = normalizePath(
    getTemplatePdfPath(templateId, hasRiser, hasKey),
  );
  assertPathUnderRoot(root, outputPath);

  const existing = await client.structureTemplatePdf.findUnique({
    where: {
      templateId_hasRiser_hasKey: { templateId, hasRiser, hasKey },
    },
  });

  if (existing) {
    try {
      await unlink(existing.filePath);
    } catch {
      // Previous file may already be gone.
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(outputPath, buffer);

  const originalName = sanitizeFileName(file.name);

  const row = await client.structureTemplatePdf.upsert({
    where: {
      templateId_hasRiser_hasKey: { templateId, hasRiser, hasKey },
    },
    create: {
      templateId,
      hasRiser,
      hasKey,
      filePath: outputPath,
      originalName,
      fileSize: buffer.length,
    },
    update: {
      filePath: outputPath,
      originalName,
      fileSize: buffer.length,
    },
  });

  return row;
}

export async function deleteTemplatePdf(
  client: PrismaClient,
  id: string,
): Promise<void> {
  const row = await client.structureTemplatePdf.findUnique({ where: { id } });
  if (!row) {
    throw new Error("Template PDF not found.");
  }

  const root = getStructureTemplatePdfsRoot();
  assertPathUnderRoot(root, row.filePath);

  try {
    await unlink(row.filePath);
  } catch {
    // File may already be removed from disk.
  }

  await client.structureTemplatePdf.delete({ where: { id } });
}

export async function readTemplatePdfBytes(
  row: Pick<StructureTemplatePdfRecord, "filePath">,
): Promise<Uint8Array> {
  const root = getStructureTemplatePdfsRoot();
  assertPathUnderRoot(root, row.filePath);

  const buffer = await readFile(row.filePath);
  return new Uint8Array(buffer);
}
