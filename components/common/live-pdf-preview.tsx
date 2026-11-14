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
 * "Preview | inputs" for a portrait letter page, side by side from a 1800px
 * wide window up. The preview column grows with the window but stops once the
 * whole page fits on screen (8.5 / 11 = 0.773; the app header plus 7.3125rem
 * is everything above and below the drawn page, 1.625rem the pane's side
 * padding), never takes more
 * than 40%, and always leaves the inputs 64rem (the 1.25rem is the gap).
 *
 * On a narrower window there is no room for both: the inputs keep the
 * standard column they were laid out for and the preview stacks
 * underneath.
 */
export const portraitPreviewSplitClassName =
  "grid items-start gap-5 max-[1799px]:max-w-7xl min-[1800px]:grid-cols-[min(40%,calc((100vh_-_var(--app-header-height)_-_7.3125rem)_*_0.773_+_1.625rem),calc(100%_-_65.25rem))_minmax(0,1fr)]";

/**
 * The preview column itself: it comes after the inputs in the markup (so a
 * narrow window shows the inputs first), `order-first` moves it to the left
 * on a wide one, and it follows the page parked just below the sticky app
 * header (--app-header-height) while the inputs scroll.
 */
export const portraitPreviewPaneClassName =
  "min-w-0 max-[1799px]:w-full max-[1799px]:max-w-3xl min-[1800px]:order-first min-[1800px]:sticky min-[1800px]:top-[calc(var(--app-header-height)_-_1px)] min-[1800px]:max-h-[calc(100vh_-_var(--app-header-height)_-_0.875rem)] min-[1800px]:overflow-y-auto";

export type LivePdfPreviewResult = { pdfBase64: string };

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
  debounceMs = DEFAULT_DEBOUNCE_MS,
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
        const bytes = decodeBase64(response.pdfBase64);
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
        const cssScale = Math.min(
          containerWidth / base.width,
          maxHeight / base.height,
        );
        const pixelRatio = window.devicePixelRatio || 1;
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
  }, [loaded, showPdf, shownPage, containerWidth]);

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
            <button
              type="button"
              onClick={openPdf}
              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-2xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Open PDF
            </button>
          ) : null}
          {actions}
          {requestKey != null ? (
            <span className="text-2xs text-slate-500">
              {pending ? "Updating…" : "Updates as you type."}
            </span>
          ) : null}
        </div>
      </div>
      <div ref={containerRef} className="relative flex min-w-0 flex-1 justify-center">
        <canvas
          ref={canvasRef}
          className={`block bg-white shadow-md ${showPdf ? "" : "hidden"} ${
            pending ? "opacity-60" : ""
          }`}
          data-live-pdf-preview={showPdf ? (pending ? "updating" : "ready") : "empty"}
        />
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
