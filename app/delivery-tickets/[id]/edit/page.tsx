import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DeliveryTicketEditor } from "@/components/delivery-tickets/delivery-ticket-editor";
import { listJobsWithQuotes } from "@/app/operations/actions";
import { listStockProductsForTicket } from "@/app/delivery-tickets/actions";
import { getAppSettings } from "@/lib/app-settings";
import { withDatabaseRetry } from "@/lib/prisma";
import { formatDateIso } from "@/lib/delivery-dispatch-utils";

import { BackButton } from "@/components/dashboard/back-button";
type EditDeliveryTicketPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditDeliveryTicketPage({
  params,
}: EditDeliveryTicketPageProps) {
  const { id } = await params;

  const [ticket, jobs, products, settings] = await Promise.all([
    withDatabaseRetry((prisma) =>
      prisma.deliveryTicket.findUnique({
        where: { id },
        include: {
          lineItems: {
            orderBy: { lineNumber: "asc" },
            include: {
              quoteLineItem: { select: { isDrainRing: true } },
            },
          },
        },
      }),
    ),
    listJobsWithQuotes(),
    listStockProductsForTicket(),
    getAppSettings(),
  ]);

  if (!ticket) {
    notFound();
  }

  if (ticket.status === "DELIVERED" || ticket.status === "CANCELLED") {
    redirect(`/delivery-tickets/${ticket.id}`);
  }

  const defaultLines = ticket.lineItems.map((line) => ({
    key:
      line.jobStructurePieceId && line.quoteLineItemId
        ? `${line.quoteLineItemId}::${line.jobStructurePieceId}`
        : line.quoteLineItem?.isDrainRing && line.quoteLineItemId && line.productId
          ? `${line.quoteLineItemId}::${line.productId}`
          : line.quoteLineItemId ?? line.id,
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
    yardLocation: line.yardLocation ?? "",
  }));

  return (
    <DashboardShell
      title={`Edit ${ticket.ticketNumber}`}
      subtitle="Update delivery ticket lines and schedule."
    >
      <BackButton href={`/delivery-tickets/${ticket.id}`} label="Back to ticket" />

      <div className="mt-4">
        <DeliveryTicketEditor
          mode="edit"
          ticketId={ticket.id}
          expectedUpdatedAt={ticket.updatedAt.toISOString()}
          jobs={jobs}
          products={products}
          fleetOptions={{
            drivers: settings.drivers,
            trailers: settings.trailers,
            loadCapacityLabel: settings.truckCapacityLabel,
          }}
          defaultValues={{
            ticketType: ticket.ticketType,
            fulfillmentMethod: ticket.fulfillmentMethod,
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
