import { notFound } from "next/navigation";
import { DeliveryTicketPreviewContent } from "@/components/delivery-tickets/delivery-ticket-preview-content";
import { mapDbDeliveryTicketToDetailView } from "@/lib/delivery-ticket-mapper";
import { getCompanyProfile } from "@/lib/app-settings";
import {
  companyLogoApiUrl,
  getCompanyLogoUpdatedAt,
} from "@/lib/company-logo";
import { withDatabaseRetry } from "@/lib/prisma";

type DeliveryTicketPreviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DeliveryTicketPreviewPage({
  params,
}: DeliveryTicketPreviewPageProps) {
  const { id } = await params;

  const ticket = await withDatabaseRetry((prisma) =>
    prisma.deliveryTicket.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { lineNumber: "asc" } },
      },
    }),
  );

  if (!ticket) {
    notFound();
  }

  const detail = mapDbDeliveryTicketToDetailView(ticket);
  const [company, logoUpdatedAt] = await Promise.all([
    getCompanyProfile(),
    getCompanyLogoUpdatedAt(),
  ]);
  const logoUrl = logoUpdatedAt ? companyLogoApiUrl(logoUpdatedAt) : null;

  return (
    <DeliveryTicketPreviewContent
      ticket={detail}
      ticketId={ticket.id}
      company={company}
      logoUrl={logoUrl}
    />
  );
}
