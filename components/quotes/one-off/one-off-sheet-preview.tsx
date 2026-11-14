"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderOneOffSheetPreview } from "@/app/quotes/one-off-preview-actions";
import { PdfDragChip } from "@/components/common/pdf-drag-chip";
import { isActionError } from "@/lib/action-result";
import type {
  OneOffRow,
  OneOffRowResult,
  OneOffShape,
} from "@/lib/quotes/one-off-drill-sheets";
import { selectedClassName } from "@/lib/selected-styles";

/** Wait this long after the last keystroke before filling the PDF again. */
const PREVIEW_DEBOUNCE_MS = 600;
/** Tallest the page is drawn: the pane scrolls past this, so width usually rules. */
const MAX_PAGE_HEIGHT_VH = 1.6;
const MIN_PAGE_HEIGHT_PX = 320;

/**
 * Grid columns for "sheet preview | entry grid". The preview sits on the
 * left so the inputs start right next to it however few structures there are.
 *
 * Rectangular sheets are landscape: the preview takes 60% of the width.
 * Circular sheets are portrait: the preview takes half the width, but on a
 * wide (full-width) window it stops growing once the whole letter page fits
 * on screen, so the sheet never needs scrolling and the grid gets the rest.
 * 8.5 / 11 = 0.773; the app header plus 7.3125rem is everything above and
 * below the drawn page (the pane's own header and padding) and
 * 1.625rem the pane's side padding. The 40rem floor keeps the size the
 * preview always had on a 1280px-wide page.
 */
const SPLIT_CLASS_NAME: Record<OneOffShape, string> = {
  CIRCULAR:
    "lg:grid-cols-[min(50%,max(40rem,calc((100vh_-_var(--app-header-height)_-_7.3125rem)_*_0.773_+_1.625rem)))_minmax(0,1fr)]",
  RECTANGULAR: "lg:grid-cols-[60%_minmax(0,1fr)]",
};

/**
 * The preview column: follows the page while the grid scrolls, parked just
 * below the sticky app header (--app-header-height) instead of sliding under
 * it. It comes after the grid in the markup (so a narrow window stacks the
 * grid first) and `order-first` moves it to the left column on wide ones.
 */
export const oneOffPreviewPaneClassName =
  "min-w-0 lg:order-first lg:sticky lg:top-[calc(var(--app-header-height)_+_0.5rem)] lg:max-h-[calc(100vh_-_var(--app-header-height)_-_1.5rem)] lg:overflow-y-auto";

export function oneOffSplitClassName(shape: OneOffShape): string {
  return `grid items-start gap-5 ${SPLIT_CLASS_NAME[shape]}`;
}

type OneOffSheetPreviewProps = {
  shape: OneOffShape;
  /** The row being previewed (the one last clicked in the grid), if any. */
  row: OneOffRow | null;
  result: OneOffRowResult | null;
  openingCount: number;
  /** How many rows the grid has, for the empty-state wording. */
  rowCount: number;
  /** Printed in the sheet header. */
  contractor: string;
  project: string;
  /**
   * When the row is a drill sheet that is already saved, its id: the header
   * then carries a chip that drags that saved sheet's PDF out.
   */
  savedSheetId?: string | null;
};

function safeFilePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "-").trim() || "sheet";
}

type LoadedPreview = {
  rowId: string;
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
 * The drill sheet PDF as it will print, filled from the row last clicked in
 * the grid and refilled as the row is typed: the same template fill the saved
 * sheets use, run on rows that don't exist yet.
 */
export function OneOffSheetPreview({
  shape,
  row,
  result,
  openingCount,
  rowCount,
  contractor,
  project,
  savedSheetId = null,
}: OneOffSheetPreviewProps) {
  const label = shape === "CIRCULAR" ? "Drill sheet" : "Rect sheet";
  const sheetComputed =
    row != null &&
    (shape === "CIRCULAR" ? result?.circularSheet : result?.rectSheet) != null;

  // Everything the PDF depends on; a change (after a pause) refills it.
  const requestKey = useMemo(
    () =>
      row && sheetComputed
        ? JSON.stringify({ shape, row, openingCount, contractor, project })
        : null,
    [row, sheetComputed, shape, openingCount, contractor, project],
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<LoadedPreview | null>(null);
  /** Page choice, kept only while the same row is previewed. */
  const [pageChoice, setPageChoice] = useState<{ rowId: string; page: number } | null>(
    null,
  );
  /** The request key last answered (filled or failed), to tell pending apart. */
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(
    null,
  );
  const [renderError, setRenderError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const rowId = row?.id ?? null;
  const activePage = pageChoice?.rowId === rowId ? pageChoice.page : 1;
  const pending = requestKey != null && settledKey !== requestKey;
  const error = failure?.key === requestKey ? failure.message : null;

  // Fill the PDF on the server once typing pauses; drop responses that are
  // out of date by the time they arrive.
  useEffect(() => {
    if (!requestKey) {
      return;
    }
    const key = requestKey;
    const request = JSON.parse(key) as {
      shape: OneOffShape;
      row: OneOffRow;
      openingCount: number;
      contractor: string;
      project: string;
    };
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await renderOneOffSheetPreview(request);
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
        // for the Open PDF link.
        const document = await pdfjs.getDocument({ data: bytes.slice() }).promise;
        if (cancelled) {
          void document.loadingTask.destroy();
          return;
        }
        setFailure(null);
        setLoaded((current) => {
          void current?.document.loadingTask.destroy();
          return { rowId: request.row.id, document, bytes };
        });
      } catch (caught) {
        if (!cancelled) {
          setFailure({
            key,
            message:
              caught instanceof Error
                ? caught.message
                : "Could not render the sheet preview.",
          });
        }
      } finally {
        if (!cancelled) {
          setSettledKey(key);
        }
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [requestKey]);

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

  // The PDF for a row the user has since left is not this row's sheet.
  const showPdf = loaded != null && loaded.rowId === rowId;
  const pageCount = showPdf ? loaded.document.numPages : 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !showPdf || !loaded || containerWidth <= 0) {
      return;
    }
    let cancelled = false;
    let renderTask: { cancel(): void } | null = null;

    async function draw() {
      try {
        const pdfDoc = loaded!.document;
        const pageNumber = Math.min(Math.max(activePage, 1), pdfDoc.numPages);
        const page = await pdfDoc.getPage(pageNumber);
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
            caught instanceof Error ? caught.message : "Could not draw the sheet.",
          );
        }
      }
    }

    void draw();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [loaded, showPdf, activePage, containerWidth]);

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
  if (!row) {
    note =
      rowCount === 0
        ? "Build the rows to see the sheet here."
        : "Click a row in the grid to preview its sheet.";
  } else if (!sheetComputed) {
    note = result?.status
      ? `${result.status}.`
      : "Enter the rim and inverts to see the sheet.";
  } else if (error) {
    note = error;
  } else if (renderError && showPdf) {
    note = renderError;
  } else if (!showPdf) {
    note = "Filling the sheet…";
  }

  return (
    <div className="flex min-h-[12rem] flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label} PDF
          {row ? (
            <span className="ml-2 normal-case tracking-normal text-slate-900">
              {row.structureNumber.trim() || "(no number)"}
            </span>
          ) : null}
        </h4>
        <div className="flex items-center gap-2">
          {pageCount > 1 && showPdf ? (
            <div className="flex gap-1">
              {Array.from({ length: pageCount }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() =>
                    rowId ? setPageChoice({ rowId, page: index + 1 }) : undefined
                  }
                  className={`rounded border px-2 py-0.5 text-2xs font-semibold ${
                    activePage === index + 1
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
          {row && savedSheetId ? (
            <PdfDragChip
              href={`/api/drill-sheets/${savedSheetId}/preview?download=1`}
              fileName={`drill-sheet-${safeFilePart(row.structureNumber)}.pdf`}
              title="Drag onto an email, a folder, or your desktop to copy this saved drill sheet, or click to download it. Changes you haven't saved yet are not in the file."
              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-2xs font-semibold text-slate-700 hover:bg-slate-50"
            />
          ) : null}
          {row ? (
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
            pending || (row && !sheetComputed) ? "opacity-60" : ""
          }`}
          data-one-off-preview={showPdf ? "ready" : "empty"}
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
