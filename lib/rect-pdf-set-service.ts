import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import type { PrismaClient } from "@/app/generated/prisma/client";
import { rectTemplateVariantKey } from "@/lib/structure-template-pdf-service";
import { sanitizeFileName } from "@/lib/file-upload-utils";
import { assertUploadAllowed } from "@/lib/upload-validation";

const PDF_EXTENSIONS = [".pdf"] as const;

export type RectSheetPdfSetFileRecord = {
  id: string;
  setId: string;
  hasTopSlab: boolean;
  hasBaseSlab: boolean;
  filePath: string;
  originalName: string;
  fileSize: number | null;
  uploadedAt: Date;
  updatedAt: Date;
};

export function getRectPdfSetsRoot(): string {
  return path.join(process.cwd(), "assets", "templates", "rect-pdf-sets");
}

function assertPathUnderRoot(root: string, filePath: string): void {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(filePath);
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("File path is outside the allowed PDF sets directory.");
  }
}

export async function saveRectPdfSetFile(
  client: PrismaClient,
  setId: string,
  variant: { hasTopSlab: boolean; hasBaseSlab: boolean },
  file: File,
): Promise<RectSheetPdfSetFileRecord> {
  assertUploadAllowed(file, { allowedExtensions: PDF_EXTENSIONS });

  const set = await client.rectSheetPdfSet.findUnique({
    where: { id: setId },
    select: { id: true },
  });
  if (!set) {
    throw new Error("PDF set not found.");
  }

  const root = getRectPdfSetsRoot();
  const setDir = path.join(root, setId);
  await mkdir(setDir, { recursive: true });

  const outputPath = path.normalize(
    path.join(
      setDir,
      `${rectTemplateVariantKey(variant.hasTopSlab, variant.hasBaseSlab)}.pdf`,
    ),
  );
  assertPathUnderRoot(root, outputPath);

  const uniqueWhere = {
    setId_hasTopSlab_hasBaseSlab: { setId, ...variant },
  };

  const existing = await client.rectSheetPdfSetFile.findUnique({
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

  return client.rectSheetPdfSetFile.upsert({
    where: uniqueWhere,
    create: {
      setId,
      ...variant,
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
}

export async function deleteRectPdfSetFile(
  client: PrismaClient,
  id: string,
): Promise<void> {
  const row = await client.rectSheetPdfSetFile.findUnique({ where: { id } });
  if (!row) {
    throw new Error("PDF set file not found.");
  }

  const root = getRectPdfSetsRoot();
  assertPathUnderRoot(root, row.filePath);
  try {
    await unlink(row.filePath);
  } catch {
    // File may already be removed from disk.
  }

  await client.rectSheetPdfSetFile.delete({ where: { id } });
}

export async function readRectPdfSetFileBytes(
  row: Pick<RectSheetPdfSetFileRecord, "filePath">,
): Promise<Uint8Array> {
  const root = getRectPdfSetsRoot();
  assertPathUnderRoot(root, row.filePath);
  const buffer = await readFile(row.filePath);
  return new Uint8Array(buffer);
}
