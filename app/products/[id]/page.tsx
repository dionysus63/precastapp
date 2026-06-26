import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ProductDocumentsSection } from "@/components/products/product-documents-section";
import {
  formatCastingPieceRoleLabel,
  formatCastingRoleLabel,
  formatCastingSupplierOriginLabel,
} from "@/lib/casting-utils";
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
      castingSupplier: true,
      castingAssemblyComponents: {
        orderBy: [{ sortOrder: "asc" }, { pieceRole: "asc" }],
        include: {
          component: {
            select: { id: true, productCode: true, name: true },
          },
        },
      },
      castingComponentOf: {
        include: {
          assembly: {
            select: { id: true, productCode: true, name: true },
          },
        },
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
          <Link
            href={`/products/${product.id}/edit`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Edit Product
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
            {product.castingRole ? (
              <>
                <DetailField
                  label="Casting Role"
                  value={formatCastingRoleLabel(product.castingRole)}
                />
                {product.castingPieceRole ? (
                  <DetailField
                    label="Piece Role"
                    value={formatCastingPieceRoleLabel(product.castingPieceRole)}
                  />
                ) : null}
                {product.castingSupplier ? (
                  <DetailField
                    label="Supplier"
                    value={`${product.castingSupplier.name} (${formatCastingSupplierOriginLabel(product.castingSupplier.origin)})`}
                  />
                ) : null}
                {product.isCasting && product.heightFeet ? (
                  <DetailField
                    label="Casting Height (ft)"
                    value={product.heightFeet.toString()}
                  />
                ) : null}
                {product.castingClearOpeningInches ? (
                  <DetailField
                    label="Clear Opening (in)"
                    value={product.castingClearOpeningInches.toString()}
                  />
                ) : null}
              </>
            ) : null}
          </dl>

          {product.castingAssemblyComponents.length > 0 ? (
            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Bill of Materials
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-slate-800">
                {product.castingAssemblyComponents.map((row) => (
                  <li key={row.id}>
                    {formatCastingPieceRoleLabel(row.pieceRole)} × {row.quantity}:{" "}
                    <Link
                      href={`/products/${row.component.id}`}
                      className="font-medium text-slate-900 underline"
                    >
                      {row.component.productCode} — {row.component.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {product.castingComponentOf.length > 0 ? (
            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Used In Assemblies
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-slate-800">
                {product.castingComponentOf.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/products/${row.assembly.id}`}
                      className="font-medium text-slate-900 underline"
                    >
                      {row.assembly.productCode} — {row.assembly.name}
                    </Link>{" "}
                    ({formatCastingPieceRoleLabel(row.pieceRole)})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <dl className="mt-5 grid gap-5">
            <DetailField label="Description" value={detail.description} />
            <DetailField label="Notes" value={detail.notes} />
          </dl>
        </SectionCard>

        <ProductDocumentsSection
          productId={product.id}
          productCode={detail.productCode}
          documents={detail.documents}
        />
      </div>
    </DashboardShell>
  );
}
