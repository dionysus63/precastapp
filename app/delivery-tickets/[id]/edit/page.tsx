import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DeliveryTicketEditor } from "@/components/delivery-tickets/delivery-ticket-editor";
import { listJobsWithQuotes } from "@/app/operations/actions";
import { getAppSettings } from "@/lib/app-settings";
import { withDatabaseRetry } from "@/lib/prisma";
import { formatDateIso } from "@/lib/delivery-dispatch-utils";

type EditDeliveryTicketPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditDeliveryTicketPage({
  params,
}: EditDeliveryTicketPageProps) {
  const { id } = await params;

  const [ticket, jobs, settings] = await Promise.all([
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
      line.quoteLineItem?.isDrainRing && line.quoteLineItemId && line.productId
        ? `${line.quoteLineItemId}::${line.productId}`
        : line.quoteLineItemId ?? line.id,
    quoteLineItemId: line.quoteLineItemId,
    productId: line.productId,
    jobStructureId: line.jobStructureId,
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
      <Link
        href={`/delivery-tickets/${ticket.id}`}
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to ticket
      </Link>

      <div className="mt-4">
        <DeliveryTicketEditor
          mode="edit"
          ticketId={ticket.id}
          jobs={jobs}
          fleetOptions={{
            trucks: settings.trucks,
            drivers: settings.drivers,
            trailers: settings.trailers,
            truckCapacityLabel: settings.truckCapacityLabel,
          }}
          defaultValues={{
            ticketType: ticket.ticketType,
            jobId: ticket.jobId ?? "",
            quoteId: ticket.quoteId,
            customerName: ticket.customerName,
            projectName: ticket.projectName,
            deliveryAddress: ticket.deliveryAddress,
            deliveryDate: ticket.deliveryDate
              ? formatDateIso(ticket.deliveryDate)
              : null,
            deliveryTime: ticket.deliveryTime,
            truck: ticket.truck,
            driver: ticket.driver,
            trailer: ticket.trailer,
            lines: defaultLines,
          }}
        />
      </div>
    </DashboardShell>
  );
}
