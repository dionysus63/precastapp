import type {
  DrainRingOption,
  QuoteLineFulfillment,
} from "@/lib/delivery-fulfillment";
import { formatDrainRingStyleLabel } from "@/lib/drain-ring-utils";
import type {
  DrainRingDiameterGroup,
  DrainRingMatrixOption,
  DrainRingStyleMatrix,
} from "@/components/delivery-tickets/drain-ring-matrix-utils";
import { getDrainRingQuotedGroupParts } from "@/components/delivery-tickets/drain-ring-matrix-utils";

const ringQuantityInputClass =
  "h-8 w-full rounded-md border border-slate-400 bg-white px-1.5 text-right text-xs font-semibold text-slate-900 shadow-sm outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";

const POOL_GROUP_COLUMN_WIDTH = 220;
const FEET_LEFT_COLUMN_WIDTH = 72;
const FEET_ON_LOAD_COLUMN_WIDTH = 72;
const RING_VALUE_COLUMN_WIDTH = 76;
/** Trailing read-only stats: Feet Scheduled / Feet Shipped / Feet Awarded. */
const FEET_STAT_COLUMN_WIDTH = 72;
const FEET_STAT_COLUMNS = ["Feet scheduled", "Feet shipped", "Feet awarded"] as const;


type DrainRingMatrixRowsProps = {
  groups: DrainRingDiameterGroup[];
  onQuantityChange: (
    line: QuoteLineFulfillment,
    option: DrainRingOption,
    value: string,
  ) => void;
};

type DrainRingStyleTableProps = {
  diameterFeet: number | null;
  matrix: DrainRingStyleMatrix;
  separated: boolean;
  onQuantityChange: DrainRingMatrixRowsProps["onQuantityChange"];
};

function ringStockLabel(matrixOption: DrainRingMatrixOption): string {
  const { option, shortageCount, stockStatus } = matrixOption;
  if (stockStatus === "not_tracked") {
    return "Not tracked";
  }
  if (stockStatus === "unknown") {
    return "Stock unknown";
  }
  if (stockStatus === "short") {
    return `${option.currentStock ?? 0} on hand / short ${shortageCount}`;
  }
  return `${option.currentStock ?? 0} on hand`;
}

function ringStockClassName(matrixOption: DrainRingMatrixOption): string {
  if (
    matrixOption.stockStatus === "short" ||
    matrixOption.stockStatus === "out_of_stock"
  ) {
    return "text-red-700";
  }
  if (
    matrixOption.option.currentStock != null &&
    matrixOption.option.currentStock > 0 &&
    matrixOption.option.currentStock <= 3
  ) {
    return "text-amber-700";
  }
  return "text-slate-600";
}

function DrainRingStyleTable({
  diameterFeet,
  matrix,
  separated,
  onQuantityChange,
}: DrainRingStyleTableProps) {
  const matrixComplete =
    matrix.rows.length > 0 && matrix.remainingLineCount === 0;
  const matrixWidth =
    POOL_GROUP_COLUMN_WIDTH +
    FEET_LEFT_COLUMN_WIDTH +
    FEET_ON_LOAD_COLUMN_WIDTH +
    RING_VALUE_COLUMN_WIDTH * matrix.options.length +
    FEET_STAT_COLUMN_WIDTH * FEET_STAT_COLUMNS.length;

  return (
    <div className={separated ? "border-t border-slate-300" : undefined}>
      <div
        role="region"
        aria-label={`${diameterFeet ?? "Unknown diameter"} foot ${formatDrainRingStyleLabel(
          matrix.style,
        ).toLowerCase()} ring quantity matrix`}
        tabIndex={0}
        className="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-500"
      >
        <table
          className="table-fixed border-separate border-spacing-0 text-xs"
          style={{ width: matrixWidth, minWidth: matrixWidth }}
        >
          <caption className="sr-only">
            {diameterFeet ?? "Unknown diameter"} foot{" "}
            {formatDrainRingStyleLabel(matrix.style).toLowerCase()} ring
            quantities by quoted pool group
          </caption>
          <colgroup>
            <col style={{ width: POOL_GROUP_COLUMN_WIDTH }} />
            <col style={{ width: FEET_LEFT_COLUMN_WIDTH }} />
            <col style={{ width: FEET_ON_LOAD_COLUMN_WIDTH }} />
            {matrix.options.map((matrixOption) => (
              <col
                key={matrixOption.option.productId}
                style={{ width: RING_VALUE_COLUMN_WIDTH }}
              />
            ))}
            {FEET_STAT_COLUMNS.map((label) => (
              <col key={label} style={{ width: FEET_STAT_COLUMN_WIDTH }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-[3] border-b-2 border-r border-slate-300 bg-slate-100 px-1.5 py-1.5 text-left"
              >
                <span
                  className={`block text-sm font-bold ${
                    matrixComplete ? "text-slate-500" : "text-slate-900"
                  }`}
                >
                  {diameterFeet != null
                    ? `${diameterFeet}'Ø ${formatDrainRingStyleLabel(matrix.style)} Rings`
                    : `${formatDrainRingStyleLabel(matrix.style)} Rings — diameter not set`}
                </span>
              </th>
              <th
                scope="col"
                className="border-b-2 border-r border-slate-300 bg-slate-100 px-1 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-600"
              >
                Feet left
              </th>
              <th
                scope="col"
                className="border-b-2 border-r border-slate-300 bg-slate-100 px-1 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-600"
              >
                Feet on load
              </th>
              {matrix.options.map((matrixOption) => (
                <th
                  key={matrixOption.option.productId}
                  scope="col"
                  className="border-b-2 border-r border-slate-300 bg-slate-100 px-1 py-1 text-center last:border-r-0"
                >
                  <span className="block font-semibold text-slate-800">
                    {matrixOption.option.heightFeet}&apos; ring
                  </span>
                  <span
                    className={`block text-[10px] font-medium ${ringStockClassName(
                      matrixOption,
                    )}`}
                  >
                    {ringStockLabel(matrixOption)}
                  </span>
                </th>
              ))}
              {FEET_STAT_COLUMNS.map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="border-b-2 border-r border-slate-300 bg-slate-100 px-1 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-600 last:border-r-0"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => {
              const completed = row.state === "completed";
              const fullyScheduled = row.state === "scheduled";
              const overLimit = row.overByFeet > 0;
              const completesOnLoad =
                !completed &&
                !overLimit &&
                row.selectedFeet > 0 &&
                row.remainingAfterSelected <= 0.001;
              const feetLeft = Math.max(0, row.remainingAfterSelected);
              const quotedGroupParts = getDrainRingQuotedGroupParts(
                row.line.displayName,
              );
              const diameterLabel =
                row.line.ringDiameterFeet != null
                  ? `${row.line.ringDiameterFeet}' diameter`
                  : "Diameter not set";
              const rowSurface = completed
                ? "bg-slate-100/90 text-slate-500"
                : "bg-white";

              return (
                <tr
                  key={row.line.quoteLineItemId}
                  className={`${rowSurface} ${
                    completed ? "" : "hover:bg-slate-50/70"
                  }`}
                >
                  <th
                    scope="row"
                    className={`sticky left-0 z-[2] border-b border-r border-slate-300 px-2 py-2 text-left align-top ${rowSurface}`}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
                      <span
                        className={`text-xs font-semibold ${
                          completed ? "text-slate-500" : "text-slate-900"
                        }`}
                      >
                        {quotedGroupParts.poolCountLabel}
                      </span>
                      {quotedGroupParts.depthLabel ? (
                        <span
                          className={`text-xs ${
                            completed ? "text-slate-400" : "text-slate-600"
                          }`}
                        >
                          {quotedGroupParts.depthLabel}
                        </span>
                      ) : null}
                      {completed ? (
                        <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                          Shipped complete
                        </span>
                      ) : overLimit ? (
                        <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-700">
                          Over remaining
                        </span>
                      ) : fullyScheduled ? (
                        <span
                          className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600"
                          title="Every remaining foot is already on another open load"
                        >
                          Fully scheduled
                        </span>
                      ) : completesOnLoad ? (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                          Completes on this load
                        </span>
                      ) : null}
                    </div>
                    {!completed &&
                    !row.line.eligible &&
                    row.line.eligibilityReason ? (
                      <div className="mt-1 text-[10px] font-medium text-amber-700">
                        {row.line.eligibilityReason}
                      </div>
                    ) : null}
                  </th>
                  <td className="border-b border-r border-slate-300 px-1.5 py-2 text-right align-top tabular-nums">
                    <span
                      className={`block font-semibold ${
                        overLimit
                          ? "text-red-700"
                          : completed
                            ? "text-slate-500"
                            : "text-slate-900"
                      }`}
                    >
                      {feetLeft} LF
                    </span>
                    {overLimit ? (
                      <span className="block text-[10px] font-medium text-red-700">
                        Over by {row.overByFeet} LF
                      </span>
                    ) : null}
                  </td>
                  <td
                    className={`border-b border-r border-slate-300 px-1.5 py-2 text-right align-top tabular-nums ${
                      row.selectedFeet > 0
                        ? "font-semibold text-slate-900"
                        : "text-slate-500"
                    }`}
                  >
                    {row.selectedFeet} LF
                  </td>
                  {matrix.options.map((matrixOption) => {
                    const option = matrixOption.option;
                    const availableOption = row.line.drainRingOptions.find(
                      (candidate) => candidate.productId === option.productId,
                    );
                    const quantity =
                      row.quantitiesByProductId[option.productId];
                    const inputId = `ring-${row.line.quoteLineItemId}-${option.productId}`;

                    return (
                      <td
                        key={option.productId}
                        className="border-b border-r border-slate-300 px-1 py-1.5 text-center last:border-r-0"
                      >
                        {availableOption ? (
                          <>
                            <label htmlFor={inputId} className="sr-only">
                              {quotedGroupParts.fullLabel}, {diameterLabel},{" "}
                              {option.heightFeet} foot ring quantity on load
                            </label>
                            <input
                              id={inputId}
                              type="number"
                              inputMode="numeric"
                              min="0"
                              step="1"
                              disabled={completed || !row.line.eligible}
                              value={quantity?.raw ?? ""}
                              placeholder="0"
                              className={ringQuantityInputClass}
                              onChange={(event) =>
                                onQuantityChange(
                                  row.line,
                                  availableOption,
                                  event.target.value,
                                )
                              }
                            />
                          </>
                        ) : (
                          <span
                            aria-label="Not available for this quote line"
                            className="text-slate-300"
                          >
                            &mdash;
                          </span>
                        )}
                      </td>
                    );
                  })}
                  {[
                    row.scheduledElsewhereFeet,
                    row.line.shippedQty,
                    row.line.quotedQty,
                  ].map((value, index) => (
                    <td
                      key={FEET_STAT_COLUMNS[index]}
                      className="border-b border-r border-slate-300 px-1.5 py-2 text-right align-top tabular-nums text-slate-600 last:border-r-0"
                    >
                      {Math.round(value * 100) / 100}
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr
              className={
                matrixComplete
                  ? "bg-slate-100 text-slate-500"
                  : "bg-slate-50 text-slate-700"
              }
            >
              <th
                scope="row"
                className={`sticky left-0 z-[2] border-r border-slate-300 px-2 py-1.5 text-left font-semibold ${
                  matrixComplete ? "bg-slate-100" : "bg-slate-50"
                }`}
              >
                Selected for this load
              </th>
              <td className="border-r border-slate-300 px-1.5 py-1.5" />
              <td className="border-r border-slate-300 px-1.5 py-1.5 text-right font-semibold tabular-nums">
                {matrix.selectedFeet} LF
              </td>
              {matrix.options.map((matrixOption) => (
                <td
                  key={matrixOption.option.productId}
                  className={`border-r border-slate-300 px-1.5 py-1.5 text-center font-semibold tabular-nums last:border-r-0 ${
                    matrixOption.stockStatus === "short" ? "text-red-700" : ""
                  }`}
                >
                  {matrixOption.selectedCount}
                </td>
              ))}
              {FEET_STAT_COLUMNS.map((label) => (
                <td
                  key={label}
                  className="border-r border-slate-300 px-1.5 py-1.5 last:border-r-0"
                />
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DrainRingMatrixRows({
  groups,
  onQuantityChange,
}: DrainRingMatrixRowsProps) {
  return (
    <>
      {groups.map((group) => (
        <tr key={group.key}>
          <td
            colSpan={8}
            className="border-b border-slate-300 p-0 align-top"
          >
            <section
              aria-label={
                group.diameterFeet != null
                  ? `${group.diameterFeet} foot diameter ring tables`
                  : "Ring tables with diameter not set"
              }
            >
              {group.matrices.map((matrix, matrixIndex) => (
                <DrainRingStyleTable
                  key={matrix.key}
                  diameterFeet={group.diameterFeet}
                  matrix={matrix}
                  separated={matrixIndex > 0}
                  onQuantityChange={onQuantityChange}
                />
              ))}
            </section>
          </td>
        </tr>
      ))}
    </>
  );
}
