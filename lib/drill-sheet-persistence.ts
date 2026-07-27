import { Prisma } from "@/app/generated/prisma/client";
import {
  computeDrillSheet,
  type DrillSheetInput,
  type DrillSheetResult,
  type PipeConnectionType,
} from "@/lib/drill-sheet";
import { prisma } from "@/lib/prisma";
import {
  getPriceListIdForStructure,
  loadStructurePricing,
} from "@/lib/structure-pricing";
import type { QuoteStructureConfig } from "@/lib/quotes/structure-workbook";

export type OpeningPayload = {
  label: string;
  pipeMaterial: string;
  pipeSizeInches: string;
  invertElevation: string;
  angle: string;
  connectionType: PipeConnectionType | "";
};

export type DrillSheetPayload = {
  templateId: string;
  diameterId: string;
  castingProductId: string | null;
  jobId: string | null;
  manholeNumber: string;
  contractor: string;
  project: string;
  date: string;
  hasSteps: boolean;
  inspection: string;
  approvedBy: string;
  useBase: string;
  useRiser: string;
  brickAdjustment: string;
  rimElevation: string;
  openings: OpeningPayload[];
};

export type LoadedDrillSheet = {
  template: { id: string; name: string; agencyStandard: string | null };
  insideDiameterFeet: number;
  casting: { id: string; name: string } | null;
  result: DrillSheetResult;
  pricing: {
    wallPrice: Prisma.Decimal;
    bootsPrice: Prisma.Decimal;
    totalPrice: Prisma.Decimal;
  };
};

export type CreateJobStructureOptions = {
  quoteId?: string | null;
  jobId?: string | null;
  structureNumber?: string | null;
  quantity?: number;
  contractorName?: string | null;
  projectName?: string | null;
};

export function decimal(value: number | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  return new Prisma.Decimal(String(value));
}

export function parseNum(value: string | null | undefined): number | null {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function parseDrillSheetPayload(formData: FormData): DrillSheetPayload {
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
  return parseDrillSheetPayloadData(parsed);
}

/** Validates an already-parsed payload object (bulk edit sends JSON arrays). */
export function parseDrillSheetPayloadData(parsed: unknown): DrillSheetPayload {
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
    inspection: String(data.inspection ?? "").trim(),
    approvedBy: String(data.approvedBy ?? "").trim(),
    useBase: String(data.useBase ?? "").trim(),
    useRiser: String(data.useRiser ?? "").trim(),
    brickAdjustment: String(data.brickAdjustment ?? "").trim(),
    rimElevation: String(data.rimElevation ?? "").trim(),
    openings,
  };
}

export async function loadAndComputeDrillSheet(
  payload: DrillSheetPayload,
  options: {
    /** Price from this list (default-list fallback); null = default list. */
    priceListId?: string | null;
  } = {},
): Promise<LoadedDrillSheet> {
  const [template, pipeOpeningSizes, diameterConfigs, pricing] =
    await Promise.all([
      prisma.structureTemplate.findUnique({
        where: { id: payload.templateId },
        include: {
          diameters: { where: { id: payload.diameterId } },
        },
      }),
      prisma.pipeOpeningSize.findMany(),
      prisma.structureDiameterConfig.findMany(),
      loadStructurePricing(options.priceListId ?? null),
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
      `No mold configured for ${insideDiameterFeet}'. Add it in Settings → Structure Molds.`,
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

  const diameterPricing = pricing.diameters.get(diameterConfig.id);
  const wallPricePerFoot = diameterPricing?.wallPricePerFoot ?? 0;
  const basePrice = diameterPricing?.basePrice ?? 0;

  const input: DrillSheetInput = {
    rimElevation: parseNum(payload.rimElevation),
    castingHeightFeet: casting?.heightFeet ?? 0,
    diameter: {
      insideDiameterFeet,
      maxBaseHeightFeet: Number(diameterConfig.maxBaseHeightFeet),
      maxRiserHeightFeet: Number(diameterConfig.maxRiserHeightFeet),
      keyHeightFeet: Number(diameterConfig.keyHeightFeet),
      wallPricePerFoot,
      basePrice,
      wallThicknessInches:
        diameterConfig.wallThicknessInches != null
          ? Number(diameterConfig.wallThicknessInches)
          : null,
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
      hasBoot: entry.hasBoot,
      holeDiameterInches: Number(entry.holeDiameterInches),
      pipeWallThicknessInches: Number(entry.pipeWallThicknessInches),
      bootModel: entry.bootModel,
      pricePerBoot: pricing.pipeOpenings.get(entry.id)?.price ?? null,
    })),
    openings: payload.openings.map((opening) => ({
      label: opening.label,
      pipeMaterial: opening.pipeMaterial,
      pipeSizeInches: parseNum(opening.pipeSizeInches),
      invertElevation: parseNum(opening.invertElevation),
      angleDegrees: parseNum(opening.angle),
      connectionType: opening.connectionType || null,
    })),
  };

  const result = computeDrillSheet(input);

  const wallHeight = new Prisma.Decimal(
    Number.isFinite(result.wallHeightFeet) ? String(result.wallHeightFeet) : "0",
  );
  const wallPrice = new Prisma.Decimal(String(basePrice))
    .add(wallHeight.mul(new Prisma.Decimal(String(wallPricePerFoot))))
    .toDecimalPlaces(2);
  let bootsPrice = new Prisma.Decimal(0);
  for (const opening of result.openings) {
    if (
      opening.connectionType === "KOR_N_SEAL" &&
      opening.pricePerBoot != null
    ) {
      bootsPrice = bootsPrice.add(
        new Prisma.Decimal(String(opening.pricePerBoot)),
      );
    }
  }
  bootsPrice = bootsPrice.toDecimalPlaces(2);

  return {
    template,
    insideDiameterFeet,
    casting: casting ? { id: casting.id, name: casting.name } : null,
    result,
    pricing: {
      wallPrice,
      bootsPrice,
      totalPrice: wallPrice.add(bootsPrice).toDecimalPlaces(2),
    },
  };
}

export function buildCalcData(
  payload: DrillSheetPayload,
  result: DrillSheetResult,
  insideDiameterFeet: number,
  pricing: LoadedDrillSheet["pricing"],
) {
  const sheetDate = payload.date ? new Date(`${payload.date}T00:00:00`) : null;
  return {
    contractorName: payload.contractor || null,
    projectName: payload.project || null,
    sheetDate,
    hasSteps: payload.hasSteps,
    inspection: payload.inspection || null,
    approvedBy: payload.approvedBy || null,
    useBase: payload.useBase || null,
    useRiser: payload.useRiser || null,
    brickAdjustment: payload.brickAdjustment || null,
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
    wallPrice: pricing.wallPrice,
    bootsPrice: pricing.bootsPrice,
    totalPrice: pricing.totalPrice,
    errorMessage: result.errorMessage,
  };
}

export function buildOpeningsCreate(result: DrillSheetResult) {
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

export function buildSectionsCreate(result: DrillSheetResult) {
  return result.sections.map((section, index) => ({
    role: section.role,
    heightFeet: new Prisma.Decimal(String(section.heightFeet)),
    label: section.label ?? null,
    sortOrder: index,
    hasBottomKey: section.hasBottomKey,
    hasTopKey: section.hasTopKey,
  }));
}

export function buildCastingCreate(casting: { id: string; name: string } | null) {
  if (!casting) {
    return undefined;
  }
  return {
    castingProductId: casting.id,
    castingDescription: casting.name,
    quantity: new Prisma.Decimal("1"),
  };
}

export async function createJobStructureFromPayload(
  payload: DrillSheetPayload,
  options: CreateJobStructureOptions & { priceListId?: string | null } = {},
): Promise<string> {
  const { template, insideDiameterFeet, casting, result, pricing } =
    await loadAndComputeDrillSheet(payload, {
      priceListId: options.priceListId ?? null,
    });
  const castingCreate = buildCastingCreate(casting);

  const created = await prisma.jobStructure.create({
    data: {
      structureType: "CONFIGURABLE_PRODUCT",
      structureTemplateId: template.id,
      quoteId: options.quoteId ?? undefined,
      jobId: options.jobId ?? payload.jobId ?? undefined,
      structureNumber:
        options.structureNumber ?? (payload.manholeNumber || null),
      description: `${insideDiameterFeet}' ${template.name}`,
      quantity: new Prisma.Decimal(String(options.quantity ?? 1)),
      unit: "EA",
      weight:
        result.totalWeightLb != null
          ? new Prisma.Decimal(String(result.totalWeightLb))
          : undefined,
      calc: {
        create: buildCalcData(payload, result, insideDiameterFeet, pricing),
      },
      openings: { create: buildOpeningsCreate(result) },
      sections: { create: buildSectionsCreate(result) },
      castings: castingCreate ? { create: castingCreate } : undefined,
    },
  });

  return created.id;
}

/**
 * Recomputes and saves an existing circular drill sheet from a payload.
 * `expectedUpdatedAtRaw` (when non-empty) guards against concurrent edits:
 * the update fails if the row changed since the caller loaded it.
 */
export async function updateJobStructureFromPayload(
  jobStructureId: string,
  payload: DrillSheetPayload,
  expectedUpdatedAtRaw: string,
): Promise<void> {
  const existing = await prisma.jobStructure.findUnique({
    where: { id: jobStructureId },
    select: { id: true, calc: { select: { id: true } } },
  });
  if (!existing) {
    throw new Error("Drill sheet not found.");
  }

  const priceListId = await getPriceListIdForStructure(jobStructureId);
  const { template, insideDiameterFeet, casting, result, pricing } =
    await loadAndComputeDrillSheet(payload, { priceListId });
  const calcData = buildCalcData(payload, result, insideDiameterFeet, pricing);
  const castingCreate = buildCastingCreate(casting);

  await prisma.$transaction(async (tx) => {
    if (expectedUpdatedAtRaw) {
      const current = await tx.jobStructure.findUnique({
        where: { id: jobStructureId },
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
      where: { id: jobStructureId },
      data: {
        structureTemplateId: template.id,
        jobId: payload.jobId ?? null,
        structureNumber: payload.manholeNumber || null,
        description: `${insideDiameterFeet}' ${template.name}`,
        // Keep an existing (possibly hand-entered) weight when the mold has
        // no wall thickness to compute one from.
        weight:
          result.totalWeightLb != null
            ? new Prisma.Decimal(String(result.totalWeightLb))
            : undefined,
        calc: existing.calc ? { update: calcData } : { create: calcData },
        openings: { deleteMany: {}, create: buildOpeningsCreate(result) },
        sections: { deleteMany: {}, create: buildSectionsCreate(result) },
        castings: castingCreate
          ? { deleteMany: {}, create: castingCreate }
          : { deleteMany: {} },
      },
    });
  });
}

/**
 * Turns an existing placeholder JobStructure (e.g. created by won-quote
 * linking) into a full drill sheet, preserving its status, dates, documents,
 * and delivery links.
 */
export async function upgradeJobStructureFromPayload(
  jobStructureId: string,
  payload: DrillSheetPayload,
): Promise<string> {
  const existing = await prisma.jobStructure.findUnique({
    where: { id: jobStructureId },
    select: { id: true, calc: { select: { id: true } } },
  });
  if (!existing) {
    throw new Error("Structure to upgrade was not found.");
  }

  const priceListId = await getPriceListIdForStructure(jobStructureId);
  const { template, insideDiameterFeet, casting, result, pricing } =
    await loadAndComputeDrillSheet(payload, { priceListId });
  const castingCreate = buildCastingCreate(casting);
  const calcData = buildCalcData(payload, result, insideDiameterFeet, pricing);

  await prisma.jobStructure.update({
    where: { id: jobStructureId },
    data: {
      structureTemplateId: template.id,
      description: `${insideDiameterFeet}' ${template.name}`,
      // Keep an existing (possibly hand-entered) weight when the mold has
      // no wall thickness to compute one from.
      weight:
        result.totalWeightLb != null
          ? new Prisma.Decimal(String(result.totalWeightLb))
          : undefined,
      calc: existing.calc ? { update: calcData } : { create: calcData },
      openings: { deleteMany: {}, create: buildOpeningsCreate(result) },
      sections: { deleteMany: {}, create: buildSectionsCreate(result) },
      castings: castingCreate
        ? { deleteMany: {}, create: castingCreate }
        : { deleteMany: {} },
    },
  });

  return jobStructureId;
}

export async function createJobStructureFromQuoteConfig(
  config: QuoteStructureConfig,
  options: CreateJobStructureOptions & {
    /** Upgrade this existing placeholder structure instead of creating one. */
    upgradeJobStructureId?: string | null;
  },
): Promise<string> {
  if (config.detailLevel !== "DRILL_SHEET" || !config.openings?.length) {
    throw new Error("Structure config is missing full drill sheet detail.");
  }

  const template = await prisma.structureTemplate.findUnique({
    where: { id: config.templateId },
    include: { diameters: true },
  });
  if (!template) {
    throw new Error("Structure template not found.");
  }

  const diameter = template.diameters.find(
    (entry) =>
      Math.abs(Number(entry.insideDiameterFeet) - config.diameterFeet) < 1e-6,
  );
  if (!diameter) {
    throw new Error(
      `No template diameter found for ${config.diameterFeet}' on ${template.name}.`,
    );
  }

  const payload: DrillSheetPayload = {
    templateId: config.templateId,
    diameterId: diameter.id,
    castingProductId: config.castingProductId ?? null,
    jobId: options.jobId ?? null,
    manholeNumber: options.structureNumber ?? "",
    contractor: options.contractorName ?? "",
    project: options.projectName ?? "",
    date: "",
    hasSteps: false,
    inspection: "",
    approvedBy: "",
    useBase: "",
    useRiser: "",
    brickAdjustment: "",
    rimElevation: String(config.rimElevation),
    openings: config.openings.map((opening) => ({
      label: opening.label,
      pipeMaterial: opening.pipeMaterial ?? "",
      pipeSizeInches:
        opening.pipeSizeInches != null ? String(opening.pipeSizeInches) : "",
      invertElevation: String(opening.invertElevation),
      angle: String(opening.angleDegrees ?? 0),
      connectionType: (opening.connectionType ??
        template.connectionType) as PipeConnectionType,
    })),
  };

  if (options.upgradeJobStructureId) {
    return upgradeJobStructureFromPayload(options.upgradeJobStructureId, payload);
  }

  // Price the new structure from the quote's list.
  let priceListId: string | null = null;
  if (options.quoteId) {
    const quote = await prisma.quote.findUnique({
      where: { id: options.quoteId },
      select: { priceListId: true },
    });
    priceListId = quote?.priceListId ?? null;
  }

  return createJobStructureFromPayload(payload, { ...options, priceListId });
}
