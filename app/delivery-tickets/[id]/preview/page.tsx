import { notFound } from "next/navigation";
import { DeliveryTicketPreviewContent } from "@/components/delivery-tickets/delivery-ticket-preview-content";
import { getAppSettings } from "@/lib/app-settings";
import { withDatabaseRetry } from "@/lib/prisma";

type DeliveryTicketPreviewPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function DeliveryTicketPreviewPage({
  params,
  searchParams,
}: DeliveryTicketPreviewPageProps) {
  const { id } = await params;
  const { from } = await searchParams;
  const fromWalkIns = from === "walk-ins";
  const fromHub = from === "hub";

  const [ticket, settings] = await Promise.all([
    withDatabaseRetry((prisma) =>
      prisma.deliveryTicket.findUnique({
        where: { id },
        select: { id: true, ticketNumber: true, ticketType: true, status: true },
      }),
    ),
    getAppSettings(),
  ]);

  if (!ticket) {
    notFound();
  }

  // Walk-in counter sales are completed by printing the ticket, not by
  // scheduling and marking picked up later.
  const completeOnPrint =
    ticket.ticketType === "WALK_IN" &&
    ticket.status !== "DELIVERED" &&
    ticket.status !== "CANCELLED";

  return (
    <DeliveryTicketPreviewContent
      ticketId={ticket.id}
      ticketNumber={ticket.ticketNumber ?? "DRAFT"}
      backHref={fromWalkIns ? "/walk-ins" : fromHub ? "/delivery-tickets" : undefined}
      backLabel={fromWalkIns ? "Back to Walk-Ins" : fromHub ? "Back to Delivery Hub" : undefined}
      completeOnPrint={completeOnPrint}
      directPrintPrinter={settings.ticketPrinterName}
    />
  );
}
