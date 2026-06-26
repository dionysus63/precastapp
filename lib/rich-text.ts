const ALLOWED_TAGS = new Set(["b", "strong", "i", "em", "u", "br"]);

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
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

export function plainTextToRichText(value: string): string {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized.trim()) {
    return "";
  }

  return escapeHtml(normalized).replace(/\n/g, "<br>");
}

export function sanitizeRichText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (!isRichText(trimmed)) {
    return plainTextToRichText(trimmed);
  }

  let html = trimmed
    .replace(/<\/?(script|style|iframe|object|embed|link|meta)[^>]*>/gi, "")
    .replace(/\s(on\w+|style|class|id)=("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  html = html
    .replace(/<\/div>/gi, "<br>")
    .replace(/<div[^>]*>/gi, "")
    .replace(/<\/p>/gi, "<br>")
    .replace(/<p[^>]*>/gi, "");

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
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (!isRichText(trimmed)) {
    return trimmed.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  }

  const withBreaks = trimmed
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<div[^>]*>/gi, "")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p[^>]*>/gi, "");

  const withoutTags = withBreaks.replace(/<\/?[^>]+>/g, "");
  return decodeHtmlEntities(withoutTags)
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function richTextHasContent(value: string): boolean {
  return richTextToPlainText(value).trim().length > 0;
}
