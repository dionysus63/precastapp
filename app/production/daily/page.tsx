import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DailyProductionEntry } from "@/components/production/daily-production-entry";
import {
  getProductionDayEntries,
  getStockProductsForDaily,
  getStructuresInProductionForDaily,
  parseProductionDate,
} from "@/lib/daily-production-service";
import { requireAuth } from "@/lib/auth/session";
import { listProductTaxonomy } from "@/lib/product-taxonomy.server";
import { withDatabaseRetry } from "@/lib/prisma";

type DailyProductionPageProps = {
  searchParams: Promise<{ date?: string }>;
};

export default async function DailyProductionPage({
  searchParams,
}: DailyProductionPageProps) {
  const { date } = await searchParams;
  const user = await requireAuth();
  const productionDate = parseProductionDate(date);
  const dateIso = productionDate.toISOString().slice(0, 10);

  const [structures, dayEntries, products, taxonomy] = await Promise.all([
    withDatabaseRetry((client) => getStructuresInProductionForDaily(client)),
    withDatabaseRetry((client) =>
      getProductionDayEntries(client, productionDate),
    ),
    withDatabaseRetry((client) => getStockProductsForDaily(client)),
    listProductTaxonomy(),
  ]);

  return (
    <DashboardShell
      title="Daily Production"
      subtitle="Record what the yard made — job structures and stock. Everyone saves their own entry; entries add together per day."
    >
      <div className="mt-4">
        <DailyProductionEntry
          date={dateIso}
          userName={user.displayName}
          structures={structures}
          dayEntries={dayEntries}
          products={products}
          categories={taxonomy.map((category) => ({
            id: category.id,
            name: category.name,
            subcategories: category.subcategories.map((subcategory) => ({
              id: subcategory.id,
              name: subcategory.name,
            })),
          }))}
        />
      </div>
    </DashboardShell>
  );
}
