import { notFound } from "next/navigation";
import { DeliveryTicketPreviewContent } from "@/components/delivery-tickets/delivery-ticket-preview-content";
import { getAppSettings } from "@/lib/app-settings";
import { withDatabaseRetry } from "@/lib/prisma";

type DeliveryTicketPreviewPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
};

/** Matches the `from` keys the ticket editor and its entry pages pass. */
const PREVIEW_ORIGINS: Record<string, { href: string; label: string }> = {
  "walk-ins": { href: "/walk-ins", label: "Back to Walk-Ins" },
  hub: { href: "/delivery-tickets", label: "Back to Delivery Hub" },
  all: { href: "/delivery-tickets/all", label: "Back to All Tickets" },
  home: { href: "/", label: "Back to Dashboard" },
};

export default async function DeliveryTicketPreviewPage({
  params,
  searchParams,
}: DeliveryTicketPreviewPageProps) {
  const { id } = await params;
  const { from } = await searchParams;
  const origin = from ? PREVIEW_ORIGINS[from] : undefined;

  const [ticket, settings] = await Promise.all([
    withDatabaseRetry((prisma) =>
      prisma.deliveryTicket.findUnique({
        where: { id },
        select: {
          id: true,
          ticketNumber: true,
          ticketType: true,
          status: true,
          paymentMethod: true,
          paymentReceived: true,
          invoice: { select: { id: true, invoiceNumber: true } },
        },
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

  // Still-open tickets can hop back into the editor; the origin rides along
  // so a later Save & Preview lands back here with the same back button.
  const editable =
    ticket.status !== "DELIVERED" && ticket.status !== "CANCELLED";
  const editHref = editable
    ? `/delivery-tickets/${ticket.id}/edit${origin && from ? `?from=${from}` : ""}`
    : undefined;

  return (
    <DeliveryTicketPreviewContent
      ticketId={ticket.id}
      ticketNumber={ticket.ticketNumber ?? "DRAFT"}
      backHref={origin?.href}
      backLabel={origin?.label}
      editHref={editHref}
      completeOnPrint={completeOnPrint}
      payNow={ticket.paymentMethod === "PAY_NOW"}
      paymentReceivedDefault={ticket.paymentReceived}
      existingInvoice={ticket.invoice}
      directPrintPrinter={settings.ticketPrinterName}
    />
  );
}
