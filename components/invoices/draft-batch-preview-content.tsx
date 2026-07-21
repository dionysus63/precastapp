"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { BackButton } from "@/components/dashboard/back-button";
import { printPdfUrl } from "@/lib/print-pdf-url";

const PAGE_ASPECT_RATIO = 8.5 / 11;
const BATCH_PDF_URL = "/api/invoices/draft-batch/pdf";

/**
 * Print-preview page for the draft-invoice batch (cover + every draft),
 * mirroring the quote/delivery-ticket preview pages: canvas render of the
 * exact PDF with a pager, and a Print button that goes through printPdfUrl
 * (which handles the desktop shell's PDF-printing quirks).
 */
export function DraftBatchPreviewContent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [activePage, setActivePage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load the batch PDF once; page flips only re-render from the cached doc.
  useEffect(() => {
    let cancelled = false;

    async function loadDocument() {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const response = await fetch(BATCH_PDF_URL, {
          credentials: "same-origin",
        });
        if (!response.ok) {
          throw new Error(
            (await response.text()).slice(0, 200) ||
              "Could not load the draft batch PDF.",
          );
        }
        const pdf = await pdfjs.getDocument({
          data: await response.arrayBuffer(),
        }).promise;
        if (cancelled) {
          return;
        }
        docRef.current = pdf;
        setPageCount(pdf.numPages);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load the draft batch PDF.",
          );
          setIsLoading(false);
        }
      }
    }

    void loadDocument();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const pdf = docRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!pdf || !canvas || !container || pageCount === 0) {
      return;
    }

    let cancelled = false;

    async function renderPage() {
      setIsLoading(true);
      try {
        const page = await pdf!.getPage(
          Math.min(Math.max(activePage, 1), pageCount),
        );
        const baseViewport = page.getViewport({ scale: 1 });
        const containerWidth = container!.clientWidth || baseViewport.width;
        const scale = containerWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        canvas!.width = viewport.width;
        canvas!.height = viewport.height;
        const context = canvas!.getContext("2d", { alpha: false });
        if (!context) {
          throw new Error("Could not initialize the preview canvas.");
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
              : "Failed to render the preview.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void renderPage();
    return () => {
      cancelled = true;
    };
  }, [activePage, pageCount]);

  return (
    <div className="bg-neutral-100 text-neutral-900 [color-scheme:light]">
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[8.5in] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <BackButton href="/invoices?tab=drafts" label="Back to Draft Review" />
          <button
            type="button"
            disabled={pageCount === 0}
            onClick={() => printPdfUrl(BATCH_PDF_URL)}
            className="rounded border border-neutral-800 bg-neutral-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Print
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[8.5in] px-4 py-6">
        {pageCount > 1 ? (
          <div className="mb-3 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled={activePage <= 1}
              onClick={() => setActivePage((page) => Math.max(page - 1, 1))}
              className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="text-sm text-neutral-600">
              Page {activePage} of {pageCount}
            </span>
            <button
              type="button"
              disabled={activePage >= pageCount}
              onClick={() =>
                setActivePage((page) => Math.min(page + 1, pageCount))
              }
              className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        ) : null}

        <div
          ref={containerRef}
          className="relative w-full bg-white shadow-lg"
          style={{ aspectRatio: `${PAGE_ASPECT_RATIO}` }}
        >
          <canvas
            ref={canvasRef}
            className={`block w-full bg-white ${isLoading || error ? "hidden" : ""}`}
          />
          {isLoading && !error ? (
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

        {pageCount > 0 ? (
          <p className="mt-2 text-center text-xs text-neutral-500">
            Cover sheet plus every draft invoice — Print outputs all{" "}
            {pageCount} page{pageCount === 1 ? "" : "s"}.
          </p>
        ) : null}
      </main>
    </div>
  );
}
