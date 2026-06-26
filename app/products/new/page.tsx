import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { ProductForm } from "@/components/products/product-form";
import {
  listActiveCastingSuppliers,
  listCastingComponentProducts,
} from "@/lib/casting-service";
import { getProductCatalog } from "@/lib/product-catalog-settings.server";
import { prisma } from "@/lib/prisma";
import { createProduct } from "../actions";

export default async function NewProductPage() {
  const [catalog, castingSuppliers, castingComponents] = await Promise.all([
    getProductCatalog(),
    listActiveCastingSuppliers(prisma),
    listCastingComponentProducts(prisma),
  ]);

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
              catalog={catalog}
              castingSuppliers={castingSuppliers}
              castingComponents={castingComponents.map((component) => ({
                id: component.id,
                productCode: component.productCode,
                name: component.name,
                castingPieceRole: component.castingPieceRole,
              }))}
            />
          </SectionCard>
        </div>
      </div>
    </DashboardShell>
  );
}
