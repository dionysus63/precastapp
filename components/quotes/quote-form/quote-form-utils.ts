import type { CreateQuoteInput } from "@/app/quotes/actions";
import type { JobCustomStructureImportCandidate } from "@/app/quotes/job-sheet-import-actions";
import {
  type EditableQuoteLineItem,
  type QuoteLineItemType,
  getLineItemTotal,
  isCategoryLineItem,
  isNonBillableLineItem,
  parseQuoteNumber,
  resolveQuoteLineQuantityForStorage,
} from "@/components/quotes/quote-utils";
import { serializeCustomStructureConfig } from "@/lib/quotes/custom-structure";
import type { CustomStructureCostItem } from "@/lib/quotes/types";
import { richTextHasContent } from "@/lib/rich-text";

export type AddLineModalType = Exclude<QuoteLineItemType, "MISC" | "CATEGORY">;

export type CustomStructureRow = {
  id: string;
  structureNumber: string;
  description: string;
  qty: string;
  unitPrice: string;
  weight: string;
  yards: string;
  costItems: CustomStructureCostItem[];
  /**
   * The auto-filled "CS-n" number a fresh row started with. Lets an untouched
   * row be told apart from one the user actually filled in. Absent on rows
   * whose number came from the user, the job, or a paste.
   */
  defaultStructureNumber?: string;
};

/** Editable text fields of a custom-structure row (everything but id/cost items). */
export type CustomStructureRowField = keyof Omit<
  CustomStructureRow,
  "id" | "costItems" | "defaultStructureNumber"
>;

export type FlashMessage = {
  type: "success" | "info" | "error";
  text: string;
};

export type ShippingHint = {
  zoneName: string;
  ratePerLoad: number;
  color: string;
  distanceMiles: number | null;
  truckCapacityLbs: number | null;
};

export type ShippingStatus = "idle" | "loading" | "matched" | "outside" | "error";

/** "Import from job structures" picker inside the custom-structure modal. */
export type CustomStructureImportState = {
  loading: boolean;
  error: string | null;
  candidates: JobCustomStructureImportCandidate[];
  unchecked: Set<string>;
};

export function createLineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultCustomStructureRow(
  existingRows: CustomStructureRow[],
): CustomStructureRow {
  const structureNumber = `CS-${existingRows.length + 1}`;
  return {
    id: createLineId(),
    structureNumber,
    description: "",
    qty: "1",
    unitPrice: "",
    weight: "",
    yards: "",
    costItems: [],
    defaultStructureNumber: structureNumber,
  };
}

export function renumberLineItems(items: EditableQuoteLineItem[]) {
  return items.map((item, index) => ({
    ...item,
    lineNumber: index + 1,
  }));
}

export function isBlankCustomStructureRow(row: CustomStructureRow): boolean {
  return (
    !richTextHasContent(row.description) &&
    !row.unitPrice.trim() &&
    !row.weight.trim() &&
    !row.yards.trim() &&
    row.costItems.length === 0
  );
}

/**
 * True when the user put something into the row beyond its auto-filled
 * default number (description, price, cost items, weight, yards, a changed
 * qty, or a structure number of their own). Untouched rows are skipped by
 * "Add to Quote" instead of becoming empty $0 lines.
 */
export function isCustomStructureRowUserContent(
  row: CustomStructureRow,
): boolean {
  if (!isBlankCustomStructureRow(row)) {
    return true;
  }
  const qty = row.qty.trim();
  if (qty && qty !== "1") {
    return true;
  }
  const structureNumber = row.structureNumber.trim();
  return Boolean(
    structureNumber && structureNumber !== row.defaultStructureNumber,
  );
}

export type DuplicateStructureNumber = {
  /** The number as first written in the paste. */
  structureNumber: string;
  /** Spreadsheet row numbers it appears on, ascending. */
  rowNumbers: number[];
};

/**
 * Structure numbers that appear more than once (trimmed, case-insensitive),
 * in order of first appearance. Blank numbers are ignored.
 */
export function findDuplicateStructureNumbers(
  rows: { rowNumber: number; structureNumber: string }[],
): DuplicateStructureNumber[] {
  const groups = new Map<string, DuplicateStructureNumber>();
  const ordered = [...rows].sort((a, b) => a.rowNumber - b.rowNumber);
  for (const row of ordered) {
    const trimmed = row.structureNumber.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    const group = groups.get(key);
    if (group) {
      group.rowNumbers.push(row.rowNumber);
    } else {
      groups.set(key, { structureNumber: trimmed, rowNumbers: [row.rowNumber] });
    }
  }
  return [...groups.values()].filter((group) => group.rowNumbers.length > 1);
}

/** Lists structure numbers for a message: "A, B, C" or "A, B, C…" past `limit`. */
export function formatStructureNumberList(numbers: string[], limit = 3): string {
  return `${numbers.slice(0, limit).join(", ")}${numbers.length > limit ? "…" : ""}`;
}

/** Paste error naming each duplicated structure # and the rows it is on. */
export function formatDuplicatePasteMessage(
  duplicates: DuplicateStructureNumber[],
): string {
  const details = duplicates
    .map(
      (duplicate) =>
        `${duplicate.structureNumber} (rows ${duplicate.rowNumbers.join(", ")})`,
    )
    .join("; ");
  return `No rows added: the paste repeats ${duplicates.length === 1 ? "a structure #" : `${duplicates.length} structure #s`} — ${details}. Each structure # can appear only once; fix the duplicates and paste again.`;
}

/**
 * Input value for a product's weight/yards: a real 0 shows as "0"; only a
 * missing value leaves the field blank.
 */
export function productMeasureInputValue(
  value: number | null | undefined,
): string {
  return value == null ? "" : String(value);
}

export function validateQuoteForm({
  customerId,
  customerName,
  jobId,
  projectName,
  lineItems,
  taxRatePercent,
}: {
  customerId: string;
  customerName: string;
  jobId: string;
  projectName: string;
  lineItems: EditableQuoteLineItem[];
  taxRatePercent: number;
}): string | null {
  if (!customerId && !customerName.trim()) {
    return "Customer is required. Select a customer or enter a customer name.";
  }

  if (!jobId && !projectName.trim()) {
    return "Project name or job is required.";
  }

  if (lineItems.length === 0) {
    return "Add at least one line item.";
  }

  const billableLines = lineItems.filter(
    (line) => !isNonBillableLineItem(line.type),
  );
  if (billableLines.length === 0) {
    return "Add at least one billable line item (not only categories, notes, or page breaks).";
  }

  if (taxRatePercent < 0) {
    return "Tax rate cannot be negative.";
  }

  for (const line of lineItems) {
    if (line.type === "PAGE_BREAK") {
      continue;
    }
    if (line.type === "CATEGORY" || line.type === "NOTE") {
      if (!line.description.trim()) {
        return `Line ${line.lineNumber}: ${line.type === "NOTE" ? "note text" : "category name"} is required.`;
      }
      continue;
    }

    const qty = parseQuoteNumber(line.qty);
    const unitPrice = parseQuoteNumber(line.unitPrice);

    if (qty <= 0) {
      return `Line ${line.lineNumber}: quantity must be greater than 0.`;
    }

    if (unitPrice < 0) {
      return `Line ${line.lineNumber}: unit price cannot be negative.`;
    }
  }

  return null;
}

/** Maps the editor's line items onto the create/update action payload. */
export function buildQuoteLineItemsInput(
  lineItems: EditableQuoteLineItem[],
): CreateQuoteInput["lineItems"] {
  return lineItems.map((line) => ({
    // Real DB id when editing an existing row; client-generated ids for
    // new rows are ignored server-side. Carries production links and
    // revision lineage across the save.
    existingLineItemId: line.id,
    lineNumber: line.lineNumber,
    lineType: line.type,
    productId: line.productId ?? null,
    itemCode: line.item,
    description: line.description,
    quantity: resolveQuoteLineQuantityForStorage(
      line.type,
      parseQuoteNumber(line.qty),
    ),
    unit: line.unit,
    unitPrice: parseQuoteNumber(line.unitPrice),
    weight: line.weight.trim()
      ? parseQuoteNumber(line.weight)
      : null,
    yards: line.yards.trim() ? parseQuoteNumber(line.yards) : null,
    taxable: line.taxable,
    total: isCategoryLineItem(line.type) ? 0 : getLineItemTotal(line),
    statusNote: line.statusNote ?? null,
    notes: null,
    isDrainRing: line.isDrainRing ?? false,
    ringDiameterFeet: line.ringDiameterFeet ?? null,
    poolHeightFeet: line.poolHeightFeet ?? null,
    drainRingStyle: line.drainRingStyle ?? "DRAIN",
    galleyFamilyCode: line.galleyFamilyCode ?? null,
    structureConfigJson:
      line.type === "CUSTOM_STRUCTURE"
        ? serializeCustomStructureConfig(line.costBreakdown)
        : (line.structureConfig ?? line.rectStructureConfig ?? null),
  }));
}

/** Where the structure workbooks send the estimator back to. */
export function buildWorkbookReturnPath({
  quoteId,
  jobId,
  customerId,
  jobBidderId,
}: {
  quoteId: string | undefined;
  jobId: string;
  customerId: string;
  jobBidderId: string;
}): string {
  if (quoteId) {
    return `/quotes/${quoteId}/edit`;
  }

  const params = new URLSearchParams();
  if (jobId) {
    params.set("jobId", jobId);
  }
  if (customerId) {
    params.set("customerId", customerId);
  }
  if (jobBidderId) {
    params.set("bidderId", jobBidderId);
  }

  const query = params.toString();
  return query ? `/quotes/new?${query}` : "/quotes/new";
}
