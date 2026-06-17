import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { ProductForm } from "@/components/products/product-form";
import { getProductById } from "@/components/products/product-utils";

type EditProductPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const product = getProductById(id);

  if (!product) {
    notFound();
  }

  return (
    <DashboardShell
      title={`Edit ${product.productName}`}
      subtitle="Update product catalog details."
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
            <ProductForm
              cancelHref="/products"
              submitLabel="Save Changes"
              defaultValues={{
                id: product.id,
                productCode: product.productCode,
                productName: product.productName,
                category: product.category,
                subcategory: product.subcategory,
                unit: product.unit,
                defaultPrice: product.defaultPrice,
                weight: product.weight,
                yards: product.yards,
                trackInventory: product.trackInventory ? "yes" : "no",
                notes: "",
              }}
            />
          </SectionCard>
        </div>
      </div>
    </DashboardShell>
  );
}
