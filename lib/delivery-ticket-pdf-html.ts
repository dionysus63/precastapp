import type { CompanyProfile } from "@/lib/app-settings";
import { getAppSettings, getCompanyProfile } from "@/lib/app-settings";
import { getCompanyLogoDataUri } from "@/lib/company-logo";
import {
  getDeliveryTicketCopyTitles,
  type DeliveryTicketCopySettings,
  type DeliveryTicketPdfView,
} from "@/lib/delivery-ticket-pdf-data";

const PAGE_COUNT = 3;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function addressBlockHtml(lines: string[]): string {
  if (lines.length === 0) {
    return "";
  }
  return lines.map((line) => `${escapeHtml(line)}<br />`).join("");
}

function optionalNote(label: string, value: string): string {
  if (!value || value === "—") {
    return "";
  }
  return `<div class="note-block"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`;
}

function renderLineRows(lineItems: DeliveryTicketPdfView["lineItems"]): string {
  if (lineItems.length === 0) {
    return `<tr><td colspan="4" class="empty">No line items on this ticket.</td></tr>`;
  }

  return lineItems
    .map(
      (line) => `
      <tr>
        <td class="num">${escapeHtml(line.weight)}</td>
        <td class="num">${escapeHtml(line.qty)}</td>
        <td class="item">${escapeHtml(line.itemCode)}</td>
        <td>${escapeHtml(line.structure)}</td>
      </tr>
    `,
    )
    .join("");
}

function renderFooterParagraphs(footerText: string): string {
  return footerText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

function renderDeliveryTicketPage(
  ticket: DeliveryTicketPdfView,
  company: CompanyProfile,
  logoHtml: string,
  copyTitle: string,
  pageNumber: number,
  footerText: string,
): string {
  const driverTruck =
    ticket.driver !== "—" && ticket.truck !== "—"
      ? `${ticket.driver} / ${ticket.truck}`
      : ticket.driver !== "—"
        ? ticket.driver
        : ticket.truck;

  return `
    <section class="page${pageNumber < PAGE_COUNT ? " page-break" : ""}">
      <div class="page-body">
      <div class="top-row">
        <div class="title-block">
          <h1>Delivery Ticket</h1>
          <div class="ticket-number">${escapeHtml(ticket.ticketNumber)}</div>
          <div class="copy-title">${escapeHtml(copyTitle)}</div>
        </div>
        <div class="company company-brand">
          ${logoHtml}
          <div>
            <strong>${escapeHtml(company.name)}</strong><br />
            ${escapeHtml(company.address)}<br />
            Phone: ${escapeHtml(company.phone)}
          </div>
        </div>
      </div>

      <div class="address-grid">
        <div class="address-col">
          <div class="label-row"><span class="label">Sold to:</span> <strong>${escapeHtml(ticket.customerName)}</strong></div>
          <div class="address-lines">${addressBlockHtml(ticket.customerAddressLines)}</div>
        </div>
        <div class="address-col">
          <div class="label-row"><span class="label">Job Name:</span> <strong>${escapeHtml(ticket.projectName)}</strong></div>
          <div class="address-lines">${addressBlockHtml(ticket.deliveryAddressLines)}</div>
        </div>
      </div>

      <div class="info-grid">
        <div><span class="label">Site Contact:</span> ${escapeHtml(ticket.siteContactName)}</div>
        <div><span class="label">Job Number:</span> ${escapeHtml(ticket.jobNumber)}</div>
        <div><span class="label">Phone:</span> ${escapeHtml(ticket.siteContactPhone)}</div>
      </div>

      <table class="ship-table">
        <thead>
          <tr>
            <th>Ship Date</th>
            <th>Driver/Truck</th>
            <th>Trailer</th>
            <th>Page</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(ticket.deliveryDate)}</td>
            <td>${escapeHtml(driverTruck)}</td>
            <td>${escapeHtml(ticket.trailer)}</td>
            <td>${pageNumber} of ${PAGE_COUNT}</td>
          </tr>
        </tbody>
      </table>

      <div class="po-row">
        <span class="label">PO NO.</span>
        <span class="po-value">${escapeHtml(ticket.customerPo)}</span>
      </div>

      ${optionalNote("Memo", ticket.memo)}
      ${optionalNote("Directions", ticket.directions)}

      <table class="items-table">
        <thead>
          <tr>
            <th>Weight</th>
            <th>Qty</th>
            <th>Item</th>
            <th>Structure</th>
          </tr>
        </thead>
        <tbody>${renderLineRows(ticket.lineItems)}</tbody>
        <tfoot>
          <tr>
            <td class="num total-label" colspan="2">Total Weight</td>
            <td class="num total-value" colspan="2">Total Pieces</td>
          </tr>
          <tr>
            <td class="num" colspan="2">${escapeHtml(ticket.totalWeight)}</td>
            <td class="num" colspan="2">${escapeHtml(ticket.totalPieces)}</td>
          </tr>
        </tfoot>
      </table>
      </div>

      <div class="page-footer">
        <div class="received-by">
          <span class="label">RECEIVED BY:</span>
          <span class="line"></span>
        </div>

        <div class="footer-text">${renderFooterParagraphs(footerText)}</div>

        <div class="time-row">
          <div><span class="label">Time In</span><span class="time-line"></span></div>
          <div><span class="label">Time Out</span><span class="time-line"></span></div>
        </div>
      </div>
    </section>
  `;
}

export async function buildDeliveryTicketPdfHtml(
  ticket: DeliveryTicketPdfView,
  copySettings?: DeliveryTicketCopySettings,
) {
  const settings = await getAppSettings();
  const company = await getCompanyProfile();
  const logoDataUri = await getCompanyLogoDataUri();
  const logoHtml = logoDataUri
    ? `<img class="company-logo" src="${logoDataUri}" alt="" />`
    : "";

  const copies = copySettings ?? getDeliveryTicketCopyTitles(settings);
  const copyTitles = [copies.copy1Title, copies.copy2Title, copies.copy3Title];

  const pages = copyTitles
    .map((copyTitle, index) =>
      renderDeliveryTicketPage(
        ticket,
        company,
        logoHtml,
        copyTitle,
        index + 1,
        copies.footerText,
      ),
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(ticket.ticketNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #000;
      margin: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      min-height: 10in;
      display: flex;
      flex-direction: column;
    }
    .page-body { flex: 1 1 auto; }
    .page-footer { margin-top: auto; padding-top: 12px; }
    .page-break { page-break-after: always; }
    .top-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px; }
    .title-block h1 { font-size: 22px; font-weight: bold; margin: 0 0 4px; color: #000; }
    .ticket-number { font-size: 18px; font-weight: bold; margin-bottom: 6px; color: #000; }
    .copy-title { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.03em; color: #000; }
    .company { font-size: 10px; color: #000; line-height: 1.45; text-align: right; }
    .company-brand { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; max-width: 180px; }
    .company-logo { max-height: 32px; max-width: 120px; object-fit: contain; }
    .address-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 10px; }
    .address-col { line-height: 1.45; color: #000; }
    .label-row { margin-bottom: 2px; }
    .label { font-weight: bold; margin-right: 4px; color: #000; }
    .address-lines { padding-left: 52px; min-height: 1.2em; color: #000; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 16px; margin-bottom: 10px; color: #000; }
    .ship-table, .items-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    .ship-table th, .ship-table td,
    .items-table th, .items-table td { border: 1px solid #333; padding: 4px 6px; vertical-align: top; color: #000; }
    .ship-table th, .items-table th { background: #f0f0f0; font-size: 9px; font-weight: bold; text-transform: uppercase; text-align: left; color: #000; }
    .items-table .num { text-align: right; white-space: nowrap; }
    .items-table .item { font-weight: bold; }
    .items-table tfoot td { font-weight: bold; border-top: 2px solid #333; }
    .items-table .total-label, .items-table .total-value { text-align: center; font-size: 9px; text-transform: uppercase; }
    .empty { text-align: center; color: #000; font-style: italic; }
    .po-row { margin-bottom: 8px; color: #000; }
    .po-value { margin-left: 8px; font-weight: bold; }
    .note-block { margin-bottom: 6px; line-height: 1.4; color: #000; }
    .received-by { margin: 0 0 10px; display: flex; align-items: baseline; gap: 8px; color: #000; }
    .received-by .line { flex: 1; border-bottom: 1px solid #333; min-width: 200px; height: 14px; }
    .footer-text { font-size: 10px; line-height: 1.45; margin-bottom: 10px; color: #000; }
    .footer-text p { margin: 0 0 4px; }
    .time-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; color: #000; }
    .time-row .label { font-weight: bold; margin-right: 8px; }
    .time-line { display: inline-block; min-width: 120px; border-bottom: 1px solid #333; height: 14px; vertical-align: bottom; }
  </style>
</head>
<body>
  ${pages}
</body>
</html>`;
}
