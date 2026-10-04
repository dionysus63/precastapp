"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  returnActionError,
  translatePrismaError,
} from "@/lib/server/action-errors";
import { findJobStructureDeleteBlockers } from "@/lib/job-structure-workflow";
import {
  createJobStructureFromPayload,
  parseDrillSheetPayload,
  updateJobStructureFromPayload,
} from "@/lib/drill-sheet-persistence";
import {
  createRectJobStructureFromPayload,
  parseRectSheetPayload,
  updateRectJobStructureFromPayload,
} from "@/lib/rect-sheet-persistence";

// The save actions below report failures as `{ error }` (see
// returnActionError) and redirect on success.

export async function createDrillSheet(formData: FormData) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  return returnActionError(async () => {
    const payload = parseDrillSheetPayload(formData);

    const createdId = await createJobStructureFromPayload(payload, {
      jobId: payload.jobId,
      structureNumber: payload.manholeNumber || null,
    });

    revalidatePath("/drill-sheets");
    redirect(`/drill-sheets/${createdId}`);
  });
}

export async function updateDrillSheet(
  drillSheetId: string,
  formData: FormData,
) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  return returnActionError(async () => {
    const payload = parseDrillSheetPayload(formData);
    const expectedUpdatedAtRaw = String(
      formData.get("expectedUpdatedAt") ?? "",
    ).trim();

    await updateJobStructureFromPayload(
      drillSheetId,
      payload,
      expectedUpdatedAtRaw,
    );

    revalidatePath("/drill-sheets");
    revalidatePath(`/drill-sheets/${drillSheetId}`);
    revalidatePath(`/drill-sheets/${drillSheetId}/edit`);
    redirect(`/drill-sheets/${drillSheetId}`);
  });
}

export async function createRectSheet(formData: FormData) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  return returnActionError(async () => {
    const payload = parseRectSheetPayload(formData);

    const createdId = await createRectJobStructureFromPayload(payload);

    revalidatePath("/drill-sheets");
    redirect(`/drill-sheets/${createdId}`);
  });
}

export async function updateRectSheet(
  jobStructureId: string,
  formData: FormData,
) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  return returnActionError(async () => {
    const payload = parseRectSheetPayload(formData);
    const expectedUpdatedAtRaw = String(
      formData.get("expectedUpdatedAt") ?? "",
    ).trim();

    await updateRectJobStructureFromPayload(
      jobStructureId,
      payload,
      expectedUpdatedAtRaw,
    );

    revalidatePath("/drill-sheets");
    revalidatePath(`/drill-sheets/${jobStructureId}`);
    revalidatePath(`/drill-sheets/rect/${jobStructureId}/edit`);
    redirect(`/drill-sheets/${jobStructureId}`);
  });
}

/**
 * Complete the drill sheet for a quote-only placeholder structure. Upgrades
 * the existing JobStructure in place so its quote-line link, status,
 * quantity, and documents survive.
 */
export async function upgradeRectSheetFromPlaceholder(
  jobStructureId: string,
  formData: FormData,
) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  return returnActionError(() =>
    upgradeRectSheetFromPlaceholderOrThrow(jobStructureId, formData),
  );
}

async function upgradeRectSheetFromPlaceholderOrThrow(
  jobStructureId: string,
  formData: FormData,
) {
  const payload = parseRectSheetPayload(formData);
  const expectedUpdatedAtRaw = String(
    formData.get("expectedUpdatedAt") ?? "",
  ).trim();

  const existing = await prisma.jobStructure.findUnique({
    where: { id: jobStructureId },
    select: { jobId: true, quoteId: true, structureTemplateId: true },
  });
  if (!existing) {
    throw new Error("Structure was not found.");
  }
  if (existing.structureTemplateId) {
    throw new Error(
      "This structure already has a drill sheet. Edit it from the Drill Sheet Workbook instead.",
    );
  }

  await updateRectJobStructureFromPayload(
    jobStructureId,
    payload,
    expectedUpdatedAtRaw,
  );

  revalidatePath("/drill-sheets");
  revalidatePath(`/drill-sheets/${jobStructureId}`);
  revalidatePath("/production");
  if (existing.jobId) {
    revalidatePath(`/jobs/${existing.jobId}`);
    revalidatePath(`/jobs/${existing.jobId}/structures/${jobStructureId}`);
  }
  if (existing.quoteId) {
    revalidatePath(`/quotes/${existing.quoteId}`);
  }
  redirect(`/drill-sheets/${jobStructureId}`);
}

export async function deleteDrillSheet(
  drillSheetId: string,
): Promise<{ error: string } | void> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);

  // A drill sheet IS its job structure, so this uses the same guard as the
  // job's bulk structure delete.
  let blockers: string[];
  try {
    blockers = await prisma.$transaction(async (tx) => {
      const found = await findJobStructureDeleteBlockers(tx, [drillSheetId]);
      if (found.length === 0) {
        await tx.jobStructure.delete({ where: { id: drillSheetId } });
      }
      return found;
    });
  } catch (error) {
    return { error: translatePrismaError(error).message };
  }
  if (blockers.length > 0) {
    return {
      error: `This structure can't be deleted: ${blockers.join("; ")}. Its production and delivery records depend on it.`,
    };
  }

  revalidatePath("/drill-sheets");
  revalidatePath("/production");
  redirect("/drill-sheets");
}
