"use server";

import { revalidatePath } from "next/cache";
import { AppPermission } from "@/app/generated/prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAuth, requirePermission } from "@/lib/auth/session";
import { UndoDeliveryNeedsInvoiceRemovalError } from "@/lib/delivery-fulfillment";
import { withDatabaseRetry } from "@/lib/prisma";
import {
  isNextRedirectError,
  translatePrismaError,
} from "@/lib/server/action-errors";
import { fileOpenScan, type ScanInActor } from "@/lib/ticket-scan/filing";
import {
  addScanFiles,
  clearScanPageTicket,
  discardOpenScan,
  markScanPageNotBlank,
  preferScanPage,
  readNextScanPages,
  removeScanSource,
  setScanPageSkipped,
  setScanPageTicket,
  setScanTicketChoice,
  turnScanPage,
} from "@/lib/ticket-scan/service";
import {
  cancelStillOutTicket,
  closeStillOutTicket,
  moveStillOutTicketDate,
  reopenStillOutTicket,
  restoreStillOutTicketDate,
} from "@/lib/ticket-scan/still-out";
import type { ScanTicketChoice } from "@/lib/ticket-scan/types";
import { loadScanInView } from "@/lib/ticket-scan/view";
import type {
  ScanInActionResult,
  ScanInView,
  StillOutUndo,
} from "@/lib/ticket-scan/view-types";

/**
 * Server actions behind Invoices → Scan In. Every one returns the fresh
 * screen (`view`), so the screen never has to reload to show what changed:
 * on the office LAN only action return values and full page loads are
 * reliable (see lib/reload-after-action.ts).
 *
 * `viewing` is the filed scan the screen is showing, if any, so the answer
 * comes back for the same screen.
 */

type Outcome = {
  notice?: string | null;
  warning?: string | null;
  undo?: StillOutUndo | null;
  /** Switch the screen to this filed scan (null = the working scan). */
  viewing?: string | null;
};

/**
 * Filing a signed ticket marks it delivered and makes its invoice, so
 * changing anything on Scan In takes both permissions.
 */
async function requireScanIn(): Promise<ScanInActor> {
  await requirePermission(AppPermission.INVOICES_MANAGE);
  const user = await requirePermission(AppPermission.DELIVERY_MANAGE);
  return { id: user.id, displayName: user.displayName };
}

async function loadView(viewing: string | null): Promise<ScanInView> {
  return withDatabaseRetry((client) =>
    loadScanInView(client, { filedScanId: viewing, canFile: true }),
  );
}

function ticketPathsChanged(ticketId?: string): void {
  revalidatePath("/invoices");
  revalidatePath("/delivery-tickets");
  revalidatePath("/walk-ins");
  revalidatePath("/inventory");
  if (ticketId) {
    revalidatePath(`/delivery-tickets/${ticketId}`);
  }
}

async function run(
  viewing: string | null,
  body: (actor: ScanInActor) => Promise<Outcome | void>,
): Promise<ScanInActionResult> {
  let actor: ScanInActor;
  try {
    actor = await requireScanIn();
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    return { error: translatePrismaError(error).message };
  }

  try {
    const outcome = (await body(actor)) ?? {};
    const view = await loadView(
      outcome.viewing !== undefined ? outcome.viewing : viewing,
    );
    return {
      view,
      notice: outcome.notice ?? null,
      warning: outcome.warning ?? null,
      undo: outcome.undo ?? null,
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    const message = translatePrismaError(error).message;
    // The screen may be out of date (that is often why it failed): send the
    // current one along so it catches up.
    const view = await loadView(viewing).catch(() => undefined);
    if (error instanceof UndoDeliveryNeedsInvoiceRemovalError) {
      return {
        error: message,
        view,
        needsInvoiceRemoval: { invoiceNumber: error.invoiceNumber },
      };
    }
    return { error: message, view };
  }
}

/** The screen as it is now (the Refresh button, and coming back to the tab). */
export async function refreshScanIn(
  viewing: string | null,
): Promise<ScanInActionResult> {
  try {
    const user = await requireAuth();
    if (!(await hasPermission(user, AppPermission.INVOICES_VIEW))) {
      return { error: "You don't have permission to do that." };
    }
    const [canInvoice, canDeliver] = await Promise.all([
      hasPermission(user, AppPermission.INVOICES_MANAGE),
      hasPermission(user, AppPermission.DELIVERY_MANAGE),
    ]);
    const view = await withDatabaseRetry((client) =>
      loadScanInView(client, {
        filedScanId: viewing,
        canFile: canInvoice && canDeliver,
      }),
    );
    return { view };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    return { error: translatePrismaError(error).message };
  }
}

/** Drop a scan: adds the PDFs to the scan being worked on. */
export async function uploadTicketScans(
  formData: FormData,
): Promise<ScanInActionResult> {
  return run(null, async (actor) => {
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);
    const result = await withDatabaseRetry((client) =>
      addScanFiles(client, files, actor.displayName),
    );
    return {
      viewing: null,
      warning: result.skipped.length > 0 ? result.skipped.join(" ") : null,
    };
  });
}

/** Reads the next few pages. The screen calls this until none are waiting. */
export async function readTicketScanPages(
  batchId: string,
  viewing: string | null,
): Promise<ScanInActionResult> {
  return run(viewing, async () => {
    await withDatabaseRetry((client) => readNextScanPages(client, batchId));
  });
}

export async function setTicketScanPageTicket(
  batchId: string,
  seq: number,
  ticketNumber: string,
  via: "typed" | "above",
  viewing: string | null,
): Promise<ScanInActionResult> {
  return run(viewing, async () => {
    await withDatabaseRetry((client) =>
      setScanPageTicket(client, batchId, seq, ticketNumber, via),
    );
  });
}

export async function clearTicketScanPageTicket(
  batchId: string,
  seq: number,
  viewing: string | null,
): Promise<ScanInActionResult> {
  return run(viewing, async () => {
    await withDatabaseRetry((client) =>
      clearScanPageTicket(client, batchId, seq),
    );
  });
}

export async function setTicketScanPageSkipped(
  batchId: string,
  seq: number,
  skipped: boolean,
  viewing: string | null,
): Promise<ScanInActionResult> {
  return run(viewing, async () => {
    await withDatabaseRetry((client) =>
      setScanPageSkipped(client, batchId, seq, skipped),
    );
  });
}

export async function markTicketScanPageNotBlank(
  batchId: string,
  seq: number,
  viewing: string | null,
): Promise<ScanInActionResult> {
  return run(viewing, async () => {
    await withDatabaseRetry((client) =>
      markScanPageNotBlank(client, batchId, seq),
    );
  });
}

export async function turnTicketScanPage(
  batchId: string,
  seq: number,
  viewing: string | null,
): Promise<ScanInActionResult> {
  return run(viewing, async () => {
    await withDatabaseRetry((client) => turnScanPage(client, batchId, seq));
  });
}

export async function pickTicketScanPageCopy(
  batchId: string,
  seq: number,
  viewing: string | null,
): Promise<ScanInActionResult> {
  return run(viewing, async () => {
    await withDatabaseRetry((client) => preferScanPage(client, batchId, seq));
  });
}

export async function setTicketScanChoice(
  batchId: string,
  ticketNumber: string,
  patch: {
    already?: ScanTicketChoice["already"] | null;
    missing?: ScanTicketChoice["missing"] | null;
    cancelled?: ScanTicketChoice["cancelled"] | null;
    deliver?: boolean | null;
  },
  viewing: string | null,
): Promise<ScanInActionResult> {
  return run(viewing, async () => {
    await withDatabaseRetry((client) =>
      setScanTicketChoice(client, batchId, ticketNumber, patch),
    );
  });
}

export async function removeTicketScanFile(
  batchId: string,
  sourceId: string,
  viewing: string | null,
): Promise<ScanInActionResult> {
  return run(viewing, async () => {
    await withDatabaseRetry((client) =>
      removeScanSource(client, batchId, sourceId),
    );
  });
}

export async function discardTicketScan(
  batchId: string,
  viewing: string | null,
): Promise<ScanInActionResult> {
  return run(viewing, async () => {
    await withDatabaseRetry((client) => discardOpenScan(client, batchId));
    return { notice: "Scan removed. Nothing in it was filed." };
  });
}

/**
 * File: every ticket that is ready gets its signed PDF, is marked delivered
 * when its box is ticked, and gets its invoice. `version` is the scan as the
 * screen last saw it; if it changed since, nothing is filed.
 */
export async function fileTicketScan(
  batchId: string,
  version: number,
  viewing: string | null,
): Promise<ScanInActionResult> {
  return run(viewing, async (actor) => {
    const outcome = await withDatabaseRetry((client) =>
      fileOpenScan(client, batchId, actor, { expectedVersion: version }),
    );
    ticketPathsChanged();
    for (const ticket of outcome.tickets) {
      revalidatePath(`/delivery-tickets/${ticket.ticketId}`);
    }

    const problems = outcome.failures.map(
      (failure) => `${failure.ticketNumber} was not filed: ${failure.error}`,
    );
    const warnings = outcome.tickets.flatMap((ticket) =>
      ticket.warnings.map((warning) => `${ticket.ticketNumber}: ${warning}`),
    );
    if (!outcome.filedScanId) {
      return {
        notice:
          outcome.clearedPages > 0
            ? `${outcome.clearedPages} left-out page${outcome.clearedPages === 1 ? "" : "s"} taken off the scan.`
            : null,
        warning: problems.length > 0 ? problems.join(" ") : null,
      };
    }
    return {
      viewing: outcome.filedScanId,
      warning:
        problems.length + warnings.length > 0
          ? [...problems, ...warnings].join(" ")
          : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Still Out
// ---------------------------------------------------------------------------

/** "Delivered, No Signed Copy" (or "Mark Delivered" when the copy is filed). */
export async function closeStillOutTicketAction(
  ticketId: string,
  viewing: string | null,
): Promise<ScanInActionResult> {
  return run(viewing, async (actor) => {
    const result = await withDatabaseRetry((client) =>
      closeStillOutTicket(client, ticketId, actor),
    );
    ticketPathsChanged(ticketId);
    return {
      notice: result.notice,
      warning: result.warning,
      undo: result.undo,
    };
  });
}

/** Undo of the above. `removeUnpaidInvoice` only after the person said yes. */
export async function reopenStillOutTicketAction(
  ticketId: string,
  options: { undoDelivery: boolean; removeUnpaidInvoice: boolean },
  viewing: string | null,
): Promise<ScanInActionResult> {
  return run(viewing, async (actor) => {
    await withDatabaseRetry((client) =>
      reopenStillOutTicket(client, ticketId, actor, {
        undoDelivery: options.undoDelivery === true,
        removeUnpaidInvoice: options.removeUnpaidInvoice === true,
      }),
    );
    ticketPathsChanged(ticketId);
    return { notice: "Put back on Still Out." };
  });
}

export async function moveStillOutTicketDateAction(
  ticketId: string,
  newDate: string,
  viewing: string | null,
): Promise<ScanInActionResult> {
  return run(viewing, async () => {
    const result = await withDatabaseRetry((client) =>
      moveStillOutTicketDate(client, ticketId, newDate),
    );
    ticketPathsChanged(ticketId);
    return { notice: result.notice, undo: result.undo };
  });
}

export async function restoreStillOutTicketDateAction(
  ticketId: string,
  previousDate: string,
  viewing: string | null,
): Promise<ScanInActionResult> {
  return run(viewing, async () => {
    await withDatabaseRetry((client) =>
      restoreStillOutTicketDate(client, ticketId, previousDate),
    );
    ticketPathsChanged(ticketId);
    return { notice: "Date moved back." };
  });
}

export async function cancelStillOutTicketAction(
  ticketId: string,
  viewing: string | null,
): Promise<ScanInActionResult> {
  return run(viewing, async (actor) => {
    const result = await withDatabaseRetry((client) =>
      cancelStillOutTicket(client, ticketId, actor),
    );
    ticketPathsChanged(ticketId);
    return { notice: result.notice };
  });
}
