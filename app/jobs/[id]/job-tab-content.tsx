import { JobBiddingPanel } from "@/components/jobs/job-bidding-panel";
import {
  JobFileDropPanel,
  type JobDropFile,
} from "@/components/jobs/job-file-drop-panel";
import {
  PURCHASE_ORDERS_CATEGORY,
  TAX_EXEMPT_CERT_CATEGORY,
} from "@/lib/job-folder-constants";
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
  buildJobOverview,
  mapJobBidders,
  mapJobDeliveries,
  mapJobInvoiceableDeliveries,
  mapJobInvoices,
  mapJobMasterQuoteOptions,
  mapJobQuotes,
  mapJobStructures,
} from "@/lib/job-detail-mapper";
import { getJobProgress } from "@/lib/job-progress";
import { formatQuantity } from "@/lib/format";
import { structureNeedsDrillSheet } from "@/components/structures/structure-utils";
import { parseRectStructureConfigJson } from "@/lib/quotes/rect-structure-workbook";
import { hasPermission, type AuthUser } from "@/lib/auth/permissions";
import { AppPermission, type Prisma } from "@/app/generated/prisma/client";
import { isDeliveryServiceLine } from "@/lib/quotes/money-rules";
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
    const [quotes, deliveryTickets, structures, invoices] =
      await withDatabaseRetry((prisma) =>
        Promise.all([
          prisma.quote.findMany({
            where: { jobId },
            select: {
              id: true,
              quoteNumber: true,
              status: true,
              bidDueDate: true,
              updatedAt: true,
            },
          }),
          prisma.deliveryTicket.findMany({
            where: { jobId },
            select: {
              id: true,
              ticketNumber: true,
              status: true,
              updatedAt: true,
              invoice: { select: { id: true } },
            },
          }),
          prisma.jobStructure.findMany({
            where: { jobId },
            select: {
              id: true,
              structureNumber: true,
              status: true,
              needsSubmittal: true,
              updatedAt: true,
            },
          }),
          prisma.invoice.findMany({
            where: { jobId },
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              updatedAt: true,
            },
          }),
        ]),
      );

    const overview = buildJobOverview(jobId, detail.folderPath, {
      quotes,
      deliveryTickets,
      structures,
      invoices,
    });

    return <JobOverviewSection detail={detail} overview={overview} />;
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
                contactRoleDefaults: {
                  select: { role: true, contactId: true },
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
        include: {
          _count: { select: { documents: true } },
          // Quote config drives the "Create drill sheet" link for placeholders.
          quoteLineItems: {
            select: { structureConfigJson: true },
            take: 1,
          },
        },
      }),
    );

    // Bulk-complete link when any rect quote-only placeholder exists.
    const rectPlaceholder = structures.find(
      (structure) =>
        structureNeedsDrillSheet(structure) &&
        structure.quoteId &&
        parseRectStructureConfigJson(
          structure.quoteLineItems[0]?.structureConfigJson ?? null,
        ) != null,
    );

    // Daily Production progress for in-production structures ("12 / 44").
    const inProductionIds = structures
      .filter((structure) => structure.status === "IN_PRODUCTION")
      .map((structure) => structure.id);
    const madeSums = inProductionIds.length
      ? await withDatabaseRetry((prisma) =>
          prisma.dailyProductionStructureLine.groupBy({
            by: ["jobStructureId"],
            where: { jobStructureId: { in: inProductionIds } },
            _sum: { quantityMade: true },
          }),
        )
      : [];
    const madeByStructure = new Map(
      madeSums.map((row) => [
        row.jobStructureId,
        row._sum.quantityMade?.toNumber() ?? 0,
      ]),
    );
    const mappedStructures = mapJobStructures(structures).map((row) => {
      const madeSoFar = madeByStructure.get(row.id);
      return madeSoFar && row.status === "IN_PRODUCTION"
        ? { ...row, madeProgress: `${formatQuantity(madeSoFar)} / ${row.quantity}` }
        : row;
    });

    return (
      <JobProductionSection
        jobId={jobId}
        folderPath={detail.folderPath}
        structures={mappedStructures}
        jobStatusValue={detail.statusValue}
        completeDrillSheetsHref={
          rectPlaceholder
            ? `/quotes/${rectPlaceholder.quoteId}/complete-drill-sheets`
            : null
        }
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

    // Freight reconciliation: the quote estimated N delivery loads, but
    // customer pickups mean fewer get billed — surface quoted vs invoiced so
    // leftover delivery charges don't get invoiced by habit.
    const deliveryCharges = await withDatabaseRetry(async (prisma) => {
      // A job can hold several WON quotes (scopes); freight sums across all.
      const wonQuotes = await prisma.quote.findMany({
        where: { jobId, status: "WON" },
        select: {
          lineItems: {
            select: {
              lineType: true,
              itemCode: true,
              description: true,
              quantity: true,
              total: true,
            },
          },
        },
      });
      const invoicedLines = await prisma.invoiceLineItem.findMany({
        where: { invoice: { jobId, status: { not: "VOID" } } },
        select: {
          lineType: true,
          itemCode: true,
          description: true,
          quantity: true,
          total: true,
        },
      });
      const pickupTicketCount = await prisma.deliveryTicket.count({
        where: {
          jobId,
          fulfillmentMethod: "PICKUP",
          status: { not: "CANCELLED" },
        },
      });

      const sumDeliveryLines = (
        lines: Array<{
          lineType: string;
          itemCode: string;
          description: string | null;
          quantity: Prisma.Decimal;
          total: Prisma.Decimal;
        }>,
      ) =>
        lines
          .filter((line) =>
            isDeliveryServiceLine(line.lineType, line.itemCode, line.description),
          )
          .reduce(
            (acc, line) => ({
              loads: acc.loads + Number(line.quantity),
              amount: acc.amount + Number(line.total),
            }),
            { loads: 0, amount: 0 },
          );

      const quoted = sumDeliveryLines(
        wonQuotes.flatMap((quote) => quote.lineItems),
      );
      const invoiced = sumDeliveryLines(invoicedLines);
      return {
        quotedLoads: quoted.loads,
        quotedAmount: quoted.amount,
        invoicedLoads: invoiced.loads,
        invoicedAmount: invoiced.amount,
        pickupTicketCount,
      };
    });

    return (
      <JobInvoicesSection
        invoices={mapJobInvoices(invoices)}
        invoiceableDeliveries={mapJobInvoiceableDeliveries(invoiceableTickets)}
        canManageInvoices={canManageInvoices}
        deliveryCharges={deliveryCharges}
      />
    );
  }

  if (activeTab === "tax-exempt-cert" || activeTab === "purchase-orders") {
    const panel =
      activeTab === "tax-exempt-cert"
        ? {
            category: TAX_EXEMPT_CERT_CATEGORY,
            title: "Tax Exempt Certificate",
            noun: "tax exempt certificate",
            inputIdPrefix: "tax-exempt-cert",
          }
        : {
            category: PURCHASE_ORDERS_CATEGORY,
            title: "Purchase Order",
            noun: "purchase order",
            inputIdPrefix: "purchase-order",
          };

    let file: JobDropFile | null = null;
    if (detail.folderPath) {
      const result = await getJobFilesForBrowser(jobId, panel.category);
      const newest = [...result.files].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )[0];
      if (newest) {
        const [mapped] = mapFilesForBrowser([newest]);
        file = mapped
          ? {
              id: mapped.id,
              fileName: mapped.fileName,
              updatedAt: mapped.updatedAt,
            }
          : null;
      }
    }

    return (
      <JobFileDropPanel
        jobId={jobId}
        jobNumber={detail.jobNumber}
        folderPath={detail.folderPath}
        file={file}
        folderCategory={panel.category}
        title={panel.title}
        noun={panel.noun}
        inputIdPrefix={panel.inputIdPrefix}
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
