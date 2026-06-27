import {
  type DrillSheetResult,
  formatCurrency,
  formatFeetInches,
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

function HeaderRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <span className="text-[11px] font-semibold text-slate-900">{value}</span>
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
      className={`flex justify-between gap-4 py-1.5 ${
        emphasize
          ? "border-t-2 border-slate-300 font-semibold text-slate-900"
          : "border-b border-slate-100 text-slate-700"
      }`}
    >
      <span className="text-xs">{label}</span>
      <span className="text-xs tabular-nums">{value}</span>
    </div>
  );
}

function PlanDiagram({ result }: { result: DrillSheetResult }) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 96;
  const placements = getOpeningPlacements(result.openings, { cx, cy, radius });

  if (placements.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Plan View (low invert up)
      </h4>
      <div className="flex justify-center">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="h-64 w-64"
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
          <circle cx={cx} cy={cy} r={3} fill="#475569" />
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
                r={13}
                fill={placement.isLowInvert ? "#059669" : "#1e293b"}
              />
              <text
                x={placement.x}
                y={placement.y + 4}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill="#ffffff"
              >
                {placement.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export function DrillSheetPreview({ meta, result }: DrillSheetPreviewProps) {
  return (
    <div className="space-y-4">
      {result.errorMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-800">
          {result.errorMessage}
        </div>
      ) : null}

      {result.warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <ul className="list-disc pl-4 text-[11px] text-amber-800">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-4">
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Header
          </h4>
          <HeaderRow label="Template" value={meta.templateName || "—"} />
          <HeaderRow label="Structure #" value={meta.manholeNumber || "—"} />
          <HeaderRow label="Contractor" value={meta.contractor || "—"} />
          <HeaderRow label="Project" value={meta.project || "—"} />
          <HeaderRow label="Date" value={meta.date || "—"} />
          <HeaderRow label="Casting" value={meta.castingName || "—"} />
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
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Calculation (ft)
          </h4>
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
          <CalcRow
            label="Total Height"
            value={feet(result.totalHeightFeet)}
          />
        </div>
      </div>

      {getStructureElevations(result).length > 0 ? (
        <div className="rounded-lg border border-slate-200 p-4">
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Elevations (top to bottom)
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-semibold">Location</th>
                  <th className="px-3 py-2 font-semibold text-right">
                    Elevation (ft)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {getStructureElevations(result).map((entry) => (
                  <tr key={entry.label}>
                    <td className="px-3 py-1.5 text-slate-700">{entry.label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium text-slate-900">
                      {entry.elevation.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 p-4">
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Precast Sections
        </h4>
        {result.sections.length === 0 ? (
          <p className="text-xs text-slate-500">No sections selected.</p>
        ) : (
          <ul className="space-y-1">
            {result.sections.map((section, index) => (
              <li
                key={`${section.role}-${index}`}
                className="flex justify-between text-xs text-slate-700"
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
        <p className="mt-2 text-[11px] text-slate-500">
          Top slab is always separate.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Quote
        </h4>
        <CalcRow label="Wall Price" value={formatCurrency(result.wallPrice)} />
        <CalcRow label="Boots Price" value={formatCurrency(result.bootsPrice)} />
        <CalcRow
          label="Total Price"
          value={formatCurrency(result.totalPrice)}
          emphasize
        />
      </div>

      <PlanDiagram result={result} />

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-semibold">Opening</th>
              <th className="px-3 py-2 font-semibold">Material</th>
              <th className="px-3 py-2 font-semibold">Size</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Invert</th>
              <th className="px-3 py-2 font-semibold">Top Pipe</th>
              <th className="px-3 py-2 font-semibold">Bot Open</th>
              <th className="px-3 py-2 font-semibold">Top Open</th>
              <th className="px-3 py-2 font-semibold">Base→Bot (in)</th>
              <th className="px-3 py-2 font-semibold">Hole</th>
              <th className="px-3 py-2 font-semibold">Boot</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.openings.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="px-3 py-4 text-center text-slate-500"
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
                    <td className="px-3 py-1.5 font-medium text-slate-900">
                      {opening.label || String.fromCharCode(65 + index)}
                      {opening.isLowInvert ? " (low)" : ""}
                      {!opening.isLowInvert ? (
                        <span className="ml-1 text-slate-400">
                          {Math.round(angleDeg)}° (
                          {angleToClockPosition(angleDeg)})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5 text-slate-600">
                      {opening.pipeMaterial || "—"}
                    </td>
                    <td className="px-3 py-1.5 text-slate-600">
                      {opening.pipeSizeInches ?? "—"}&quot;
                    </td>
                    <td className="px-3 py-1.5 text-slate-600">
                      {opening.pipeType || "—"}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums text-slate-600">
                      {feet(opening.invertElevation)}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums text-slate-600">
                      {feet(opening.topOfPipeFeet)}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums text-slate-600">
                      {feet(opening.bottomOfOpeningFeet)}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums text-slate-600">
                      {feet(opening.topOfOpeningFeet)}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums font-medium text-slate-900">
                      {opening.baseTopToOpeningBottomInches ?? "—"}
                    </td>
                    <td className="px-3 py-1.5 text-slate-600">
                      {opening.holeDiameterInches ?? "—"}&quot;
                    </td>
                    <td className="px-3 py-1.5 text-slate-600">
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
  );
}
