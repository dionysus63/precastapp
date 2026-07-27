import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  RectOpeningSizesForm,
  type RectOpeningRow,
} from "@/components/structures/rect-opening-sizes-form";
import {
  PriceListSwitcher,
  pickSelectedPriceList,
} from "@/components/structures/price-list-switcher";
import { saveRectOpeningSizes } from "@/app/structures/rect-openings/actions";
import { prisma } from "@/lib/prisma";
import { listPriceListOptions } from "@/lib/price-list-service";

import { BackButton } from "@/components/dashboard/back-button";

type RectOpeningSizesPageProps = {
  searchParams: Promise<{ priceList?: string }>;
};

export default async function RectOpeningSizesPage({
  searchParams,
}: RectOpeningSizesPageProps) {
  const params = await searchParams;
  const [entries, priceLists] = await Promise.all([
    prisma.rectOpeningSize.findMany({
      orderBy: { sortOrder: "asc" },
    }),
    listPriceListOptions(),
  ]);
  const selectedPriceList = pickSelectedPriceList(priceLists, params.priceList);

  const priceEntries = selectedPriceList
    ? await prisma.rectOpeningPriceListEntry.findMany({
        where: { priceListId: selectedPriceList.id },
      })
    : [];
  const priceBySize = new Map(
    priceEntries.map((entry) => [
      entry.rectOpeningSizeId,
      entry.pricePerOpening,
    ]),
  );

  const defaultRows: RectOpeningRow[] = entries.map((entry) => ({
    id: entry.id,
    pipeMaterial: entry.pipeMaterial,
    pipeSizeInches: String(entry.pipeSizeInches),
    openingWidthInches: String(entry.openingWidthInches),
    openingHeightInches: String(entry.openingHeightInches),
    pipeWallThicknessInches:
      Number(entry.pipeWallThicknessInches) > 0
        ? String(entry.pipeWallThicknessInches)
        : "",
    pricePerOpening: (() => {
      const price = priceBySize.get(entry.id);
      return price != null ? String(price) : "";
    })(),
  }));

  return (
    <DashboardShell
      title="Rect Structure Openings"
      subtitle="Global catalog for rectangular sheets: pipe material/type + size → block-out opening width and height."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackButton href="/structures" label="Back to Structures" />
        <div className="flex flex-wrap items-center gap-3">
          <PriceListSwitcher
            priceLists={priceLists}
            selectedId={selectedPriceList?.id ?? null}
            basePath="/structures/rect-openings"
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
          <RectOpeningSizesForm
            action={saveRectOpeningSizes}
            defaultRows={defaultRows}
            priceListId={selectedPriceList.id}
            priceListName={selectedPriceList.name}
          />
        ) : (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
            Create a price list first (Settings → Price Lists) — opening
            prices live on price lists.
          </p>
        )}
      </div>
    </DashboardShell>
  );
}
