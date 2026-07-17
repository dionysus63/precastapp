import { SectionCard } from "@/components/dashboard/section-card";
import {
  RectSheetPreview,
  type RectSheetPreviewMeta,
} from "@/components/drill-sheets/rect-sheet-preview";
import { formatFeetInches, formatFeetInchesShort } from "@/lib/drill-sheet";
import {
  formatPounds,
  getRectStructureElevations,
  RECT_WALL_LABELS,
  type ComputedRectOpening,
  type RectStructureResult,
} from "@/lib/rect-structure";
import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableHeaderCellClassName,
  tableNumericCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

type RectSheetDetailViewProps = {
  result: RectStructureResult;
  meta: RectSheetPreviewMeta;
  agencyStandard: string | null;
  dateText: string;
};

function wholeInches(feet: number | null | undefined): string {
  if (feet == null || Number.isNaN(feet)) {
    return "—";
  }
  return `${Math.round(feet * 12)}"`;
}

function fmtElevation(value: number | null | undefined): string {
  return value == null ? "—" : value.toFixed(2);
}

function placementText(opening: ComputedRectOpening): string {
  switch (opening.placement) {
    case "TOUCH_LEFT":
      return "To left end";
    case "TOUCH_RIGHT":
      return "To right end";
    case "FROM_LEFT":
      return opening.offsetInches != null
        ? `${opening.offsetInches}" from left`
        : "From left";
    case "FROM_RIGHT":
      return opening.offsetInches != null
        ? `${opening.offsetInches}" from right`
        : "From right";
    default:
      return "Centered";
  }
}

function aboveFloorText(opening: ComputedRectOpening): string {
  const inches = opening.floorToOpeningBottomInches;
  if (inches == null) {
    return "—";
  }
  return inches <= 0 ? "Bottom" : `+${inches}"`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="text-base font-semibold text-slate-900">{value}</p>
      {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex justify-between gap-3 py-1">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </li>
  );
}

export function RectSheetDetailView({
  result,
  meta,
  agencyStandard,
  dateText,
}: RectSheetDetailViewProps) {
  const size =
    result.insideLengthFeet != null && result.insideWidthFeet != null
      ? `${formatFeetInchesShort(result.insideLengthFeet)} x ${formatFeetInchesShort(result.insideWidthFeet)}`
      : "—";
  const outsideSize =
    result.outsideLengthFeet != null && result.outsideWidthFeet != null
      ? `${formatFeetInchesShort(result.outsideLengthFeet)} x ${formatFeetInchesShort(result.outsideWidthFeet)}`
      : "—";
  const elevations = getRectStructureElevations(result);
  // Bottom piece first, matching the printed weights block.
  const pieces = result.sections;
  const showAngle = result.openings.some(
    (opening) => opening.angleDegrees != null,
  );

  return (
    <div className="space-y-4">
      {result.errorMessage ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {result.errorMessage}
        </p>
      ) : null}
      {result.pipeErrors.length > 0 ? (
        <ul className="space-y-1 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {result.pipeErrors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      ) : null}
      {result.warnings.length > 0 ? (
        <ul className="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {result.warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Inside Size" value={size} hint={`${outsideSize} outside`} />
        <Stat
          label="Total Height"
          value={formatFeetInches(result.totalHeightFeet)}
          hint={`walls ${formatFeetInches(result.wallHeightFeet)}`}
        />
        <Stat
          label="Pieces"
          value={String(pieces.length || "—")}
          hint={
            pieces.length > 1
              ? pieces
                  .map((section) => wholeInches(section.heightFeet))
                  .join(" + ")
              : "single pour"
          }
        />
        <Stat
          label="Heaviest Pick"
          value={formatPounds(result.weights.heaviestLbs)}
        />
        <Stat
          label="Price"
          value={`$${result.totalPrice.toFixed(2)}`}
          hint={result.minPricingApplied ? "minimum height applied" : undefined}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <RectSheetPreview result={result} meta={meta} showSummary={false} />

          <SectionCard title="Sheet Info">
            <ul className="divide-y divide-slate-100 text-xs">
              <InfoRow label="Contractor" value={meta.contractor || "—"} />
              <InfoRow label="Project" value={meta.project || "—"} />
              <InfoRow label="Date" value={dateText || "—"} />
              <InfoRow
                label="Template"
                value={
                  meta.templateName
                    ? `${meta.templateName}${agencyStandard ? ` (${agencyStandard})` : ""}`
                    : "—"
                }
              />
              <InfoRow label="Casting" value={meta.castingName ?? "None"} />
              <InfoRow
                label="Wall Thickness"
                value={wholeInches(result.wallThicknessFeet)}
              />
              <InfoRow
                label="Top Slab"
                value={
                  result.hasTopSlab
                    ? `${wholeInches(result.topSlabThicknessFeet)} thick${
                        result.topSlabOpening?.lengthInches != null &&
                        result.topSlabOpening?.widthInches != null
                          ? `, ${result.topSlabOpening.lengthInches}" x ${result.topSlabOpening.widthInches}" opening`
                          : ""
                      }`
                    : "None (open top)"
                }
              />
              <InfoRow
                label="Base Slab"
                value={
                  result.hasBaseSlab
                    ? `${wholeInches(result.baseSlabThicknessFeet)} ${result.baseAttached ? "attached" : "separate"}`
                    : "None (open bottom)"
                }
              />
              <InfoRow
                label="Sump"
                value={formatFeetInchesShort(result.sumpFeet)}
              />
              <InfoRow label="Brick" value={wholeInches(result.brickFeet)} />
            </ul>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Pipe Openings" noPadding>
            {result.openings.length > 0 ? (
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeaderCellClassName}>#</th>
                    <th className={tableHeaderCellClassName}>Wall</th>
                    <th className={tableHeaderCellClassName}>Pipe</th>
                    <th className={tableHeaderCellClassName}>Opening</th>
                    <th className={tableHeaderCellClassName}>Invert</th>
                    <th className={tableHeaderCellClassName}>Above Floor</th>
                    <th className={tableHeaderCellClassName}>Placement</th>
                    {showAngle ? (
                      <th className={tableHeaderCellClassName}>Angle</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className={tableBodyClassName}>
                  {result.openings.map((opening, index) => (
                    <tr key={index} className={tableRowClassName}>
                      <td className={tableCellClassName}>
                        {opening.label?.trim() ||
                          String.fromCharCode(65 + index)}
                        {opening.isLowInvert ? (
                          <span className="ml-1 text-[10px] font-medium text-sky-700">
                            low
                          </span>
                        ) : null}
                      </td>
                      <td className={tableCellClassName}>
                        {opening.wall ? RECT_WALL_LABELS[opening.wall] : "—"}
                      </td>
                      <td className={tableCellClassName}>
                        {opening.pipeSizeInches != null
                          ? `${opening.pipeSizeInches}" ${opening.pipeMaterial}`
                          : opening.pipeMaterial || "—"}
                      </td>
                      <td className={tableCellClassName}>
                        {opening.openingWidthInches != null &&
                        opening.openingHeightInches != null
                          ? `${opening.openingWidthInches}" x ${opening.openingHeightInches}"${
                              opening.catalogWidthInches != null &&
                              opening.openingWidthInches !==
                                opening.catalogWidthInches
                                ? " (skew)"
                                : ""
                            }`
                          : "not in catalog"}
                      </td>
                      <td className={tableNumericCellClassName}>
                        {fmtElevation(opening.invertElevation)}
                      </td>
                      <td className={tableNumericCellClassName}>
                        {aboveFloorText(opening)}
                      </td>
                      <td className={tableCellClassName}>
                        {placementText(opening)}
                      </td>
                      {showAngle ? (
                        <td className={tableNumericCellClassName}>
                          {opening.angleDegrees != null
                            ? `${opening.angleDegrees}°`
                            : "—"}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-4 py-3 text-xs text-slate-500">No openings.</p>
            )}
          </SectionCard>

          <SectionCard title="Pieces & Weights" noPadding>
            <table className={tableClassName}>
              <thead>
                <tr>
                  <th className={tableHeaderCellClassName}>Piece</th>
                  <th className={tableHeaderCellClassName}>Height</th>
                  <th className={tableHeaderCellClassName}>Joint Above</th>
                  <th className={tableHeaderCellClassName}>Pick Weight</th>
                </tr>
              </thead>
              <tbody className={tableBodyClassName}>
                {pieces.map((section, index) => (
                  <tr key={index} className={tableRowClassName}>
                    <td className={tableCellClassName}>
                      {pieces.length === 1 ? "Box" : `Piece ${index + 1}`}
                      {index === 0 && pieces.length > 1 ? " (bottom)" : ""}
                      {section.includesBaseSlab ? " w/ base" : ""}
                    </td>
                    <td className={tableNumericCellClassName}>
                      {wholeInches(section.heightFeet)}
                    </td>
                    <td className={tableCellClassName}>
                      {index === pieces.length - 1
                        ? "—"
                        : section.hasTopKey
                          ? "Keyed"
                          : "Flat"}
                    </td>
                    <td className={tableNumericCellClassName}>
                      {formatPounds(section.pickWeightLbs)}
                    </td>
                  </tr>
                ))}
                {result.weights.topSlabLbs != null ? (
                  <tr className={tableRowClassName}>
                    <td className={tableCellClassName}>Top Slab</td>
                    <td className={tableNumericCellClassName}>
                      {wholeInches(result.topSlabThicknessFeet)}
                    </td>
                    <td className={tableCellClassName}>—</td>
                    <td className={tableNumericCellClassName}>
                      {formatPounds(result.weights.topSlabLbs)}
                    </td>
                  </tr>
                ) : null}
                {result.weights.baseSlabLbs != null ? (
                  <tr className={tableRowClassName}>
                    <td className={tableCellClassName}>Base Slab (separate)</td>
                    <td className={tableNumericCellClassName}>
                      {wholeInches(result.baseSlabThicknessFeet)}
                    </td>
                    <td className={tableCellClassName}>—</td>
                    <td className={tableNumericCellClassName}>
                      {formatPounds(result.weights.baseSlabLbs)}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Elevations" noPadding>
              <table className={tableClassName}>
                <tbody className={tableBodyClassName}>
                  {elevations.map((entry) => (
                    <tr key={entry.key} className={tableRowClassName}>
                      <td className={tableCellClassName}>{entry.label}</td>
                      <td className={tableNumericCellClassName}>
                        {entry.elevation.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {result.lowInvertElevation != null ? (
                    <tr className={tableRowClassName}>
                      <td className={tableCellClassName}>Lowest Invert</td>
                      <td className={tableNumericCellClassName}>
                        {result.lowInvertElevation.toFixed(2)}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </SectionCard>

            <SectionCard title="Pricing" noPadding>
              <table className={tableClassName}>
                <tbody className={tableBodyClassName}>
                  <tr className={tableRowClassName}>
                    <td className={tableCellClassName}>
                      Walls
                      {result.minPricingApplied ? " (min height)" : ""}
                    </td>
                    <td className={tableNumericCellClassName}>
                      ${result.wallPrice.toFixed(2)}
                    </td>
                  </tr>
                  {result.topSlabPrice > 0 ? (
                    <tr className={tableRowClassName}>
                      <td className={tableCellClassName}>Top Slab</td>
                      <td className={tableNumericCellClassName}>
                        ${result.topSlabPrice.toFixed(2)}
                      </td>
                    </tr>
                  ) : null}
                  {result.baseSlabPrice > 0 ? (
                    <tr className={tableRowClassName}>
                      <td className={tableCellClassName}>Base Slab</td>
                      <td className={tableNumericCellClassName}>
                        ${result.baseSlabPrice.toFixed(2)}
                      </td>
                    </tr>
                  ) : null}
                  {result.openingsPrice > 0 ? (
                    <tr className={tableRowClassName}>
                      <td className={tableCellClassName}>Openings</td>
                      <td className={tableNumericCellClassName}>
                        ${result.openingsPrice.toFixed(2)}
                      </td>
                    </tr>
                  ) : null}
                  <tr className={tableRowClassName}>
                    <td className={`${tableCellClassName} font-semibold`}>
                      Total
                    </td>
                    <td
                      className={`${tableNumericCellClassName} font-semibold`}
                    >
                      ${result.totalPrice.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
