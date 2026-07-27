import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { SettingsFeedback } from "@/components/settings/settings-form-fields";
import {
  StructureDiameterConfigForm,
  type DiameterConfigRow,
} from "@/components/settings/structure-diameter-config-form";
import { SettingsShell } from "@/components/settings/settings-shell";
import { saveStructureDiameterConfigs } from "@/app/settings/diameters/actions";
import { prisma } from "@/lib/prisma";
import { listPriceListOptions } from "@/lib/price-list-service";

type StructureDiametersSettingsPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
    priceList?: string;
  }>;
};

export default async function StructureDiametersSettingsPage({
  searchParams,
}: StructureDiametersSettingsPageProps) {
  const params = await searchParams;
  const [configs, priceLists] = await Promise.all([
    prisma.structureDiameterConfig.findMany({
      orderBy: { sortOrder: "asc" },
    }),
    listPriceListOptions(),
  ]);

  const selectedPriceList =
    priceLists.find((list) => list.id === params.priceList) ??
    priceLists.find((list) => list.isDefault) ??
    priceLists[0] ??
    null;

  const priceEntries = selectedPriceList
    ? await prisma.diameterPriceListEntry.findMany({
        where: { priceListId: selectedPriceList.id },
      })
    : [];
  const entriesByConfig = new Map(
    priceEntries.map((entry) => [entry.diameterConfigId, entry]),
  );

  const defaultRows: DiameterConfigRow[] = configs.map((config) => {
    const entry = entriesByConfig.get(config.id);
    return {
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
      wallPricePerFoot: entry ? String(entry.wallPricePerFoot) : "",
      basePrice: entry ? String(entry.basePrice) : "",
    };
  });

  return (
    <SettingsShell
      title="Structure Molds"
      subtitle="One row per circular mold: wall thickness, max pour heights, and key height are shared; wall/base prices belong to the selected price list."
    >
      <SettingsFeedback
        error={params.error ? decodeURIComponent(params.error) : null}
        success={params.success ? "Settings saved." : null}
      />

      <SectionCard
        title="Mold Registry"
        description="Geometry is shared by every price list. Blank prices fall back to the default list on quotes."
        action={
          priceLists.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500">
                Price list:
              </span>
              {priceLists.map((list) => (
                <Link
                  key={list.id}
                  href={`/settings/diameters?priceList=${list.id}`}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                    list.id === selectedPriceList?.id
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {list.name}
                  {list.isDefault ? " ★" : ""}
                </Link>
              ))}
            </div>
          ) : null
        }
      >
        {selectedPriceList ? (
          <StructureDiameterConfigForm
            action={saveStructureDiameterConfigs}
            defaultRows={defaultRows}
            priceListId={selectedPriceList.id}
            priceListName={selectedPriceList.name}
          />
        ) : (
          <p className="text-xs text-slate-500">
            Create a price list first (Settings → Price Lists) — mold prices
            live on price lists.
          </p>
        )}
      </SectionCard>
    </SettingsShell>
  );
}
