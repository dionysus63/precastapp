import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DeliveryTicketEditor } from "@/components/delivery-tickets/delivery-ticket-editor";
import { listJobsWithQuotes } from "@/app/operations/actions";
import { listStockProductsForTicket } from "@/app/delivery-tickets/actions";
import { getAppSettings } from "@/lib/app-settings";
import { loadPriceListOptionsForForms } from "@/lib/price-list-service";
import { withDatabaseRetry } from "@/lib/prisma";
import { formatDateIso } from "@/lib/delivery-dispatch-utils";
import { castingAssemblyEditorKey } from "@/lib/casting-utils";
import { explodeAssemblyTicketLine } from "@/lib/casting-ticket-lines";
type EditDeliveryTicketPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
};

/** Origin keys the preview/entry pages pass; drives back + save returns. */
const EDIT_ORIGINS: Record<string, { href: string }> = {
  "walk-ins": { href: "/walk-ins" },
  hub: { href: "/delivery-tickets" },
  all: { href: "/delivery-tickets/all" },
  home: { href: "/" },
};

export default async function EditDeliveryTicketPage({
  params,
  searchParams,
}: EditDeliveryTicketPageProps) {
  const { id } = await params;
  const { from } = await searchParams;
  const origin = from ? EDIT_ORIGINS[from] : undefined;

  const [ticket, jobs, settings, priceListOptions, productGroups] =
    await Promise.all([
    withDatabaseRetry((prisma) =>
      prisma.deliveryTicket.findUnique({
        where: { id },
        include: {
          lineItems: {
            orderBy: { lineNumber: "asc" },
            include: {
              quoteLineItem: {
                select: {
                  isDrainRing: true,
                  // Casting BOM: whole-set assembly lines explode back into
                  // the editor's per-role piece rows, and legacy piece lines
                  // recover their role-based editor keys.
                  product: {
                    select: {
                      id: true,
                      castingRole: true,
                      castingSoldAsUnit: true,
                      castingAssemblyComponents: {
                        orderBy: { sortOrder: "asc" },
                        select: {
                          pieceRole: true,
                          quantity: true,
                          component: {
                            select: {
                              id: true,
                              productCode: true,
                              name: true,
                              weight: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ),
    listJobsWithQuotes(),
    getAppSettings(),
    loadPriceListOptionsForForms(),
    withDatabaseRetry((prisma) =>
      prisma.productGroup.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, parentId: true },
      }),
    ),
  ]);

  if (!ticket) {
    notFound();
  }

  if (ticket.status === "DELIVERED" || ticket.status === "CANCELLED") {
    redirect(`/delivery-tickets/${ticket.id}`);
  }

  // Catalog prices come from the ticket's own price list (default when none),
  // so reopening a ticket shows the same prices it was sold from.
  const products = await listStockProductsForTicket(ticket.priceListId);

  // Roles already claimed per quote line — a product serving two roles gets
  // its legacy piece lines keyed to successive roles.
  const usedCastingRoles = new Map<string, Set<string>>();

  const defaultLines = ticket.lineItems.flatMap((line) => {
    const assemblyProduct = line.quoteLineItem?.product;
    const castingBom =
      assemblyProduct?.castingRole === "ASSEMBLY" &&
      !assemblyProduct.castingSoldAsUnit
        ? assemblyProduct.castingAssemblyComponents
        : [];

    // Whole-set assembly line → the editor's per-role piece rows.
    if (
      line.quoteLineItemId &&
      line.productId &&
      castingBom.length > 0 &&
      line.productId === assemblyProduct!.id
    ) {
      const pieces = explodeAssemblyTicketLine(
        Number(line.quantity),
        castingBom.map((row) => ({
          productId: row.component.id,
          productCode: row.component.productCode,
          name: row.component.name,
          pieceRole: row.pieceRole,
          quantity: row.quantity,
          weightLb: row.component.weight ? Number(row.component.weight) : null,
        })),
      );
      return pieces.map((piece) => ({
        key: castingAssemblyEditorKey(line.quoteLineItemId!, piece.pieceRole),
        quoteLineItemId: line.quoteLineItemId,
        productId: piece.productId as string | null,
        jobStructureId: null as string | null,
        jobStructurePieceId: null as string | null,
        lineType: "STOCK_PRODUCT" as const,
        itemCode: piece.itemCode,
        description: piece.description,
        quantity: String(piece.quantity),
        unit: "EA",
        weightEach: piece.weightEach != null ? String(piece.weightEach) : "",
        unitPrice: "",
        yardLocation: "",
      }));
    }

    // Legacy per-piece casting line: recover its role-based editor key.
    let castingKey: string | null = null;
    if (line.quoteLineItemId && line.productId && castingBom.length > 0) {
      const used =
        usedCastingRoles.get(line.quoteLineItemId) ?? new Set<string>();
      const bomRow =
        castingBom.find(
          (row) =>
            row.component.id === line.productId && !used.has(row.pieceRole),
        ) ?? castingBom.find((row) => row.component.id === line.productId);
      if (bomRow) {
        used.add(bomRow.pieceRole);
        usedCastingRoles.set(line.quoteLineItemId, used);
        castingKey = castingAssemblyEditorKey(
          line.quoteLineItemId,
          bomRow.pieceRole,
        );
      }
    }

    return [
      {
        key:
          line.jobStructurePieceId && line.quoteLineItemId
            ? `${line.quoteLineItemId}::${line.jobStructurePieceId}`
            : line.quoteLineItem?.isDrainRing &&
                line.quoteLineItemId &&
                line.productId
              ? `${line.quoteLineItemId}::${line.productId}`
              : (castingKey ?? line.quoteLineItemId ?? line.id),
        quoteLineItemId: line.quoteLineItemId,
        productId: line.productId,
        jobStructureId: line.jobStructureId,
        jobStructurePieceId: line.jobStructurePieceId,
        lineType: line.lineType,
        itemCode: line.itemCode,
        description: line.description ?? "",
        quantity: line.quantity.toString(),
        unit: line.unit,
        weightEach: line.weightEach ? line.weightEach.toString() : "",
        unitPrice: line.unitPrice ? Number(line.unitPrice).toFixed(2) : "",
        yardLocation: line.yardLocation ?? "",
      },
    ];
  });

  return (
    <DashboardShell
      title={`Edit ${ticket.ticketNumber}`}
      subtitle="Update delivery ticket lines and schedule."
    >
      <div>
        <DeliveryTicketEditor
          backHref={
            origin
              ? `/delivery-tickets/${ticket.id}/preview?from=${from}`
              : `/delivery-tickets/${ticket.id}`
          }
          backLabel={origin ? "Back to Preview" : "Back to ticket"}
          returnTo={
            origin && from ? { key: from, href: origin.href } : undefined
          }
          mode="edit"
          ticketId={ticket.id}
          expectedUpdatedAt={ticket.updatedAt.toISOString()}
          jobs={jobs}
          products={products}
          priceListOptions={priceListOptions}
          productGroups={productGroups}
          fleetOptions={{
            drivers: settings.drivers,
            trailers: settings.trailers,
            loadCapacityLabel: settings.truckCapacityLabel,
          }}
          defaultValues={{
            ticketType: ticket.ticketType,
            // Saving from the leave dialog keeps the ticket's current status.
            status: ticket.status,
            fulfillmentMethod: ticket.fulfillmentMethod,
            priceListId: ticket.priceListId,
            paymentMethod: ticket.paymentMethod,
            paymentReceived: ticket.paymentReceived,
            pickedUpBy: ticket.pickedUpBy,
            jobId: ticket.jobId ?? "",
            quoteId: ticket.quoteId,
            customerId: ticket.customerId,
            customerName: ticket.customerName,
            projectName: ticket.projectName,
            deliveryAddress: ticket.deliveryAddress,
            deliveryDate: ticket.deliveryDate
              ? formatDateIso(ticket.deliveryDate)
              : null,
            deliveryTime: ticket.deliveryTime,
            driver: ticket.driver,
            trailer: ticket.trailer,
            lines: defaultLines,
          }}
        />
      </div>
    </DashboardShell>
  );
}
