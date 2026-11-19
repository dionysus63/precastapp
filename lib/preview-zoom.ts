/**
 * Zoom of the PDF previews: the steps the − / + buttons walk through, and
 * the zoom a user chose to keep for one screen ("Keep zoom" beside those
 * buttons, stored per account in `UserPreviewZoom`).
 *
 * Safe to import from both server and client modules.
 */

/**
 * Zoom steps, as multiples of the size at which the page fits the pane. The
 * first one is "fit"; past it the page scrolls inside the pane.
 */
export const PDF_ZOOM_STEPS = [1, 1.25, 1.5, 2, 2.5, 3] as const;

export type PdfZoom = (typeof PDF_ZOOM_STEPS)[number];

export function isPdfZoom(value: unknown): value is PdfZoom {
  return (
    typeof value === "number" &&
    (PDF_ZOOM_STEPS as readonly number[]).includes(value)
  );
}

/** Position of a zoom in `PDF_ZOOM_STEPS`; anything unknown is "fit". */
export function pdfZoomIndex(zoom: unknown): number {
  return Math.max(0, (PDF_ZOOM_STEPS as readonly unknown[]).indexOf(zoom));
}

/** What the middle zoom button says: "Fit", "150%". */
export function pdfZoomLabel(zoom: number): string {
  return zoom === 1 ? "Fit" : `${Math.round(zoom * 100)}%`;
}

/**
 * The screens whose previews can keep a zoom, by the key their rows are
 * stored under, with the name the confirm popup calls each one.
 */
export const PREVIEW_ZOOM_SCREENS = {
  "invoice-list": "Invoices",
} as const;

export type PreviewZoomScreen = keyof typeof PREVIEW_ZOOM_SCREENS;

export function isPreviewZoomScreen(value: unknown): value is PreviewZoomScreen {
  return typeof value === "string" && Object.hasOwn(PREVIEW_ZOOM_SCREENS, value);
}

/** A zoom as it is stored: percent of the fitted size (100, 125 ... 300). */
export function pdfZoomToPercent(zoom: PdfZoom): number {
  return Math.round(zoom * 100);
}

/** A stored percent back to a zoom step; anything unknown is "fit". */
export function pdfZoomFromPercent(percent: unknown): PdfZoom {
  const zoom = typeof percent === "number" ? percent / 100 : 1;
  return isPdfZoom(zoom) ? zoom : 1;
}

/** The `?zoom=` of a page picture's address; missing or unknown is "fit". */
export function parsePdfZoomParam(value: string | null): PdfZoom {
  const zoom = Number(value);
  return isPdfZoom(zoom) ? zoom : 1;
}

/** Sharpest a page picture is drawn, however far the preview is zoomed. */
const MAX_PICTURE_DPI = 300;

/**
 * Resolution a page picture needs so it stays as sharp zoomed as it is
 * fitted: `fitDpi` grown by the zoom, up to print quality.
 */
export function pictureDpiForZoom(fitDpi: number, zoom: PdfZoom): number {
  return Math.min(Math.round(fitDpi * zoom), Math.max(fitDpi, MAX_PICTURE_DPI));
}
