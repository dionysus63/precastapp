import {
  layoutMultilineText,
  type PDFFont,
  type PDFTextField,
} from "pdf-lib";

/**
 * Characters outside Windows-1252 that show up in real data — engineering
 * marks from Excel/Word, fractions, arrows — mapped to their plain-text
 * spelling. pdf-lib's standard fonts (Helvetica) can only encode WinAnsi:
 * anything else throws "WinAnsi cannot encode", which failed the whole
 * quote/invoice/ticket PDF (or left a drill-sheet field blank).
 */
const WINANSI_REPLACEMENTS: Record<string, string> = {
  "′": "'", // prime (feet)
  "″": '"', // double prime (inches)
  "‴": "'''",
  "‵": "'",
  "‶": '"',
  "−": "-", // minus sign
  "‐": "-",
  "‑": "-",
  "‒": "-",
  "―": "-",
  "⁃": "-",
  "⁄": "/", // fraction slash (NFKD of ⅝ is 5⁄8)
  "∕": "/",
  "≤": "<=",
  "≥": ">=",
  "≠": "!=",
  "≈": "~",
  "←": "<-",
  "→": "->",
  "↑": "^",
  "↓": "v",
  "↔": "<->",
  "⇒": "=>",
  // Check vs cross must stay distinguishable.
  "✓": "(ok)",
  "✔": "(ok)",
  "✅": "(ok)",
  "✗": "(x)",
  "✘": "(x)",
  "❌": "(x)",
  "•": "•", // bullet is in WinAnsi; listed so it never falls to "?"
  "∙": "•",
  "●": "•",
  "◦": "-",
  "⅓": "1/3",
  "⅔": "2/3",
  "⅕": "1/5",
  "⅙": "1/6",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
  "⁰": "0",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "₀": "0",
  "₁": "1",
  "₂": "2",
  "₃": "3",
  "∅": "0",
  "⌀": "dia.",
  "Φ": "dia.",
  "№": "No.",
  "™": "™",
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " ",
  "　": " ",
};

/** Windows-1252 code points above Latin-1's printable range (0x80–0x9F). */
const CP1252_HIGH = new Set(
  "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ",
);

function isWinAnsi(char: string): boolean {
  const code = char.codePointAt(0)!;
  return (
    code === 0x09 ||
    code === 0x0a ||
    code === 0x0d ||
    (code >= 0x20 && code <= 0x7e) ||
    (code >= 0xa0 && code <= 0xff) ||
    CP1252_HIGH.has(char)
  );
}

/**
 * Text that pdf-lib's standard (WinAnsi) fonts can always encode. Common
 * characters are spelled out (″ → ", − → -, ⅝ → 5/8, ≤ → <=); accented
 * letters outside Latin-1 lose the accent; invisible formatting characters
 * are dropped; anything else (emoji, CJK) becomes "?" so the PDF still
 * builds and the gap is visible.
 */
export function toWinAnsiText(value: string): string {
  let out = "";
  for (const char of value.normalize("NFC")) {
    if (isWinAnsi(char) && WINANSI_REPLACEMENTS[char] === undefined) {
      out += char;
      continue;
    }
    const mapped = WINANSI_REPLACEMENTS[char];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    // Zero-width spaces/joiners, variation selectors, combining marks.
    if (/[\p{Cf}\p{Mn}\p{Me}]/u.test(char)) {
      continue;
    }
    const decomposed = [...char.normalize("NFKD")]
      .filter((part) => !/\p{Mn}/u.test(part))
      .map((part) =>
        isWinAnsi(part) ? part : (WINANSI_REPLACEMENTS[part] ?? null),
      );
    if (decomposed.length > 0 && decomposed.every((part) => part !== null)) {
      out += decomposed.join("");
      continue;
    }
    out += "?";
  }
  return out;
}

const TF_SIZE = /\/[^\s/]+\s+(\d+(?:\.\d+)?)\s+Tf/g;

function lastFontSize(da: string | undefined): number | undefined {
  if (!da) {
    return undefined;
  }
  let size: number | undefined;
  for (const match of da.matchAll(TF_SIZE)) {
    size = Number(match[1]);
  }
  return size;
}

function replaceLastFontSize(da: string, size: number): string {
  const matches = [...da.matchAll(TF_SIZE)];
  const last = matches[matches.length - 1];
  if (!last || last.index === undefined) {
    return da;
  }
  const replaced = last[0].replace(/(\d+(?:\.\d+)?)(\s+Tf)$/, `${size}$2`);
  return da.slice(0, last.index) + replaced + da.slice(last.index + last[0].length);
}

/**
 * Shrink a filled field's font until its text fits the widget — a single
 * line by width, a multi-line field by wrapped height (pdf-lib's own
 * layout, so the measurement matches what it draws). Without this, filled
 * values were silently clipped at the widget edge. Auto-size ("0 Tf")
 * fields already fit and are left alone.
 *
 * The size is written where pdf-lib reads it: a widget's own /DA wins over
 * the field's, so widget-level sizes are rewritten in place.
 */
export function fitPdfFieldFontSize(
  field: PDFTextField,
  font: PDFFont,
  minFontSize = 5,
): void {
  const widget = field.acroField.getWidgets()[0];
  const text = field.getText() ?? "";
  if (!widget || !text) {
    return;
  }

  const widgetSize = lastFontSize(widget.getDefaultAppearance());
  const fieldSize = lastFontSize(field.acroField.getDefaultAppearance());
  const authoredSize = widgetSize ?? fieldSize;
  if (!authoredSize) {
    return;
  }

  const rect = widget.getRectangle();
  const borderWidth = widget.getBorderStyle()?.getWidth() ?? 0;
  const inset = borderWidth + 1;
  const bounds = {
    x: inset,
    y: inset,
    width: rect.width - inset * 2,
    height: rect.height - inset * 2,
  };
  if (bounds.width <= 0 || bounds.height <= 0) {
    return;
  }

  const multiline = field.isMultiline();
  const fits = (size: number) => {
    if (!multiline) {
      return font.widthOfTextAtSize(text, size) <= bounds.width;
    }
    const layout = layoutMultilineText(text, {
      alignment: field.getAlignment(),
      fontSize: size,
      font,
      bounds,
    });
    return (
      layout.lines.length * layout.lineHeight <= bounds.height &&
      layout.lines.every((line) => line.width <= bounds.width)
    );
  };

  let size = authoredSize;
  while (size > minFontSize && !fits(size)) {
    size = Math.max(minFontSize, size - 0.5);
  }
  if (size === authoredSize) {
    return;
  }

  let wroteWidget = false;
  for (const entry of field.acroField.getWidgets()) {
    const da = entry.getDefaultAppearance();
    if (lastFontSize(da) !== undefined) {
      entry.setDefaultAppearance(replaceLastFontSize(da!, size));
      wroteWidget = true;
    }
  }
  if (!wroteWidget || fieldSize !== undefined) {
    try {
      field.setFontSize(size);
    } catch {
      // No field-level /DA to carry a size; the widget one was updated.
    }
  }
}

/**
 * Fill a template text field safely: WinAnsi-encodable text, no authoring
 * maxLength crash (the form is flattened, so the cap only ever threw), and
 * — when a measuring font is given — shrink-to-fit instead of clipping.
 */
export function setPdfFieldText(
  field: PDFTextField,
  value: string,
  options: { font?: PDFFont; fit?: boolean; minFontSize?: number } = {},
): void {
  const text = toWinAnsiText(value);
  const maxLength = field.getMaxLength();
  if (maxLength !== undefined && text.length > maxLength) {
    field.setMaxLength(undefined);
  }
  field.setText(text);
  if (options.font && options.fit !== false) {
    fitPdfFieldFontSize(field, options.font, options.minFontSize);
  }
}
