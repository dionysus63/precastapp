import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SummaryCard } from "@/components/dashboard/summary-card";

const summaryCards = [
  {
    label: "Open Quotes",
    value: "8",
    detail: "3 awaiting customer response",
    accent: "sky" as const,
  },
  {
    label: "Active Jobs",
    value: "14",
    detail: "5 scheduled for production this week",
    accent: "emerald" as const,
  },
  {
    label: "Pending Invoices",
    value: "6",
    detail: "$42,800 outstanding",
    accent: "amber" as const,
  },
  {
    label: "Inventory Alerts",
    value: "4",
    detail: "Items below reorder threshold",
    accent: "rose" as const,
  },
];

const openQuotes = [
  {
    id: "Q-2026-018",
    customer: "Riverview Builders",
    project: "Retaining Wall Package",
    amount: "$18,400",
    status: "Sent",
    variant: "info" as const,
  },
  {
    id: "Q-2026-021",
    customer: "Northside Concrete",
    project: "Utility Vaults",
    amount: "$9,250",
    status: "Follow Up",
    variant: "warning" as const,
  },
  {
    id: "Q-2026-024",
    customer: "Summit Development",
    project: "Parking Structure",
    amount: "$31,600",
    status: "Draft",
    variant: "neutral" as const,
  },
];

const activeJobs = [
  {
    number: "2026-011",
    customer: "Harbor Point LLC",
    project: "Parking Structure",
    status: "In Production",
    variant: "success" as const,
  },
  {
    number: "2026-014",
    customer: "Metro Utilities",
    project: "Vault Install",
    status: "Scheduled",
    variant: "info" as const,
  },
  {
    number: "2026-016",
    customer: "Greenfield Homes",
    project: "Foundation Walls",
    status: "Submittals",
    variant: "warning" as const,
  },
];

const pendingInvoices = [
  {
    id: "INV-1042",
    customer: "Riverview Builders",
    due: "Jun 22",
    amount: "$12,900",
    status: "Due Soon",
    variant: "warning" as const,
  },
  {
    id: "INV-1038",
    customer: "Summit Development",
    due: "Jun 25",
    amount: "$8,750",
    status: "Open",
    variant: "info" as const,
  },
  {
    id: "INV-1031",
    customer: "Northside Concrete",
    due: "Jun 28",
    amount: "$5,400",
    status: "Open",
    variant: "info" as const,
  },
];

const inventoryAlerts = [
  {
    item: "Rebar #5",
    sku: "RB-05-20FT",
    status: "Low Stock",
    detail: "12 units remaining",
    variant: "danger" as const,
  },
  {
    item: "Release Agent",
    sku: "RA-100",
    status: "Reorder",
    detail: "Below reorder point",
    variant: "warning" as const,
  },
  {
    item: 'Anchor Bolts 3/4"',
    sku: "AB-075",
    status: "Low Stock",
    detail: "8 boxes remaining",
    variant: "danger" as const,
  },
];

const recentActivity = [
  {
    time: "9:42 AM",
    type: "Quote",
    text: "Q-2026-024 sent to Summit Development",
  },
  {
    time: "8:15 AM",
    type: "Job",
    text: "2026-016 folder updated with new submittals",
  },
  {
    time: "Yesterday",
    type: "Invoice",
    text: "INV-1042 marked as sent",
  },
  {
    time: "Yesterday",
    type: "Customer",
    text: "Harbor Point LLC contact info updated",
  },
];

const quickActions = [
  { label: "New Customer", href: "/customers/new", primary: false },
  { label: "New Job", href: "/jobs/new", primary: true },
  { label: "Create Quote", href: "/quotes/new", primary: true },
  { label: "Record Delivery", href: "/delivery-tickets/new", primary: false },
];

function CompactTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">{children}</table>
    </div>
  );
}

export default function Home() {
  return (
    <DashboardShell
      title="Dashboard"
      subtitle="Quotes, jobs, billing, and inventory at a glance."
    >
      <div className="space-y-5">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                {openQuotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-900">{quote.id}</p>
                      <p className="text-[11px] text-slate-500">
                        {quote.project}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {quote.customer}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge label={quote.status} variant={quote.variant} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                      {quote.amount}
                    </td>
                  </tr>
                ))}
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
                {activeJobs.map((job) => (
                  <tr key={job.number} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {job.number}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-900">{job.project}</p>
                      <p className="text-[11px] text-slate-500">
                        {job.customer}
                      </p>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge label={job.status} variant={job.variant} />
                    </td>
                  </tr>
                ))}
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
                  <th className="px-4 py-2 font-semibold">Due</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {invoice.id}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {invoice.customer}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{invoice.due}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        label={invoice.status}
                        variant={invoice.variant}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                      {invoice.amount}
                    </td>
                  </tr>
                ))}
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
                {inventoryAlerts.map((alert) => (
                  <tr key={alert.item} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {alert.item}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                      {alert.sku}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge label={alert.status} variant={alert.variant} />
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{alert.detail}</td>
                  </tr>
                ))}
              </tbody>
            </CompactTable>
          </SectionCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <SectionCard
              title="Recent Activity"
              description="Latest updates across quotes, jobs, and billing"
              noPadding
            >
              <CompactTable>
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2 font-semibold">Time</th>
                    <th className="px-4 py-2 font-semibold">Type</th>
                    <th className="px-4 py-2 font-semibold">Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentActivity.map((item) => (
                    <tr key={item.text} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                        {item.time}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge label={item.type} variant="neutral" />
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">{item.text}</td>
                    </tr>
                  ))}
                </tbody>
              </CompactTable>
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
