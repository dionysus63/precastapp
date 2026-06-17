import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

const summaryCards = [
  { label: "Open Quotes", value: "8", detail: "3 awaiting response" },
  { label: "Active Jobs", value: "14", detail: "5 due this week" },
  { label: "Pending Invoices", value: "6", detail: "$42,800 outstanding" },
  { label: "Inventory Alerts", value: "4", detail: "Low stock items" },
];

const openQuotes = [
  { id: "Q-2026-018", customer: "Riverview Builders", amount: "$18,400" },
  { id: "Q-2026-021", customer: "Northside Concrete", amount: "$9,250" },
  { id: "Q-2026-024", customer: "Summit Development", amount: "$31,600" },
];

const activeJobs = [
  { number: "2026-011", customer: "Harbor Point LLC", project: "Parking Structure" },
  { number: "2026-014", customer: "Metro Utilities", project: "Vault Install" },
  { number: "2026-016", customer: "Greenfield Homes", project: "Foundation Walls" },
];

const pendingInvoices = [
  { id: "INV-1042", customer: "Riverview Builders", due: "Jun 22", amount: "$12,900" },
  { id: "INV-1038", customer: "Summit Development", due: "Jun 25", amount: "$8,750" },
  { id: "INV-1031", customer: "Northside Concrete", due: "Jun 28", amount: "$5,400" },
];

const inventoryAlerts = [
  { item: "Rebar #5", status: "Low stock", detail: "12 units remaining" },
  { item: "Release Agent", status: "Reorder soon", detail: "Below reorder point" },
  { item: "Anchor Bolts 3/4\"", status: "Low stock", detail: "8 boxes remaining" },
];

const recentActivity = [
  { time: "9:42 AM", text: "Quote Q-2026-024 sent to Summit Development" },
  { time: "8:15 AM", text: "Job 2026-016 folder updated with new submittals" },
  { time: "Yesterday", text: "Invoice INV-1042 marked as sent" },
  { time: "Yesterday", text: "Customer Harbor Point LLC updated contact info" },
];

const quickActions = [
  { label: "New Customer", href: "/customers/new" },
  { label: "New Job", href: "/jobs/new" },
  { label: "Create Quote", href: "/quotes/new" },
  { label: "Record Delivery", href: "/delivery-tickets/new" },
];

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function Home() {
  return (
    <DashboardShell
      title="Dashboard"
      subtitle="Overview of quotes, jobs, invoices, and daily activity."
    >
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-zinc-200 bg-white p-4"
            >
              <p className="text-sm font-medium text-zinc-500">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-900">
                {card.value}
              </p>
              <p className="mt-1 text-sm text-zinc-600">{card.detail}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard title="Open Quotes">
            <ul className="space-y-3">
              {openQuotes.map((quote) => (
                <li
                  key={quote.id}
                  className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {quote.id}
                    </p>
                    <p className="text-sm text-zinc-600">{quote.customer}</p>
                  </div>
                  <p className="text-sm font-medium text-zinc-900">
                    {quote.amount}
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Active Jobs">
            <ul className="space-y-3">
              {activeJobs.map((job) => (
                <li
                  key={job.number}
                  className="rounded-md bg-zinc-50 px-3 py-2"
                >
                  <p className="text-sm font-medium text-zinc-900">
                    {job.number} — {job.project}
                  </p>
                  <p className="text-sm text-zinc-600">{job.customer}</p>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Pending Invoices">
            <ul className="space-y-3">
              {pendingInvoices.map((invoice) => (
                <li
                  key={invoice.id}
                  className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {invoice.id}
                    </p>
                    <p className="text-sm text-zinc-600">
                      {invoice.customer} · Due {invoice.due}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-zinc-900">
                    {invoice.amount}
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Inventory Alerts">
            <ul className="space-y-3">
              {inventoryAlerts.map((alert) => (
                <li
                  key={alert.item}
                  className="rounded-md bg-zinc-50 px-3 py-2"
                >
                  <p className="text-sm font-medium text-zinc-900">
                    {alert.item}
                  </p>
                  <p className="text-sm text-zinc-600">
                    {alert.status} · {alert.detail}
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <SectionCard title="Recent Activity">
              <ul className="space-y-3">
                {recentActivity.map((item) => (
                  <li
                    key={item.text}
                    className="flex gap-3 rounded-md bg-zinc-50 px-3 py-2"
                  >
                    <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {item.time}
                    </span>
                    <span className="text-sm text-zinc-700">{item.text}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <SectionCard title="Quick Actions">
            <div className="grid gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="rounded-md border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
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
