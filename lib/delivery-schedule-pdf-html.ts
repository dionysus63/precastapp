import { getAppSettings } from "@/lib/app-settings";
import { getCompanyLogoDataUri } from "@/lib/company-logo";
import { deliveryTicketStatusLabels } from "@/components/delivery-tickets/delivery-ticket-utils";
import { formatQuantity, formatWeightLb } from "@/lib/format";
import type {
  DeliveryScheduleTicket,
  JobDeliverySchedule,
} from "@/lib/delivery-schedule-data";

export type DeliveryScheduleVariant = "contractor" | "internal";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatFriendlyDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime12(value: string | null): string {
  if (!value?.trim()) {
    return "—";
  }
  const [hours, minutes] = value.split(":");
  const hour = Number(hours);
  if (Number.isNaN(hour)) {
    return value;
  }
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes ?? "00"} ${suffix}`;
}

/** Pre-escaped HTML: one line per item so descriptions stay readable. */
function ticketContentsHtml(ticket: DeliveryScheduleTicket): string {
  if (ticket.lineItems.length === 0) {
    return "—";
  }
  return ticket.lineItems
    .map((line) => {
      const label = line.description?.trim()
        ? `${line.itemCode} — ${line.description.trim()}`
        : line.itemCode;
      return `<div>${escapeHtml(`${formatQuantity(line.quantity)}× ${label}`)}</div>`;
    })
    .join("");
}

function formatDeliveryAddress(job: JobDeliverySchedule["job"]): string | null {
  const cityStateZip = [
    job.city?.trim(),
    [job.state?.trim(), job.zip?.trim()].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const parts = [job.projectAddress?.trim(), cityStateZip].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function ticketWeight(ticket: DeliveryScheduleTicket): number | null {
  return ticket.totalWeight != null ? Number(ticket.totalWeight) : null;
}

/** Piece count = summed line quantities (totalItems only counts line rows). */
function ticketPieces(ticket: DeliveryScheduleTicket): number {
  return ticket.lineItems.reduce(
    (sum, line) => sum + Number(line.quantity),
    0,
  );
}

function loadLabel(ticket: DeliveryScheduleTicket): string {
  return ticket.loadSequence ?? "—";
}

type Totals = { loads: number; pieces: number; weight: number; hasWeight: boolean };

function sumTotals(tickets: DeliveryScheduleTicket[]): Totals {
  const totals: Totals = { loads: tickets.length, pieces: 0, weight: 0, hasWeight: false };
  for (const ticket of tickets) {
    totals.pieces += ticketPieces(ticket);
    const weight = ticketWeight(ticket);
    if (weight != null) {
      totals.weight += weight;
      totals.hasWeight = true;
    }
  }
  return totals;
}

function totalsCells(totals: Totals): string {
  return `
    <td class="num">${totals.pieces > 0 ? formatQuantity(totals.pieces) : "—"}</td>
    <td class="num">${totals.hasWeight ? escapeHtml(formatWeightLb(totals.weight)) : "—"}</td>
  `;
}

export async function buildDeliverySchedulePdfHtml(
  schedule: JobDeliverySchedule,
  variant: DeliveryScheduleVariant,
): Promise<string> {
  const settings = await getAppSettings();
  const logoDataUri = await getCompanyLogoDataUri();
  const internal = variant === "internal";

  const dated = schedule.tickets
    .filter((ticket) => ticket.deliveryDate != null)
    .sort((a, b) => {
      const dateDiff = a.deliveryDate!.getTime() - b.deliveryDate!.getTime();
      if (dateDiff !== 0) return dateDiff;
      const timeA = a.deliveryTime ?? "";
      const timeB = b.deliveryTime ?? "";
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      return 0;
    });
  const unscheduled = schedule.tickets.filter(
    (ticket) => ticket.deliveryDate == null,
  );

  const internalHeaders = internal
    ? `<th>Truck</th><th>Trailer</th><th>Driver</th><th>Status</th>`
    : "";
  const scheduledColumnCount = internal ? 10 : 6;

  const scheduledRows =
    dated.length === 0
      ? `<tr><td colspan="${scheduledColumnCount}" class="empty">No loads scheduled yet.</td></tr>`
      : dated
          .map((ticket) => {
            const delivered = ticket.status === "DELIVERED";
            const internalCells = internal
              ? `
          <td>${escapeHtml(ticket.truck ?? "—")}</td>
          <td>${escapeHtml(ticket.trailer ?? "—")}</td>
          <td>${escapeHtml(ticket.driver ?? "—")}</td>
          <td>${escapeHtml(deliveryTicketStatusLabels[ticket.status])}</td>
        `
              : "";
            const weight = ticketWeight(ticket);
            return `
        <tr>
          <td class="item">${escapeHtml(loadLabel(ticket))}</td>
          <td>
            ${escapeHtml(formatFriendlyDate(ticket.deliveryDate!))}
            ${delivered ? `<span class="delivered-tag">Delivered</span>` : ""}
          </td>
          <td>${escapeHtml(formatTime12(ticket.deliveryTime))}</td>
          <td>${ticketContentsHtml(ticket)}</td>
          <td class="num">${formatQuantity(ticketPieces(ticket))}</td>
          <td class="num">${weight != null ? escapeHtml(formatWeightLb(weight)) : "—"}</td>
          ${internalCells}
        </tr>
      `;
          })
          .join("");

  const scheduledTotals = sumTotals(dated);
  const scheduledFoot =
    dated.length === 0
      ? ""
      : `
    <tfoot>
      <tr class="totals-row">
        <td colspan="4">${scheduledTotals.loads} load${scheduledTotals.loads === 1 ? "" : "s"}</td>
        ${totalsCells(scheduledTotals)}
        ${internal ? `<td colspan="4"></td>` : ""}
      </tr>
    </tfoot>
  `;

  const unscheduledTotals = sumTotals(unscheduled);
  const unscheduledSection =
    unscheduled.length === 0
      ? ""
      : `
    <section class="unscheduled-section">
      <h2 class="section-title">Not Yet Scheduled</h2>
      <table>
        <thead>
          <tr>
            <th>Load</th>
            <th>Contents</th>
            <th class="num">Pieces</th>
            <th class="num">Weight</th>
          </tr>
        </thead>
        <tbody>
          ${unscheduled
            .map((ticket) => {
              const weight = ticketWeight(ticket);
              return `
            <tr>
              <td class="item">${escapeHtml(loadLabel(ticket))}</td>
              <td>${ticketContentsHtml(ticket)}</td>
              <td class="num">${formatQuantity(ticketPieces(ticket))}</td>
              <td class="num">${weight != null ? escapeHtml(formatWeightLb(weight)) : "—"}</td>
            </tr>
          `;
            })
            .join("")}
        </tbody>
        <tfoot>
          <tr class="totals-row">
            <td colspan="2">${unscheduledTotals.loads} load${unscheduledTotals.loads === 1 ? "" : "s"}</td>
            ${totalsCells(unscheduledTotals)}
          </tr>
        </tfoot>
      </table>
    </section>
  `;

  const emptyNotice =
    schedule.tickets.length === 0
      ? `<p class="empty-notice">No delivery loads planned yet.</p>`
      : "";

  const logoHtml = logoDataUri
    ? `<img class="company-logo" src="${logoDataUri}" alt="" />`
    : "";

  const generatedAt = new Date();
  const deliveryAddress = formatDeliveryAddress(schedule.job);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Delivery Schedule ${escapeHtml(schedule.job.jobNumber)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Arial, Helvetica, sans-serif;
        color: #171717;
        background: #fff;
        font-size: 12px;
        line-height: 1.4;
      }
      .page { max-width: 7.5in; margin: 0 auto; }
      header {
        border-bottom: 1px solid #404040;
        padding-bottom: 18px;
        margin-bottom: 18px;
      }
      .header-row { display: flex; justify-content: space-between; gap: 24px; }
      .header-brand { display: flex; align-items: flex-start; gap: 16px; }
      .company-logo { max-height: 52px; max-width: 180px; object-fit: contain; }
      .company-name { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
      .company-meta { margin: 0; color: #525252; font-size: 12px; }
      .doc-title {
        font-size: 24px;
        font-weight: 700;
        letter-spacing: 0.04em;
        margin: 0;
        text-align: right;
      }
      .internal-badge {
        display: inline-block;
        float: right;
        clear: both;
        margin-top: 6px;
        padding: 2px 8px;
        border: 1px solid #171717;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .meta-list { margin: 12px 0 0; padding: 0; font-size: 12px; clear: both; }
      .meta-list li {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-bottom: 4px;
        list-style: none;
      }
      .meta-list dt { color: #737373; margin: 0; }
      .meta-list dd { margin: 0; font-weight: 600; }
      .section-title {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #737373;
        margin: 0 0 10px;
      }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      thead th {
        border-bottom: 2px solid #171717;
        padding: 8px 10px 8px 0;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #525252;
        text-align: left;
      }
      thead th.num { text-align: right; }
      tbody td {
        border-bottom: 1px solid #d4d4d4;
        padding: 8px 10px 8px 0;
        vertical-align: top;
      }
      tbody tr { page-break-inside: avoid; }
      tbody td.item { font-weight: 600; white-space: nowrap; }
      tbody td.num,
      tfoot td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      tbody td.empty { text-align: center; color: #737373; padding: 24px 0; }
      tfoot .totals-row td {
        border-top: 1px solid #171717;
        padding: 8px 10px 8px 0;
        font-weight: 700;
      }
      .delivered-tag {
        display: inline-block;
        margin-left: 6px;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #525252;
        border: 1px solid #a3a3a3;
        padding: 1px 5px;
      }
      .unscheduled-section { margin-top: 24px; page-break-inside: avoid; }
      .empty-notice { margin: 32px 0; text-align: center; color: #737373; }
      footer {
        margin-top: 28px;
        padding-top: 14px;
        border-top: 1px solid #d4d4d4;
        page-break-inside: avoid;
        color: #737373;
        font-size: 10px;
        display: flex;
        justify-content: space-between;
        gap: 16px;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <header>
        <div class="header-row">
          <div class="header-brand">
            ${logoHtml}
            <div>
              <p class="company-name">${escapeHtml(settings.companyName)}</p>
              <p class="company-meta">${escapeHtml(settings.companyAddress)}</p>
              <p class="company-meta">${escapeHtml(settings.companyPhone)} · ${escapeHtml(settings.companyEmail)}</p>
            </div>
          </div>
          <div>
            <p class="doc-title">DELIVERY SCHEDULE</p>
            ${internal ? `<span class="internal-badge">Internal Copy</span>` : ""}
            <dl class="meta-list">
              <li><dt>Job #</dt><dd>${escapeHtml(schedule.job.jobNumber)}</dd></li>
              <li><dt>Project</dt><dd>${escapeHtml(schedule.job.projectName)}</dd></li>
              <li><dt>Customer</dt><dd>${escapeHtml(schedule.job.customerName)}</dd></li>
              ${deliveryAddress ? `<li><dt>Deliver To</dt><dd>${escapeHtml(deliveryAddress)}</dd></li>` : ""}
              <li><dt>Generated</dt><dd>${escapeHtml(formatFriendlyDate(generatedAt))}</dd></li>
            </dl>
          </div>
        </div>
      </header>

      ${emptyNotice}

      ${
        schedule.tickets.length > 0
          ? `
      <section>
        <h2 class="section-title">Scheduled Loads</h2>
        <table>
          <thead>
            <tr>
              <th>Load</th>
              <th>Date</th>
              <th>Time</th>
              <th>Contents</th>
              <th class="num">Pieces</th>
              <th class="num">Weight</th>
              ${internalHeaders}
            </tr>
          </thead>
          <tbody>${scheduledRows}</tbody>
          ${scheduledFoot}
        </table>
      </section>

      ${unscheduledSection}
      `
          : ""
      }

      <footer>
        <span>${escapeHtml(settings.companyName)} · ${escapeHtml(settings.companyPhone)} · ${escapeHtml(settings.companyEmail)}</span>
        <span>Generated ${escapeHtml(
          generatedAt.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }),
        )}</span>
      </footer>
    </div>
  </body>
</html>`;
}
