"use client";

import type { KeyboardEvent, RefObject } from "react";
import type { StructureStatus } from "@/components/structures/structure-utils";
import { structureStatusOptions } from "@/components/structures/structure-utils";

/**
 * Spreadsheet-style keyboard behavior shared by both bulk-edit grids. Cells
 * tag themselves with data-r (row) / data-c (column); Enter and Alt+Arrow
 * move vertically within a column, Ctrl+D fills from the cell above.
 */

export function focusGridCell(
  table: HTMLTableElement | null,
  row: number,
  col: number,
): void {
  const target = table?.querySelector<HTMLElement>(
    `[data-r="${row}"][data-c="${col}"]`,
  );
  if (!target) {
    return;
  }
  target.focus();
  if (target instanceof HTMLInputElement && target.type === "text") {
    target.select();
  }
}

/**
 * Returns true when the key event moved focus (caller should preventDefault).
 * Enter / Shift+Enter always move down/up; plain arrows move only from
 * checkboxes and selects where they don't edit the value.
 */
export function handleGridNavKey(
  event: KeyboardEvent<HTMLElement>,
  tableRef: RefObject<HTMLTableElement | null>,
): boolean {
  const target = event.currentTarget as HTMLElement;
  const row = Number(target.getAttribute("data-r"));
  const col = Number(target.getAttribute("data-c"));
  if (!Number.isFinite(row) || !Number.isFinite(col)) {
    return false;
  }

  const isTextInput =
    target instanceof HTMLInputElement && target.type === "text";
  const arrowsNavigate = !isTextInput && !(target instanceof HTMLSelectElement);

  let delta = 0;
  if (event.key === "Enter") {
    delta = event.shiftKey ? -1 : 1;
  } else if (event.key === "ArrowDown" && (arrowsNavigate || event.altKey)) {
    delta = 1;
  } else if (event.key === "ArrowUp" && (arrowsNavigate || event.altKey)) {
    delta = -1;
  } else {
    return false;
  }

  focusGridCell(tableRef.current, row + delta, col);
  return true;
}

export function isFillDownKey(event: KeyboardEvent<HTMLElement>): boolean {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d";
}

const statusLabels = Object.fromEntries(
  structureStatusOptions.map((option) => [option.value, option.label]),
);

const statusBadgeClasses: Record<StructureStatus, string> = {
  NOT_SUBMITTED: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-sky-100 text-sky-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  IN_PRODUCTION: "bg-indigo-100 text-indigo-700",
  MADE: "bg-amber-100 text-amber-800",
  SHIPPED: "bg-violet-100 text-violet-700",
};

export function StructureStatusBadge({
  status,
  isProduced,
}: {
  status: StructureStatus;
  isProduced: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClasses[status] ?? "bg-slate-100 text-slate-600"}`}
      >
        {statusLabels[status] ?? status}
      </span>
      {isProduced ? (
        <span
          className="text-[10px] font-semibold text-amber-600"
          title="Already poured or shipped — number changes here will not match the produced piece."
        >
          ⚠
        </span>
      ) : null}
    </span>
  );
}

export function formatFeet(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `${(Math.round(value * 100) / 100).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}'`;
}

export function formatElevation(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return (Math.round(value * 100) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatWeightLb(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `${Math.round(value).toLocaleString("en-US")} lb`;
}
