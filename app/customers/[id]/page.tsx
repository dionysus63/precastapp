import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CustomerDetailContent } from "@/components/customers/customer-detail-content";
import { mapCustomerToDetailView } from "@/lib/customer-mapper";
import { withDatabaseRetry } from "@/lib/prisma";

type CustomerDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;

  const customer = await withDatabaseRetry((prisma) =>
    prisma.customer.findUnique({
      where: { id },
      include: {
        jobs: {
          orderBy: { updatedAt: "desc" },
        },
      },
    }),
  );

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
