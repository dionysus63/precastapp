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
  type PipeConnectionType,
} from "@/lib/drill-sheet";

type OpeningPayload = {
  label: string;
  pipeMaterial: string;
  pipeSizeInches: string;
  pipeType: string;
  invertElevation: string;
  angle: string;
  connectionType: PipeConnectionType | "";
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
      pipeMaterial: String(row.pipeMaterial ?? "").trim(),
      pipeSizeInches: String(row.pipeSizeInches ?? "").trim(),
      pipeType: String(row.pipeType ?? "").trim(),
      invertElevation: String(row.invertElevation ?? "").trim(),
      angle: String(row.angle ?? "").trim(),
      connectionType: String(row.connectionType ?? "") as PipeConnectionType | "",
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
  const [template, pipeOpeningSizes, diameterConfigs] = await Promise.all([
    prisma.structureTemplate.findUnique({
      where: { id: payload.templateId },
      include: {
        diameters: { where: { id: payload.diameterId } },
      },
    }),
    prisma.pipeOpeningSize.findMany(),
    prisma.structureDiameterConfig.findMany(),
  ]);

  if (!template) {
    throw new Error("Structure template not found.");
  }
  const diameter = template.diameters[0];
  if (!diameter) {
    throw new Error("Selected diameter not found on the template.");
  }

  const insideDiameterFeet = Number(diameter.insideDiameterFeet);
  const diameterConfig = diameterConfigs.find(
    (config) =>
      Math.abs(Number(config.insideDiameterFeet) - insideDiameterFeet) < 1e-6,
  );
  if (!diameterConfig) {
    throw new Error(
      `No diameter configuration found for ${insideDiameterFeet}'. Add it in Settings → Structure Diameters.`,
    );
  }

  let casting: { id: string; name: string; heightFeet: number | null } | null =
    null;
  const castingId =
    payload.castingProductId ?? template.castingProductId ?? null;
  if (castingId) {
    const product = await prisma.product.findUnique({
      where: { id: castingId },
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
      insideDiameterFeet,
      maxBaseHeightFeet: Number(diameterConfig.maxBaseHeightFeet),
      maxRiserHeightFeet: Number(diameterConfig.maxRiserHeightFeet),
      keyHeightFeet: Number(diameterConfig.keyHeightFeet),
      wallPricePerFoot: Number(diameterConfig.wallPricePerFoot),
      basePrice: Number(diameterConfig.basePrice),
    },
    template: {
      wallThicknessInches: Number(template.wallThicknessInches),
      baseSlabThicknessInches: Number(template.baseSlabThicknessInches),
      topSlabThicknessInches: Number(template.topSlabThicknessInches),
      minimumBrickInches: Number(template.minimumBrickInches),
      connectionType: template.connectionType,
      sumpMode: template.sumpMode,
      sumpFixedInches:
        template.sumpFixedInches != null
          ? Number(template.sumpFixedInches)
          : null,
      openingToJointMinTopInches: Number(template.openingToJointMinTopInches),
      openingToJointMinBottomInches: Number(
        template.openingToJointMinBottomInches,
      ),
    },
    pipeOpeningSizes: pipeOpeningSizes.map((entry) => ({
      pipeMaterial: entry.pipeMaterial,
      pipeSizeInches: Number(entry.pipeSizeInches),
      pipeType: entry.pipeType,
      holeDiameterInches: Number(entry.holeDiameterInches),
      bootModel: entry.bootModel,
      pricePerBoot:
        entry.pricePerBoot != null ? Number(entry.pricePerBoot) : null,
    })),
    openings: payload.openings.map((opening) => ({
      label: opening.label,
      pipeMaterial: opening.pipeMaterial,
      pipeSizeInches: parseNum(opening.pipeSizeInches),
      pipeType: opening.pipeType,
      invertElevation: parseNum(opening.invertElevation),
      angleDegrees: parseNum(opening.angle),
      connectionType: opening.connectionType || null,
    })),
  };

  return {
    template,
    insideDiameterFeet,
    casting: casting ? { id: casting.id, name: casting.name } : null,
    result: computeDrillSheet(input),
  };
}

function buildCalcData(
  payload: DrillSheetPayload,
  result: DrillSheetResult,
  insideDiameterFeet: number,
) {
  const sheetDate = payload.date ? new Date(`${payload.date}T00:00:00`) : null;
  return {
    contractorName: payload.contractor || null,
    projectName: payload.project || null,
    sheetDate,
    hasSteps: payload.hasSteps,
    rimElevation: decimal(result.rimElevation),
    lowestInvertFeet: decimal(result.lowInvertElevation),
    sumpFeet: decimal(result.sumpFeet),
    castingHeightFeet: decimal(result.castingHeightFeet),
    topSlabThicknessFeet: decimal(result.topSlabThicknessFeet),
    wallHeightFeet: decimal(result.wallHeightFeet),
    brickFeet: decimal(result.brickFeet),
    hasKey: result.hasKey,
    totalHeightFeet: decimal(result.totalHeightFeet),
    insideDiameterFeet: decimal(insideDiameterFeet),
    baseSlabThicknessFeet: decimal(result.baseSlabThicknessFeet),
    wallPrice: decimal(result.wallPrice),
    bootsPrice: decimal(result.bootsPrice),
    totalPrice: decimal(result.totalPrice),
    errorMessage: result.errorMessage,
  };
}

function buildOpeningsCreate(result: DrillSheetResult) {
  return result.openings.map((opening, index) => ({
    openingNumber: index + 1,
    label: opening.label || String.fromCharCode(65 + index),
    invertElevation: decimal(opening.invertElevation),
    pipeSizeInches: decimal(opening.pipeSizeInches),
    pipeMaterial: opening.pipeMaterial || null,
    pipeType: opening.pipeType || null,
    angle: decimal(opening.isLowInvert ? 0 : (opening.angleDegrees ?? 0)),
    connectionType: opening.connectionType ?? null,
    holeDiameterInches: decimal(opening.holeDiameterInches),
    bootModel: opening.bootModel,
    topOfPipeFeet: decimal(opening.topOfPipeFeet),
    bottomOfOpeningFeet: decimal(opening.bottomOfOpeningFeet),
    topOfOpeningFeet: decimal(opening.topOfOpeningFeet),
    baseTopToOpeningBottomInches: opening.baseTopToOpeningBottomInches,
    pricePerBoot: decimal(opening.pricePerBoot),
  }));
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
      calc: {
        create: buildCalcData(payload, result, insideDiameterFeet),
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
    select: { id: true, calc: { select: { id: true } } },
  });
  if (!existing) {
    throw new Error("Drill sheet not found.");
  }

  const { template, insideDiameterFeet, casting, result } =
    await loadAndCompute(payload);
  const calcData = buildCalcData(payload, result, insideDiameterFeet);
  const castingCreate = buildCastingCreate(casting);

  await prisma.jobStructure.update({
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
