import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  PipeOpeningSizesForm,
  type PipeOpeningRow,
} from "@/components/structures/pipe-opening-sizes-form";
import {
  PriceListSwitcher,
  pickSelectedPriceList,
} from "@/components/structures/price-list-switcher";
import { savePipeOpeningSizes } from "@/app/structures/pipe-openings/actions";
import { prisma } from "@/lib/prisma";
import { listPriceListOptions } from "@/lib/price-list-service";

import { BackButton } from "@/components/dashboard/back-button";

type PipeOpeningSizesPageProps = {
  searchParams: Promise<{ priceList?: string }>;
};

export default async function PipeOpeningSizesPage({
  searchParams,
}: PipeOpeningSizesPageProps) {
  const params = await searchParams;
  const [entries, priceLists] = await Promise.all([
    prisma.pipeOpeningSize.findMany({
      orderBy: { sortOrder: "asc" },
    }),
    listPriceListOptions(),
  ]);
  const selectedPriceList = pickSelectedPriceList(priceLists, params.priceList);

  const priceEntries = selectedPriceList
    ? await prisma.pipeOpeningPriceListEntry.findMany({
        where: { priceListId: selectedPriceList.id },
      })
    : [];
  const priceBySize = new Map(
    priceEntries.map((entry) => [entry.pipeOpeningSizeId, entry.pricePerBoot]),
  );

  const defaultRows: PipeOpeningRow[] = entries.map((entry) => ({
    id: entry.id,
    // Legacy rows kept material and type separate; show them combined.
    pipeMaterial: [entry.pipeMaterial, entry.pipeType]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" "),
    pipeSizeInches: String(entry.pipeSizeInches),
    hasBoot: entry.hasBoot,
    holeDiameterInches: String(entry.holeDiameterInches),
    pipeWallThicknessInches:
      Number(entry.pipeWallThicknessInches) > 0
        ? String(entry.pipeWallThicknessInches)
        : "",
    bootModel: entry.bootModel ?? "",
    pricePerBoot: (() => {
      const price = priceBySize.get(entry.id);
      return price != null ? String(price) : "";
    })(),
  }));

  return (
    <DashboardShell
      title="Round Structure Openings"
      subtitle="Global catalog for circular drill sheets: pipe material/type, size, and boot → hole diameter, pipe wall, boot model, and price."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackButton href="/structures" label="Back to Structures" />
        <div className="flex flex-wrap items-center gap-3">
          <PriceListSwitcher
            priceLists={priceLists}
            selectedId={selectedPriceList?.id ?? null}
            basePath="/structures/pipe-openings"
          />
          <Link
            href="/structures/import"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Bulk Import
          </Link>
        </div>
      </div>

      <div className="mt-4">
        {selectedPriceList ? (
          <PipeOpeningSizesForm
            action={savePipeOpeningSizes}
            defaultRows={defaultRows}
            priceListId={selectedPriceList.id}
            priceListName={selectedPriceList.name}
          />
        ) : (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
            Create a price list first (Settings → Price Lists) — boot prices
            live on price lists.
          </p>
        )}
      </div>
    </DashboardShell>
  );
}
