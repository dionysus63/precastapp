import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { quoteStatusLabels, type QuoteStatus } from "@/components/quotes/quote-utils";
import { jobStatusLabels } from "@/components/jobs/job-utils";
import { withDatabaseRetry } from "@/lib/prisma";
import { formatUsd } from "@/lib/format";

import {
  tableBodyClassName,
  tableCellBordersClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";
function CompactTable({ children }: { children: React.ReactNode }) {
  return (
    <div className={tableFlushWrapperClassName}>
      <table className={tableClassName}>{children}</table>
    </div>
  );
}

export default async function Home() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    openQuotesCount,
    openQuotes,
    activeJobsCount,
    activeJobs,
    pendingInvoicesCount,
    pendingInvoicesTotal,
    pendingInvoices,
    inventoryAlerts,
    inventoryAlertsCount,
    productionQueueCount,
    scheduledDeliveriesToday,
    inTransitCount,
  ] = await withDatabaseRetry((prisma) => {
    // Compare two columns in SQL (Prisma field reference) instead of loading
    // every reorder-tracked product and filtering in memory.
    const lowStockWhere = {
      trackInventory: true,
      status: "ACTIVE" as const,
      reorderLevel: { gt: 0 },
      currentStockQuantity: { lte: prisma.product.fields.reorderLevel },
    };

    return Promise.all([
      prisma.quote.count({
        where: { status: { in: ["DRAFT", "IN_REVIEW", "SENT", "REVISED"] } },
      }),
      prisma.quote.findMany({
        where: { status: { in: ["DRAFT", "IN_REVIEW", "SENT", "REVISED"] } },
        orderBy: { updatedAt: "desc" },
        take: 3,
      }),
      prisma.job.count({
        where: { status: { in: ["ACTIVE", "AWARDED", "DETAILING", "QUOTING"] } },
      }),
      prisma.job.findMany({
        where: { status: { in: ["ACTIVE", "AWARDED", "DETAILING", "QUOTING"] } },
        orderBy: { updatedAt: "desc" },
        take: 3,
      }),
      prisma.invoice.count({
        where: { status: { in: ["DRAFT", "SENT"] } },
      }),
      prisma.invoice.aggregate({
        where: { status: { in: ["DRAFT", "SENT"] } },
        _sum: { total: true },
      }),
      prisma.invoice.findMany({
        where: { status: { in: ["DRAFT", "SENT"] } },
        orderBy: { invoiceDate: "asc" },
        take: 3,
      }),
      prisma.product.findMany({
        where: lowStockWhere,
        orderBy: { currentStockQuantity: "asc" },
        take: 3,
        select: {
          id: true,
          name: true,
          productCode: true,
          currentStockQuantity: true,
          unit: true,
        },
      }),
      prisma.product.count({ where: lowStockWhere }),
      prisma.jobStructure.count({
        where: { status: { in: ["APPROVED", "IN_PRODUCTION"] } },
      }),
      prisma.deliveryTicket.count({
        where: {
          status: { in: ["SCHEDULED", "LOADING", "IN_TRANSIT"] },
          deliveryDate: {
            gte: today,
            lt: new Date(today.getTime() + 86400000),
          },
        },
      }),
      prisma.deliveryTicket.count({ where: { status: "IN_TRANSIT" } }),
    ]);
  });

  const outstandingTotal = pendingInvoicesTotal._sum.total
    ? formatUsd(pendingInvoicesTotal._sum.total)
    : "$0";

  const summaryCards = [
    {
      label: "Open Quotes",
      value: String(openQuotesCount),
      detail: "Draft, in review, sent, or revised",
      href: "/quotes",
    },
    {
      label: "Active Jobs",
      value: String(activeJobsCount),
      detail: `${productionQueueCount} structure${productionQueueCount === 1 ? "" : "s"} in production queue`,
      href: "/jobs",
    },
    {
      label: "Pending Invoices",
      value: String(pendingInvoicesCount),
      detail: `${outstandingTotal} outstanding`,
      href: "/invoices?tab=drafts",
    },
    {
      label: "Inventory Alerts",
      value: String(inventoryAlertsCount),
      detail: "Items at or below reorder level",
      href: "/inventory",
    },
    {
      label: "Deliveries Today",
      value: String(scheduledDeliveriesToday),
      detail: `${inTransitCount} in transit now`,
      href: "/delivery-tickets?date=Today",
    },
  ];

  const quickActions = [
    { label: "New Job", href: "/jobs/new", primary: true },
    { label: "Create Quote", href: "/quotes/new", primary: true },
    { label: "New Customer", href: "/customers/new", primary: false },
    {
      label: "Record Delivery",
      href: "/delivery-tickets/new?from=home",
      primary: false,
    },
    { label: "Production queue", href: "/production", primary: false },
    { label: "Delivery tickets", href: "/delivery-tickets", primary: false },
    { label: "Record production", href: "/inventory/production", primary: false },
  ];

  return (
    <DashboardShell
      title="Dashboard"
      subtitle="Quotes, jobs, billing, and inventory at a glance."
    >
      <div className="space-y-5">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <SectionCard
            title="Open Quotes"
            description="Quotes waiting on review or customer response"
            action={
              <Link
                href="/quotes"
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                View all
              </Link>
            }
            noPadding
          >
            <CompactTable>
              <thead>
                <tr>
                  <th className={tableHeaderCellClassName}>Quote</th>
                  <th className={tableHeaderCellClassName}>Customer</th>
                  <th className={tableHeaderCellClassName}>Status</th>
                  <th className={`${tableHeaderCellClassName} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody className={tableBodyClassName}>
                {openQuotes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`${tableCellBordersClassName} px-4 py-6 text-center text-slate-500`}>
                      No open quotes.
                    </td>
                  </tr>
                ) : (
                  openQuotes.map((quote) => (
                    <tr key={quote.id} className={tableRowClassName}>
                      <td className={tableCellClassName}>
                        <Link
                          href={`/quotes/${quote.id}`}
                          className="font-medium text-slate-900 hover:text-slate-700"
                        >
                          {quote.quoteNumber}
                        </Link>
                        <p className="text-[11px] text-slate-500">
                          {quote.projectName}
                        </p>
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}>
                        {quote.customerName}
                      </td>
                      <td className={tableCellClassName}>
                        <StatusBadge
                          label={
                            quoteStatusLabels[quote.status as QuoteStatus] ??
                            quote.status
                          }
                          variant="info"
                        />
                      </td>
                      <td className={`${tableCellClassName} text-right font-medium text-slate-900`}>
                        {formatUsd(quote.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </CompactTable>
          </SectionCard>

          <SectionCard
            title="Active Jobs"
            description="Jobs currently moving through production"
            action={
              <Link
                href="/jobs"
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                View all
              </Link>
            }
            noPadding
          >
            <CompactTable>
              <thead>
                <tr>
                  <th className={tableHeaderCellClassName}>Job #</th>
                  <th className={tableHeaderCellClassName}>Project</th>
                  <th className={tableHeaderCellClassName}>Status</th>
                </tr>
              </thead>
              <tbody className={tableBodyClassName}>
                {activeJobs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={`${tableCellBordersClassName} px-4 py-6 text-center text-slate-500`}>
                      No active jobs.
                    </td>
                  </tr>
                ) : (
                  activeJobs.map((job) => (
                    <tr key={job.id} className={tableRowClassName}>
                      <td className={`${tableCellClassName} font-medium text-slate-900`}>
                        <Link
                          href={`/jobs/${job.id}`}
                          className="hover:text-slate-700"
                        >
                          {job.jobNumber}
                        </Link>
                      </td>
                      <td className={tableCellClassName}>
                        <p className="font-medium text-slate-900">{job.projectName}</p>
                        <p className="text-[11px] text-slate-500">
                          {job.customerName}
                        </p>
                      </td>
                      <td className={tableCellClassName}>
                        <StatusBadge
                          label={jobStatusLabels[job.status] ?? job.status}
                          variant="success"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </CompactTable>
          </SectionCard>

          <SectionCard
            title="Pending Invoices"
            description="Outstanding billing ready for follow-up"
            action={
              <Link
                href="/invoices"
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                View all
              </Link>
            }
            noPadding
          >
            <CompactTable>
              <thead>
                <tr>
                  <th className={tableHeaderCellClassName}>Invoice</th>
                  <th className={tableHeaderCellClassName}>Customer</th>
                  <th className={tableHeaderCellClassName}>Status</th>
                  <th className={`${tableHeaderCellClassName} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody className={tableBodyClassName}>
                {pendingInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`${tableCellBordersClassName} px-4 py-6 text-center text-slate-500`}>
                      No pending invoices.
                    </td>
                  </tr>
                ) : (
                  pendingInvoices.map((invoice) => (
                    <tr key={invoice.id} className={tableRowClassName}>
                      <td className={`${tableCellClassName} font-medium text-slate-900`}>
                        <Link href={`/invoices/${invoice.id}`}>
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}>
                        {invoice.customerName}
                      </td>
                      <td className={tableCellClassName}>
                        <StatusBadge label={invoice.status} variant="warning" />
                      </td>
                      <td className={`${tableCellClassName} text-right font-medium text-slate-900`}>
                        {formatUsd(invoice.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </CompactTable>
          </SectionCard>

          <SectionCard
            title="Inventory Alerts"
            description="Materials that may affect quoting or production"
            action={
              <Link
                href="/inventory"
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                View all
              </Link>
            }
            noPadding
          >
            <CompactTable>
              <thead>
                <tr>
                  <th className={tableHeaderCellClassName}>Item</th>
                  <th className={tableHeaderCellClassName}>SKU</th>
                  <th className={tableHeaderCellClassName}>Status</th>
                  <th className={tableHeaderCellClassName}>Detail</th>
                </tr>
              </thead>
              <tbody className={tableBodyClassName}>
                {inventoryAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`${tableCellBordersClassName} px-4 py-6 text-center text-slate-500`}>
                      All stocked products above reorder levels.
                    </td>
                  </tr>
                ) : (
                  inventoryAlerts.map((product) => (
                    <tr key={product.id} className={tableRowClassName}>
                      <td className={`${tableCellClassName} font-medium text-slate-900`}>
                        <Link
                          href={`/inventory/${product.id}`}
                          className="hover:text-slate-700"
                        >
                          {product.name}
                        </Link>
                      </td>
                      <td className={`${tableCellClassName} font-mono text-[11px] text-slate-500`}>
                        {product.productCode}
                      </td>
                      <td className={tableCellClassName}>
                        <StatusBadge label="Low Stock" variant="danger" />
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}>
                        {product.currentStockQuantity} {product.unit} on hand
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </CompactTable>
          </SectionCard>
        </div>

        <SectionCard title="Quick Actions" description="Common tasks for daily operations">
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  action.primary
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
