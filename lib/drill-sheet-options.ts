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
  }[];
};

export async function loadDrillSheetFormOptions(): Promise<DrillSheetFormOptions> {
  const [templates, castings, jobs, pipeOpeningSizes, diameterConfigs] =
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
    pipeOpeningSizes: pipeOpeningSizes.map((entry) => ({
      pipeMaterial: entry.pipeMaterial,
      pipeSizeInches: Number(entry.pipeSizeInches),
      pipeType: entry.pipeType,
      hasBoot: entry.hasBoot,
      holeDiameterInches: Number(entry.holeDiameterInches),
      pipeWallThicknessInches: Number(entry.pipeWallThicknessInches),
      bootModel: entry.bootModel,
      pricePerBoot:
        entry.pricePerBoot != null ? Number(entry.pricePerBoot) : null,
    })),
    diameterConfigs: diameterConfigs.map((config) => ({
      label: config.label,
      insideDiameterFeet: Number(config.insideDiameterFeet),
      wallThicknessInches:
        config.wallThicknessInches != null
          ? Number(config.wallThicknessInches)
          : null,
      maxBaseHeightFeet: Number(config.maxBaseHeightFeet),
      maxRiserHeightFeet: Number(config.maxRiserHeightFeet),
      keyHeightFeet: Number(config.keyHeightFeet),
      wallPricePerFoot: Number(config.wallPricePerFoot),
      basePrice: Number(config.basePrice),
    })),
  };
}

export type RectSheetFormOptions = {
  templateOptions: RectSheetTemplateOption[];
  castingOptions: RectSheetCastingOption[];
  jobOptions: DrillSheetJobOption[];
  openingSizes: RectSheetOpeningSizeOption[];
};

export async function loadRectSheetFormOptions(): Promise<RectSheetFormOptions> {
  const [templates, castings, jobs, openingSizes] = await Promise.all([
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
  ]);

  return {
    templateOptions: templates.map((template) => ({
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
      wallPricePerFoot:
        template.rectWallPricePerFoot != null
          ? Number(template.rectWallPricePerFoot)
          : 0,
      minPricingHeightFeet:
        template.rectMinPricingHeightFeet != null
          ? Number(template.rectMinPricingHeightFeet)
          : 0,
      topSlabPrice:
        template.rectTopSlabPrice != null
          ? Number(template.rectTopSlabPrice)
          : 0,
      baseSlabPrice:
        template.rectBaseSlabPrice != null
          ? Number(template.rectBaseSlabPrice)
          : 0,
      defaultCastingProductId: template.castingProductId,
      defaultCastingHeightFeet: template.castingProduct?.heightFeet
        ? Number(template.castingProduct.heightFeet)
        : null,
      presetSizes: template.rectSizes.map((size) => ({
        id: size.id,
        insideLengthFeet: Number(size.insideLengthFeet),
        insideWidthFeet: Number(size.insideWidthFeet),
      })),
    })),
    castingOptions: castings.map((casting) => ({
      id: casting.id,
      name: casting.name,
      heightFeet: casting.heightFeet ? Number(casting.heightFeet) : null,
    })),
    jobOptions: jobs.map((job) => ({
      id: job.id,
      label: `${job.jobNumber} — ${job.projectName}`,
    })),
    openingSizes: openingSizes.map((entry) => ({
      pipeMaterial: entry.pipeMaterial,
      pipeSizeInches: Number(entry.pipeSizeInches),
      openingWidthInches: Number(entry.openingWidthInches),
      openingHeightInches: Number(entry.openingHeightInches),
      pipeWallThicknessInches:
        Number(entry.pipeWallThicknessInches) > 0
          ? Number(entry.pipeWallThicknessInches)
          : null,
      pricePerOpening:
        entry.pricePerOpening != null ? Number(entry.pricePerOpening) : null,
    })),
  };
}
