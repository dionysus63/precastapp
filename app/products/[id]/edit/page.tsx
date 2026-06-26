import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { ProductForm } from "@/components/products/product-form";
import { updateProduct } from "@/app/products/actions";
import {
  listActiveCastingSuppliers,
  listCastingComponentProducts,
} from "@/lib/casting-service";
import { getProductCatalog } from "@/lib/product-catalog-settings.server";
import { prisma } from "@/lib/prisma";

type EditProductPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;

  const [product, catalog, castingSuppliers, castingComponents] =
    await Promise.all([
      prisma.product.findUnique({
        where: { id },
        include: {
          castingAssemblyComponents: {
            orderBy: [{ sortOrder: "asc" }, { pieceRole: "asc" }],
          },
        },
      }),
      getProductCatalog(),
      listActiveCastingSuppliers(prisma),
      listCastingComponentProducts(prisma),
    ]);

  if (!product) {
    notFound();
  }

  return (
    <DashboardShell
      title={`Edit ${product.name}`}
      subtitle="Update product catalog details."
    >
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/products/${product.id}`}
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Product
        </Link>

        <div className="mt-4">
          <SectionCard
            title="Product Details"
            description="Required fields are marked with an asterisk."
          >
            <ProductForm
              action={updateProduct}
              cancelHref={`/products/${product.id}`}
              submitLabel="Save Changes"
              catalog={catalog}
              productId={product.id}
              castingSuppliers={castingSuppliers}
              castingComponents={castingComponents.map((component) => ({
                id: component.id,
                productCode: component.productCode,
                name: component.name,
                castingPieceRole: component.castingPieceRole,
              }))}
              defaultValues={{
                productType: product.productType,
                productKind: product.productKind,
                productCode: product.productCode,
                productName: product.name,
                category: product.category,
                subcategory: product.description ?? "",
                unit: product.unit,
                defaultPrice: product.defaultPrice
                  ? product.defaultPrice.toString()
                  : "",
                weight: product.weight ? product.weight.toString() : "",
                yards: product.yards ? product.yards.toString() : "",
                trackInventory: product.trackInventory ? "yes" : "no",
                currentStockQuantity: String(product.currentStockQuantity),
                reorderLevel: String(product.reorderLevel),
                status: product.status,
                isDrainRing: product.isDrainRing ? "yes" : "no",
                heightFeet: product.heightFeet
                  ? product.heightFeet.toString()
                  : "",
                ringDiameterFeet: product.ringDiameterFeet
                  ? product.ringDiameterFeet.toString()
                  : "",
                drainRingStyle: product.drainRingStyle,
                isCasting: product.isCasting ? "yes" : "no",
                castingRole: product.castingRole ?? "",
                castingPieceRole: product.castingPieceRole ?? "",
                castingSupplierId: product.castingSupplierId ?? "",
                castingHeightFeet: product.heightFeet
                  ? product.heightFeet.toString()
                  : "",
                castingClearOpeningInches: product.castingClearOpeningInches
                  ? product.castingClearOpeningInches.toString()
                  : "",
                pipeDiameterInches: product.pipeDiameterInches
                  ? product.pipeDiameterInches.toString()
                  : "",
                pipeLengthFeet: product.pipeLengthFeet
                  ? product.pipeLengthFeet.toString()
                  : "",
                pipeClass: product.pipeClass ?? "",
                pipeJointType: product.pipeJointType ?? "",
                castingBom: product.castingAssemblyComponents.map((row) => ({
                  pieceRole: row.pieceRole,
                  componentId: row.componentId,
                  quantity: row.quantity,
                })),
                notes: product.notes ?? "",
              }}
            />
          </SectionCard>
        </div>
      </div>
    </DashboardShell>
  );
}
