import { SectionCard } from "@/components/dashboard/section-card";
import { SettingsFeedback } from "@/components/settings/settings-form-fields";
import {
  StructureDiameterConfigForm,
  type DiameterConfigRow,
} from "@/components/settings/structure-diameter-config-form";
import { SettingsShell } from "@/components/settings/settings-shell";
import { saveStructureDiameterConfigs } from "@/app/settings/diameters/actions";
import { prisma } from "@/lib/prisma";

type StructureDiametersSettingsPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function StructureDiametersSettingsPage({
  searchParams,
}: StructureDiametersSettingsPageProps) {
  const params = await searchParams;
  const configs = await prisma.structureDiameterConfig.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const defaultRows: DiameterConfigRow[] = configs.map((config) => ({
    id: config.id,
    label: config.label ?? "",
    insideDiameterFeet: String(config.insideDiameterFeet),
    wallThicknessInches:
      config.wallThicknessInches != null
        ? String(config.wallThicknessInches)
        : "",
    maxBaseHeightFeet: String(config.maxBaseHeightFeet),
    maxRiserHeightFeet: String(config.maxRiserHeightFeet),
    keyHeightFeet: String(config.keyHeightFeet),
    wallPricePerFoot: String(config.wallPricePerFoot),
    basePrice: String(config.basePrice),
  }));

  return (
    <SettingsShell
      title="Structure Molds"
      subtitle="One row per circular mold: wall thickness, max pour heights, key height, and pricing per inside diameter."
    >
      <SettingsFeedback
        error={params.error ? decodeURIComponent(params.error) : null}
        success={params.success ? "Settings saved." : null}
      />

      <SectionCard
        title="Mold Registry"
        description="Wall thickness and maximum base/riser pour heights are constants of each mold. Circular templates can only offer diameters that exist here, and drill sheets inherit the mold's limits."
      >
        <StructureDiameterConfigForm
          action={saveStructureDiameterConfigs}
          defaultRows={defaultRows}
        />
      </SectionCard>
    </SettingsShell>
  );
}
