/**
 * Live purchase order preview for the purchase order editor.
 *
 * The editor sends what is on screen and this module turns it into the shape
 * the saved purchase order's PDF is drawn from, WITHOUT saving anything:
 *
 * - Editing: the saved purchase order keeps its number, unless the vendor was
 *   changed to one with other letters; then the number it would be given is
 *   shown, as a save would do (lib/purchase-order-service).
 * - New: the number the purchase order would get if saved now. It is not
 *   taken: the real one is given out on save.
 * - Half-typed lines are shown as far as they go instead of being refused,
 *   so the page fills in while typing. Saving still validates them.
 */
import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import { parseCalendarDate } from "@/lib/date-only";
import { toDecimal } from "@/lib/decimal";
import {
  peekNextPurchaseOrderNumber,
  purchaseOrderNumberPrefix,
  purchaseOrderPrefix,
} from "@/lib/purchase-order-number";
import type { PurchaseOrderForPdf } from "@/lib/purchase-order-pdf-data";

type DbClient = PrismaClient | Prisma.TransactionClient;

/** More lines than any real order; keeps a bad request from filling pages. */
export const PURCHASE_ORDER_PREVIEW_MAX_LINES = 400;

export type PurchaseOrderDraftPreviewLine = {
  itemCode: string;
  description: string;
  quantityOrdered: number;
  unit: string;
  unitPrice: number;
};

export type PurchaseOrderDraftPreviewInput = {
  /** The purchase order being edited; null while creating a new one. */
  purchaseOrderId: string | null;
  vendorId: string | null;
  /** yyyy-mm-dd, as the date inputs hold them. */
  orderDate: string | null;
  expectedDate: string | null;
  enteredBy: string | null;
  notes: string | null;
  lines: PurchaseOrderDraftPreviewLine[];
};

function text(value: unknown, maxLength = 500): string {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function textOrNull(value: unknown, maxLength = 500): string | null {
  const trimmed = text(value, maxLength).trim();
  return trimmed ? trimmed : null;
}

/** A typed number that may be half entered: anything unusable counts as 0. */
function amount(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Re-reads what the browser sent: a server action can be called with anything,
 * so nothing here is trusted to have the declared shape.
 */
export function parsePurchaseOrderDraftPreviewInput(
  raw: unknown,
): PurchaseOrderDraftPreviewInput {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const rawLines = Array.isArray(input.lines) ? input.lines : [];
  if (rawLines.length > PURCHASE_ORDER_PREVIEW_MAX_LINES) {
    throw new Error("Too many lines to preview.");
  }
  const lines: PurchaseOrderDraftPreviewLine[] = [];
  for (const rawLine of rawLines) {
    const line = (rawLine && typeof rawLine === "object" ? rawLine : {}) as Record<
      string,
      unknown
    >;
    const itemCode = text(line.itemCode, 200).trim();
    const description = text(line.description, 2000).trim();
    const quantityOrdered = amount(line.quantityOrdered);
    // A row nothing was typed into is not a line yet.
    if (!itemCode && !description && quantityOrdered === 0) {
      continue;
    }
    lines.push({
      itemCode,
      description,
      quantityOrdered,
      unit: text(line.unit, 20).trim(),
      unitPrice: amount(line.unitPrice),
    });
  }
  return {
    purchaseOrderId: textOrNull(input.purchaseOrderId, 100),
    vendorId: textOrNull(input.vendorId, 100),
    orderDate: textOrNull(input.orderDate, 10),
    expectedDate: textOrNull(input.expectedDate, 10),
    enteredBy: textOrNull(input.enteredBy, 200),
    notes: textOrNull(input.notes, 5000),
    lines,
  };
}

const BLANK_VENDOR: PurchaseOrderForPdf["vendor"] = {
  name: "",
  address: null,
  city: null,
  state: null,
  zip: null,
  phone: null,
  email: null,
  contactName: null,
};

/**
 * Line totals and the grand total the way a save computes them
 * (computePurchaseOrderTotals): quantity x unit price per line, summed
 * unrounded, each figure rounded to cents where it is shown or stored.
 */
export function draftPurchaseOrderMoney(lines: PurchaseOrderDraftPreviewLine[]) {
  let sum = toDecimal(0);
  const lineTotals = lines.map((line) => {
    const extended = toDecimal(line.quantityOrdered).mul(toDecimal(line.unitPrice));
    sum = sum.add(extended);
    return extended.toDecimalPlaces(2);
  });
  return { lineTotals, total: sum.toDecimalPlaces(2) };
}

export async function loadDraftPurchaseOrderForPdf(
  client: DbClient,
  draft: PurchaseOrderDraftPreviewInput,
): Promise<PurchaseOrderForPdf> {
  const [vendor, saved] = await Promise.all([
    draft.vendorId
      ? client.vendor.findUnique({
          where: { id: draft.vendorId },
          select: {
            name: true,
            address: true,
            city: true,
            state: true,
            zip: true,
            phone: true,
            email: true,
            contactName: true,
          },
        })
      : null,
    draft.purchaseOrderId
      ? client.purchaseOrder.findUnique({
          where: { id: draft.purchaseOrderId },
          select: { poNumber: true, vendorId: true },
        })
      : null,
  ]);
  if (draft.purchaseOrderId && !saved) {
    throw new Error("Purchase order not found.");
  }

  let poNumber = "";
  if (saved) {
    const keepsNumber =
      !vendor ||
      saved.vendorId === draft.vendorId ||
      purchaseOrderNumberPrefix(saved.poNumber) === purchaseOrderPrefix(vendor.name);
    poNumber = keepsNumber
      ? saved.poNumber
      : await peekNextPurchaseOrderNumber(client, vendor.name);
  } else if (vendor) {
    poNumber = await peekNextPurchaseOrderNumber(client, vendor.name);
  }

  const money = draftPurchaseOrderMoney(draft.lines);
  return {
    poNumber,
    orderDate: draft.orderDate ? parseCalendarDate(draft.orderDate) : null,
    expectedDate: draft.expectedDate ? parseCalendarDate(draft.expectedDate) : null,
    enteredBy: draft.enteredBy,
    notes: draft.notes,
    vendor: vendor ?? BLANK_VENDOR,
    lines: draft.lines.map((line, index) => ({
      itemCode: line.itemCode,
      description: line.description || null,
      quantityOrdered: line.quantityOrdered,
      unit: line.unit,
      unitPrice: line.unitPrice,
      total: money.lineTotals[index]!,
    })),
    total: money.total,
  };
}
