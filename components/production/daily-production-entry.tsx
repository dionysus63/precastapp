"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDailyProductionDay } from "@/app/operations/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import type {
  DailyProductionDayEntry,
  DailyProductionStockProduct,
  DailyProductionStructureRow,
} from "@/lib/daily-production-service";
import { randomId } from "@/lib/random-id";
import { reloadAfterAction } from "@/lib/reload-after-action";

type TaxonomyCategory = {
  id: string;
  name: string;
  subcategories: { id: string; name: string }[];
};

type DailyProductionEntryProps = {
  /** yyyy-mm-dd — the day being recorded (from the URL). */
  date: string;
  userName: string;
  structures: DailyProductionStructureRow[];
  dayEntries: DailyProductionDayEntry[];
  products: DailyProductionStockProduct[];
  categories: TaxonomyCategory[];
};

function shiftDate(iso: string, days: number): string {
  const base = new Date(`${iso}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function localToday(): string {
  return new Date().toLocaleDateString("en-CA");
}

const qtyInputClassName =
  "w-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900";

export function DailyProductionEntry({
  date,
  userName,
  structures,
  dayEntries,
  products,
  categories,
}: DailyProductionEntryProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  // One key per form instance: a double-click or retry resubmits the same
  // key, and the server posts the entry only once.
  const [submissionKey] = useState(() => randomId());

  const [structureQty, setStructureQty] = useState<Record<string, string>>({});
  const [pieceChecked, setPieceChecked] = useState<Record<string, boolean>>({});

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState("");
  const [stockQty, setStockQty] = useState<Record<string, string>>({});

  // Structures grouped per job, each group an expandable section.
  const jobGroups = useMemo(() => {
    const byId = new Map<
      string,
      { id: string; label: string; rows: DailyProductionStructureRow[] }
    >();
    for (const row of structures) {
      const key = row.jobId ?? "no-job";
      const existing = byId.get(key);
      if (existing) {
        existing.rows.push(row);
      } else {
        byId.set(key, {
          id: key,
          label: row.jobId
            ? `${row.jobNumber ?? ""} — ${row.projectName ?? ""}`.trim()
            : "No job",
          rows: [row],
        });
      }
    }
    return [...byId.values()];
  }, [structures]);

  // A single in-production job starts open; with several, pick your job.
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(
    () => new Set(jobGroups.length === 1 ? [jobGroups[0].id] : []),
  );

  function toggleJob(id: string) {
    setExpandedJobs((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  /** Count of made-today inputs/pieces pending in a group (shown collapsed). */
  function pendingInGroup(rows: DailyProductionStructureRow[]): number {
    let count = 0;
    for (const row of rows) {
      if (row.pieces.length > 0) {
        count += row.pieces.filter(
          (piece) => !piece.made && pieceChecked[piece.id],
        ).length;
      } else if (Number(structureQty[row.jobStructureId] ?? "") > 0) {
        count += 1;
      }
    }
    return count;
  }

  const activeCategory = categories.find((row) => row.id === categoryId) ?? null;
  const visibleProducts = useMemo(() => {
    if (!categoryId) return [];
    const filter = productFilter.trim().toLowerCase();
    return products.filter((product) => {
      if (product.categoryId !== categoryId) return false;
      if (subcategoryId && product.subcategoryId !== subcategoryId) return false;
      if (
        filter &&
        !`${product.productCode} ${product.name}`.toLowerCase().includes(filter)
      ) {
        return false;
      }
      return true;
    });
  }, [products, categoryId, subcategoryId, productFilter]);

  // Products with a typed quantity always stay visible, even after the
  // category chips change — so nothing entered is ever hidden at save time.
  const pendingStockLines = useMemo(
    () =>
      Object.entries(stockQty)
        .map(([productId, raw]) => ({
          product: products.find((row) => row.id === productId),
          qty: Number(raw),
        }))
        .filter(
          (line): line is { product: DailyProductionStockProduct; qty: number } =>
            line.product != null && Number.isFinite(line.qty) && line.qty > 0,
        ),
    [stockQty, products],
  );

  function changeDate(next: string) {
    router.replace(`/production/daily?date=${next}`);
  }

  function save() {
    setError(null);
    const structureLines: {
      jobStructureId: string;
      jobStructurePieceId?: string | null;
      quantityMade: number;
    }[] = [];
    for (const row of structures) {
      if (row.pieces.length > 0) {
        for (const piece of row.pieces) {
          if (!piece.made && pieceChecked[piece.id]) {
            structureLines.push({
              jobStructureId: row.jobStructureId,
              jobStructurePieceId: piece.id,
              quantityMade: 1,
            });
          }
        }
        continue;
      }
      const qty = Number(structureQty[row.jobStructureId] ?? "");
      if (Number.isFinite(qty) && qty > 0) {
        structureLines.push({
          jobStructureId: row.jobStructureId,
          quantityMade: qty,
        });
      }
    }
    const stockLines = pendingStockLines.map((line) => ({
      productId: line.product.id,
      quantityProduced: line.qty,
    }));

    if (structureLines.length === 0 && stockLines.length === 0) {
      setError("Enter at least one made quantity or check a piece.");
      return;
    }

    startTransition(async () => {
      const result = await saveDailyProductionDay({
        productionDate: date,
        enteredBy: userName,
        notes: notes.trim() || null,
        submissionKey,
        stockLines,
        structureLines,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      reloadAfterAction();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => changeDate(shiftDate(localToday(), -1))}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          Yesterday
        </button>
        <button
          type="button"
          onClick={() => changeDate(localToday())}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          Today
        </button>
        <input
          type="date"
          value={date}
          onChange={(event) => {
            if (event.target.value) changeDate(event.target.value);
          }}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900"
          aria-label="Production date"
        />
        <span className="ml-auto text-xs text-slate-500">
          Entered by <span className="font-semibold text-slate-700">{userName}</span>
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionCard
            title="Job structures in production"
            description={`${structures.length} structure${
              structures.length === 1 ? "" : "s"
            } across ${jobGroups.length} job${jobGroups.length === 1 ? "" : "s"}`}
          >
            {jobGroups.length === 0 ? (
              <p className="text-xs text-slate-500">
                Nothing is in production right now. Structures enter production
                from a job&apos;s production tab.
              </p>
            ) : (
              <div className="space-y-2">
                {jobGroups.map((group) => {
                  const open = expandedJobs.has(group.id);
                  const pendingCount = pendingInGroup(group.rows);
                  return (
                    <div
                      key={group.id}
                      className="rounded-lg border border-slate-200"
                    >
                      <button
                        type="button"
                        onClick={() => toggleJob(group.id)}
                        aria-expanded={open}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <span
                          aria-hidden="true"
                          className={`text-[10px] text-slate-400 transition-transform ${
                            open ? "rotate-90" : ""
                          }`}
                        >
                          ▶
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-900">
                          {group.label}
                        </span>
                        {pendingCount > 0 ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                            {pendingCount} on this entry
                          </span>
                        ) : null}
                        <span className="text-[11px] text-slate-500">
                          {group.rows.length} structure
                          {group.rows.length === 1 ? "" : "s"}
                        </span>
                      </button>
                      {open ? (
                        <div className="divide-y divide-slate-100 border-t border-slate-100 px-3">
                          {group.rows.map((row) => (
                            <div
                              key={row.jobStructureId}
                              className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-slate-900">
                                  {row.structureNumber}
                                </div>
                                {row.description ? (
                                  <div className="truncate text-[11px] text-slate-500">
                                    {row.description}
                                  </div>
                                ) : null}
                              </div>
                              {row.pieces.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] text-slate-500">
                                    {row.pieces.filter((piece) => piece.made).length}{" "}
                                    / {row.pieces.length} pcs
                                  </span>
                                  {row.pieces.map((piece) => (
                                    <label
                                      key={piece.id}
                                      className={`inline-flex items-center gap-1 text-[11px] ${
                                        piece.made
                                          ? "text-slate-400"
                                          : "text-slate-700"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={
                                          piece.made ||
                                          Boolean(pieceChecked[piece.id])
                                        }
                                        disabled={piece.made || pending}
                                        onChange={(event) =>
                                          setPieceChecked((current) => ({
                                            ...current,
                                            [piece.id]: event.target.checked,
                                          }))
                                        }
                                        className="h-3.5 w-3.5 rounded border-slate-300"
                                      />
                                      {piece.name}
                                    </label>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-slate-500">
                                    {row.madeSoFar} / {row.quantity ?? "—"}
                                    {row.unit && row.unit !== "EA"
                                      ? ` ${row.unit}`
                                      : ""}
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    inputMode="decimal"
                                    placeholder="0"
                                    value={structureQty[row.jobStructureId] ?? ""}
                                    disabled={pending}
                                    onChange={(event) =>
                                      setStructureQty((current) => ({
                                        ...current,
                                        [row.jobStructureId]: event.target.value,
                                      }))
                                    }
                                    aria-label={`${row.structureNumber} made on this day`}
                                    className={qtyInputClassName}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Stock production"
            description="Pick a category, enter counts. Entries post to inventory."
          >
            <div className="flex flex-wrap gap-1.5">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    setCategoryId(
                      categoryId === category.id ? null : category.id,
                    );
                    setSubcategoryId(null);
                  }}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                    categoryId === category.id
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
            {activeCategory && activeCategory.subcategories.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSubcategoryId(null)}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                    subcategoryId === null
                      ? "bg-slate-700 text-white"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  All
                </button>
                {activeCategory.subcategories.map((subcategory) => (
                  <button
                    key={subcategory.id}
                    type="button"
                    onClick={() => setSubcategoryId(subcategory.id)}
                    className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                      subcategoryId === subcategory.id
                        ? "bg-slate-700 text-white"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {subcategory.name}
                  </button>
                ))}
              </div>
            ) : null}
            {categoryId ? (
              <>
                <input
                  type="text"
                  value={productFilter}
                  onChange={(event) => setProductFilter(event.target.value)}
                  placeholder="Filter products"
                  className="mt-3 w-full max-w-xs rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
                />
                {visibleProducts.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-500">
                    No tracked products in this selection.
                  </p>
                ) : (
                  <div className="mt-2 divide-y divide-slate-100">
                    {visibleProducts.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center gap-3 py-1.5"
                      >
                        <div className="min-w-0 flex-1 text-xs text-slate-700">
                          <span className="font-semibold text-slate-900">
                            {product.productCode}
                          </span>{" "}
                          <span className="text-slate-500">{product.name}</span>
                        </div>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          placeholder="0"
                          value={stockQty[product.id] ?? ""}
                          disabled={pending}
                          onChange={(event) =>
                            setStockQty((current) => ({
                              ...current,
                              [product.id]: event.target.value,
                            }))
                          }
                          aria-label={`${product.productCode} produced on this day`}
                          className={qtyInputClassName}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                Pick a category to enter stock counts.
              </p>
            )}
            {pendingStockLines.length > 0 ? (
              <p className="mt-3 text-[11px] text-slate-500">
                On this entry:{" "}
                {pendingStockLines
                  .map((line) => `${line.product.productCode} ×${line.qty}`)
                  .join(" · ")}
              </p>
            ) : null}
          </SectionCard>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notes (optional)"
              className="w-full max-w-sm rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900"
            />
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className="ml-auto rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save my entry"}
            </button>
          </div>
          {error ? (
            <p className="text-xs font-medium text-red-600">{error}</p>
          ) : null}
        </div>

        <SectionCard
          title={`Entered for ${date}`}
          description={
            dayEntries.length === 0
              ? "No entries yet"
              : `${dayEntries.length} entr${dayEntries.length === 1 ? "y" : "ies"}`
          }
        >
          {dayEntries.length === 0 ? (
            <p className="text-xs text-slate-500">
              Nothing recorded for this day yet.
            </p>
          ) : (
            <div className="space-y-3">
              {dayEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="border-l-2 border-slate-200 pl-2.5"
                >
                  <div className="text-xs font-semibold text-slate-800">
                    {entry.enteredBy ?? "Unknown"}{" "}
                    <span className="font-normal text-slate-400">
                      · {entry.createdAtLabel}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {entry.lines.join(" · ")}
                  </div>
                  {entry.notes ? (
                    <div className="text-[11px] italic text-slate-400">
                      {entry.notes}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
