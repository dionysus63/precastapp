import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ProductDocumentsSection } from "@/components/products/product-documents-section";
import { mapProductToDetail } from "@/lib/product-mapper";
import { prisma } from "@/lib/prisma";

type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
};

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      documents: {
        orderBy: { uploadedAt: "desc" },
      },
    },
  });

  if (!product) {
    notFound();
  }

  const detail = mapProductToDetail(product, product.documents);

  return (
    <DashboardShell
      title={detail.productName}
      subtitle="Product catalog details and documents."
    >
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/products"
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            ← Back to Products
          </Link>
        </div>

        <SectionCard title="Product Information">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={detail.productTypeLabel}
              variant={detail.productTypeVariant}
            />
            <StatusBadge label={detail.status} variant={detail.statusVariant} />
          </div>

          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <DetailField label="Product Code" value={detail.productCode} />
            <DetailField label="Product Name" value={detail.productName} />
            <DetailField label="Product Type" value={detail.productTypeLabel} />
            <DetailField label="Category" value={detail.category} />
            <DetailField label="Unit" value={detail.unit} />
            <DetailField label="Default Price" value={detail.defaultPrice} />
            <DetailField label="Cost" value={detail.cost} />
            <DetailField label="Weight" value={detail.weight} />
            <DetailField label="Yards" value={detail.yards} />
            <DetailField label="Taxable" value={detail.taxable} />
            <DetailField
              label="Track Inventory"
              value={detail.trackInventory}
            />
            <DetailField
              label="Current Stock Quantity"
              value={detail.currentStockQuantity}
            />
            <DetailField label="Reorder Level" value={detail.reorderLevel} />
            <DetailField label="Yard Location" value={detail.yardLocation} />
            <DetailField label="Status" value={detail.status} />
          </dl>

          <dl className="mt-5 grid gap-5">
            <DetailField label="Description" value={detail.description} />
            <DetailField label="Notes" value={detail.notes} />
          </dl>
        </SectionCard>

        <ProductDocumentsSection documents={detail.documents} />
      </div>
    </DashboardShell>
  );
}
