"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { translatePrismaError } from "@/lib/server/action-errors";
import {
  assertPdfSetMatchesShape,
  buildNestedCreate,
  parseTemplateData,
  rectPriceEntryFromPayload,
  type TemplatePayload,
} from "@/lib/structure-template-payload";
import { getDefaultPriceListId } from "@/lib/price-list-service";

function parseTemplatePayload(formData: FormData): TemplatePayload {
  const raw = String(formData.get("payload") ?? "").trim();
  if (!raw) {
    throw new Error("Missing template data.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid template data.");
  }

  return parseTemplateData(parsed as Record<string, unknown>);
}

function handlePrismaError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new Error("A structure template with that name already exists.");
  }
  throw translatePrismaError(error);
}

/**
 * Circular templates can only offer diameters with a registered mold — the
 * mold carries the wall thickness and pour limits, so an unregistered
 * diameter would be a structure the shop can't actually make.
 */
async function assertDiametersHaveMolds(payload: TemplatePayload) {
  if (payload.shape !== "CIRCULAR") {
    return;
  }
  const molds = await prisma.structureDiameterConfig.findMany({
    select: { insideDiameterFeet: true },
  });
  const moldDiameters = molds.map((mold) => Number(mold.insideDiameterFeet));
  const missing = payload.diameters.filter(
    (diameter) =>
      !moldDiameters.some(
        (moldDiameter) =>
          Math.abs(moldDiameter - diameter.insideDiameterFeet) < 1e-6,
      ),
  );
  if (missing.length > 0) {
    throw new Error(
      `No mold registered for ${missing
        .map((diameter) => `${diameter.insideDiameterFeet}'`)
        .join(", ")} inside diameter. Add the mold in Settings → Structure Molds first.`,
    );
  }
}

/** The list rect template prices save to: form's pick, else the default. */
async function resolvePriceListIdForTemplateSave(
  formData: FormData,
): Promise<string | null> {
  const requested = String(formData.get("priceListId") ?? "").trim();
  if (requested) {
    const list = await prisma.priceList.findUnique({
      where: { id: requested },
      select: { id: true },
    });
    if (list) {
      return list.id;
    }
  }
  return getDefaultPriceListId();
}

async function saveRectPriceEntry(
  tx: Prisma.TransactionClient,
  templateId: string,
  payload: TemplatePayload,
  priceListId: string | null,
) {
  if (payload.shape !== "RECTANGULAR" || !priceListId) {
    return;
  }
  const entry = rectPriceEntryFromPayload(payload);
  if (entry) {
    await tx.rectTemplatePriceListEntry.upsert({
      where: { priceListId_templateId: { priceListId, templateId } },
      create: { priceListId, templateId, ...entry },
      update: entry,
    });
  } else {
    await tx.rectTemplatePriceListEntry.deleteMany({
      where: { priceListId, templateId },
    });
  }
}

export async function createStructureTemplate(formData: FormData) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const payload = parseTemplatePayload(formData);
  await assertPdfSetMatchesShape(payload);
  await assertDiametersHaveMolds(payload);
  const priceListId = await resolvePriceListIdForTemplateSave(formData);

  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.structureTemplate.create({
        data: buildNestedCreate(payload),
      });
      await saveRectPriceEntry(tx, created.id, payload, priceListId);
    });
  } catch (error) {
    handlePrismaError(error);
  }

  revalidatePath("/structures");
  redirect("/structures");
}

export async function updateStructureTemplate(
  templateId: string,
  formData: FormData,
) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const payload = parseTemplatePayload(formData);
  await assertPdfSetMatchesShape(payload);
  await assertDiametersHaveMolds(payload);
  const priceListId = await resolvePriceListIdForTemplateSave(formData);
  const expectedUpdatedAtRaw = String(
    formData.get("expectedUpdatedAt") ?? "",
  ).trim();

  try {
    await prisma.$transaction(async (tx) => {
      if (expectedUpdatedAtRaw) {
        // Diameters are replaced wholesale below, so a stale save would
        // silently discard another admin's edits (optimistic concurrency).
        const current = await tx.structureTemplate.findUnique({
          where: { id: templateId },
          select: { updatedAt: true },
        });
        const expected = new Date(expectedUpdatedAtRaw);
        if (
          !current ||
          Number.isNaN(expected.getTime()) ||
          current.updatedAt.getTime() !== expected.getTime()
        ) {
          throw new Error(
            "This template was changed by someone else while you were editing. Refresh the page to load the latest version, then re-apply your changes.",
          );
        }
      }

      await tx.structureTemplateDiameter.deleteMany({
        where: { templateId },
      });
      await tx.structureTemplateRectSize.deleteMany({
        where: { templateId },
      });

      const nested = buildNestedCreate(payload);
      await tx.structureTemplate.update({
        where: { id: templateId },
        data: {
          name: nested.name,
          agencyStandard: nested.agencyStandard,
          shape: nested.shape,
          wallThicknessInches: nested.wallThicknessInches,
          baseSlabThicknessInches: nested.baseSlabThicknessInches,
          topSlabThicknessInches: nested.topSlabThicknessInches,
          castingProductId: nested.castingProductId,
          minimumBrickInches: nested.minimumBrickInches,
          connectionType: nested.connectionType,
          sumpMode: nested.sumpMode,
          sumpFixedInches: nested.sumpFixedInches,
          openingToJointMinTopInches: nested.openingToJointMinTopInches,
          openingToJointMinBottomInches: nested.openingToJointMinBottomInches,
          topSlabOpeningInches: nested.topSlabOpeningInches,
          rectMinPricingHeightFeet: nested.rectMinPricingHeightFeet,
          rectPdfSetId: nested.rectPdfSetId,
          status: nested.status,
          notes: nested.notes,
          diameters: nested.diameters,
          rectSizes: nested.rectSizes,
        },
      });
      await saveRectPriceEntry(tx, templateId, payload, priceListId);
    });
  } catch (error) {
    handlePrismaError(error);
  }

  revalidatePath("/structures");
  revalidatePath(`/structures/${templateId}`);
  redirect("/structures");
}

/**
 * Deep-copy a template under a unique "(Copy)" name: scalars, offered
 * diameters / rect footprint, and per-price-list rect prices. The shared
 * Sheet PDF Set and casting product carry over by reference; legacy
 * per-template PDF uploads (dormant) are not copied.
 */
export async function duplicateStructureTemplate(templateId: string) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);

  let newTemplateId = "";
  try {
    newTemplateId = await prisma.$transaction(async (tx) => {
      const source = await tx.structureTemplate.findUnique({
        where: { id: templateId },
        include: {
          diameters: { orderBy: { sortOrder: "asc" } },
          rectSizes: { orderBy: { sortOrder: "asc" } },
          rectPriceEntries: true,
        },
      });
      if (!source) {
        throw new Error("Template not found.");
      }

      let name = `${source.name} (Copy)`;
      for (
        let attempt = 2;
        await tx.structureTemplate.findUnique({
          where: { name },
          select: { id: true },
        });
        attempt += 1
      ) {
        name = `${source.name} (Copy ${attempt})`;
      }

      const created = await tx.structureTemplate.create({
        data: {
          name,
          agencyStandard: source.agencyStandard,
          shape: source.shape,
          wallThicknessInches: source.wallThicknessInches,
          baseSlabThicknessInches: source.baseSlabThicknessInches,
          topSlabThicknessInches: source.topSlabThicknessInches,
          castingProductId: source.castingProductId,
          minimumBrickInches: source.minimumBrickInches,
          connectionType: source.connectionType,
          sumpMode: source.sumpMode,
          sumpFixedInches: source.sumpFixedInches,
          openingToJointMinTopInches: source.openingToJointMinTopInches,
          openingToJointMinBottomInches: source.openingToJointMinBottomInches,
          topSlabOpeningInches: source.topSlabOpeningInches,
          rectMinPricingHeightFeet: source.rectMinPricingHeightFeet,
          rectPdfSetId: source.rectPdfSetId,
          status: source.status,
          notes: source.notes,
          diameters: {
            create: source.diameters.map((diameter) => ({
              insideDiameterFeet: diameter.insideDiameterFeet,
              sortOrder: diameter.sortOrder,
            })),
          },
          rectSizes: {
            create: source.rectSizes.map((size) => ({
              insideLengthInches: size.insideLengthInches,
              insideWidthInches: size.insideWidthInches,
              sortOrder: size.sortOrder,
            })),
          },
          rectPriceEntries: {
            create: source.rectPriceEntries.map((entry) => ({
              priceListId: entry.priceListId,
              wallPricePerFoot: entry.wallPricePerFoot,
              topSlabPrice: entry.topSlabPrice,
              baseSlabPrice: entry.baseSlabPrice,
            })),
          },
        },
        select: { id: true },
      });
      return created.id;
    });
  } catch (error) {
    handlePrismaError(error);
  }

  revalidatePath("/structures");
  redirect(`/structures/${newTemplateId}`);
}

export async function deleteStructureTemplate(templateId: string) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);

  await prisma.structureTemplate
    .delete({ where: { id: templateId } })
    .catch((error) => {
      throw translatePrismaError(error);
    });

  revalidatePath("/structures");
  redirect("/structures");
}

export async function loadCastingProductOptions() {
  await requirePermission(AppPermission.STRUCTURES_VIEW);
  const products = await prisma.product.findMany({
    where: { isCasting: true, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, heightFeet: true },
  });
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    heightFeet: p.heightFeet ? Number(p.heightFeet) : null,
  }));
}
