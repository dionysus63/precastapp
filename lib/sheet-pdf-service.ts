import { randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { Prisma, type PrismaClient } from "@/app/generated/prisma/client";
import {
  listTemplatePdfFields,
  type TemplatePdfFieldCoverage,
} from "@/lib/drill-sheet-template-pdf";
import { sanitizeFileName } from "@/lib/file-upload-utils";
import { rectVariantExpectedFieldNames } from "@/lib/rect-template-pdf-fields";
import type { SheetPdfKind, SheetPdfShape } from "@/lib/sheet-pdf";
import { assertUploadAllowed } from "@/lib/upload-validation";

const PDF_EXTENSIONS = [".pdf"] as const;

export type SheetPdfRecord = SheetPdfKind & {
  id: string;
  name: string;
  filePath: string;
  originalName: string;
  fileSize: number | null;
  uploadedAt: Date;
  updatedAt: Date;
};

/**
 * Sheet PDFs live in git-ignored storage, never in a git-tracked folder: the
 * server writing into tracked paths made deploys' `git pull` collide with
 * production uploads. The folder keeps its "rect-pdf-sets" name from the
 * Sheet PDF Sets it used to hold, so files uploaded back then never moved.
 */
export function getSheetPdfsRoot(): string {
  return path.join(process.cwd(), "storage", "rect-pdf-sets");
}

function resolveUnderRoot(relativePath: string): string {
  const resolvedRoot = path.resolve(getSheetPdfsRoot());
  // Stored paths use "/" on every platform.
  const resolvedPath = path.resolve(resolvedRoot, ...relativePath.split("/"));
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("File path is outside the Sheet PDFs folder.");
  }
  return resolvedPath;
}

function isUniqueNameError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

const DUPLICATE_NAME_MESSAGE = "A Sheet PDF with that name already exists.";

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Enter a name for the Sheet PDF.");
  }
  return trimmed;
}

/** Adds a Sheet PDF: one row and its file, stored as "<id>.pdf". */
export async function createSheetPdf(
  client: PrismaClient,
  input: {
    name: string;
    shape: SheetPdfShape;
    hasTopSlab: boolean;
    hasBaseSlab: boolean;
  },
  file: File,
): Promise<SheetPdfRecord> {
  const name = cleanName(input.name);
  assertUploadAllowed(file, { allowedExtensions: PDF_EXTENSIONS });

  const isRect = input.shape === "RECTANGULAR";
  const buffer = Buffer.from(await file.arrayBuffer());
  const id = randomUUID();
  const filePath = `${id}.pdf`;

  let row: SheetPdfRecord;
  try {
    row = await client.sheetPdf.create({
      data: {
        id,
        name,
        shape: isRect ? "RECTANGULAR" : "CIRCULAR",
        // A round sheet covers every riser/key combination: no slab choice.
        hasTopSlab: isRect && input.hasTopSlab,
        hasBaseSlab: isRect && input.hasBaseSlab,
        filePath,
        originalName: sanitizeFileName(file.name),
        fileSize: buffer.length,
      },
    });
  } catch (error) {
    if (isUniqueNameError(error)) {
      throw new Error(DUPLICATE_NAME_MESSAGE);
    }
    throw error;
  }

  try {
    const outputPath = resolveUnderRoot(filePath);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, buffer);
  } catch (error) {
    // No row without its file.
    await client.sheetPdf.delete({ where: { id } }).catch(() => undefined);
    throw error;
  }
  return row;
}

/**
 * Adds a Sheet PDF, or replaces the file of the one already carrying that
 * name. For scripts that load a batch of drawings and may be run again.
 */
export async function saveSheetPdfByName(
  client: PrismaClient,
  input: {
    name: string;
    shape: SheetPdfShape;
    hasTopSlab: boolean;
    hasBaseSlab: boolean;
  },
  file: File,
): Promise<SheetPdfRecord> {
  const existing = await client.sheetPdf.findUnique({
    where: { name: cleanName(input.name) },
  });
  if (!existing) {
    return createSheetPdf(client, input, file);
  }
  if (
    existing.shape !== input.shape ||
    existing.hasTopSlab !== input.hasTopSlab ||
    existing.hasBaseSlab !== input.hasBaseSlab
  ) {
    throw new Error(
      `A Sheet PDF named "${existing.name}" already exists and is drawn for something else.`,
    );
  }
  return replaceSheetPdfFile(client, existing.id, file);
}

/** Replaces a Sheet PDF's file in place; every template using it follows. */
export async function replaceSheetPdfFile(
  client: PrismaClient,
  id: string,
  file: File,
): Promise<SheetPdfRecord> {
  assertUploadAllowed(file, { allowedExtensions: PDF_EXTENSIONS });
  const row = await client.sheetPdf.findUnique({ where: { id } });
  if (!row) {
    throw new Error("Sheet PDF not found.");
  }

  const outputPath = resolveUnderRoot(row.filePath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(outputPath, buffer);

  return client.sheetPdf.update({
    where: { id },
    data: {
      originalName: sanitizeFileName(file.name),
      fileSize: buffer.length,
      uploadedAt: new Date(),
    },
  });
}

export async function renameSheetPdf(
  client: PrismaClient,
  id: string,
  name: string,
): Promise<void> {
  const trimmed = cleanName(name);
  try {
    await client.sheetPdf.update({ where: { id }, data: { name: trimmed } });
  } catch (error) {
    if (isUniqueNameError(error)) {
      throw new Error(DUPLICATE_NAME_MESSAGE);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new Error("Sheet PDF not found.");
    }
    throw error;
  }
}

/**
 * Deletes a Sheet PDF and its file. A sheet a template prints on stays: its
 * templates have to pick another one first.
 */
export async function deleteSheetPdf(
  client: PrismaClient,
  id: string,
): Promise<void> {
  const row = await client.sheetPdf.findUnique({
    where: { id },
    include: { _count: { select: { templates: true } } },
  });
  if (!row) {
    throw new Error("Sheet PDF not found.");
  }
  const usedBy = row._count.templates;
  if (usedBy > 0) {
    throw new Error(
      `${usedBy} template${usedBy === 1 ? " uses" : "s use"} this Sheet PDF. Pick another Sheet PDF on ${usedBy === 1 ? "that template" : "those templates"} first.`,
    );
  }

  await client.sheetPdf.delete({ where: { id } });
  try {
    await unlink(resolveUnderRoot(row.filePath));
  } catch {
    // File may already be removed from disk.
  }
}

export async function readSheetPdfBytes(
  row: Pick<SheetPdfRecord, "filePath">,
): Promise<Uint8Array> {
  const buffer = await readFile(resolveUnderRoot(row.filePath));
  return new Uint8Array(buffer);
}

/**
 * Which of the fields the app fills are in this Sheet PDF. A rectangular
 * sheet is checked against the fields its slab combination carries; a round
 * one against the round sheet's list.
 */
export async function sheetPdfFieldCoverage(
  row: Pick<SheetPdfRecord, "filePath" | "shape" | "hasTopSlab" | "hasBaseSlab">,
): Promise<TemplatePdfFieldCoverage> {
  const bytes = await readSheetPdfBytes(row);
  return listTemplatePdfFields(
    bytes,
    row.shape === "CIRCULAR"
      ? undefined // defaults to the round sheet's fields
      : rectVariantExpectedFieldNames(row.hasTopSlab, row.hasBaseSlab),
  );
}
