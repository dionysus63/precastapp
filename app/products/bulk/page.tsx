import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { BulkPasteForm } from "@/components/products/bulk-paste-form";
import { listActiveCastingSuppliers } from "@/lib/casting-service";
import { loadPriceListOptionsForForms } from "@/lib/price-list-service";
import { listProductTaxonomy } from "@/lib/product-taxonomy.server";
import { prisma } from "@/lib/prisma";

export default async function BulkProductsPage() {
  const [priceLists, taxonomy, castingSuppliers] = await Promise.all([
    loadPriceListOptionsForForms(),
    listProductTaxonomy(),
    listActiveCastingSuppliers(prisma),
  ]);

  return (
    <DashboardShell
      title="Bulk Add Products"
      subtitle="Paste product rows copied from Excel and preview them before import."
    >
      <div className="mx-auto max-w-6xl">
        <Link
          href="/products"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Products
        </Link>

        <div className="mt-4">
          <BulkPasteForm
            priceLists={priceLists}
            taxonomy={taxonomy}
            castingSuppliers={castingSuppliers}
          />
        </div>
      </div>
    </DashboardShell>
  );
}
