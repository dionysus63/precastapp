import { readFile, unlink } from "fs/promises";
import path from "path";
import type { PrismaClient } from "@/app/generated/prisma/client";

/**
 * Legacy per-template PDF variant flags. Both shapes now share Sheet PDF Sets
 * (lib/rect-pdf-set-service.ts); the StructureTemplatePdf rows are dormant and
 * only read/deleted by scripts/convert-circular-template-pdfs-to-sets.ts.
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

export function getStructureTemplatePdfsRoot(): string {
  return path.join(
    process.cwd(),
    "assets",
    "templates",
    "structure-template-pdfs",
  );
}

function assertPathUnderRoot(root: string, filePath: string): void {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(filePath);
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("File path is outside the allowed templates directory.");
  }
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
