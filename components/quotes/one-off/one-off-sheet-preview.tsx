"use client";

import {
  DrillSheetPreview,
  type DrillSheetPreviewMeta,
} from "@/components/drill-sheets/drill-sheet-preview";
import {
  RectSheetPreview,
  type RectSheetPreviewMeta,
} from "@/components/drill-sheets/rect-sheet-preview";
import { localTodayInput } from "@/lib/date-only";
import {
  type OneOffCircularOptions,
  type OneOffRectOptions,
  type OneOffRow,
  type OneOffRowResult,
  type OneOffShape,
} from "@/lib/quotes/one-off-drill-sheets";

type OneOffSheetPreviewProps = {
  shape: OneOffShape;
  /** The row being previewed (the one last clicked in the grid), if any. */
  row: OneOffRow | null;
  result: OneOffRowResult | null;
  /** How many rows the grid has, for the empty-state wording. */
  rowCount: number;
  /** Printed in the sheet header. */
  contractor: string;
  project: string;
  circularOptions: OneOffCircularOptions;
  rectOptions: OneOffRectOptions;
};

/**
 * The drill sheet as it will print, recalculated as the grid is typed in:
 * the same live preview the regular sheet editors show, for the row last
 * clicked in the grid.
 */
export function OneOffSheetPreview({
  shape,
  row,
  result,
  rowCount,
  contractor,
  project,
  circularOptions,
  rectOptions,
}: OneOffSheetPreviewProps) {
  const label = shape === "CIRCULAR" ? "Drill sheet" : "Rect sheet";

  let body: React.ReactNode;
  if (!row) {
    body = (
      <p className="text-xs text-slate-500">
        {rowCount === 0
          ? "Build the rows to see a preview here."
          : "Click a row in the grid to preview its sheet."}
      </p>
    );
  } else if (shape === "CIRCULAR") {
    const template = circularOptions.templates.find(
      (entry) => entry.id === row.templateId,
    );
    const casting = circularOptions.castings.find(
      (entry) => entry.id === row.castingProductId,
    );
    const meta: DrillSheetPreviewMeta = {
      templateName: template?.name ?? "",
      manholeNumber: row.structureNumber,
      contractor,
      project,
      date: localTodayInput(),
      castingName: casting?.name ?? "",
      insideDiameterFeet: row.diameterFeet ? Number(row.diameterFeet) : null,
      hasSteps: false,
      inspection: "",
      approvedBy: "",
      useBase: "",
      useRiser: "",
      brickAdjustment: "",
      topSlabOpeningInches: template?.topSlabOpeningInches ?? null,
    };
    body = result?.circularSheet ? (
      <DrillSheetPreview meta={meta} result={result.circularSheet} />
    ) : (
      <WaitingNote status={result?.status} />
    );
  } else {
    const template = rectOptions.templates.find(
      (entry) => entry.id === row.templateId,
    );
    const casting = rectOptions.castings.find(
      (entry) => entry.id === row.castingProductId,
    );
    const meta: RectSheetPreviewMeta = {
      structureNumber: row.structureNumber,
      contractor,
      project,
      templateName: template?.name ?? "",
      castingName: casting?.name ?? null,
    };
    body = result?.rectSheet ? (
      <RectSheetPreview meta={meta} result={result.rectSheet} />
    ) : (
      <WaitingNote status={result?.status} />
    );
  }

  return (
    <div className="flex min-h-[12rem] flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label} preview
          {row ? (
            <span className="ml-2 normal-case tracking-normal text-slate-900">
              {row.structureNumber.trim() || "(no number)"}
            </span>
          ) : null}
        </h4>
        {row ? (
          <span className="text-[11px] text-slate-500">
            Updates as you type. Click another row to preview it.
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 overflow-x-auto">{body}</div>
    </div>
  );
}

function WaitingNote({ status }: { status: string | undefined }) {
  return (
    <p className="text-xs text-slate-500">
      {status ? `${status}.` : "Enter the rim and inverts to see the sheet."}
    </p>
  );
}
