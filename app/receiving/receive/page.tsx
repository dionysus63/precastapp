import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PurchaseReceiptForm } from "@/components/inventory/purchase-receipt-form";
import { PipeReceiptForm } from "@/components/receiving/pipe-receipt-form";
import type { PurchaseOrderReceiptOption } from "@/components/receiving/purchase-order-receipt-banner";
import { loadCastingAssembliesWithBom } from "@/lib/casting-service";
import { listOpenPurchaseOrders } from "@/lib/purchase-order-service";
import {
  castingOriginForCategory,
  formatReceivingCategoryLabel,
  isCastingReceivingCategory,
  isPipeReceivingCategory,
  parseReceivingCategory,
} from "@/lib/receiving-utils";
import { withDatabaseRetry } from "@/lib/prisma";

type ReceivePageProps = {
  searchParams: Promise<{ category?: string; po?: string }>;
};

function mapOpenPurchaseOrders(
  purchaseOrders: Awaited<ReturnType<typeof listOpenPurchaseOrders>>,
): PurchaseOrderReceiptOption[] {
  return purchaseOrders.map((po) => ({
    id: po.id,
    poNumber: po.poNumber,
    vendorName: po.vendor.name,
    lines: po.lines.map((line) => ({
      productId: line.productId,
      itemCode: line.itemCode,
      description: line.description,
      quantityOrdered: line.quantityOrdered,
      quantityReceived: line.quantityReceived,
    })),
  }));
}

export default async function ReceivePage({ searchParams }: ReceivePageProps) {
  const params = await searchParams;
  const category = parseReceivingCategory(params.category ?? "");
  if (!category) {
    notFound();
  }

  const categoryLabel = formatReceivingCategoryLabel(category);
  const lockedPoId = params.po?.trim() || null;

  const openPurchaseOrders = mapOpenPurchaseOrders(
    await withDatabaseRetry((client) =>
      listOpenPurchaseOrders(client, category),
    ),
  );

  const lockedPurchaseOrder = lockedPoId
    ? openPurchaseOrders.find((po) => po.id === lockedPoId) ??
      (await withDatabaseRetry(async (client) => {
        const po = await client.purchaseOrder.findUnique({
          where: { id: lockedPoId },
          select: {
            id: true,
            poNumber: true,
            category: true,
            status: true,
            vendor: { select: { name: true } },
            lines: {
              orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }],
              select: {
                productId: true,
                itemCode: true,
                description: true,
                quantityOrdered: true,
                quantityReceived: true,
              },
            },
          },
        });
        if (!po || po.category !== category) {
          return null;
        }
        return {
          id: po.id,
          poNumber: po.poNumber,
          vendorName: po.vendor.name,
          lines: po.lines,
        } satisfies PurchaseOrderReceiptOption;
      }))
    : null;

  if (isPipeReceivingCategory(category)) {
    const productType = category === "RCP" ? "PRECAST_PIPE" : "ADS_PIPE";
    const products = await withDatabaseRetry((client) =>
      client.product.findMany({
        where: {
          status: "ACTIVE",
          trackInventory: true,
          productType,
        },
        orderBy: { productCode: "asc" },
        select: {
          id: true,
          productCode: true,
          name: true,
          unit: true,
        },
      }),
    );

    return (
      <DashboardShell
        title={`Record ${categoryLabel}`}
        subtitle="Enter products and quantities received on this delivery."
      >
        <Link
          href="/receiving"
          className="mb-4 inline-block text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Receiving
        </Link>

        <PipeReceiptForm
          category={category}
          products={products}
          returnPath="/receiving"
          lockedPurchaseOrder={lockedPurchaseOrder}
          openPurchaseOrders={openPurchaseOrders}
        />
      </DashboardShell>
    );
  }

  if (isCastingReceivingCategory(category)) {
    const origin = castingOriginForCategory(category);
    if (!origin) {
      notFound();
    }
    const [products, allAssemblies, suppliers] = await withDatabaseRetry((client) =>
      Promise.all([
        client.product.findMany({
          where: {
            status: "ACTIVE",
            trackInventory: true,
            castingSupplier: { origin },
            OR: [
              { castingRole: "COMPONENT" },
              { castingRole: "ASSEMBLY", castingSoldAsUnit: true },
            ],
          },
          orderBy: { productCode: "asc" },
          select: {
            id: true,
            productCode: true,
            name: true,
            unit: true,
            castingPieceRole: true,
            castingRole: true,
            castingSoldAsUnit: true,
            manufacturerCode: true,
            castingSupplierId: true,
          },
        }),
        loadCastingAssembliesWithBom(client),
        client.castingSupplier.findMany({
          where: { status: "ACTIVE", origin },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true, origin: true },
        }),
      ]),
    );

    const supplierIds = new Set(suppliers.map((supplier) => supplier.id));
    const assemblies = allAssemblies.filter(
      (assembly) =>
        assembly.castingSupplierId && supplierIds.has(assembly.castingSupplierId),
    );

    return (
      <DashboardShell
        title={`Record ${categoryLabel}`}
        subtitle="Record purchased cast iron inventory received from suppliers."
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link
            href="/receiving"
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            ← Back to Receiving
          </Link>
          <Link
            href={`/inventory/receipts?category=${category}`}
            className="text-xs font-medium text-slate-700 underline hover:text-slate-900"
          >
            View receipt history
          </Link>
        </div>

        <PurchaseReceiptForm
          products={products.map((product) => ({
            ...product,
            castingPieceRole: product.castingPieceRole,
          }))}
          assemblies={assemblies.map((assembly) => ({
            id: assembly.id,
            productCode: assembly.productCode,
            name: assembly.name,
            manufacturerCode: assembly.manufacturerCode,
            castingSupplierId: assembly.castingSupplierId,
            components: assembly.castingAssemblyComponents.map((row) => ({
              pieceRole: row.pieceRole,
              quantity: row.quantity,
              component: row.component,
            })),
          }))}
          suppliers={suppliers}
          category={category}
          returnPath="/receiving"
          lockedPurchaseOrder={lockedPurchaseOrder}
          openPurchaseOrders={openPurchaseOrders}
        />
      </DashboardShell>
    );
  }

  notFound();
}
