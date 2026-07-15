const ALLOWED_TAGS = new Set(["b", "strong", "i", "em", "u", "br"]);

function decodeHtmlEntities(value: string): string {
  const decodeCodePoint = (match: string, encoded: string, radix: number) => {
    const codePoint = Number.parseInt(encoded, radix);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : match;
  };

  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&(apos|#39);/gi, "'")
    .replace(/&#(\d+);/g, (match, decimal: string) =>
      decodeCodePoint(match, decimal, 10),
    )
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) =>
      decodeCodePoint(match, hex, 16),
    );
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isRichText(value: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(value);
}

/** True when the string already carries HTML entities (i.e. came from innerHTML). */
function containsHtmlEntity(value: string): boolean {
  return /&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/i.test(value);
}

/**
 * Collapse non-breaking spaces to regular spaces, including the doubly
 * escaped `&amp;nbsp;` forms older sanitizer versions produced.
 */
function normalizeNbsp(value: string): string {
  return value
    .replace(/&(amp;)*nbsp;/gi, " ")
    .replace(/\u00a0/g, " ");
}

export function plainTextToRichText(value: string): string {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized.trim()) {
    return "";
  }

  return escapeHtml(normalized).replace(/\n/g, "<br>");
}

export function sanitizeRichText(value: string): string {
  const trimmed = normalizeNbsp(value).trim();
  if (!trimmed) {
    return "";
  }

  // Only genuinely plain text gets escaped. Strings carrying entities came
  // from innerHTML and are already HTML-encoded — escaping again would turn
  // them into visible text like "&amp;nbsp;".
  if (!isRichText(trimmed) && !containsHtmlEntity(trimmed)) {
    return plainTextToRichText(trimmed);
  }

  let html = trimmed
    .replace(/<\/?(script|style|iframe|object|embed|link|meta)[^>]*>/gi, "")
    .replace(/\s(on\w+|style|class|id)=("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // contentEditable wraps each line after the first in <div>…</div>, so the
  // break belongs before the opening tag; closing tags carry no break.
  html = html
    .replace(/<div[^>]*>/gi, "<br>")
    .replace(/<\/div>/gi, "")
    .replace(/<p[^>]*>/gi, "<br>")
    .replace(/<\/p>/gi, "");

  html = html.replace(/<\/?([a-z0-9]+)[^>]*>/gi, (match, tagName: string) => {
    const tag = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      return "";
    }

    if (tag === "br") {
      return "<br>";
    }

    const closing = match.startsWith("</");
    return closing ? `</${tag}>` : `<${tag}>`;
  });

  return html
    .replace(/(<br\s*\/?>\s*){3,}/gi, "<br><br>")
    .replace(/^(<br\s*\/?>\s*)+/gi, "")
    .replace(/(<br\s*\/?>\s*)+$/gi, "")
    .trim();
}

export function richTextToPlainText(value: string): string {
  const trimmed = normalizeNbsp(value).trim();
  if (!trimmed) {
    return "";
  }

  if (!isRichText(trimmed)) {
    return decodeHtmlEntities(trimmed)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
  }

  const withBreaks = trimmed
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<div[^>]*>/gi, "\n")
    .replace(/<\/div>/gi, "")
    .replace(/<p[^>]*>/gi, "\n")
    .replace(/<\/p>/gi, "");

  const withoutTags = withBreaks.replace(/<\/?[^>]+>/g, "");
  return decodeHtmlEntities(withoutTags)
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function richTextHasContent(value: string): boolean {
  return richTextToPlainText(value).trim().length > 0;
}
