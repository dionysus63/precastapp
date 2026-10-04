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

type SetFileKey = Pick<
  RectSheetPdfSetFileRecord,
  "setId" | "hasTopSlab" | "hasBaseSlab"
>;

/**
 * Uploaded set PDFs live in git-ignored storage, never in a git-tracked
 * folder: the server writing into tracked paths made deploys' `git pull`
 * collide with production uploads.
 */
export function getRectPdfSetsRoot(): string {
  return path.join(process.cwd(), "storage", "rect-pdf-sets");
}

/** Path relative to the sets root; what RectSheetPdfSetFile.filePath stores. */
export function rectPdfSetRelativePath(key: SetFileKey): string {
  return `${key.setId}/${rectTemplateVariantKey(key.hasTopSlab, key.hasBaseSlab)}.pdf`;
}

function resolveUnderRoot(root: string, key: SetFileKey): string {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, rectPdfSetRelativePath(key));
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("File path is outside the allowed PDF sets directory.");
  }
  return resolvedPath;
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

  const key = { setId, ...variant };
  const outputPath = resolveUnderRoot(getRectPdfSetsRoot(), key);
  await mkdir(path.dirname(outputPath), { recursive: true });

  // Same variant always maps to the same file, so this overwrites any
  // previous upload in place.
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(outputPath, buffer);

  const filePath = rectPdfSetRelativePath(key);
  const originalName = sanitizeFileName(file.name);

  return client.rectSheetPdfSetFile.upsert({
    where: { setId_hasTopSlab_hasBaseSlab: key },
    create: {
      ...key,
      filePath,
      originalName,
      fileSize: buffer.length,
    },
    update: {
      filePath,
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

  try {
    await unlink(resolveUnderRoot(getRectPdfSetsRoot(), row));
  } catch {
    // File may already be removed from disk.
  }

  await client.rectSheetPdfSetFile.delete({ where: { id } });
}

export async function readRectPdfSetFileBytes(
  row: SetFileKey,
): Promise<Uint8Array> {
  const buffer = await readFile(resolveUnderRoot(getRectPdfSetsRoot(), row));
  return new Uint8Array(buffer);
}
