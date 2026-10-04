"use client";

import { useEffect, useRef, useState } from "react";

const PAGE_ASPECT_RATIO = 8.5 / 11;

type QuotePdfCanvasPreviewProps = {
  quoteId: string;
  activeSheet: number;
  onSheetCountChange?: (count: number) => void;
};

export function QuotePdfCanvasPreview({
  quoteId,
  activeSheet,
  onSheetCountChange,
}: QuotePdfCanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }

    let cancelled = false;
    let loadingTask: { destroy(): Promise<void> } | null = null;
    let renderTask: { cancel(): void } | null = null;

    async function renderPage() {
      setIsRendering(true);
      setError(null);

      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const response = await fetch(`/api/quotes/${quoteId}/preview`, {
          credentials: "same-origin",
        });
        if (!response.ok) {
          throw new Error((await response.text()) || "Could not load quote PDF.");
        }

        const pdfBytes = await response.arrayBuffer();
        const task = pdfjs.getDocument({ data: pdfBytes });
        loadingTask = task;
        const pdf = await task.promise;

        if (cancelled) {
          return;
        }

        onSheetCountChange?.(pdf.numPages);

        const sheetIndex = Math.min(Math.max(activeSheet, 1), pdf.numPages);
        const page = await pdf.getPage(sheetIndex);
        const baseViewport = page.getViewport({ scale: 1 });
        const containerWidth = container!.clientWidth || baseViewport.width;
        const scale = containerWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        canvas!.width = viewport.width;
        canvas!.height = viewport.height;

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
      } catch (renderError) {
        if (!cancelled) {
          onSheetCountChange?.(1);
          setError(
            renderError instanceof Error
              ? renderError.message
              : "Failed to render PDF preview.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      // Frees the parsed document and its worker thread.
      void loadingTask?.destroy();
    };
  }, [quoteId, activeSheet, onSheetCountChange]);

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-white shadow-lg print:shadow-none"
      style={{ aspectRatio: `${PAGE_ASPECT_RATIO}` }}
    >
      <canvas
        ref={canvasRef}
        className={`block w-full bg-white ${isRendering || error ? "hidden" : ""}`}
      />
      {isRendering ? (
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
  );
}

export function getQuotePreviewPrintUrl(quoteId: string): string {
  return `/api/quotes/${quoteId}/preview`;
}
