"use server";

import { revalidatePath } from "next/cache";
import { AppPermission, Prisma } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import {
  listTemplatePdfFields,
  type TemplatePdfFieldCoverage,
} from "@/lib/drill-sheet-template-pdf";
import {
  deleteRectPdfSetFile,
  readRectPdfSetFileBytes,
  saveRectPdfSetFile,
} from "@/lib/rect-pdf-set-service";
import { rectVariantExpectedFieldNames } from "@/lib/rect-template-pdf-fields";
import { prisma } from "@/lib/prisma";
import { translatePrismaError } from "@/lib/server/action-errors";

function parseBooleanField(value: FormDataEntryValue | null): boolean {
  return value === "true" || value === "1" || value === "on";
}

function revalidate() {
  revalidatePath("/structures");
  revalidatePath("/structures/sheet-pdfs");
}

export async function createSheetPdfSetAction(
  name: string,
  shape: "CIRCULAR" | "RECTANGULAR",
): Promise<void> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Set name is required.");
  }
  const normalizedShape = shape === "CIRCULAR" ? "CIRCULAR" : "RECTANGULAR";
  try {
    await prisma.rectSheetPdfSet.create({
      data: { name: trimmed, shape: normalizedShape },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("A PDF set with that name already exists.");
    }
    throw translatePrismaError(error);
  }
  revalidate();
}

export async function renameSheetPdfSetAction(
  id: string,
  name: string,
): Promise<void> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Set name is required.");
  }
  await prisma.rectSheetPdfSet
    .update({ where: { id }, data: { name: trimmed } })
    .catch((error) => {
      throw translatePrismaError(error);
    });
  revalidate();
}

export async function deleteSheetPdfSetAction(id: string): Promise<void> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);

  const usedBy = await prisma.structureTemplate.count({
    where: { rectPdfSetId: id },
  });
  if (usedBy > 0) {
    throw new Error(
      `This set is assigned to ${usedBy} template${usedBy === 1 ? "" : "s"}. Reassign them first.`,
    );
  }

  const files = await prisma.rectSheetPdfSetFile.findMany({
    where: { setId: id },
    select: { id: true },
  });
  for (const file of files) {
    await deleteRectPdfSetFile(prisma, file.id);
  }
  await prisma.rectSheetPdfSet.delete({ where: { id } }).catch((error) => {
    throw translatePrismaError(error);
  });
  revalidate();
}

export async function uploadSheetPdfSetFileAction(
  formData: FormData,
): Promise<{ coverage: TemplatePdfFieldCoverage }> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);

  const setId = String(formData.get("setId") ?? "").trim();
  const file = formData.get("file");

  if (!setId) {
    throw new Error("Set id is required.");
  }
  if (!(file instanceof File)) {
    throw new Error("A PDF file is required.");
  }

  const set = await prisma.rectSheetPdfSet.findUnique({
    where: { id: setId },
    select: { shape: true },
  });
  if (!set) {
    throw new Error("PDF set not found.");
  }

  // Circular sets hold a single sheet (one PDF covers every riser/key
  // combination), stored under the {false,false} slot; rectangular sets use
  // the four slab-variant slots posted by the form.
  const isCircular = set.shape === "CIRCULAR";
  const hasTopSlab = isCircular
    ? false
    : parseBooleanField(formData.get("hasTopSlab"));
  const hasBaseSlab = isCircular
    ? false
    : parseBooleanField(formData.get("hasBaseSlab"));

  const row = await saveRectPdfSetFile(
    prisma,
    setId,
    { hasTopSlab, hasBaseSlab },
    file,
  );
  const bytes = await readRectPdfSetFileBytes(row);
  const coverage = await listTemplatePdfFields(
    bytes,
    isCircular
      ? undefined // defaults to the circular sheet convention
      : rectVariantExpectedFieldNames(hasTopSlab, hasBaseSlab),
  );

  revalidate();
  return { coverage };
}

export async function deleteSheetPdfSetFileAction(id: string): Promise<void> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  await deleteRectPdfSetFile(prisma, id);
  revalidate();
}
