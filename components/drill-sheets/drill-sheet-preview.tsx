import type { ReactNode } from "react";
import {
  type DrillSheetResult,
  formatCurrency,
  formatFeetInches,
  formatFeetInchesShort,
  getStructureDimensions,
  getStructureElevations,
} from "@/lib/drill-sheet";
import {
  getOpeningPlacements,
  angleToClockPosition,
} from "@/lib/drill-sheet-diagram";

export type DrillSheetPreviewMeta = {
  templateName: string;
  manholeNumber: string;
  contractor: string;
  project: string;
  date: string;
  castingName: string;
  insideDiameterFeet: number | null;
  hasSteps: boolean;
  inspection: string;
  approvedBy: string;
  useBase: string;
  useRiser: string;
  brickAdjustment: string;
};

type DrillSheetPreviewProps = {
  meta: DrillSheetPreviewMeta;
  result: DrillSheetResult;
};

function feet(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return value.toFixed(2);
}

function PreviewPanel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border border-slate-200 p-2 ${className ?? ""}`}>
      <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h4>
      {children}
    </div>
  );
}

function HeaderRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-slate-100 py-0.5">
      <span className="text-[10px] font-medium text-slate-500">{label}</span>
      <span className="text-[10px] font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function CalcRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-2 py-0.5 ${
        emphasize
          ? "border-t border-slate-300 font-semibold text-slate-900"
          : "border-b border-slate-100 text-slate-700"
      }`}
    >
      <span className="text-[10px]">{label}</span>
      <span className="text-[10px] tabular-nums">{value}</span>
    </div>
  );
}

const compactTableHead =
  "border-b border-slate-100 bg-slate-50/80 text-[10px] uppercase tracking-wide text-slate-500";
const compactTh = "px-2 py-1 font-semibold";
const compactTd = "px-2 py-0.5";

function PlanDiagram({ result }: { result: DrillSheetResult }) {
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 66;
  const placements = getOpeningPlacements(result.openings, { cx, cy, radius });

  if (placements.length === 0) {
    return null;
  }

  return (
    <div className="flex justify-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-44 w-44"
        role="img"
        aria-label="Plan view of structure openings"
      >
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="#f8fafc"
          stroke="#475569"
          strokeWidth={2}
        />
        <circle cx={cx} cy={cy} r={2} fill="#475569" />
        {placements.map((placement, index) => (
          <g key={index}>
            <line
              x1={cx}
              y1={cy}
              x2={placement.x}
              y2={placement.y}
              stroke={placement.isLowInvert ? "#059669" : "#94a3b8"}
              strokeWidth={placement.isLowInvert ? 2 : 1}
              strokeDasharray={placement.isLowInvert ? undefined : "3 3"}
            />
            <circle
              cx={placement.x}
              cy={placement.y}
              r={10}
              fill={placement.isLowInvert ? "#059669" : "#1e293b"}
            />
            <text
              x={placement.x}
              y={placement.y + 3}
              textAnchor="middle"
              fontSize={10}
              fontWeight={700}
              fill="#ffffff"
            >
              {placement.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function DrillSheetPreview({ meta, result }: DrillSheetPreviewProps) {
  const elevations = getStructureElevations(result);
  const dimensions = getStructureDimensions(result);
  const hasPlan =
    getOpeningPlacements(result.openings, { cx: 90, cy: 90, radius: 66 })
      .length > 0;

  return (
    <div className="space-y-2">
      {result.errorMessage ? (
        <div className="rounded border border-rose-200 bg-rose-50 p-2 text-[10px] text-rose-800">
          {result.errorMessage}
        </div>
      ) : null}

      {result.warnings.length > 0 ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-2">
          <ul className="list-disc pl-4 text-[10px] text-amber-800">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 p-2">
        <div className="grid gap-2 lg:grid-cols-3">
          <PreviewPanel title="Header">
            <HeaderRow label="Template" value={meta.templateName || "—"} />
            <HeaderRow label="Structure #" value={meta.manholeNumber || "—"} />
            <HeaderRow label="Contractor" value={meta.contractor || "—"} />
            <HeaderRow label="Project" value={meta.project || "—"} />
            <HeaderRow label="Date" value={meta.date || "—"} />
            <HeaderRow label="Casting" value={meta.castingName || "—"} />
            <HeaderRow label="Inspection" value={meta.inspection || "—"} />
            <HeaderRow label="Approved By" value={meta.approvedBy || "—"} />
            <HeaderRow
              label="Diameter"
              value={
                meta.insideDiameterFeet != null
                  ? formatFeetInches(meta.insideDiameterFeet)
                  : "—"
              }
            />
            <HeaderRow label="Steps" value={meta.hasSteps ? "Yes" : "No"} />
            <HeaderRow label="Key" value={result.hasKey ? "Yes" : "No"} />
          </PreviewPanel>

          <PreviewPanel title="Calculation (ft)">
            <CalcRow label="Rim Elevation" value={feet(result.rimElevation)} />
            <CalcRow label="Low Invert" value={feet(result.lowInvertElevation)} />
            <CalcRow label="Invert to Top" value={feet(result.invertToTopFeet)} />
            <CalcRow label="Casting (-)" value={feet(result.castingHeightFeet)} />
            <CalcRow
              label="Top Slab (-)"
              value={feet(result.topSlabThicknessFeet)}
            />
            <CalcRow label="Sump (+)" value={feet(result.sumpFeet)} />
            <CalcRow label="Brick (-)" value={feet(result.brickFeet)} />
            <CalcRow
              label={`Wall Height (${formatFeetInches(result.wallHeightFeet)})`}
              value={feet(result.wallHeightFeet)}
              emphasize
            />
            <CalcRow label="Total Height" value={feet(result.totalHeightFeet)} />
          </PreviewPanel>

          <PreviewPanel title="Quote">
            <CalcRow label="Wall Price" value={formatCurrency(result.wallPrice)} />
            <CalcRow label="Boots Price" value={formatCurrency(result.bootsPrice)} />
            <CalcRow
              label="Total Price"
              value={formatCurrency(result.totalPrice)}
              emphasize
            />
          </PreviewPanel>
        </div>

        {elevations.length > 0 || dimensions.length > 0 ? (
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            {elevations.length > 0 ? (
              <PreviewPanel title="Elevations (top to bottom)">
                <table className="min-w-full text-left text-[10px]">
                  <thead>
                    <tr className={compactTableHead}>
                      <th className={`${compactTh} text-left`}>Location</th>
                      <th className={`${compactTh} text-right`}>Elev (ft)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {elevations.map((entry) => (
                      <tr key={entry.key}>
                        <td className={`${compactTd} text-slate-700`}>
                          {entry.label}
                        </td>
                        <td
                          className={`${compactTd} text-right tabular-nums font-medium text-slate-900`}
                        >
                          {entry.elevation.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PreviewPanel>
            ) : null}

            {dimensions.length > 0 ? (
              <PreviewPanel title="Dimensions (top to bottom)">
                <table className="min-w-full text-left text-[10px]">
                  <thead>
                    <tr className={compactTableHead}>
                      <th className={`${compactTh} text-left`}>Component</th>
                      <th className={`${compactTh} text-right`}>Dimension</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dimensions.map((dim) => (
                      <tr key={dim.key}>
                        <td className={`${compactTd} text-slate-700`}>{dim.label}</td>
                        <td
                          className={`${compactTd} text-right tabular-nums font-medium text-slate-900`}
                        >
                          {formatFeetInchesShort(dim.feet)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PreviewPanel>
            ) : null}
          </div>
        ) : null}

        <div className="mt-2 grid gap-2 lg:grid-cols-[180px_1fr]">
          {hasPlan ? (
            <PreviewPanel title="Plan View (low invert up)">
              <PlanDiagram result={result} />
            </PreviewPanel>
          ) : null}

          <PreviewPanel
            title="Precast Sections"
            className={hasPlan ? undefined : "lg:col-span-2"}
          >
            {result.sections.length === 0 ? (
              <p className="text-[10px] text-slate-500">No sections selected.</p>
            ) : (
              <ul className="space-y-0.5">
                {result.sections.map((section, index) => (
                  <li
                    key={`${section.role}-${index}`}
                    className="flex justify-between text-[10px] text-slate-700"
                  >
                    <span>
                      {section.role === "BASE" ? "Base" : "Riser"}
                      {section.label ? ` — ${section.label}` : ""}
                    </span>
                    <span className="tabular-nums">
                      {formatFeetInches(section.heightFeet)} (
                      {section.heightFeet.toFixed(2)}&apos;)
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-[9px] text-slate-500">
              Top slab is always separate.
            </p>
            {meta.useBase || meta.useRiser || meta.brickAdjustment ? (
              <dl className="mt-1 space-y-0.5 border-t border-slate-100 pt-1">
                {meta.useBase ? (
                  <div className="flex justify-between text-[10px]">
                    <dt className="text-slate-500">Use (Base)</dt>
                    <dd className="font-medium text-slate-900">{meta.useBase}</dd>
                  </div>
                ) : null}
                {meta.useRiser ? (
                  <div className="flex justify-between text-[10px]">
                    <dt className="text-slate-500">Use (Riser)</dt>
                    <dd className="font-medium text-slate-900">{meta.useRiser}</dd>
                  </div>
                ) : null}
                {meta.brickAdjustment ? (
                  <div className="flex justify-between text-[10px]">
                    <dt className="text-slate-500">Brick Adjustment</dt>
                    <dd className="font-medium text-slate-900">
                      {meta.brickAdjustment}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </PreviewPanel>
        </div>

        <div className="mt-2 overflow-x-auto border border-slate-200">
          <table className="min-w-full text-left text-[10px]">
            <thead>
              <tr className={compactTableHead}>
                <th className={compactTh}>Opening</th>
                <th className={compactTh}>Material</th>
                <th className={compactTh}>Size</th>
                <th className={compactTh}>Type</th>
                <th className={compactTh}>Invert</th>
                <th className={compactTh}>Top Pipe</th>
                <th className={compactTh}>Bot Open</th>
                <th className={compactTh}>Top Open</th>
                <th className={compactTh}>Base→Bot (in)</th>
                <th className={compactTh}>Hole</th>
                <th className={compactTh}>Boot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.openings.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-2 py-2 text-center text-slate-500"
                  >
                    No openings entered.
                  </td>
                </tr>
              ) : (
                result.openings.map((opening, index) => {
                  const angleDeg = opening.isLowInvert
                    ? 0
                    : (opening.angleDegrees ?? 0);
                  return (
                    <tr
                      key={index}
                      className={opening.isLowInvert ? "bg-emerald-50/60" : ""}
                    >
                      <td className={`${compactTd} font-medium text-slate-900`}>
                        {opening.label || String.fromCharCode(65 + index)}
                        {opening.isLowInvert ? " (low)" : ""}
                        {!opening.isLowInvert ? (
                          <span className="ml-1 text-slate-400">
                            {Math.round(angleDeg)}° (
                            {angleToClockPosition(angleDeg)})
                          </span>
                        ) : null}
                      </td>
                      <td className={`${compactTd} text-slate-600`}>
                        {opening.pipeMaterial || "—"}
                      </td>
                      <td className={`${compactTd} text-slate-600`}>
                        {opening.pipeSizeInches ?? "—"}&quot;
                      </td>
                      <td className={`${compactTd} text-slate-600`}>
                        {opening.pipeType || "—"}
                      </td>
                      <td className={`${compactTd} tabular-nums text-slate-600`}>
                        {feet(opening.invertElevation)}
                      </td>
                      <td className={`${compactTd} tabular-nums text-slate-600`}>
                        {feet(opening.topOfPipeFeet)}
                      </td>
                      <td className={`${compactTd} tabular-nums text-slate-600`}>
                        {feet(opening.bottomOfOpeningFeet)}
                      </td>
                      <td className={`${compactTd} tabular-nums text-slate-600`}>
                        {feet(opening.topOfOpeningFeet)}
                      </td>
                      <td
                        className={`${compactTd} tabular-nums font-medium text-slate-900`}
                      >
                        {opening.baseTopToOpeningBottomInches ?? "—"}
                      </td>
                      <td className={`${compactTd} text-slate-600`}>
                        {opening.holeDiameterInches ?? "—"}&quot;
                      </td>
                      <td className={`${compactTd} text-slate-600`}>
                        {opening.bootModel ?? "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
