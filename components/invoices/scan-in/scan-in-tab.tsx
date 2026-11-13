"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  cancelStillOutTicketAction,
  clearTicketScanPageTicket,
  closeStillOutTicketAction,
  discardTicketScan,
  fileTicketScan,
  markTicketScanPageNotBlank,
  moveStillOutTicketDateAction,
  pickTicketScanPageCopy,
  readTicketScanPages,
  refreshScanIn,
  removeTicketScanFile,
  reopenStillOutTicketAction,
  restoreStillOutTicketDateAction,
  setTicketScanChoice,
  setTicketScanPageSkipped,
  setTicketScanPageTicket,
  turnTicketScanPage,
  uploadTicketScans,
} from "@/app/invoices/scan-actions";
import { ScanFiledInvoices } from "@/components/invoices/scan-in/scan-filed-invoices";
import {
  ScanPagesGrid,
  type ScanGridActions,
} from "@/components/invoices/scan-in/scan-pages-grid";
import { ScanPaperPreview } from "@/components/invoices/scan-in/scan-paper-preview";
import {
  ScanStillOut,
  type StillOutDone,
} from "@/components/invoices/scan-in/scan-still-out";
import {
  ScanCardHead,
  barButtonClassName,
  barPrimaryButtonClassName,
  cellLinkClassName,
  orderRows,
  pluralize,
  scanCardClassName,
} from "@/components/invoices/scan-in/scan-ui";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { describeActionFailure } from "@/lib/action-result";
import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";
import type {
  ScanInActionResult,
  ScanInEarlierScan,
  ScanInFiledTicket,
  ScanInOpenScan,
  ScanInRow,
  ScanInStillOutRow,
  ScanInView,
} from "@/lib/ticket-scan/view-types";

type Side = "ticket" | "invoice";

/** A warning stays up long enough to be read. */
const WARNING_TOAST_MS = 15_000;
/** Same limit the server keeps (lib/ticket-scan/service.ts). */
const MAX_UPLOAD_BYTES = 90 * 1024 * 1024;
/** A screen older than this when it appears (Back button) asks again. */
const STALE_AFTER_MS = 15_000;
/** Reading gives up after this many tries that read nothing new. */
const MAX_READ_STALLS = 3;

function isError(
  result: ScanInActionResult,
): result is Extract<ScanInActionResult, { error: string }> {
  return "error" in result;
}

/** "2026-11-14" → "11-14-2026" */
function dashedDate(input: string): string {
  const [year, month, day] = input.split("-");
  return year && month && day ? `${month}-${day}-${year}` : input;
}

function showInAddressBar(filedScanId: string | null): void {
  // Only the address changes, so a reload or a bookmark shows the same thing.
  window.history.replaceState(
    null,
    "",
    filedScanId ? `/invoices?scan=${filedScanId}` : "/invoices",
  );
}

/**
 * Invoices → Scan In. Drop the day's scan of signed tickets; the app reads
 * the code on every page, sorts the pages by ticket, and File saves one
 * signed PDF per ticket, marks the tickets delivered and makes the invoices.
 *
 * Every action returns the fresh screen, so nothing here reloads the page.
 */
export function ScanInTab({
  initialView,
  initialViewing,
  onInvoiceCount,
}: {
  initialView: ScanInView;
  /** The filed scan the address asks for (?scan=…), if any. */
  initialViewing: string | null;
  /** Tells the tab bar how many invoices there are now. */
  onInvoiceCount?: (count: number) => void;
}) {
  const confirm = useConfirm();
  const [view, setView] = useState(initialView);
  const [viewing, setViewing] = useState<string | null>(initialViewing);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [side, setSide] = useState<Side>("ticket");
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragDepth, setDragDepth] = useState(0);
  const [readProblem, setReadProblem] = useState<string | null>(null);
  const [readRound, setReadRound] = useState(0);
  const [stillOutDone, setStillOutDone] = useState<Record<string, StillOutDone>>(
    {},
  );
  const fileInput = useRef<HTMLInputElement>(null);

  const busy = pending > 0;
  const canFile = view.canFile;
  const open = view.showingOpen ? view.open : null;
  const filed = view.filed;
  const rows = orderRows(view.rows);
  const selectedRow =
    rows.find((row) => row.key === selectedKey) ?? rows[0] ?? null;
  const selectedAt = selectedRow ? rows.indexOf(selectedRow) : -1;

  // The newest callback, without making applyView a new function each time
  // the tab bar draws (the reading loop below would start over).
  const reportInvoiceCount = useRef(onInvoiceCount);
  useEffect(() => {
    reportInvoiceCount.current = onInvoiceCount;
  }, [onInvoiceCount]);

  const applyView = useCallback((next: ScanInView) => {
    // An answer that left before a newer one came back is out of date.
    setView((current) =>
      current.open &&
      next.open &&
      current.open.id === next.open.id &&
      next.open.version < current.open.version
        ? current
        : next,
    );
    reportInvoiceCount.current?.(next.invoiceCount);
  }, []);

  async function runAction(
    call: () => Promise<ScanInActionResult>,
    options: { quiet?: boolean; inlineError?: boolean } = {},
  ): Promise<ScanInActionResult | null> {
    setPending((count) => count + 1);
    try {
      const result = await call();
      if (isError(result)) {
        if (result.view) {
          applyView(result.view);
        }
        if (!options.inlineError && !result.needsInvoiceRemoval) {
          toast.error(result.error);
        }
        return result;
      }
      applyView(result.view);
      if (result.warning) {
        toast.warning(result.warning, { duration: WARNING_TOAST_MS });
      }
      if (result.notice && !options.quiet) {
        toast.success(result.notice);
      }
      return result;
    } catch (error) {
      toast.error(
        describeActionFailure(error, "That did not save. Try again."),
      );
      return null;
    } finally {
      setPending((count) => count - 1);
    }
  }

  // A screen restored by the Back button can be old: ask for the current
  // one, once for each screen the server hands over.
  const checkedLoadedAt = useRef<number | null>(null);
  useEffect(() => {
    if (checkedLoadedAt.current === initialView.loadedAt) {
      return;
    }
    checkedLoadedAt.current = initialView.loadedAt;
    if (Math.abs(Date.now() - initialView.loadedAt) < STALE_AFTER_MS) {
      return;
    }
    void (async () => {
      try {
        const result = await refreshScanIn(viewing);
        if (!isError(result)) {
          applyView(result.view);
        }
      } catch {
        // The screen still works from what it has.
      }
    })();
  }, [initialView.loadedAt, viewing, applyView]);

  // Reading: ask the server for the next few pages until none are waiting.
  const openId = view.open?.id ?? null;
  const shouldRead =
    canFile &&
    view.open != null &&
    view.open.counts.reading > 0 &&
    !view.open.filing;
  useEffect(() => {
    if (!shouldRead || !openId) {
      return;
    }
    let stopped = false;
    void (async () => {
      let left = Number.POSITIVE_INFINITY;
      let stalls = 0;
      while (!stopped) {
        let result: ScanInActionResult;
        try {
          result = await readTicketScanPages(openId, viewing);
        } catch (error) {
          if (!stopped) {
            setReadProblem(
              describeActionFailure(error, "Reading the scan stopped."),
            );
          }
          return;
        }
        if (stopped) {
          return;
        }
        if (isError(result)) {
          if (result.view) {
            applyView(result.view);
          }
          setReadProblem(result.error);
          return;
        }
        applyView(result.view);
        const nowLeft =
          result.view.open?.id === openId ? result.view.open.counts.reading : 0;
        if (nowLeft === 0) {
          setReadProblem(null);
          return;
        }
        stalls = nowLeft < left ? 0 : stalls + 1;
        left = nowLeft;
        if (stalls >= MAX_READ_STALLS) {
          setReadProblem(
            `${pluralize(nowLeft, "page")} could not be read. Try again, or remove the scan and drop it again.`,
          );
          return;
        }
      }
    })();
    return () => {
      stopped = true;
    };
  }, [shouldRead, openId, viewing, readRound, applyView]);

  // ------------------------------------------------------------------------
  // The scan itself
  // ------------------------------------------------------------------------

  async function upload(files: File[]) {
    if (files.length === 0 || uploading) {
      return;
    }
    const tooBig = files.find((file) => file.size > MAX_UPLOAD_BYTES);
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (tooBig || total > MAX_UPLOAD_BYTES) {
      toast.error(
        `${tooBig ? tooBig.name : "That"} is too big to drop at once (the limit is 90 MB). Scan the stack in two parts.`,
      );
      return;
    }
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }
    setUploading(true);
    const result = await runAction(() => uploadTicketScans(formData));
    setUploading(false);
    if (result && !isError(result)) {
      setReadProblem(null);
      if (viewing !== null) {
        setViewing(null);
        showInAddressBar(null);
      }
    }
  }

  async function removeScan(scan: ScanInOpenScan) {
    const ok = await confirm({
      title: "Remove this scan?",
      message: `${pluralize(scan.counts.pages, "page")} come off the screen and the uploaded PDF is deleted. Nothing on them is filed. Tickets already filed stay filed.`,
      confirmLabel: "Remove Scan",
      variant: "danger",
    });
    if (ok) {
      await runAction(() => discardTicketScan(scan.id, viewing));
    }
  }

  async function removeFile(scan: ScanInOpenScan, sourceId: string) {
    const source = scan.sources.find((entry) => entry.id === sourceId);
    if (!source) {
      return;
    }
    const ok = await confirm({
      title: `Remove ${source.fileName}?`,
      message: `Its ${pluralize(source.pageCount, "page")} come off the scan. Nothing on them is filed.`,
      confirmLabel: "Remove File",
      variant: "danger",
    });
    if (ok) {
      await runAction(() => removeTicketScanFile(scan.id, sourceId, viewing));
    }
  }

  async function fileScan(scan: ScanInOpenScan) {
    if (scan.counts.ticketsToFile === 0) {
      const ok = await confirm({
        title: `Clear ${pluralize(scan.leftOutToClear, "left-out page")}?`,
        message:
          "They come off the scan and are not filed anywhere. Pages that still need you stay.",
        confirmLabel: "Clear Pages",
      });
      if (!ok) {
        return;
      }
    }
    const result = await runAction(() =>
      fileTicketScan(scan.id, scan.version, viewing),
    );
    if (!result || isError(result)) {
      return;
    }
    const nowFiled = result.view.filed;
    if (!nowFiled || nowFiled.id === viewing) {
      return;
    }
    setViewing(nowFiled.id);
    showInAddressBar(nowFiled.id);
    toast.success(`Filed ${pluralize(nowFiled.counts.tickets, "signed ticket")}.`);
    // Show the first invoice beside its signed ticket, ready to check.
    const firstWithInvoice =
      nowFiled.tickets.find((ticket) => ticket.invoice) ?? nowFiled.tickets[0];
    const firstRow = firstWithInvoice
      ? result.view.rows.find(
          (row) =>
            row.from === "filed" &&
            row.lead &&
            row.ticketId === firstWithInvoice.ticketId,
        )
      : undefined;
    if (firstRow) {
      setSelectedKey(firstRow.key);
      setSide(firstRow.invoice ? "invoice" : "ticket");
    }
    window.requestAnimationFrame(() => {
      document
        .getElementById("scan-in-invoices")
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  async function refresh() {
    setReadProblem(null);
    const result = await runAction(() => refreshScanIn(viewing));
    if (result && !isError(result)) {
      setReadRound((round) => round + 1);
    }
  }

  // ------------------------------------------------------------------------
  // One page
  // ------------------------------------------------------------------------

  /**
   * A change to one row. When it takes the row out of "Needs you", the next
   * row that needs a person is picked, so a run of them can be worked down
   * without going back to the mouse.
   */
  async function rowAction(
    row: ScanInRow,
    call: () => Promise<ScanInActionResult>,
    options: { inlineError?: boolean } = {},
  ): Promise<string | null> {
    const result = await runAction(call, options);
    if (!result) {
      return "That did not save. Try again.";
    }
    if (isError(result)) {
      return result.error;
    }
    if (row.band === "needs") {
      const after = result.view.rows.find((entry) => entry.key === row.key);
      if (!after || after.band !== "needs") {
        const waiting = orderRows(result.view.rows).filter(
          (entry) => entry.band === "needs",
        );
        const next =
          waiting.find((entry) => entry.seq > row.seq) ?? waiting[0] ?? null;
        if (next) {
          setSelectedKey(next.key);
          setSide("ticket");
          setFocusKey(
            next.kind === "notRead" || next.kind === "notHere" ? next.key : null,
          );
        }
      }
    }
    return null;
  }

  const gridActions: ScanGridActions = {
    setTicket: (row, ticketNumber, via) =>
      open
        ? rowAction(
            row,
            () =>
              setTicketScanPageTicket(open.id, row.seq, ticketNumber, via, viewing),
            { inlineError: via === "typed" },
          )
        : Promise.resolve(null),
    clearTicket: (row) => {
      if (open) {
        void rowAction(row, () =>
          clearTicketScanPageTicket(open.id, row.seq, viewing),
        );
      }
    },
    setSkipped: (row, skipped) => {
      if (open) {
        void rowAction(row, () =>
          setTicketScanPageSkipped(open.id, row.seq, skipped, viewing),
        );
      }
    },
    notBlank: (row) => {
      if (open) {
        void rowAction(row, () =>
          markTicketScanPageNotBlank(open.id, row.seq, viewing),
        );
      }
    },
    useThisCopy: (row) => {
      if (open) {
        void rowAction(row, () =>
          pickTicketScanPageCopy(open.id, row.seq, viewing),
        );
      }
    },
    choose: async (row, patch) => {
      if (open && row.ticketNumber) {
        const ticketNumber = row.ticketNumber;
        await rowAction(row, () =>
          setTicketScanChoice(open.id, ticketNumber, patch, viewing),
        );
      }
    },
  };

  function selectRow(key: string) {
    setSelectedKey(key);
    setSide("ticket");
    setFocusKey(null);
  }

  function step(delta: number) {
    const next = rows[selectedAt + delta];
    if (next) {
      setSelectedKey(next.key);
      setFocusKey(null);
    }
  }

  function pickFiledTicket(ticket: ScanInFiledTicket) {
    const row = rows.find(
      (entry) =>
        entry.from === "filed" && entry.lead && entry.ticketId === ticket.ticketId,
    );
    if (row) {
      setSelectedKey(row.key);
      setSide(row.invoice ? "invoice" : "ticket");
      setFocusKey(null);
    }
  }

  // ------------------------------------------------------------------------
  // Still Out
  // ------------------------------------------------------------------------

  function remember(
    row: ScanInStillOutRow,
    index: number,
    outcome: Omit<StillOutDone, "row" | "index">,
  ) {
    setStillOutDone((current) => ({
      ...current,
      [row.ticketId]: { row, index, ...outcome },
    }));
  }

  function forget(ticketId: string) {
    setStillOutDone((current) => {
      const next = { ...current };
      delete next[ticketId];
      return next;
    });
  }

  async function closeStillOut(row: ScanInStillOutRow, index: number) {
    const result = await runAction(
      () => closeStillOutTicketAction(row.ticketId, viewing),
      { quiet: true },
    );
    if (!result || isError(result)) {
      return;
    }
    const undo = result.undo?.kind === "closed" ? result.undo : null;
    remember(row.delivered ? row : { ...row, statusLabel: "Delivered" }, index, {
      pill: row.delivered ? "No signed copy" : "Marked delivered",
      tone: "ok",
      text: undo?.invoiceNumber
        ? `Invoice ${undo.invoiceNumber} made.`
        : row.delivered || row.signedNotDelivered
          ? null
          : "No signed copy.",
      invoice:
        undo?.invoiceId && undo.invoiceNumber
          ? { id: undo.invoiceId, invoiceNumber: undo.invoiceNumber }
          : null,
      undo,
    });
  }

  async function moveStillOut(
    row: ScanInStillOutRow,
    index: number,
    newDate: string,
  ) {
    const result = await runAction(
      () => moveStillOutTicketDateAction(row.ticketId, newDate, viewing),
      { quiet: true },
    );
    if (!result || isError(result)) {
      return;
    }
    remember(row, index, {
      pill: `Moved to ${dashedDate(newDate)}`,
      tone: "muted",
      text: null,
      invoice: null,
      undo: result.undo ?? null,
    });
  }

  async function cancelStillOut(row: ScanInStillOutRow, index: number) {
    const ok = await confirm({
      title: `Cancel ticket ${row.ticketNumber}?`,
      message:
        "The ticket is marked cancelled and comes off the delivery schedule. Scan In cannot undo this.",
      confirmLabel: "Cancel Ticket",
      cancelLabel: "Keep Ticket",
      variant: "danger",
    });
    if (!ok) {
      return;
    }
    const result = await runAction(
      () => cancelStillOutTicketAction(row.ticketId, viewing),
      { quiet: true },
    );
    if (!result || isError(result)) {
      return;
    }
    remember({ ...row, statusLabel: "Cancelled" }, index, {
      pill: "Cancelled",
      tone: "muted",
      text: null,
      invoice: null,
      undo: null,
    });
  }

  async function undoStillOut(entry: StillOutDone) {
    const undo = entry.undo;
    if (!undo) {
      return;
    }
    const ticketNumber = entry.row.ticketNumber;
    if (undo.kind === "moved") {
      const result = await runAction(
        () =>
          restoreStillOutTicketDateAction(
            undo.ticketId,
            undo.previousDate,
            viewing,
          ),
        { quiet: true },
      );
      if (result && !isError(result)) {
        forget(undo.ticketId);
      }
      return;
    }

    let removeInvoice = false;
    if (undo.wasMarkedDelivered) {
      const ok = await confirm({
        title: `Undo ${ticketNumber}?`,
        message: undo.invoiceNumber
          ? `${ticketNumber} goes back to not delivered and invoice ${undo.invoiceNumber} is deleted.`
          : `${ticketNumber} goes back to not delivered.`,
        confirmLabel: undo.invoiceNumber ? "Undo and Delete Invoice" : "Undo",
        variant: undo.invoiceNumber ? "danger" : "default",
      });
      if (!ok) {
        return;
      }
      removeInvoice = undo.invoiceNumber != null;
    }
    let result = await runAction(
      () =>
        reopenStillOutTicketAction(
          undo.ticketId,
          {
            undoDelivery: undo.wasMarkedDelivered,
            removeUnpaidInvoice: removeInvoice,
          },
          viewing,
        ),
      { quiet: true },
    );
    if (result && isError(result) && result.needsInvoiceRemoval) {
      const ok = await confirm({
        title: "Delete the invoice too?",
        message: `Undoing the delivery of ${ticketNumber} deletes invoice ${result.needsInvoiceRemoval.invoiceNumber}, which is not paid.`,
        confirmLabel: "Undo and Delete Invoice",
        variant: "danger",
      });
      if (!ok) {
        return;
      }
      result = await runAction(
        () =>
          reopenStillOutTicketAction(
            undo.ticketId,
            { undoDelivery: true, removeUnpaidInvoice: true },
            viewing,
          ),
        { quiet: true },
      );
    }
    if (result && !isError(result)) {
      forget(undo.ticketId);
    }
  }

  // ------------------------------------------------------------------------
  // Dropping a scan anywhere on the tab
  // ------------------------------------------------------------------------

  function carriesFiles(event: React.DragEvent): boolean {
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  const dropHandlers = canFile
    ? {
        onDragEnter: (event: React.DragEvent) => {
          if (carriesFiles(event)) {
            event.preventDefault();
            setDragDepth((depth) => depth + 1);
          }
        },
        onDragOver: (event: React.DragEvent) => {
          if (carriesFiles(event)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }
        },
        onDragLeave: (event: React.DragEvent) => {
          if (carriesFiles(event)) {
            setDragDepth((depth) => Math.max(0, depth - 1));
          }
        },
        onDrop: (event: React.DragEvent) => {
          if (carriesFiles(event)) {
            event.preventDefault();
            setDragDepth(0);
            void upload(Array.from(event.dataTransfer.files));
          }
        },
      }
    : {};

  const chooseFiles = () => fileInput.current?.click();
  const waitingElsewhere =
    filed && !view.showingOpen && view.open ? view.open.counts.pages : 0;

  const previewActions =
    canFile && open && selectedRow?.from === "open" && selectedRow.kind !== "reading" ? (
      <>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void rowAction(selectedRow, () =>
              turnTicketScanPage(open.id, selectedRow.seq, viewing),
            )
          }
          title="Turn the page a quarter turn. It is filed the way it shows here."
          className={`${barButtonClassName} px-2.5 py-1`}
        >
          Turn
        </button>
        {selectedRow.kind === "skipped" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => gridActions.setSkipped(selectedRow, false)}
            className={`${barButtonClassName} px-2.5 py-1`}
          >
            Put Back
          </button>
        ) : selectedRow.kind === "notRead" || selectedRow.kind === "notHere" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => gridActions.setSkipped(selectedRow, true)}
            className={`${barButtonClassName} px-2.5 py-1`}
          >
            Skip Page
          </button>
        ) : null}
        {selectedRow.kind === "notRead" ? (
          <span className="text-xs text-slate-500">
            Type the ticket number in the grid, or skip the page.
          </span>
        ) : null}
      </>
    ) : null;

  return (
    <div className="relative space-y-3" {...dropHandlers}>
      {canFile ? (
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void upload(files);
          }}
        />
      ) : null}

      {dragDepth > 0 ? (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-start justify-items-center rounded-xl border-2 border-dashed border-sky-500 bg-sky-50/80 pt-24">
          <p className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-sky-900 shadow">
            {open ? "Drop to add it to this scan" : "Drop the scan here"}
          </p>
        </div>
      ) : null}

      {!canFile ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          You can look at Scan In. Filing signed tickets takes both the invoice
          and the delivery permission.
        </p>
      ) : null}

      {waitingElsewhere > 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          This is an earlier scan. {pluralize(waitingElsewhere, "page")} of the
          scan in progress {waitingElsewhere === 1 ? "is" : "are"} waiting.{" "}
          {/* A full page load: the screen starts over from the server's copy.
              Someone who cannot file gets the list at /invoices, so name the tab. */}
          <a
            href={canFile ? "/invoices" : "/invoices?tab=scan"}
            className="font-semibold underline"
          >
            Back to the scan in progress
          </a>
        </p>
      ) : null}

      {open ? (
        <ScanStrip
          scan={open}
          canFile={canFile}
          busy={busy}
          uploading={uploading}
          readProblem={readProblem}
          onAdd={chooseFiles}
          onRemoveScan={() => void removeScan(open)}
          onRemoveFile={(sourceId) => void removeFile(open, sourceId)}
          onRefresh={() => void refresh()}
        />
      ) : canFile ? (
        <DropZone
          compact={filed != null}
          uploading={uploading}
          onChoose={chooseFiles}
        />
      ) : null}

      <div
        className={
          rows.length > 0
            ? "grid items-start gap-3 lg:grid-cols-[minmax(20rem,38%)_minmax(0,1fr)]"
            : ""
        }
      >
        {rows.length > 0 ? (
          <div className="lg:sticky lg:top-[82px]">
            <ScanPaperPreview
              row={selectedRow}
              side={side}
              onSideChange={setSide}
              onPrevious={() => step(-1)}
              onNext={() => step(1)}
              hasPrevious={selectedAt > 0}
              hasNext={selectedAt >= 0 && selectedAt < rows.length - 1}
              actions={previewActions}
            />
          </div>
        ) : null}

        <div className="flex min-w-0 flex-col gap-3">
          {filed ? (
            <ScanFiledInvoices
              filed={filed}
              jobFolderName={view.jobFolderName}
              selectedTicketId={
                selectedRow?.from === "filed" ? selectedRow.ticketId : null
              }
              onPickTicket={pickFiledTicket}
            />
          ) : null}

          {open && canFile ? (
            <FileBar
              scan={open}
              busy={busy}
              onFile={() => void fileScan(open)}
              onRefresh={() => void refresh()}
            />
          ) : null}

          {rows.length > 0 ? (
            <ScanPagesGrid
              rows={rows}
              selectedKey={selectedRow?.key ?? null}
              onSelect={selectRow}
              canFile={canFile}
              busy={busy}
              suggestions={view.suggestions}
              actions={gridActions}
              focusKey={focusKey}
              title={open ? "Pages in this scan" : "Pages in this filed scan"}
              hint={
                open
                  ? "Click a row to see its page. Rows that need you are on top."
                  : "Click a row to see its page."
              }
            />
          ) : null}

          <ScanStillOut
            rows={view.stillOut}
            more={view.stillOutMore}
            done={stillOutDone}
            canFile={canFile}
            busy={busy}
            onClose={(row, index) => void closeStillOut(row, index)}
            onMove={(row, index, date) => void moveStillOut(row, index, date)}
            onCancel={(row, index) => void cancelStillOut(row, index)}
            onUndo={(entry) => void undoStillOut(entry)}
          />

          {view.earlier.length > 0 ? (
            <EarlierScans scans={view.earlier} showingId={filed?.id ?? null} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DropZone({
  compact,
  uploading,
  onChoose,
}: {
  compact: boolean;
  uploading: boolean;
  onChoose: () => void;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 text-center ${
        compact ? "py-4" : "py-10"
      }`}
    >
      <p className="text-sm font-semibold text-slate-900">
        {uploading
          ? "Saving the scan…"
          : compact
            ? "Drop the next scan here"
            : "Drop the scan of the signed tickets here"}
      </p>
      {compact ? null : (
        <p className="max-w-xl text-xs text-slate-500">
          Scan the day&apos;s signed tickets on the copier into one PDF, in any
          order and any way up, then drop the PDF on this screen. The app reads
          the code on each page and sorts the pages by ticket. Nothing is filed
          until you click File.
        </p>
      )}
      <button
        type="button"
        disabled={uploading}
        onClick={onChoose}
        className={barButtonClassName}
      >
        Choose the PDF
      </button>
    </div>
  );
}

function ScanStrip({
  scan,
  canFile,
  busy,
  uploading,
  readProblem,
  onAdd,
  onRemoveScan,
  onRemoveFile,
  onRefresh,
}: {
  scan: ScanInOpenScan;
  canFile: boolean;
  busy: boolean;
  uploading: boolean;
  readProblem: string | null;
  onAdd: () => void;
  onRemoveScan: () => void;
  onRemoveFile: (sourceId: string) => void;
  onRefresh: () => void;
}) {
  const { counts } = scan;
  const several = scan.sources.length > 1;
  const read = counts.pages - counts.reading;
  return (
    <div className={`${scanCardClassName} px-4 py-2.5`}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          {scan.sources.map((source) => (
            <span key={source.id} className="inline-flex items-center gap-1.5">
              <span className="break-all text-sm font-semibold text-slate-900">
                {source.fileName}
              </span>
              {several ? (
                <>
                  <span className="text-slate-500">
                    ({source.letter}, {pluralize(source.pageCount, "page")})
                  </span>
                  {canFile ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRemoveFile(source.id)}
                      aria-label={`Remove ${source.fileName} from the scan`}
                      title="Take this file off the scan"
                      className={cellLinkClassName}
                    >
                      Remove
                    </button>
                  ) : null}
                </>
              ) : null}
            </span>
          ))}
        </div>
        <Fact count={counts.pages} label={counts.pages === 1 ? "page" : "pages"} />
        <Fact
          count={counts.codesRead}
          label={counts.codesRead === 1 ? "code read" : "codes read"}
        />
        <Fact
          count={counts.needsYou}
          label={counts.needsYou === 1 ? "needs you" : "need you"}
          tone={counts.needsYou > 0 ? "warn" : undefined}
        />
        {counts.reading > 0 && !readProblem ? (
          <span
            className="inline-flex items-center gap-2 font-medium text-sky-800"
            role="status"
          >
            Reading page {Math.min(read + 1, counts.pages)} of {counts.pages}…
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-sky-100">
              <span
                className="block h-full rounded-full bg-sky-600 transition-[width]"
                style={{
                  width: `${counts.pages > 0 ? (read / counts.pages) * 100 : 0}%`,
                }}
              />
            </span>
          </span>
        ) : null}
        {uploading ? (
          <span className="font-medium text-sky-800" role="status">
            Saving the scan…
          </span>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canFile ? (
            <>
              <button
                type="button"
                disabled={uploading}
                onClick={onAdd}
                title="Add another scan PDF to this one. You can also drop it anywhere on this screen."
                className={barButtonClassName}
              >
                Drop Another Scan
              </button>
              <button
                type="button"
                disabled={busy || scan.filing}
                onClick={onRemoveScan}
                className={barButtonClassName}
              >
                Remove Scan
              </button>
            </>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={onRefresh}
            className={barButtonClassName}
          >
            Refresh
          </button>
        </div>
      </div>
      {readProblem ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>Reading stopped: {readProblem}</span>
          <button type="button" onClick={onRefresh} className="font-semibold underline">
            Try again
          </button>
        </p>
      ) : null}
    </div>
  );
}

function Fact({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone?: "warn";
}) {
  return (
    <span className={tone === "warn" ? "text-amber-800" : undefined}>
      <span
        className={`text-sm font-semibold tabular-nums ${
          tone === "warn" ? "text-amber-900" : "text-slate-900"
        }`}
      >
        {count.toLocaleString()}
      </span>{" "}
      {label}
    </span>
  );
}

function FileBar({
  scan,
  busy,
  onFile,
  onRefresh,
}: {
  scan: ScanInOpenScan;
  busy: boolean;
  onFile: () => void;
  onRefresh: () => void;
}) {
  const { counts } = scan;
  const reading = counts.reading > 0;
  const nothingReady = counts.ticketsToFile === 0;
  const canClear = nothingReady && scan.leftOutToClear > 0 && !reading;

  if (scan.filing) {
    return (
      <section
        className={`${scanCardClassName} flex flex-wrap items-center gap-3 px-4 py-3`}
      >
        <p className="flex-1 text-sm font-semibold text-slate-900">
          This scan is being filed right now.
          <span className="block text-xs font-normal text-slate-500">
            Refresh in a moment to see what was filed.
          </span>
        </p>
        <button type="button" onClick={onRefresh} className={barButtonClassName}>
          Refresh
        </button>
      </section>
    );
  }

  const small = [
    counts.needsYou > 0
      ? `${counts.needsYou === 1 ? "1 page still needs" : `${counts.needsYou.toLocaleString()} pages still need`} you and will wait in this scan.`
      : null,
    counts.delivering > 0
      ? `${pluralize(counts.delivering, "ticket")} will be marked delivered and get ${counts.delivering === 1 ? "its invoice" : "their invoices"} right away.`
      : null,
    !nothingReady && scan.leftOutToClear > 0
      ? `${pluralize(scan.leftOutToClear, "left-out page")} will be dropped.`
      : null,
    reading ? "Wait for the reading to finish before filing." : null,
  ].filter(Boolean);

  return (
    <section
      className={`${scanCardClassName} flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3`}
    >
      <p className="min-w-[16rem] flex-1 text-sm font-semibold text-slate-900">
        {nothingReady
          ? reading
            ? "Reading the scan…"
            : "Nothing is ready to file yet"
          : `${pluralize(counts.ticketsToFile, "ticket")} ready to file, ${pluralize(counts.pagesToFile, "page")}`}
        {small.length > 0 ? (
          <span className="block text-xs font-normal text-slate-500">
            {small.join(" ")}
          </span>
        ) : null}
      </p>
      {canClear ? (
        <button
          type="button"
          disabled={busy}
          onClick={onFile}
          className={barButtonClassName}
        >
          Clear {pluralize(scan.leftOutToClear, "Left-Out Page")}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy || reading || nothingReady}
          onClick={onFile}
          className={barPrimaryButtonClassName}
        >
          {busy && !nothingReady && !reading
            ? "Working…"
            : nothingReady
              ? "File Tickets"
              : `File ${pluralize(counts.ticketsToFile, "Ticket")}`}
        </button>
      )}
    </section>
  );
}

function EarlierScans({
  scans,
  showingId,
}: {
  scans: ScanInEarlierScan[];
  showingId: string | null;
}) {
  return (
    <section className={scanCardClassName}>
      <ScanCardHead
        title="Earlier scans"
        hint="Open one to see its signed tickets and print its invoices again."
      />
      <div className={tableFlushWrapperClassName}>
        <table className={tableClassName}>
          <thead>
            <tr>
              <th className={tableHeaderCellClassName}>Filed</th>
              <th className={tableHeaderCellClassName}>By</th>
              <th className={tableHeaderCellClassName}>Tickets</th>
              <th className={tableHeaderCellClassName}>Pages</th>
              <th className={tableHeaderCellClassName}>Open</th>
            </tr>
          </thead>
          <tbody className={tableBodyClassName}>
            {scans.map((scan) => (
              <tr key={scan.id} className={tableRowClassName}>
                <td className={`${tableCellClassName} whitespace-nowrap`}>
                  {scan.filedLabel}
                </td>
                <td className={tableCellClassName}>{scan.filedBy ?? ""}</td>
                <td className={`${tableCellClassName} tabular-nums`}>
                  {scan.tickets.toLocaleString()}
                </td>
                <td className={`${tableCellClassName} tabular-nums`}>
                  {scan.pages.toLocaleString()}
                </td>
                <td className={`${tableCellClassName} whitespace-nowrap`}>
                  {scan.id === showingId ? (
                    <span className="font-semibold text-slate-900">Showing</span>
                  ) : (
                    // A full page load: this screen keeps no copy of other scans.
                    <a
                      href={`/invoices?scan=${scan.id}`}
                      className="text-sky-700 underline hover:text-sky-900"
                    >
                      Open
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
