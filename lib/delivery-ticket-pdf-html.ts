import type { DeliveryTicketDetailView } from "@/components/delivery-tickets/delivery-ticket-utils";
import { getCompanyProfile } from "@/lib/app-settings";
import { getCompanyLogoDataUri } from "@/lib/company-logo";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function buildDeliveryTicketPdfHtml(ticket: DeliveryTicketDetailView) {
  const company = await getCompanyProfile();
  const logoDataUri = await getCompanyLogoDataUri();
  const logoHtml = logoDataUri
    ? `<img class="company-logo" src="${logoDataUri}" alt="" />`
    : "";
  const lineRows =
    ticket.lineItems.length === 0
      ? `<tr><td colspan="7" class="empty">No line items on this ticket.</td></tr>`
      : ticket.lineItems
          .map(
            (line) => `
        <tr>
          <td class="num">${line.lineNumber}</td>
          <td>${escapeHtml(line.type.replace(/_/g, " "))}</td>
          <td class="item">${escapeHtml(line.item)}</td>
          <td>${escapeHtml(line.description)}</td>
          <td class="num">${escapeHtml(line.qty)}</td>
          <td>${escapeHtml(line.unit)}</td>
          <td class="num">${escapeHtml(line.totalWeight)}</td>
        </tr>
      `,
          )
          .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(ticket.ticketNumber)}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 13px; margin: 18px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 16px; gap: 16px; }
    .company { font-size: 10px; color: #444; line-height: 1.4; text-align: right; }
    .company-brand { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
    .company-logo { max-height: 48px; max-width: 160px; object-fit: contain; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-bottom: 16px; }
    .field dt { font-size: 9px; text-transform: uppercase; color: #666; margin-bottom: 2px; }
    .field dd { margin: 0; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; vertical-align: top; }
    th { background: #f5f5f5; text-align: left; font-size: 9px; text-transform: uppercase; }
    .num { text-align: right; white-space: nowrap; }
    .item { font-weight: 600; }
    .empty { text-align: center; color: #666; font-style: italic; }
    .notes { margin-top: 12px; font-size: 10px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Delivery Ticket ${escapeHtml(ticket.ticketNumber)}</h1>
      <p>${escapeHtml(ticket.projectName)} — ${escapeHtml(ticket.customer)}</p>
    </div>
    <div class="company company-brand">
      ${logoHtml}
      <div>
        <strong>${company.name}</strong><br />
        ${company.address}<br />
        ${company.phone}
      </div>
    </div>
  </div>

  <div class="meta">
    <dl class="field"><dt>Status</dt><dd>${escapeHtml(ticket.statusLabel)}</dd></dl>
    <dl class="field"><dt>Delivery Date</dt><dd>${escapeHtml(ticket.deliveryDate)} ${escapeHtml(ticket.deliveryTime)}</dd></dl>
    <dl class="field"><dt>Job Number</dt><dd>${escapeHtml(ticket.jobNumber)}</dd></dl>
    <dl class="field"><dt>Delivery Address</dt><dd>${escapeHtml(ticket.deliveryAddress)}</dd></dl>
    <dl class="field"><dt>Truck / Trailer</dt><dd>${escapeHtml(ticket.truck)} / ${escapeHtml(ticket.trailer)}</dd></dl>
    <dl class="field"><dt>Driver</dt><dd>${escapeHtml(ticket.driver)}</dd></dl>
    <dl class="field"><dt>Site Contact</dt><dd>${escapeHtml(ticket.siteContactName)} · ${escapeHtml(ticket.siteContactPhone)}</dd></dl>
    <dl class="field"><dt>Total Weight</dt><dd>${escapeHtml(ticket.totalWeight)}</dd></dl>
  </div>

  <h2>Delivery Items</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Type</th>
        <th>Item</th>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit</th>
        <th>Weight</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>

  <div class="notes">
    ${ticket.driverNotes !== "—" ? `<p><strong>Driver notes:</strong> ${escapeHtml(ticket.driverNotes)}</p>` : ""}
    ${ticket.loadingNotes !== "—" ? `<p><strong>Loading notes:</strong> ${escapeHtml(ticket.loadingNotes)}</p>` : ""}
    ${ticket.siteInstructions !== "—" ? `<p><strong>Site instructions:</strong> ${escapeHtml(ticket.siteInstructions)}</p>` : ""}
  </div>
</body>
</html>`;
}
