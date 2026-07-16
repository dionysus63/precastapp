import { getCompanyProfile } from "@/lib/app-settings";
import { formatUsd } from "@/lib/format";
import type { DbInvoiceForPdf } from "@/lib/invoice-pdf-data";

/**
 * Cover page for the "Print all drafts" batch: one row per draft invoice with
 * the money summary the bookkeeper checks against paper tickets, plus grand
 * totals. Prepended to the merged batch PDF.
 */

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(value: Date | null | undefined): string {
  if (!value) return "—";
  return value.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function money(value: { toString(): string } | number | null): string {
  return formatUsd(value, { nullDisplay: "—" });
}

export async function buildDraftInvoiceCoverHtml(
  invoices: DbInvoiceForPdf[],
): Promise<string> {
  const company = await getCompanyProfile();

  const totals = invoices.reduce(
    (sum, invoice) => {
      sum.subtotal += Number(invoice.subtotal) - Number(invoice.discountAmount);
      sum.delivery += Number(invoice.deliveryAmount);
      sum.tax += Number(invoice.salesTax);
      sum.total += Number(invoice.total);
      return sum;
    },
    { subtotal: 0, delivery: 0, tax: 0, total: 0 },
  );
  const hasDeliveryCharges = invoices.some(
    (invoice) => Number(invoice.deliveryAmount) !== 0,
  );
  const hasDiscounts = invoices.some(
    (invoice) => Number(invoice.discountAmount) !== 0,
  );
  const pickupCount = invoices.filter(
    (invoice) => invoice.deliveryTicket.fulfillmentMethod === "PICKUP",
  ).length;
  const deliveryCount = invoices.length - pickupCount;

  const rows = invoices
    .map((invoice) => {
      const ticket = invoice.deliveryTicket;
      const isPickup = ticket.fulfillmentMethod === "PICKUP";
      const subtotalAfterDiscount =
        Number(invoice.subtotal) - Number(invoice.discountAmount);
      return `
        <tr>
          <td>${escapeHtml(formatDate(ticket.deliveryDate))}</td>
          <td class="mono">${escapeHtml(invoice.invoiceNumber ?? "—")}</td>
          <td class="mono">${escapeHtml(ticket.ticketNumber)}</td>
          <td>
            <div class="customer">${escapeHtml(invoice.customerName ?? "—")}</div>
            <div class="project">${escapeHtml(invoice.projectName ?? "")}</div>
          </td>
          <td><span class="type ${isPickup ? "pickup" : "delivery"}">${isPickup ? "Pickup" : "Delivery"}</span></td>
          <td class="num">${money(subtotalAfterDiscount)}</td>
          ${hasDeliveryCharges ? `<td class="num">${money(invoice.deliveryAmount)}</td>` : ""}
          <td class="num">${money(invoice.salesTax)}<span class="rate">@ ${Number(invoice.taxRate).toFixed(3)}%</span></td>
          <td class="num total">${money(invoice.total)}</td>
        </tr>
      `;
    })
    .join("");

  const printedAt = new Date().toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Draft Invoice Review</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; margin: 0; font-size: 12px; }
    .letterhead { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f172a; padding-bottom: 12px; }
    .company-name { font-size: 20px; font-weight: bold; letter-spacing: 0.02em; }
    .company-meta { color: #4b5563; font-size: 11px; margin-top: 3px; }
    .doc-title { text-align: right; }
    .doc-title h1 { font-size: 18px; margin: 0; text-transform: uppercase; letter-spacing: 0.06em; color: #0f172a; }
    .doc-title .printed { color: #6b7280; font-size: 10px; margin-top: 4px; }
    .summary { display: flex; gap: 24px; margin: 14px 0 4px; }
    .summary .stat { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 14px; background: #f8fafc; }
    .summary .stat .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
    .summary .stat .value { font-size: 15px; font-weight: bold; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th { background: #0f172a; color: #ffffff; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.06em; padding: 7px 8px; text-align: left; }
    th.num, td.num { text-align: right; }
    td { border-bottom: 1px solid #e2e8f0; padding: 7px 8px; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .mono { font-family: "Courier New", monospace; font-size: 11px; white-space: nowrap; }
    .customer { font-weight: bold; }
    .project { color: #6b7280; font-size: 10.5px; }
    .type { display: inline-block; border-radius: 9px; padding: 2px 9px; font-size: 9.5px; font-weight: bold; }
    .type.delivery { background: #e0f2fe; color: #075985; }
    .type.pickup { background: #ede9fe; color: #5b21b6; }
    .num { white-space: nowrap; }
    .rate { display: block; color: #94a3b8; font-size: 8.5px; }
    .total { font-weight: bold; }
    tfoot td { border-top: 2px solid #0f172a; border-bottom: none; background: #ffffff !important; font-weight: bold; padding-top: 9px; }
    tfoot .label { text-align: right; text-transform: uppercase; font-size: 10px; letter-spacing: 0.06em; color: #334155; }
    .note { margin-top: 12px; color: #6b7280; font-size: 10px; }
    .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e2e8f0; color: #9ca3af; font-size: 9.5px; }
  </style>
</head>
<body>
  <div class="letterhead">
    <div>
      <div class="company-name">${escapeHtml(company.name)}</div>
      <div class="company-meta">${escapeHtml(company.address)}</div>
      <div class="company-meta">${escapeHtml(company.phone)} · ${escapeHtml(company.email)}</div>
    </div>
    <div class="doc-title">
      <h1>Draft Invoice Review</h1>
      <div class="printed">Printed ${escapeHtml(printedAt)}</div>
    </div>
  </div>

  <div class="summary">
    <div class="stat">
      <div class="label">Draft invoices</div>
      <div class="value">${invoices.length}</div>
    </div>
    <div class="stat">
      <div class="label">Deliveries / Pickups</div>
      <div class="value">${deliveryCount} / ${pickupCount}</div>
    </div>
    <div class="stat">
      <div class="label">Batch total</div>
      <div class="value">${money(totals.total)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Delivered</th>
        <th>Invoice #</th>
        <th>Ticket #</th>
        <th>Customer / Project</th>
        <th>Type</th>
        <th class="num">Subtotal</th>
        ${hasDeliveryCharges ? `<th class="num">Delivery</th>` : ""}
        <th class="num">Tax</th>
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
    <tfoot>
      <tr>
        <td class="label" colspan="5">Batch totals</td>
        <td class="num">${money(totals.subtotal)}</td>
        ${hasDeliveryCharges ? `<td class="num">${money(totals.delivery)}</td>` : ""}
        <td class="num">${money(totals.tax)}</td>
        <td class="num total">${money(totals.total)}</td>
      </tr>
    </tfoot>
  </table>

  ${hasDiscounts ? `<p class="note">Subtotals are shown after line discounts.</p>` : ""}
  <p class="footer">Draft invoices follow this page in the order listed. Generated by Precast Ops.</p>
</body>
</html>`;
}
