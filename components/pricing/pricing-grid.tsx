"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { saveListPrices } from "@/app/pricing/actions";
import { isActionError } from "@/lib/action-result";
import { formatUsd } from "@/lib/format";
import {
  formatDiscountPercent,
  hasAnyDiscount,
  priceAfterDiscount,
  type DiscountRates,
} from "@/lib/pricing/discount-groups";
import { parsePriceInput, splitPastedColumn } from "@/lib/pricing/price-input";
import type { PricingProductRow } from "@/lib/pricing/pricing-data";
import { selectedClassName, selectedMutedTextClassName } from "@/lib/selected-styles";
import {
  tableBodyClassName,
  tableCellClassName,
  tableCompactClassName,
  tableFlushWrapperClassName,
  tableGridCellClassName,
  tableHeaderCellClassName,
  tableHeaderCellWrapClassName,
  tableRowClassName,
} from "@/lib/table-styles";

type CellStatus =
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

type PricingGridProps = {
  priceListId: string;
  rows: PricingProductRow[];
  /** The group's standard discount; drives the two worked-out columns. */
  rates: DiscountRates;
  /** Header of the price column ("List Price", "List Price per Foot"). */
  priceLabel: string;
  canEdit: boolean;
};

const chipBaseClassName = "rounded-full border px-2.5 py-1 text-2xs font-medium";
const chipIdleClassName = "border-slate-200 bg-white text-slate-600 hover:bg-slate-50";

const priceInputClassName =
  "block w-28 min-w-0 border-0 bg-transparent px-2 py-1.5 text-xs tabular-nums text-slate-900 placeholder:text-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500";

/** How long a cell says "Saved" before it goes quiet again. */
const SAVED_NOTE_MS = 2500;

/**
 * One group's price sheet: type a list price, the delivered and picked-up
 * prices are worked out from the group's discount. A price saves when you
 * leave its cell; a column copied from Excel pastes down from the cell you
 * are in.
 */
export function PricingGrid({
  priceListId,
  rows,
  rates,
  priceLabel,
  canEdit,
}: PricingGridProps) {
  /** What each price box shows, as typed. */
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.id, row.listPrice ?? ""])),
  );
  /** What the database holds for each product ("1450.00"), null = no price. */
  const [saved, setSaved] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(rows.map((row) => [row.id, row.listPrice])),
  );
  const [status, setStatus] = useState<Record<string, CellStatus>>({});
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [unpricedOnly, setUnpricedOnly] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);

  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const savedNoteTimers = useRef(new Map<string, number>());

  const showDiscountColumns = hasAnyDiscount(rates);

  const categories = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; count: number }>();
    for (const row of rows) {
      const entry = byId.get(row.categoryId);
      if (entry) {
        entry.count += 1;
      } else {
        byId.set(row.categoryId, { id: row.categoryId, name: row.categoryName, count: 1 });
      }
    }
    return [...byId.values()];
  }, [rows]);

  const unpricedCount = rows.filter((row) => saved[row.id] == null).length;

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (categoryId && row.categoryId !== categoryId) {
        return false;
      }
      if (unpricedOnly && saved[row.id] != null) {
        return false;
      }
      if (
        term &&
        !row.productCode.toLowerCase().includes(term) &&
        !row.name.toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
    // `saved` is left out on purpose while "No price" is on: a row must not
    // vanish from under the cursor the moment its price is saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, categoryId, unpricedOnly]);

  function noteSaved(productIds: string[]) {
    setStatus((current) => {
      const next = { ...current };
      for (const id of productIds) {
        next[id] = { kind: "saved" };
      }
      return next;
    });
    for (const id of productIds) {
      const previous = savedNoteTimers.current.get(id);
      if (previous) {
        window.clearTimeout(previous);
      }
      savedNoteTimers.current.set(
        id,
        window.setTimeout(() => {
          savedNoteTimers.current.delete(id);
          setStatus((current) => {
            if (current[id]?.kind !== "saved") {
              return current;
            }
            const next = { ...current };
            delete next[id];
            return next;
          });
        }, SAVED_NOTE_MS),
      );
    }
  }

  function setCellError(productId: string, message: string) {
    setStatus((current) => ({ ...current, [productId]: { kind: "error", message } }));
  }

  async function commitCell(productId: string) {
    const typed = drafts[productId] ?? "";
    const parsed = parsePriceInput(typed);
    if (!parsed.ok) {
      setCellError(productId, parsed.error);
      return;
    }
    if (parsed.value === (saved[productId] ?? null)) {
      // Nothing to save; tidy "1450" into "1450.00" and clear an old error.
      setDrafts((current) => ({ ...current, [productId]: parsed.value ?? "" }));
      setStatus((current) => {
        if (current[productId]?.kind !== "error") {
          return current;
        }
        const next = { ...current };
        delete next[productId];
        return next;
      });
      return;
    }

    setStatus((current) => ({ ...current, [productId]: { kind: "saving" } }));
    let result: Awaited<ReturnType<typeof saveListPrices>>;
    try {
      result = await saveListPrices(priceListId, [{ productId, price: parsed.value }]);
    } catch {
      setCellError(productId, "Could not reach the server. The price was not saved.");
      return;
    }
    if (isActionError(result)) {
      setCellError(productId, result.error);
      return;
    }
    const stored = result.saved[0]?.price ?? null;
    setSaved((current) => ({ ...current, [productId]: stored }));
    // Keep what is in the box if the person has already typed something new.
    setDrafts((current) =>
      current[productId] === typed ? { ...current, [productId]: stored ?? "" } : current,
    );
    noteSaved([productId]);
  }

  function focusNeighbour(productId: string, step: 1 | -1) {
    const index = visibleRows.findIndex((row) => row.id === productId);
    const neighbour = visibleRows[index + step];
    if (!neighbour) {
      return;
    }
    const input = inputRefs.current.get(neighbour.id);
    input?.focus();
    input?.select();
  }

  async function pasteColumn(startProductId: string, text: string) {
    setPasteError(null);
    const pasted = splitPastedColumn(text);
    const startIndex = visibleRows.findIndex((row) => row.id === startProductId);
    const targets = visibleRows.slice(startIndex, startIndex + pasted.length);
    if (pasted.length > targets.length) {
      setPasteError(
        `You copied ${pasted.length} rows, but only ${targets.length} ${
          targets.length === 1 ? "row is" : "rows are"
        } left from the cell you pasted into. Nothing was pasted.`,
      );
      return;
    }

    const entries: Array<{ productId: string; price: string }> = [];
    for (let index = 0; index < pasted.length; index += 1) {
      const parsed = parsePriceInput(pasted[index]);
      if (!parsed.ok) {
        setPasteError(
          `Row ${index + 1} of what you copied is not a price: "${pasted[index]}". Nothing was pasted.`,
        );
        return;
      }
      // A blank row in the copied column leaves that product's price alone.
      if (parsed.value == null) {
        continue;
      }
      if (parsed.value !== (saved[targets[index].id] ?? null)) {
        entries.push({ productId: targets[index].id, price: parsed.value });
      }
    }
    if (entries.length === 0) {
      toast.success("Those prices are already on the list.");
      return;
    }

    const ids = entries.map((entry) => entry.productId);
    setDrafts((current) => ({
      ...current,
      ...Object.fromEntries(entries.map((entry) => [entry.productId, entry.price])),
    }));
    setStatus((current) => ({
      ...current,
      ...Object.fromEntries(ids.map((id) => [id, { kind: "saving" } as CellStatus])),
    }));

    let result: Awaited<ReturnType<typeof saveListPrices>>;
    try {
      result = await saveListPrices(priceListId, entries);
    } catch {
      result = { error: "Could not reach the server. Nothing was pasted." };
    }
    if (isActionError(result)) {
      // All or nothing on the server: put the boxes back as they were.
      setDrafts((current) => ({
        ...current,
        ...Object.fromEntries(ids.map((id) => [id, saved[id] ?? ""])),
      }));
      setStatus((current) => {
        const next = { ...current };
        for (const id of ids) {
          delete next[id];
        }
        return next;
      });
      setPasteError(result.error);
      return;
    }
    setSaved((current) => ({
      ...current,
      ...Object.fromEntries(result.saved.map((entry) => [entry.productId, entry.price])),
    }));
    noteSaved(ids);
    toast.success(`${ids.length} price${ids.length === 1 ? "" : "s"} pasted and saved.`);
  }

  // The row handlers below never change identity (rows are memoized on
  // them), so they reach the latest state and functions through this ref.
  const latest = useRef({ saved, commitCell, focusNeighbour, pasteColumn });
  useEffect(() => {
    latest.current = { saved, commitCell, focusNeighbour, pasteColumn };
  });

  const registerInput = useCallback((productId: string, element: HTMLInputElement | null) => {
    if (element) {
      inputRefs.current.set(productId, element);
    } else {
      inputRefs.current.delete(productId);
    }
  }, []);
  const changeDraft = useCallback((productId: string, value: string) => {
    setDrafts((current) => ({ ...current, [productId]: value }));
  }, []);
  const handlers = useMemo<RowHandlers>(
    () => ({
      registerInput,
      changeDraft,
      commit: (productId) => void latest.current.commitCell(productId),
      move: (productId, step) => latest.current.focusNeighbour(productId, step),
      revert: (productId) =>
        setDrafts((current) => ({
          ...current,
          [productId]: latest.current.saved[productId] ?? "",
        })),
      pasteColumn: (productId, text) => void latest.current.pasteColumn(productId, text),
    }),
    [registerInput, changeDraft],
  );

  if (rows.length === 0) {
    return (
      <p className="py-6 text-sm text-slate-500">
        No active products in this group yet.
      </p>
    );
  }

  const columnCount = showDiscountColumns ? 7 : 5;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search code or description"
          aria-label="Search this price sheet"
          className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400"
        />
        <p className="text-xs text-slate-600" data-discount-rule>
          {showDiscountColumns
            ? `Standard discount: ${formatDiscountPercent(rates.deliveredPercent)}% delivered, ${formatDiscountPercent(rates.pickupPercent)}% picked up`
            : "Standard discount: none"}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCategoryId(null)}
          className={`${chipBaseClassName} ${categoryId == null ? selectedClassName : chipIdleClassName}`}
        >
          All{" "}
          <span className={categoryId == null ? selectedMutedTextClassName : "text-slate-400"}>
            {rows.length}
          </span>
        </button>
        {categories.length > 1
          ? categories.map((category) => {
              const active = categoryId === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryId(active ? null : category.id)}
                  className={`${chipBaseClassName} ${active ? selectedClassName : chipIdleClassName}`}
                >
                  {category.name}{" "}
                  <span className={active ? selectedMutedTextClassName : "text-slate-400"}>
                    {category.count}
                  </span>
                </button>
              );
            })
          : null}
        {unpricedCount > 0 || unpricedOnly ? (
          <button
            type="button"
            onClick={() => setUnpricedOnly((current) => !current)}
            aria-pressed={unpricedOnly}
            className={`${chipBaseClassName} ${unpricedOnly ? selectedClassName : "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"}`}
          >
            No price{" "}
            <span className={unpricedOnly ? selectedMutedTextClassName : "text-amber-700"}>
              {unpricedCount}
            </span>
          </button>
        ) : null}
      </div>

      {pasteError ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          {pasteError}
        </p>
      ) : null}

      {visibleRows.length === 0 ? (
        <p className="py-4 text-sm text-slate-500">Nothing matches.</p>
      ) : (
        <div className={`${tableFlushWrapperClassName} w-fit max-w-full border-l border-t border-slate-300`}>
          <table className={tableCompactClassName} data-pricing-grid>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>Code</th>
                <th className={tableHeaderCellClassName}>Description</th>
                <th className={tableHeaderCellClassName}>Unit</th>
                <th className={tableHeaderCellClassName}>{priceLabel}</th>
                {showDiscountColumns ? (
                  <>
                    <th className={`${tableHeaderCellWrapClassName} w-28`}>
                      Delivered, less {formatDiscountPercent(rates.deliveredPercent)}%
                    </th>
                    <th className={`${tableHeaderCellWrapClassName} w-28`}>
                      Picked Up, less {formatDiscountPercent(rates.pickupPercent)}%
                    </th>
                  </>
                ) : null}
                <th className={`${tableHeaderCellClassName} w-24`}>
                  <span className="sr-only">Saved</span>
                </th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {visibleRows.map((row, index) => {
                const categoryRow =
                  index === 0 || visibleRows[index - 1].categoryId !== row.categoryId ? (
                    <tr key={`category-${row.categoryId}`}>
                      <td
                        colSpan={columnCount}
                        className={`${tableCellClassName} bg-slate-100 font-semibold text-slate-900`}
                      >
                        {row.categoryName}
                      </td>
                    </tr>
                  ) : null;
                return [
                  categoryRow,
                  <PriceRow
                    key={row.id}
                    row={row}
                    draft={drafts[row.id] ?? ""}
                    savedPrice={saved[row.id] ?? null}
                    status={status[row.id]}
                    rates={rates}
                    showDiscountColumns={showDiscountColumns}
                    priceLabel={priceLabel}
                    canEdit={canEdit}
                    handlers={handlers}
                  />,
                ];
              })}
            </tbody>
          </table>
        </div>
      )}

      {canEdit ? (
        <p className="max-w-3xl text-xs text-slate-500">
          A price saves when you leave its box. Enter moves down. To paste a column from
          Excel, click the first price and paste: blank rows in what you copied leave those
          prices alone.
        </p>
      ) : null}
    </div>
  );
}

type RowHandlers = {
  registerInput: (productId: string, element: HTMLInputElement | null) => void;
  changeDraft: (productId: string, value: string) => void;
  commit: (productId: string) => void;
  move: (productId: string, step: 1 | -1) => void;
  revert: (productId: string) => void;
  pasteColumn: (productId: string, text: string) => void;
};

type PriceRowProps = {
  row: PricingProductRow;
  draft: string;
  savedPrice: string | null;
  status: CellStatus | undefined;
  rates: DiscountRates;
  showDiscountColumns: boolean;
  priceLabel: string;
  canEdit: boolean;
  /** Stable for the life of the grid, so typing in one row redraws that row only. */
  handlers: RowHandlers;
};

const PriceRow = memo(function PriceRow({
  row,
  draft,
  savedPrice,
  status: cellStatus,
  rates,
  showDiscountColumns,
  priceLabel,
  canEdit,
  handlers,
}: PriceRowProps) {
  const parsed = parsePriceInput(draft);
  // The worked-out prices follow what is typed, before it is saved.
  const listPrice = parsed.ok ? parsed.value : savedPrice;

  return (
    <tr className={tableRowClassName} data-product-code={row.productCode}>
      <td className={`${tableCellClassName} whitespace-nowrap`}>
        <Link
          href={`/products/${row.id}`}
          className="font-medium text-sky-700 hover:text-sky-900 hover:underline"
        >
          {row.productCode}
        </Link>
      </td>
      <td className={`${tableCellClassName} min-w-64 max-w-md`}>
        {row.name}
        {row.castingWithoutSupplier ? (
          <Link
            href={`/products/${row.id}/edit`}
            className="ml-2 inline-block rounded border border-amber-300 bg-amber-50 px-1.5 text-2xs font-medium text-amber-900 hover:bg-amber-100"
          >
            No supplier set
          </Link>
        ) : null}
      </td>
      <td className={`${tableCellClassName} text-slate-600`}>{row.unit}</td>
      {canEdit ? (
        <td
          className={`${tableGridCellClassName} ${
            cellStatus?.kind === "error" ? "bg-red-50" : ""
          }`}
        >
          <input
            ref={(element) => handlers.registerInput(row.id, element)}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-label={`${priceLabel} for ${row.productCode}`}
            aria-invalid={cellStatus?.kind === "error"}
            value={draft}
            onChange={(event) => handlers.changeDraft(row.id, event.target.value)}
            onFocus={(event) => event.target.select()}
            onBlur={() => handlers.commit(row.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "ArrowDown") {
                event.preventDefault();
                handlers.move(row.id, 1);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                handlers.move(row.id, -1);
              } else if (event.key === "Escape") {
                event.preventDefault();
                handlers.revert(row.id);
              }
            }}
            onPaste={(event) => {
              const text = event.clipboardData.getData("text");
              // One value pastes into the box as usual; a copied column
              // fills down from here.
              if (splitPastedColumn(text).length > 1) {
                event.preventDefault();
                handlers.pasteColumn(row.id, text);
              }
            }}
            className={priceInputClassName}
          />
        </td>
      ) : (
        <td className={`${tableCellClassName} tabular-nums`}>
          {listPrice != null ? formatUsd(listPrice) : ""}
        </td>
      )}
      {showDiscountColumns ? (
        <>
          <td className={`${tableCellClassName} whitespace-nowrap bg-slate-50 tabular-nums text-slate-900`}>
            {listPrice != null
              ? formatUsd(priceAfterDiscount(listPrice, rates.deliveredPercent).toString())
              : ""}
          </td>
          <td className={`${tableCellClassName} whitespace-nowrap bg-slate-50 tabular-nums text-slate-900`}>
            {listPrice != null
              ? formatUsd(priceAfterDiscount(listPrice, rates.pickupPercent).toString())
              : ""}
          </td>
        </>
      ) : null}
      <td className={`${tableCellClassName} w-24 whitespace-nowrap`} aria-live="polite">
        {cellStatus?.kind === "saving" ? (
          <span className="text-2xs text-slate-500">Saving…</span>
        ) : cellStatus?.kind === "saved" ? (
          <span className="text-2xs font-medium text-emerald-700">Saved</span>
        ) : cellStatus?.kind === "error" ? (
          <span className="whitespace-normal text-2xs font-medium text-red-700">
            {cellStatus.message}
          </span>
        ) : null}
      </td>
    </tr>
  );
});
