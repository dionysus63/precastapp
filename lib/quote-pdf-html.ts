import type { QuoteDetailView } from "@/components/quotes/quote-utils";
import { isCategoryLineItem } from "@/lib/quotes/constants";
import {
  DEFAULT_QUOTE_FOOTER_TEXT,
  getAppSettings,
  type CompanyProfile,
} from "@/lib/app-settings";
import { getCompanyLogoDataUri } from "@/lib/company-logo";
import { sanitizeRichText } from "@/lib/rich-text";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fieldBlock(label: string, value: string) {
  if (!value || value === "—") {
    return "";
  }

  return `
    <div class="field">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `;
}

function notesBlock(label: string, value: string) {
  if (!value || value === "—") {
    return "";
  }

  return `
    <div class="notes-block">
      <h3>${escapeHtml(label)}</h3>
      <p>${escapeHtml(value)}</p>
    </div>
  `;
}

export async function buildQuotePdfHtml(quote: QuoteDetailView) {
  const settings = await getAppSettings();
  const logoDataUri = await getCompanyLogoDataUri();
  const company: CompanyProfile = {
    name: settings.companyName,
    address: settings.companyAddress,
    phone: settings.companyPhone,
    email: settings.companyEmail,
  };
  const footerText = settings.quoteFooterText ?? DEFAULT_QUOTE_FOOTER_TEXT;
  const footerParagraphs = footerText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const lineRows =
    quote.lineItems.length === 0
      ? `<tr><td colspan="6" class="empty">No line items on this quote.</td></tr>`
      : quote.lineItems
          .map((line) =>
            isCategoryLineItem(line.type)
              ? `
        <tr class="category-line">
          <td colspan="6"><strong><u>${escapeHtml(line.description)}</u></strong></td>
        </tr>
      `
              : `
        <tr>
          <td class="item">${escapeHtml(line.item)}</td>
          <td class="rich-text">${sanitizeRichText(line.description)}</td>
          <td class="num">${escapeHtml(line.qty)}</td>
          <td>${escapeHtml(line.unit)}</td>
          <td class="num">${escapeHtml(line.unitPrice)}</td>
          <td class="num total">${escapeHtml(line.total)}</td>
        </tr>
      `,
          )
          .join("");

  const customerFields = [
    fieldBlock("Customer Name", quote.customer),
    fieldBlock("Contact Name", quote.contactName),
    fieldBlock("Contact Role", quote.contactTitle),
    fieldBlock("Contact Email", quote.contactEmail),
    fieldBlock("Contact Phone", quote.contactPhone),
    fieldBlock("Project Name", quote.projectName),
    fieldBlock("Project Address", quote.projectAddress),
    fieldBlock("Job Number", quote.jobNumber),
    fieldBlock("Customer PO", quote.customerPo),
  ].join("");

  const notesSections = [
    notesBlock("Notes", quote.customerNotes),
    notesBlock("Lead Time", quote.leadTime),
    notesBlock("Delivery Notes", quote.deliveryNotes),
    notesBlock("Terms & Conditions", quote.terms),
  ].join("");

  const hasNotes = notesSections.trim().length > 0;
  const logoHtml = logoDataUri
    ? `<img class="company-logo" src="${logoDataUri}" alt="" />`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(quote.quoteNumber)} Quote</title>
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
      .page {
        max-width: 7.5in;
        margin: 0 auto;
        padding: 0;
      }
      header {
        border-bottom: 1px solid #404040;
        padding-bottom: 18px;
        margin-bottom: 18px;
      }
      .header-row {
        display: flex;
        justify-content: space-between;
        gap: 24px;
      }
      .header-brand {
        display: flex;
        align-items: flex-start;
        gap: 16px;
      }
      .company-logo {
        max-height: 52px;
        max-width: 180px;
        object-fit: contain;
      }
      .company-name {
        font-size: 18px;
        font-weight: 700;
        margin: 0 0 4px;
      }
      .company-meta {
        margin: 0;
        color: #525252;
        font-size: 12px;
      }
      .doc-title {
        font-size: 24px;
        font-weight: 700;
        letter-spacing: 0.04em;
        margin: 0;
        text-align: right;
      }
      .meta-list {
        margin: 12px 0 0;
        padding: 0;
        list-style: none;
        font-size: 12px;
      }
      .meta-list li {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-bottom: 4px;
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
      .customer-section {
        border-bottom: 1px solid #d4d4d4;
        padding-bottom: 18px;
        margin-bottom: 18px;
      }
      .field-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px 16px;
      }
      .field dt {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #737373;
        margin: 0 0 2px;
      }
      .field dd {
        margin: 0;
        font-size: 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
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
      tbody td.item { font-weight: 600; }
      tbody td.rich-text b,
      tbody td.rich-text strong { font-weight: 700; }
      tbody td.rich-text i,
      tbody td.rich-text em { font-style: italic; }
      tbody td.rich-text u { text-decoration: underline; }
      tbody td.num { text-align: right; font-variant-numeric: tabular-nums; }
      tbody td.total { font-weight: 600; }
      tbody tr.category-line td {
        font-weight: 700;
        padding-top: 10px;
        padding-bottom: 6px;
      }
      tbody td.empty {
        text-align: center;
        color: #737373;
        padding: 24px 0;
      }
      .summary {
        margin-top: 18px;
        display: flex;
        justify-content: flex-end;
        page-break-inside: avoid;
      }
      .summary dl {
        width: 260px;
        margin: 0;
      }
      .summary-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 6px;
      }
      .summary-row dt { color: #525252; margin: 0; }
      .summary-row dd {
        margin: 0;
        font-variant-numeric: tabular-nums;
      }
      .summary-total {
        border-top: 1px solid #171717;
        padding-top: 8px;
        margin-top: 8px;
        font-weight: 700;
      }
      .summary-total dd { font-size: 16px; }
      .notes-section {
        margin-top: 24px;
        padding-top: 18px;
        border-top: 1px solid #d4d4d4;
        page-break-inside: avoid;
      }
      .notes-block h3 {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #737373;
        margin: 0 0 4px;
      }
      .notes-block p {
        margin: 0 0 12px;
        white-space: pre-wrap;
      }
      footer {
        margin-top: 28px;
        padding-top: 18px;
        border-top: 1px solid #d4d4d4;
        page-break-inside: avoid;
      }
      .signature-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 32px;
        margin-top: 28px;
      }
      .signature-line {
        border-bottom: 1px solid #737373;
        height: 18px;
      }
      .signature-label {
        margin: 4px 0 0;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #737373;
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
              <p class="company-name">${escapeHtml(company.name)}</p>
              <p class="company-meta">${escapeHtml(company.address)}</p>
              <p class="company-meta">${escapeHtml(company.phone)} · ${escapeHtml(company.email)}</p>
            </div>
          </div>
          <div>
            <p class="doc-title">QUOTE</p>
            <dl class="meta-list">
              <li><dt>Quote #</dt><dd>${escapeHtml(quote.quoteNumber)}</dd></li>
              <li><dt>Date</dt><dd>${escapeHtml(quote.quoteDate)}</dd></li>
              <li><dt>Expires</dt><dd>${escapeHtml(quote.expirationDate)}</dd></li>
              <li><dt>Revision</dt><dd>${escapeHtml(quote.revision)}</dd></li>
            </dl>
          </div>
        </div>
      </header>

      <section class="customer-section">
        <h2 class="section-title">Customer &amp; Project</h2>
        <dl class="field-grid">${customerFields}</dl>
      </section>

      <section>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Description</th>
              <th class="num">Qty</th>
              <th>Unit</th>
              <th class="num">Unit Price</th>
              <th class="num">Total</th>
            </tr>
          </thead>
          <tbody>${lineRows}</tbody>
        </table>
      </section>

      <section class="summary">
        <dl>
          <div class="summary-row"><dt>Subtotal</dt><dd>${escapeHtml(quote.summary.subtotal)}</dd></div>
          <div class="summary-row"><dt>Discount</dt><dd>${escapeHtml(quote.summary.discount)}</dd></div>
          <div class="summary-row"><dt>Delivery</dt><dd>${escapeHtml(quote.summary.delivery)}</dd></div>
          <div class="summary-row"><dt>Taxable Amount</dt><dd>${escapeHtml(quote.summary.taxableAmount)}</dd></div>
          <div class="summary-row"><dt>Sales Tax</dt><dd>${escapeHtml(quote.summary.salesTax)}</dd></div>
          <div class="summary-row summary-total"><dt>Total</dt><dd>${escapeHtml(quote.summary.total)}</dd></div>
        </dl>
      </section>

      ${
        hasNotes
          ? `<section class="notes-section">${notesSections}</section>`
          : ""
      }

      <footer>
        ${footerParagraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n        ")}
        <div class="signature-grid">
          <div>
            <div class="signature-line"></div>
            <p class="signature-label">Authorized Signature</p>
          </div>
          <div>
            <div class="signature-line"></div>
            <p class="signature-label">Date Accepted</p>
          </div>
        </div>
      </footer>
    </div>
  </body>
</html>`;
}
