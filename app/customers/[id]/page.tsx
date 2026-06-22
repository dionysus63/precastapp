import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CustomerDetailContent } from "@/components/customers/customer-detail-content";
import { mapCustomerToDetailView } from "@/lib/customer-mapper";
import {
  ensurePrimaryContactBackfill,
  syncCustomerHeaderFromPrimaryContact,
} from "@/lib/customer-contact-sync";
import { withDatabaseRetry } from "@/lib/prisma";

type CustomerDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;

  const customer = await withDatabaseRetry(async (prisma) => {
    const record = await prisma.customer.findUnique({
      where: { id },
      include: {
        jobs: {
          orderBy: { updatedAt: "desc" },
        },
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
        },
      },
    });

    if (record) {
      await ensurePrimaryContactBackfill(prisma, id);
      await syncCustomerHeaderFromPrimaryContact(prisma, id);
    }

    if (!record) {
      return null;
    }

    return prisma.customer.findUnique({
      where: { id },
      include: {
        jobs: {
          orderBy: { updatedAt: "desc" },
        },
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
        },
      },
    });
  });

  if (!customer) {
    notFound();
  }

  const relatedQuotes = await withDatabaseRetry((prisma) =>
    prisma.quote.findMany({
      where: {
        OR: [{ customerId: customer.id }, { customerName: customer.name }],
      },
      orderBy: { updatedAt: "desc" },
    }),
  );

  const relatedDeliveryTickets = await withDatabaseRetry((prisma) =>
    prisma.deliveryTicket.findMany({
      where: {
        OR: [{ customerId: customer.id }, { customerName: customer.name }],
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  );

  const detail = mapCustomerToDetailView(
    customer,
    customer.jobs,
    relatedQuotes,
    relatedDeliveryTickets,
    customer.contacts,
  );

  return (
    <DashboardShell
      title={detail.name}
      subtitle="Customer profile and account details."
    >
      <CustomerDetailContent customer={detail} />
    </DashboardShell>
  );
}
