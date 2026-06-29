"use client";

import { useEffect, useRef, useState } from "react";

const PAGE_ASPECT_RATIO = 8.5 / 11;

export type DrillSheetPdfPreviewInfo = {
  source: "template" | "generated";
  computedVariant: string;
  templateVariant: string | null;
  templateName: string | null;
};

type DrillSheetPdfCanvasPreviewProps = {
  drillSheetId: string;
  activeSheet: number;
  onSheetCountChange?: (count: number) => void;
  onPreviewInfoChange?: (info: DrillSheetPdfPreviewInfo) => void;
};

type LoadedPdf = {
  document: {
    numPages: number;
    getPage: (pageNumber: number) => Promise<{
      getViewport: (params: { scale: number }) => { width: number; height: number };
      render: (params: {
        canvasContext: CanvasRenderingContext2D;
        viewport: { width: number; height: number };
        canvas: HTMLCanvasElement;
        background: string;
      }) => { promise: Promise<void> };
    }>;
  };
};

export function DrillSheetPdfCanvasPreview({
  drillSheetId,
  activeSheet,
  onSheetCountChange,
  onPreviewInfoChange,
}: DrillSheetPdfCanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<LoadedPdf | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [pdfLoadToken, setPdfLoadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setIsRendering(true);
      setError(null);
      pdfRef.current = null;

      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const response = await fetch(
          `/api/drill-sheets/${drillSheetId}/preview`,
          { credentials: "same-origin" },
        );
        if (!response.ok) {
          throw new Error("Could not load drill sheet PDF.");
        }

        onPreviewInfoChange?.({
          source:
            response.headers.get("X-Drill-Sheet-Pdf-Source") === "template"
              ? "template"
              : "generated",
          computedVariant:
            response.headers.get("X-Drill-Sheet-Computed-Variant") ?? "unknown",
          templateVariant: response.headers.get("X-Drill-Sheet-Template-Variant"),
          templateName: response.headers.get("X-Drill-Sheet-Template-Name"),
        });

        const pdfBytes = await response.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: pdfBytes }).promise;

        if (cancelled) {
          return;
        }

        pdfRef.current = { document: pdf };
        onSheetCountChange?.(pdf.numPages);
        setPdfLoadToken((current) => current + 1);
      } catch (loadError) {
        if (!cancelled) {
          onSheetCountChange?.(1);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to render PDF preview.",
          );
          setIsRendering(false);
        }
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      pdfRef.current = null;
    };
  }, [drillSheetId, onSheetCountChange, onPreviewInfoChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const loadedPdf = pdfRef.current;
    if (!canvas || !container || !loadedPdf) {
      return;
    }

    let cancelled = false;

    async function renderPage() {
      setIsRendering(true);
      setError(null);

      try {
        const pdf = loadedPdf.document;
        const sheetIndex = Math.min(Math.max(activeSheet, 1), pdf.numPages);
        const page = await pdf.getPage(sheetIndex);

        if (cancelled) {
          return;
        }

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

        await page.render({
          canvasContext: context,
          viewport,
          canvas: canvas!,
          background: "#ffffff",
        }).promise;
      } catch (renderError) {
        if (!cancelled) {
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
    };
  }, [activeSheet, pdfLoadToken]);

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

export function getDrillSheetPreviewPrintUrl(drillSheetId: string): string {
  return `/api/drill-sheets/${drillSheetId}/preview`;
}
