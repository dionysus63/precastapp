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
};

/**
 * Loads the template, casting, and job choices used by the drill sheet form.
 * Shared by the new and edit pages so both stay in sync.
 */
export async function loadDrillSheetFormOptions(): Promise<DrillSheetFormOptions> {
  const [templates, castings, jobs] = await Promise.all([
    prisma.structureTemplate.findMany({
      where: { status: "ACTIVE", shape: "CIRCULAR" },
      orderBy: { name: "asc" },
      include: {
        bootSizes: { orderBy: { pipeDiameterInches: "asc" } },
        diameters: {
          orderBy: { sortOrder: "asc" },
          include: { sections: { orderBy: { sortOrder: "asc" } } },
        },
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
  ]);

  const templateOptions: DrillSheetTemplateOption[] = templates.map(
    (template) => ({
      id: template.id,
      name: template.name,
      agencyStandard: template.agencyStandard,
      minimumBrickFeet: Number(template.minimumBrickFeet),
      keyClearanceFeet: Number(template.keyClearanceFeet),
      bootSizes: template.bootSizes.map((boot) => ({
        pipeDiameterInches: Number(boot.pipeDiameterInches),
        holeDiameterInches: Number(boot.holeDiameterInches),
      })),
      diameters: template.diameters.map((diameter) => ({
        id: diameter.id,
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
      })),
    }),
  );

  const castingOptions: DrillSheetCastingOption[] = castings.map((casting) => ({
    id: casting.id,
    name: casting.name,
    heightFeet: casting.heightFeet ? Number(casting.heightFeet) : null,
  }));

  const jobOptions: DrillSheetJobOption[] = jobs.map((job) => ({
    id: job.id,
    label: `${job.jobNumber} — ${job.projectName}`,
  }));

  return { templateOptions, castingOptions, jobOptions };
}
