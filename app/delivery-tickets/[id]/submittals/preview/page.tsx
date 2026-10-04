import { notFound } from "next/navigation";
import { requireAuthForPath } from "@/lib/auth/session";
import { DeliveryTicketSubmittalPreviewContent } from "@/components/delivery-tickets/delivery-ticket-submittal-preview-content";
import { getAppSettings } from "@/lib/app-settings";
import { withDatabaseRetry } from "@/lib/prisma";

type DeliveryTicketSubmittalPreviewPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function DeliveryTicketSubmittalPreviewPage({
  params,
  searchParams,
}: DeliveryTicketSubmittalPreviewPageProps) {
  const { id } = await params;
  // Outside DashboardShell, so the route's permission is checked here.
  await requireAuthForPath(`/delivery-tickets/${id}/submittals/preview`);
  const { from } = await searchParams;
  const fromWalkIns = from === "walk-ins";
  const fromHub = from === "hub";

  const [ticket, settings] = await Promise.all([
    withDatabaseRetry((prisma) =>
      prisma.deliveryTicket.findUnique({
        where: { id },
        select: { id: true, ticketNumber: true },
      }),
    ),
    getAppSettings(),
  ]);

  if (!ticket) {
    notFound();
  }

  return (
    <DeliveryTicketSubmittalPreviewContent
      ticketId={ticket.id}
      ticketNumber={ticket.ticketNumber ?? "DRAFT"}
      backHref={fromWalkIns ? "/walk-ins" : fromHub ? "/delivery-tickets" : undefined}
      backLabel={fromWalkIns ? "Back to Walk-Ins" : fromHub ? "Back to Delivery Hub" : undefined}
      directPrintPrinter={settings.submittalPrinterName}
    />
  );
}
