import { getAppSettings } from "@/lib/app-settings";
import { buildQuotePdfBaseName } from "@/lib/quote-pdf-path";
import type { DbQuoteForPdf } from "@/lib/quote-pdf-data";

/** Default templates, shown as placeholder text on Settings → Company. */
export const DEFAULT_QUOTE_EMAIL_SUBJECT_TEMPLATE =
  "{companyName} Quote {quoteNumber} — {project}";

export const DEFAULT_QUOTE_EMAIL_BODY_TEMPLATE = `Hello {contact},

Please find attached our quote {quoteNumber} for your review.
Project: {project}

If you have any questions, reply to this email or call us at {companyPhone}.

Thank you,
{companyName}
{companyEmail}`;

export const QUOTE_EMAIL_TEMPLATE_PLACEHOLDERS = [
  "{contact}",
  "{customer}",
  "{project}",
  "{quoteNumber}",
  "{companyName}",
  "{companyPhone}",
  "{companyEmail}",
] as const;

export type QuoteEmailTemplateVars = {
  contact: string;
  customer: string;
  project: string;
  quoteNumber: string;
  companyName: string;
  companyPhone: string;
  companyEmail: string;
};

/**
 * Substitutes {placeholder} tokens, then tidies the artifacts empty values
 * leave behind so "Hello {contact}," still reads well with no contact:
 * - space before punctuation ("Hello ," -> "Hello,")
 * - dangling separators at the end of a line ("Quote Q-1 — " -> "Quote Q-1")
 * - label-only lines ("Project:" with nothing after it) are dropped
 * - runs of 3+ newlines collapse to one blank line
 * Unknown {tokens} are left as typed so a typo is visible in the preview
 * instead of silently vanishing.
 */
export function renderQuoteEmailTemplate(
  template: string,
  vars: QuoteEmailTemplateVars,
): string {
  const substituted = template.replace(
    /\{(contact|customer|project|quoteNumber|companyName|companyPhone|companyEmail)\}/g,
    (_, key: keyof QuoteEmailTemplateVars) => vars[key] ?? "",
  );

  return substituted
    .split("\n")
    .map((line) => line.replace(/[ \t]+([,.;!?])/g, "$1").replace(/[ \t]+$/, ""))
    .map((line) => line.replace(/\s*[—–-]\s*$/, ""))
    .filter((line) => !/^[A-Za-z][A-Za-z ]*:$/.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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

async function buildTemplateVars(
  quote: DbQuoteForPdf,
): Promise<{ vars: QuoteEmailTemplateVars; settings: Awaited<ReturnType<typeof getAppSettings>> }> {
  const settings = await getAppSettings();
  return {
    settings,
    vars: {
      contact: quote.contactName?.trim() ?? "",
      customer: quote.customerName.trim(),
      project: quote.projectName.trim(),
      quoteNumber: formatQuoteLabel(quote),
      companyName: settings.companyName,
      companyPhone: settings.companyPhone,
      companyEmail: settings.companyEmail,
    },
  };
}

export async function buildDefaultQuoteEmailSubject(
  quote: DbQuoteForPdf,
): Promise<string> {
  const { vars, settings } = await buildTemplateVars(quote);
  const template =
    settings.quoteEmailSubjectTemplate?.trim() ||
    DEFAULT_QUOTE_EMAIL_SUBJECT_TEMPLATE;
  return renderQuoteEmailTemplate(template, vars);
}

export async function buildDefaultQuoteEmailMessage(
  quote: DbQuoteForPdf,
): Promise<string> {
  const { vars, settings } = await buildTemplateVars(quote);
  const template =
    settings.quoteEmailBodyTemplate?.trim() ||
    DEFAULT_QUOTE_EMAIL_BODY_TEMPLATE;
  return renderQuoteEmailTemplate(template, vars);
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
