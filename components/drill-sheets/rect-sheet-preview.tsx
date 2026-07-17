"use client";

import { formatFeetInchesShort, formatFeetInches } from "@/lib/drill-sheet";
import {
  elevationOpeningRect,
  planOpeningRect,
  sectionJointHeightsFeet,
  topSlabOpeningRect,
} from "@/lib/rect-structure-diagram";
import {
  formatPounds,
  type RectStructureResult,
} from "@/lib/rect-structure";

export type RectSheetPreviewMeta = {
  structureNumber: string;
  contractor: string;
  project: string;
  templateName: string;
  castingName: string | null;
};

type RectSheetPreviewProps = {
  result: RectStructureResult;
  meta: RectSheetPreviewMeta;
  /** Hide the summary/warnings panel when the page renders its own. */
  showSummary?: boolean;
};

const STROKE = "#0f172a";
const LIGHT = "#94a3b8";
const OPENING_FILL = "#e2e8f0";

function fmtElevation(value: number | null): string {
  return value == null ? "—" : value.toFixed(2);
}

/**
 * Schematic elevation + plan + top-slab preview. Mirrors the geometry
 * helpers used by the PDF overlay so what you see is what prints.
 */
export function RectSheetPreview({
  result,
  meta,
  showSummary = true,
}: RectSheetPreviewProps) {
  const hasGeometry =
    result.wallHeightFeet > 0 &&
    result.insideLengthFeet != null &&
    result.insideWidthFeet != null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            {meta.structureNumber ? `${meta.structureNumber} — ` : ""}
            {meta.templateName || "Rectangular Structure"}
          </h3>
          <p className="text-[11px] text-slate-500">
            {result.insideLengthFeet != null && result.insideWidthFeet != null
              ? `${formatFeetInchesShort(result.insideLengthFeet)} x ${formatFeetInchesShort(result.insideWidthFeet)} inside`
              : "Enter a size"}
          </p>
        </div>

        {hasGeometry ? (
          <svg
            viewBox="0 0 700 460"
            className="mt-2 w-full"
            role="img"
            aria-label="Rectangular structure preview"
          >
            <ElevationView result={result} />
            <PlanView result={result} />
            {result.hasTopSlab ? <TopSlabView result={result} /> : null}
          </svg>
        ) : (
          <p className="mt-4 text-xs text-slate-500">
            Enter the rim elevation, size, and at least one pipe invert to see
            the preview.
          </p>
        )}
      </div>

      {showSummary ? <SummaryPanel result={result} meta={meta} /> : null}
    </div>
  );
}

/** Left ~55%: cross-section with slabs, joints, and openings. */
function ElevationView({ result }: { result: RectStructureResult }) {
  // Drawing frame for the elevation view.
  const frame = { x: 40, y: 30, width: 300, height: 400 };
  const wallBand = 22;
  const topSlabFeet = result.topSlabThicknessFeet;
  const baseSlabFeet = result.baseSlabThicknessFeet;
  const wallFeet = result.wallHeightFeet;
  const totalFeet = Math.max(wallFeet + topSlabFeet + baseSlabFeet, 0.001);

  const yOf = (feetFromTop: number) =>
    frame.y + (feetFromTop / totalFeet) * frame.height;

  const topSlabBottomY = yOf(topSlabFeet);
  const floorY = yOf(topSlabFeet + wallFeet);
  const bottomY = frame.y + frame.height;
  const cavityLeft = frame.x + wallBand;
  const cavityRight = frame.x + frame.width - wallBand;

  const joints = sectionJointHeightsFeet(result);

  return (
    <g>
      {/* Outer shell */}
      <rect
        x={frame.x}
        y={frame.y}
        width={frame.width}
        height={frame.height}
        fill="none"
        stroke={STROKE}
        strokeWidth={1.5}
      />
      {/* Top slab band */}
      {result.hasTopSlab ? (
        <line
          x1={frame.x}
          y1={topSlabBottomY}
          x2={frame.x + frame.width}
          y2={topSlabBottomY}
          stroke={STROKE}
          strokeWidth={1}
        />
      ) : null}
      {/* Base slab band / open bottom */}
      {result.hasBaseSlab ? (
        <line
          x1={frame.x}
          y1={floorY}
          x2={frame.x + frame.width}
          y2={floorY}
          stroke={STROKE}
          strokeWidth={1}
        />
      ) : (
        <line
          x1={cavityLeft}
          y1={floorY}
          x2={cavityRight}
          y2={floorY}
          stroke={LIGHT}
          strokeWidth={1}
          strokeDasharray="6 4"
        />
      )}
      {/* Wall inner faces */}
      <line
        x1={cavityLeft}
        y1={result.hasTopSlab ? topSlabBottomY : frame.y}
        x2={cavityLeft}
        y2={result.hasBaseSlab ? floorY : bottomY}
        stroke={STROKE}
        strokeWidth={1}
      />
      <line
        x1={cavityRight}
        y1={result.hasTopSlab ? topSlabBottomY : frame.y}
        x2={cavityRight}
        y2={result.hasBaseSlab ? floorY : bottomY}
        stroke={STROKE}
        strokeWidth={1}
      />

      {/* Section joints (through the wall bands) */}
      {joints.map((joint, index) => {
        const y = floorY - (joint.heightFromFloorFeet / totalFeet) * frame.height;
        return (
          <g key={index}>
            <line
              x1={frame.x}
              y1={y}
              x2={cavityLeft}
              y2={y}
              stroke={STROKE}
              strokeWidth={1}
            />
            <line
              x1={cavityRight}
              y1={y}
              x2={frame.x + frame.width}
              y2={y}
              stroke={STROKE}
              strokeWidth={1}
            />
            {joint.keyed ? (
              <>
                <rect
                  x={frame.x + 4}
                  y={y - 3}
                  width={wallBand - 8}
                  height={6}
                  fill="none"
                  stroke={LIGHT}
                  strokeWidth={0.8}
                />
                <rect
                  x={cavityRight + 4}
                  y={y - 3}
                  width={wallBand - 8}
                  height={6}
                  fill="none"
                  stroke={LIGHT}
                  strokeWidth={0.8}
                />
              </>
            ) : null}
            <text
              x={frame.x + frame.width + 6}
              y={y + 3}
              fontSize={10}
              fill={STROKE}
            >
              {joint.keyed ? "keyed joint" : "joint"}
            </text>
          </g>
        );
      })}

      {/* Openings projected onto the cavity */}
      {result.openings.map((opening, index) => {
        const rect = elevationOpeningRect(opening, result);
        if (!rect) {
          return null;
        }
        const cavityWidth = cavityRight - cavityLeft;
        const wallSpan = floorY - (result.hasTopSlab ? topSlabBottomY : frame.y);
        const yTop =
          (result.hasTopSlab ? topSlabBottomY : frame.y) + rect.y * wallSpan;
        const ox = cavityLeft + rect.x * cavityWidth;
        const ow = Math.max(rect.width * cavityWidth, 6);
        const oh = Math.max(rect.height * wallSpan, 6);
        return (
          <g key={index}>
            <rect
              x={ox}
              y={yTop}
              width={ow}
              height={oh}
              fill={OPENING_FILL}
              stroke={STROKE}
              strokeWidth={1}
            />
            <line x1={ox} y1={yTop} x2={ox + ow} y2={yTop + oh} stroke={STROKE} strokeWidth={0.8} />
            <line x1={ox} y1={yTop + oh} x2={ox + ow} y2={yTop} stroke={STROKE} strokeWidth={0.8} />
            <text
              x={ox + ow / 2}
              y={yTop - 3}
              fontSize={10}
              textAnchor="middle"
              fill={STROKE}
            >
              {opening.label || String.fromCharCode(65 + index)}
              {opening.wall ? ` (${opening.wall})` : ""}
            </text>
          </g>
        );
      })}

      {/* Elevation callouts */}
      <text x={frame.x} y={frame.y - 12} fontSize={10} fill={STROKE}>
        Rim {fmtElevation(result.rimElevation)} · Casting{" "}
        {formatFeetInchesShort(result.castingHeightFeet)} · Brick{" "}
        {formatFeetInchesShort(result.brickFeet)}
      </text>
      <text x={frame.x} y={bottomY + 16} fontSize={10} fill={STROKE}>
        Floor {fmtElevation(result.floorElevation)} · Sump{" "}
        {formatFeetInchesShort(result.sumpFeet)} · Wall{" "}
        {formatFeetInches(result.wallHeightFeet)}
      </text>
    </g>
  );
}

/** Right top: plan view with wall letters and openings. */
function PlanView({ result }: { result: RectStructureResult }) {
  if (result.insideLengthFeet == null || result.insideWidthFeet == null) {
    return null;
  }
  // Fit the inside rectangle into the plan frame preserving aspect.
  const frame = { x: 420, y: 40, width: 220, height: 170 };
  const aspect = result.insideLengthFeet / result.insideWidthFeet;
  let width = frame.width;
  let height = width / aspect;
  if (height > frame.height) {
    height = frame.height;
    width = height * aspect;
  }
  const x = frame.x + (frame.width - width) / 2;
  const y = frame.y + (frame.height - height) / 2;
  const band = 10;

  return (
    <g>
      <text
        x={frame.x + frame.width / 2}
        y={frame.y - 10}
        fontSize={10}
        textAnchor="middle"
        fill={LIGHT}
      >
        PLAN
      </text>
      {/* Outside + inside faces */}
      <rect
        x={x - band}
        y={y - band}
        width={width + 2 * band}
        height={height + 2 * band}
        fill="none"
        stroke={STROKE}
        strokeWidth={1.2}
      />
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke={STROKE}
        strokeWidth={1}
      />
      {/* Wall directions */}
      <text x={x + width / 2} y={y - band - 4} fontSize={8} textAnchor="middle" fill={STROKE}>
        UP
      </text>
      <text x={x + width + band + 6} y={y + height / 2 + 3} fontSize={8} fill={STROKE}>
        RIGHT
      </text>
      <text x={x + width / 2} y={y + height + band + 12} fontSize={8} textAnchor="middle" fill={STROKE}>
        DOWN
      </text>
      <text x={x - band - 6} y={y + height / 2 + 3} fontSize={8} textAnchor="end" fill={STROKE}>
        LEFT
      </text>
      {/* Openings on their walls */}
      {result.openings.map((opening, index) => {
        const rect = planOpeningRect(opening, result, band / Math.min(width, height));
        if (!rect) {
          return null;
        }
        return (
          <rect
            key={index}
            x={x + rect.x * width}
            y={y + rect.y * height}
            width={Math.max(rect.width * width, 4)}
            height={Math.max(rect.height * height, 4)}
            fill={OPENING_FILL}
            stroke={STROKE}
            strokeWidth={1}
          />
        );
      })}
      <text
        x={x + width / 2}
        y={y + height / 2 + 3}
        fontSize={10}
        textAnchor="middle"
        fill={LIGHT}
      >
        {formatFeetInchesShort(result.insideLengthFeet)} x{" "}
        {formatFeetInchesShort(result.insideWidthFeet)}
      </text>
    </g>
  );
}

/** Right bottom: top slab detail box with its opening. */
function TopSlabView({ result }: { result: RectStructureResult }) {
  if (result.outsideLengthFeet == null || result.outsideWidthFeet == null) {
    return null;
  }
  const frame = { x: 420, y: 260, width: 220, height: 170 };
  const aspect = result.outsideLengthFeet / result.outsideWidthFeet;
  let width = frame.width;
  let height = width / aspect;
  if (height > frame.height) {
    height = frame.height;
    width = height * aspect;
  }
  const x = frame.x + (frame.width - width) / 2;
  const y = frame.y + (frame.height - height) / 2;
  const opening = topSlabOpeningRect(result);

  return (
    <g>
      <text
        x={frame.x + frame.width / 2}
        y={frame.y - 6}
        fontSize={10}
        textAnchor="middle"
        fill={LIGHT}
      >
        TOP SLAB ({formatFeetInchesShort(result.outsideLengthFeet)} x{" "}
        {formatFeetInchesShort(result.outsideWidthFeet)})
      </text>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke={STROKE}
        strokeWidth={1.2}
      />
      {opening ? (
        <>
          <rect
            x={x + opening.x * width}
            y={y + opening.y * height}
            width={opening.width * width}
            height={opening.height * height}
            fill={OPENING_FILL}
            stroke={STROKE}
            strokeWidth={1}
          />
          <line
            x1={x + opening.x * width}
            y1={y + opening.y * height}
            x2={x + (opening.x + opening.width) * width}
            y2={y + (opening.y + opening.height) * height}
            stroke={STROKE}
            strokeWidth={0.8}
          />
          <line
            x1={x + opening.x * width}
            y1={y + (opening.y + opening.height) * height}
            x2={x + (opening.x + opening.width) * width}
            y2={y + opening.y * height}
            stroke={STROKE}
            strokeWidth={0.8}
          />
          <text
            x={x + (opening.x + opening.width / 2) * width}
            y={y + (opening.y + opening.height / 2) * height + 3}
            fontSize={9}
            textAnchor="middle"
            fill={STROKE}
          >
            {result.topSlabOpening?.lengthInches ?? "—"}&quot; x{" "}
            {result.topSlabOpening?.widthInches ?? "—"}&quot;
          </text>
        </>
      ) : (
        <text
          x={x + width / 2}
          y={y + height / 2 + 3}
          fontSize={9}
          textAnchor="middle"
          fill={LIGHT}
        >
          Enter the opening size
        </text>
      )}
    </g>
  );
}

function SummaryPanel({
  result,
  meta,
}: {
  result: RectStructureResult;
  meta: RectSheetPreviewMeta;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
      <div className="grid gap-2 sm:grid-cols-2">
        <p>
          <span className="font-semibold">Total height:</span>{" "}
          {formatFeetInches(result.totalHeightFeet)}
        </p>
        <p>
          <span className="font-semibold">Wall height:</span>{" "}
          {formatFeetInches(result.wallHeightFeet)} in{" "}
          {result.sections.length || "—"} section
          {result.sections.length === 1 ? "" : "s"}
        </p>
        <p>
          <span className="font-semibold">Heaviest pick:</span>{" "}
          {formatPounds(result.weights.heaviestLbs)}
        </p>
        <p>
          <span className="font-semibold">Price:</span> $
          {result.totalPrice.toFixed(2)}
          {result.minPricingApplied ? " (minimum height applied)" : ""}
          <span className="block text-[11px] text-slate-500">
            walls ${result.wallPrice.toFixed(2)}
            {result.topSlabPrice > 0
              ? ` + top slab $${result.topSlabPrice.toFixed(2)}`
              : ""}
            {result.baseSlabPrice > 0
              ? ` + base $${result.baseSlabPrice.toFixed(2)}`
              : ""}
            {result.openingsPrice > 0
              ? ` + openings $${result.openingsPrice.toFixed(2)}`
              : ""}
          </span>
        </p>
        {meta.castingName ? (
          <p>
            <span className="font-semibold">Casting:</span> {meta.castingName}
          </p>
        ) : null}
        {result.weights.topSlabLbs != null ? (
          <p>
            <span className="font-semibold">Top slab pick:</span>{" "}
            {formatPounds(result.weights.topSlabLbs)}
          </p>
        ) : null}
        {result.weights.baseSlabLbs != null ? (
          <p>
            <span className="font-semibold">Base slab pick:</span>{" "}
            {formatPounds(result.weights.baseSlabLbs)}
          </p>
        ) : null}
      </div>

      {result.errorMessage ? (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 font-medium text-rose-700">
          {result.errorMessage}
        </p>
      ) : null}
      {result.pipeErrors.length > 0 ? (
        <ul className="mt-3 space-y-1 rounded-lg bg-rose-50 px-3 py-2 font-medium text-rose-700">
          {result.pipeErrors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      ) : null}
      {result.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
          {result.warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
