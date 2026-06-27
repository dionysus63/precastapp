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
    insideDiameterFeet: String(config.insideDiameterFeet),
    maxBaseHeightFeet: String(config.maxBaseHeightFeet),
    maxRiserHeightFeet: String(config.maxRiserHeightFeet),
    keyHeightFeet: String(config.keyHeightFeet),
    wallPricePerFoot: String(config.wallPricePerFoot),
    basePrice: String(config.basePrice),
  }));

  return (
    <SettingsShell
      title="Structure Diameters"
      subtitle="Global mold limits, key heights, and pricing per inside diameter."
    >
      <SettingsFeedback
        error={params.error ? decodeURIComponent(params.error) : null}
        success={params.success ? "Settings saved." : null}
      />

      <SectionCard
        title="Per-Diameter Configuration"
        description="Maximum base and riser pour heights, key height (subtracted from top slab when key is removed), and pricing for drill sheet quotes."
      >
        <StructureDiameterConfigForm
          action={saveStructureDiameterConfigs}
          defaultRows={defaultRows}
        />
      </SectionCard>
    </SettingsShell>
  );
}
