"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  KeepZoomButton,
  PdfZoomButtons,
  type PreviewZoomState,
} from "@/components/common/pdf-zoom-buttons";
import type { PdfZoom } from "@/lib/preview-zoom";

/**
 * The print preview pages (a quote, a drill sheet, a ticket, a ticket's
 * submittal package): one page of a saved PDF on a sheet of paper, in a
 * column as wide as letter paper. Zoomed in, the paper and its column grow
 * (the page scrolls down as it always did). Past the width of the window
 * the paper scrolls inside a box no taller than the window, so the bar that
 * scrolls it sideways is never a page length away.
 */

const LETTER_ASPECT_RATIO = 8.5 / 11;
/** The paper at "Fit": the 8.5in column less its side padding (2 x 1rem). */
const PAPER_FIT_WIDTH = "(8.5in - 2rem)";
/** Most pixels the page is drawn with, so a deep zoom stays quick to draw. */
const MAX_CANVAS_PIXELS = 16_000_000;

/**
 * For the column the paper sits in (`max-w-[8.5in] px-4`): lets it grow with
 * the zoom. Nothing at "Fit", so the column's own classes rule.
 */
export function paperColumnStyle(zoom: PdfZoom): CSSProperties | undefined {
  return zoom === 1
    ? undefined
    : { maxWidth: `calc(${PAPER_FIT_WIDTH} * ${zoom} + 2rem)` };
}

const zoomBarButtonClassName =
  "rounded border border-neutral-300 bg-white px-3 py-1 text-sm font-medium text-neutral-700 hover:bg-neutral-50";

/** The − / Fit / + and Keep zoom buttons in the row above the paper. */
export function PaperZoomBar({
  zoom,
  align = "center",
}: {
  zoom: PreviewZoomState;
  align?: "center" | "start";
}) {
  return (
    <div
      className={`mb-3 flex flex-wrap items-center gap-2 print:hidden ${
        align === "center" ? "justify-center" : ""
      }`}
    >
      <PdfZoomButtons
        zoomIndex={zoom.zoomIndex}
        onZoomIndex={zoom.setZoomIndex}
        buttonClassName={zoomBarButtonClassName}
      />
      <KeepZoomButton zoom={zoom} className={zoomBarButtonClassName} />
    </div>
  );
}

type PdfPageCanvasProps = {
  /** Address of the PDF. A new address loads a new document. */
  url: string;
  /** Page to show, from 1. */
  activeSheet: number;
  /** How far the paper is zoomed in; 1 is fitted to its column. */
  zoom?: PdfZoom;
  onSheetCountChange?: (count: number) => void;
  /**
   * Called with the answer the PDF came in, for what its headers say. Must
   * be a stable function: a new one loads the PDF again.
   */
  onResponse?: (response: Response) => void;
  /**
   * True for a PDF that mixes portrait and landscape pages: the paper takes
   * the shape of the page shown instead of letter portrait.
   */
  followPageShape?: boolean;
  /** Said when the server answers with an error and no text of its own. */
  loadErrorText?: string;
};

type LoadedPdf = { url: string; document: PDFDocumentProxy };

export function PdfPageCanvas({
  url,
  activeSheet,
  zoom = 1,
  onSheetCountChange,
  onResponse,
  followPageShape = false,
  loadErrorText = "Could not load the PDF.",
}: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<LoadedPdf | null>(null);
  const [failure, setFailure] = useState<{ url: string; message: string } | null>(
    null,
  );
  /** The address whose document has a page on the canvas. */
  const [drawnUrl, setDrawnUrl] = useState<string | null>(null);
  const [pageAspectRatio, setPageAspectRatio] = useState(LETTER_ASPECT_RATIO);
  const scrollBoxRef = useRef<HTMLDivElement>(null);
  /** True while the zoomed paper is wider than the room the window gives it. */
  const [widerThanRoom, setWiderThanRoom] = useState(false);

  useEffect(() => {
    const box = scrollBoxRef.current;
    const paper = containerRef.current;
    if (!box || !paper) {
      return;
    }
    // The paper's width comes from the zoom alone, so the box's scrollbar
    // (which narrows the box) can only keep this answer, never flip it.
    const measure = () =>
      setWiderThanRoom(zoom !== 1 && paper.offsetWidth > box.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [zoom]);

  // A document that belongs to an address since left is being thrown away.
  const pdf = loaded?.url === url ? loaded.document : null;
  const error = failure?.url === url ? failure.message : null;
  const ready = pdf != null && drawnUrl === url && !error;

  useEffect(() => {
    let cancelled = false;
    let loadingTask: { destroy(): Promise<void> } | null = null;

    async function load() {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const response = await fetch(url, { credentials: "same-origin" });
        if (!response.ok) {
          throw new Error((await response.text()) || loadErrorText);
        }
        if (cancelled) {
          return;
        }
        onResponse?.(response);

        const pdfBytes = await response.arrayBuffer();
        const task = pdfjs.getDocument({ data: pdfBytes });
        loadingTask = task;
        const document = await task.promise;
        if (cancelled) {
          return;
        }

        onSheetCountChange?.(document.numPages);
        setFailure(null);
        setLoaded({ url, document });
      } catch (loadError) {
        if (!cancelled) {
          onSheetCountChange?.(1);
          setFailure({
            url,
            message:
              loadError instanceof Error
                ? loadError.message
                : "Failed to render PDF preview.",
          });
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      // Frees the parsed document and its worker thread.
      void loadingTask?.destroy();
    };
  }, [url, onSheetCountChange, onResponse, loadErrorText]);

  // Draw the page again for another sheet or another zoom. The page on the
  // canvas stays (stretched by the new width) until the sharper one is drawn.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !pdf) {
      return;
    }

    let cancelled = false;
    let renderTask: { cancel(): void } | null = null;

    async function draw() {
      try {
        const sheetIndex = Math.min(Math.max(activeSheet, 1), pdf!.numPages);
        const page = await pdf!.getPage(sheetIndex);
        if (cancelled) {
          return;
        }

        const base = page.getViewport({ scale: 1 });
        if (followPageShape) {
          setPageAspectRatio(base.width / base.height);
        }
        const cssScale = (container!.clientWidth || base.width) / base.width;
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

        const context = canvas!.getContext("2d", { alpha: false });
        if (!context) {
          throw new Error("Could not initialize PDF canvas.");
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
          setFailure(null);
          setDrawnUrl(url);
        }
      } catch (renderError) {
        if (
          !cancelled &&
          !(
            renderError instanceof Error &&
            renderError.name === "RenderingCancelledException"
          )
        ) {
          setFailure({
            url,
            message:
              renderError instanceof Error
                ? renderError.message
                : "Failed to render PDF preview.",
          });
        }
      }
    }

    void draw();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, url, activeSheet, zoom, followPageShape]);

  return (
    // Zoomed past the width of the window, the paper scrolls in this box.
    <div
      ref={scrollBoxRef}
      className={
        widerThanRoom
          ? "max-h-[calc(100vh_-_1rem)] w-full overflow-auto print:max-h-none"
          : "w-full"
      }
      data-pdf-page-zoom={zoom}
      data-pdf-page-scroll={widerThanRoom ? "box" : "page"}
    >
      <div
        ref={containerRef}
        className="relative bg-white shadow-lg print:shadow-none"
        style={{
          aspectRatio: `${pageAspectRatio}`,
          width: zoom === 1 ? "100%" : `calc(${PAPER_FIT_WIDTH} * ${zoom})`,
        }}
      >
        <canvas
          ref={canvasRef}
          className={`block w-full bg-white ${ready ? "" : "hidden"}`}
          data-pdf-page-canvas={ready ? "ready" : "empty"}
        />
        {!ready && !error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white text-sm text-neutral-500">
            Rendering preview…
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white px-4 text-center text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
