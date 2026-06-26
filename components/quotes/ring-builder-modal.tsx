"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type EditableQuoteLineItem,
  type QuoteFormProductOption,
  drainRingDiameterFeetOptions,
  formatQuoteCurrency,
  quoteInputClassName,
  quoteLineItemTypeLabels,
} from "@/components/quotes/quote-utils";
import {
  diameterSupportsSanitaryDrainRing,
  formatSanitaryDrainRingDiametersLabel,
  formatDrainRingPoolDescription,
  formatRingQuoteItemCode,
  type DrainRingStyle,
} from "@/lib/drain-ring-utils";
import {
  getOtherSubcategoriesFor,
  getRingDefaultPricePerFoot,
  getRowRingStyleOptions,
  getTopLevelRingStyleOptions,
  subcategoryMatchesList,
  type RingBuilderConfig,
} from "@/lib/ring-builder-settings";

const quoteTableInputClassName =
  "w-full min-w-[4rem] rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm";

const quoteTableQtyInputClassName =
  "w-14 min-w-0 max-w-[4rem] rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm";

const quoteTablePriceInputClassName =
  "w-24 min-w-[5rem] max-w-[6rem] rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm";

function formatRingBuilderUnitPrice(value: number | string): string {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

type HeightPoolRow = {
  id: string;
  poolHeight: string;
  poolCount: string;
  ringStyle: DrainRingStyle;
  pricePerFoot: string;
};

type OtherProductInput = {
  qty: string;
  unitPrice: string;
};

function initOtherInputs(
  products: QuoteFormProductOption[],
): Record<string, OtherProductInput> {
  const inputs: Record<string, OtherProductInput> = {};
  for (const product of products) {
    inputs[product.id] = {
      qty: "",
      unitPrice: formatRingBuilderUnitPrice(product.unitPrice),
    };
  }
  return inputs;
}

function createRowId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultHeightPoolRow(
  config: RingBuilderConfig,
  diameterFeet: number,
  topLevelStyle: DrainRingStyle,
): HeightPoolRow {
  const ringStyle = topLevelStyle === "SANITARY" ? "SANITARY" : "DRAIN";
  const defaultPrice = getRingDefaultPricePerFoot(
    config,
    diameterFeet,
    ringStyle,
  );
  return {
    id: createRowId("pool"),
    poolHeight: "20",
    poolCount: "1",
    ringStyle,
    pricePerFoot: formatRingBuilderUnitPrice(defaultPrice),
  };
}

type RingBuilderModalProps = {
  open: boolean;
  onClose: () => void;
  ringBuilderConfig: RingBuilderConfig;
  ringSlabProducts: QuoteFormProductOption[];
  lineCount: number;
  onAddItems: (items: EditableQuoteLineItem[]) => void;
  onError: (message: string) => void;
};

export function RingBuilderModal({
  open,
  onClose,
  ringBuilderConfig,
  ringSlabProducts,
  lineCount,
  onAddItems,
  onError,
}: RingBuilderModalProps) {
  const [diameter, setDiameter] = useState("10");
  const [topLevelStyle, setTopLevelStyle] = useState<DrainRingStyle>("DRAIN");
  const [heightPoolRows, setHeightPoolRows] = useState<HeightPoolRow[]>(() => [
    createDefaultHeightPoolRow(ringBuilderConfig, 10, "DRAIN"),
  ]);
  const [otherInputs, setOtherInputs] = useState<
    Record<string, OtherProductInput>
  >({});

  const diameterNumber = Number(diameter);
  const topLevelStyleOptions = getTopLevelRingStyleOptions(diameterNumber);

  const otherSubcategories = useMemo(
    () =>
      getOtherSubcategoriesFor(
        ringBuilderConfig,
        diameterNumber,
        topLevelStyle,
      ),
    [ringBuilderConfig, diameterNumber, topLevelStyle],
  );

  const otherProducts = useMemo(
    () =>
      ringSlabProducts.filter((product) =>
        subcategoryMatchesList(product.subcategory, otherSubcategories),
      ),
    [ringSlabProducts, otherSubcategories],
  );

  const otherProductKey = otherProducts.map((product) => product.id).join("\0");

  useEffect(() => {
    if (open) {
      setOtherInputs(initOtherInputs(otherProducts));
    }
  }, [open, otherProductKey, otherProducts]);

  function resetModal() {
    setDiameter("10");
    setTopLevelStyle("DRAIN");
    setHeightPoolRows([
      createDefaultHeightPoolRow(ringBuilderConfig, 10, "DRAIN"),
    ]);
    setOtherInputs({});
  }

  function handleClose() {
    resetModal();
    onClose();
  }

  function refillPoolRowPrices(
    rows: HeightPoolRow[],
    nextDiameter: number,
  ): HeightPoolRow[] {
    return rows.map((row) => ({
      ...row,
      pricePerFoot: formatRingBuilderUnitPrice(
        getRingDefaultPricePerFoot(ringBuilderConfig, nextDiameter, row.ringStyle),
      ),
    }));
  }

  function handleDiameterChange(value: string) {
    const nextDiameter = Number(value);
    setDiameter(value);

    if (
      topLevelStyle === "SANITARY" &&
      !diameterSupportsSanitaryDrainRing(nextDiameter)
    ) {
      setTopLevelStyle("DRAIN");
      setHeightPoolRows((current) =>
        refillPoolRowPrices(
          current.map((row) => ({
            ...row,
            ringStyle: row.ringStyle === "SANITARY" ? "DRAIN" : row.ringStyle,
          })),
          nextDiameter,
        ),
      );
    } else {
      setHeightPoolRows((current) =>
        refillPoolRowPrices(current, nextDiameter),
      );
    }
  }

  function handleTopLevelStyleChange(value: DrainRingStyle) {
    setTopLevelStyle(value);
    const defaultRingStyle = value === "SANITARY" ? "SANITARY" : "DRAIN";
    setHeightPoolRows((current) =>
      current.map((row) => ({
        ...row,
        ringStyle:
          row.ringStyle === "SOLID" ? "SOLID" : defaultRingStyle,
        pricePerFoot: formatRingBuilderUnitPrice(
          getRingDefaultPricePerFoot(
            ringBuilderConfig,
            diameterNumber,
            row.ringStyle === "SOLID" ? "SOLID" : defaultRingStyle,
          ),
        ),
      })),
    );
  }

  function updateHeightPoolRow(
    id: string,
    field: keyof Omit<HeightPoolRow, "id">,
    value: string,
  ) {
    setHeightPoolRows((current) =>
      current.map((row) => {
        if (row.id !== id) {
          return row;
        }
        if (field === "ringStyle") {
          const ringStyle = value as DrainRingStyle;
          return {
            ...row,
            ringStyle,
            pricePerFoot: formatRingBuilderUnitPrice(
              getRingDefaultPricePerFoot(
                ringBuilderConfig,
                diameterNumber,
                ringStyle,
              ),
            ),
          };
        }
        return { ...row, [field]: value };
      }),
    );
  }

  function updateOtherInput(
    productId: string,
    field: keyof OtherProductInput,
    value: string,
  ) {
    setOtherInputs((current) => ({
      ...current,
      [productId]: {
        qty: current[productId]?.qty ?? "",
        unitPrice: current[productId]?.unitPrice ?? "0",
        [field]: value,
      },
    }));
  }

  function handleAddToQuote() {
    if (!Number.isFinite(diameterNumber) || diameterNumber <= 0) {
      onError("Choose a pool diameter for the ring lines.");
      return;
    }

    if (
      topLevelStyle === "SANITARY" &&
      !diameterSupportsSanitaryDrainRing(diameterNumber)
    ) {
      onError(
        `Sanitary rings are only available for ${formatSanitaryDrainRingDiametersLabel()} diameters.`,
      );
      return;
    }

    const items: EditableQuoteLineItem[] = [];
    let nextLineNumber = lineCount + 1;

    for (const row of heightPoolRows) {
      const poolHeight = Number(row.poolHeight);
      const poolCount = Number(row.poolCount);
      const pricePerFoot = Number(row.pricePerFoot);

      if (!Number.isFinite(poolHeight) || poolHeight <= 0) {
        onError("Each height pool row needs a pool height greater than zero.");
        return;
      }
      if (!Number.isFinite(poolCount) || poolCount <= 0) {
        onError("Each height pool row needs a pool count greater than zero.");
        return;
      }

      if (
        row.ringStyle === "SANITARY" &&
        !diameterSupportsSanitaryDrainRing(diameterNumber)
      ) {
        onError(
          `Sanitary rings are only available for ${formatSanitaryDrainRingDiametersLabel()} diameters.`,
        );
        return;
      }

      const totalFeet = Math.round(poolHeight * poolCount * 100) / 100;
      items.push({
        id: createRowId("line"),
        lineNumber: nextLineNumber++,
        type: "STOCK_PRODUCT",
        typeLabel: "Ring",
        item: formatRingQuoteItemCode(diameterNumber, row.ringStyle),
        description: formatDrainRingPoolDescription({
          poolCount,
          poolHeight,
          diameter: diameterNumber,
          style: row.ringStyle,
        }),
        qty: String(totalFeet),
        unit: "LF",
        unitPrice: formatRingBuilderUnitPrice(pricePerFoot || 0),
        weight: "",
        yards: "",
        taxable: true,
        productId: null,
        isDrainRing: true,
        ringDiameterFeet: diameterNumber,
        poolHeightFeet: poolHeight,
        drainRingStyle: row.ringStyle,
      });
    }

    for (const product of otherProducts) {
      const input = otherInputs[product.id];
      if (!input?.qty.trim()) {
        continue;
      }
      const qty = Number(input.qty);
      if (!Number.isFinite(qty) || qty <= 0) {
        onError(`Quantity for ${product.code} must be greater than zero.`);
        return;
      }
      const unitPrice = Number(input.unitPrice);
      const resolvedUnitPrice = Number.isFinite(unitPrice)
        ? unitPrice
        : product.unitPrice;

      items.push({
        id: createRowId("line"),
        lineNumber: nextLineNumber++,
        type: "STOCK_PRODUCT",
        typeLabel: quoteLineItemTypeLabels.STOCK_PRODUCT,
        item: product.code,
        description: product.name,
        qty: input.qty,
        unit: product.unit,
        unitPrice: formatRingBuilderUnitPrice(resolvedUnitPrice),
        weight: product.weightLb > 0 ? String(product.weightLb) : "",
        yards: product.yards > 0 ? String(product.yards) : "",
        taxable: product.taxable,
        productId: product.id,
      });
    }

    if (items.length === 0) {
      onError("Add at least one height pool or enter a quantity for an Other product.");
      return;
    }

    onAddItems(items);
    handleClose();
  }

  if (!open) {
    return null;
  }

  const rowStyleOptions = getRowRingStyleOptions(topLevelStyle);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
        <h3 className="text-sm font-semibold text-slate-900">Add Rings</h3>
        <p className="mt-1 text-xs text-slate-500">
          Choose diameter and style, then add height pools and any Other
          products. Each row becomes its own quote line item.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Pool Diameter (ft)
            </label>
            <select
              value={diameter}
              onChange={(event) => handleDiameterChange(event.target.value)}
              className={quoteInputClassName}
            >
              {drainRingDiameterFeetOptions.map((option) => (
                <option key={option} value={String(option)}>
                  {option}&apos;
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Style
            </label>
            <select
              value={topLevelStyle}
              onChange={(event) =>
                handleTopLevelStyleChange(
                  event.target.value as DrainRingStyle,
                )
              }
              className={quoteInputClassName}
            >
              {topLevelStyleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-slate-900">
              Height pools
            </h4>
            <button
              type="button"
              onClick={() =>
                setHeightPoolRows((current) => [
                  ...current,
                  createDefaultHeightPoolRow(
                    ringBuilderConfig,
                    diameterNumber,
                    topLevelStyle,
                  ),
                ])
              }
              className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Add row
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-semibold">Height (ft)</th>
                  <th className="px-3 py-2 font-semibold"># Pools</th>
                  <th className="px-3 py-2 font-semibold">Style</th>
                  <th className="px-3 py-2 font-semibold">Price / ft</th>
                  <th className="px-3 py-2 font-semibold">Total LF</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {heightPoolRows.map((row) => {
                  const poolHeight = Number(row.poolHeight);
                  const poolCount = Number(row.poolCount);
                  const pricePerFoot = Number(row.pricePerFoot);
                  const totalFeet =
                    Number.isFinite(poolHeight) &&
                    Number.isFinite(poolCount) &&
                    poolHeight > 0 &&
                    poolCount > 0
                      ? Math.round(poolHeight * poolCount * 100) / 100
                      : null;
                  const lineTotal =
                    totalFeet != null ? totalFeet * (pricePerFoot || 0) : null;

                  return (
                    <tr key={row.id}>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={row.poolHeight}
                          onChange={(event) =>
                            updateHeightPoolRow(
                              row.id,
                              "poolHeight",
                              event.target.value,
                            )
                          }
                          className={quoteTableInputClassName}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.poolCount}
                          onChange={(event) =>
                            updateHeightPoolRow(
                              row.id,
                              "poolCount",
                              event.target.value,
                            )
                          }
                          className={quoteTableInputClassName}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.ringStyle}
                          onChange={(event) =>
                            updateHeightPoolRow(
                              row.id,
                              "ringStyle",
                              event.target.value,
                            )
                          }
                          className={quoteTableInputClassName}
                        >
                          {rowStyleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.pricePerFoot}
                          onChange={(event) =>
                            updateHeightPoolRow(
                              row.id,
                              "pricePerFoot",
                              event.target.value,
                            )
                          }
                          onBlur={() =>
                            updateHeightPoolRow(
                              row.id,
                              "pricePerFoot",
                              formatRingBuilderUnitPrice(row.pricePerFoot),
                            )
                          }
                          className={quoteTablePriceInputClassName}
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {totalFeet != null ? (
                          <>
                            {totalFeet} LF
                            {lineTotal != null
                              ? ` · ${formatQuoteCurrency(lineTotal)}`
                              : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {heightPoolRows.length > 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setHeightPoolRows((current) =>
                                current.filter((entry) => entry.id !== row.id),
                              )
                            }
                            className="text-[11px] font-medium text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <OtherSection
          products={otherProducts}
          otherInputs={otherInputs}
          emptyHint={
            otherSubcategories.length === 0
              ? "No Other subcategories configured for this diameter and style. Set them up in Settings → Ring Builder."
              : otherProducts.length === 0
                ? "No active products match the configured Other subcategories."
                : null
          }
          onUpdateInput={updateOtherInput}
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAddToQuote}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Add to Quote
          </button>
        </div>
      </div>
    </div>
  );
}

function OtherSection({
  products,
  otherInputs,
  emptyHint,
  onUpdateInput,
}: {
  products: QuoteFormProductOption[];
  otherInputs: Record<string, OtherProductInput>;
  emptyHint: string | null;
  onUpdateInput: (
    productId: string,
    field: keyof OtherProductInput,
    value: string,
  ) => void;
}) {
  return (
    <div className="mt-5 space-y-2">
      <h4 className="text-xs font-semibold text-slate-900">Other</h4>
      {emptyHint ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {emptyHint}
        </p>
      ) : products.length === 0 ? (
        <p className="text-xs text-slate-500">No Other products available.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-semibold">Product code</th>
                <th className="px-3 py-2 font-semibold">Product name</th>
                <th className="w-16 px-3 py-2 font-semibold">Qty</th>
                <th className="px-3 py-2 font-semibold">Unit price</th>
                <th className="px-3 py-2 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => {
                const input = otherInputs[product.id] ?? {
                  qty: "",
                  unitPrice: formatRingBuilderUnitPrice(product.unitPrice),
                };
                const qtyNum = Number(input.qty);
                const priceNum = Number(input.unitPrice);
                const lineTotal =
                  Number.isFinite(qtyNum) &&
                  qtyNum > 0 &&
                  Number.isFinite(priceNum)
                    ? qtyNum * priceNum
                    : null;

                return (
                  <tr key={product.id}>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {product.code}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{product.name}</td>
                    <td className="w-16 px-3 py-2">
                      <input
                        type="text"
                        value={input.qty}
                        onChange={(event) =>
                          onUpdateInput(product.id, "qty", event.target.value)
                        }
                        placeholder="—"
                        className={quoteTableQtyInputClassName}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={input.unitPrice}
                        onChange={(event) =>
                          onUpdateInput(
                            product.id,
                            "unitPrice",
                            event.target.value,
                          )
                        }
                        onBlur={() =>
                          onUpdateInput(
                            product.id,
                            "unitPrice",
                            formatRingBuilderUnitPrice(input.unitPrice),
                          )
                        }
                        className={quoteTablePriceInputClassName}
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {lineTotal != null
                        ? formatQuoteCurrency(lineTotal)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
