"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  buildCalcData,
  buildCastingCreate,
  buildOpeningsCreate,
  buildSectionsCreate,
  createJobStructureFromPayload,
  loadAndComputeDrillSheet,
  parseDrillSheetPayload,
} from "@/lib/drill-sheet-persistence";
import {
  createRectJobStructureFromPayload,
  parseRectSheetPayload,
  updateRectJobStructureFromPayload,
} from "@/lib/rect-sheet-persistence";

export async function createDrillSheet(formData: FormData) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const payload = parseDrillSheetPayload(formData);

  const createdId = await createJobStructureFromPayload(payload, {
    jobId: payload.jobId,
    structureNumber: payload.manholeNumber || null,
  });

  revalidatePath("/drill-sheets");
  redirect(`/drill-sheets/${createdId}`);
}

export async function updateDrillSheet(
  drillSheetId: string,
  formData: FormData,
) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const payload = parseDrillSheetPayload(formData);
  const expectedUpdatedAtRaw = String(
    formData.get("expectedUpdatedAt") ?? "",
  ).trim();

  const existing = await prisma.jobStructure.findUnique({
    where: { id: drillSheetId },
    select: { id: true, calc: { select: { id: true } } },
  });
  if (!existing) {
    throw new Error("Drill sheet not found.");
  }

  const { template, insideDiameterFeet, casting, result, pricing } =
    await loadAndComputeDrillSheet(payload);
  const calcData = buildCalcData(payload, result, insideDiameterFeet, pricing);
  const castingCreate = buildCastingCreate(casting);

  await prisma.$transaction(async (tx) => {
    if (expectedUpdatedAtRaw) {
      const current = await tx.jobStructure.findUnique({
        where: { id: drillSheetId },
        select: { updatedAt: true },
      });
      const expected = new Date(expectedUpdatedAtRaw);
      if (
        !current ||
        Number.isNaN(expected.getTime()) ||
        current.updatedAt.getTime() !== expected.getTime()
      ) {
        throw new Error(
          "This drill sheet was changed by someone else while you were editing. Refresh the page to load the latest version, then re-apply your changes.",
        );
      }
    }

    await tx.jobStructure.update({
      where: { id: drillSheetId },
      data: {
        structureTemplateId: template.id,
        jobId: payload.jobId ?? null,
        structureNumber: payload.manholeNumber || null,
        description: `${insideDiameterFeet}' ${template.name}`,
        calc: existing.calc
          ? { update: calcData }
          : { create: calcData },
        openings: { deleteMany: {}, create: buildOpeningsCreate(result) },
        sections: { deleteMany: {}, create: buildSectionsCreate(result) },
        castings: castingCreate
          ? { deleteMany: {}, create: castingCreate }
          : { deleteMany: {} },
      },
    });
  });

  revalidatePath("/drill-sheets");
  revalidatePath(`/drill-sheets/${drillSheetId}`);
  revalidatePath(`/drill-sheets/${drillSheetId}/edit`);
  redirect(`/drill-sheets/${drillSheetId}`);
}

export async function createRectSheet(formData: FormData) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const payload = parseRectSheetPayload(formData);

  const createdId = await createRectJobStructureFromPayload(payload);

  revalidatePath("/drill-sheets");
  redirect(`/drill-sheets/${createdId}`);
}

export async function updateRectSheet(
  jobStructureId: string,
  formData: FormData,
) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
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

export async function deleteDrillSheet(drillSheetId: string) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  await prisma.jobStructure.delete({ where: { id: drillSheetId } });
  revalidatePath("/drill-sheets");
  redirect("/drill-sheets");
}
