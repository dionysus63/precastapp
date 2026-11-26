"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { saveStructurePrices } from "@/app/pricing/actions";
import { isActionError } from "@/lib/action-result";
import { formatUsd } from "@/lib/format";
import {
  formatDiscountPercent,
  hasAnyDiscount,
  priceAfterDiscount,
  type DiscountRates,
} from "@/lib/pricing/discount-groups";
import { parsePriceInput } from "@/lib/pricing/price-input";
import {
  STRUCTURE_PRICE_TABLE_KEYS,
  STRUCTURE_PRICE_TABLES,
  resolveStructurePriceRow,
  rowHasOwnPrices,
  splitPastedBlock,
  type StructurePriceColumn,
  type StructurePriceRow,
  type StructurePriceTableKey,
  type StructurePriceTables,
} from "@/lib/pricing/structure-price-tables";
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

type RowStatus =
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

type StructurePricesGridProps = {
  priceListId: string;
  /**
   * The default list, whose numbers a row falls back on (shown gray); null
   * when the list on screen is the default list itself.
   */
  fallbackListName: string | null;
  tables: StructurePriceTables;
  canEdit: Record<StructurePriceTableKey, boolean>;
  /** Stock precast's standard discount: a ring is stock precast. */
  ringRates: DiscountRates;
};

const inputClassName =
  "block w-24 min-w-0 border-0 bg-transparent px-2 py-1.5 text-xs tabular-nums text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500";

/** How long a row says "Saved" before it goes quiet again. */
const SAVED_NOTE_MS = 2500;

/**
 * Every number a structure's price is worked out from, on one tab: round
 * molds, rectangular templates, the two opening catalogs and ring prices
 * per foot. A row saves when you leave it.
 */
export function StructurePricesGrid({
  priceListId,
  fallbackListName,
  tables,
  canEdit,
  ringRates,
}: StructurePricesGridProps) {
  const canEditAny = STRUCTURE_PRICE_TABLE_KEYS.some((table) => canEdit[table]);
  return (
    <div className="space-y-4">
      <p className="max-w-4xl text-xs text-slate-600">
        The numbers a drill sheet uses to work out a structure&apos;s price, and what a ring
        costs per foot.
        {fallbackListName
          ? ` A gray number comes from ${fallbackListName}, the default list, until this list has its own.`
          : ""}
      </p>
      <div className="flex flex-wrap items-start gap-x-8 gap-y-6">
        {STRUCTURE_PRICE_TABLE_KEYS.map((table) => (
          <StructurePriceSheet
            key={table}
            table={table}
            priceListId={priceListId}
            rows={tables[table]}
            canEdit={canEdit[table]}
            ringRates={table === "rings" ? ringRates : null}
          />
        ))}
      </div>
      {canEditAny ? (
        <p className="max-w-4xl text-xs text-slate-500">
          A row saves when you leave it. Enter moves down. Cells copied from Excel paste
          from the box you are in, down and across; blank cells in what you copied leave
          those prices alone.
          {fallbackListName
            ? " To put a row back on the default list's numbers, clear its prices."
            : ""}
        </p>
      ) : null}
    </div>
  );
}

/** A value as its box shows it: prices with cents, feet without trailing zeros. */
function boxText(column: StructurePriceColumn, value: string | null | undefined): string {
  if (value == null) {
    return "";
  }
  return column.kind === "feet" ? String(Number(value)) : value;
}

function draftsFor(
  table: StructurePriceTableKey,
  row: StructurePriceRow,
): Record<string, string> {
  return Object.fromEntries(
    STRUCTURE_PRICE_TABLES[table].columns.map((column) => [
      column.key,
      row.disabledColumns.includes(column.key) ? "" : boxText(column, row.values[column.key]),
    ]),
  );
}

/** What a row would be saved as, per column, to tell a change from none. */
function targetValues(
  table: StructurePriceTableKey,
  draft: Record<string, string>,
  row: StructurePriceRow,
): { ok: true; values: Record<string, string | null> } | { ok: false; error: string } {
  const resolved = resolveStructurePriceRow(table, draft, row);
  if (!resolved.ok) {
    return resolved;
  }
  const values: Record<string, string | null> = {};
  for (const column of STRUCTURE_PRICE_TABLES[table].columns) {
    values[column.key] =
      column.kind === "feet"
        ? resolved.shared[column.key]
        : (resolved.prices?.[column.key] ?? null);
  }
  return { ok: true, values };
}

function sameValues(
  table: StructurePriceTableKey,
  target: Record<string, string | null>,
  row: StructurePriceRow,
): boolean {
  return STRUCTURE_PRICE_TABLES[table].columns.every(
    (column) =>
      // A column that does not apply is not the person's to change.
      row.disabledColumns.includes(column.key) ||
      (target[column.key] ?? null) === (row.values[column.key] ?? null),
  );
}

type StructurePriceSheetProps = {
  table: StructurePriceTableKey;
  priceListId: string;
  rows: StructurePriceRow[];
  canEdit: boolean;
  /** Set on the ring sheet: adds the worked-out delivered and picked-up columns. */
  ringRates: DiscountRates | null;
};

function StructurePriceSheet({
  table,
  priceListId,
  rows,
  canEdit,
  ringRates,
}: StructurePriceSheetProps) {
  const definition = STRUCTURE_PRICE_TABLES[table];
  const { columns } = definition;
  const rowIds = rows.map((row) => row.id);

  /** The rows as the database holds them. */
  const [savedRows, setSavedRows] = useState<Record<string, StructurePriceRow>>(() =>
    Object.fromEntries(rows.map((row) => [row.id, row])),
  );
  /** What each box shows, as typed. */
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(rows.map((row) => [row.id, draftsFor(table, row)])),
  );
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const [pasteError, setPasteError] = useState<string | null>(null);

  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const savedNoteTimers = useRef(new Map<string, number>());
  useEffect(() => {
    const timers = savedNoteTimers.current;
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const showDiscountColumns = ringRates != null && hasAnyDiscount(ringRates);
  const flagsUnpriced = table === "molds" || table === "rectTemplates";

  function noteSaved(ids: string[]) {
    setStatus((current) => {
      const next = { ...current };
      for (const id of ids) {
        next[id] = { kind: "saved" };
      }
      return next;
    });
    for (const id of ids) {
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

  function setRowError(rowId: string, message: string) {
    setStatus((current) => ({ ...current, [rowId]: { kind: "error", message } }));
  }

  function clearRowStatus(ids: string[]) {
    setStatus((current) => {
      const next = { ...current };
      for (const id of ids) {
        delete next[id];
      }
      return next;
    });
  }

  function applySaved(saved: StructurePriceRow[], typedById: Record<string, Record<string, string>>) {
    setSavedRows((current) => ({
      ...current,
      ...Object.fromEntries(saved.map((row) => [row.id, row])),
    }));
    // Keep what is in a row's boxes if the person has typed there since.
    setDrafts((current) => {
      const next = { ...current };
      for (const row of saved) {
        const typed = typedById[row.id];
        const now = current[row.id];
        if (typed && columns.every((column) => now?.[column.key] === typed[column.key])) {
          next[row.id] = draftsFor(table, row);
        }
      }
      return next;
    });
    noteSaved(saved.map((row) => row.id));
  }

  async function commitRow(rowId: string) {
    const row = savedRows[rowId];
    const typed = drafts[rowId];
    if (!row || !typed) {
      return;
    }
    const target = targetValues(table, typed, row);
    if (!target.ok) {
      setRowError(rowId, target.error);
      return;
    }
    if (sameValues(table, target.values, row)) {
      // Nothing to save; tidy "185" into "185.00" and clear an old error.
      setDrafts((current) => ({ ...current, [rowId]: draftsFor(table, row) }));
      if (status[rowId]?.kind === "error") {
        clearRowStatus([rowId]);
      }
      return;
    }

    setStatus((current) => ({ ...current, [rowId]: { kind: "saving" } }));
    let result: Awaited<ReturnType<typeof saveStructurePrices>>;
    try {
      result = await saveStructurePrices(priceListId, table, [{ rowId, values: typed }]);
    } catch {
      result = { error: "Could not reach the server. The row was not saved." };
    }
    if (isActionError(result)) {
      setRowError(rowId, result.error);
      return;
    }
    applySaved(result.rows, { [rowId]: typed });
  }

  /** Move to the same column of the next row that has a box there. */
  function focusCell(rowId: string, columnKey: string, step: 1 | -1): boolean {
    let index = rowIds.indexOf(rowId) + step;
    while (index >= 0 && index < rowIds.length) {
      const input = inputRefs.current.get(`${rowIds[index]}:${columnKey}`);
      if (input) {
        input.focus();
        input.select();
        return true;
      }
      index += step;
    }
    return false;
  }

  async function pasteBlock(startRowId: string, startColumnKey: string, text: string) {
    setPasteError(null);
    const block = splitPastedBlock(text);
    const width = Math.max(...block.map((cells) => cells.length));
    const startRow = rowIds.indexOf(startRowId);
    const startColumn = columns.findIndex((column) => column.key === startColumnKey);
    const rowsLeft = rowIds.length - startRow;
    const columnsLeft = columns.length - startColumn;
    if (block.length > rowsLeft) {
      setPasteError(
        `You copied ${block.length} rows, but only ${rowsLeft} ${
          rowsLeft === 1 ? "row is" : "rows are"
        } left from the box you pasted into. Nothing was pasted.`,
      );
      return;
    }
    if (width > columnsLeft) {
      setPasteError(
        `You copied ${width} columns, but only ${columnsLeft} ${
          columnsLeft === 1 ? "column is" : "columns are"
        } left from the box you pasted into. Nothing was pasted.`,
      );
      return;
    }

    const typedById: Record<string, Record<string, string>> = {};
    for (let rowOffset = 0; rowOffset < block.length; rowOffset += 1) {
      const rowId = rowIds[startRow + rowOffset];
      const row = savedRows[rowId];
      const typed = { ...drafts[rowId] };
      block[rowOffset].forEach((cell, columnOffset) => {
        const column = columns[startColumn + columnOffset];
        // A blank cell in what was copied leaves that price alone.
        if (cell !== "" && !row.disabledColumns.includes(column.key)) {
          typed[column.key] = cell;
        }
      });
      const target = targetValues(table, typed, row);
      if (!target.ok) {
        setPasteError(
          `Row ${rowOffset + 1} of what you copied: ${target.error} Nothing was pasted.`,
        );
        return;
      }
      if (!sameValues(table, target.values, row)) {
        typedById[rowId] = typed;
      }
    }
    const ids = Object.keys(typedById);
    if (ids.length === 0) {
      toast.success("Those prices are already on the list.");
      return;
    }

    const before = Object.fromEntries(ids.map((id) => [id, drafts[id]]));
    setDrafts((current) => ({ ...current, ...typedById }));
    setStatus((current) => ({
      ...current,
      ...Object.fromEntries(ids.map((id) => [id, { kind: "saving" } as RowStatus])),
    }));

    let result: Awaited<ReturnType<typeof saveStructurePrices>>;
    try {
      result = await saveStructurePrices(
        priceListId,
        table,
        ids.map((rowId) => ({ rowId, values: typedById[rowId] })),
      );
    } catch {
      result = { error: "Could not reach the server. Nothing was pasted." };
    }
    if (isActionError(result)) {
      // All or nothing on the server: put the boxes back as they were.
      setDrafts((current) => ({ ...current, ...before }));
      clearRowStatus(ids);
      setPasteError(result.error);
      return;
    }
    applySaved(result.rows, typedById);
    toast.success(`${ids.length} row${ids.length === 1 ? "" : "s"} pasted and saved.`);
  }

  return (
    <section className="min-w-0 space-y-2" data-structure-prices={table}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold text-slate-900">{definition.title}</h2>
        <Link
          href={definition.home.href}
          className="text-2xs font-medium text-sky-700 hover:text-sky-900 hover:underline"
        >
          Add or remove rows in {definition.home.label}
        </Link>
      </div>

      {table === "rings" ? (
        <p className="max-w-md text-2xs text-slate-500">
          A gray number is the ring&apos;s standard price from Ring Builder, used until this
          list has its own.
          {ringRates && showDiscountColumns
            ? ` Rings take the stock precast discount: ${formatDiscountPercent(ringRates.deliveredPercent)}% delivered, ${formatDiscountPercent(ringRates.pickupPercent)}% picked up.`
            : ""}
        </p>
      ) : null}
      {table === "rectTemplates" ? (
        <p className="max-w-md text-2xs text-slate-500">
          Minimum Feet Billed belongs to the template and is the same on every price list.
        </p>
      ) : null}

      {pasteError ? (
        <p
          role="alert"
          className="max-w-md rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          {pasteError}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="py-2 text-xs text-slate-500">Nothing here yet.</p>
      ) : (
        <div className={`${tableFlushWrapperClassName} w-fit max-w-full border-l border-t border-slate-300`}>
          <table className={tableCompactClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>{definition.rowLabel}</th>
                {columns.map((column) => (
                  <th key={column.key} className={`${tableHeaderCellWrapClassName} w-24`}>
                    {column.label}
                  </th>
                ))}
                {ringRates && showDiscountColumns ? (
                  <>
                    <th className={`${tableHeaderCellWrapClassName} w-24`}>
                      Delivered, less {formatDiscountPercent(ringRates.deliveredPercent)}%
                    </th>
                    <th className={`${tableHeaderCellWrapClassName} w-24`}>
                      Picked Up, less {formatDiscountPercent(ringRates.pickupPercent)}%
                    </th>
                  </>
                ) : null}
                <th className={`${tableHeaderCellClassName} w-20`}>
                  <span className="sr-only">Saved</span>
                </th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {rows.map(({ id }) => {
                const row = savedRows[id];
                const draft = drafts[id];
                const rowStatus = status[id];
                const ownPrices = rowHasOwnPrices(table, row);
                const unpriced = flagsUnpriced && !ownPrices && !row.inherited;
                return (
                  <tr
                    key={id}
                    className={tableRowClassName}
                    data-row-label={row.label}
                    onBlur={(event) => {
                      // Moving between the boxes of one row is not leaving it.
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        void commitRow(id);
                      }
                    }}
                  >
                    <td className={`${tableCellClassName} min-w-40 max-w-xs`}>
                      <span className="font-medium text-slate-900">{row.label}</span>
                      {unpriced ? (
                        <span className="ml-2 inline-block rounded border border-amber-300 bg-amber-50 px-1.5 text-2xs font-medium text-amber-900">
                          No price
                        </span>
                      ) : null}
                      {row.detail ? (
                        <span className="block text-2xs text-slate-500">{row.detail}</span>
                      ) : null}
                    </td>
                    {columns.map((column) => {
                      if (row.disabledColumns.includes(column.key)) {
                        return (
                          <td
                            key={column.key}
                            className={`${tableCellClassName} bg-slate-50 text-2xs text-slate-400`}
                          >
                            No slab
                          </td>
                        );
                      }
                      const inherited =
                        column.kind === "price" && !ownPrices
                          ? (row.inherited?.[column.key] ?? null)
                          : null;
                      if (!canEdit) {
                        const value = row.values[column.key];
                        return (
                          <td
                            key={column.key}
                            className={`${tableCellClassName} tabular-nums ${
                              value == null && inherited != null ? "text-slate-400" : ""
                            }`}
                          >
                            {column.kind === "feet"
                              ? boxText(column, value)
                              : value != null
                                ? formatUsd(value)
                                : inherited != null
                                  ? formatUsd(inherited)
                                  : ""}
                          </td>
                        );
                      }
                      return (
                        <td
                          key={column.key}
                          className={`${tableGridCellClassName} ${
                            rowStatus?.kind === "error" ? "bg-red-50" : ""
                          }`}
                        >
                          <input
                            ref={(element) => {
                              const key = `${id}:${column.key}`;
                              if (element) {
                                inputRefs.current.set(key, element);
                              } else {
                                inputRefs.current.delete(key);
                              }
                            }}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            aria-label={`${column.label} for ${row.label}${row.detail ? `, ${row.detail}` : ""}`}
                            aria-invalid={rowStatus?.kind === "error"}
                            value={draft[column.key] ?? ""}
                            placeholder={inherited ?? ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              setDrafts((current) => ({
                                ...current,
                                [id]: { ...current[id], [column.key]: value },
                              }));
                            }}
                            onFocus={(event) => event.target.select()}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === "ArrowDown") {
                                event.preventDefault();
                                // On the last row, Enter still saves the row.
                                if (!focusCell(id, column.key, 1) && event.key === "Enter") {
                                  event.currentTarget.blur();
                                }
                              } else if (event.key === "ArrowUp") {
                                event.preventDefault();
                                focusCell(id, column.key, -1);
                              } else if (event.key === "Escape") {
                                event.preventDefault();
                                setDrafts((current) => ({
                                  ...current,
                                  [id]: draftsFor(table, row),
                                }));
                                if (rowStatus?.kind === "error") {
                                  clearRowStatus([id]);
                                }
                              }
                            }}
                            onPaste={(event) => {
                              const text = event.clipboardData.getData("text");
                              const block = splitPastedBlock(text);
                              // One value pastes into the box as usual; copied
                              // cells fill down and across from here.
                              if (block.length > 1 || (block[0]?.length ?? 0) > 1) {
                                event.preventDefault();
                                void pasteBlock(id, column.key, text);
                              }
                            }}
                            className={inputClassName}
                          />
                        </td>
                      );
                    })}
                    {ringRates && showDiscountColumns ? (
                      <RingNetCells
                        typed={draft.pricePerFoot ?? ""}
                        fallback={row.values.pricePerFoot ?? row.inherited?.pricePerFoot ?? null}
                        rates={ringRates}
                      />
                    ) : null}
                    <td className={`${tableCellClassName} w-20 whitespace-nowrap`} aria-live="polite">
                      {rowStatus?.kind === "saving" ? (
                        <span className="text-2xs text-slate-500">Saving…</span>
                      ) : rowStatus?.kind === "saved" ? (
                        <span className="text-2xs font-medium text-emerald-700">Saved</span>
                      ) : rowStatus?.kind === "error" ? (
                        <span className="block w-40 whitespace-normal text-2xs font-medium text-red-700">
                          {rowStatus.message}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** A ring's delivered and picked-up price per foot, following what is typed. */
function RingNetCells({
  typed,
  fallback,
  rates,
}: {
  typed: string;
  /** The price when the box is blank or cannot be read. */
  fallback: string | null;
  rates: DiscountRates;
}) {
  const parsed = parsePriceInput(typed);
  const listPrice = parsed.ok && parsed.value != null ? parsed.value : fallback;
  const cellClassName = `${tableCellClassName} whitespace-nowrap bg-slate-50 tabular-nums text-slate-900`;
  return (
    <>
      <td className={cellClassName}>
        {listPrice != null
          ? formatUsd(priceAfterDiscount(listPrice, rates.deliveredPercent).toString())
          : ""}
      </td>
      <td className={cellClassName}>
        {listPrice != null
          ? formatUsd(priceAfterDiscount(listPrice, rates.pickupPercent).toString())
          : ""}
      </td>
    </>
  );
}
