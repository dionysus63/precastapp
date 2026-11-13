import { notFound } from "next/navigation";
import { AppPermission } from "@/app/generated/prisma/client";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DeliveryTicketDetailContent } from "@/components/delivery-tickets/delivery-ticket-detail-content";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { mapDbDeliveryTicketToDetailView } from "@/lib/delivery-ticket-mapper";
import { withDatabaseRetry } from "@/lib/prisma";
import { formatFiledMoment } from "@/lib/ticket-scan/service";
import { signedTicketJobCopyName } from "@/lib/ticket-scan/storage";
import { signedTicketDownloadUrl } from "@/lib/ticket-scan/view";

type DeliveryTicketDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DeliveryTicketDetailPage({
  params,
}: DeliveryTicketDetailPageProps) {
  const { id } = await params;

  const [dbTicket, user] = await Promise.all([
    withDatabaseRetry((prisma) =>
      prisma.deliveryTicket.findUnique({
        where: { id },
        include: {
          lineItems: { orderBy: { lineNumber: "asc" } },
          invoice: { select: { id: true, invoiceNumber: true } },
          // The signed copy filed from Invoices → Scan In, if there is one.
          signedFiles: {
            where: { isCurrent: true },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, pageCount: true, filedBy: true, createdAt: true },
          },
          job: {
            select: {
              deliveryAddress: true,
              projectAddress: true,
              city: true,
              state: true,
              zip: true,
              siteContactName: true,
              siteContactPhone: true,
              siteContactEmail: true,
            },
          },
          quote: { select: { projectAddress: true } },
        },
      }),
    ),
    getCurrentUser(),
  ]);
  const canManageInvoices = user
    ? await hasPermission(user, AppPermission.INVOICES_MANAGE)
    : false;

  if (!dbTicket) {
    notFound();
  }

  const ticket = mapDbDeliveryTicketToDetailView(dbTicket);
  if (dbTicket.invoice) {
    ticket.relatedRecords.invoice = dbTicket.invoice.invoiceNumber;
  }

  const signedFile = dbTicket.signedFiles[0] ?? null;
  const signedTicket = signedFile
    ? {
        downloadUrl: signedTicketDownloadUrl(signedFile.id),
        fileName: signedTicketJobCopyName(
          dbTicket.ticketNumber ?? "Delivery ticket",
        ),
        filedLabel: `Filed ${formatFiledMoment(signedFile.createdAt)}${
          signedFile.filedBy ? ` by ${signedFile.filedBy}` : ""
        }`,
      }
    : null;
  const closedWithoutSignedCopy =
    !signedFile && dbTicket.closedWithoutSignedCopyAt
      ? `Closed with no signed copy ${formatFiledMoment(dbTicket.closedWithoutSignedCopyAt)}${
          dbTicket.closedWithoutSignedCopyBy
            ? ` by ${dbTicket.closedWithoutSignedCopyBy}`
            : ""
        }`
      : null;

  return (
    <DashboardShell title={ticket.title} subtitle={ticket.subtitle}>
      <DeliveryTicketDetailContent
        ticket={ticket}
        ticketId={dbTicket.id}
        ticketStatus={dbTicket.status}
        hasInvoice={Boolean(dbTicket.invoice)}
        invoiceId={dbTicket.invoice?.id ?? null}
        pickupInfo={{
          fulfillmentMethod: dbTicket.fulfillmentMethod,
          paymentMethod: dbTicket.paymentMethod,
          paymentReceived: dbTicket.paymentReceived,
          pickedUpBy: dbTicket.pickedUpBy,
        }}
        canManageInvoices={canManageInvoices}
        signedTicket={signedTicket}
        closedWithoutSignedCopy={closedWithoutSignedCopy}
      />
    </DashboardShell>
  );
}
