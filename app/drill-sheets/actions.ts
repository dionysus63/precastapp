"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  computeDrillSheet,
  type DrillSheetInput,
  type DrillSheetResult,
} from "@/lib/drill-sheet";
import { angleToClockPosition } from "@/lib/drill-sheet-diagram";

type OpeningPayload = {
  label: string;
  pipeType: string;
  pipeDiameterInches: string;
  invertElevation: string;
  hasBoot: boolean;
  angle: string;
};

type DrillSheetPayload = {
  templateId: string;
  diameterId: string;
  castingProductId: string | null;
  jobId: string | null;
  manholeNumber: string;
  contractor: string;
  project: string;
  date: string;
  hasSteps: boolean;
  rimElevation: string;
  hasKeyOverride: boolean | null;
  brickAdjustmentOverrideFeet: string;
  openings: OpeningPayload[];
};

function decimal(value: number | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  return new Prisma.Decimal(String(value));
}

function parseNum(value: string | null | undefined): number | null {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parsePayload(formData: FormData): DrillSheetPayload {
  const raw = String(formData.get("payload") ?? "").trim();
  if (!raw) {
    throw new Error("Missing drill sheet data.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid drill sheet data.");
  }
  const data = parsed as Record<string, unknown>;

  const templateId = String(data.templateId ?? "").trim();
  const diameterId = String(data.diameterId ?? "").trim();
  if (!templateId || !diameterId) {
    throw new Error("A template and diameter are required.");
  }

  const openingsRaw = Array.isArray(data.openings) ? data.openings : [];
  const openings: OpeningPayload[] = openingsRaw.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      label: String(row.label ?? "").trim(),
      pipeType: String(row.pipeType ?? "").trim(),
      pipeDiameterInches: String(row.pipeDiameterInches ?? "").trim(),
      invertElevation: String(row.invertElevation ?? "").trim(),
      hasBoot: row.hasBoot !== false,
      angle: String(row.angle ?? "").trim(),
    };
  });

  return {
    templateId,
    diameterId,
    castingProductId: data.castingProductId
      ? String(data.castingProductId)
      : null,
    jobId: data.jobId ? String(data.jobId) : null,
    manholeNumber: String(data.manholeNumber ?? "").trim(),
    contractor: String(data.contractor ?? "").trim(),
    project: String(data.project ?? "").trim(),
    date: String(data.date ?? "").trim(),
    hasSteps: data.hasSteps === true,
    rimElevation: String(data.rimElevation ?? "").trim(),
    hasKeyOverride:
      data.hasKeyOverride === true
        ? true
        : data.hasKeyOverride === false
          ? false
          : null,
    brickAdjustmentOverrideFeet: String(
      data.brickAdjustmentOverrideFeet ?? "",
    ).trim(),
    openings,
  };
}

type LoadedDrillSheet = {
  template: { id: string; name: string; agencyStandard: string | null };
  insideDiameterFeet: number;
  casting: { id: string; name: string } | null;
  result: DrillSheetResult;
};

async function loadAndCompute(
  payload: DrillSheetPayload,
): Promise<LoadedDrillSheet> {
  const template = await prisma.structureTemplate.findUnique({
    where: { id: payload.templateId },
    include: {
      bootSizes: true,
      diameters: {
        where: { id: payload.diameterId },
        include: { sections: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  if (!template) {
    throw new Error("Structure template not found.");
  }
  const diameter = template.diameters[0];
  if (!diameter) {
    throw new Error("Selected diameter not found on the template.");
  }

  let casting: { id: string; name: string; heightFeet: number | null } | null =
    null;
  if (payload.castingProductId) {
    const product = await prisma.product.findUnique({
      where: { id: payload.castingProductId },
      select: { id: true, name: true, heightFeet: true },
    });
    if (product) {
      casting = {
        id: product.id,
        name: product.name,
        heightFeet: product.heightFeet ? Number(product.heightFeet) : null,
      };
    }
  }

  const input: DrillSheetInput = {
    rimElevation: parseNum(payload.rimElevation),
    castingHeightFeet: casting?.heightFeet ?? 0,
    diameter: {
      insideDiameterFeet: Number(diameter.insideDiameterFeet),
      moldMaxHeightFeet: Number(diameter.moldMaxHeightFeet),
      topSlabHeightWithKeyFeet:
        diameter.topSlabHeightWithKeyFeet === null
          ? null
          : Number(diameter.topSlabHeightWithKeyFeet),
      topSlabHeightNoKeyFeet:
        diameter.topSlabHeightNoKeyFeet === null
          ? null
          : Number(diameter.topSlabHeightNoKeyFeet),
      sections: diameter.sections.map((section) => ({
        role: section.role as "BASE" | "RISER",
        heightFeet: Number(section.heightFeet),
        label: section.label,
      })),
    },
    template: {
      minimumBrickFeet: Number(template.minimumBrickFeet),
      keyClearanceFeet: Number(template.keyClearanceFeet),
      bootSizes: template.bootSizes.map((boot) => ({
        pipeDiameterInches: Number(boot.pipeDiameterInches),
        holeDiameterInches: Number(boot.holeDiameterInches),
      })),
    },
    openings: payload.openings.map((opening) => ({
      label: opening.label,
      pipeType: opening.pipeType,
      pipeDiameterInches: parseNum(opening.pipeDiameterInches),
      invertElevation: parseNum(opening.invertElevation),
      hasBoot: opening.hasBoot,
      angleDegrees: parseNum(opening.angle),
    })),
    hasKeyOverride: payload.hasKeyOverride,
    brickAdjustmentOverrideFeet: parseNum(payload.brickAdjustmentOverrideFeet),
  };

  return {
    template,
    insideDiameterFeet: Number(diameter.insideDiameterFeet),
    casting: casting ? { id: casting.id, name: casting.name } : null,
    result: computeDrillSheet(input),
  };
}

function buildManholeDetailData(
  template: { agencyStandard: string | null },
  payload: DrillSheetPayload,
  result: DrillSheetResult,
  insideDiameterFeet: number,
) {
  const sheetDate = payload.date ? new Date(`${payload.date}T00:00:00`) : null;
  return {
    manholeStandard: template.agencyStandard,
    contractorName: payload.contractor || null,
    projectName: payload.project || null,
    sheetDate,
    hasSteps: payload.hasSteps,
    rimElevation: decimal(result.rimElevation),
    lowestInvertElevation: decimal(result.lowInvertElevation),
    requiredWallHeight: decimal(result.wallHeightFeet),
    invertToTopFeet: decimal(result.invertToTopFeet),
    castingHeightFeet: decimal(result.castingHeightFeet),
    topSlabHeightFeet: decimal(result.topSlabHeightFeet),
    sumpFeet: decimal(result.sumpFeet),
    brickAdjustmentFeet: decimal(result.brickAdjustmentFeet),
    hasKey: result.hasKey,
    insideDiameter: decimal(insideDiameterFeet),
  };
}

function buildOpeningsCreate(result: DrillSheetResult) {
  return result.openings.map((opening, index) => {
    const angleDeg = opening.isLowInvert ? 0 : (opening.angleDegrees ?? 0);
    return {
      openingNumber: index + 1,
      wallLocation: opening.label || String.fromCharCode(65 + index),
      clockPosition: angleToClockPosition(angleDeg),
      pipeType: opening.pipeType || null,
      pipeDiameter: decimal(opening.pipeDiameterInches),
      invertElevation: decimal(opening.invertElevation),
      holeDiameter: decimal(opening.holeDiameterInches),
      bootType: opening.hasBoot ? "Kor-N-Seal" : null,
      angle: decimal(angleDeg),
    };
  });
}

function buildSectionsCreate(result: DrillSheetResult) {
  return result.sections.map((section, index) => ({
    role: section.role,
    heightFeet: new Prisma.Decimal(String(section.heightFeet)),
    label: section.label ?? null,
    sortOrder: index,
  }));
}

function buildCastingCreate(casting: { id: string; name: string } | null) {
  if (!casting) {
    return undefined;
  }
  return {
    castingProductId: casting.id,
    castingDescription: casting.name,
    quantity: new Prisma.Decimal("1"),
  };
}

export async function createDrillSheet(formData: FormData) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const payload = parsePayload(formData);

  const { template, insideDiameterFeet, casting, result } =
    await loadAndCompute(payload);
  const castingCreate = buildCastingCreate(casting);

  const created = await prisma.jobStructure.create({
    data: {
      structureType: "CONFIGURABLE_PRODUCT",
      structureTemplateId: template.id,
      jobId: payload.jobId ?? undefined,
      structureNumber: payload.manholeNumber || null,
      description: `${insideDiameterFeet}' ${template.name}`,
      quantity: new Prisma.Decimal("1"),
      unit: "EA",
      manholeDetail: {
        create: buildManholeDetailData(
          template,
          payload,
          result,
          insideDiameterFeet,
        ),
      },
      openings: { create: buildOpeningsCreate(result) },
      sections: { create: buildSectionsCreate(result) },
      castings: castingCreate ? { create: castingCreate } : undefined,
    },
  });

  revalidatePath("/drill-sheets");
  redirect(`/drill-sheets/${created.id}`);
}

export async function updateDrillSheet(
  drillSheetId: string,
  formData: FormData,
) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const payload = parsePayload(formData);

  const existing = await prisma.jobStructure.findUnique({
    where: { id: drillSheetId },
    select: { id: true, manholeDetail: { select: { id: true } } },
  });
  if (!existing) {
    throw new Error("Drill sheet not found.");
  }

  const { template, insideDiameterFeet, casting, result } =
    await loadAndCompute(payload);
  const manholeData = buildManholeDetailData(
    template,
    payload,
    result,
    insideDiameterFeet,
  );
  const castingCreate = buildCastingCreate(casting);

  await prisma.jobStructure.update({
    where: { id: drillSheetId },
    data: {
      structureTemplateId: template.id,
      jobId: payload.jobId ?? null,
      structureNumber: payload.manholeNumber || null,
      description: `${insideDiameterFeet}' ${template.name}`,
      manholeDetail: existing.manholeDetail
        ? { update: manholeData }
        : { create: manholeData },
      openings: { deleteMany: {}, create: buildOpeningsCreate(result) },
      sections: { deleteMany: {}, create: buildSectionsCreate(result) },
      castings: castingCreate
        ? { deleteMany: {}, create: castingCreate }
        : { deleteMany: {} },
    },
  });

  revalidatePath("/drill-sheets");
  revalidatePath(`/drill-sheets/${drillSheetId}`);
  revalidatePath(`/drill-sheets/${drillSheetId}/edit`);
  redirect(`/drill-sheets/${drillSheetId}`);
}

export async function deleteDrillSheet(drillSheetId: string) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  await prisma.jobStructure.delete({ where: { id: drillSheetId } });
  revalidatePath("/drill-sheets");
  redirect("/drill-sheets");
}
