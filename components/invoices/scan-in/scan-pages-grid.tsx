"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BAND_ORDER,
  ResultPill,
  ScanCardHead,
  cellButtonClassName,
  cellLinkClassName,
  pluralize,
  rowResult,
  scanCardClassName,
} from "@/components/invoices/scan-in/scan-ui";
import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableHeaderCellPinnedClassName,
  tablePinnedCellClassName,
} from "@/lib/table-styles";
import type {
  ScanInRow,
  ScanInRowBand,
  ScanInSuggestion,
} from "@/lib/ticket-scan/view-types";
import { selectedFillClassName } from "@/lib/selected-styles";

/** A change to the answers kept for one ticket; null takes an answer back. */
export type ScanChoicePatch = {
  already?: "replace" | "skip" | null;
  missing?: "file" | null;
  cancelled?: "file" | "skip" | null;
  deliver?: boolean | null;
};

export type ScanGridActions = {
  /** Resolves to what went wrong, or null when the number was taken. */
  setTicket: (
    row: ScanInRow,
    ticketNumber: string,
    via: "typed" | "above",
  ) => Promise<string | null>;
  clearTicket: (row: ScanInRow) => void;
  setSkipped: (row: ScanInRow, skipped: boolean) => void;
  notBlank: (row: ScanInRow) => void;
  useThisCopy: (row: ScanInRow) => void;
  /** Resolves once the server has answered, whether or not it took. */
  choose: (row: ScanInRow, patch: ScanChoicePatch) => Promise<void>;
};

const SUGGESTIONS_ID = "scan-in-ticket-suggestions";

const bandLabels: Record<ScanInRowBand, string> = {
  needs: "Needs you",
  reading: "Reading",
  ready: "Ready",
  filed: "Filed",
  left: "Left out",
};

const bandTextClassNames: Record<ScanInRowBand, string> = {
  needs: "text-amber-800",
  reading: "text-sky-800",
  ready: "text-emerald-800",
  filed: "text-emerald-800",
  left: "text-slate-500",
};

export function ticketInputId(rowKey: string): string {
  return `scan-ticket-${rowKey}`;
}

/**
 * "Pages in this scan": one row per scanned page, the ones that need a person
 * on top. Click a row to see its page beside the grid.
 */
export function ScanPagesGrid({
  rows,
  selectedKey,
  onSelect,
  canFile,
  busy,
  suggestions,
  actions,
  focusKey,
  title,
  hint,
}: {
  /** Already in grid order (orderRows). */
  rows: ScanInRow[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  canFile: boolean;
  /** A change is being saved: buttons wait. */
  busy: boolean;
  suggestions: ScanInSuggestion[];
  actions: ScanGridActions;
  /** Put the cursor in this row's ticket box (after the row above was fixed). */
  focusKey: string | null;
  title: string;
  hint: string;
}) {
  useEffect(() => {
    if (!focusKey) {
      return;
    }
    const input = document.getElementById(ticketInputId(focusKey));
    if (input instanceof HTMLInputElement) {
      input.focus();
    }
  }, [focusKey]);

  function moveSelection(delta: number) {
    const at = rows.findIndex((row) => row.key === selectedKey);
    const next = rows[Math.min(rows.length - 1, Math.max(0, at + delta))];
    if (next) {
      onSelect(next.key);
      document.getElementById(`scan-row-${next.key}`)?.focus();
    }
  }

  return (
    <section className={scanCardClassName}>
      <ScanCardHead title={title} hint={hint} />
      <div className={tableFlushWrapperClassName}>
        <table className={tableClassName}>
          <thead>
            <tr>
              <th className={tableHeaderCellClassName}>Pg</th>
              <th className={tableHeaderCellClassName}>Ticket</th>
              <th className={tableHeaderCellClassName}>Result</th>
              <th className={tableHeaderCellClassName}>Copy</th>
              <th className={tableHeaderCellClassName}>Sheet</th>
              <th className={tableHeaderCellClassName}>Customer and project</th>
              <th className={tableHeaderCellClassName}>Ticket status</th>
              <th className={tableHeaderCellPinnedClassName}>Deliver</th>
            </tr>
          </thead>
          <tbody className={tableBodyClassName}>
            {BAND_ORDER.map((band) => {
              const bandRows = rows.filter((row) => row.band === band);
              if (bandRows.length === 0) {
                return null;
              }
              return (
                <BandRows
                  key={band}
                  band={band}
                  rows={bandRows}
                  selectedKey={selectedKey}
                  onSelect={onSelect}
                  onMove={moveSelection}
                  canFile={canFile}
                  busy={busy}
                  actions={actions}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      <datalist id={SUGGESTIONS_ID}>
        {suggestions.map((suggestion) => (
          <option
            key={suggestion.ticketNumber}
            value={suggestion.ticketNumber}
            label={suggestion.label}
          />
        ))}
      </datalist>
    </section>
  );
}

function BandRows({
  band,
  rows,
  selectedKey,
  onSelect,
  onMove,
  canFile,
  busy,
  actions,
}: {
  band: ScanInRowBand;
  rows: ScanInRow[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onMove: (delta: number) => void;
  canFile: boolean;
  busy: boolean;
  actions: ScanGridActions;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={8}
          className={`border-b border-slate-300 bg-slate-100 px-2 py-1 text-2xs font-semibold ${bandTextClassNames[band]}`}
        >
          {bandLabels[band]} · {pluralize(rows.length, "page")}
        </td>
      </tr>
      {rows.map((row) => (
        <PageRow
          key={row.key}
          row={row}
          selected={row.key === selectedKey}
          onSelect={onSelect}
          onMove={onMove}
          canFile={canFile}
          busy={busy}
          actions={actions}
        />
      ))}
    </>
  );
}

function PageRow({
  row,
  selected,
  onSelect,
  onMove,
  canFile,
  busy,
  actions,
}: {
  row: ScanInRow;
  selected: boolean;
  onSelect: (key: string) => void;
  onMove: (delta: number) => void;
  canFile: boolean;
  busy: boolean;
  actions: ScanGridActions;
}) {
  const editable = canFile && row.from === "open";
  const muted = row.band === "left";
  // The Deliver box changes the moment it is clicked; the server's answer
  // (a few hundred milliseconds later) then takes over.
  const [deliverClicked, setDeliverClicked] = useState<boolean | null>(null);
  const cell = `${tableCellClassName} ${selected ? "bg-sky-50" : ""} ${muted ? "text-slate-400" : ""}`;

  return (
    <tr
      id={`scan-row-${row.key}`}
      tabIndex={0}
      aria-selected={selected}
      onClick={() => onSelect(row.key)}
      onKeyDown={(event) => {
        // Keys typed into a box or a button inside the row are theirs.
        if (event.target !== event.currentTarget) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(row.key);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          onMove(1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          onMove(-1);
        }
      }}
      className="group cursor-pointer align-top outline-none hover:bg-slate-50/60 focus-visible:bg-sky-50/60"
    >
      <td
        className={`${cell} whitespace-nowrap tabular-nums ${
          selected ? "shadow-[inset_3px_0_0_#0284c7]" : ""
        }`}
      >
        {row.pgLabel}
      </td>
      <td className={`${cell} whitespace-nowrap`}>
        <TicketCell row={row} editable={editable} busy={busy} actions={actions} />
      </td>
      <td className={`${cell} min-w-[12rem]`}>
        <ResultCell row={row} editable={editable} busy={busy} actions={actions} />
      </td>
      <td className={`${cell} whitespace-nowrap`}>{row.copy}</td>
      <td className={`${cell} whitespace-nowrap`}>{row.sheet}</td>
      <td className={`${cell} min-w-[10rem]`}>
        {row.customerName}
        {row.projectName ? (
          <span className={`block ${muted ? "" : "text-slate-500"}`}>
            {row.projectName}
          </span>
        ) : null}
      </td>
      <td className={`${cell} whitespace-nowrap`}>{row.statusLabel}</td>
      <td
        className={`${cell} ${tablePinnedCellClassName} ${
          selected ? "" : "bg-white group-hover:bg-slate-50"
        }`}
      >
        {row.deliver !== null && row.ticketNumber ? (
          <input
            type="checkbox"
            checked={deliverClicked ?? row.deliver}
            disabled={!editable || busy}
            aria-label={`Mark ${row.ticketNumber} delivered when it is filed`}
            title="Mark the ticket delivered when it is filed, which makes its invoice"
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              const ticked = event.target.checked;
              setDeliverClicked(ticked);
              void actions
                .choose(row, { deliver: ticked ? null : false })
                .finally(() => setDeliverClicked(null));
            }}
            className="h-4 w-4 accent-slate-900"
          />
        ) : null}
      </td>
    </tr>
  );
}

function TicketCell({
  row,
  editable,
  busy,
  actions,
}: {
  row: ScanInRow;
  editable: boolean;
  busy: boolean;
  actions: ScanGridActions;
}) {
  const needsNumber = row.kind === "notRead" || row.kind === "notHere";

  if (editable && needsNumber) {
    return (
      <div className="flex flex-col items-start gap-1">
        {row.ticketNumber ? (
          <span className="text-slate-500">Code says {row.ticketNumber}</span>
        ) : null}
        <TicketNumberBox row={row} busy={busy} actions={actions} />
        {row.aboveTicketNumber ? (
          <button
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              void actions.setTicket(row, row.aboveTicketNumber!, "above");
            }}
            className={cellButtonClassName}
          >
            Same as above ({row.aboveTicketNumber})
          </button>
        ) : null}
      </div>
    );
  }

  if (!row.ticketNumber) {
    return null;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {row.ticketId ? (
        <Link
          href={`/delivery-tickets/${row.ticketId}`}
          onClick={(event) => event.stopPropagation()}
          className="font-semibold text-slate-900 underline decoration-slate-300 hover:decoration-slate-600"
        >
          {row.ticketNumber}
        </Link>
      ) : (
        <span className="font-semibold">{row.ticketNumber}</span>
      )}
      {editable && row.typed ? (
        <button
          type="button"
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            actions.clearTicket(row);
          }}
          className={cellLinkClassName}
        >
          Change
        </button>
      ) : null}
    </div>
  );
}

function TicketNumberBox({
  row,
  busy,
  actions,
}: {
  row: ScanInRow;
  busy: boolean;
  actions: ScanGridActions;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const value = draft.trim();
    if (!value || saving) {
      return;
    }
    setSaving(true);
    const problem = await actions.setTicket(row, value, "typed");
    setSaving(false);
    setError(problem);
  }

  return (
    <>
      <input
        id={ticketInputId(row.key)}
        type="text"
        value={draft}
        list={SUGGESTIONS_ID}
        autoComplete="off"
        placeholder="T#####"
        disabled={saving}
        aria-label={`Ticket number for page ${row.pgLabel}`}
        aria-invalid={error != null}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
        }}
        onBlur={() => {
          // Picking from the list fills the box without Enter.
          if (!busy) {
            void submit();
          }
        }}
        className={`w-24 rounded border bg-white px-1.5 py-0.5 text-xs font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500 ${
          error ? "border-red-400" : "border-amber-400"
        }`}
      />
      {error ? (
        <span className="max-w-[14rem] whitespace-normal text-2xs font-medium text-red-700">
          {error}
        </span>
      ) : null}
    </>
  );
}

/** Two or three choices side by side; the one in force is dark. */
function ChoiceButtons<T extends string>({
  label,
  options,
  current,
  disabled,
  onPick,
}: {
  label: string;
  options: ReadonlyArray<readonly [T, string]>;
  current: T | null;
  disabled: boolean;
  onPick: (value: T) => void;
}) {
  return (
    <span
      role="group"
      aria-label={label}
      className="inline-flex overflow-hidden rounded border border-slate-300 text-2xs font-medium"
    >
      {options.map(([value, text], index) => (
        <button
          key={value}
          type="button"
          disabled={disabled}
          aria-pressed={current === value}
          onClick={(event) => {
            event.stopPropagation();
            onPick(value);
          }}
          className={`px-2 py-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${
            index > 0 ? "border-l border-slate-300" : ""
          } ${
            current === value
              ? selectedFillClassName
              : "bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {text}
        </button>
      ))}
    </span>
  );
}

function ResultCell({
  row,
  editable,
  busy,
  actions,
}: {
  row: ScanInRow;
  editable: boolean;
  busy: boolean;
  actions: ScanGridActions;
}) {
  const result = rowResult(row);
  // "Page 2 missing" is the pill itself; elsewhere the detail is small print.
  const detail = row.kind === "missing" ? null : row.detail;
  const small = [detail, ...row.notes].filter(Boolean) as string[];

  function button(label: string, onClick: () => void, title?: string) {
    return (
      <button
        type="button"
        disabled={busy}
        title={title}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className={cellButtonClassName}
      >
        {label}
      </button>
    );
  }

  let controls: React.ReactNode = null;
  if (editable) {
    if (row.kind === "notRead" || row.kind === "notHere") {
      controls = button(
        "Skip page",
        () => actions.setSkipped(row, true),
        "Leave this page out. It is not filed anywhere.",
      );
    } else if (row.kind === "skipped") {
      controls = button("Put back", () => actions.setSkipped(row, false));
    } else if (row.kind === "blank") {
      controls = button(
        "Not blank",
        () => actions.notBlank(row),
        "This page has something on it: bring it back so it can be filed.",
      );
    } else if (row.kind === "extra") {
      controls = button(
        "Use this copy",
        () => actions.useThisCopy(row),
        "File this page instead of the other copy of the same sheet.",
      );
    } else if (row.kind === "already" && row.lead) {
      controls = (
        <>
          <ChoiceButtons
            label={`${row.ticketNumber} already has a signed copy`}
            options={[
              ["replace", "Replace"],
              ["skip", "Skip"],
            ]}
            current={null}
            disabled={busy}
            onPick={(value) => void actions.choose(row, { already: value })}
          />
          {row.onFileUrl ? (
            <a
              href={row.onFileUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className={cellLinkClassName}
            >
              View the copy on file
            </a>
          ) : null}
        </>
      );
    } else if (row.kind === "missing" && row.lead) {
      controls = (
        <ChoiceButtons
          label={`${row.ticketNumber} is missing a page`}
          options={[
            ["hold", "Hold"],
            ["file", "File as is"],
          ]}
          current="hold"
          disabled={busy}
          onPick={(value) => {
            // "Hold" is how the ticket already stands.
            if (value === "file") {
              void actions.choose(row, { missing: "file" });
            }
          }}
        />
      );
    } else if (row.kind === "cancelled" && row.lead) {
      controls = (
        <ChoiceButtons
          label={`${row.ticketNumber} is cancelled`}
          options={[
            ["file", "File anyway"],
            ["skip", "Skip"],
          ]}
          current={null}
          disabled={busy}
          onPick={(value) => void actions.choose(row, { cancelled: value })}
        />
      );
    } else if (row.lead && (row.decided || row.kind === "leftOut")) {
      controls = button(
        "Change",
        () =>
          void actions.choose(row, {
            already: null,
            missing: null,
            cancelled: null,
          }),
        "Take that answer back",
      );
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <ResultPill label={result.label} tone={result.tone} />
      {small.map((text) => (
        <span key={text} className="text-2xs text-slate-500">
          {text}
        </span>
      ))}
      {controls}
    </div>
  );
}
