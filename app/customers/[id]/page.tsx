import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CustomerDetailContent } from "@/components/customers/customer-detail-content";
import { mapCustomerToDetailView } from "@/lib/customer-mapper";
import {
  ensurePrimaryContactBackfill,
  hasPrimaryContactData,
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

    if (!record) {
      return null;
    }

    // Backfill only migrates legacy header data when no contacts exist yet.
    const needsBackfill =
      record.contacts.length === 0 &&
      hasPrimaryContactData({
        name: record.primaryContactName,
        phone: record.phone,
        email: record.email,
      });

    // Sync mirrors the earliest-created primary contact onto the header;
    // when they already match, running it would be a no-op write.
    const primary =
      record.contacts
        .filter((contact) => contact.isPrimary)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0] ??
      null;
    const headerInSync =
      record.primaryContactName === (primary?.name ?? null) &&
      record.phone === (primary?.phone ?? null) &&
      record.email === (primary?.email ?? null);

    if (!needsBackfill && headerInSync) {
      return record;
    }

    await ensurePrimaryContactBackfill(prisma, id);
    await syncCustomerHeaderFromPrimaryContact(prisma, id);

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

  // Independent of each other — run in parallel. Both are capped: years of
  // history belong on the dedicated list pages, not the profile.
  const [relatedQuotes, relatedDeliveryTickets] = await Promise.all([
    withDatabaseRetry((prisma) =>
      prisma.quote.findMany({
        where: {
          OR: [{ customerId: customer.id }, { customerName: customer.name }],
        },
        orderBy: { updatedAt: "desc" },
        take: 25,
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.deliveryTicket.findMany({
        where: {
          OR: [{ customerId: customer.id }, { customerName: customer.name }],
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ),
  ]);

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
