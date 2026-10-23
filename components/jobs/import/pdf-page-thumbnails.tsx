"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

/** Drag payload for pages pulled out of a combined PDF. */
export const IMPORT_PAGES_MIME = "application/x-precast-import-pages";

export type DraggedPages = { fileKey: string; pages: number[] };

/** Parse a dropped PDF in the browser; call `destroy` when done with it. */
export async function loadPdfFromFile(
  file: File,
): Promise<{ pdf: PDFDocumentProxy; destroy: () => void }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  return { pdf, destroy: () => void task.destroy() };
}

function PageThumbnail({
  pdf,
  pageNumber,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    let task: { cancel(): void; promise: Promise<void> } | null = null;
    void (async () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) {
          return;
        }
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 180 / base.width });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
          return;
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        task = page.render({ canvasContext: context, viewport, canvas });
        await task.promise;
      } catch {
        // A thumbnail that fails to render stays blank; the page is still usable.
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber]);

  return <canvas ref={canvasRef} className="block h-auto w-full bg-white" />;
}

/**
 * A combined PDF's pages as small cards. Click to select (Shift-click for a
 * run), then drag onto a structure row; each card says which structure has
 * it. Double-click opens the page large.
 */
export function PdfPageThumbnails({
  file,
  fileKey,
  assignedTo,
}: {
  file: File;
  fileKey: string;
  /** Page number → structure number holding it. */
  assignedTo: Map<number, string>;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [zoomPage, setZoomPage] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Each file mounts its own instance (keyed by file), so state starts empty.
    let release: (() => void) | null = null;
    loadPdfFromFile(file)
      .then((loaded) => {
        release = loaded.destroy;
        if (cancelled) {
          loaded.destroy();
          return;
        }
        setPdf(loaded.pdf);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Couldn't read this PDF.");
        }
      });
    return () => {
      cancelled = true;
      release?.();
    };
  }, [file]);

  if (error) {
    return <p className="text-xs text-red-600">{error}</p>;
  }
  if (!pdf) {
    return <p className="text-xs text-slate-500">Reading pages…</p>;
  }

  const pages = Array.from({ length: pdf.numPages }, (_, index) => index + 1);

  function toggle(page: number, shift: boolean) {
    if (shift && anchor != null) {
      const [from, to] = anchor < page ? [anchor, page] : [page, anchor];
      const run = pages.filter((p) => p >= from && p <= to);
      setSelected((current) => [...new Set([...current, ...run])]);
      return;
    }
    setAnchor(page);
    setSelected((current) =>
      current.includes(page)
        ? current.filter((p) => p !== page)
        : [...current, page],
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {pages.map((page) => {
          const owner = assignedTo.get(page);
          const isSelected = selected.includes(page);
          return (
            <button
              key={page}
              type="button"
              draggable
              onClick={(event) => toggle(page, event.shiftKey)}
              onDoubleClick={() => setZoomPage(page)}
              onDragStart={(event) => {
                const dragged: DraggedPages = {
                  fileKey,
                  pages: isSelected
                    ? [...selected].sort((a, b) => a - b)
                    : [page],
                };
                event.dataTransfer.setData(IMPORT_PAGES_MIME, JSON.stringify(dragged));
                event.dataTransfer.effectAllowed = "copy";
              }}
              onDragEnd={() => setSelected([])}
              title="Click to select, drag onto a structure, double-click to view"
              className={`flex cursor-grab flex-col gap-1 rounded-md p-1 text-left text-[11px] transition ${
                isSelected
                  ? "bg-sky-100 ring-2 ring-sky-500"
                  : "hover:bg-slate-100"
              }`}
            >
              <span
                className={`overflow-hidden rounded border ${
                  owner ? "border-slate-200" : "border-amber-400"
                }`}
              >
                <PageThumbnail pdf={pdf} pageNumber={page} />
              </span>
              <span
                className={`truncate font-semibold ${owner ? "text-slate-600" : "text-amber-700"}`}
              >
                p{page} → {owner ?? "unassigned"}
              </span>
            </button>
          );
        })}
      </div>
      {zoomPage != null ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-6"
          onClick={() => setZoomPage(null)}
        >
          <div
            className="max-h-full w-full max-w-3xl overflow-auto rounded-lg bg-white p-3 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-800">
                Page {zoomPage} of {pdf.numPages}
              </span>
              <button
                type="button"
                onClick={() => setZoomPage(null)}
                className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <ZoomedPage pdf={pdf} pageNumber={zoomPage} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ZoomedPage({ pdf, pageNumber }: { pdf: PDFDocumentProxy; pageNumber: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    let task: { cancel(): void; promise: Promise<void> } | null = null;
    void (async () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) {
          return;
        }
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 1100 / base.width });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
          return;
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        task = page.render({ canvasContext: context, viewport, canvas });
        await task.promise;
      } catch {
        // Leave the canvas blank on a render failure.
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber]);
  return <canvas ref={canvasRef} className="block h-auto w-full" />;
}
