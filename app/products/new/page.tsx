import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { ProductForm } from "@/components/products/product-form";

export default function NewProductPage() {
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
            description="Static preview form — saving is not connected yet."
          >
            <ProductForm cancelHref="/products" submitLabel="Save Product" />
          </SectionCard>
        </div>
      </div>
    </DashboardShell>
  );
}
