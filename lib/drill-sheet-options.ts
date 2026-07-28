import type {
  DrillSheetCastingOption,
  DrillSheetJobOption,
  DrillSheetTemplateOption,
} from "@/components/drill-sheets/drill-sheet-form";
import type {
  RectSheetCastingOption,
  RectSheetTemplateOption,
  RectSheetOpeningSizeOption,
} from "@/components/drill-sheets/rect-sheet-form";
import { prisma } from "@/lib/prisma";
import { loadStructurePricing } from "@/lib/structure-pricing";

export type DrillSheetFormOptions = {
  templateOptions: DrillSheetTemplateOption[];
  castingOptions: DrillSheetCastingOption[];
  jobOptions: DrillSheetJobOption[];
  pipeOpeningSizes: {
    pipeMaterial: string;
    pipeSizeInches: number;
    pipeType: string;
    hasBoot: boolean;
    holeDiameterInches: number;
    pipeWallThicknessInches: number;
    bootModel: string | null;
    pricePerBoot: number | null;
    /** Price came from the default list, not the requested one. */
    priceUsedFallback?: boolean;
  }[];
  diameterConfigs: {
    label: string | null;
    insideDiameterFeet: number;
    wallThicknessInches: number | null;
    maxBaseHeightFeet: number;
    maxRiserHeightFeet: number;
    keyHeightFeet: number;
    wallPricePerFoot: number;
    basePrice: number;
    /** No price entry on any list — priced at 0 until settings are filled in. */
    priceMissing?: boolean;
    priceUsedFallback?: boolean;
  }[];
};

export async function loadDrillSheetFormOptions(
  priceListId: string | null = null,
): Promise<DrillSheetFormOptions> {
  const [templates, castings, jobs, pipeOpeningSizes, diameterConfigs, pricing] =
    await Promise.all([
      prisma.structureTemplate.findMany({
        where: { status: "ACTIVE", shape: "CIRCULAR" },
        orderBy: { name: "asc" },
        include: {
          castingProduct: {
            select: { id: true, name: true, heightFeet: true },
          },
          diameters: { orderBy: { sortOrder: "asc" } },
        },
      }),
      prisma.product.findMany({
        where: { isCasting: true, status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, heightFeet: true },
      }),
      prisma.job.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, jobNumber: true, projectName: true },
      }),
      prisma.pipeOpeningSize.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.structureDiameterConfig.findMany({ orderBy: { sortOrder: "asc" } }),
      loadStructurePricing(priceListId),
    ]);

  const templateOptions: DrillSheetTemplateOption[] = templates.map(
    (template) => ({
      id: template.id,
      name: template.name,
      agencyStandard: template.agencyStandard,
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
      defaultCastingProductId: template.castingProductId,
      defaultCastingHeightFeet: template.castingProduct?.heightFeet
        ? Number(template.castingProduct.heightFeet)
        : null,
      diameters: template.diameters.map((diameter) => ({
        id: diameter.id,
        insideDiameterFeet: Number(diameter.insideDiameterFeet),
      })),
    }),
  );

  return {
    templateOptions,
    castingOptions: castings.map((casting) => ({
      id: casting.id,
      name: casting.name,
      heightFeet: casting.heightFeet ? Number(casting.heightFeet) : null,
    })),
    jobOptions: jobs.map((job) => ({
      id: job.id,
      label: `${job.jobNumber} — ${job.projectName}`,
    })),
    pipeOpeningSizes: pipeOpeningSizes.map((entry) => {
      const price = pricing.pipeOpenings.get(entry.id);
      return {
        pipeMaterial: entry.pipeMaterial,
        pipeSizeInches: Number(entry.pipeSizeInches),
        pipeType: entry.pipeType,
        hasBoot: entry.hasBoot,
        holeDiameterInches: Number(entry.holeDiameterInches),
        pipeWallThicknessInches: Number(entry.pipeWallThicknessInches),
        bootModel: entry.bootModel,
        pricePerBoot: price?.price ?? null,
        priceUsedFallback: price?.usedFallback ?? false,
      };
    }),
    diameterConfigs: diameterConfigs.map((config) => {
      const price = pricing.diameters.get(config.id);
      return {
        label: config.label,
        insideDiameterFeet: Number(config.insideDiameterFeet),
        wallThicknessInches:
          config.wallThicknessInches != null
            ? Number(config.wallThicknessInches)
            : null,
        maxBaseHeightFeet: Number(config.maxBaseHeightFeet),
        maxRiserHeightFeet: Number(config.maxRiserHeightFeet),
        keyHeightFeet: Number(config.keyHeightFeet),
        wallPricePerFoot: price?.wallPricePerFoot ?? 0,
        basePrice: price?.basePrice ?? 0,
        priceMissing: !price,
        priceUsedFallback: price?.usedFallback ?? false,
      };
    }),
  };
}

export type RectSheetFormOptions = {
  templateOptions: RectSheetTemplateOption[];
  castingOptions: RectSheetCastingOption[];
  jobOptions: DrillSheetJobOption[];
  openingSizes: RectSheetOpeningSizeOption[];
};

export async function loadRectSheetFormOptions(
  priceListId: string | null = null,
): Promise<RectSheetFormOptions> {
  const [templates, castings, jobs, openingSizes, pricing] = await Promise.all([
    prisma.structureTemplate.findMany({
      where: { status: "ACTIVE", shape: "RECTANGULAR" },
      orderBy: { name: "asc" },
      include: {
        castingProduct: {
          select: { id: true, name: true, heightFeet: true },
        },
        rectSizes: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.product.findMany({
      where: { isCasting: true, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        heightFeet: true,
      },
    }),
    prisma.job.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, jobNumber: true, projectName: true },
    }),
    prisma.rectOpeningSize.findMany({ orderBy: { sortOrder: "asc" } }),
    loadStructurePricing(priceListId),
  ]);

  return {
    templateOptions: templates.map((template) => {
      const price = pricing.rectTemplates.get(template.id);
      return {
        id: template.id,
        name: template.name,
        agencyStandard: template.agencyStandard,
        wallThicknessInches: Number(template.wallThicknessInches),
        baseSlabThicknessInches: Number(template.baseSlabThicknessInches),
        topSlabThicknessInches: Number(template.topSlabThicknessInches),
        minimumBrickInches: Number(template.minimumBrickInches),
        sumpMode: template.sumpMode,
        sumpFixedInches:
          template.sumpFixedInches != null
            ? Number(template.sumpFixedInches)
            : null,
        wallPricePerFoot: price?.wallPricePerFoot ?? 0,
        minPricingHeightFeet:
          template.rectMinPricingHeightFeet != null
            ? Number(template.rectMinPricingHeightFeet)
            : 0,
        topSlabPrice: price?.topSlabPrice ?? 0,
        baseSlabPrice: price?.baseSlabPrice ?? 0,
        priceMissing: !price,
        priceUsedFallback: price?.usedFallback ?? false,
        defaultCastingProductId: template.castingProductId,
        defaultCastingHeightFeet: template.castingProduct?.heightFeet
          ? Number(template.castingProduct.heightFeet)
          : null,
        // Sizes are stored in whole inches; downstream calc and sheets work
        // in feet, rounded to 4 decimals to match JobStructureCalc storage.
        presetSizes: template.rectSizes.map((size) => ({
          id: size.id,
          insideLengthFeet: Math.round((size.insideLengthInches / 12) * 10000) / 10000,
          insideWidthFeet: Math.round((size.insideWidthInches / 12) * 10000) / 10000,
        })),
      };
    }),
    castingOptions: castings.map((casting) => ({
      id: casting.id,
      name: casting.name,
      heightFeet: casting.heightFeet ? Number(casting.heightFeet) : null,
    })),
    jobOptions: jobs.map((job) => ({
      id: job.id,
      label: `${job.jobNumber} — ${job.projectName}`,
    })),
    openingSizes: openingSizes.map((entry) => {
      const price = pricing.rectOpenings.get(entry.id);
      return {
        pipeMaterial: entry.pipeMaterial,
        pipeSizeInches: Number(entry.pipeSizeInches),
        openingWidthInches: Number(entry.openingWidthInches),
        openingHeightInches: Number(entry.openingHeightInches),
        pipeWallThicknessInches:
          Number(entry.pipeWallThicknessInches) > 0
            ? Number(entry.pipeWallThicknessInches)
            : null,
        pricePerOpening: price?.price ?? null,
        priceUsedFallback: price?.usedFallback ?? false,
      };
    }),
  };
}
