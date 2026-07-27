import { Prisma } from "@/app/generated/prisma/client";
import {
  computeRectStructure,
  type RectOpeningPlacement,
  type RectStructureInput,
  type RectStructureResult,
  type RectWall,
} from "@/lib/rect-structure";
import type { RectQuoteStructureConfig } from "@/lib/quotes/rect-structure-workbook";
import { decimal, parseNum } from "@/lib/drill-sheet-persistence";
import { prisma } from "@/lib/prisma";
import {
  getPriceListIdForStructure,
  loadStructurePricing,
} from "@/lib/structure-pricing";

export type RectOpeningPayload = {
  label: string;
  wall: RectWall | "";
  pipeMaterial: string;
  pipeSizeInches: string;
  invertElevation: string;
  angle: string;
  placement: RectOpeningPlacement;
  offsetInches: string;
  widthOverrideInches: string;
};

export type RectSheetPayload = {
  templateId: string;
  castingProductId: string | null;
  jobId: string | null;
  structureNumber: string;
  contractor: string;
  project: string;
  date: string;
  inspection: string;
  approvedBy: string;
  rimElevation: string;
  /** Manual brick target in inches; "" = template minimum drives brick. */
  brickTargetInches: string;
  insideLengthFeet: string;
  insideWidthFeet: string;
  hasTopSlab: boolean;
  hasBaseSlab: boolean;
  baseAttached: boolean;
  topSlabOpeningLengthInches: string;
  topSlabOpeningWidthInches: string;
  topSlabOpeningSide: RectWall | "";
  sectionHeightsFeet: string[];
  jointKeys: boolean[];
  openings: RectOpeningPayload[];
};

export type LoadedRectSheet = {
  template: { id: string; name: string; agencyStandard: string | null };
  casting: { id: string; name: string } | null;
  result: RectStructureResult;
  pricing: {
    wallPrice: Prisma.Decimal;
    openingsPrice: Prisma.Decimal;
    totalPrice: Prisma.Decimal;
  };
};

const RECT_WALL_VALUES: RectWall[] = ["UP", "DOWN", "LEFT", "RIGHT"];
const PLACEMENT_VALUES: RectOpeningPlacement[] = [
  "CENTERED",
  "FROM_LEFT",
  "FROM_RIGHT",
  "TOUCH_LEFT",
  "TOUCH_RIGHT",
];

function parseWall(value: unknown): RectWall | "" {
  return RECT_WALL_VALUES.includes(value as RectWall)
    ? (value as RectWall)
    : "";
}

function parsePlacement(value: unknown): RectOpeningPlacement {
  return PLACEMENT_VALUES.includes(value as RectOpeningPlacement)
    ? (value as RectOpeningPlacement)
    : "CENTERED";
}

export function parseRectSheetPayload(formData: FormData): RectSheetPayload {
  const raw = String(formData.get("payload") ?? "").trim();
  if (!raw) {
    throw new Error("Missing sheet data.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid sheet data.");
  }
  return parseRectSheetPayloadData(parsed);
}

/** Validates an already-parsed payload object (bulk edit sends JSON arrays). */
export function parseRectSheetPayloadData(parsed: unknown): RectSheetPayload {
  const data = parsed as Record<string, unknown>;

  const templateId = String(data.templateId ?? "").trim();
  if (!templateId) {
    throw new Error("A template is required.");
  }

  const openingsRaw = Array.isArray(data.openings) ? data.openings : [];
  const openings: RectOpeningPayload[] = openingsRaw.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      label: String(row.label ?? "").trim(),
      wall: parseWall(row.wall),
      pipeMaterial: String(row.pipeMaterial ?? "").trim(),
      pipeSizeInches: String(row.pipeSizeInches ?? "").trim(),
      invertElevation: String(row.invertElevation ?? "").trim(),
      angle: String(row.angle ?? "").trim(),
      placement: parsePlacement(row.placement),
      offsetInches: String(row.offsetInches ?? "").trim(),
      widthOverrideInches: String(row.widthOverrideInches ?? "").trim(),
    };
  });

  const sectionHeightsRaw = Array.isArray(data.sectionHeightsFeet)
    ? data.sectionHeightsFeet
    : [];
  const jointKeysRaw = Array.isArray(data.jointKeys) ? data.jointKeys : [];

  return {
    templateId,
    castingProductId: data.castingProductId
      ? String(data.castingProductId)
      : null,
    jobId: data.jobId ? String(data.jobId) : null,
    structureNumber: String(data.structureNumber ?? "").trim(),
    contractor: String(data.contractor ?? "").trim(),
    project: String(data.project ?? "").trim(),
    date: String(data.date ?? "").trim(),
    inspection: String(data.inspection ?? "").trim(),
    approvedBy: String(data.approvedBy ?? "").trim(),
    rimElevation: String(data.rimElevation ?? "").trim(),
    brickTargetInches: String(data.brickTargetInches ?? "").trim(),
    insideLengthFeet: String(data.insideLengthFeet ?? "").trim(),
    insideWidthFeet: String(data.insideWidthFeet ?? "").trim(),
    hasTopSlab: data.hasTopSlab === true,
    hasBaseSlab: data.hasBaseSlab === true,
    baseAttached: data.baseAttached === true,
    topSlabOpeningLengthInches: String(
      data.topSlabOpeningLengthInches ?? "",
    ).trim(),
    topSlabOpeningWidthInches: String(
      data.topSlabOpeningWidthInches ?? "",
    ).trim(),
    topSlabOpeningSide: parseWall(data.topSlabOpeningSide),
    sectionHeightsFeet: sectionHeightsRaw.map((value) => String(value ?? "")),
    jointKeys: jointKeysRaw.map((value) => value === true),
    openings,
  };
}

/** Builds the pure-calc input from a payload plus DB template/catalog rows. */
export async function loadAndComputeRectSheet(
  payload: RectSheetPayload,
  options: {
    /** Price from this list (default-list fallback); null = default list. */
    priceListId?: string | null;
  } = {},
): Promise<LoadedRectSheet> {
  const [template, openingSizes, pricing] = await Promise.all([
    prisma.structureTemplate.findUnique({
      where: { id: payload.templateId },
    }),
    prisma.rectOpeningSize.findMany({ orderBy: { sortOrder: "asc" } }),
    loadStructurePricing(options.priceListId ?? null),
  ]);

  if (!template) {
    throw new Error("Structure template not found.");
  }
  if (template.shape !== "RECTANGULAR") {
    throw new Error("Selected template is not rectangular.");
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

  const input: RectStructureInput = {
    rimElevation: parseNum(payload.rimElevation),
    castingHeightFeet: casting?.heightFeet ?? 0,
    brickTargetInches: parseNum(payload.brickTargetInches),
    insideLengthFeet: parseNum(payload.insideLengthFeet),
    insideWidthFeet: parseNum(payload.insideWidthFeet),
    hasTopSlab: payload.hasTopSlab,
    hasBaseSlab: payload.hasBaseSlab,
    baseAttached: payload.baseAttached,
    template: {
      wallThicknessInches: Number(template.wallThicknessInches),
      baseSlabThicknessInches: Number(template.baseSlabThicknessInches),
      topSlabThicknessInches: Number(template.topSlabThicknessInches),
      minimumBrickInches: Number(template.minimumBrickInches),
      sumpMode: template.sumpMode,
      sumpFixedInches:
        template.sumpFixedInches != null
          ? Number(template.sumpFixedInches)
          : null,
      wallPricePerFoot:
        pricing.rectTemplates.get(template.id)?.wallPricePerFoot ?? 0,
      minPricingHeightFeet:
        template.rectMinPricingHeightFeet != null
          ? Number(template.rectMinPricingHeightFeet)
          : 0,
      topSlabPrice: pricing.rectTemplates.get(template.id)?.topSlabPrice ?? 0,
      baseSlabPrice: pricing.rectTemplates.get(template.id)?.baseSlabPrice ?? 0,
    },
    openingSizes: openingSizes.map((entry) => ({
      pipeMaterial: entry.pipeMaterial,
      pipeSizeInches: Number(entry.pipeSizeInches),
      openingWidthInches: Number(entry.openingWidthInches),
      openingHeightInches: Number(entry.openingHeightInches),
      pipeWallThicknessInches:
        Number(entry.pipeWallThicknessInches) > 0
          ? Number(entry.pipeWallThicknessInches)
          : null,
      pricePerOpening: pricing.rectOpenings.get(entry.id)?.price ?? null,
    })),
    openings: payload.openings.map((opening) => ({
      label: opening.label,
      wall: opening.wall || null,
      pipeMaterial: opening.pipeMaterial,
      pipeSizeInches: parseNum(opening.pipeSizeInches),
      invertElevation: parseNum(opening.invertElevation),
      angleDegrees: parseNum(opening.angle),
      placement: opening.placement,
      offsetInches: parseNum(opening.offsetInches),
      widthOverrideInches: parseNum(opening.widthOverrideInches),
    })),
    sectionHeightsFeet: payload.sectionHeightsFeet
      .map((value) => parseNum(value))
      .filter((value): value is number => value != null && value > 0),
    jointKeys: payload.jointKeys,
    topSlabOpening: payload.hasTopSlab
      ? {
          lengthInches: parseNum(payload.topSlabOpeningLengthInches),
          widthInches: parseNum(payload.topSlabOpeningWidthInches),
          side: payload.topSlabOpeningSide || null,
        }
      : null,
  };

  const result = computeRectStructure(input);

  return {
    template: {
      id: template.id,
      name: template.name,
      agencyStandard: template.agencyStandard,
    },
    casting: casting ? { id: casting.id, name: casting.name } : null,
    result,
    pricing: {
      // Structure price = walls + slab components, so the stored columns
      // stay self-consistent (wallPrice + bootsPrice = totalPrice).
      wallPrice: new Prisma.Decimal(
        String(result.wallPrice + result.topSlabPrice + result.baseSlabPrice),
      ),
      openingsPrice: new Prisma.Decimal(String(result.openingsPrice)),
      totalPrice: new Prisma.Decimal(String(result.totalPrice)),
    },
  };
}

export function buildRectCalcData(
  payload: RectSheetPayload,
  result: RectStructureResult,
  pricing: LoadedRectSheet["pricing"],
) {
  const sheetDate = payload.date ? new Date(`${payload.date}T00:00:00`) : null;
  return {
    contractorName: payload.contractor || null,
    projectName: payload.project || null,
    sheetDate,
    inspection: payload.inspection || null,
    approvedBy: payload.approvedBy || null,
    // Rect sheets reuse the circular brick-adjustment column for the manual
    // brick target (inches) so the round-trip needs no schema change.
    brickAdjustment: payload.brickTargetInches || null,
    rimElevation: decimal(result.rimElevation),
    lowestInvertFeet: decimal(result.lowInvertElevation),
    sumpFeet: decimal(result.sumpFeet),
    castingHeightFeet: decimal(result.castingHeightFeet),
    topSlabThicknessFeet: decimal(result.topSlabThicknessFeet),
    wallHeightFeet: decimal(result.wallHeightFeet),
    brickFeet: decimal(result.brickFeet),
    hasKey: result.sections.some((section) => section.hasBottomKey),
    totalHeightFeet: decimal(result.totalHeightFeet),
    insideLengthFeet: decimal(result.insideLengthFeet),
    insideWidthFeet: decimal(result.insideWidthFeet),
    baseSlabThicknessFeet: decimal(result.baseSlabThicknessFeet),
    wallPrice: pricing.wallPrice,
    // Rect sheets have no boots; the openings total reuses the boots column.
    bootsPrice: pricing.openingsPrice,
    totalPrice: pricing.totalPrice,
    errorMessage: result.errorMessage,
  };
}

export function buildRectOpeningsCreate(result: RectStructureResult) {
  return result.openings.map((opening, index) => ({
    openingNumber: index + 1,
    label: opening.label || String.fromCharCode(65 + index),
    invertElevation: decimal(opening.invertElevation),
    pipeSizeInches: decimal(opening.pipeSizeInches),
    pipeMaterial: opening.pipeMaterial || null,
    angle: decimal(opening.angleDegrees),
    wall: opening.wall,
    horizontalPlacement: opening.placement,
    offsetInches: decimal(opening.offsetInches),
    openingWidthInches: decimal(opening.openingWidthInches),
    openingHeightInches: decimal(opening.openingHeightInches),
    bottomOfOpeningFeet: decimal(opening.bottomOfOpeningFeet),
    topOfOpeningFeet: decimal(opening.topOfOpeningFeet),
    baseTopToOpeningBottomInches: opening.floorToOpeningBottomInches,
    pricePerBoot: decimal(opening.pricePerOpening),
  }));
}

export function buildRectSectionsCreate(result: RectStructureResult) {
  return result.sections.map((section, index) => ({
    // The bottom pour maps to BASE and stacked pours to RISER so rect
    // sections reuse the circular role vocabulary.
    role: (index === 0 ? "BASE" : "RISER") as "BASE" | "RISER",
    heightFeet: new Prisma.Decimal(String(section.heightFeet)),
    label: section.label,
    sortOrder: index,
    pickWeightLbs: new Prisma.Decimal(String(section.pickWeightLbs)),
    hasBottomKey: section.hasBottomKey,
    hasTopKey: section.hasTopKey,
  }));
}

export function buildRectDimensionData(result: RectStructureResult) {
  return {
    insideLength: decimal(result.insideLengthFeet),
    insideWidth: decimal(result.insideWidthFeet),
    insideHeight: decimal(result.wallHeightFeet),
    outsideLength: decimal(result.outsideLengthFeet),
    outsideWidth: decimal(result.outsideWidthFeet),
    outsideHeight: decimal(result.totalHeightFeet),
    wallThickness: decimal(result.wallThicknessFeet),
    topSlabThickness: decimal(result.topSlabThicknessFeet),
    baseSlabThickness: decimal(result.baseSlabThicknessFeet),
    hasTopSlab: result.hasTopSlab,
    hasBaseSlab: result.hasBaseSlab,
    baseAttached: result.baseAttached,
    topSlabOpeningLengthInches: decimal(result.topSlabOpening?.lengthInches),
    topSlabOpeningWidthInches: decimal(result.topSlabOpening?.widthInches),
    topSlabOpeningSide: result.topSlabOpening?.side ?? null,
  };
}

export async function createRectJobStructureFromPayload(
  payload: RectSheetPayload,
  options: {
    quoteId?: string | null;
    quantity?: number;
    priceListId?: string | null;
  } = {},
): Promise<string> {
  const { template, casting, result, pricing } = await loadAndComputeRectSheet(
    payload,
    { priceListId: options.priceListId ?? null },
  );

  const sizeLabel =
    result.insideLengthFeet != null && result.insideWidthFeet != null
      ? `${result.insideLengthFeet}' x ${result.insideWidthFeet}' `
      : "";

  const created = await prisma.jobStructure.create({
    data: {
      structureType: "CONFIGURABLE_PRODUCT",
      structureTemplateId: template.id,
      quoteId: options.quoteId ?? undefined,
      jobId: payload.jobId ?? undefined,
      structureNumber: payload.structureNumber || null,
      description: `${sizeLabel}${template.name}`,
      quantity: new Prisma.Decimal(String(options.quantity ?? 1)),
      unit: "EA",
      weight:
        result.weights.heaviestLbs != null
          ? new Prisma.Decimal(String(result.weights.heaviestLbs))
          : undefined,
      calc: { create: buildRectCalcData(payload, result, pricing) },
      dimensions: { create: buildRectDimensionData(result) },
      openings: { create: buildRectOpeningsCreate(result) },
      sections: { create: buildRectSectionsCreate(result) },
      castings: casting
        ? {
            create: {
              castingProductId: casting.id,
              castingDescription: casting.name,
              quantity: new Prisma.Decimal("1"),
            },
          }
        : undefined,
    },
  });

  return created.id;
}

/**
 * Turns a won-quote rect structure line into a full rect sheet. Upgrades the
 * placeholder JobStructure created by won-quote linking when one exists, so
 * status, documents, and delivery links are preserved.
 */
export async function createRectJobStructureFromQuoteConfig(
  config: RectQuoteStructureConfig,
  options: {
    quoteId?: string | null;
    jobId?: string | null;
    structureNumber?: string | null;
    quantity?: number;
    contractorName?: string | null;
    projectName?: string | null;
    upgradeJobStructureId?: string | null;
  },
): Promise<string> {
  if (config.detailLevel !== "FULL" || config.openings.length === 0) {
    throw new Error("Structure config is missing full rect sheet detail.");
  }

  const payload: RectSheetPayload = {
    templateId: config.templateId,
    castingProductId: config.castingProductId ?? null,
    jobId: options.jobId ?? null,
    structureNumber: options.structureNumber ?? "",
    contractor: options.contractorName ?? "",
    project: options.projectName ?? "",
    date: new Date().toISOString().slice(0, 10),
    inspection: "",
    approvedBy: "",
    rimElevation: String(config.rimElevation),
    brickTargetInches: "",
    insideLengthFeet: String(config.insideLengthFeet),
    insideWidthFeet: String(config.insideWidthFeet),
    hasTopSlab: config.hasTopSlab,
    hasBaseSlab: config.hasBaseSlab,
    baseAttached: config.baseAttached,
    topSlabOpeningLengthInches:
      config.topSlabOpeningLengthInches != null
        ? String(config.topSlabOpeningLengthInches)
        : "",
    topSlabOpeningWidthInches:
      config.topSlabOpeningWidthInches != null
        ? String(config.topSlabOpeningWidthInches)
        : "",
    topSlabOpeningSide: config.topSlabOpeningSide ?? "",
    // Splits are decided in the sheet editor; award creates a single pour.
    sectionHeightsFeet: [],
    jointKeys: [],
    openings: config.openings.map((opening) => ({
      label: opening.label,
      wall: opening.wall,
      pipeMaterial: opening.pipeMaterial ?? "",
      pipeSizeInches: opening.pipeSizeInches?.toString() ?? "",
      invertElevation: String(opening.invertElevation),
      angle:
        opening.angleDegrees != null && opening.angleDegrees !== 0
          ? String(opening.angleDegrees)
          : "",
      placement: opening.placement ?? "CENTERED",
      offsetInches:
        opening.offsetInches != null ? String(opening.offsetInches) : "",
      widthOverrideInches:
        opening.widthOverrideInches != null
          ? String(opening.widthOverrideInches)
          : "",
    })),
  };

  if (options.upgradeJobStructureId) {
    await updateRectJobStructureFromPayload(
      options.upgradeJobStructureId,
      payload,
      "",
    );
    return options.upgradeJobStructureId;
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

  return createRectJobStructureFromPayload(payload, {
    quoteId: options.quoteId ?? null,
    quantity: options.quantity,
    priceListId,
  });
}

export async function updateRectJobStructureFromPayload(
  jobStructureId: string,
  payload: RectSheetPayload,
  expectedUpdatedAtRaw: string,
): Promise<void> {
  const existing = await prisma.jobStructure.findUnique({
    where: { id: jobStructureId },
    select: {
      id: true,
      calc: { select: { id: true } },
      dimensions: { select: { id: true } },
    },
  });
  if (!existing) {
    throw new Error("Sheet not found.");
  }

  const priceListId = await getPriceListIdForStructure(jobStructureId);
  const { template, casting, result, pricing } = await loadAndComputeRectSheet(
    payload,
    { priceListId },
  );
  const calcData = buildRectCalcData(payload, result, pricing);
  const dimensionData = buildRectDimensionData(result);

  const sizeLabel =
    result.insideLengthFeet != null && result.insideWidthFeet != null
      ? `${result.insideLengthFeet}' x ${result.insideWidthFeet}' `
      : "";

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
          "This sheet was changed by someone else while you were editing. Refresh the page to load the latest version, then re-apply your changes.",
        );
      }
    }

    await tx.jobStructure.update({
      where: { id: jobStructureId },
      data: {
        structureTemplateId: template.id,
        jobId: payload.jobId ?? null,
        structureNumber: payload.structureNumber || null,
        description: `${sizeLabel}${template.name}`,
        weight:
          result.weights.heaviestLbs != null
            ? new Prisma.Decimal(String(result.weights.heaviestLbs))
            : null,
        calc: existing.calc ? { update: calcData } : { create: calcData },
        dimensions: existing.dimensions
          ? { update: dimensionData }
          : { create: dimensionData },
        openings: { deleteMany: {}, create: buildRectOpeningsCreate(result) },
        sections: { deleteMany: {}, create: buildRectSectionsCreate(result) },
        castings: casting
          ? {
              deleteMany: {},
              create: {
                castingProductId: casting.id,
                castingDescription: casting.name,
                quantity: new Prisma.Decimal("1"),
              },
            }
          : { deleteMany: {} },
      },
    });
  });
}
