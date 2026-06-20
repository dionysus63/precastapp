import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { quoteStatusLabels, type QuoteStatus } from "@/components/quotes/quote-utils";
import { jobStatusLabels } from "@/components/jobs/job-utils";
import { withDatabaseRetry } from "@/lib/prisma";

function CompactTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">{children}</table>
    </div>
  );
}

function formatCurrency(value: { toString(): string }) {
  const amount = Number(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
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
    lowStockProducts,
    productionQueueCount,
    scheduledDeliveriesToday,
    inTransitCount,
  ] = await withDatabaseRetry((prisma) =>
    Promise.all([
      prisma.quote.count({
        where: { status: { in: ["DRAFT", "IN_REVIEW", "SENT", "REVISED"] } },
      }),
      prisma.quote.findMany({
        where: { status: { in: ["DRAFT", "IN_REVIEW", "SENT", "REVISED"] } },
        orderBy: { updatedAt: "desc" },
        take: 3,
      }),
      prisma.job.count({
        where: { status: { in: ["ACTIVE", "AWARDED", "SUBMITTED", "QUOTING"] } },
      }),
      prisma.job.findMany({
        where: { status: { in: ["ACTIVE", "AWARDED", "SUBMITTED", "QUOTING"] } },
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
        where: {
          trackInventory: true,
          status: "ACTIVE",
          reorderLevel: { gt: 0 },
        },
        orderBy: { currentStockQuantity: "asc" },
      }),
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
    ]),
  );

  const inventoryAlerts = lowStockProducts
    .filter((p) => p.currentStockQuantity <= p.reorderLevel)
    .slice(0, 3);
  const inventoryAlertsCount = lowStockProducts.filter(
    (p) => p.currentStockQuantity <= p.reorderLevel,
  ).length;

  const outstandingTotal = pendingInvoicesTotal._sum.total
    ? formatCurrency(pendingInvoicesTotal._sum.total)
    : "$0";

  const summaryCards = [
    {
      label: "Open Quotes",
      value: String(openQuotesCount),
      detail: "Draft, in review, sent, or revised",
      accent: "sky" as const,
    },
    {
      label: "Active Jobs",
      value: String(activeJobsCount),
      detail: `${productionQueueCount} structures in production queue`,
      accent: "emerald" as const,
    },
    {
      label: "Pending Invoices",
      value: String(pendingInvoicesCount),
      detail: `${outstandingTotal} outstanding`,
      accent: "amber" as const,
    },
    {
      label: "Inventory Alerts",
      value: String(inventoryAlertsCount),
      detail: "Items at or below reorder level",
      accent: "rose" as const,
    },
    {
      label: "Deliveries Today",
      value: String(scheduledDeliveriesToday),
      detail: `${inTransitCount} in transit now`,
      accent: "sky" as const,
    },
  ];

  const quickActions = [
    { label: "New Customer", href: "/customers/new", primary: false },
    { label: "New Job", href: "/jobs/new", primary: true },
    { label: "Create Quote", href: "/quotes/new", primary: true },
    { label: "Record Delivery", href: "/delivery-tickets/new", primary: false },
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
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-semibold">Quote</th>
                  <th className="px-4 py-2 font-semibold">Customer</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {openQuotes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                      No open quotes.
                    </td>
                  </tr>
                ) : (
                  openQuotes.map((quote) => (
                    <tr key={quote.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5">
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
                      <td className="px-4 py-2.5 text-slate-600">
                        {quote.customerName}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge
                          label={
                            quoteStatusLabels[quote.status as QuoteStatus] ??
                            quote.status
                          }
                          variant="info"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                        {formatCurrency(quote.total)}
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
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-semibold">Job #</th>
                  <th className="px-4 py-2 font-semibold">Project</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeJobs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                      No active jobs.
                    </td>
                  </tr>
                ) : (
                  activeJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        {job.jobNumber}
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-900">{job.projectName}</p>
                        <p className="text-[11px] text-slate-500">
                          {job.customerName}
                        </p>
                      </td>
                      <td className="px-4 py-2.5">
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
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-semibold">Invoice</th>
                  <th className="px-4 py-2 font-semibold">Customer</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                      No pending invoices.
                    </td>
                  </tr>
                ) : (
                  pendingInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        <Link href={`/invoices/${invoice.id}`}>
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {invoice.customerName}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge label={invoice.status} variant="warning" />
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                        {formatCurrency(invoice.total)}
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
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-semibold">Item</th>
                  <th className="px-4 py-2 font-semibold">SKU</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventoryAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                      All stocked products above reorder levels.
                    </td>
                  </tr>
                ) : (
                  inventoryAlerts.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        {product.name}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                        {product.productCode}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge label="Low Stock" variant="danger" />
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {product.currentStockQuantity} {product.unit} on hand
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </CompactTable>
          </SectionCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <SectionCard
              title="Operations Snapshot"
              description="Production queue and delivery activity"
            >
              <dl className="grid gap-4 sm:grid-cols-3 text-xs">
                <div>
                  <dt className="text-slate-500">Production queue</dt>
                  <dd className="mt-1 text-lg font-semibold text-slate-900">
                    {productionQueueCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Scheduled today</dt>
                  <dd className="mt-1 text-lg font-semibold text-slate-900">
                    {scheduledDeliveriesToday}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">In transit</dt>
                  <dd className="mt-1 text-lg font-semibold text-slate-900">
                    {inTransitCount}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/production"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium hover:bg-slate-50"
                >
                  Production queue
                </Link>
                <Link
                  href="/delivery-tickets"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium hover:bg-slate-50"
                >
                  Delivery tickets
                </Link>
                <Link
                  href="/inventory/production"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium hover:bg-slate-50"
                >
                  Record production
                </Link>
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Quick Actions" description="Common tasks for daily operations">
            <div className="grid gap-2">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className={`inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors ${
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
      </div>
    </DashboardShell>
  );
}
