import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { withDatabaseRetry } from "@/lib/prisma";

export default async function InvoicesPage() {
  const invoices = await withDatabaseRetry((prisma) =>
    prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        deliveryTicket: { select: { ticketNumber: true } },
      },
    }),
  );

  return (
    <DashboardShell
      title="Invoices"
      subtitle="One invoice per delivered delivery ticket."
    >
      <SectionCard title="Recent Invoices" noPadding>
        {invoices.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No invoices yet. Convert a delivered delivery ticket to create one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-600">
                <tr>
                  <th className="px-4 py-2 font-semibold">Invoice</th>
                  <th className="px-4 py-2 font-semibold">Ticket</th>
                  <th className="px-4 py-2 font-semibold">Customer</th>
                  <th className="px-4 py-2 font-semibold">Project</th>
                  <th className="px-4 py-2 font-semibold">Total</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2 font-medium">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="text-slate-900 hover:text-slate-700"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-700">
                      {invoice.deliveryTicket.ticketNumber}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{invoice.customerName}</td>
                    <td className="px-4 py-2 text-slate-700">{invoice.projectName}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      ${Number(invoice.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge label={invoice.status} variant="info" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </DashboardShell>
  );
}
