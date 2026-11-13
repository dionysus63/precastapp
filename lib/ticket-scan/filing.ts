import path from "path";
import { degrees, PDFDocument } from "pdf-lib";
import {
  Prisma,
  type PrismaClient,
} from "@/app/generated/prisma/client";
import { getJobSubfolders, getJobsRoot } from "@/lib/app-settings";
import { writeAuditLog } from "@/lib/auth/audit";
import { markDeliveryTicketDelivered } from "@/lib/delivery-fulfillment";
import { ensureInvoiceAfterDelivery } from "@/lib/invoicing-service";
import { registerJobFile } from "@/lib/job-files-service";
import { assertPathUnderJobsRoot } from "@/lib/job-path-security";
import {
  buildPgLabels,
  parseScanChoices,
  parseScanPages,
  parseScanSources,
} from "@/lib/ticket-scan/batch-state";
import {
  planScan,
  type ScanRow,
  type ScanTicketPlan,
} from "@/lib/ticket-scan/plan";
import {
  FILING_LOCK_STALE_MS,
  isFilingNow,
  loadScanTickets,
  pruneChoices,
  SCAN_GONE_MESSAGE,
  ScanInError,
  ticketNumbersOnPages,
  type OpenScanState,
  type ScanTicketRecord,
} from "@/lib/ticket-scan/service";
import {
  deleteScanFolder,
  deleteScanSource,
  moveSignedTicket,
  readScanSource,
  removeSignedTicket,
  setAsideSignedTicket,
  signedTicketJobCopyName,
  signedTicketRelativePath,
  storagePathExists,
  writeJobFolderCopy,
  writeSignedTicket,
} from "@/lib/ticket-scan/storage";
import {
  normalizeTicketNumber,
  type FiledScanPage,
  type FiledScanPageOutcome,
  type FiledScanResult,
  type FiledScanTicket,
  type ScanPage,
  type ScanSource,
} from "@/lib/ticket-scan/types";

/**
 * File (Invoices → Scan In): every ticket that is ready gets one signed PDF,
 * built from its pages of the uploaded scan.
 *
 *   storage/signed-tickets/<year>/<number>.pdf     the master, kept for good
 *   <job folder>/05 Delivery Tickets/<number> - Signed.pdf   a copy
 *
 * Then, when its Deliver box is ticked, the ticket is marked delivered and
 * gets its invoice. The pages dealt with move out of the working scan into a
 * FILED record (what was filed together, in paper stack order); pages that
 * still need an answer stay behind and wait.
 *
 * Each ticket is filed on its own: one that fails is reported and stays in
 * the scan, the rest still go through.
 */

export type ScanInActor = { id: string; displayName: string };

export type FileScanOutcome = {
  /** The record of this filing; null when no ticket was filed. */
  filedScanId: string | null;
  tickets: FiledScanTicket[];
  failures: { ticketNumber: string; error: string }[];
  /** Left-out pages taken off the scan. */
  clearedPages: number;
};

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Takes the scan for filing, so a second click (or a second person) cannot
 * file the same pages twice. Bumps the version: a change that was being
 * saved at this very moment loses and is asked to try again.
 */
async function claimScanForFiling(
  client: PrismaClient,
  batchId: string,
  expectedVersion: number | null,
): Promise<void> {
  const staleBefore = new Date(Date.now() - FILING_LOCK_STALE_MS);
  const claimed = await client.ticketScanBatch.updateMany({
    where: {
      id: batchId,
      status: "OPEN",
      ...(expectedVersion != null ? { version: expectedVersion } : {}),
      OR: [{ filingStartedAt: null }, { filingStartedAt: { lt: staleBefore } }],
    },
    data: { filingStartedAt: new Date(), version: { increment: 1 } },
  });
  if (claimed.count === 1) {
    return;
  }
  const row = await client.ticketScanBatch.findUnique({
    where: { id: batchId },
    select: { status: true, filingStartedAt: true },
  });
  if (!row || row.status !== "OPEN") {
    throw new ScanInError(SCAN_GONE_MESSAGE);
  }
  if (isFilingNow(row.filingStartedAt)) {
    throw new ScanInError("This scan is already being filed. Give it a moment.");
  }
  throw new ScanInError(
    "This scan changed since this screen last loaded it. Check the rows, then click File again.",
  );
}

async function releaseScan(client: PrismaClient, batchId: string): Promise<void> {
  await client.ticketScanBatch
    .updateMany({
      where: { id: batchId, status: "OPEN" },
      data: { filingStartedAt: null, version: { increment: 1 } },
    })
    .catch(() => undefined);
}

/** Opens each uploaded PDF once, however many tickets take pages from it. */
class SourcePdfs {
  private readonly loaded = new Map<string, Promise<PDFDocument>>();

  constructor(private readonly batchId: string) {}

  get(sourceId: string): Promise<PDFDocument> {
    let document = this.loaded.get(sourceId);
    if (!document) {
      document = readScanSource(this.batchId, sourceId).then((bytes) =>
        PDFDocument.load(bytes, { updateMetadata: false }),
      );
      this.loaded.set(sourceId, document);
    }
    return document;
  }
}

async function buildSignedPdf(
  sources: SourcePdfs,
  ticketNumber: string,
  pages: ScanTicketPlan["pages"],
): Promise<Uint8Array> {
  const output = await PDFDocument.create();
  for (const page of pages) {
    const source = await sources.get(page.sourceId);
    if (page.sourcePage < 1 || page.sourcePage > source.getPageCount()) {
      throw new Error(`Page ${page.sourcePage} is not in the uploaded scan.`);
    }
    const [copied] = await output.copyPages(source, [page.sourcePage - 1]);
    if (page.rotation) {
      // On top of whatever turn the scanner already wrote into the page.
      copied!.setRotation(
        degrees((copied!.getRotation().angle + page.rotation) % 360),
      );
    }
    output.addPage(copied!);
  }
  output.setTitle(`${ticketNumber} - Signed`);
  output.setSubject("Signed delivery ticket");
  return output.save();
}

type JobFolderCopy = {
  status: FiledScanTicket["jobFolderCopy"];
  path: string | null;
  warning: string | null;
};

/** The copy in the job's delivery tickets folder. Never fails the filing. */
async function saveJobFolderCopy(
  client: PrismaClient,
  ticket: ScanTicketRecord,
  bytes: Uint8Array,
): Promise<JobFolderCopy> {
  if (!ticket.jobId) {
    return { status: "none", path: null, warning: null };
  }
  const job = await client.job.findUnique({
    where: { id: ticket.jobId },
    select: { folderPath: true },
  });
  const folderPath = job?.folderPath?.trim();
  if (!folderPath) {
    return { status: "none", path: null, warning: null };
  }
  try {
    if (!(await storagePathExists(folderPath))) {
      throw new Error(`the job folder was not found (${folderPath})`);
    }
    const subfolder = (await getJobSubfolders())[4] ?? "05 Delivery Tickets";
    const outputPath = path.join(
      folderPath,
      subfolder,
      signedTicketJobCopyName(ticket.ticketNumber),
    );
    // The job folder comes from the database: keep the write inside the jobs root.
    assertPathUnderJobsRoot(await getJobsRoot(), outputPath);
    await writeJobFolderCopy(outputPath, bytes);
    // Listing it on the job's Files tab is a nicety; the folder scan there
    // picks the file up later if this fails.
    await registerJobFile(client, ticket.jobId, outputPath, subfolder).catch(
      () => undefined,
    );
    return { status: "saved", path: outputPath, warning: null };
  } catch (error) {
    return {
      status: "failed",
      path: null,
      warning: `The signed copy is filed in the app, but its copy could not be put in the job folder: ${errorText(error, "the folder could not be written")}.`,
    };
  }
}

function deliveryFailureWarning(error: unknown): string {
  const message = errorText(error, "it could not be marked delivered");
  if (message.includes("Product_currentStockQuantity_nonneg")) {
    return "The signed copy is filed, but the ticket could not be marked delivered: there is not enough stock on hand. Adjust inventory or the ticket's quantities, then mark it delivered from Still Out.";
  }
  return `The signed copy is filed, but the ticket could not be marked delivered: ${message.replace(/\.\s*$/, "")}. It is listed under Still Out.`;
}

type FilingRun = {
  client: PrismaClient;
  actor: ScanInActor;
  batchId: string;
  filedScanId: string;
  sources: SourcePdfs;
  pgLabels: Map<number, string>;
  /** Pages still in the working scan; shrinks as tickets are filed. */
  remaining: ScanPage[];
  filedPages: FiledScanPage[];
  result: FiledScanResult;
};

async function fileOneTicket(
  run: FilingRun,
  ticketPlan: ScanTicketPlan,
  ticket: ScanTicketRecord,
): Promise<void> {
  const { client, actor } = run;
  const now = new Date();

  const current = await client.signedTicketFile.findMany({
    where: { deliveryTicketId: ticket.id, isCurrent: true },
    select: { id: true, filePath: true },
  });
  if (current.length > 0 && !ticketPlan.replaces) {
    throw new ScanInError(
      "A signed copy was filed for this ticket from another screen a moment ago. Look at its row again.",
    );
  }

  const bytes = await buildSignedPdf(
    run.sources,
    ticket.ticketNumber,
    ticketPlan.pages,
  );
  const year =
    ticket.year ??
    (ticket.deliveryDate ?? ticket.deliveredAt ?? now).getFullYear();
  const filePath = signedTicketRelativePath(year, ticket.ticketNumber);
  const seqs = new Set(ticketPlan.pages.map((page) => page.seq));
  const remaining = run.remaining.filter((page) => !seqs.has(page.seq));
  const filedTicket: FiledScanTicket = {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    signedFileId: "",
    filePath,
    pageCount: ticketPlan.pages.length,
    deliverRequested: ticketPlan.deliver,
    markedDelivered: false,
    invoiceMade: false,
    replaced: current.length > 0,
    jobFolderCopy: "none",
    warnings: [],
  };

  // An earlier signed copy is kept, under another name. So is a file nobody
  // tracks that sits where the new one goes (left by an interrupted filing,
  // or by a ticket number used again): nothing signed is ever overwritten.
  const moves: { rowId: string | null; from: string; to: string }[] = [];
  let written = false;
  let pages: FiledScanPage[];
  try {
    for (const old of current) {
      const to = await setAsideSignedTicket(old.filePath);
      if (to) {
        moves.push({ rowId: old.id, from: old.filePath, to });
      }
    }
    const stray = await setAsideSignedTicket(filePath);
    if (stray) {
      moves.push({ rowId: null, from: filePath, to: stray });
    }
    await writeSignedTicket(filePath, bytes);
    written = true;

    // One transaction per ticket: its signed-file row, the ticket's "signed
    // copy filed" stamp, and its pages moving from the working scan into the
    // filing's record all land together or not at all.
    pages = await client.$transaction(async (tx) => {
      for (const old of current) {
        const moved = moves.find((move) => move.rowId === old.id);
        await tx.signedTicketFile.update({
          where: { id: old.id },
          data: {
            isCurrent: false,
            ...(moved ? { filePath: moved.to } : {}),
          },
        });
      }
      const created = await tx.signedTicketFile.create({
        data: {
          deliveryTicketId: ticket.id,
          batchId: run.filedScanId,
          filePath,
          pageCount: ticketPlan.pages.length,
          fileSize: bytes.byteLength,
          filedBy: actor.displayName,
        },
        select: { id: true },
      });
      await tx.deliveryTicket.update({
        where: { id: ticket.id },
        data: {
          paperTicketVerified: true,
          verifiedAt: now,
          verifiedBy: actor.displayName,
          closedWithoutSignedCopyAt: null,
          closedWithoutSignedCopyBy: null,
        },
      });

      const ticketPages: FiledScanPage[] = ticketPlan.pages.map(
        (page, index) => ({
          seq: page.seq,
          pgLabel: run.pgLabels.get(page.seq) ?? String(page.seq),
          outcome: "filed",
          ticketNumber: ticket.ticketNumber,
          ticketId: ticket.id,
          copy: page.copy,
          sheet: page.sheet,
          notes: page.notes,
          signedFileId: created.id,
          filePage: index + 1,
        }),
      );
      await tx.ticketScanBatch.update({
        where: { id: run.filedScanId },
        data: {
          pagesJson: asJson([...run.filedPages, ...ticketPages]),
          resultJson: asJson({
            ...run.result,
            tickets: [
              ...run.result.tickets,
              { ...filedTicket, signedFileId: created.id },
            ],
          }),
        },
      });
      await tx.ticketScanBatch.update({
        where: { id: run.batchId },
        data: { pagesJson: asJson(remaining) },
      });
      return ticketPages;
    });
  } catch (error) {
    // Nothing was recorded: put the files back the way they were.
    if (written) {
      await removeSignedTicket(filePath).catch(() => undefined);
    }
    for (const move of [...moves].reverse()) {
      await moveSignedTicket(move.to, move.from).catch(() => undefined);
    }
    throw error;
  }

  // The signed copy is filed. Whatever goes wrong from here on is a warning
  // on the ticket, never a failed filing.
  filedTicket.signedFileId = pages[0]?.signedFileId ?? "";
  run.filedPages.push(...pages);
  run.remaining = remaining;
  run.result.tickets.push(filedTicket);

  try {
    const copy = await saveJobFolderCopy(client, ticket, bytes);
    filedTicket.jobFolderCopy = copy.status;
    if (copy.warning) {
      filedTicket.warnings.push(copy.warning);
    }
    if (copy.path) {
      await client.signedTicketFile.update({
        where: { id: filedTicket.signedFileId },
        data: { jobFolderCopyPath: copy.path },
      });
    }
  } catch (error) {
    filedTicket.jobFolderCopy = "failed";
    filedTicket.warnings.push(
      `The signed copy is filed in the app, but its copy for the job folder ran into a problem: ${errorText(error, "unknown error")}.`,
    );
  }

  if (ticketPlan.deliver) {
    try {
      const before = await client.deliveryTicket.findUnique({
        where: { id: ticket.id },
        select: { status: true },
      });
      if (before && before.status !== "DELIVERED") {
        await markDeliveryTicketDelivered(client, ticket.id, {
          verifiedBy: actor.displayName,
        });
        filedTicket.markedDelivered = true;
      }
    } catch (error) {
      filedTicket.warnings.push(deliveryFailureWarning(error));
    }
    if (filedTicket.markedDelivered) {
      try {
        // Every delivered ticket gets its invoice right away.
        const invoice = await ensureInvoiceAfterDelivery(client, ticket.id);
        filedTicket.invoiceMade = invoice.created;
        if (invoice.warning) {
          filedTicket.warnings.push(invoice.warning);
        }
      } catch (error) {
        filedTicket.warnings.push(
          `The ticket is marked delivered, but its invoice could not be made: ${errorText(error, "unknown error").replace(/\.\s*$/, "")}. Use Convert to Invoice on the ticket once that is fixed.`,
        );
      }
    }
  }
}

const LEFT_OUT_OUTCOMES: Partial<Record<ScanRow["kind"], FiledScanPageOutcome>> = {
  blank: "blank",
  skipped: "skipped",
  extra: "extra",
  leftOut: "leftOut",
};

function leftOutPage(row: ScanRow, pgLabel: string): FiledScanPage {
  return {
    seq: row.seq,
    pgLabel,
    outcome: LEFT_OUT_OUTCOMES[row.kind] ?? "leftOut",
    ticketNumber: row.ticketNumber,
    ticketId: row.ticketId,
    copy: row.copy,
    sheet: row.sheet,
    notes: row.detail ? [row.detail] : [],
    signedFileId: null,
    filePage: null,
  };
}

/** A FILED record keeps the names of the files it came from, not the files. */
function sourceNames(sources: ScanSource[], pages: ScanPage[]): ScanSource[] {
  const used = new Set(pages.map((page) => page.sourceId));
  return sources.filter((source) => used.has(source.id));
}

async function fileClaimedScan(
  client: PrismaClient,
  batchId: string,
  actor: ScanInActor,
): Promise<FileScanOutcome> {
  const row = await client.ticketScanBatch.findUnique({
    where: { id: batchId },
    select: {
      status: true,
      sourcesJson: true,
      pagesJson: true,
      choicesJson: true,
      nextSeq: true,
      version: true,
      uploadedBy: true,
    },
  });
  if (!row || row.status !== "OPEN") {
    throw new ScanInError(SCAN_GONE_MESSAGE);
  }
  const state: OpenScanState = {
    id: batchId,
    version: row.version,
    nextSeq: row.nextSeq,
    sources: parseScanSources(row.sourcesJson),
    pages: parseScanPages(row.pagesJson),
    choices: parseScanChoices(row.choicesJson),
    filingStartedAt: new Date(),
  };

  const tickets = await loadScanTickets(client, ticketNumbersOnPages(state.pages));
  const plan = planScan({
    pages: state.pages,
    choices: state.choices,
    tickets,
  });
  if (plan.counts.reading > 0) {
    throw new ScanInError(
      "Some pages are still being read. Wait for the reading to finish, then click File.",
    );
  }

  const toFile = plan.tickets.filter((ticket) => ticket.state === "file");
  const leftOutRows = plan.rows.filter(
    (entry) => entry.band === "left" && entry.settles,
  );
  if (toFile.length === 0 && leftOutRows.length === 0) {
    throw new ScanInError("Nothing in this scan is ready to file yet.");
  }

  const pgLabels = buildPgLabels(state.sources, state.pages);
  const failures: FileScanOutcome["failures"] = [];
  let remaining = state.pages;
  let filedScanId: string | null = null;
  let filedTickets: FiledScanTicket[] = [];
  let filedPages: FiledScanPage[] = [];

  if (toFile.length > 0) {
    const filedAt = new Date();
    const record = await client.ticketScanBatch.create({
      data: {
        status: "FILED",
        sourcesJson: [],
        pagesJson: [],
        choicesJson: {},
        resultJson: asJson({ tickets: [], failures: [], fromScanId: batchId }),
        uploadedBy: row.uploadedBy,
        filedBy: actor.displayName,
        filedAt,
      },
      select: { id: true },
    });
    const run: FilingRun = {
      client,
      actor,
      batchId,
      filedScanId: record.id,
      sources: new SourcePdfs(batchId),
      pgLabels,
      remaining,
      filedPages: [],
      result: { tickets: [], failures: [], fromScanId: batchId },
    };

    for (const ticketPlan of toFile) {
      const ticket = tickets.get(
        normalizeTicketNumber(ticketPlan.ticket.ticketNumber),
      );
      try {
        if (!ticket) {
          throw new ScanInError("This ticket is no longer on the server.");
        }
        await fileOneTicket(run, ticketPlan, ticket);
      } catch (error) {
        console.error(
          `[ticket scan] ${ticketPlan.ticket.ticketNumber} could not be filed`,
          error,
        );
        failures.push({
          ticketNumber: ticketPlan.ticket.ticketNumber,
          error: errorText(error, "It could not be filed."),
        });
      }
    }

    remaining = run.remaining;
    filedTickets = run.result.tickets;
    filedPages = run.filedPages;
    if (filedTickets.length === 0) {
      // Nothing went through: there is no filing to keep a record of.
      await client.ticketScanBatch
        .delete({ where: { id: record.id } })
        .catch(() => undefined);
      return { filedScanId: null, tickets: [], failures, clearedPages: 0 };
    }
    filedScanId = record.id;
  }

  // Pages left out for good go with this filing: blank backs, skipped pages,
  // second copies of a ticket that was filed, tickets left out by choice.
  const filedTicketIds = new Set(filedTickets.map((ticket) => ticket.ticketId));
  const leftOutTicketIds = new Set(
    plan.tickets
      .filter((ticket) => ticket.state === "leftOut")
      .map((ticket) => ticket.ticket.id),
  );
  const clearing = leftOutRows.filter((entry) => {
    if (entry.kind !== "extra") {
      return true;
    }
    return (
      entry.ticketId != null &&
      (filedTicketIds.has(entry.ticketId) || leftOutTicketIds.has(entry.ticketId))
    );
  });
  const clearingSeqs = new Set(clearing.map((entry) => entry.seq));
  const settledPages = state.pages.filter(
    (page) =>
      clearingSeqs.has(page.seq) ||
      filedPages.some((filed) => filed.seq === page.seq),
  );
  remaining = remaining.filter((page) => !clearingSeqs.has(page.seq));

  if (filedScanId) {
    filedPages = [
      ...filedPages,
      ...clearing.map((entry) =>
        leftOutPage(entry, pgLabels.get(entry.seq) ?? String(entry.seq)),
      ),
    ].sort((a, b) => a.seq - b.seq);
    await client.ticketScanBatch.update({
      where: { id: filedScanId },
      data: {
        sourcesJson: asJson(sourceNames(state.sources, settledPages)),
        pagesJson: asJson(filedPages),
        resultJson: asJson({
          tickets: filedTickets,
          failures,
          fromScanId: batchId,
        } satisfies FiledScanResult),
      },
    });
  }

  // What is left of the working scan: the pages still waiting, and only the
  // uploaded files those pages come from.
  const stillUsed = new Set(remaining.map((page) => page.sourceId));
  const droppedSources = state.sources.filter(
    (source) => !stillUsed.has(source.id),
  );
  if (remaining.length === 0) {
    await client.ticketScanBatch.deleteMany({
      where: { id: batchId, status: "OPEN" },
    });
    await deleteScanFolder(batchId).catch(() => undefined);
  } else {
    const next: OpenScanState = {
      ...state,
      pages: remaining,
      sources: state.sources.filter((source) => stillUsed.has(source.id)),
    };
    pruneChoices(next);
    await client.ticketScanBatch.update({
      where: { id: batchId },
      data: {
        sourcesJson: asJson(next.sources),
        pagesJson: asJson(next.pages),
        choicesJson: asJson(next.choices),
      },
    });
    for (const source of droppedSources) {
      await deleteScanSource(batchId, source.id).catch(() => undefined);
    }
  }

  if (filedScanId) {
    const delivered = filedTickets.filter((ticket) => ticket.markedDelivered);
    await writeAuditLog({
      userId: actor.id,
      action: "ticketScan.file",
      entityType: "TicketScanBatch",
      entityId: filedScanId,
      summary: `${actor.displayName} filed ${filedTickets.length} signed ticket${filedTickets.length === 1 ? "" : "s"} from a scan (${filedTickets.map((ticket) => ticket.ticketNumber).join(", ")})${delivered.length > 0 ? `; ${delivered.length} marked delivered` : ""}`,
      metadata: {
        tickets: filedTickets.map((ticket) => ({
          ticketNumber: ticket.ticketNumber,
          filePath: ticket.filePath,
          pages: ticket.pageCount,
          replaced: ticket.replaced,
          markedDelivered: ticket.markedDelivered,
          invoiceMade: ticket.invoiceMade,
        })),
        failures,
      },
    }).catch(() => undefined);
  }

  return {
    filedScanId,
    tickets: filedTickets,
    failures,
    clearedPages: clearing.length,
  };
}

/**
 * Files everything in the working scan that is ready. `expectedVersion` is
 * the version the screen last saw: when the scan changed since, nothing is
 * filed and the person is asked to look again.
 */
export async function fileOpenScan(
  client: PrismaClient,
  batchId: string,
  actor: ScanInActor,
  options: { expectedVersion?: number | null } = {},
): Promise<FileScanOutcome> {
  await claimScanForFiling(client, batchId, options.expectedVersion ?? null);
  try {
    return await fileClaimedScan(client, batchId, actor);
  } finally {
    await releaseScan(client, batchId);
  }
}
