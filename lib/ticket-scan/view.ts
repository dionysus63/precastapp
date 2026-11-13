import type { PrismaClient } from "@/app/generated/prisma/client";
import { getJobSubfolders } from "@/lib/app-settings";
import { invoiceStatusLabel, isUnpaidInvoiceStatus } from "@/lib/invoice-status";
import {
  buildPgLabels,
  parseFiledScanPages,
  parseFiledScanResult,
  parseScanSources,
} from "@/lib/ticket-scan/batch-state";
import {
  formatFiledMoment,
  formatMonthDay,
  isFilingNow,
  loadOpenScanPlan,
  ticketStatusLabel,
} from "@/lib/ticket-scan/service";
import { signedTicketJobCopyName } from "@/lib/ticket-scan/storage";
import {
  listStillOut,
  listTicketSuggestions,
} from "@/lib/ticket-scan/still-out";
import {
  normalizeTicketNumber,
  rotateScanBox,
  type FiledScanPage,
} from "@/lib/ticket-scan/types";
import type {
  ScanInEarlierScan,
  ScanInFiledScan,
  ScanInFiledTicket,
  ScanInOpenScan,
  ScanInRow,
  ScanInView,
} from "@/lib/ticket-scan/view-types";

/**
 * Builds everything the Scan In screen draws: the scan being worked on, the
 * filed scan being looked at (if any), Still Out, and the recent filings.
 */

const EARLIER_SCANS_SHOWN = 12;

export function scanPageImageUrl(
  batchId: string,
  seq: number,
  rotation: number,
): string {
  // `turn` only makes the address change when the page is turned, so the
  // browser does not show the old picture; the server uses its own record.
  return `/api/ticket-scans/${batchId}/pages/${seq}/image?turn=${rotation}`;
}

export function signedTicketPageImageUrl(fileId: string, page: number): string {
  return `/api/signed-tickets/${fileId}/pages/${page}/image`;
}

export function signedTicketDownloadUrl(fileId: string): string {
  return `/api/signed-tickets/${fileId}/download`;
}

export function scanInvoicesPdfUrl(filedScanId: string): string {
  return `/api/invoices/scan-batch/pdf?scan=${filedScanId}`;
}

type FiledScanLoad = {
  filed: ScanInFiledScan;
  rows: ScanInRow[];
  fromScanId: string | null;
};

async function loadFiledScan(
  client: PrismaClient,
  filedScanId: string,
  canFile: boolean,
): Promise<FiledScanLoad | null> {
  const batch = await client.ticketScanBatch.findUnique({
    where: { id: filedScanId },
    select: {
      id: true,
      status: true,
      sourcesJson: true,
      pagesJson: true,
      resultJson: true,
      filedAt: true,
      filedBy: true,
      createdAt: true,
    },
  });
  if (!batch || batch.status !== "FILED") {
    return null;
  }
  const pages = parseFiledScanPages(batch.pagesJson);
  const result = parseFiledScanResult(batch.resultJson);
  const ticketIds = [
    ...new Set(
      [
        ...result.tickets.map((ticket) => ticket.ticketId),
        ...pages.map((page) => page.ticketId),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const tickets =
    ticketIds.length > 0
      ? await client.deliveryTicket.findMany({
          where: { id: { in: ticketIds } },
          select: {
            id: true,
            ticketNumber: true,
            customerName: true,
            projectName: true,
            status: true,
            deliveredAt: true,
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                status: true,
                subtotal: true,
                discountAmount: true,
                salesTax: true,
                total: true,
                createdAt: true,
                lineItems: {
                  where: { needsPrice: true },
                  orderBy: { lineNumber: "asc" },
                  select: { itemCode: true },
                },
              },
            },
          },
        })
      : [];
  const ticketById = new Map(tickets.map((ticket) => [ticket.id, ticket]));

  const filedTickets: ScanInFiledTicket[] = result.tickets.map((entry) => {
    const ticket = ticketById.get(entry.ticketId);
    const invoice = ticket?.invoice ?? null;
    const unpaid = invoice ? isUnpaidInvoiceStatus(invoice.status) : false;
    const priceNeededItems =
      invoice && unpaid ? invoice.lineItems.map((line) => line.itemCode) : [];
    let note: string | null = null;
    if (!invoice) {
      note =
        ticket?.status === "DELIVERED"
          ? "Delivered, but its invoice could not be made. Use Convert to Invoice on the ticket."
          : "Not marked delivered, so no invoice yet.";
    } else if (invoice.status === "VOID") {
      note = "Void";
    } else if (priceNeededItems.length > 0) {
      note = `Price needed: ${priceNeededItems.join(", ")}`;
    } else if (!entry.invoiceMade) {
      note = `Made earlier (${formatMonthDay(invoice.createdAt)})`;
    }
    return {
      ticketId: entry.ticketId,
      ticketNumber: ticket?.ticketNumber ?? entry.ticketNumber,
      customerName: ticket?.customerName ?? "",
      projectName: ticket?.projectName ?? "",
      signedFileUrl: signedTicketDownloadUrl(entry.signedFileId),
      signedFileName: signedTicketJobCopyName(entry.ticketNumber),
      pageCount: entry.pageCount,
      markedDelivered: entry.markedDelivered,
      replaced: entry.replaced,
      jobFolderCopy: entry.jobFolderCopy,
      warnings: entry.warnings,
      invoice: invoice
        ? {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            statusLabel: invoiceStatusLabel(invoice.status),
            price: Number(invoice.subtotal) - Number(invoice.discountAmount),
            salesTax: Number(invoice.salesTax),
            total: Number(invoice.total),
            priceNeededItems,
            canEdit: canFile && unpaid,
            note,
          }
        : null,
      noInvoiceNote: invoice ? null : note,
    };
  });

  const printable = filedTickets.filter(
    (ticket) => ticket.invoice && ticket.invoice.statusLabel !== "Void",
  );
  const leadSeqByTicket = new Map<string, number>();
  for (const page of pages) {
    if (page.outcome === "filed" && page.ticketId && page.filePage === 1) {
      leadSeqByTicket.set(page.ticketId, page.seq);
    }
  }
  const filedByTicketId = new Map(
    filedTickets.map((ticket) => [ticket.ticketId, ticket]),
  );

  const rows: ScanInRow[] = pages.map((page: FiledScanPage) => {
    const ticket = page.ticketId ? ticketById.get(page.ticketId) : undefined;
    const filedTicket = page.ticketId
      ? filedByTicketId.get(page.ticketId)
      : undefined;
    const isFiled = page.outcome === "filed";
    return {
      key: `f${batch.id}:${page.seq}`,
      from: "filed",
      seq: page.seq,
      pgLabel: page.pgLabel,
      band: isFiled ? "filed" : "left",
      kind: isFiled ? "filed" : page.outcome,
      ticketNumber: ticket?.ticketNumber ?? page.ticketNumber,
      ticketId: page.ticketId,
      customerName: ticket?.customerName ?? "",
      projectName: ticket?.projectName ?? "",
      statusLabel: ticket
        ? ticketStatusLabel(ticket.status, ticket.deliveredAt)
        : "",
      copy: page.copy,
      sheet: page.sheet,
      notes: isFiled ? page.notes : [],
      // The pill already says why a page was left out; a note adds to it
      // ("Ticket is cancelled, left out").
      detail: isFiled ? null : (page.notes[0] ?? null),
      lead:
        isFiled &&
        page.ticketId != null &&
        leadSeqByTicket.get(page.ticketId) === page.seq,
      decided: false,
      deliver: null,
      typed: false,
      aboveTicketNumber: null,
      imageUrl:
        isFiled && page.signedFileId && page.filePage
          ? signedTicketPageImageUrl(page.signedFileId, page.filePage)
          : null,
      codeBox: null,
      invoice: filedTicket?.invoice
        ? {
            id: filedTicket.invoice.id,
            invoiceNumber: filedTicket.invoice.invoiceNumber,
          }
        : null,
      signedFileUrl:
        isFiled && page.signedFileId
          ? signedTicketDownloadUrl(page.signedFileId)
          : null,
      onFileUrl: null,
    };
  });

  return {
    filed: {
      id: batch.id,
      filedLabel: formatFiledMoment(batch.filedAt ?? batch.createdAt),
      filedBy: batch.filedBy,
      fileNames: parseScanSources(batch.sourcesJson).map(
        (source) => source.fileName,
      ),
      tickets: filedTickets,
      failures: result.failures,
      counts: {
        tickets: filedTickets.length,
        pages: pages.filter((page) => page.outcome === "filed").length,
        markedDelivered: filedTickets.filter((ticket) => ticket.markedDelivered)
          .length,
        invoices: printable.length,
        invoicesMade: result.tickets.filter((ticket) => ticket.invoiceMade)
          .length,
        jobFolderCopies: filedTickets.filter(
          (ticket) => ticket.jobFolderCopy === "saved",
        ).length,
        leftOut: pages.filter((page) => page.outcome !== "filed").length,
      },
      printInvoicesUrl:
        printable.length > 0 ? scanInvoicesPdfUrl(batch.id) : null,
    },
    rows,
    fromScanId: result.fromScanId,
  };
}

async function listEarlierScans(
  client: PrismaClient,
): Promise<ScanInEarlierScan[]> {
  const batches = await client.ticketScanBatch.findMany({
    where: { status: "FILED" },
    orderBy: [{ filedAt: "desc" }, { createdAt: "desc" }],
    take: EARLIER_SCANS_SHOWN,
    select: {
      id: true,
      filedAt: true,
      filedBy: true,
      createdAt: true,
      pagesJson: true,
      resultJson: true,
    },
  });
  return batches.map((batch) => ({
    id: batch.id,
    filedLabel: formatFiledMoment(batch.filedAt ?? batch.createdAt),
    filedBy: batch.filedBy,
    tickets: parseFiledScanResult(batch.resultJson).tickets.length,
    pages: parseFiledScanPages(batch.pagesJson).filter(
      (page) => page.outcome === "filed",
    ).length,
  }));
}

export async function loadScanInView(
  client: PrismaClient,
  options: {
    /** A filed scan to look at (just filed, or picked from Earlier Scans). */
    filedScanId?: string | null;
    canFile: boolean;
  },
): Promise<ScanInView> {
  const [openPlan, filedLoad, earlier, suggestions, subfolders, invoiceCount] =
    await Promise.all([
      loadOpenScanPlan(client),
      options.filedScanId
        ? loadFiledScan(client, options.filedScanId, options.canFile)
        : Promise.resolve(null),
      listEarlierScans(client),
      options.canFile ? listTicketSuggestions(client) : Promise.resolve([]),
      getJobSubfolders(),
      client.invoice.count(),
    ]);

  let open: ScanInOpenScan | null = null;
  let openRows: ScanInRow[] = [];
  const openTicketIds: string[] = [];
  if (openPlan) {
    const { state, plan, tickets } = openPlan;
    const pgLabels = buildPgLabels(state.sources, state.pages);
    open = {
      id: state.id,
      version: state.version,
      sources: state.sources.map((source) => ({
        id: source.id,
        fileName: source.fileName,
        pageCount: state.pages.filter((page) => page.sourceId === source.id)
          .length,
        letter: source.letter,
      })),
      counts: plan.counts,
      leftOutToClear: plan.rows.filter(
        (row) => row.band === "left" && row.settles,
      ).length,
      filing: isFilingNow(state.filingStartedAt),
    };
    for (const ticket of plan.tickets) {
      openTicketIds.push(ticket.ticket.id);
    }
    openRows = plan.rows.map((row) => {
      const record = row.ticketNumber
        ? tickets.get(normalizeTicketNumber(row.ticketNumber))
        : undefined;
      const matched = record && record.id === row.ticketId ? record : undefined;
      return {
        key: `o${row.seq}`,
        from: "open",
        seq: row.seq,
        pgLabel: pgLabels.get(row.seq) ?? String(row.seq),
        band: row.band,
        kind: row.kind,
        ticketNumber: row.ticketNumber,
        ticketId: row.ticketId,
        customerName: row.customerName,
        projectName: row.projectName,
        statusLabel: row.statusLabel,
        copy: row.copy,
        sheet: row.sheet,
        notes: row.notes,
        detail: row.detail,
        lead: row.lead,
        decided: row.decided,
        deliver: row.deliver,
        typed: row.typed,
        aboveTicketNumber: row.aboveTicketNumber,
        imageUrl: scanPageImageUrl(state.id, row.seq, row.rotation),
        codeBox: row.codeBox ? rotateScanBox(row.codeBox, row.rotation) : null,
        invoice: matched?.invoice ?? null,
        signedFileUrl: null,
        onFileUrl: matched?.signed
          ? `${signedTicketDownloadUrl(matched.signed.fileId)}?view=1`
          : null,
      };
    });
  }

  // Right after File, pages that still need an answer wait in the working
  // scan: they show above the filed ones. An unrelated earlier filing is
  // shown on its own.
  const showingOpen =
    !filedLoad || (open != null && filedLoad.fromScanId === open.id);

  const stillOut = await listStillOut(client, {
    excludeTicketIds: openTicketIds,
  });

  return {
    canFile: options.canFile,
    open,
    showingOpen,
    filed: filedLoad?.filed ?? null,
    rows: [...(showingOpen ? openRows : []), ...(filedLoad?.rows ?? [])],
    stillOut: stillOut.rows,
    stillOutMore: stillOut.more,
    earlier,
    suggestions,
    jobFolderName: subfolders[4] ?? "05 Delivery Tickets",
    invoiceCount,
    loadedAt: Date.now(),
  };
}
