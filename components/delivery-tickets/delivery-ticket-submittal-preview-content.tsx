"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  DeliveryTicketSubmittalPdfCanvasPreview,
  getDeliveryTicketSubmittalPreviewPrintUrl,
} from "@/components/delivery-tickets/delivery-ticket-submittal-pdf-canvas-preview";

type DeliveryTicketSubmittalPreviewContentProps = {
  ticketId: string;
  ticketNumber: string;
  backHref?: string;
  backLabel?: string;
};

export function DeliveryTicketSubmittalPreviewContent({
  ticketId,
  ticketNumber,
  backHref,
  backLabel = "Back to Ticket",
}: DeliveryTicketSubmittalPreviewContentProps) {
  const [previewSheet, setPreviewSheet] = useState(1);
  const [sheetCount, setSheetCount] = useState(1);

  const handleSheetCountChange = useCallback((count: number) => {
    setSheetCount(count);
    setPreviewSheet((current) => Math.min(current, Math.max(count, 1)));
  }, []);

  function handlePrint() {
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
          <button
            type="button"
            onClick={handlePrint}
            className="rounded border border-neutral-300 bg-white px-4 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            Print submittals
          </button>
        </div>
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
