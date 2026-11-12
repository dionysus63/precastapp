"use server";

import { revalidatePath } from "next/cache";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import type { ActionError } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { returnActionError } from "@/lib/server/action-errors";
import {
  createSheetPdf,
  deleteSheetPdf,
  renameSheetPdf,
  replaceSheetPdfFile,
} from "@/lib/sheet-pdf-service";

function parseBooleanField(value: FormDataEntryValue | null): boolean {
  return value === "true" || value === "1" || value === "on";
}

function revalidate() {
  revalidatePath("/structures");
  revalidatePath("/structures/sheet-pdfs");
}

// Every action below reports failures as `{ error }` (see returnActionError).

/** Adds a Sheet PDF from the "Add Sheet PDF" form (name, kind, slabs, file). */
export async function createSheetPdfAction(
  formData: FormData,
): Promise<void | ActionError> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  return returnActionError(async () => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Choose the PDF file to add.");
    }
    await createSheetPdf(
      prisma,
      {
        name: String(formData.get("name") ?? ""),
        shape: formData.get("shape") === "CIRCULAR" ? "CIRCULAR" : "RECTANGULAR",
        hasTopSlab: parseBooleanField(formData.get("hasTopSlab")),
        hasBaseSlab: parseBooleanField(formData.get("hasBaseSlab")),
      },
      file,
    );
    revalidate();
  });
}

/** Swaps the file behind a Sheet PDF; its name, kind and templates stay. */
export async function replaceSheetPdfFileAction(
  formData: FormData,
): Promise<void | ActionError> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  return returnActionError(async () => {
    const id = String(formData.get("id") ?? "").trim();
    const file = formData.get("file");
    if (!id) {
      throw new Error("Sheet PDF not found.");
    }
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Choose the PDF file to replace it with.");
    }
    await replaceSheetPdfFile(prisma, id, file);
    revalidate();
  });
}

export async function renameSheetPdfAction(
  id: string,
  name: string,
): Promise<void | ActionError> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  return returnActionError(async () => {
    await renameSheetPdf(prisma, id, name);
    revalidate();
  });
}

export async function deleteSheetPdfAction(
  id: string,
): Promise<void | ActionError> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  return returnActionError(async () => {
    await deleteSheetPdf(prisma, id);
    revalidate();
  });
}
