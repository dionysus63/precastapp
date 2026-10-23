"use client";

import { useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from "react";
import {
  searchProductsForJobImport,
  type ImportProductOption,
} from "@/app/jobs/import-actions";
import { FormTypeahead } from "@/components/common/form-typeahead";
import {
  IMPORT_DOC_KINDS,
  IMPORT_STRUCTURE_STATUSES,
  assignPagesInOrder,
  formatPageList,
  parseMoneyInput,
  parsePageList,
  sumImportRows,
  type ImportDocKind,
  type ImportDocRef,
  type ImportProductRow,
  type ImportRow,
  type ImportStructureRow,
  type ImportStructureStatus,
} from "@/lib/job-import";
import { parseTsvPaste } from "@/lib/quotes/structure-workbook";
import { formatUsd as formatCurrency } from "@/lib/format";
import { dragHasFiles } from "./import-drop-zone";
import type { ImportFileEntry, ImportQuoteFields } from "./import-types";
import {
  IMPORT_PAGES_MIME,
  PdfPageThumbnails,
  type DraggedPages,
} from "./pdf-page-thumbnails";

const STATUS_STYLES: Record<ImportStructureStatus, string> = {
  NOT_SUBMITTED: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-violet-100 text-violet-900",
  APPROVED: "bg-sky-100 text-sky-900",
  IN_PRODUCTION: "bg-amber-100 text-amber-900",
  MADE: "bg-emerald-100 text-emerald-900",
  SHIPPED: "bg-slate-200 text-slate-800",
};

const cellClassName =
  "block h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-xs text-slate-900 hover:border-slate-300 focus:border-sky-500 focus:bg-white focus:outline-none";

let keyCounter = 0;
export function newImportKey(prefix: string): string {
  keyCounter += 1;
  return `${prefix}${Date.now().toString(36)}${keyCounter}`;
}

export function newStructureRow(status: ImportStructureStatus): ImportStructureRow {
  return {
    kind: "STRUCTURE",
    key: newImportKey("s"),
    structureNumber: "",
    description: "",
    quantity: "1",
    unitPrice: "",
    weightLbs: "",
    status,
    docs: {},
  };
}

export function newProductRow(): ImportProductRow {
  return {
    kind: "PRODUCT",
    key: newImportKey("p"),
    productId: null,
    productLabel: "",
    description: "",
    quantity: "1",
    unitPrice: "",
    unit: "EA",
  };
}

type TextColumn = "structureNumber" | "description" | "quantity" | "unitPrice" | "weightLbs";
const TEXT_COLUMNS: TextColumn[] = [
  "structureNumber",
  "description",
  "quantity",
  "unitPrice",
  "weightLbs",
];

const COLUMN_WIDTHS: Record<TextColumn, string> = {
  structureNumber: "min-w-[5.5rem]",
  description: "min-w-[12rem]",
  quantity: "min-w-[3.5rem] w-14",
  unitPrice: "min-w-[6.5rem]",
  weightLbs: "min-w-[5rem]",
};

function readDraggedPages(event: DragEvent): DraggedPages | null {
  const raw = event.dataTransfer.getData(IMPORT_PAGES_MIME);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as DraggedPages;
  } catch {
    return null;
  }
}

function DocCell({
  docRef,
  kind,
  files,
  onChange,
  onDropFile,
}: {
  docRef: ImportDocRef | undefined;
  kind: ImportDocKind;
  files: ImportFileEntry[];
  onChange: (ref: ImportDocRef | null) => void;
  onDropFile: (file: File) => void;
}) {
  const [hot, setHot] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const combined = files.find((entry) => entry.kind === kind && entry.combined);
  const refFile = docRef ? files.find((entry) => entry.key === docRef.fileKey) : undefined;

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setHot(false);
    const dragged = readDraggedPages(event);
    if (dragged) {
      if (dragged.pages.length === 0) {
        onChange({ fileKey: dragged.fileKey, pages: null });
        return;
      }
      const merged =
        docRef && docRef.fileKey === dragged.fileKey && docRef.pages
          ? [...new Set([...docRef.pages, ...dragged.pages])].sort((a, b) => a - b)
          : dragged.pages;
      onChange({ fileKey: dragged.fileKey, pages: merged });
      return;
    }
    const file = event.dataTransfer.files[0];
    if (file) {
      onDropFile(file);
    }
  }

  const typedPages =
    combined &&
    (!docRef || (docRef.fileKey === combined.key && docRef.pages != null));

  return (
    <div
      onDragOver={(event) => {
        if (
          !dragHasFiles(event) &&
          !Array.from(event.dataTransfer.types).includes(IMPORT_PAGES_MIME)
        ) {
          return;
        }
        event.preventDefault();
        setHot(true);
      }}
      onDragLeave={() => setHot(false)}
      onDrop={handleDrop}
      className={`flex min-w-[7.5rem] items-center gap-1 rounded-md ${
        hot ? "bg-sky-100 ring-2 ring-sky-500" : ""
      }`}
    >
      {typedPages ? (
        <input
          type="text"
          value={draft ?? (docRef?.pages ? formatPageList(docRef.pages) : "")}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() =>
            setDraft(docRef?.pages ? formatPageList(docRef.pages).replace(/–/g, "-") : "")
          }
          onBlur={() => {
            const text = (draft ?? "").trim();
            setDraft(null);
            if (!text) {
              onChange(null);
              return;
            }
            const pages = parsePageList(text, combined.pageCount ?? 0);
            if (pages) {
              onChange({ fileKey: combined.key, pages });
            }
          }}
          placeholder="drop / pages"
          title={`Pages of ${combined.name}. Type like 3-4, or drag pages here.`}
          aria-label="Pages"
          className={`h-7 w-24 rounded-md border px-2 text-xs ${
            docRef?.pages
              ? "border-sky-200 bg-sky-50 font-semibold text-sky-900"
              : "border-dashed border-slate-300 bg-white text-slate-700"
          }`}
        />
      ) : docRef && refFile ? (
        <span
          title={refFile.name}
          className="inline-flex h-7 max-w-[10rem] items-center truncate rounded-md border border-red-200 bg-red-50 px-2 text-[11px] font-semibold text-red-900"
        >
          {docRef.pages
            ? `p${formatPageList(docRef.pages)} · ${refFile.name}`
            : refFile.name}
        </span>
      ) : (
        <span className="inline-flex h-7 items-center rounded-md border border-dashed border-slate-300 px-2 text-[11px] text-slate-500">
          Drop PDF
        </span>
      )}
      {docRef ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Remove"
          className="rounded px-1 text-slate-400 hover:text-slate-700"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}

/**
 * Step 3: the Excel-like grid. Structures get number, description, qty,
 * price, status and their paperwork (drag pages from the right, drop a PDF
 * on a cell, or type page numbers); castings and stock items sit below.
 */
export function ImportStructuresStep({
  rows,
  files,
  makesStructures,
  defaultStatus,
  quote,
  onRowsChange,
  onDropFileOnRow,
}: {
  rows: ImportRow[];
  files: ImportFileEntry[];
  makesStructures: boolean;
  defaultStatus: ImportStructureStatus;
  quote: ImportQuoteFields;
  onRowsChange: (rows: ImportRow[]) => void;
  onDropFileOnRow: (rowKey: string, kind: ImportDocKind, file: File) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const structureRows = rows.filter(
    (row): row is ImportStructureRow => row.kind === "STRUCTURE",
  );
  const productRows = rows.filter(
    (row): row is ImportProductRow => row.kind === "PRODUCT",
  );
  const docKinds = makesStructures ? IMPORT_DOC_KINDS : [];

  function patchRow(key: string, patch: Partial<ImportStructureRow> | Partial<ImportProductRow>) {
    onRowsChange(
      rows.map((row) => (row.key === key ? ({ ...row, ...patch } as ImportRow) : row)),
    );
  }

  function setDoc(key: string, kind: ImportDocKind, ref: ImportDocRef | null) {
    onRowsChange(
      rows.map((row) => {
        if (row.key !== key || row.kind !== "STRUCTURE") {
          return row;
        }
        const docs = { ...row.docs };
        if (ref) {
          docs[kind] = ref;
        } else {
          delete docs[kind];
        }
        return { ...row, docs };
      }),
    );
  }

  function focusCell(rowIndex: number, column: TextColumn) {
    const target = document.querySelector<HTMLInputElement>(
      `[data-import-cell="${rowIndex}:${column}"]`,
    );
    target?.focus();
    target?.select();
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    column: TextColumn,
  ) {
    if (event.key === "ArrowDown" || event.key === "Enter") {
      event.preventDefault();
      if (rowIndex + 1 >= structureRows.length) {
        onRowsChange([...rows, newStructureRow(defaultStatus)]);
        window.setTimeout(() => focusCell(rowIndex + 1, column), 0);
        return;
      }
      focusCell(rowIndex + 1, column);
    } else if (event.key === "ArrowUp" && rowIndex > 0) {
      event.preventDefault();
      focusCell(rowIndex - 1, column);
    }
  }

  /**
   * Excel-style paste: a block copied from a spreadsheet fills cells to the
   * right and below the one pasted into (Structure, Description, Qty, Price,
   * Weight, Status), adding rows when it runs past the bottom.
   */
  function handlePaste(
    event: ClipboardEvent<HTMLInputElement>,
    rowIndex: number,
    column: TextColumn,
  ) {
    const text = event.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) {
      return;
    }
    event.preventDefault();
    const block = parseTsvPaste(text);
    const nextStructures = [...structureRows];
    while (nextStructures.length < rowIndex + block.length) {
      nextStructures.push(newStructureRow(defaultStatus));
    }
    const startColumn = TEXT_COLUMNS.indexOf(column);
    block.forEach((cells, offset) => {
      const index = rowIndex + offset;
      let row = nextStructures[index]!;
      cells.forEach((raw, cellOffset) => {
        const value = raw.trim();
        const columnIndex = startColumn + cellOffset;
        const textColumn = TEXT_COLUMNS[columnIndex];
        if (textColumn) {
          row = { ...row, [textColumn]: value };
          return;
        }
        if (columnIndex === TEXT_COLUMNS.length) {
          const wanted = value.toLowerCase();
          const status = IMPORT_STRUCTURE_STATUSES.find(
            (option) =>
              option.value.toLowerCase() === wanted.replace(/\s+/g, "_") ||
              option.label.toLowerCase().startsWith(wanted),
          );
          if (status && wanted) {
            row = { ...row, status: status.value };
          }
        }
      });
      nextStructures[index] = row;
    });
    onRowsChange([...nextStructures, ...productRows]);
  }

  function setStatusForSelected(status: ImportStructureStatus) {
    const targets = selected.size > 0 ? selected : new Set(structureRows.map((row) => row.key));
    onRowsChange(
      rows.map((row) =>
        row.kind === "STRUCTURE" && targets.has(row.key) ? { ...row, status } : row,
      ),
    );
  }

  function matchPagesInOrder(file: ImportFileEntry) {
    const kind = file.kind as ImportDocKind;
    const assignment = assignPagesInOrder(file.pageCount ?? 0, structureRows.length);
    let index = 0;
    onRowsChange(
      rows.map((row) => {
        if (row.kind !== "STRUCTURE") {
          return row;
        }
        const pages = assignment[index] ?? [];
        index += 1;
        const current = row.docs[kind];
        if (current && current.fileKey !== file.key) {
          return row;
        }
        const docs = { ...row.docs };
        if (pages.length > 0) {
          docs[kind] = { fileKey: file.key, pages };
        } else {
          delete docs[kind];
        }
        return { ...row, docs };
      }),
    );
  }

  function removeRow(key: string) {
    onRowsChange(rows.filter((row) => row.key !== key));
    setSelected((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  const combinedFiles = files.filter(
    (entry) => entry.combined && entry.kind !== "QUOTE" && makesStructures,
  );
  const usedKeys = new Set(
    structureRows.flatMap((row) =>
      Object.values(row.docs)
        .filter((ref): ref is ImportDocRef => Boolean(ref))
        .map((ref) => ref.fileKey),
    ),
  );
  const looseFiles = files.filter(
    (entry) =>
      makesStructures && !entry.combined && entry.kind !== "QUOTE" && !usedKeys.has(entry.key),
  );

  const total = sumImportRows(rows);
  const check = parseMoneyInput(quote.totalCheck);
  const difference = check != null ? Math.round((check - total) * 100) / 100 : null;

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-[999_1_640px] space-y-4">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Structures</h3>
              <p className="text-xs text-slate-500">
                Type, or paste straight from Excel into any cell (Structure,
                Description, Qty, Price, Weight, Status).
                {makesStructures
                  ? " Drag pages from the right onto a row, or drop a PDF on a cell."
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {makesStructures ? (
                <select
                  value=""
                  onChange={(event) => {
                    if (event.target.value) {
                      setStatusForSelected(event.target.value as ImportStructureStatus);
                    }
                  }}
                  aria-label="Set status"
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700"
                >
                  <option value="">
                    {selected.size > 0
                      ? `Set status for ${selected.size} selected…`
                      : "Set status for all…"}
                  </option>
                  {IMPORT_STRUCTURE_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              ) : null}
              <button
                type="button"
                onClick={() => onRowsChange([...structureRows, newStructureRow(defaultStatus), ...productRows])}
                className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                + Add structure
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {makesStructures ? (
                    <th className="w-8 px-2 py-2">
                      <input
                        type="checkbox"
                        aria-label="Select all structures"
                        checked={structureRows.length > 0 && selected.size === structureRows.length}
                        onChange={(event) =>
                          setSelected(
                            event.target.checked
                              ? new Set(structureRows.map((row) => row.key))
                              : new Set(),
                          )
                        }
                      />
                    </th>
                  ) : null}
                  <th className="px-2 py-2">Structure</th>
                  <th className="px-2 py-2">Description</th>
                  <th className="w-16 px-2 py-2">Qty</th>
                  <th className="w-24 px-2 py-2">Unit price</th>
                  <th className="w-20 px-2 py-2">Weight lb</th>
                  {makesStructures ? <th className="px-2 py-2">Status</th> : null}
                  {docKinds.map((kind) => (
                    <th key={kind.value} className="px-2 py-2">
                      {kind.label}
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {structureRows.map((row, rowIndex) => (
                  <tr key={row.key} className="border-t border-slate-100">
                    {makesStructures ? (
                      <td className="px-2 py-1">
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.structureNumber || `row ${rowIndex + 1}`}`}
                          checked={selected.has(row.key)}
                          onChange={(event) =>
                            setSelected((current) => {
                              const next = new Set(current);
                              if (event.target.checked) {
                                next.add(row.key);
                              } else {
                                next.delete(row.key);
                              }
                              return next;
                            })
                          }
                        />
                      </td>
                    ) : null}
                    {TEXT_COLUMNS.map((column) => (
                      <td
                        key={column}
                        className={`px-1 py-1 ${COLUMN_WIDTHS[column]}`}
                      >
                        <input
                          type="text"
                          inputMode={
                            column === "quantity" || column === "unitPrice" || column === "weightLbs"
                              ? "decimal"
                              : undefined
                          }
                          data-import-cell={`${rowIndex}:${column}`}
                          value={row[column]}
                          onChange={(event) => patchRow(row.key, { [column]: event.target.value })}
                          onKeyDown={(event) => handleKeyDown(event, rowIndex, column)}
                          onPaste={(event) => handlePaste(event, rowIndex, column)}
                          placeholder={
                            column === "structureNumber"
                              ? "MH-1"
                              : column === "unitPrice"
                                ? "0.00"
                                : ""
                          }
                          aria-label={column}
                          className={`${cellClassName} ${column === "structureNumber" ? "font-semibold" : ""}`}
                        />
                      </td>
                    ))}
                    {makesStructures ? (
                      <td className="px-1 py-1">
                        <select
                          value={row.status}
                          onChange={(event) =>
                            patchRow(row.key, {
                              status: event.target.value as ImportStructureStatus,
                            })
                          }
                          aria-label="Status"
                          className={`h-7 rounded-full border-0 px-2 text-[11px] font-semibold ${STATUS_STYLES[row.status]}`}
                        >
                          {IMPORT_STRUCTURE_STATUSES.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.value === "SHIPPED" ? "Shipped" : status.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    ) : null}
                    {docKinds.map((kind) => (
                      <td key={kind.value} className="px-1 py-1">
                        <DocCell
                          docRef={row.docs[kind.value]}
                          kind={kind.value}
                          files={files}
                          onChange={(ref) => setDoc(row.key, kind.value, ref)}
                          onDropFile={(file) => onDropFileOnRow(row.key, kind.value, file)}
                        />
                      </td>
                    ))}
                    <td className="px-1 py-1">
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        aria-label={`Remove ${row.structureNumber || "row"}`}
                        className="rounded px-1 text-slate-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Castings and stock items</h3>
              <p className="text-xs text-slate-500">
                Frames, covers, grates, risers and anything else on the quote,
                picked from the product catalog so tickets and invoices work.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRowsChange([...rows, newProductRow()])}
              className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              + Add casting or stock item
            </button>
          </div>
          {productRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Product</th>
                    <th className="px-2 py-2">Description</th>
                    <th className="w-16 px-2 py-2">Qty</th>
                    <th className="w-24 px-2 py-2">Unit price</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((row) => (
                    <tr key={row.key} className="border-t border-slate-100">
                      <td className="min-w-[16rem] px-2 py-1">
                        <FormTypeahead<ImportProductOption>
                          selectedLabel={row.productLabel}
                          placeholder="Search code or name…"
                          searchItems={searchProductsForJobImport}
                          itemKey={(product) => product.id}
                          itemLabel={(product) => product.label}
                          onSelect={(product) =>
                            patchRow(row.key, {
                              productId: product?.id ?? null,
                              productLabel: product?.label ?? "",
                              unit: product?.unit ?? "EA",
                              description: product ? product.description : row.description,
                            })
                          }
                          inputClassName="block h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
                          preventEnterSubmit
                        />
                      </td>
                      <td className="min-w-[12rem] px-1 py-1">
                        <input
                          type="text"
                          value={row.description}
                          onChange={(event) => patchRow(row.key, { description: event.target.value })}
                          aria-label="Description"
                          className={cellClassName}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.quantity}
                          onChange={(event) => patchRow(row.key, { quantity: event.target.value })}
                          aria-label="Quantity"
                          className={cellClassName}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.unitPrice}
                          onChange={(event) => patchRow(row.key, { unitPrice: event.target.value })}
                          placeholder="0.00"
                          aria-label="Unit price"
                          className={cellClassName}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <button
                          type="button"
                          onClick={() => removeRow(row.key)}
                          aria-label="Remove item"
                          className="rounded px-1 text-slate-400 hover:text-red-600"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-3 text-xs text-slate-500">None added.</p>
          )}
        </section>

        <div className="flex flex-wrap justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <span>
            <b className="text-slate-900">
              {structureRows.length} structure{structureRows.length === 1 ? "" : "s"}
            </b>
            {" · "}
            {productRows.length} casting/stock line{productRows.length === 1 ? "" : "s"}
          </span>
          <span>
            Grid total <b className="text-slate-900">{formatCurrency(total)}</b>
            {check != null ? (
              <>
                {" "}of quote {formatCurrency(check)}
                {difference === 0 ? (
                  <span className="font-semibold text-emerald-700"> · matches</span>
                ) : (
                  <span className="font-semibold text-amber-700">
                    {" "}· {formatCurrency(Math.abs(difference ?? 0))}{" "}
                    {(difference ?? 0) > 0 ? "not on a row yet" : "over the quote"}
                  </span>
                )}
              </>
            ) : null}
          </span>
        </div>
      </div>

      {combinedFiles.length > 0 || looseFiles.length > 0 ? (
        <aside className="max-h-[80vh] min-w-0 flex-[1_1_280px] space-y-4 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-4">
          {combinedFiles.map((file) => {
            const kind = file.kind as ImportDocKind;
            const owners = new Map<number, string>();
            for (const row of structureRows) {
              const ref = row.docs[kind];
              if (ref?.fileKey === file.key && ref.pages) {
                for (const page of ref.pages) {
                  const label = row.structureNumber || "row";
                  owners.set(page, owners.has(page) ? `${owners.get(page)}, ${label}` : label);
                }
              }
            }
            const kindLabel = IMPORT_DOC_KINDS.find((entry) => entry.value === kind)?.label;
            return (
              <div key={file.key} className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {kindLabel} pages
                    </p>
                    <p className="truncate text-xs font-semibold text-slate-900" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {owners.size} of {file.pageCount ?? "?"} pages matched. Click
                      or Shift-click pages, then drag onto a row.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => matchPagesInOrder(file)}
                    disabled={structureRows.length === 0 || !file.pageCount}
                    className="flex-none rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Match in order
                  </button>
                </div>
                <PdfPageThumbnails file={file.file} fileKey={file.key} assignedTo={owners} />
              </div>
            );
          })}
          {looseFiles.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Not matched to a structure
              </p>
              <p className="text-[11px] text-slate-500">
                Drag each onto its row. Anything left here is still saved in the
                job folder.
              </p>
              {looseFiles.map((file) => (
                <div
                  key={file.key}
                  draggable
                  onDragStart={(event) => {
                    const dragged: DraggedPages = { fileKey: file.key, pages: [] };
                    event.dataTransfer.setData(IMPORT_PAGES_MIME, JSON.stringify(dragged));
                  }}
                  className="cursor-grab truncate rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] font-semibold text-red-900"
                  title={file.name}
                >
                  {file.name}
                  <span className="ml-1 font-normal text-red-700">
                    ({IMPORT_DOC_KINDS.find((entry) => entry.value === file.kind)?.label})
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
