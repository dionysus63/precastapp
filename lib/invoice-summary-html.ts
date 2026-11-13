import { formatUsd } from "@/lib/format";
import { invoiceNeedsPrice, type DbInvoiceForPdf } from "@/lib/invoice-pdf-data";

/**
 * The Invoice Summary page printed on top of a stack of invoices: one line
 * per ticket with the five things the office types into QuickBooks (ticket
 * number, contractor, job name, price, tax) plus the total, and the stack's
 * totals at the bottom — so the entry is done from one sheet instead of
 * leafing through every invoice.
 *
 * An invoice that still has a line waiting for a price is listed WITHOUT
 * amounts and left out of the totals, so nobody types a short total.
 */

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function money(value: number): string {
  return formatUsd(value, { nullDisplay: "—" });
}

export type InvoiceSummaryRow = {
  ticketNumber: string;
  contractor: string;
  jobName: string;
  /** Price before tax (subtotal with any discount taken off). */
  price: number;
  tax: number;
  total: number;
  needsPrice: boolean;
};

export type InvoiceSummaryTotals = {
  price: number;
  tax: number;
  total: number;
  /** Invoices left out of the totals because a line still needs a price. */
  waitingForPrice: number;
};

export function buildInvoiceSummaryRows(
  invoices: DbInvoiceForPdf[],
): { rows: InvoiceSummaryRow[]; totals: InvoiceSummaryTotals } {
  const rows = invoices.map((invoice) => ({
    ticketNumber: invoice.deliveryTicket.ticketNumber ?? "—",
    contractor: invoice.customerName ?? "",
    jobName: invoice.projectName ?? "",
    price: Number(invoice.subtotal) - Number(invoice.discountAmount),
    tax: Number(invoice.salesTax),
    total: Number(invoice.total),
    needsPrice: invoiceNeedsPrice(invoice),
  }));

  // Summed in cents so forty rows of dollars-and-cents never drift.
  const cents = (value: number) => Math.round(value * 100);
  const priced = rows.filter((row) => !row.needsPrice);
  const sum = (pick: (row: InvoiceSummaryRow) => number) =>
    priced.reduce((total, row) => total + cents(pick(row)), 0) / 100;

  return {
    rows,
    totals: {
      price: sum((row) => row.price),
      tax: sum((row) => row.tax),
      total: sum((row) => row.total),
      waitingForPrice: rows.length - priced.length,
    },
  };
}

export function buildInvoiceSummaryHtml(
  invoices: DbInvoiceForPdf[],
  options: {
    /** What this stack is, e.g. "Invoices made 11/13/2026". */
    heading: string;
    /** How the invoices behind the page are ordered. */
    order: string;
  },
): string {
  const { rows, totals } = buildInvoiceSummaryRows(invoices);

  const body = rows
    .map(
      (row) => `
        <tr>
          <td class="n">${escapeHtml(row.ticketNumber)}</td>
          <td>${escapeHtml(row.contractor)}</td>
          <td>${escapeHtml(row.jobName)}</td>
          ${
            row.needsPrice
              ? `<td class="flag" colspan="3">PRICE NEEDED, not in the totals</td>`
              : `<td class="n">${money(row.price)}</td>
          <td class="n">${money(row.tax)}</td>
          <td class="n">${money(row.total)}</td>`
          }
        </tr>`,
    )
    .join("");

  const totalsLabel =
    totals.waitingForPrice > 0
      ? `Totals, without ${totals.waitingForPrice} that ${
          totals.waitingForPrice === 1 ? "needs" : "need"
        } a price`
      : "Totals";

  const meta = [
    options.heading,
    `${rows.length} invoice${rows.length === 1 ? "" : "s"}`,
    options.order,
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" · ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice Summary</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; font-size: 12.5px; line-height: 1.35; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .meta { color: #4b5563; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    th, td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid #cbd5e1; }
    th { background: #e5e7eb; font-weight: bold; border-top: 1px solid #cbd5e1; }
    .n { white-space: nowrap; }
    .flag { font-weight: bold; color: #92400e; }
    tr.tot td { font-weight: bold; border-top: 2px solid #111827; border-bottom: none; }
    .foot { color: #4b5563; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>Invoice Summary</h1>
  <div class="meta">${meta}</div>
  <table>
    <thead>
      <tr>
        <th class="n">Ticket</th>
        <th>Contractor</th>
        <th>Job name</th>
        <th class="n">Price</th>
        <th class="n">Tax</th>
        <th class="n">Total</th>
      </tr>
    </thead>
    <tbody>${body}
      <tr class="tot">
        <td colspan="3">${escapeHtml(totalsLabel)}</td>
        <td class="n">${money(totals.price)}</td>
        <td class="n">${money(totals.tax)}</td>
        <td class="n">${money(totals.total)}</td>
      </tr>
    </tbody>
  </table>
  <p class="foot">Ticket number, contractor, job name, price and tax for QuickBooks are on one line per ticket. The invoices follow this page.</p>
</body>
</html>`;
}
