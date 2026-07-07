"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import {
  scheduleJobLoads,
  type ScheduleLoadUpdate,
} from "@/app/delivery-tickets/actions";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  deliveryTicketStatusLabels,
  type DeliveryTicketRow,
} from "@/components/delivery-tickets/delivery-ticket-utils";
import { formatWeightLb } from "@/lib/format";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";
import {
  tableBodyClassName,
  tableCellClassName,
  tableCellInputClassName,
  tableClassName,
  tableGridCellClassName,
  tableHeaderCellClassName,
  tableNumericCellClassName,
  tableRowClassName,
  tableWrapperClassName,
} from "@/lib/table-styles";

export type ScheduleTicketRow = {
  id: string;
  ticketNumber: string;
  status: keyof typeof deliveryTicketStatusLabels;
  statusVariant: DeliveryTicketRow["statusVariant"];
  loadSequence: string | null;
  contents: string;
  totalItems: number;
  totalWeight: number | null;
  deliveryDate: string;
  deliveryTime: string;
  truck: string;
  trailer: string;
  driver: string;
  editable: boolean;
  expectedUpdatedAt: string;
};

type ScheduleFields = {
  deliveryDate: string;
  deliveryTime: string;
  truck: string;
  trailer: string;
  driver: string;
};

type ScheduleLoadsEditorProps = {
  jobId: string;
  rows: ScheduleTicketRow[];
  fleetOptions: {
    trucks: string[];
    drivers: string[];
    trailers: string[];
  };
};

const SCHEDULE_FIELD_KEYS: (keyof ScheduleFields)[] = [
  "deliveryDate",
  "deliveryTime",
  "truck",
  "trailer",
  "driver",
];

function pickFields(row: ScheduleTicketRow): ScheduleFields {
  return {
    deliveryDate: row.deliveryDate,
    deliveryTime: row.deliveryTime,
    truck: row.truck,
    trailer: row.trailer,
    driver: row.driver,
  };
}

export function ScheduleLoadsEditor({
  jobId,
  rows,
  fleetOptions,
}: ScheduleLoadsEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, ScheduleFields>>(() =>
    Object.fromEntries(rows.map((row) => [row.id, pickFields(row)])),
  );
  const baseline = useRef<Record<string, ScheduleFields>>(
    Object.fromEntries(rows.map((row) => [row.id, pickFields(row)])),
  );

  const editableRows = useMemo(() => rows.filter((row) => row.editable), [rows]);
  const navRowIndex = useMemo(
    () => new Map(editableRows.map((row, index) => [row.id, index])),
    [editableRows],
  );

  const dirtyIds = useMemo(() => {
    const ids: string[] = [];
    for (const row of editableRows) {
      const current = fields[row.id];
      const base = baseline.current[row.id];
      if (!current || !base) continue;
      if (SCHEDULE_FIELD_KEYS.some((key) => current[key] !== base[key])) {
        ids.push(row.id);
      }
    }
    return ids;
  }, [fields, editableRows]);

  const willSchedule = useMemo(
    () =>
      dirtyIds.filter((id) => {
        const row = rows.find((entry) => entry.id === id);
        return (
          row?.status === "DRAFT" && fields[id]?.deliveryDate.trim() !== ""
        );
      }).length,
    [dirtyIds, fields, rows],
  );

  const dirty = dirtyIds.length > 0;
  useUnsavedChangesWarning(dirty && !pending);

  function setField(ticketId: string, key: keyof ScheduleFields, value: string) {
    setFields((current) => ({
      ...current,
      [ticketId]: { ...current[ticketId], [key]: value },
    }));
  }

  // Excel-style navigation over the editable schedule cells, same pattern as
  // the app's other grids; columns 0-4 = date, time, truck, trailer, driver.
  const tableRef = useRef<HTMLTableElement>(null);
  const navRowCountRef = useRef(0);
  navRowCountRef.current = editableRows.length;
  const NAV_COLUMN_COUNT = 5;

  const handleCellKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>, rowIndex: number, colIndex: number) => {
      const findCell = (row: number, col: number) =>
        tableRef.current?.querySelector<HTMLElement>(
          `[data-sched-row="${row}"][data-sched-col="${col}"]`,
        ) ?? null;

      const focusCell = (element: HTMLElement) => {
        element.focus();
        element.scrollIntoView({ block: "nearest", inline: "nearest" });
        if (element instanceof HTMLInputElement && element.type === "text") {
          element.select();
        }
      };

      const rowCount = navRowCountRef.current;
      const target = event.currentTarget;

      if (event.key === "Tab" || event.key === "Enter") {
        const direction = event.shiftKey ? -1 : 1;
        let row = rowIndex;
        let col = colIndex;
        for (;;) {
          col += direction;
          if (col >= NAV_COLUMN_COUNT) {
            col = 0;
            row += 1;
          } else if (col < 0) {
            col = NAV_COLUMN_COUNT - 1;
            row -= 1;
          }
          if (row < 0 || row >= rowCount) {
            return;
          }
          const element = findCell(row, col);
          if (element) {
            event.preventDefault();
            focusCell(element);
            return;
          }
        }
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const direction = event.key === "ArrowUp" ? -1 : 1;
        for (
          let row = rowIndex + direction;
          row >= 0 && row < rowCount;
          row += direction
        ) {
          const element = findCell(row, colIndex);
          if (element) {
            focusCell(element);
            return;
          }
        }
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        if (target instanceof HTMLInputElement) {
          // Text inputs: only leave at the caret edge. Date/time inputs report
          // null selection, so left/right keep their native segment behavior.
          let selectionStart: number | null = null;
          let selectionEnd: number | null = null;
          try {
            selectionStart = target.selectionStart;
            selectionEnd = target.selectionEnd;
          } catch {
            return;
          }
          if (selectionStart === null || selectionEnd === null) {
            return;
          }
          const length = target.value.length;
          const fullySelected =
            length > 0 && selectionStart === 0 && selectionEnd === length;
          const atEdge =
            direction < 0
              ? selectionStart === 0 && selectionEnd === 0
              : selectionStart === length && selectionEnd === length;
          if (length > 0 && !fullySelected && !atEdge) {
            return;
          }
        }
        for (
          let col = colIndex + direction;
          col >= 0 && col < NAV_COLUMN_COUNT;
          col += direction
        ) {
          const element = findCell(rowIndex, col);
          if (element) {
            event.preventDefault();
            focusCell(element);
            return;
          }
        }
      }
    },
    [],
  );

  function handleSave() {
    setError(null);
    setNotice(null);
    const updates: ScheduleLoadUpdate[] = dirtyIds.map((id) => {
      const row = rows.find((entry) => entry.id === id)!;
      const current = fields[id];
      return {
        ticketId: id,
        deliveryDate: current.deliveryDate.trim() || null,
        deliveryTime: current.deliveryTime.trim() || null,
        truck: current.truck.trim() || null,
        trailer: current.trailer.trim() || null,
        driver: current.driver.trim() || null,
        expectedUpdatedAt: row.expectedUpdatedAt,
      };
    });

    startTransition(async () => {
      const result = await scheduleJobLoads(jobId, updates);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setNotice(
        result.scheduledCount > 0
          ? `Saved — ${result.scheduledCount} load${result.scheduledCount === 1 ? "" : "s"} scheduled.`
          : "Saved.",
      );
      // The parent remounts this editor via key when refreshed rows arrive,
      // which re-baselines the dirty tracking.
      router.refresh();
    });
  }

  function selectOptions(list: string[], currentValue: string) {
    if (currentValue && !list.includes(currentValue)) {
      return [currentValue, ...list];
    }
    return list;
  }

  const inputClassName = `${tableCellInputClassName} min-w-[7rem]`;

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}
      {notice && !dirty ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {notice}
        </div>
      ) : null}

      <div className={tableWrapperClassName}>
        <table ref={tableRef} className={tableClassName}>
          <thead>
            <tr>
              <th className={tableHeaderCellClassName}>Load</th>
              <th className={tableHeaderCellClassName}>Ticket</th>
              <th className={`${tableHeaderCellClassName} min-w-[16rem]`}>Contents</th>
              <th className={`${tableHeaderCellClassName} text-right`}>Items</th>
              <th className={`${tableHeaderCellClassName} text-right`}>Weight</th>
              <th className={tableHeaderCellClassName}>Date</th>
              <th className={tableHeaderCellClassName}>Time</th>
              <th className={tableHeaderCellClassName}>Truck</th>
              <th className={tableHeaderCellClassName}>Trailer</th>
              <th className={tableHeaderCellClassName}>Driver</th>
              <th className={tableHeaderCellClassName}>Status</th>
            </tr>
          </thead>
          <tbody className={tableBodyClassName}>
            {rows.map((row) => {
              const current = fields[row.id] ?? pickFields(row);
              const navRow = navRowIndex.get(row.id);
              const isDirty = dirtyIds.includes(row.id);

              return (
                <tr
                  key={row.id}
                  className={`${tableRowClassName} ${isDirty ? "bg-sky-50/40" : ""}`}
                >
                  <td className={`${tableCellClassName} whitespace-nowrap text-slate-600`}>
                    {row.loadSequence ?? "—"}
                  </td>
                  <td className={`${tableCellClassName} whitespace-nowrap font-mono text-[11px] font-medium`}>
                    <Link
                      href={`/delivery-tickets/${row.id}`}
                      className="text-slate-900 hover:text-sky-700"
                    >
                      {row.ticketNumber}
                    </Link>
                  </td>
                  <td className={`${tableCellClassName} max-w-[24rem] text-slate-600`}>
                    <span className="line-clamp-2">{row.contents || "—"}</span>
                  </td>
                  <td className={tableNumericCellClassName}>{row.totalItems}</td>
                  <td className={`${tableNumericCellClassName} whitespace-nowrap font-medium text-slate-900`}>
                    {row.totalWeight != null ? formatWeightLb(row.totalWeight) : "—"}
                  </td>
                  {row.editable && navRow !== undefined ? (
                    <>
                      <td className={tableGridCellClassName}>
                        <input
                          type="date"
                          value={current.deliveryDate}
                          data-sched-row={navRow}
                          data-sched-col={0}
                          onKeyDown={(event) => handleCellKeyDown(event, navRow, 0)}
                          onChange={(event) =>
                            setField(row.id, "deliveryDate", event.target.value)
                          }
                          className={inputClassName}
                        />
                      </td>
                      <td className={tableGridCellClassName}>
                        <input
                          type="time"
                          value={current.deliveryTime}
                          data-sched-row={navRow}
                          data-sched-col={1}
                          onKeyDown={(event) => handleCellKeyDown(event, navRow, 1)}
                          onChange={(event) =>
                            setField(row.id, "deliveryTime", event.target.value)
                          }
                          className={`${tableCellInputClassName} min-w-[5.5rem]`}
                        />
                      </td>
                      <td className={tableGridCellClassName}>
                        <select
                          value={current.truck}
                          data-sched-row={navRow}
                          data-sched-col={2}
                          onKeyDown={(event) => handleCellKeyDown(event, navRow, 2)}
                          onChange={(event) =>
                            setField(row.id, "truck", event.target.value)
                          }
                          className={`${inputClassName} cursor-pointer`}
                        >
                          <option value="">—</option>
                          {selectOptions(fleetOptions.trucks, current.truck).map(
                            (truck) => (
                              <option key={truck} value={truck}>
                                {truck}
                              </option>
                            ),
                          )}
                        </select>
                      </td>
                      <td className={tableGridCellClassName}>
                        <select
                          value={current.trailer}
                          data-sched-row={navRow}
                          data-sched-col={3}
                          onKeyDown={(event) => handleCellKeyDown(event, navRow, 3)}
                          onChange={(event) =>
                            setField(row.id, "trailer", event.target.value)
                          }
                          className={`${inputClassName} cursor-pointer`}
                        >
                          <option value="">—</option>
                          {selectOptions(fleetOptions.trailers, current.trailer).map(
                            (trailer) => (
                              <option key={trailer} value={trailer}>
                                {trailer}
                              </option>
                            ),
                          )}
                        </select>
                      </td>
                      <td className={tableGridCellClassName}>
                        <select
                          value={current.driver}
                          data-sched-row={navRow}
                          data-sched-col={4}
                          onKeyDown={(event) => handleCellKeyDown(event, navRow, 4)}
                          onChange={(event) =>
                            setField(row.id, "driver", event.target.value)
                          }
                          className={`${inputClassName} cursor-pointer`}
                        >
                          <option value="">—</option>
                          {selectOptions(fleetOptions.drivers, current.driver).map(
                            (driver) => (
                              <option key={driver} value={driver}>
                                {driver}
                              </option>
                            ),
                          )}
                        </select>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className={`${tableCellClassName} whitespace-nowrap text-slate-500`}>
                        {row.deliveryDate || "—"}
                      </td>
                      <td className={`${tableCellClassName} text-slate-500`}>
                        {row.deliveryTime || "—"}
                      </td>
                      <td className={`${tableCellClassName} text-slate-500`}>
                        {row.truck || "—"}
                      </td>
                      <td className={`${tableCellClassName} text-slate-500`}>
                        {row.trailer || "—"}
                      </td>
                      <td className={`${tableCellClassName} text-slate-500`}>
                        {row.driver || "—"}
                      </td>
                    </>
                  )}
                  <td className={tableCellClassName}>
                    <StatusBadge
                      label={deliveryTicketStatusLabels[row.status]}
                      variant={row.statusVariant}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
        <div className="text-xs text-slate-600">
          {dirty ? (
            <>
              <span className="font-semibold text-slate-800">
                {dirtyIds.length} unsaved change{dirtyIds.length === 1 ? "" : "s"}
              </span>
              {willSchedule > 0 ? (
                <span className="ml-2 text-sky-700">
                  {willSchedule} draft load{willSchedule === 1 ? "" : "s"} will be
                  scheduled on save
                </span>
              ) : null}
            </>
          ) : (
            "Set a delivery date to schedule a draft load. Drafts without dates stay drafts."
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || pending}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save Schedule"}
        </button>
      </div>
    </div>
  );
}
