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
const RING_VALUE_COLUMN_WIDTH = 76;

const metadataBadgeClass =
  "inline-flex items-center whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset";
const poolCountBadgeClass = `${metadataBadgeClass} bg-sky-50 text-sky-700 ring-sky-200`;
const poolDepthBadgeClass = `${metadataBadgeClass} bg-amber-50 text-amber-800 ring-amber-200`;
const diameterBadgeClass = `${metadataBadgeClass} bg-emerald-50 text-emerald-700 ring-emerald-200`;
const completedMetadataBadgeClass = `${metadataBadgeClass} bg-slate-100 text-slate-600 ring-slate-200`;

type DrainRingMatrixRowsProps = {
  groups: DrainRingDiameterGroup[];
  onQuantityChange: (
    line: QuoteLineFulfillment,
    option: DrainRingOption,
    value: string,
  ) => void;
  /** Feet per quote line already on other open (not yet shipped) tickets. */
  onOpenLoads?: Record<string, number>;
};

type DrainRingStyleTableProps = {
  diameterFeet: number | null;
  matrix: DrainRingStyleMatrix;
  separated: boolean;
  onQuantityChange: DrainRingMatrixRowsProps["onQuantityChange"];
  onOpenLoads?: Record<string, number>;
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
  onOpenLoads,
}: DrainRingStyleTableProps) {
  const matrixComplete =
    matrix.rows.length > 0 && matrix.remainingLineCount === 0;
  const matrixWidth =
    POOL_GROUP_COLUMN_WIDTH +
    FEET_LEFT_COLUMN_WIDTH +
    RING_VALUE_COLUMN_WIDTH * matrix.options.length;

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
            {matrix.options.map((matrixOption) => (
              <col
                key={matrixOption.option.productId}
                style={{ width: RING_VALUE_COLUMN_WIDTH }}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-[3] border-b-2 border-r border-slate-300 bg-slate-100 px-1.5 py-1.5 text-left"
              >
                <span
                  className={
                    matrixComplete
                      ? completedMetadataBadgeClass
                      : diameterBadgeClass
                  }
                >
                  {diameterFeet != null
                    ? `${diameterFeet}' diameter rings`
                    : "Ring diameter not set"}
                  <span className="sr-only">
                    , {formatDrainRingStyleLabel(matrix.style)} style
                  </span>
                </span>
                <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  Quoted pool group
                </span>
              </th>
              <th
                scope="col"
                className="border-b-2 border-r border-slate-300 bg-slate-100 px-1 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-600"
              >
                Feet left
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
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => {
              const completed = row.state === "completed";
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
                    <div className="flex flex-wrap items-center gap-0.5">
                      <span
                        className={
                          completed
                            ? completedMetadataBadgeClass
                            : poolCountBadgeClass
                        }
                      >
                        {quotedGroupParts.poolCountLabel}
                      </span>
                      {quotedGroupParts.depthLabel ? (
                        <span
                          className={
                            completed
                              ? completedMetadataBadgeClass
                              : poolDepthBadgeClass
                          }
                        >
                          {quotedGroupParts.depthLabel}
                        </span>
                      ) : null}
                      <span
                        className={
                          completed
                            ? completedMetadataBadgeClass
                            : diameterBadgeClass
                        }
                      >
                        {diameterLabel}
                      </span>
                      {completed ? (
                        <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                          Shipped complete
                        </span>
                      ) : overLimit ? (
                        <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-700">
                          Over remaining
                        </span>
                      ) : completesOnLoad ? (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                          Completes on this load
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500">
                      {row.line.shippedQty} of {row.line.quotedQty} LF shipped
                    </div>
                    {(onOpenLoads?.[row.line.quoteLineItemId] ?? 0) > 0 ? (
                      <div
                        className="mt-0.5 text-[10px] font-medium text-amber-700"
                        title="On open delivery tickets that have not shipped yet"
                      >
                        {Math.round(
                          (onOpenLoads?.[row.line.quoteLineItemId] ?? 0) * 100,
                        ) / 100}{" "}
                        LF on other loads
                      </div>
                    ) : null}
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
                    <span
                      className={`block text-[10px] ${
                        overLimit
                          ? "font-medium text-red-700"
                          : "text-slate-500"
                      }`}
                    >
                      {completed
                        ? "Already shipped"
                        : `${row.selectedFeet}/${row.line.remainingQty} LF`}
                    </span>
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
  onOpenLoads,
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
                  onOpenLoads={onOpenLoads}
                />
              ))}
            </section>
          </td>
        </tr>
      ))}
    </>
  );
}
