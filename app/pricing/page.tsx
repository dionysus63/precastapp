import Link from "next/link";
import { AppPermission } from "@/app/generated/prisma/client";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DiscountRulesGrid } from "@/components/pricing/discount-rules-grid";
import { PricingGrid } from "@/components/pricing/pricing-grid";
import { TabBar, TabLink } from "@/components/ui/tabs";
import { hasPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDateShort } from "@/lib/format";
import { parseStringParam, type RawSearchParams } from "@/lib/list-params";
import { withDatabaseRetry } from "@/lib/prisma";
import {
  DISCOUNT_GROUP_KEYS,
  type DiscountGroupKey,
} from "@/lib/pricing/discount-groups";
import {
  loadDiscountGroupCounts,
  loadDiscountRateTable,
  loadPricingRows,
} from "@/lib/pricing/pricing-data";
import { selectedClassName } from "@/lib/selected-styles";

/** The price sheets, in the order the tabs show them. */
const PRICE_TABS: Array<{
  slug: string;
  label: string;
  group: DiscountGroupKey;
  priceLabel: string;
}> = [
  { slug: "stock-precast", label: "Stock Precast", group: "STOCK_PRECAST", priceLabel: "List Price" },
  { slug: "iron-imported", label: "Cast Iron, Imported", group: "CASTING_IMPORTED", priceLabel: "List Price" },
  { slug: "iron-domestic", label: "Cast Iron, Domestic", group: "CASTING_DOMESTIC", priceLabel: "List Price" },
  { slug: "ads-pipe", label: "ADS Pipe", group: "ADS_PIPE", priceLabel: "List Price per Foot" },
  { slug: "rcp-pipe", label: "RCP Pipe", group: "RCP_PIPE", priceLabel: "List Price per Foot" },
  { slug: "other", label: "Other Products", group: "OTHER", priceLabel: "List Price" },
];

const DISCOUNTS_TAB = "discounts";

function pricingHref(priceListId: string, tab: string): string {
  const params = new URLSearchParams({ list: priceListId, tab });
  return `/pricing?${params.toString()}`;
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const listParam = parseStringParam(params.list);
  const tabParam = parseStringParam(params.tab);

  const priceLists = await withDatabaseRetry((prisma) =>
    prisma.priceList.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isDefault: true, effectiveDate: true },
    }),
  );

  if (priceLists.length === 0) {
    return (
      <DashboardShell title="Pricing">
        <p className="text-sm text-slate-600">
          There is no price list yet.{" "}
          <Link href="/settings/price-lists" className="font-medium text-sky-700 hover:underline">
            Create one in Settings, Price Lists
          </Link>
          , then come back here to fill in prices.
        </p>
      </DashboardShell>
    );
  }

  const priceList =
    priceLists.find((list) => list.id === listParam) ??
    priceLists.find((list) => list.isDefault) ??
    priceLists[0];
  const activeTab =
    tabParam === DISCOUNTS_TAB
      ? null
      : (PRICE_TABS.find((tab) => tab.slug === tabParam) ?? PRICE_TABS[0]);

  const user = await getCurrentUser();
  const [canEditPrices, canEditDiscounts] = user
    ? await Promise.all([
        hasPermission(user, AppPermission.PRODUCTS_MANAGE),
        hasPermission(user, AppPermission.SETTINGS_MANAGE),
      ])
    : [false, false];

  const { rates, counts, rows } = await withDatabaseRetry(async (prisma) => {
    // Sequential on purpose: one connection, one query at a time.
    const loadedRates = await loadDiscountRateTable(prisma);
    const loadedCounts = await loadDiscountGroupCounts(priceList.id, prisma);
    const loadedRows = activeTab
      ? await loadPricingRows(activeTab.group, priceList.id, prisma)
      : [];
    return { rates: loadedRates, counts: loadedCounts, rows: loadedRows };
  });

  const productCounts = Object.fromEntries(
    DISCOUNT_GROUP_KEYS.map((group) => [group, counts[group].products]),
  ) as Record<DiscountGroupKey, number>;

  return (
    <DashboardShell title="Pricing">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-price-list-picker>
          <span className="text-2xs font-semibold uppercase tracking-wide text-slate-600">
            Price list
          </span>
          <div className="flex flex-wrap gap-1.5">
            {priceLists.map((list) => {
              const active = list.id === priceList.id;
              return (
                <Link
                  key={list.id}
                  href={pricingHref(list.id, activeTab?.slug ?? DISCOUNTS_TAB)}
                  aria-current={active ? "true" : undefined}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    active
                      ? selectedClassName
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {list.name}
                  {list.isDefault ? " (default)" : ""}
                </Link>
              );
            })}
          </div>
          {priceList.effectiveDate ? (
            <span className="text-xs text-slate-500">
              Effective {formatDateShort(new Date(priceList.effectiveDate))}
            </span>
          ) : null}
          <Link
            href="/settings/price-lists"
            className="rounded-lg btn-plain px-3 py-1 text-xs font-medium"
          >
            New or copied price list
          </Link>
        </div>

        <TabBar label="Price sheets">
          {PRICE_TABS.map((tab) => (
            <TabLink
              key={tab.slug}
              href={pricingHref(priceList.id, tab.slug)}
              active={activeTab?.slug === tab.slug}
              count={counts[tab.group].products}
            >
              {tab.label}
            </TabLink>
          ))}
          <TabLink href={pricingHref(priceList.id, DISCOUNTS_TAB)} active={activeTab == null}>
            Discounts
          </TabLink>
        </TabBar>

        {activeTab ? (
          <PricingGrid
            // A fresh grid per list and tab: what was typed belongs to one sheet.
            key={`${priceList.id}:${activeTab.slug}`}
            priceListId={priceList.id}
            rows={rows}
            rates={rates[activeTab.group]}
            priceLabel={activeTab.priceLabel}
            canEdit={canEditPrices}
          />
        ) : (
          <DiscountRulesGrid
            rates={rates}
            productCounts={productCounts}
            canEdit={canEditDiscounts}
          />
        )}
      </div>
    </DashboardShell>
  );
}
