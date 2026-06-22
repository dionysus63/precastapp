import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ProductsList } from "@/components/products/products-list";
import { mapProductToRow } from "@/lib/product-mapper";
import { getProductCatalog } from "@/lib/product-catalog-settings.server";
import { PRODUCT_SUBMITTAL_DOCUMENT_TYPES } from "@/lib/product-submittals-service";
import { prisma } from "@/lib/prisma";

export default async function ProductsPage() {
  const [products, catalog] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            documents: {
              where: {
                documentType: { in: PRODUCT_SUBMITTAL_DOCUMENT_TYPES },
              },
            },
          },
        },
      },
    }),
    getProductCatalog(),
  ]);

  const rows = products.map(mapProductToRow);

  return (
    <DashboardShell
      title="Products"
      subtitle="Manage precast product catalog, pricing, and inventory tracking."
    >
      <ProductsList products={rows} catalog={catalog} />
    </DashboardShell>
  );
}
