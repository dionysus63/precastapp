import { getCompanyProfile } from "@/lib/app-settings";
import { buildQuotePdfBaseName } from "@/lib/quote-pdf-path";
import type { DbQuoteForPdf } from "@/lib/quote-pdf-data";

function formatQuoteLabel(quote: DbQuoteForPdf): string {
  const base = quote.quoteNumber.trim();
  if (quote.revisionNumber > 0) {
    return `${base} (R${quote.revisionNumber})`;
  }
  return base;
}

export function buildQuotePdfAttachmentFilename(quote: DbQuoteForPdf): string {
  const baseName = buildQuotePdfBaseName(
    quote.quoteNumber,
    quote.customerName,
    quote.projectName,
  );
  return `${baseName}.pdf`;
}

export async function buildDefaultQuoteEmailSubject(
  quote: DbQuoteForPdf,
): Promise<string> {
  const company = await getCompanyProfile();
  const quoteLabel = formatQuoteLabel(quote);
  const project = quote.projectName.trim();
  return project
    ? `${company.name} Quote ${quoteLabel} — ${project}`
    : `${company.name} Quote ${quoteLabel}`;
}

export async function buildDefaultQuoteEmailMessage(
  quote: DbQuoteForPdf,
): Promise<string> {
  const company = await getCompanyProfile();
  const contactName = quote.contactName?.trim();
  const greeting = contactName ? `Hello ${contactName},` : "Hello,";
  const quoteLabel = formatQuoteLabel(quote);
  const projectLine = quote.projectName.trim()
    ? `\nProject: ${quote.projectName.trim()}`
    : "";

  return `${greeting}

Please find attached our quote ${quoteLabel} for your review.${projectLine}

If you have any questions, reply to this email or call us at ${company.phone}.

Thank you,
${company.name}
${company.email}`.trim();
}

export function buildQuoteEmailHtml(textBody: string): string {
  const escaped = textBody
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<!DOCTYPE html>
<html lang="en">
  <body style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #171717;">
    ${escaped.replace(/\n/g, "<br>")}
  </body>
</html>`;
}
