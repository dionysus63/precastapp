"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { applyGalleyBreakdown } from "@/app/quotes/galley-actions";
import {
  GALLEY_TYPE_ORDER,
  galleyTypeLabels,
  type GalleyBreakdownCounts,
  type GalleyBreakdownView,
  type GalleyTypeValue,
} from "@/lib/galley-utils";
import { reloadAfterAction } from "@/lib/reload-after-action";

function BreakdownDialog({
  quoteId,
  family,
  onClose,
}: {
  quoteId: string;
  family: GalleyBreakdownView;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<GalleyTypeValue, string>>(() => {
    const initial = {} as Record<GalleyTypeValue, string>;
    for (const type of GALLEY_TYPE_ORDER) {
      const current = family.counts[type] ?? 0;
      initial[type] = family.pending
        ? ""
        : current > 0
          ? String(current)
          : "";
    }
    return initial;
  });

  const assigned = useMemo(
    () =>
      GALLEY_TYPE_ORDER.reduce((sum, type) => {
        const parsed = Number.parseInt(values[type], 10);
        return sum + (Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
      }, 0),
    [values],
  );
  const balanced = assigned === family.total;

  function submit() {
    const counts = {} as GalleyBreakdownCounts;
    for (const type of GALLEY_TYPE_ORDER) {
      const parsed = Number.parseInt(values[type], 10);
      counts[type] = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    }
    startTransition(async () => {
      const result = await applyGalleyBreakdown(
        quoteId,
        family.familyCode,
        counts,
      );
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`${family.familyCode} broken down.`);
      reloadAfterAction();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-slate-900">
          {family.pending ? "Break down" : "Adjust mix"} · {family.label}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Quoted total: <span className="font-semibold">{family.total} EA</span>
        </p>

        <div className="mt-4 space-y-2">
          {GALLEY_TYPE_ORDER.filter((type) =>
            family.availableTypes.includes(type),
          ).map((type) => (
            <label
              key={type}
              className="flex items-center justify-between gap-3"
            >
              <span className="text-xs font-medium text-slate-700">
                {galleyTypeLabels[type]}
                {family.memberCodes[type] ? (
                  <span className="ml-1.5 font-mono text-[10px] font-normal text-slate-400">
                    {family.memberCodes[type]}
                  </span>
                ) : null}
              </span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={values[type]}
                placeholder="0"
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [type]: event.target.value,
                  }))
                }
                className="h-8 w-20 rounded-lg border border-slate-200 px-2 text-right text-sm text-slate-900 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </label>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold">
          <span className="text-slate-600">Assigned</span>
          <span className={balanced ? "text-emerald-700" : "text-amber-700"}>
            {assigned} / {family.total}
            {balanced ? " ✓" : ""}
          </span>
        </div>

        <p className="mt-2 text-[11px] text-slate-500">
          Counts must add up to the quoted total — price and quote total never
          change. The mix stays adjustable until a piece is ticketed.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || !balanced}
            onClick={submit}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Applying…" : "Apply breakdown"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatMixSummary(family: GalleyBreakdownView): string {
  const parts = GALLEY_TYPE_ORDER.filter(
    (type) => (family.counts[type] ?? 0) > 0,
  ).map((type) => `${family.counts[type]} ${galleyTypeLabels[type]}`);
  return parts.join(" · ");
}

/**
 * Won-quote galley controls: an amber call-to-action while family totals
 * still need their End/Middle/CB breakdown, plus a quiet per-family
 * "Adjust mix" row once they are broken down (until ticketing locks them).
 */
export function GalleyBreakdownBanner({
  quoteId,
  families,
}: {
  quoteId: string;
  families: GalleyBreakdownView[];
}) {
  const [openFamilyCode, setOpenFamilyCode] = useState<string | null>(null);

  const pendingFamilies = families.filter((family) => family.pending);
  const adjustableFamilies = families.filter(
    (family) => !family.pending && !family.locked,
  );
  const openFamily =
    families.find((family) => family.familyCode === openFamilyCode) ?? null;

  if (families.length === 0) {
    return null;
  }

  return (
    <>
      {pendingFamilies.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            <span className="font-semibold">
              {pendingFamilies.length} galley line
              {pendingFamilies.length === 1 ? "" : "s"}
            </span>{" "}
            need{pendingFamilies.length === 1 ? "s" : ""} an End / Middle / CB
            breakdown before delivery tickets can be planned.
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            {pendingFamilies.map((family) => (
              <button
                key={family.familyCode}
                type="button"
                onClick={() => setOpenFamilyCode(family.familyCode)}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-700"
              >
                Break down {family.familyCode} ({family.total})
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {adjustableFamilies.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-2 text-xs text-slate-600">
          <span className="font-medium text-slate-700">Galley mix</span>
          {adjustableFamilies.map((family) => (
            <span key={family.familyCode} className="inline-flex items-center gap-1.5">
              <span className="font-mono text-[11px] font-semibold text-slate-800">
                {family.familyCode}
              </span>
              {formatMixSummary(family) || "—"}
              <button
                type="button"
                onClick={() => setOpenFamilyCode(family.familyCode)}
                className="font-semibold text-sky-700 underline hover:text-sky-900"
              >
                Adjust
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {openFamily ? (
        <BreakdownDialog
          quoteId={quoteId}
          family={openFamily}
          onClose={() => setOpenFamilyCode(null)}
        />
      ) : null}
    </>
  );
}
