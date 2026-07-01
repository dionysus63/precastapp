import { JobBiddingPanel } from "@/components/jobs/job-bidding-panel";
import { JobProgressPanel } from "@/components/jobs/job-progress-panel";
import { JobFilesBrowser } from "@/components/files/job-files-browser";
import {
  JobDeliveriesSection,
  JobInvoicesSection,
  JobOverviewSection,
  JobProductionSection,
  JobQuotesSection,
} from "@/components/jobs/job-detail-content";
import type { JobDetailTab, JobDetailView } from "@/components/jobs/job-utils";
import { mapFilesForBrowser } from "@/lib/job-file-mapper";
import { getJobFilesForBrowser } from "@/app/files/actions";
import {
  mapJobBidders,
  mapJobDeliveries,
  mapJobInvoiceableDeliveries,
  mapJobInvoices,
  mapJobMasterQuoteOptions,
  mapJobQuotes,
  mapJobStructures,
} from "@/lib/job-detail-mapper";
import { getJobProgress } from "@/lib/job-progress";
import { hasPermission, type AuthUser } from "@/lib/auth/permissions";
import { AppPermission } from "@/app/generated/prisma/client";
import { withDatabaseRetry } from "@/lib/prisma";
import { listCustomersForBidList } from "@/app/jobs/bid-actions";

const CONSTRUCTION_PLANS_CATEGORY = "01 Construction Plans";

type JobTabContentProps = {
  jobId: string;
  activeTab: JobDetailTab;
  category?: string;
  detail: JobDetailView;
  user: AuthUser | null;
};

export async function JobTabContent({
  jobId,
  activeTab,
  category,
  detail,
  user,
}: JobTabContentProps) {
  if (activeTab === "overview") {
    return <JobOverviewSection detail={detail} />;
  }

  if (activeTab === "bidding") {
    const canManageBidList = user
      ? await hasPermission(user, AppPermission.JOBS_MANAGE)
      : false;

    const [bidders, quotes, bidListCustomers] = await Promise.all([
      withDatabaseRetry((prisma) =>
        prisma.jobBidder.findMany({
          where: { jobId },
          orderBy: { sortOrder: "asc" },
          include: {
            customer: {
              include: {
                contacts: {
                  orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
                },
              },
            },
            quotes: { orderBy: { updatedAt: "desc" }, take: 1 },
          },
        }),
      ),
      withDatabaseRetry((prisma) =>
        prisma.quote.findMany({
          where: { jobId },
          orderBy: { updatedAt: "desc" },
          include: { _count: { select: { lineItems: true } } },
        }),
      ),
      canManageBidList ? listCustomersForBidList() : Promise.resolve([]),
    ]);

    return (
      <JobBiddingPanel
        jobId={jobId}
        isAwarded={detail.biddingSummary.isAwarded}
        bidders={mapJobBidders(bidders)}
        masterQuoteOptions={mapJobMasterQuoteOptions(quotes)}
        customers={bidListCustomers.map((customer) => ({
          id: customer.id,
          name: customer.name,
        }))}
      />
    );
  }

  if (activeTab === "quotes") {
    const quotes = await withDatabaseRetry((prisma) =>
      prisma.quote.findMany({
        where: { jobId },
        orderBy: { updatedAt: "desc" },
      }),
    );

    return <JobQuotesSection jobId={jobId} quotes={mapJobQuotes(quotes)} />;
  }

  if (activeTab === "deliveries") {
    const tickets = await withDatabaseRetry((prisma) =>
      prisma.deliveryTicket.findMany({
        where: { jobId },
        orderBy: { updatedAt: "desc" },
        include: {
          lineItems: {
            orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }],
            select: {
              id: true,
              lineNumber: true,
              itemCode: true,
              description: true,
              quantity: true,
              unit: true,
              totalWeight: true,
              status: true,
              yardLocation: true,
            },
          },
        },
      }),
    );

    return (
      <JobDeliveriesSection
        jobId={jobId}
        deliveries={mapJobDeliveries(tickets)}
      />
    );
  }

  if (activeTab === "progress") {
    const progress = await withDatabaseRetry((prisma) =>
      getJobProgress(prisma, jobId),
    );

    return <JobProgressPanel jobId={jobId} progress={progress} />;
  }

  if (activeTab === "production") {
    const structures = await withDatabaseRetry((prisma) =>
      prisma.jobStructure.findMany({
        where: { jobId },
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { documents: true } } },
      }),
    );

    return (
      <JobProductionSection
        jobId={jobId}
        folderPath={detail.folderPath}
        structures={mapJobStructures(structures)}
      />
    );
  }

  if (activeTab === "invoices") {
    const [canManageInvoices, invoices, invoiceableTickets] =
      await Promise.all([
        user
          ? hasPermission(user, AppPermission.INVOICES_MANAGE)
          : Promise.resolve(false),
        withDatabaseRetry((prisma) =>
          prisma.invoice.findMany({
            where: { jobId },
            orderBy: { updatedAt: "desc" },
            include: { deliveryTicket: { select: { ticketNumber: true } } },
          }),
        ),
        withDatabaseRetry((prisma) =>
          prisma.deliveryTicket.findMany({
            where: { jobId, status: "DELIVERED", invoice: { is: null } },
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              ticketNumber: true,
              projectName: true,
              deliveryDate: true,
            },
          }),
        ),
      ]);

    return (
      <JobInvoicesSection
        invoices={mapJobInvoices(invoices)}
        invoiceableDeliveries={mapJobInvoiceableDeliveries(invoiceableTickets)}
        canManageInvoices={canManageInvoices}
      />
    );
  }

  const fileCategory = category ?? "All";
  const isConstructionPlans = activeTab === "construction-plans";

  let files: ReturnType<typeof mapFilesForBrowser> = [];
  if (detail.folderPath) {
    const requestedCategory = isConstructionPlans
      ? CONSTRUCTION_PLANS_CATEGORY
      : fileCategory !== "All"
        ? fileCategory
        : undefined;

    const result = await getJobFilesForBrowser(jobId, requestedCategory);
    files = mapFilesForBrowser(result.files);
  }

  return (
    <JobFilesBrowser
      jobId={detail.id}
      jobNumber={detail.jobNumber}
      customerName={detail.customer}
      projectName={detail.projectName}
      folderPath={detail.folderPath}
      files={files}
      activeCategory={
        isConstructionPlans ? CONSTRUCTION_PLANS_CATEGORY : fileCategory
      }
      basePath={`/jobs/${detail.id}`}
      baseQuery={{ tab: isConstructionPlans ? "construction-plans" : "files" }}
      lockedCategory={
        isConstructionPlans ? CONSTRUCTION_PLANS_CATEGORY : undefined
      }
    />
  );
}
