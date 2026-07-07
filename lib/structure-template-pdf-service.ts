import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import type { PrismaClient } from "@/app/generated/prisma/client";
import { templateVariantKey } from "@/lib/drill-sheet-template-pdf";
import { sanitizeFileName } from "@/lib/file-upload-utils";
import { assertUploadAllowed } from "@/lib/upload-validation";

const PDF_EXTENSIONS = [".pdf"] as const;

/**
 * Full template PDF variant key. Circular templates use hasRiser/hasKey (and
 * keep a single PDF; the app draws the differences). Rectangular templates
 * use hasTopSlab/hasBaseSlab (four uploaded slots; the app draws joints,
 * openings, and dimensions).
 */
export type TemplatePdfVariant = {
  hasRiser: boolean;
  hasKey: boolean;
  hasTopSlab: boolean;
  hasBaseSlab: boolean;
};

export type StructureTemplatePdfRecord = TemplatePdfVariant & {
  id: string;
  templateId: string;
  filePath: string;
  originalName: string;
  fileSize: number | null;
  uploadedAt: Date;
  updatedAt: Date;
};

/** File-name key for a rectangular variant, e.g. "topslab-nobase". */
export function rectTemplateVariantKey(
  hasTopSlab: boolean,
  hasBaseSlab: boolean,
): string {
  return `${hasTopSlab ? "topslab" : "notopslab"}-${hasBaseSlab ? "base" : "nobase"}`;
}

function variantFileKey(variant: TemplatePdfVariant, isRect: boolean): string {
  return isRect
    ? rectTemplateVariantKey(variant.hasTopSlab, variant.hasBaseSlab)
    : templateVariantKey(variant.hasRiser, variant.hasKey);
}

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

function assertPathUnderRoot(root: string, filePath: string): void {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(filePath);
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("File path is outside the allowed templates directory.");
  }
}

async function getTemplateShape(
  client: PrismaClient,
  templateId: string,
): Promise<"CIRCULAR" | "RECTANGULAR"> {
  const template = await client.structureTemplate.findUnique({
    where: { id: templateId },
    select: { shape: true },
  });
  if (!template) {
    throw new Error("Structure template not found.");
  }
  return template.shape;
}

export async function saveTemplatePdf(
  client: PrismaClient,
  templateId: string,
  variant: TemplatePdfVariant,
  file: File,
): Promise<StructureTemplatePdfRecord> {
  assertUploadAllowed(file, { allowedExtensions: PDF_EXTENSIONS });

  const shape = await getTemplateShape(client, templateId);
  const isRect = shape === "RECTANGULAR";
  // Zero out the other shape's flags so variants stay canonical per shape.
  const canonical: TemplatePdfVariant = isRect
    ? {
        hasRiser: false,
        hasKey: false,
        hasTopSlab: variant.hasTopSlab,
        hasBaseSlab: variant.hasBaseSlab,
      }
    : {
        hasRiser: variant.hasRiser,
        hasKey: variant.hasKey,
        hasTopSlab: false,
        hasBaseSlab: false,
      };

  const root = getStructureTemplatePdfsRoot();
  const templateDir = getTemplatePdfDir(templateId);
  await mkdir(templateDir, { recursive: true });

  const outputPath = normalizePath(
    path.join(templateDir, `${variantFileKey(canonical, isRect)}.pdf`),
  );
  assertPathUnderRoot(root, outputPath);

  const uniqueWhere = {
    templateId_hasRiser_hasKey_hasTopSlab_hasBaseSlab: {
      templateId,
      ...canonical,
    },
  };

  const existing = await client.structureTemplatePdf.findUnique({
    where: uniqueWhere,
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
    where: uniqueWhere,
    create: {
      templateId,
      ...canonical,
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

  if (!isRect) {
    // Circular: one PDF per template — the app draws riser/key differences
    // itself, so any leftover variant PDFs from the old four-slot scheme are
    // removed. Rectangular templates keep all four top/base slots.
    const others = await client.structureTemplatePdf.findMany({
      where: { templateId, id: { not: row.id } },
    });
    for (const other of others) {
      assertPathUnderRoot(root, other.filePath);
      try {
        await unlink(other.filePath);
      } catch {
        // File may already be gone from disk.
      }
      await client.structureTemplatePdf.delete({ where: { id: other.id } });
    }
  }

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
