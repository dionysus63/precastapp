import { formatWeightLb } from "@/lib/format";
import type { DeliveryTicketDrawLineItem } from "@/lib/delivery-ticket-pdf-line-items";

export const DELIVERY_TICKET_PDF_INCLUDE = {
  lineItems: {
    orderBy: { lineNumber: "asc" as const },
    include: {
      jobStructure: {
        select: { structureNumber: true, description: true },
      },
    },
  },
  customer: {
    select: {
      name: true,
      address: true,
      town: true,
      state: true,
      zip: true,
    },
  },
  job: {
    select: {
      projectAddress: true,
      city: true,
      state: true,
      zip: true,
    },
  },
  quote: {
    select: {
      customerPO: true,
      termsAndConditions: true,
      projectAddress: true,
    },
  },
} as const;

export type DeliveryTicketPdfLineItem = {
  itemCode: string;
  qty: string;
  unit: string;
  description: string;
  weight: string;
  structure: string;
};

export type DeliveryTicketPdfView = {
  ticketNumber: string;
  customerName: string;
  customerAddressLines: string[];
  projectName: string;
  deliveryAddressLines: string[];
  siteContactName: string;
  jobNumber: string;
  siteContactPhone: string;
  deliveryDate: string;
  driver: string;
  trailer: string;
  customerPo: string;
  memo: string;
  directions: string;
  lineItems: DeliveryTicketPdfLineItem[];
  totalWeight: string;
  totalPieces: string;
};

type DbCustomer = {
  name: string;
  address: string | null;
  town: string | null;
  state: string | null;
  zip: string | null;
} | null;

type DbJob = {
  projectAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
} | null;

export type DbDeliveryTicketForPdf = {
  ticketNumber: string;
  /** "PICKUP" renders the pickup-ticket layout; anything else is delivery. */
  fulfillmentMethod?: string | null;
  customerName: string;
  projectName: string;
  deliveryAddress: string | null;
  siteContactName: string | null;
  siteContactPhone: string | null;
  jobNumber: string | null;
  deliveryDate: Date | null;
  driver: string | null;
  trailer: string | null;
  customerNotes: string | null;
  siteInstructions: string | null;
  totalItems: number | null;
  totalWeight: { toString(): string } | null;
  customer: DbCustomer;
  job: DbJob;
  quoteNumber: string | null;
  quote: {
    customerPO: string | null;
    termsAndConditions: string | null;
    projectAddress: string | null;
  } | null;
  lineItems: {
    itemCode: string;
    description: string | null;
    quantity: { toString(): string };
    unit: string;
    totalWeight: { toString(): string } | null;
    jobStructure: {
      structureNumber: string | null;
      description: string | null;
    } | null;
  }[];
};

function formatDateForPdf(value: Date | null): string {
  if (!value) {
    return "";
  }
  return value.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function formatDate(value: Date | null): string {
  if (!value) {
    return "—";
  }
  return value.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function formatWeightNumber(value: { toString(): string } | null): string {
  if (value == null) {
    return "0";
  }
  const amount = Number.parseFloat(value.toString());
  if (!Number.isFinite(amount)) {
    return "0";
  }
  return amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatPostalAddressLines(
  address: string | null | undefined,
  town: string | null | undefined,
  state: string | null | undefined,
  zip: string | null | undefined,
): string[] {
  const lines: string[] = [];
  if (address?.trim()) {
    lines.push(address.trim());
  }
  const cityStateZip = [town?.trim(), state?.trim()].filter(Boolean).join(", ");
  const cityLine = [cityStateZip, zip?.trim()].filter(Boolean).join(" ");
  if (cityLine) {
    lines.push(cityLine);
  }
  return lines;
}

function splitMultilineAddress(value: string | null | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function resolveDeliveryAddressLines(ticket: DbDeliveryTicketForPdf): string[] {
  const ticketAddress = splitMultilineAddress(ticket.deliveryAddress);
  if (ticketAddress.length > 0) {
    return ticketAddress;
  }

  if (ticket.job) {
    const jobAddress = formatPostalAddressLines(
      ticket.job.projectAddress,
      ticket.job.city,
      ticket.job.state,
      ticket.job.zip,
    );
    if (jobAddress.length > 0) {
      return jobAddress;
    }
  }

  return splitMultilineAddress(ticket.quote?.projectAddress);
}

function resolveStructure(line: DbDeliveryTicketForPdf["lineItems"][number]): string {
  const structureNumber = line.jobStructure?.structureNumber?.trim();
  if (structureNumber) {
    return structureNumber;
  }
  const description = line.jobStructure?.description?.trim();
  if (description) {
    return description;
  }
  return "—";
}

function displayOrDash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function blankOr(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function formatQuantity(value: { toString(): string }): string {
  const amount = Number.parseFloat(value.toString());
  if (!Number.isFinite(amount)) {
    return value.toString();
  }
  if (Number.isInteger(amount)) {
    return String(amount);
  }
  return amount.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function removeTrailingRingHeightSuffix(value: string): string {
  return value
    .replace(/\s*\(\s*\d+(?:\.\d+)?\s*['’′]\s+ring\s*\)\s*$/i, "")
    .trimEnd();
}

function resolveLineDescription(
  line: DbDeliveryTicketForPdf["lineItems"][number],
): string {
  const description = line.description?.trim();
  if (description) {
    return removeTrailingRingHeightSuffix(description);
  }
  const structureDescription = line.jobStructure?.description?.trim();
  if (structureDescription) {
    return removeTrailingRingHeightSuffix(structureDescription);
  }
  return "";
}

export function computeTotalPieces(ticket: DbDeliveryTicketForPdf): string {
  const totalPiecesFromLines = ticket.lineItems.reduce((sum, line) => {
    const qty = Number.parseFloat(line.quantity.toString());
    return sum + (Number.isFinite(qty) ? qty : 0);
  }, 0);

  if (totalPiecesFromLines > 0) {
    return totalPiecesFromLines.toLocaleString("en-US", {
      maximumFractionDigits: 0,
    });
  }

  return "";
}

export function mapLineItemsForPdf(
  lineItems: DbDeliveryTicketForPdf["lineItems"],
): DeliveryTicketDrawLineItem[] {
  // Rings picked from multiple pool groups arrive as one DB row per quote
  // line for the same SKU (fulfillment is tracked per pool group); print
  // them as a single combined row. Applies to any identical non-structure
  // rows — structure lines are never merged (each is a distinct piece).
  const result: DeliveryTicketDrawLineItem[] = [];
  const mergedIndexByKey = new Map<string, number>();
  const mergedTotals = new Map<number, number>();

  for (const line of lineItems) {
    const item: DeliveryTicketDrawLineItem = {
      qty: formatQuantity(line.quantity),
      unit: line.unit?.trim() || "EA",
      productCode: line.itemCode.trim(),
      description: resolveLineDescription(line),
    };

    const qtyNumber = Number.parseFloat(line.quantity.toString());
    const mergeKey =
      !line.jobStructure && Number.isFinite(qtyNumber)
        ? `${item.productCode}::${item.unit}::${item.description}`
        : null;

    if (mergeKey != null) {
      const existingIndex = mergedIndexByKey.get(mergeKey);
      if (existingIndex != null) {
        const total = (mergedTotals.get(existingIndex) ?? 0) + qtyNumber;
        mergedTotals.set(existingIndex, total);
        result[existingIndex] = {
          ...result[existingIndex]!,
          qty: formatQuantity(total),
        };
        continue;
      }
      mergedIndexByKey.set(mergeKey, result.length);
      mergedTotals.set(result.length, qtyNumber);
    }

    result.push(item);
  }

  return result;
}

/** AcroForm field names must match the PDF template exactly. */
export type DeliveryTicketPdfFillOptions = {
  copyTitles: [string, string, string];
};

export type DeliveryTicketContentPage = {
  number: number;
  count: number;
};

function formatContentPageNumber(page: DeliveryTicketContentPage): string {
  if (page.count <= 1) {
    return "1";
  }
  return `${page.number} of ${page.count}`;
}

function resolveCopyName(
  options: DeliveryTicketPdfFillOptions,
  copyIndex: number,
): string {
  if (copyIndex < 1 || copyIndex > 3) {
    return "";
  }
  return options.copyTitles[copyIndex - 1]?.trim() ?? "";
}

export function buildDeliveryTicketFormData(
  ticket: DbDeliveryTicketForPdf,
  copyIndex: number,
  options: DeliveryTicketPdfFillOptions,
  contentPage: DeliveryTicketContentPage = { number: 1, count: 1 },
): Record<string, string> {
  const deliveryAddressLines = resolveDeliveryAddressLines(ticket);
  // Pickup tickets drop Site Contact/Phone from the info box, and their
  // Driver/Trailer band cells are intentionally blank.
  const isPickup = ticket.fulfillmentMethod === "PICKUP";

  return {
    "Delivery Ticket Number": blankOr(ticket.ticketNumber),
    "Copy Name": resolveCopyName(options, copyIndex),
    "Page Number": formatContentPageNumber(contentPage),
    "Contractor Name": blankOr(ticket.customerName),
    "Job Name": blankOr(ticket.projectName),
    "Job Number": blankOr(ticket.jobNumber),
    "Site Contact": isPickup ? "" : blankOr(ticket.siteContactName),
    "Site Contact Phone": isPickup ? "" : blankOr(ticket.siteContactPhone),
    "Delivery Address 1": deliveryAddressLines[0] ?? "",
    "Delivery Address 2": deliveryAddressLines[1] ?? "",
    "Ship Date": formatDateForPdf(ticket.deliveryDate),
    // The template's internal AcroForm key remains "Driver/Truck" for
    // compatibility, but delivery tickets display and populate Driver only.
    "Driver/Truck": isPickup ? "" : blankOr(ticket.driver),
    Trailer: isPickup ? "" : blankOr(ticket.trailer),
    "Purchase Order Number": blankOr(ticket.quote?.customerPO),
    Notes: blankOr(ticket.siteInstructions),
    Terms: blankOr(ticket.quote?.termsAndConditions),
  };
}

export function mapDbDeliveryTicketToPdfView(
  ticket: DbDeliveryTicketForPdf,
): DeliveryTicketPdfView {
  const customerAddressLines = ticket.customer
    ? formatPostalAddressLines(
        ticket.customer.address,
        ticket.customer.town,
        ticket.customer.state,
        ticket.customer.zip,
      )
    : [];

  const deliveryAddressLines = resolveDeliveryAddressLines(ticket);
  const totalPieces = computeTotalPieces(ticket) || "—";

  return {
    ticketNumber: ticket.ticketNumber,
    customerName: ticket.customerName,
    customerAddressLines,
    projectName: ticket.projectName,
    deliveryAddressLines,
    siteContactName: displayOrDash(ticket.siteContactName),
    jobNumber: displayOrDash(ticket.jobNumber),
    siteContactPhone: displayOrDash(ticket.siteContactPhone),
    deliveryDate: formatDate(ticket.deliveryDate),
    driver: displayOrDash(ticket.driver),
    trailer: displayOrDash(ticket.trailer),
    customerPo: ticket.quote?.customerPO?.trim() || "—",
    memo: ticket.customerNotes?.trim() || "—",
    directions: ticket.siteInstructions?.trim() || "—",
    lineItems: ticket.lineItems.map((line) => ({
      itemCode: line.itemCode,
      qty: formatQuantity(line.quantity),
      unit: line.unit?.trim() || "EA",
      description: resolveLineDescription(line) || "—",
      weight: formatWeightNumber(line.totalWeight),
      structure: resolveStructure(line),
    })),
    totalWeight: formatWeightLb(ticket.totalWeight).replace(" lb", ""),
    totalPieces,
  };
}

export type DeliveryTicketCopySettings = {
  copy1Title: string;
  copy2Title: string;
  copy3Title: string;
  footerText: string;
};

export function getDeliveryTicketCopyTitles(settings: {
  deliveryTicketCopy1Title: string;
  deliveryTicketCopy2Title: string;
  deliveryTicketCopy3Title: string;
  deliveryTicketFooterText: string;
}): DeliveryTicketCopySettings {
  return {
    copy1Title: settings.deliveryTicketCopy1Title,
    copy2Title: settings.deliveryTicketCopy2Title,
    copy3Title: settings.deliveryTicketCopy3Title,
    footerText: settings.deliveryTicketFooterText,
  };
}
