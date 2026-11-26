import Link from "next/link";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { JobRelatedQuote } from "@/components/jobs/job-utils";
import {
  overviewEmptyCellClassName,
  overviewTableWrapperClassName,
} from "@/components/jobs/overview/overview-styles";
import {
  tableActionButtonClassName,
  tableBodyClassName,
  tableCellClassName,
  tableCompactClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

const COLUMN_COUNT = 5;

/** The job's quotes on the Overview: who it went to, where it stands, the PDF. */
export function JobOverviewQuotes({ quotes }: { quotes: JobRelatedQuote[] }) {
  return (
    <div className={overviewTableWrapperClassName}>
      <table className={tableCompactClassName}>
        <thead>
          <tr>
            <th className={tableHeaderCellClassName}>Quote</th>
            <th className={tableHeaderCellClassName}>Contractor</th>
            <th className={tableHeaderCellClassName}>Status</th>
            <th className={tableHeaderCellClassName}>Total</th>
            <th className={tableHeaderCellClassName}>Actions</th>
          </tr>
        </thead>
        <tbody className={tableBodyClassName}>
          {quotes.length === 0 ? (
            <tr>
              <td colSpan={COLUMN_COUNT} className={overviewEmptyCellClassName}>
                No quotes for this job in the app.
              </td>
            </tr>
          ) : (
            quotes.map((quote) => (
              <tr key={quote.id} className={tableRowClassName}>
                <td className={`${tableCellClassName} whitespace-nowrap`}>
                  <Link
                    href={`/quotes/${quote.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {quote.quoteNumber}
                  </Link>
                  {quote.scopeLabel ? (
                    <span className="ml-1.5 text-2xs text-slate-500">
                      {quote.scopeLabel}
                    </span>
                  ) : null}
                </td>
                <td className={`${tableCellClassName} max-w-[16rem] text-slate-700`}>
                  {quote.customerName}
                </td>
                <td className={`${tableCellClassName} whitespace-nowrap`}>
                  <StatusBadge
                    label={quote.statusLabel}
                    variant={quote.statusVariant}
                  />
                </td>
                <td
                  className={`${tableCellClassName} whitespace-nowrap tabular-nums text-slate-900`}
                >
                  {quote.total}
                </td>
                <td className={tableCellClassName}>
                  <div className="flex flex-wrap gap-1.5">
                    <a
                      href={`/api/quotes/${quote.id}/preview`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={tableActionButtonClassName}
                    >
                      PDF
                    </a>
                    <Link
                      href={`/quotes/${quote.id}`}
                      className={tableActionButtonClassName}
                    >
                      Open
                    </Link>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
