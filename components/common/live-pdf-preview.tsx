"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { isActionError, type ActionError } from "@/lib/action-result";
import { selectedClassName } from "@/lib/selected-styles";

/** Wait this long after the last change before filling the PDF again. */
const DEFAULT_DEBOUNCE_MS = 600;
/** Tallest the page is drawn: the pane scrolls past this, so width usually rules. */
const MAX_PAGE_HEIGHT_VH = 1.6;
const MIN_PAGE_HEIGHT_PX = 320;
/**
 * Zoom steps, as multiples of the size at which the page fits the pane. The
 * first one is "fit"; past it the page scrolls inside the pane.
 */
export const PDF_ZOOM_STEPS = [1, 1.25, 1.5, 2, 2.5, 3] as const;
/** Most pixels the page is drawn with, so a deep zoom stays quick to draw. */
const MAX_CANVAS_PIXELS = 16_000_000;

/**
 * Narrowest window (px) that shows the preview beside the inputs. It is the
 * number in every `min-[1600px]:` and `max-[1600px]:` class below (Tailwind
 * needs them written out; `max-[1600px]:` means narrower than 1600px, so the
 * two never both apply), and what `isPreviewBesideInputs` asks the window.
 *
 * Why 1600: the office monitors are 3840px wide and each PC picks its own
 * Windows scale and app zoom. 150% gives the app a 2560px window, 200% gives
 * 1920px, and 200% with one or two clicks of Zoom In gives 1753px or 1600px.
 * All of those must keep the preview on screen.
 */
export const PREVIEW_BESIDE_INPUTS_MIN_WIDTH = 1600;

/**
 * "Preview | inputs" for a portrait letter page, side by side from a 1600px
 * wide window up. The preview column grows with the window but stops once the
 * whole page fits on screen (8.5 / 11 = 0.773; the app header plus 7.3125rem
 * is everything above and below the drawn page, 1.625rem the pane's side
 * padding), never takes more than 40%, and leaves the inputs 57rem (more
 * with a larger Text Size, hence --text-scale; the 1.25rem is the gap) for
 * as long as that keeps the preview at least 24rem wide. At 1600px the
 * preview keeps its 24rem and the inputs get about 56rem, the narrowest the
 * ticket editor's lines table reads well at.
 *
 * The room both share (--preview-room) is worked out from the window, not
 * from the row itself: the window less the sidebar (15rem) and the page's
 * side padding (2 x 1.25rem). A share of the row ("40%") would change by a
 * scrollbar's width whenever the page starts or stops scrolling, the preview
 * would be redrawn a few pixels shorter or taller, and at the window heights
 * where that alone decides whether the page scrolls, the two chase each
 * other: the scrollbar and the preview flicker without end. Only the inputs
 * give way to the scrollbar now.
 *
 * Below 1600px there is no room for both: the inputs keep the standard
 * column they were laid out for, and the preview is either stacked underneath
 * (`portraitPreviewPaneClassName`) or opened over the right side of the
 * window on request (`portraitPreviewDrawerPaneClassName`).
 */
export const portraitPreviewSplitClassName =
  "grid items-start gap-5 max-[1600px]:max-w-7xl min-[1600px]:[--preview-room:calc(100vw_-_17.5rem)] min-[1600px]:grid-cols-[min(calc(var(--preview-room)_*_0.4),calc((100vh_-_var(--app-header-height)_-_7.3125rem)_*_0.773_+_1.625rem),max(24rem,calc(var(--preview-room)_-_57rem_*_var(--text-scale)_-_1.25rem)))_minmax(0,1fr)]";

/**
 * The preview column beside the inputs: it comes after the inputs in the
 * markup, `order-first` moves it to the left, and it follows the page parked
 * just below the sticky app header (--app-header-height) while the inputs
 * scroll.
 */
const previewBesideInputsClassName =
  "min-w-0 min-[1600px]:order-first min-[1600px]:sticky min-[1600px]:top-[calc(var(--app-header-height)_-_1px)] min-[1600px]:max-h-[calc(100vh_-_var(--app-header-height)_-_0.875rem)] min-[1600px]:overflow-y-auto";

/**
 * The preview column that stacks under the inputs on a narrow window. Out of
 * sight there until the page is scrolled to its end, so a screen people work
 * on with a narrow window should use the drawer below instead.
 */
export const portraitPreviewPaneClassName = `${previewBesideInputsClassName} max-[1600px]:w-full max-[1600px]:max-w-3xl`;

/**
 * The preview column that, on a narrow window, stays out of the page until
 * asked for and then opens over the right side of the window, below the app
 * header, as wide as a readable page (the 17rem keeps the sidebar and a
 * strip of the inputs in view). The screen needs a button that opens it:
 * give that button `previewDrawerOnlyClassName`.
 */
export function portraitPreviewDrawerPaneClassName(open: boolean): string {
  return `${previewBesideInputsClassName} ${
    open
      ? "max-[1600px]:fixed max-[1600px]:right-0 max-[1600px]:bottom-0 max-[1600px]:top-[var(--app-header-height)] max-[1600px]:z-30 max-[1600px]:w-[min(46rem,calc(100vw_-_17rem))] max-[1600px]:overflow-y-auto max-[1600px]:border-l max-[1600px]:border-slate-300 max-[1600px]:bg-page max-[1600px]:p-3 max-[1600px]:shadow-2xl"
      : "max-[1600px]:hidden"
  }`;
}

/** For controls that only make sense while the preview is a drawer. */
export const previewDrawerOnlyClassName = "min-[1600px]:hidden";
/** For controls that only make sense while the preview sits beside the inputs. */
export const previewBesideOnlyClassName = "max-[1600px]:hidden";

/** Whether the window is wide enough to show the preview beside the inputs. */
export function isPreviewBesideInputs(): boolean {
  return window.matchMedia(
    `(min-width: ${PREVIEW_BESIDE_INPUTS_MIN_WIDTH}px)`,
  ).matches;
}

/** The PDF to show: base64 from a server action, or the bytes themselves. */
export type LivePdfPreviewResult = { pdfBase64: string } | { pdfBytes: Uint8Array };

type LivePdfPreviewProps = {
  /** Heading of the pane, e.g. "Ticket PDF". */
  title: string;
  /** What is being previewed (a ticket number...), shown beside the title. */
  subject?: string | null;
  /**
   * Everything the PDF depends on, as one string: a change (after a pause)
   * fills the PDF again. Null when there is nothing to preview yet.
   */
  requestKey: string | null;
  /**
   * Fills the PDF for a request key. Must be a stable function (module level
   * or memoized): it is called from an effect keyed on `requestKey` only.
   */
  load: (requestKey: string) => Promise<LivePdfPreviewResult | ActionError>;
  /** Shown instead of the page while `requestKey` is null. */
  emptyNote: string;
  /** Shown while the first fill is on its way. */
  loadingNote?: string;
  /**
   * False for a PDF that is only shown, not filled from inputs (a vendor's
   * quote): it loads at once and the "Updates as you type." note is left out.
   */
  live?: boolean;
  /** How long the inputs must pause before the PDF is filled again. */
  debounceMs?: number;
  /** Extra controls for the pane header (right side). */
  actions?: ReactNode;
};

type LoadedPreview = {
  document: PDFDocumentProxy;
  bytes: Uint8Array;
};

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/**
 * A document PDF as it will print, filled on the server from what is on
 * screen and filled again as the inputs change. The page keeps showing the
 * last good fill (dimmed) while a newer one is on its way.
 */
export function LivePdfPreview({
  title,
  subject = null,
  requestKey,
  load,
  emptyNote,
  loadingNote = "Filling the PDF…",
  live = true,
  debounceMs = live ? DEFAULT_DEBOUNCE_MS : 0,
  actions = null,
}: LivePdfPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<LoadedPreview | null>(null);
  const [activePage, setActivePage] = useState(1);
  /** The request key last answered (filled or failed), to tell pending apart. */
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(
    null,
  );
  const [renderError, setRenderError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  /** Index into PDF_ZOOM_STEPS; 0 is the page fitted to the pane. */
  const [zoomIndex, setZoomIndex] = useState(0);
  const zoom = PDF_ZOOM_STEPS[zoomIndex] ?? 1;

  const pending = requestKey != null && settledKey !== requestKey;
  const error = failure?.key === requestKey ? failure.message : null;

  // Fill the PDF on the server once the inputs pause; drop responses that
  // are out of date by the time they arrive.
  useEffect(() => {
    if (!requestKey) {
      return;
    }
    const key = requestKey;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await load(key);
        if (cancelled) {
          return;
        }
        if (isActionError(response)) {
          setFailure({ key, message: response.error });
          return;
        }
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const bytes =
          "pdfBytes" in response
            ? response.pdfBytes
            : decodeBase64(response.pdfBase64);
        // pdf.js takes ownership of the buffer it parses; keep our own copy
        // for the Open PDF button.
        const document = await pdfjs.getDocument({ data: bytes.slice() }).promise;
        if (cancelled) {
          void document.loadingTask.destroy();
          return;
        }
        setFailure(null);
        setLoaded((current) => {
          void current?.document.loadingTask.destroy();
          return { document, bytes };
        });
      } catch (caught) {
        if (!cancelled) {
          setFailure({
            key,
            message:
              caught instanceof Error
                ? caught.message
                : "Could not render the preview.",
          });
        }
      } finally {
        if (!cancelled) {
          setSettledKey(key);
        }
      }
    }, debounceMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [requestKey, load, debounceMs]);

  useEffect(() => {
    return () => {
      void loaded?.document.loadingTask.destroy();
    };
    // Only on unmount; swaps destroy the previous document themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setContainerWidth((current) => (Math.abs(current - width) < 1 ? current : width));
    });
    observer.observe(container);
    setContainerWidth(container.clientWidth);
    return () => observer.disconnect();
  }, []);

  const showPdf = loaded != null && requestKey != null;
  const pageCount = showPdf ? loaded.document.numPages : 1;
  // A shorter refill (lines removed) can drop the page being looked at.
  const shownPage = Math.min(Math.max(activePage, 1), pageCount);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !showPdf || !loaded || containerWidth <= 0) {
      return;
    }
    let cancelled = false;
    let renderTask: { cancel(): void } | null = null;

    async function draw() {
      try {
        const page = await loaded!.document.getPage(shownPage);
        if (cancelled) {
          return;
        }
        const base = page.getViewport({ scale: 1 });
        const maxHeight = Math.max(
          MIN_PAGE_HEIGHT_PX,
          window.innerHeight * MAX_PAGE_HEIGHT_VH,
        );
        const cssScale =
          Math.min(containerWidth / base.width, maxHeight / base.height) * zoom;
        // Sharp at the screen's own pixels, up to the pixel budget.
        const pixelRatio = Math.min(
          window.devicePixelRatio || 1,
          Math.sqrt(
            MAX_CANVAS_PIXELS / (base.width * cssScale * base.height * cssScale),
          ),
        );
        const viewport = page.getViewport({ scale: cssScale * pixelRatio });
        canvas!.width = Math.floor(viewport.width);
        canvas!.height = Math.floor(viewport.height);
        canvas!.style.width = `${Math.floor(base.width * cssScale)}px`;
        canvas!.style.height = `${Math.floor(base.height * cssScale)}px`;

        const context = canvas!.getContext("2d", { alpha: false });
        if (!context) {
          throw new Error("Could not initialize the preview canvas.");
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas!.width, canvas!.height);
        const render = page.render({
          canvasContext: context,
          viewport,
          canvas: canvas!,
          background: "#ffffff",
        });
        renderTask = render;
        await render.promise;
        if (!cancelled) {
          setRenderError(null);
        }
      } catch (caught) {
        if (
          !cancelled &&
          !(caught instanceof Error && caught.name === "RenderingCancelledException")
        ) {
          setRenderError(
            caught instanceof Error ? caught.message : "Could not draw the page.",
          );
        }
      }
    }

    void draw();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [loaded, showPdf, shownPage, containerWidth, zoom]);

  function openPdf() {
    if (!loaded) {
      return;
    }
    const blob = new Blob([loaded.bytes as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  let note: string | null = null;
  if (requestKey == null) {
    note = emptyNote;
  } else if (error) {
    note = error;
  } else if (renderError && showPdf) {
    note = renderError;
  } else if (!showPdf) {
    note = loadingNote;
  }

  return (
    <div className="flex min-h-[12rem] flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
          {subject ? (
            <span className="ml-2 normal-case tracking-normal text-slate-900">
              {subject}
            </span>
          ) : null}
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          {pageCount > 1 && showPdf ? (
            <div className="flex gap-1">
              {Array.from({ length: pageCount }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setActivePage(index + 1)}
                  className={`rounded border px-2 py-0.5 text-2xs font-semibold ${
                    shownPage === index + 1
                      ? selectedClassName
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Page {index + 1}
                </button>
              ))}
            </div>
          ) : null}
          {showPdf ? (
            <div className="flex items-center gap-1" data-live-pdf-zoom={zoom}>
              <button
                type="button"
                onClick={() => setZoomIndex((index) => Math.max(index - 1, 0))}
                disabled={zoomIndex === 0}
                title="Zoom out"
                aria-label="Zoom out"
                className="rounded btn-plain px-2 py-0.5 text-2xs font-semibold disabled:opacity-40"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => setZoomIndex(0)}
                disabled={zoomIndex === 0}
                title="Fit the page to the pane"
                className="min-w-[3.25rem] rounded btn-plain px-2 py-0.5 text-2xs font-semibold tabular-nums"
              >
                {zoomIndex === 0 ? "Fit" : `${Math.round(zoom * 100)}%`}
              </button>
              <button
                type="button"
                onClick={() =>
                  setZoomIndex((index) =>
                    Math.min(index + 1, PDF_ZOOM_STEPS.length - 1),
                  )
                }
                disabled={zoomIndex === PDF_ZOOM_STEPS.length - 1}
                title="Zoom in"
                aria-label="Zoom in"
                className="rounded btn-plain px-2 py-0.5 text-2xs font-semibold disabled:opacity-40"
              >
                +
              </button>
            </div>
          ) : null}
          {showPdf ? (
            <button
              type="button"
              onClick={openPdf}
              className="rounded btn-plain px-2 py-0.5 text-2xs font-semibold"
            >
              Open PDF
            </button>
          ) : null}
          {actions}
          {requestKey != null && (live || pending) ? (
            <span className="text-2xs text-slate-500">
              {pending ? (live ? "Updating…" : "Loading…") : "Updates as you type."}
            </span>
          ) : null}
        </div>
      </div>
      {/* The outer box is what the page is fitted to. It never scrolls, so a
          scrollbar of the zoomed page cannot change the width being measured
          (that feedback makes a pane flicker). */}
      <div ref={containerRef} className="relative min-w-0 flex-1">
        <div
          className={
            zoomIndex === 0
              ? "flex justify-center"
              : "max-h-[calc(100vh_-_var(--app-header-height)_-_11rem)] overflow-auto"
          }
          data-live-pdf-scroll
        >
          <canvas
            ref={canvasRef}
            className={`block max-w-none bg-white shadow-md ${showPdf ? "" : "hidden"} ${
              pending ? "opacity-60" : ""
            }`}
            data-live-pdf-preview={showPdf ? (pending ? "updating" : "ready") : "empty"}
          />
        </div>
        {note ? (
          <p
            className={`text-xs ${
              error || renderError ? "text-red-700" : "text-slate-500"
            } ${showPdf ? "absolute inset-x-0 top-2 mx-auto w-fit rounded bg-white/90 px-2 py-1 shadow" : ""}`}
          >
            {note}
          </p>
        ) : null}
      </div>
    </div>
  );
}
