import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { InvoiceDetailActions } from "@/components/invoices/invoice-detail-actions";
import type { InvoiceDetailView } from "@/lib/invoice-mapper";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";
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
  canManage?: boolean;
  /** Customer's billing-role default contact, e.g. "Dana Whitfield · ap@x.com". */
  billingContact?: string | null;
};

export function InvoiceDetailContent({
  invoice,
  ticketId,
  canManage = false,
  billingContact,
}: InvoiceDetailContentProps) {
  const summaryCards = [
    {
      label: "Status",
      value: invoice.statusLabel,
      detail: invoice.status,
    },
    {
      label: "Total",
      value: invoice.total,
      detail: "Invoice total",
    },
    {
      label: "Invoice Date",
      value: invoice.invoiceDate,
      detail: `Due ${invoice.dueDate}`,
    },
    {
      label: "Delivery Ticket",
      value: invoice.ticketNumber,
      detail: "Source ticket",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/invoices"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          â† Back to Invoices
        </Link>
        {ticketId ? (
          <Link
            href={`/delivery-tickets/${ticketId}`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            View Delivery Ticket
          </Link>
        ) : null}
        <InvoiceDetailActions
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoiceNumber}
          status={invoice.status}
          canManage={canManage}
        />
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
              <DetailField
                label="Billing Contact"
                value={billingContact ?? "—"}
              />
              <DetailField label="Project" value={invoice.projectName} />
              <DetailField label="Job Number" value={invoice.jobNumber} />
              <DetailField label="Delivery Ticket" value={invoice.ticketNumber} />
              <DetailField label="Invoice Date" value={invoice.invoiceDate} />
              <DetailField label="Due Date" value={invoice.dueDate} />
              <DetailField label="Tax Rate" value={invoice.taxRate} />
            </dl>
          </SectionCard>

          <SectionCard title="Line Items" noPadding>
            <div className={tableFlushWrapperClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeaderCellClassName}>#</th>
                    <th className={tableHeaderCellClassName}>Item</th>
                    <th className={tableHeaderCellClassName}>Description</th>
                    <th className={tableHeaderCellClassName}>Qty</th>
                    <th className={tableHeaderCellClassName}>Unit</th>
                    <th className={tableHeaderCellClassName}>Unit Price</th>
                    <th className={tableHeaderCellClassName}>Total</th>
                  </tr>
                </thead>
                <tbody className={`${tableBodyClassName} text-slate-700`}>
                  {invoice.lineItems.map((line) => (
                    <tr key={line.id} className={tableRowClassName}>
                      <td className={`${tableCellClassName} text-slate-700`}>{line.lineNumber}</td>
                      <td className={`${tableCellClassName} font-medium text-slate-900`}>
                        {line.itemCode}
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}>
                        <RichTextContent value={line.description} />
                      </td>
                      <td className={`${tableCellClassName} text-slate-600`}>{line.quantity}</td>
                      <td className={`${tableCellClassName} text-slate-600`}>{line.unit}</td>
                      <td className={`${tableCellClassName} text-slate-700`}>{line.unitPrice}</td>
                      <td className={`${tableCellClassName} font-medium text-slate-900`}>
                        {line.total}
                      </td>
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
                ["Discount", invoice.discountAmount],
                ["Delivery", invoice.deliveryAmount],
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
