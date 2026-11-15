import type {
  DeliveryTicketStatus,
  PrismaClient,
} from "@/app/generated/prisma/client";
import {
  deliveryTicketStatusLabels,
} from "@/components/delivery-tickets/delivery-ticket-utils";
import type {
  JobProgressLine,
  JobRelatedQuote,
  JobRelatedStructure,
  JobStatusVariant,
} from "@/components/jobs/job-utils";
import { toLocalDayInput } from "@/lib/date-only";
import { formatQuantity, formatUsd } from "@/lib/format";
import {
  invoiceStatusLabel,
  invoiceStatusVariant,
  isUnpaidInvoiceStatus,
} from "@/lib/invoice-status";
import { mapJobQuotes, mapJobStructures } from "@/lib/job-detail-mapper";
import {
  PURCHASE_ORDERS_CATEGORY,
  TAX_EXEMPT_CERT_CATEGORY,
} from "@/lib/job-folder-constants";
import { getJobProgress } from "@/lib/job-progress";
import { isDeliveryServiceLine } from "@/lib/quotes/money-rules";

/**
 * The job page's Overview: working grids (loads, structures, quotes,
 * paperwork, invoices, stock still owed) that can be acted on without
 * opening the job's other tabs. This file loads and shapes what they show;
 * the grids are in components/jobs/overview.
 */

export const CONSTRUCTION_PLANS_CATEGORY = "01 Construction Plans";

/** Where the signed copy of a load's ticket stands. */
export type JobOverviewSignedCopy =
  /** Not delivered yet, so no signed copy is expected. */
  | "not-due"
  /** Delivered and the signed copy was scanned in. */
  | "in"
  /** Delivered, signed copy not scanned in yet. */
  | "not-in"
  /** Delivered and closed on Scan In as "no signed copy". */
  | "closed";

export type JobOverviewLoad = {
  id: string;
  /** "Planned" for a load that has no ticket number yet. */
  ticketNumber: string;
  /** "Mon, Nov 16", with the year when it is not this year; "—" when unset. */
  dateLabel: string;
  /** The delivery day as yyyy-mm-dd, for the date picker. */
  deliveryDateIso: string | null;
  status: DeliveryTicketStatus;
  statusLabel: string;
  isPickup: boolean;
  /** "DMH-3, CB-1" or "(6) 8' x 4' Drain Ring". */
  itemsSummary: string;
  signedCopy: JobOverviewSignedCopy;
  /** The current signed copy's file, when one was scanned in. */
  signedFileId: string | null;
};

export type JobOverviewStructure = JobRelatedStructure & {
  /** The open load this structure is on, e.g. "T10029, Nov 16". */
  onLoad: { ticketId: string; label: string } | null;
};

export type JobOverviewInvoice = {
  id: string;
  invoiceNumber: string;
  ticketNumber: string;
  statusLabel: string;
  statusVariant: JobStatusVariant;
  total: string;
  /** Open or legacy draft: can still be edited and paid. */
  unpaid: boolean;
  /** A line has no price yet (the invoice prints PRICE NEEDED). */
  needsPrice: boolean;
  isVoid: boolean;
};

export type JobOverviewMoney = {
  /** Null when the job has no won quote in the app. */
  won: string | null;
  invoiced: string;
  paid: string;
  /** Won minus invoiced; null without a won quote. */
  leftToInvoice: string | null;
};

export type JobOverviewStockItem = {
  key: string;
  name: string;
  awarded: string;
  shipped: string;
  left: string;
  /** Stock on hand as the Progress tab words it ("24", "3 min", "—"). */
  inStock: string;
  /** Fewer on hand than are still owed. */
  short: boolean;
};

export type JobOverviewPaperKey =
  | "purchase-orders"
  | "tax-exempt-cert"
  | "construction-plans"
  | "files";

export type JobOverviewPaper = {
  key: JobOverviewPaperKey;
  label: string;
  /** The job subfolder a dropped file is saved into; null for "all files". */
  folderCategory: string | null;
  fileCount: number;
  /** Newest file in the folder, for the single-document rows. */
  newestFile: { id: string; fileName: string } | null;
};

export type JobOverviewView = {
  loads: JobOverviewLoad[];
  structures: JobOverviewStructure[];
  /** Structures that have a sheet and are still Not Submitted. */
  structuresToSubmit: number;
  quotes: JobRelatedQuote[];
  invoices: JobOverviewInvoice[];
  money: JobOverviewMoney;
  /** Null when the job has no won quote with stock lines. */
  stockItems: JobOverviewStockItem[] | null;
  paperwork: JobOverviewPaper[];
};

const OPEN_LOAD_STATUSES = new Set<string>([
  "DRAFT",
  "SCHEDULED",
  "LOADING",
  "IN_TRANSIT",
]);

/** Furthest behind first, so what still needs work is at the top. */
const STRUCTURE_STATUS_ORDER = [
  "NOT_SUBMITTED",
  "SUBMITTED",
  "APPROVED",
  "IN_PRODUCTION",
  "MADE",
  "SHIPPED",
];

const MAX_LOAD_ITEMS = 4;

/** "Mon, Nov 16"; the year is added when it is not the current one. */
export function formatLoadDate(date: Date | null, now: Date = new Date()): string {
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  }).format(date);
}

/** "Nov 16" for a load a structure is waiting on. */
function formatMonthDay(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

type LoadLine = {
  itemCode: string;
  description: string | null;
  quantity: { toString(): string };
  jobStructureId: string | null;
};

/**
 * What is on a load in a few words: structures by their number, anything
 * else by its description with the count in front when it is more than one.
 */
export function summarizeLoadItems(lines: LoadLine[]): string {
  if (lines.length === 0) {
    return "—";
  }
  const labels = lines.map((line) => {
    const name = line.jobStructureId
      ? line.itemCode.trim() || line.description?.trim() || "Structure"
      : line.description?.trim() || line.itemCode.trim() || "Item";
    const quantity = Number.parseFloat(line.quantity.toString());
    return Number.isFinite(quantity) && quantity !== 1
      ? `(${formatQuantity(quantity)}) ${name}`
      : name;
  });
  if (labels.length <= MAX_LOAD_ITEMS) {
    return labels.join(", ");
  }
  return `${labels.slice(0, MAX_LOAD_ITEMS).join(", ")} +${
    labels.length - MAX_LOAD_ITEMS
  } more`;
}

export function signedCopyState(ticket: {
  status: string;
  hasSignedFile: boolean;
  closedWithoutSignedCopy: boolean;
}): JobOverviewSignedCopy {
  if (ticket.status !== "DELIVERED") {
    return "not-due";
  }
  if (ticket.hasSignedFile) {
    return "in";
  }
  return ticket.closedWithoutSignedCopy ? "closed" : "not-in";
}

/** Not Submitted first, Shipped last; by structure number inside a status. */
export function sortStructuresForOverview<
  T extends { status: string; structureNumber: string },
>(structures: T[]): T[] {
  const rank = (status: string) => {
    const index = STRUCTURE_STATUS_ORDER.indexOf(status);
    return index === -1 ? STRUCTURE_STATUS_ORDER.length : index;
  };
  return [...structures].sort(
    (left, right) =>
      rank(left.status) - rank(right.status) ||
      left.structureNumber.localeCompare(right.structureNumber, "en-US", {
        numeric: true,
      }),
  );
}

type MoneyAmount = { toString(): string };

function toNumber(value: MoneyAmount): number {
  const amount = Number.parseFloat(value.toString());
  return Number.isFinite(amount) ? amount : 0;
}

/** Won, invoiced, paid and what is left to invoice. Void invoices count for nothing. */
export function buildJobMoney(
  quotes: { status: string; total: MoneyAmount }[],
  invoices: { status: string; total: MoneyAmount }[],
): JobOverviewMoney {
  const wonQuotes = quotes.filter((quote) => quote.status === "WON");
  const won = wonQuotes.reduce((sum, quote) => sum + toNumber(quote.total), 0);
  const live = invoices.filter((invoice) => invoice.status !== "VOID");
  const invoiced = live.reduce(
    (sum, invoice) => sum + toNumber(invoice.total),
    0,
  );
  const paid = live
    .filter((invoice) => invoice.status === "PAID")
    .reduce((sum, invoice) => sum + toNumber(invoice.total), 0);

  return {
    won: wonQuotes.length > 0 ? formatUsd(won) : null,
    invoiced: formatUsd(invoiced),
    paid: formatUsd(paid),
    leftToInvoice:
      wonQuotes.length > 0 ? formatUsd(Math.max(0, won - invoiced)) : null,
  };
}

/** The number at the front of a Progress quantity ("1,200 EA" -> 1200). */
function leadingNumber(value: string): number {
  const amount = Number.parseFloat(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

const NON_ITEM_LINE_TYPES = new Set(["SERVICE", "CATEGORY", "NOTE", "PAGE_BREAK"]);

/**
 * Awarded lines that are not structures and still have some to ship, with
 * the stock on hand beside what is owed. Null when the won quote has no such
 * lines at all (so the card can be left out).
 */
export function buildStockItemsOwed(
  lines: Pick<
    JobProgressLine,
    | "quoteLineItemId"
    | "lineType"
    | "itemCode"
    | "description"
    | "displayName"
    | "awardedQty"
    | "shippedQty"
    | "remainingQty"
    | "stockLevel"
    | "jobStructureId"
  >[],
): JobOverviewStockItem[] | null {
  const itemLines = lines.filter(
    (line) =>
      !line.jobStructureId &&
      !NON_ITEM_LINE_TYPES.has(line.lineType) &&
      !isDeliveryServiceLine(line.lineType, line.itemCode, line.description) &&
      leadingNumber(line.awardedQty) > 0,
  );
  if (itemLines.length === 0) {
    return null;
  }

  return itemLines
    .filter((line) => leadingNumber(line.remainingQty) > 0)
    .map((line) => {
      const left = leadingNumber(line.remainingQty);
      const onHand = /^\d/.test(line.stockLevel)
        ? leadingNumber(line.stockLevel)
        : null;
      return {
        key: line.quoteLineItemId,
        name: line.displayName || line.description || line.itemCode,
        awarded: formatQuantity(leadingNumber(line.awardedQty)),
        shipped: formatQuantity(leadingNumber(line.shippedQty)),
        left: formatQuantity(left),
        inStock: line.stockLevel,
        short: onHand != null && onHand < left,
      };
    });
}

type PaperFile = {
  id: string;
  fileName: string;
  folderCategory: string;
  updatedAt: Date;
};

/** The Paperwork rows: one file per PO and tax cert, counts for the rest. */
export function buildPaperwork(files: PaperFile[]): JobOverviewPaper[] {
  const inCategory = (category: string) =>
    files
      .filter((file) => file.folderCategory === category)
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  const row = (
    key: JobOverviewPaperKey,
    label: string,
    folderCategory: string,
  ): JobOverviewPaper => {
    const matches = inCategory(folderCategory);
    const newest = matches[0];
    return {
      key,
      label,
      folderCategory,
      fileCount: matches.length,
      newestFile: newest
        ? { id: newest.id, fileName: newest.fileName }
        : null,
    };
  };

  return [
    row("purchase-orders", "Purchase Order", PURCHASE_ORDERS_CATEGORY),
    row("tax-exempt-cert", "Tax Exempt Cert", TAX_EXEMPT_CERT_CATEGORY),
    row("construction-plans", "Construction Plans", CONSTRUCTION_PLANS_CATEGORY),
    {
      key: "files",
      label: "All Job Files",
      folderCategory: null,
      fileCount: files.length,
      newestFile: null,
    },
  ];
}

/** Everything the Overview draws, in one round of queries. */
export async function loadJobOverview(
  prisma: PrismaClient,
  jobId: string,
): Promise<JobOverviewView> {
  const [tickets, structureRows, quotes, invoices, files, progress] =
    await Promise.all([
      prisma.deliveryTicket.findMany({
        where: { jobId, status: { not: "CANCELLED" } },
        // Latest day first; planned loads without a date sink to the bottom.
        orderBy: [
          { deliveryDate: { sort: "desc", nulls: "last" } },
          { updatedAt: "desc" },
        ],
        select: {
          id: true,
          ticketNumber: true,
          status: true,
          deliveryDate: true,
          fulfillmentMethod: true,
          closedWithoutSignedCopyAt: true,
          lineItems: {
            orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }],
            select: {
              itemCode: true,
              description: true,
              quantity: true,
              jobStructureId: true,
            },
          },
          signedFiles: {
            where: { isCurrent: true },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true },
          },
        },
      }),
      prisma.jobStructure.findMany({
        where: { jobId },
        include: {
          _count: { select: { documents: true } },
          // Quote config drives the "Create Drill Sheet" link for placeholders.
          quoteLineItems: {
            select: { structureConfigJson: true },
            take: 1,
          },
        },
      }),
      prisma.quote.findMany({
        where: { jobId },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.invoice.findMany({
        where: { jobId },
        orderBy: { invoiceNumber: "desc" },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          total: true,
          deliveryTicket: { select: { ticketNumber: true } },
          _count: {
            select: { lineItems: { where: { needsPrice: true } } },
          },
        },
      }),
      prisma.jobFile.findMany({
        where: { jobId },
        select: {
          id: true,
          fileName: true,
          folderCategory: true,
          updatedAt: true,
        },
      }),
      getJobProgress(prisma, jobId),
    ]);

  // Daily Production progress for in-production structures ("12 / 44").
  const inProductionIds = structureRows
    .filter((structure) => structure.status === "IN_PRODUCTION")
    .map((structure) => structure.id);
  const madeSums = inProductionIds.length
    ? await prisma.dailyProductionStructureLine.groupBy({
        by: ["jobStructureId"],
        where: { jobStructureId: { in: inProductionIds } },
        _sum: { quantityMade: true },
      })
    : [];
  const madeByStructure = new Map(
    madeSums.map((row) => [
      row.jobStructureId,
      row._sum.quantityMade?.toNumber() ?? 0,
    ]),
  );

  // The open load each structure is waiting on. Tickets come latest day
  // first, so the last one written for a structure is its earliest load.
  const loadByStructure = new Map<string, { ticketId: string; label: string }>();
  for (const ticket of tickets) {
    if (!OPEN_LOAD_STATUSES.has(ticket.status)) {
      continue;
    }
    const label = [
      ticket.ticketNumber ?? "Planned",
      ticket.deliveryDate ? formatMonthDay(ticket.deliveryDate) : null,
    ]
      .filter(Boolean)
      .join(", ");
    for (const line of ticket.lineItems) {
      if (line.jobStructureId) {
        loadByStructure.set(line.jobStructureId, { ticketId: ticket.id, label });
      }
    }
  }

  const structures = sortStructuresForOverview(
    mapJobStructures(structureRows).map((row) => {
      const madeSoFar = madeByStructure.get(row.id);
      return {
        ...row,
        madeProgress:
          madeSoFar && row.status === "IN_PRODUCTION"
            ? `${formatQuantity(madeSoFar)} / ${row.quantity}`
            : null,
        onLoad: loadByStructure.get(row.id) ?? null,
      };
    }),
  );

  return {
    loads: tickets.map((ticket) => {
      const signedFile = ticket.signedFiles[0] ?? null;
      return {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber ?? "Planned",
        dateLabel: formatLoadDate(ticket.deliveryDate),
        deliveryDateIso: ticket.deliveryDate
          ? toLocalDayInput(ticket.deliveryDate)
          : null,
        status: ticket.status,
        statusLabel: deliveryTicketStatusLabels[ticket.status] ?? ticket.status,
        isPickup: ticket.fulfillmentMethod === "PICKUP",
        itemsSummary: summarizeLoadItems(ticket.lineItems),
        signedCopy: signedCopyState({
          status: ticket.status,
          hasSignedFile: signedFile != null,
          closedWithoutSignedCopy: ticket.closedWithoutSignedCopyAt != null,
        }),
        signedFileId: signedFile?.id ?? null,
      };
    }),
    structures,
    structuresToSubmit: structures.filter(
      (structure) =>
        structure.drillSheetId && structure.status === "NOT_SUBMITTED",
    ).length,
    // The won quote first; the rest stay newest first.
    quotes: mapJobQuotes(
      [...quotes].sort(
        (left, right) =>
          Number(right.status === "WON") - Number(left.status === "WON"),
      ),
    ),
    invoices: invoices.map((invoice) => {
      const unpaid = isUnpaidInvoiceStatus(invoice.status);
      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        ticketNumber: invoice.deliveryTicket?.ticketNumber ?? "—",
        statusLabel: invoiceStatusLabel(invoice.status),
        statusVariant: invoiceStatusVariant(invoice.status),
        total: formatUsd(invoice.total),
        unpaid,
        needsPrice: unpaid && invoice._count.lineItems > 0,
        isVoid: invoice.status === "VOID",
      };
    }),
    money: buildJobMoney(quotes, invoices),
    stockItems: progress.quoteId ? buildStockItemsOwed(progress.lines) : null,
    paperwork: buildPaperwork(files),
  };
}
