"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import {
  generateDeliveryTicketPdf,
  printDeliveryTicketDirect,
} from "@/app/delivery-tickets/pdf-actions";
import { deliverTicket } from "@/app/operations/actions";
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
  /** Walk-in counter sales: printing marks the ticket delivered/complete. */
  completeOnPrint?: boolean;
  /**
   * Server-side ticket printer (Settings -> Fleet & Crew). When set, the
   * print button prints silently on the server instead of opening the
   * browser print dialog.
   */
  directPrintPrinter?: string | null;
};

export function DeliveryTicketPreviewContent({
  ticketId,
  ticketNumber,
  backHref,
  backLabel = "Back to Ticket",
  completeOnPrint = false,
  directPrintPrinter = null,
}: DeliveryTicketPreviewContentProps) {
  const router = useRouter();
  const [previewCopy, setPreviewCopy] = useState(1);
  const [previewSheet, setPreviewSheet] = useState(1);
  const [sheetCount, setSheetCount] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [isCompleting, startCompleteTransition] = useTransition();
  const [isPrinting, startPrintingTransition] = useTransition();
  const [completeMessage, setCompleteMessage] = useState<
    { type: "error" | "warning"; text: string } | null
  >(null);
  const [printMessage, setPrintMessage] = useState<
    { type: "error" | "success"; text: string } | null
  >(null);
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

  function openPrintWindow() {
    const printWindow = window.open(getDeliveryTicketPreviewPrintUrl(ticketId), "_blank");
    if (!printWindow) {
      return;
    }
    printWindow.addEventListener("load", () => {
      printWindow.focus();
      printWindow.print();
    });
  }

  // Direct (silent) print when a server printer is configured; browser print
  // dialog otherwise. Shared by the plain print button and the walk-in
  // complete-and-print flow.
  function printCopies() {
    if (!directPrintPrinter) {
      openPrintWindow();
      return;
    }
    setPrintMessage(null);
    startPrintingTransition(async () => {
      const result = await printDeliveryTicketDirect(ticketId);
      if (!result.success) {
        setPrintMessage({ type: "error", text: result.error });
        return;
      }
      setPrintMessage({
        type: "success",
        text: `Sent ${ticketNumber} (3 copies) to ${result.printer}.`,
      });
    });
  }

  function handlePrint() {
    if (!completeOnPrint) {
      printCopies();
      return;
    }
    setCompleteMessage(null);
    startCompleteTransition(async () => {
      // Complete first so a printed ticket is always a completed sale; the
      // action is idempotent, so re-printing an already-completed one is safe.
      const result = await deliverTicket(ticketId);
      if ("error" in result && result.error) {
        setCompleteMessage({ type: "error", text: result.error });
        return;
      }
      if ("warning" in result && result.warning) {
        setCompleteMessage({ type: "warning", text: result.warning });
      }
      printCopies();
      router.refresh();
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
              disabled={isCompleting || isPrinting}
              className={
                completeOnPrint
                  ? "rounded border border-neutral-800 bg-neutral-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                  : "rounded border border-neutral-300 bg-white px-4 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
              }
            >
              {isCompleting
                ? "Completing…"
                : isPrinting
                  ? "Printing…"
                  : completeOnPrint
                    ? "Print & Complete Sale"
                    : "Print (3 copies)"}
            </button>
            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={isPending}
              className={
                completeOnPrint
                  ? "rounded border border-neutral-300 bg-white px-4 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                  : "rounded border border-neutral-800 bg-neutral-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              }
            >
              {isPending ? "Generating..." : "Generate PDF"}
            </button>
          </div>
        </div>
        {directPrintPrinter ? (
          <div className="mx-auto flex max-w-[8.5in] flex-wrap items-center gap-x-2 px-4 pb-3 text-xs text-neutral-500">
            <span>
              Prints directly to <span className="font-medium">{directPrintPrinter}</span>.
            </span>
            <button
              type="button"
              onClick={openPrintWindow}
              className="font-medium text-neutral-600 underline underline-offset-2 hover:text-neutral-900"
            >
              Print via browser instead…
            </button>
          </div>
        ) : null}
        {completeOnPrint ? (
          <div className="mx-auto max-w-[8.5in] px-4 pb-3 text-xs text-neutral-500">
            Printing marks this sale complete: stock is deducted and the ticket
            moves to “Recently completed” on the walk-ins board. Previewing
            alone leaves it open.
          </div>
        ) : null}
        {printMessage ? (
          <div
            className={`mx-auto max-w-[8.5in] border-t px-4 py-3 text-sm ${
              printMessage.type === "error"
                ? "border-red-100 bg-red-50 text-red-800"
                : "border-emerald-100 bg-emerald-50 text-emerald-900"
            }`}
          >
            {printMessage.text}
          </div>
        ) : null}
        {completeMessage ? (
          <div
            className={`mx-auto max-w-[8.5in] border-t px-4 py-3 text-sm ${
              completeMessage.type === "error"
                ? "border-red-100 bg-red-50 text-red-800"
                : "border-amber-100 bg-amber-50 text-amber-900"
            }`}
          >
            {completeMessage.text}
          </div>
        ) : null}
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
