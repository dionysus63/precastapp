import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { ProductForm } from "@/components/products/product-form";
import { updateProduct } from "@/app/products/actions";
import {
  listActiveCastingSuppliers,
  listCastingComponentProducts,
  mapCastingComponentsForForm,
} from "@/lib/casting-service";
import { listProductTaxonomy } from "@/lib/product-taxonomy.server";
import { getDefaultPriceListId, loadPriceListOptionsForForms } from "@/lib/price-list-service";
import { prisma } from "@/lib/prisma";

import { BackButton } from "@/components/dashboard/back-button";
type EditProductPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;

  const [product, taxonomy, castingSuppliers, priceLists, defaultPriceListId] =
    await Promise.all([
      prisma.product.findUnique({
        where: { id },
        include: {
          productCategory: { select: { id: true, name: true } },
          subcategory: { select: { id: true, name: true } },
          castingAssemblyComponents: {
            orderBy: [{ sortOrder: "asc" }, { pieceRole: "asc" }],
          },
        },
      }),
      listProductTaxonomy(),
      listActiveCastingSuppliers(prisma),
      loadPriceListOptionsForForms(),
      getDefaultPriceListId(prisma),
    ]);

  if (!product) {
    notFound();
  }

  const selectedPriceListId =
    priceLists.find((list) => list.isDefault)?.id ??
    defaultPriceListId ??
    priceLists[0]?.id ??
    "";

  const [priceListItem, castingComponents] = await Promise.all([
    selectedPriceListId
      ? prisma.priceListItem.findUnique({
          where: {
            priceListId_productId: {
              priceListId: selectedPriceListId,
              productId: product.id,
            },
          },
          select: { unitPrice: true, priceListId: true },
        })
      : Promise.resolve(null),
    listCastingComponentProducts(prisma, selectedPriceListId).then(
      mapCastingComponentsForForm,
    ),
  ]);

  return (
    <DashboardShell
      title={`Edit ${product.name}`}
      subtitle="Update product catalog details."
    >
      <div className="mx-auto max-w-3xl">
        <BackButton href={`/products/${product.id}`} label="Back to Product" />

        <div className="mt-4">
          <SectionCard
            title="Product Details"
            description="Required fields are marked with an asterisk."
          >
            <ProductForm
              action={updateProduct}
              cancelHref={`/products/${product.id}`}
              submitLabel="Save Changes"
              taxonomy={taxonomy}
              priceLists={priceLists}
              productId={product.id}
              expectedUpdatedAt={product.updatedAt.toISOString()}
              castingSuppliers={castingSuppliers}
              castingComponents={castingComponents}
              defaultValues={{
                productType: product.productType,
                productKind: product.productKind,
                productCode: product.productCode,
                productName: product.name,
                categoryId: product.categoryId,
                subcategoryId: product.subcategoryId ?? "",
                description: product.description ?? "",
                unit: product.unit,
                unitPrice: priceListItem?.unitPrice
                  ? priceListItem.unitPrice.toString()
                  : "",
                priceListId: priceListItem?.priceListId ?? selectedPriceListId,
                weight: product.weight ? product.weight.toString() : "",
                yards: product.yards ? product.yards.toString() : "",
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
                galleyFamilyCode: product.galleyFamilyCode ?? "",
                galleyType: product.galleyType ?? "",
                isCasting: product.isCasting ? "yes" : "no",
                castingRole: product.castingRole ?? "",
                castingPieceRole: product.castingPieceRole ?? "",
                castingSupplierId: product.castingSupplierId ?? "",
                manufacturerCode: product.manufacturerCode ?? "",
                castingSoldAsUnit: product.castingSoldAsUnit,
                castingHeightFeet: product.heightFeet
                  ? product.heightFeet.toString()
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
