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

/** Email-safe fonts offered in Settings; value -> CSS stack. */
export const QUOTE_EMAIL_FONT_OPTIONS = [
  { value: "Arial", stack: "Arial, Helvetica, sans-serif" },
  { value: "Calibri", stack: "Calibri, Arial, sans-serif" },
  { value: "Verdana", stack: "Verdana, Geneva, sans-serif" },
  { value: "Tahoma", stack: "Tahoma, Geneva, sans-serif" },
  { value: "Georgia", stack: "Georgia, 'Times New Roman', serif" },
  { value: "Times New Roman", stack: "'Times New Roman', Times, serif" },
  {
    value: "Bookman Old Style",
    stack: "'Bookman Old Style', Georgia, serif",
  },
] as const;

export const DEFAULT_QUOTE_EMAIL_FONT = "Arial";
export const DEFAULT_QUOTE_EMAIL_FONT_SIZE_PX = 14;
export const DEFAULT_QUOTE_EMAIL_TEXT_COLOR = "#171717";
export const DEFAULT_QUOTE_EMAIL_SIGNATURE_COLOR = "#1F4E79";
const SIGNATURE_FONT_STACK = "'Bookman Old Style', Georgia, serif";
const SIGNATURE_MUTED_COLOR = "#44546A";

export type QuoteEmailSignature = {
  name: string;
  company: string | null;
  address: string | null;
  phoneLine: string | null;
  email: string | null;
  color: string;
};

export type QuoteEmailStyle = {
  fontStack: string;
  fontSizePx: number;
  textColor: string;
  signature: QuoteEmailSignature | null;
};

type QuoteEmailStyleSettings = {
  quoteEmailFontFamily: string | null;
  quoteEmailFontSizePx: number | null;
  quoteEmailTextColor: string | null;
  quoteEmailSignatureName: string | null;
  quoteEmailSignatureCompany: string | null;
  quoteEmailSignatureAddress: string | null;
  quoteEmailSignaturePhoneLine: string | null;
  quoteEmailSignatureEmail: string | null;
  quoteEmailSignatureColor: string | null;
};

export function buildQuoteEmailStyle(
  settings: QuoteEmailStyleSettings,
): QuoteEmailStyle {
  const fontStack =
    QUOTE_EMAIL_FONT_OPTIONS.find(
      (option) => option.value === settings.quoteEmailFontFamily,
    )?.stack ??
    QUOTE_EMAIL_FONT_OPTIONS.find(
      (option) => option.value === DEFAULT_QUOTE_EMAIL_FONT,
    )!.stack;

  const name = settings.quoteEmailSignatureName?.trim() ?? "";

  return {
    fontStack,
    fontSizePx:
      settings.quoteEmailFontSizePx ?? DEFAULT_QUOTE_EMAIL_FONT_SIZE_PX,
    textColor:
      settings.quoteEmailTextColor?.trim() || DEFAULT_QUOTE_EMAIL_TEXT_COLOR,
    signature: name
      ? {
          name,
          company: settings.quoteEmailSignatureCompany?.trim() || null,
          address: settings.quoteEmailSignatureAddress?.trim() || null,
          phoneLine: settings.quoteEmailSignaturePhoneLine?.trim() || null,
          email: settings.quoteEmailSignatureEmail?.trim() || null,
          color:
            settings.quoteEmailSignatureColor?.trim() ||
            DEFAULT_QUOTE_EMAIL_SIGNATURE_COLOR,
        }
      : null,
  };
}

export async function getQuoteEmailStyle(): Promise<QuoteEmailStyle> {
  return buildQuoteEmailStyle(await getAppSettings());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSignatureHtml(signature: QuoteEmailSignature): string {
  const color = escapeHtml(signature.color);
  const serifLines = [signature.company, signature.address]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split("\n"))
    .map((line) => escapeHtml(line.trim()))
    .filter(Boolean)
    .join("<br>");

  const pieces = [
    `<p style="margin: 0; font-family: ${SIGNATURE_FONT_STACK}; font-size: 20px; font-weight: bold; color: ${color};">${escapeHtml(signature.name)}</p>`,
  ];
  if (serifLines) {
    pieces.push(
      `<p style="margin: 2px 0 0; font-family: ${SIGNATURE_FONT_STACK}; font-size: 15px; color: ${color};">${serifLines}</p>`,
    );
  }
  if (signature.phoneLine) {
    pieces.push(
      `<p style="margin: 6px 0 0; font-size: 12.5px; color: ${SIGNATURE_MUTED_COLOR};">${escapeHtml(signature.phoneLine)}</p>`,
    );
  }
  if (signature.email) {
    const email = escapeHtml(signature.email);
    pieces.push(
      `<p style="margin: 2px 0 0; font-size: 12.5px; color: ${SIGNATURE_MUTED_COLOR};">Email – <a href="mailto:${email}">${email}</a></p>`,
    );
  }

  return `<div style="margin-top: 16px;">${pieces.join("\n")}</div>`;
}

/** Plain-text signature for the text/plain alternative part. */
export function buildSignatureText(
  signature: QuoteEmailSignature | null,
): string {
  if (!signature) {
    return "";
  }
  return [
    signature.name,
    ...(signature.company ? [signature.company] : []),
    ...(signature.address ? signature.address.split("\n") : []),
    ...(signature.phoneLine ? [signature.phoneLine] : []),
    ...(signature.email ? [`Email – ${signature.email}`] : []),
  ]
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

const DEFAULT_STYLE: QuoteEmailStyle = {
  fontStack: QUOTE_EMAIL_FONT_OPTIONS[0].stack,
  fontSizePx: DEFAULT_QUOTE_EMAIL_FONT_SIZE_PX,
  textColor: DEFAULT_QUOTE_EMAIL_TEXT_COLOR,
  signature: null,
};

export function buildQuoteEmailHtml(
  textBody: string,
  style: QuoteEmailStyle = DEFAULT_STYLE,
): string {
  const escaped = escapeHtml(textBody);
  const signatureHtml = style.signature
    ? `\n    ${buildSignatureHtml(style.signature)}`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <body style="font-family: ${style.fontStack}; font-size: ${style.fontSizePx}px; line-height: 1.5; color: ${escapeHtml(style.textColor)};">
    ${escaped.replace(/\n/g, "<br>")}${signatureHtml}
  </body>
</html>`;
}
