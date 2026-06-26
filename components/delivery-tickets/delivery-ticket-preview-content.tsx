"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { generateDeliveryTicketPdf } from "@/app/delivery-tickets/pdf-actions";
import {
  DeliveryTicketPdfCanvasPreview,
  getDeliveryTicketPreviewPrintUrl,
} from "@/components/delivery-tickets/delivery-ticket-pdf-canvas-preview";

const COPY_COUNT = 3;

type DeliveryTicketPreviewContentProps = {
  ticketId: string;
  ticketNumber: string;
  backHref?: string;
  backLabel?: string;
};

export function DeliveryTicketPreviewContent({
  ticketId,
  ticketNumber,
  backHref,
  backLabel = "Back to Ticket",
}: DeliveryTicketPreviewContentProps) {
  const [previewCopy, setPreviewCopy] = useState(1);
  const [previewSheet, setPreviewSheet] = useState(1);
  const [sheetCount, setSheetCount] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [pdfResult, setPdfResult] = useState<
    { type: "success"; filePath: string } | { type: "error"; message: string } | null
  >(null);

  const handleSheetCountChange = useCallback((count: number) => {
    setSheetCount(count);
    setPreviewSheet((current) => Math.min(current, Math.max(count, 1)));
  }, []);

  function handleCopyChange(copyNumber: number) {
    setPreviewCopy(copyNumber);
    setPreviewSheet(1);
    setSheetCount(1);
  }

  function handlePrint() {
    const printWindow = window.open(getDeliveryTicketPreviewPrintUrl(ticketId), "_blank");
    if (!printWindow) {
      return;
    }
    printWindow.addEventListener("load", () => {
      printWindow.focus();
      printWindow.print();
    });
  }

  function handleGeneratePdf() {
    setPdfResult(null);
    startTransition(async () => {
      const result = await generateDeliveryTicketPdf(ticketId);
      if (result.success) {
        setPdfResult({ type: "success", filePath: result.filePath });
        return;
      }
      setPdfResult({ type: "error", message: result.error });
    });
  }

  return (
    <div className="bg-neutral-100 text-neutral-900 print:bg-white [color-scheme:light]">
      <div className="print:hidden border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[8.5in] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            href={backHref ?? `/delivery-tickets/${ticketId}`}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
          >
            ← {backLabel}
          </Link>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="rounded border border-neutral-300 bg-white px-4 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              Print (3 copies)
            </button>
            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={isPending}
              className="rounded border border-neutral-800 bg-neutral-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Generating..." : "Generate PDF"}
            </button>
          </div>
        </div>
        {pdfResult?.type === "success" ? (
          <div className="mx-auto max-w-[8.5in] border-t border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-semibold">PDF generated successfully.</p>
            <p className="mt-1 break-all text-emerald-800">
              Saved to:{" "}
              <span className="font-mono text-xs">{pdfResult.filePath}</span>
            </p>
          </div>
        ) : null}
        {pdfResult?.type === "error" ? (
          <div className="mx-auto max-w-[8.5in] border-t border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {pdfResult.message}
          </div>
        ) : null}
      </div>

      <main className="mx-auto w-full max-w-[8.5in] px-4 py-6 print:max-w-none print:p-0">
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2 print:hidden">
          {Array.from({ length: COPY_COUNT }, (_, index) => {
            const copyNumber = index + 1;
            const isActive = copyNumber === previewCopy;
            return (
              <button
                key={copyNumber}
                type="button"
                onClick={() => handleCopyChange(copyNumber)}
                className={`rounded border px-3 py-1 text-sm font-medium ${
                  isActive
                    ? "border-neutral-800 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50"
                }`}
              >
                Copy {copyNumber}
              </button>
            );
          })}
        </div>

        {sheetCount > 1 ? (
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2 print:hidden">
            {Array.from({ length: sheetCount }, (_, index) => {
              const sheetNumber = index + 1;
              const isActive = sheetNumber === previewSheet;
              return (
                <button
                  key={sheetNumber}
                  type="button"
                  onClick={() => setPreviewSheet(sheetNumber)}
                  className={`rounded border px-3 py-1 text-sm font-medium ${
                    isActive
                      ? "border-neutral-600 bg-neutral-700 text-white"
                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  Sheet {sheetNumber}
                </button>
              );
            })}
          </div>
        ) : null}

        <DeliveryTicketPdfCanvasPreview
          ticketId={ticketId}
          activeCopy={previewCopy}
          activeSheet={previewSheet}
          onSheetCountChange={handleSheetCountChange}
        />

        <p className="mt-2 text-center text-xs text-neutral-500 print:hidden">
          Showing copy {previewCopy} of {COPY_COUNT}
          {sheetCount > 1 ? `, sheet ${previewSheet} of ${sheetCount}` : ""} for ticket{" "}
          {ticketNumber}. Print outputs all copies and sheets.
        </p>
      </main>
    </div>
  );
}
