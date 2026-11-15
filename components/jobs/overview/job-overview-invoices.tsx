"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { markInvoicePaid } from "@/app/invoices/actions";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  overviewEmptyCellClassName,
  overviewHeaderButtonClassName,
  overviewTableWrapperClassName,
} from "@/components/jobs/overview/overview-styles";
import type { JobOverviewInvoice, JobOverviewMoney } from "@/lib/job-overview";
import { printPdfUrl } from "@/lib/print-pdf-url";
import { reloadAfterAction } from "@/lib/reload-after-action";
import {
  tableActionButtonClassName,
  tableActionPositiveButtonClassName,
  tableBodyClassName,
  tableCellClassName,
  tableCompactClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

const COLUMN_COUNT = 5;

/** The selected-invoices PDF takes at most this many at once. */
const MAX_PRINT_ALL = 200;

/** Print every invoice of the job that is not void, as one PDF. */
export function PrintAllInvoicesButton({
  invoices,
}: {
  invoices: JobOverviewInvoice[];
}) {
  const ids = invoices
    .filter((invoice) => !invoice.isVoid)
    .slice(0, MAX_PRINT_ALL)
    .map((invoice) => invoice.id);
  if (ids.length === 0) {
    return null;
  }
  return (
    <button
      type="button"
      onClick={() => printPdfUrl(`/api/invoices/selected/pdf?ids=${ids.join(",")}`)}
      className={overviewHeaderButtonClassName}
    >
      Print All
    </button>
  );
}

function MoneyFigure({ label, value }: { label: string; value: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-slate-500">{label}:</span>{" "}
      <span className="font-semibold tabular-nums text-slate-900">{value}</span>
    </span>
  );
}

/**
 * The job's invoices on the Overview: the money in one line, then each
 * invoice with the step it is waiting on (set a price, mark it paid).
 */
export function JobOverviewInvoices({
  invoices,
  money,
  canManageInvoices,
}: {
  invoices: JobOverviewInvoice[];
  money: JobOverviewMoney;
  /** Set a price, mark paid. */
  canManageInvoices: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function markPaid(invoice: JobOverviewInvoice) {
    setError(null);
    startTransition(async () => {
      const result = await markInvoicePaid(invoice.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      reloadAfterAction({
        type: "success",
        text: `Invoice ${invoice.invoiceNumber} marked paid.`,
      });
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-slate-200 px-3 py-2 text-xs">
        {money.won != null ? <MoneyFigure label="Won" value={money.won} /> : null}
        <MoneyFigure label="Invoiced" value={money.invoiced} />
        <MoneyFigure label="Paid" value={money.paid} />
        {money.leftToInvoice != null ? (
          <MoneyFigure label="Left to Invoice" value={money.leftToInvoice} />
        ) : null}
      </div>
      <div className={overviewTableWrapperClassName}>
        <table className={tableCompactClassName}>
          <thead>
            <tr>
              <th className={tableHeaderCellClassName}>Invoice</th>
              <th className={tableHeaderCellClassName}>Ticket</th>
              <th className={tableHeaderCellClassName}>Status</th>
              <th className={tableHeaderCellClassName}>Total</th>
              <th className={tableHeaderCellClassName}>Actions</th>
            </tr>
          </thead>
          <tbody className={tableBodyClassName}>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className={overviewEmptyCellClassName}>
                  No invoices yet. One is made when a load is marked delivered.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id} className={tableRowClassName}>
                  <td className={`${tableCellClassName} whitespace-nowrap`}>
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td
                    className={`${tableCellClassName} whitespace-nowrap text-slate-600`}
                  >
                    {invoice.ticketNumber}
                  </td>
                  <td className={`${tableCellClassName} whitespace-nowrap`}>
                    {invoice.needsPrice ? (
                      <StatusBadge label="Price needed" variant="warning" />
                    ) : (
                      <StatusBadge
                        label={invoice.statusLabel}
                        variant={invoice.statusVariant}
                      />
                    )}
                  </td>
                  <td
                    className={`${tableCellClassName} whitespace-nowrap tabular-nums text-slate-900`}
                  >
                    {invoice.total}
                  </td>
                  <td className={tableCellClassName}>
                    <div className="flex flex-wrap gap-1.5">
                      {canManageInvoices && invoice.needsPrice ? (
                        <Link
                          href={`/invoices/${invoice.id}/edit`}
                          className={tableActionButtonClassName}
                        >
                          Set Price
                        </Link>
                      ) : null}
                      {canManageInvoices &&
                      invoice.unpaid &&
                      !invoice.needsPrice ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => markPaid(invoice)}
                          className={tableActionPositiveButtonClassName}
                        >
                          Mark Paid
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          printPdfUrl(`/api/invoices/${invoice.id}/pdf`)
                        }
                        className={tableActionButtonClassName}
                      >
                        Print
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {error ? (
        <p className="px-3 py-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
