import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { ProductForm } from "@/components/products/product-form";
import {
  listActiveCastingSuppliers,
  listCastingComponentProducts,
  mapCastingComponentsForForm,
} from "@/lib/casting-service";
import { listProductTaxonomy } from "@/lib/product-taxonomy.server";
import { getDefaultPriceListId, loadPriceListOptionsForForms } from "@/lib/price-list-service";
import { prisma } from "@/lib/prisma";
import { createProduct } from "../actions";

export default async function NewProductPage() {
  const [taxonomy, castingSuppliers, priceLists, defaultPriceListId] =
    await Promise.all([
      listProductTaxonomy(),
      listActiveCastingSuppliers(prisma),
      loadPriceListOptionsForForms(),
      getDefaultPriceListId(prisma),
    ]);
  const castingComponents = mapCastingComponentsForForm(
    await listCastingComponentProducts(prisma, defaultPriceListId),
  );

  return (
    <DashboardShell
      title="New Product"
      subtitle="Add a product to your precast catalog."
    >
      <div className="mx-auto max-w-3xl">
        <Link
          href="/products"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Products
        </Link>

        <div className="mt-4">
          <SectionCard
            title="Product Details"
            description="Required fields are marked with an asterisk."
          >
            <ProductForm
              action={createProduct}
              cancelHref="/products"
              submitLabel="Save Product"
              taxonomy={taxonomy}
              priceLists={priceLists}
              castingSuppliers={castingSuppliers}
              castingComponents={castingComponents}
            />
          </SectionCard>
        </div>
      </div>
    </DashboardShell>
  );
}
