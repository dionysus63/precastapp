import type {
  DrillSheetCastingOption,
  DrillSheetJobOption,
  DrillSheetTemplateOption,
} from "@/components/drill-sheets/drill-sheet-form";
import { prisma } from "@/lib/prisma";

export type DrillSheetFormOptions = {
  templateOptions: DrillSheetTemplateOption[];
  castingOptions: DrillSheetCastingOption[];
  jobOptions: DrillSheetJobOption[];
  pipeOpeningSizes: {
    pipeMaterial: string;
    pipeSizeInches: number;
    pipeType: string;
    holeDiameterInches: number;
    bootModel: string | null;
    pricePerBoot: number | null;
  }[];
  diameterConfigs: {
    insideDiameterFeet: number;
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
      holeDiameterInches: Number(entry.holeDiameterInches),
      bootModel: entry.bootModel,
      pricePerBoot:
        entry.pricePerBoot != null ? Number(entry.pricePerBoot) : null,
    })),
    diameterConfigs: diameterConfigs.map((config) => ({
      insideDiameterFeet: Number(config.insideDiameterFeet),
      maxBaseHeightFeet: Number(config.maxBaseHeightFeet),
      maxRiserHeightFeet: Number(config.maxRiserHeightFeet),
      keyHeightFeet: Number(config.keyHeightFeet),
      wallPricePerFoot: Number(config.wallPricePerFoot),
      basePrice: Number(config.basePrice),
    })),
  };
}
