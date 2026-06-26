import { notFound } from "next/navigation";
import { DeliveryTicketPreviewContent } from "@/components/delivery-tickets/delivery-ticket-preview-content";
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

  const ticket = await withDatabaseRetry((prisma) =>
    prisma.deliveryTicket.findUnique({
      where: { id },
      select: { id: true, ticketNumber: true },
    }),
  );

  if (!ticket) {
    notFound();
  }

  return (
    <DeliveryTicketPreviewContent
      ticketId={ticket.id}
      ticketNumber={ticket.ticketNumber}
      backHref={fromWalkIns ? "/walk-ins" : undefined}
      backLabel={fromWalkIns ? "Back to Walk-Ins" : undefined}
    />
  );
}
