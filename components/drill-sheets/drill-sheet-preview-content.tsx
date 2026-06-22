"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  DrillSheetPreview,
  type DrillSheetPreviewMeta,
} from "@/components/drill-sheets/drill-sheet-preview";
import { generateDrillSheetPdf } from "@/app/drill-sheets/pdf-actions";
import type { DrillSheetResult } from "@/lib/drill-sheet";

type DrillSheetPreviewContentProps = {
  meta: DrillSheetPreviewMeta;
  result: DrillSheetResult;
  drillSheetId: string;
};

export function DrillSheetPreviewContent({
  meta,
  result,
  drillSheetId,
}: DrillSheetPreviewContentProps) {
  const [isPending, startTransition] = useTransition();
  const [pdfResult, setPdfResult] = useState<
    | { type: "success"; filePath: string }
    | { type: "error"; message: string }
    | null
  >(null);

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
              onClick={() => window.print()}
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

      <div className="min-h-screen bg-neutral-200 py-8 print:bg-white print:py-0">
        <article
          className="mx-auto w-full max-w-[8.5in] bg-white px-10 py-10 shadow-lg print:max-w-none print:px-0 print:py-0 print:shadow-none"
          style={{ minHeight: "11in" }}
        >
          <header className="mb-6 border-b border-neutral-300 pb-4">
            <h1 className="text-2xl font-bold text-neutral-900">
              Drill Sheet {meta.manholeNumber ? `— ${meta.manholeNumber}` : ""}
            </h1>
            <p className="mt-1 text-sm text-neutral-700">
              {meta.templateName || "Circular manhole"}
              {meta.project ? ` — ${meta.project}` : ""}
            </p>
          </header>

          <DrillSheetPreview meta={meta} result={result} />
        </article>
      </div>
    </>
  );
}
