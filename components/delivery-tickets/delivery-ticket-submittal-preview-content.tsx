"use client";

import { useCallback, useState, useTransition } from "react";
import { printDeliveryTicketSubmittalsDirect } from "@/app/delivery-tickets/pdf-actions";
import { BackButton } from "@/components/dashboard/back-button";
import {
  DeliveryTicketSubmittalPdfCanvasPreview,
  getDeliveryTicketSubmittalPreviewPrintUrl,
} from "@/components/delivery-tickets/delivery-ticket-submittal-pdf-canvas-preview";

type DeliveryTicketSubmittalPreviewContentProps = {
  ticketId: string;
  ticketNumber: string;
  backHref?: string;
  backLabel?: string;
  /**
   * Server-side submittal printer (Settings -> Printing). When set, the
   * print button prints silently on the server instead of opening the
   * browser print dialog.
   */
  directPrintPrinter?: string | null;
};

export function DeliveryTicketSubmittalPreviewContent({
  ticketId,
  ticketNumber,
  backHref,
  backLabel = "Back to Ticket",
  directPrintPrinter = null,
}: DeliveryTicketSubmittalPreviewContentProps) {
  const [previewSheet, setPreviewSheet] = useState(1);
  const [sheetCount, setSheetCount] = useState(1);
  const [isPrinting, startPrintingTransition] = useTransition();
  const [printMessage, setPrintMessage] = useState<
    { type: "error" | "success"; text: string } | null
  >(null);

  const handleSheetCountChange = useCallback((count: number) => {
    setSheetCount(count);
    setPreviewSheet((current) => Math.min(current, Math.max(count, 1)));
  }, []);

  function openPrintWindow() {
    const printWindow = window.open(
      getDeliveryTicketSubmittalPreviewPrintUrl(ticketId),
      "_blank",
    );
    if (!printWindow) {
      return;
    }
    printWindow.addEventListener("load", () => {
      printWindow.focus();
      printWindow.print();
    });
  }

  function handlePrint() {
    if (!directPrintPrinter) {
      openPrintWindow();
      return;
    }
    setPrintMessage(null);
    startPrintingTransition(async () => {
      const result = await printDeliveryTicketSubmittalsDirect(ticketId);
      if (!result.success) {
        setPrintMessage({ type: "error", text: result.error });
        return;
      }
      setPrintMessage({
        type: "success",
        text: `Sent ${ticketNumber} submittals to ${result.printer}.`,
      });
    });
  }

  return (
    <div className="bg-neutral-100 text-neutral-900 print:bg-white [color-scheme:light]">
      <div className="print:hidden border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[8.5in] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <BackButton
            href={backHref ?? `/delivery-tickets/${ticketId}`}
            label={backLabel}
          />
          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            className="rounded border border-neutral-300 bg-white px-4 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
          >
            {isPrinting ? "Printing…" : "Print submittals"}
          </button>
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
      </div>

      <main className="mx-auto w-full max-w-[8.5in] px-4 py-6 print:max-w-none print:p-0">
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

        <DeliveryTicketSubmittalPdfCanvasPreview
          ticketId={ticketId}
          activeSheet={previewSheet}
          onSheetCountChange={handleSheetCountChange}
        />

        <p className="mt-2 text-center text-xs text-neutral-500 print:hidden">
          Submittal package for ticket {ticketNumber}
          {sheetCount > 1 ? ` · sheet ${previewSheet} of ${sheetCount}` : ""}.
          Print outputs all pages.
        </p>
      </main>
    </div>
  );
}
