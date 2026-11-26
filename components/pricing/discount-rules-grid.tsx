"use client";

import { useState } from "react";
import { saveDiscountRule } from "@/app/pricing/actions";
import { isActionError } from "@/lib/action-result";
import {
  DISCOUNT_GROUP_KEYS,
  DISCOUNT_GROUP_LABELS,
  formatDiscountPercent,
  parseDiscountPercentInput,
  type DiscountGroupKey,
  type DiscountRateTable,
} from "@/lib/pricing/discount-groups";
import {
  tableBodyClassName,
  tableCellClassName,
  tableCompactClassName,
  tableGridCellClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

type Field = "delivered" | "pickup";

type RowStatus =
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

type DiscountRulesGridProps = {
  rates: DiscountRateTable;
  /** Active products in each group, so a row shows what it covers. */
  productCounts: Record<DiscountGroupKey, number>;
  canEdit: boolean;
};

/** What the group covers, for the rows whose name does not say it all. */
const GROUP_NOTES: Partial<Record<DiscountGroupKey, string>> = {
  OTHER: "Accessories, services, and castings with no supplier set",
};

/** A percentage as the box shows it: blank for no discount. */
function percentText(percent: number): string {
  return percent > 0 ? formatDiscountPercent(percent) : "";
}

const percentInputClassName =
  "block w-24 min-w-0 border-0 bg-transparent px-2 py-1.5 text-xs tabular-nums text-slate-900 placeholder:text-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500";

/**
 * The standard discount off list price for each group. A row saves when you
 * leave one of its boxes.
 */
export function DiscountRulesGrid({ rates, productCounts, canEdit }: DiscountRulesGridProps) {
  const [drafts, setDrafts] = useState<Record<DiscountGroupKey, Record<Field, string>>>(
    () =>
      Object.fromEntries(
        DISCOUNT_GROUP_KEYS.map((group) => [
          group,
          {
            delivered: percentText(rates[group].deliveredPercent),
            pickup: percentText(rates[group].pickupPercent),
          },
        ]),
      ) as Record<DiscountGroupKey, Record<Field, string>>,
  );
  const [saved, setSaved] = useState(drafts);
  const [status, setStatus] = useState<Partial<Record<DiscountGroupKey, RowStatus>>>({});

  async function commitRow(group: DiscountGroupKey) {
    const draft = drafts[group];
    const delivered = parseDiscountPercentInput(draft.delivered);
    const pickup = parseDiscountPercentInput(draft.pickup);
    if (!delivered.ok || !pickup.ok) {
      const message = !delivered.ok ? delivered.error : !pickup.ok ? pickup.error : "";
      setStatus((current) => ({ ...current, [group]: { kind: "error", message } }));
      return;
    }
    const deliveredText = percentText(Number(delivered.value));
    const pickupText = percentText(Number(pickup.value));
    if (deliveredText === saved[group].delivered && pickupText === saved[group].pickup) {
      setDrafts((current) => ({
        ...current,
        [group]: { delivered: deliveredText, pickup: pickupText },
      }));
      setStatus((current) => {
        if (current[group]?.kind !== "error") {
          return current;
        }
        const next = { ...current };
        delete next[group];
        return next;
      });
      return;
    }

    setStatus((current) => ({ ...current, [group]: { kind: "saving" } }));
    let result: Awaited<ReturnType<typeof saveDiscountRule>>;
    try {
      result = await saveDiscountRule(group, delivered.value, pickup.value);
    } catch {
      result = { error: "Could not reach the server. The discount was not saved." };
    }
    if (isActionError(result)) {
      setStatus((current) => ({
        ...current,
        [group]: { kind: "error", message: result.error },
      }));
      return;
    }
    const stored = {
      delivered: percentText(Number(result.deliveredPercent)),
      pickup: percentText(Number(result.pickupPercent)),
    };
    setSaved((current) => ({ ...current, [group]: stored }));
    setDrafts((current) => ({ ...current, [group]: stored }));
    setStatus((current) => ({ ...current, [group]: { kind: "saved" } }));
  }

  function percentCell(group: DiscountGroupKey, field: Field, label: string) {
    if (!canEdit) {
      return (
        <td className={`${tableCellClassName} tabular-nums`}>
          {saved[group][field] ? `${saved[group][field]}%` : ""}
        </td>
      );
    }
    return (
      <td className={tableGridCellClassName}>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-label={`${label} discount percent for ${DISCOUNT_GROUP_LABELS[group]}`}
          value={drafts[group][field]}
          onChange={(event) => {
            const value = event.target.value;
            setDrafts((current) => ({
              ...current,
              [group]: { ...current[group], [field]: value },
            }));
          }}
          onFocus={(event) => event.target.select()}
          onBlur={() => void commitRow(group)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              event.preventDefault();
              setDrafts((current) => ({ ...current, [group]: saved[group] }));
            }
          }}
          className={percentInputClassName}
        />
      </td>
    );
  }

  return (
    <div className="space-y-3">
      <div className="w-fit max-w-full overflow-x-auto border-l border-t border-slate-300">
        <table className={tableCompactClassName} data-discount-rules>
          <thead>
            <tr>
              <th className={tableHeaderCellClassName}>Group</th>
              <th className={tableHeaderCellClassName}>Products</th>
              <th className={tableHeaderCellClassName}>Delivered %</th>
              <th className={tableHeaderCellClassName}>Picked Up %</th>
              <th className={`${tableHeaderCellClassName} w-24`}>
                <span className="sr-only">Saved</span>
              </th>
            </tr>
          </thead>
          <tbody className={tableBodyClassName}>
            {DISCOUNT_GROUP_KEYS.map((group) => {
              const rowStatus = status[group];
              return (
                <tr key={group} className={tableRowClassName} data-discount-group={group}>
                  <td className={tableCellClassName}>
                    <span className="font-medium text-slate-900">
                      {DISCOUNT_GROUP_LABELS[group]}
                    </span>
                    {GROUP_NOTES[group] ? (
                      <span className="block text-2xs text-slate-500">{GROUP_NOTES[group]}</span>
                    ) : null}
                  </td>
                  <td className={`${tableCellClassName} tabular-nums text-slate-600`}>
                    {productCounts[group].toLocaleString()}
                  </td>
                  {percentCell(group, "delivered", "Delivered")}
                  {percentCell(group, "pickup", "Picked up")}
                  <td className={`${tableCellClassName} w-24 whitespace-nowrap`} aria-live="polite">
                    {rowStatus?.kind === "saving" ? (
                      <span className="text-2xs text-slate-500">Saving…</span>
                    ) : rowStatus?.kind === "saved" ? (
                      <span className="text-2xs font-medium text-emerald-700">Saved</span>
                    ) : rowStatus?.kind === "error" ? (
                      <span className="whitespace-normal text-2xs font-medium text-red-700">
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
      <p className="max-w-3xl text-xs text-slate-500">
        Percent off list price. Blank means no discount. The same discounts apply to every
        price list.
      </p>
    </div>
  );
}
