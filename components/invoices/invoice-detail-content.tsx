import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { RichTextContent } from "@/components/ui/rich-text-content";
import type { InvoiceDetailView } from "@/lib/invoice-mapper";

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

type InvoiceDetailContentProps = {
  invoice: InvoiceDetailView;
  ticketId?: string | null;
};

export function InvoiceDetailContent({
  invoice,
  ticketId,
}: InvoiceDetailContentProps) {
  const summaryCards = [
    {
      label: "Status",
      value: invoice.statusLabel,
      detail: invoice.status,
      accent: "amber" as const,
    },
    {
      label: "Total",
      value: invoice.total,
      detail: "Invoice total",
      accent: "sky" as const,
    },
    {
      label: "Invoice Date",
      value: invoice.invoiceDate,
      detail: `Due ${invoice.dueDate}`,
      accent: "emerald" as const,
    },
    {
      label: "Delivery Ticket",
      value: invoice.ticketNumber,
      detail: "Source ticket",
      accent: "rose" as const,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/invoices"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Invoices
        </Link>
        {ticketId ? (
          <Link
            href={`/delivery-tickets/${ticketId}`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            View Delivery Ticket
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <SectionCard title="Invoice Information">
            <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Invoice Number" value={invoice.invoiceNumber} />
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Status
                </dt>
                <dd className="mt-1">
                  <StatusBadge
                    label={invoice.statusLabel}
                    variant={invoice.statusVariant}
                  />
                </dd>
              </div>
              <DetailField label="Customer" value={invoice.customerName} />
              <DetailField label="Project" value={invoice.projectName} />
              <DetailField label="Job Number" value={invoice.jobNumber} />
              <DetailField label="Delivery Ticket" value={invoice.ticketNumber} />
              <DetailField label="Invoice Date" value={invoice.invoiceDate} />
              <DetailField label="Due Date" value={invoice.dueDate} />
              <DetailField label="Tax Rate" value={invoice.taxRate} />
            </dl>
          </SectionCard>

          <SectionCard title="Line Items" noPadding>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Item</th>
                    <th className="px-3 py-2 font-semibold">Description</th>
                    <th className="px-3 py-2 font-semibold">Qty</th>
                    <th className="px-3 py-2 font-semibold">Unit</th>
                    <th className="px-3 py-2 font-semibold">Unit Price</th>
                    <th className="px-3 py-2 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.lineItems.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2">{line.lineNumber}</td>
                      <td className="px-3 py-2 font-medium">{line.itemCode}</td>
                      <td className="px-3 py-2">
                        <RichTextContent value={line.description} />
                      </td>
                      <td className="px-3 py-2">{line.quantity}</td>
                      <td className="px-3 py-2">{line.unit}</td>
                      <td className="px-3 py-2">{line.unitPrice}</td>
                      <td className="px-3 py-2 font-medium">{line.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <aside>
          <SectionCard title="Totals">
            <dl className="space-y-3 text-xs">
              {[
                ["Subtotal", invoice.subtotal],
                ["Sales Tax", invoice.salesTax],
                ["Total", invoice.total],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0"
                >
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
