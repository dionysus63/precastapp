"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { generateDrillSheetPdf } from "@/app/drill-sheets/pdf-actions";
import {
  DrillSheetPdfCanvasPreview,
  getDrillSheetPreviewPrintUrl,
  type DrillSheetPdfPreviewInfo,
} from "@/components/drill-sheets/drill-sheet-pdf-canvas-preview";
import { printPdfUrl } from "@/lib/print-pdf-url";

type DrillSheetPreviewContentProps = {
  drillSheetId: string;
  manholeNumber: string;
  templateName: string;
  projectName: string;
};

function formatVariantLabel(key: string): string {
  const [riser, keyPart] = key.split("-");
  const riserLabel = riser === "riser" ? "Riser" : "No Riser";
  const keyLabel = keyPart === "key" ? "Key" : "No Key";
  return `${riserLabel} + ${keyLabel}`;
}

export function DrillSheetPreviewContent({
  drillSheetId,
  manholeNumber,
  templateName,
  projectName,
}: DrillSheetPreviewContentProps) {
  const [previewSheet, setPreviewSheet] = useState(1);
  const [sheetCount, setSheetCount] = useState(1);
  const [previewInfo, setPreviewInfo] = useState<DrillSheetPdfPreviewInfo | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const [pdfResult, setPdfResult] = useState<
    | { type: "success"; filePath: string }
    | { type: "error"; message: string }
    | null
  >(null);

  const handleSheetCountChange = useCallback((count: number) => {
    setSheetCount(count);
    setPreviewSheet((current) => Math.min(current, Math.max(count, 1)));
  }, []);

  function handlePrint() {
    printPdfUrl(getDrillSheetPreviewPrintUrl(drillSheetId));
  }

  function handleGeneratePdf() {
    setPdfResult(null);
    startTransition(async () => {
      const result = await generateDrillSheetPdf(drillSheetId);
      if (result.success) {
        setPdfResult({ type: "success", filePath: result.filePath });
        return;
      }
      setPdfResult({ type: "error", message: result.error });
    });
  }

  return (
    <>
      <div className="print:hidden border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[8.5in] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            href={`/drill-sheets/${drillSheetId}`}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
          >
            ← Back to Drill Sheet
          </Link>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="rounded border border-neutral-300 bg-white px-4 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              Print
            </button>
            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={isPending}
              className="rounded border border-neutral-800 bg-neutral-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save to Job Folder"}
            </button>
          </div>
        </div>

        {previewInfo ? (
          <div className="mx-auto max-w-[8.5in] border-t border-neutral-100 bg-neutral-50 px-4 py-2 text-xs text-neutral-700">
            {previewInfo.source === "template" ? (
              <p>
                Using template PDF{" "}
                <span className="font-medium">
                  {previewInfo.templateName ?? "uploaded form"}
                </span>
                {previewInfo.templateVariant &&
                previewInfo.templateVariant !== previewInfo.computedVariant ? (
                  <>
                    {" "}
                    (slot: {formatVariantLabel(previewInfo.templateVariant)}; sheet
                    computed as {formatVariantLabel(previewInfo.computedVariant)})
                  </>
                ) : (
                  <> ({formatVariantLabel(previewInfo.computedVariant)})</>
                )}
              </p>
            ) : (
              <p>
                No matching template PDF for{" "}
                <span className="font-medium">
                  {formatVariantLabel(previewInfo.computedVariant)}
                </span>
                . Showing generated layout instead — upload a PDF to that slot on
                the structure template.
              </p>
            )}
          </div>
        ) : null}

        {pdfResult?.type === "success" ? (
          <div className="mx-auto max-w-[8.5in] border-t border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-semibold">PDF saved to job folder.</p>
            <p className="mt-1 break-all text-emerald-800">
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

      <div className="min-h-screen bg-neutral-200 py-4 print:bg-white print:py-0">
        <div className="mx-auto w-full max-w-[8.5in] px-4 print:max-w-none print:px-0">
          <header className="mb-3 print:hidden">
            <h1 className="text-xl font-bold text-neutral-900">
              Drill Sheet {manholeNumber ? `— ${manholeNumber}` : ""}
            </h1>
            <p className="mt-0.5 text-sm text-neutral-700">
              {templateName || "Circular manhole"}
              {projectName ? ` — ${projectName}` : ""}
            </p>
          </header>

          {sheetCount > 1 ? (
            <div className="mb-3 flex flex-wrap gap-2 print:hidden">
              {Array.from({ length: sheetCount }, (_, index) => {
                const sheetNumber = index + 1;
                const isActive = sheetNumber === previewSheet;
                return (
                  <button
                    key={sheetNumber}
                    type="button"
                    onClick={() => setPreviewSheet(sheetNumber)}
                    className={`rounded border px-3 py-1 text-xs font-semibold ${
                      isActive
                        ? "border-neutral-800 bg-neutral-900 text-white"
                        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    Sheet {sheetNumber}
                  </button>
                );
              })}
            </div>
          ) : null}

          <DrillSheetPdfCanvasPreview
            drillSheetId={drillSheetId}
            activeSheet={previewSheet}
            onSheetCountChange={handleSheetCountChange}
            onPreviewInfoChange={setPreviewInfo}
          />
        </div>
      </div>
    </>
  );
}
