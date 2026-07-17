import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CustomerDetailContent } from "@/components/customers/customer-detail-content";
import { mapCustomerToDetailView } from "@/lib/customer-mapper";
import { formatUsd } from "@/lib/format";
import { OPEN_STATUSES } from "@/lib/quotes/list-summary";
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
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
        },
        contactRoleDefaults: true,
      },
    }),
  );

  if (!customer) {
    notFound();
  }

  const relatedWhere = {
    OR: [{ customerId: customer.id }, { customerName: customer.name }],
  };

  // Independent of each other — run in parallel. The lists are capped (years
  // of history belong on the dedicated list pages); the counts back the stat
  // strip and section summaries so they stay accurate past the caps.
  const [
    relatedQuotes,
    relatedDeliveryTickets,
    relatedInvoices,
    openQuotes,
    totalQuotes,
    scheduledTickets,
    totalTickets,
    unpaidInvoiceAgg,
    totalInvoices,
  ] = await Promise.all([
    withDatabaseRetry((prisma) =>
      prisma.quote.findMany({
        where: relatedWhere,
        orderBy: { updatedAt: "desc" },
        take: 25,
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.deliveryTicket.findMany({
        where: relatedWhere,
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.invoice.findMany({
        where: relatedWhere,
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.quote.count({
        where: { ...relatedWhere, status: { in: [...OPEN_STATUSES] } },
      }),
    ),
    withDatabaseRetry((prisma) => prisma.quote.count({ where: relatedWhere })),
    withDatabaseRetry((prisma) =>
      prisma.deliveryTicket.count({
        where: {
          ...relatedWhere,
          status: { in: ["SCHEDULED", "LOADING", "IN_TRANSIT"] },
        },
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.deliveryTicket.count({ where: relatedWhere }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.invoice.aggregate({
        where: { ...relatedWhere, status: "SENT" },
        _count: { _all: true },
        _sum: { total: true },
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.invoice.count({ where: relatedWhere }),
    ),
  ]);

  const OPEN_JOB_STATUSES = new Set([
    "QUOTING",
    "DETAILING",
    "AWARDED",
    "ACTIVE",
    "ON_HOLD",
  ]);
  const openJobs = customer.jobs.filter((job) =>
    OPEN_JOB_STATUSES.has(job.status),
  ).length;

  const detail = mapCustomerToDetailView(
    customer,
    customer.jobs,
    relatedQuotes,
    relatedDeliveryTickets,
    customer.contacts,
    relatedInvoices,
    customer.contactRoleDefaults,
    {
      openJobs,
      totalJobs: customer.jobs.length,
      openQuotes,
      totalQuotes,
      scheduledTickets,
      totalTickets,
      unpaidInvoices: unpaidInvoiceAgg._count._all,
      totalInvoices,
      unpaidTotal: formatUsd(Number(unpaidInvoiceAgg._sum.total ?? 0)),
    },
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
