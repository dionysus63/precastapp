import type { QuoteDetailView } from "@/components/quotes/quote-utils";
import { formatSubmittalsStatus } from "@/lib/submittal-package";
import {
  formatDrainRingPoolDescription,
  formatDrainRingStyleLabel,
  type DrainRingStyle,
} from "@/lib/drain-ring-utils";
import { canEditQuote } from "@/lib/quotes/edit-rules";
import { canSendQuote } from "@/lib/quotes/send-rules";
import {
  type QuoteFormInitialValues,
  type QuoteLineItemType,
  type QuoteRow,
  type QuoteStatus,
  type QuoteType,
  type QuoteRelatedStructure,
  quoteLineItemTypeLabels,
  quoteStatusLabels,
  quoteTypeLabels,
} from "@/components/quotes/quote-utils";
import {
  structureStatusOptions,
} from "@/components/structures/structure-utils";
import {
  formatQuantity,
  formatUsd,
  formatWeightLb,
  formatYards,
} from "@/lib/format";
import { quoteStatusVariant } from "@/lib/status-variants";

export type QuoteRecord = {
  id: string;
  quoteNumber: string;
  revisionNumber: number;
  originalQuoteId: string | null;
  jobId: string | null;
  customerId: string | null;
  jobNumber: string | null;
  customerName: string;
  projectName: string;
  projectAddress: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactId: string | null;
  contactTitle: string | null;
  status: string;
  quoteType: string;
  estimator: string | null;
  quoteDate: Date | null;
  bidDueDate: Date | null;
  expirationDate: Date | null;
  customerPO: string | null;
  subtotal: { toString(): string };
  discountAmount: { toString(): string };
  deliveryAmount: { toString(): string };
  taxableAmount: { toString(): string };
  taxRate: { toString(): string };
  salesTax: { toString(): string };
  total: { toString(): string };
  totalWeight: { toString(): string };
  totalYards: { toString(): string };
  internalNotes: string | null;
  customerNotes: string | null;
  termsAndConditions: string | null;
  leadTime: string | null;
  deliveryNotes: string | null;
  priceListId: string | null;
  sentAt: Date | null;
  jobBidderId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type QuoteLineItemRecord = {
  id: string;
  lineNumber: number;
  lineType: string;
  productId: string | null;
  itemCode: string;
  description: string | null;
  quantity: { toString(): string };
  unit: string;
  unitPrice: { toString(): string };
  weight: { toString(): string } | null;
  yards: { toString(): string } | null;
  taxable: boolean;
  total: { toString(): string };
  statusNote: string | null;
  notes: string | null;
  isDrainRing?: boolean;
  ringDiameterFeet?: { toString(): string } | null;
  poolHeightFeet?: { toString(): string } | null;
  drainRingStyle?: DrainRingStyle;
  product?: {
    id?: string;
    productCode: string;
    name: string;
    documents?: {
      id: string;
      documentName: string;
      documentType: string;
      filePath: string;
    }[];
  } | null;
};

export type QuoteRevisionSummary = {
  id: string;
  quoteNumber: string;
  revisionNumber: number;
  status: string;
  createdAt: Date;
};

export type QuoteDetailRecord = QuoteRecord & {
  lineItems: QuoteLineItemRecord[];
  jobBidder?: { customer: { name: string } } | null;
  jobStructures?: Array<{
    id: string;
    jobId: string | null;
    structureNumber: string | null;
    description: string | null;
    status: string;
    needsSubmittal: boolean;
    _count?: { documents: number };
    job?: { id: string; folderPath: string | null } | null;
  }>;
  revisionFamily?: QuoteRevisionSummary[];
};

const structureStatusLabels: Record<string, string> = Object.fromEntries(
  structureStatusOptions.map((option) => [option.value, option.label]),
);

function mapQuoteRelatedStructure(
  structure: NonNullable<QuoteDetailRecord["jobStructures"]>[number],
  quoteJobId: string | null,
): QuoteRelatedStructure {
  const jobId = structure.jobId ?? structure.job?.id ?? quoteJobId ?? "";

  return {
    id: structure.id,
    structureNumber: structure.structureNumber ?? "—",
    description: structure.description ?? "—",
    status: structure.status,
    statusLabel: structureStatusLabels[structure.status] ?? structure.status,
    needsSubmittal: structure.needsSubmittal,
    documentCount: structure._count?.documents ?? 0,
    jobId,
    folderPath: structure.job?.folderPath ?? null,
  };
}

function formatQuoteDateLong(date: Date | null | undefined) {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatQuoteDate(date: Date | null | undefined) {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function toQuoteFormDateValue(date: Date | null | undefined): string {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function toQuoteFormNumberValue(
  value: { toString(): string } | null | undefined,
): string {
  if (!value) {
    return "";
  }

  const parsed = Number.parseFloat(value.toString());
  return Number.isFinite(parsed) ? String(parsed) : "";
}

function formatLineNotes(
  statusNote: string | null | undefined,
  notes: string | null | undefined,
) {
  const parts = [statusNote, notes].filter(
    (part): part is string => Boolean(part?.trim()),
  );

  return parts.length > 0 ? parts.join(" · ") : "—";
}

function deriveOriginalQuoteNumber(quote: QuoteDetailRecord) {
  if (quote.revisionNumber === 0) {
    return quote.quoteNumber;
  }

  return quote.quoteNumber.replace(/-R\d+(-\d+)?$/, "-R0");
}

function mapRevisionHistory(
  quote: QuoteDetailRecord,
  family: QuoteRevisionSummary[],
) {
  return family.map((entry) => {
    const status = entry.status as QuoteStatus;
    const statusLabel = quoteStatusLabels[status] ?? entry.status;
    const isCurrent = entry.id === quote.id;
    return {
      id: entry.id,
      label: `${entry.quoteNumber} — ${statusLabel}${isCurrent ? " (this quote)" : ""}`,
      isCurrent,
    };
  });
}

function deriveSupersededBy(
  quote: QuoteDetailRecord,
  family: QuoteRevisionSummary[],
) {
  if (quote.status !== "REVISED") {
    return null;
  }

  const successor = family
    .filter((entry) => entry.revisionNumber > quote.revisionNumber)
    .sort((a, b) => a.revisionNumber - b.revisionNumber)[0];

  if (!successor) {
    return null;
  }

  return {
    id: successor.id,
    quoteNumber: successor.quoteNumber,
    revision: `R${successor.revisionNumber}`,
  };
}

function mapLineTypeLabel(lineType: string) {
  return (
    quoteLineItemTypeLabels[lineType as keyof typeof quoteLineItemTypeLabels] ??
    lineType
  );
}

function formatQuoteLineDescription(line: QuoteLineItemRecord): string {
  if (line.isDrainRing && line.ringDiameterFeet && line.poolHeightFeet) {
    const diameter = Number(line.ringDiameterFeet);
    const poolHeight = Number(line.poolHeightFeet);
    const quantity = Number(line.quantity);
    const poolCount =
      poolHeight > 0 ? Math.round((quantity / poolHeight) * 100) / 100 : 0;
    if (Number.isFinite(diameter) && Number.isFinite(poolHeight) && poolCount > 0) {
      return formatDrainRingPoolDescription({
        poolCount,
        poolHeight,
        diameter,
        style: line.drainRingStyle ?? "DRAIN",
      });
    }
  }

  const description = line.description?.trim();
  if (description) {
    return description;
  }

  return "—";
}

function formatQuoteLineTypeLabel(line: QuoteLineItemRecord): string {
  if (line.isDrainRing) {
    const style = formatDrainRingStyleLabel(line.drainRingStyle ?? "DRAIN");
    return `Ring (${style})`;
  }

  return mapLineTypeLabel(line.lineType);
}

export type QuoteListRecord = Pick<
  QuoteRecord,
  | "id"
  | "quoteNumber"
  | "revisionNumber"
  | "jobNumber"
  | "projectName"
  | "customerName"
  | "quoteType"
  | "status"
  | "bidDueDate"
  | "total"
  | "estimator"
  | "updatedAt"
  | "quoteDate"
  | "createdAt"
>;

export function mapQuoteToRow(quote: QuoteListRecord): QuoteRow {
  const status = quote.status as QuoteStatus;
  const quoteType = quote.quoteType as QuoteType;

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    revision: `R${quote.revisionNumber}`,
    jobNumber: quote.jobNumber ?? "—",
    projectName: quote.projectName,
    customer: quote.customerName,
    quoteType,
    quoteTypeLabel: quoteTypeLabels[quoteType] ?? quote.quoteType,
    status,
    statusLabel: quoteStatusLabels[status] ?? quote.status,
    statusVariant: quoteStatusVariant(quote.status),
    bidDueDate: formatQuoteDate(quote.bidDueDate),
    total: formatUsd(quote.total),
    estimator: quote.estimator ?? "—",
    lastUpdated: formatQuoteDateLong(quote.updatedAt),
    year: quote.quoteDate?.getFullYear() ?? quote.createdAt.getFullYear(),
  };
}

export function mapQuoteToDetailView(quote: QuoteDetailRecord): QuoteDetailView {
  const status = quote.status as QuoteStatus;
  const taxRateNumber = Number.parseFloat(quote.taxRate.toString());
  const revisionFamily = quote.revisionFamily ?? [
    {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      revisionNumber: quote.revisionNumber,
      status: quote.status,
      createdAt: quote.createdAt,
    },
  ];
  const supersededBy = deriveSupersededBy(quote, revisionFamily);

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    originalQuote: deriveOriginalQuoteNumber(quote),
    title: `Quote ${quote.quoteNumber}`,
    subtitle: `${quote.projectName} — ${quote.customerName}`,
    status,
    statusLabel: quoteStatusLabels[status] ?? quote.status,
    statusVariant: quoteStatusVariant(quote.status),
    total: formatUsd(quote.total),
    bidDueDate: formatQuoteDate(quote.bidDueDate),
    revision: `R${quote.revisionNumber}`,
    estimator: quote.estimator ?? "—",
    jobId: quote.jobId,
    jobNumber: quote.jobNumber ?? "—",
    projectName: quote.projectName,
    projectAddress: quote.projectAddress?.trim() || "—",
    customer: quote.customerName,
    contactName: quote.contactName?.trim() || "—",
    contactEmail: quote.contactEmail?.trim() || "—",
    contactEmailAddress: quote.contactEmail?.trim() ?? "",
    contactPhone: quote.contactPhone?.trim() || "—",
    contactTitle: quote.contactTitle?.trim() || "—",
    quoteDate: formatQuoteDate(quote.quoteDate),
    sentAt: formatQuoteDate(quote.sentAt),
    bidListContractor: quote.jobBidder?.customer.name ?? null,
    expirationDate: formatQuoteDate(quote.expirationDate),
    priceList: "—",
    taxRate: `${Number.isFinite(taxRateNumber) ? taxRateNumber : 0}%`,
    customerPo: quote.customerPO?.trim() || "—",
    customerNotes: quote.customerNotes?.trim() || "—",
    internalNotes: quote.internalNotes?.trim() || "—",
    deliveryNotes: quote.deliveryNotes?.trim() || "—",
    leadTime: quote.leadTime?.trim() || "—",
    terms: quote.termsAndConditions?.trim() || "—",
    lineItems: quote.lineItems.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      type: line.lineType as QuoteDetailView["lineItems"][number]["type"],
      typeLabel: formatQuoteLineTypeLabel(line),
      item: line.itemCode,
      description: formatQuoteLineDescription(line),
      qty: formatQuantity(line.quantity),
      unit: line.unit,
      unitPrice: formatUsd(line.unitPrice),
      weight: formatWeightLb(line.weight),
      yards: formatYards(line.yards),
      taxable: line.taxable,
      total: formatUsd(line.total),
      statusNotes: formatLineNotes(line.statusNote, line.notes),
    })),
    summary: {
      subtotal: formatUsd(quote.subtotal),
      discount: formatUsd(quote.discountAmount),
      delivery: formatUsd(quote.deliveryAmount),
      taxableAmount: formatUsd(quote.taxableAmount),
      salesTax: formatUsd(quote.salesTax),
      total: formatUsd(quote.total),
      totalWeight: formatWeightLb(quote.totalWeight),
      totalYards: formatYards(quote.totalYards),
    },
    revisionHistory: mapRevisionHistory(quote, revisionFamily),
    canRevise: status === "SENT" || status === "WON",
    canEdit: canEditQuote(status, supersededBy),
    canSend: canSendQuote(status, supersededBy),
    supersededBy,
    relatedStructures: (quote.jobStructures ?? []).map((structure) =>
      mapQuoteRelatedStructure(structure, quote.jobId),
    ),
    relatedRecords: {
      jobNumber: quote.jobNumber ?? "—",
      customer: quote.customerName,
      structures:
        (quote.jobStructures?.length ?? 0) > 0
          ? `${quote.jobStructures!.length} linked`
          : "Not linked",
      documents: "0",
      submittals: formatSubmittalsStatus(quote),
      invoice: "Not created",
      deliveryTickets: "None",
    },
  };
}

export function mapQuoteToFormInitialValues(
  quote: QuoteDetailRecord,
): QuoteFormInitialValues {
  const taxRateNumber = Number.parseFloat(quote.taxRate.toString());

  return {
    quoteNumber: quote.quoteNumber,
    customerId: quote.customerId ?? "",
    customerName: quote.customerName,
    jobId: quote.jobId ?? "",
    jobBidderId: quote.jobBidderId ?? "",
    jobNumber: quote.jobNumber ?? "",
    projectName: quote.projectName,
    projectAddress: quote.projectAddress?.trim() ?? "",
    contactId: quote.contactId ?? "",
    contactTitle: quote.contactTitle?.trim() ?? "",
    contactName: quote.contactName?.trim() ?? "",
    contactEmail: quote.contactEmail?.trim() ?? "",
    contactPhone: quote.contactPhone?.trim() ?? "",
    status: quote.status as QuoteStatus,
    quoteType: quote.quoteType as QuoteType,
    estimator: quote.estimator?.trim() ?? "",
    quoteDate: toQuoteFormDateValue(quote.quoteDate),
    bidDueDate: toQuoteFormDateValue(quote.bidDueDate),
    expirationDate: toQuoteFormDateValue(quote.expirationDate),
    customerPo: quote.customerPO?.trim() ?? "",
    priceListId: quote.priceListId ?? "",
    taxRate: Number.isFinite(taxRateNumber) ? String(taxRateNumber) : "0",
    internalNotes: quote.internalNotes?.trim() ?? "",
    customerNotes: quote.customerNotes?.trim() ?? "",
    leadTime: quote.leadTime?.trim() ?? "",
    deliveryNotes: quote.deliveryNotes?.trim() ?? "",
    termsAndConditions: quote.termsAndConditions?.trim() ?? "",
    lineItems: quote.lineItems.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      type: line.lineType as QuoteLineItemType,
      typeLabel: formatQuoteLineTypeLabel(line),
      item: line.itemCode,
      description: line.description?.trim() ?? "",
      qty: toQuoteFormNumberValue(line.quantity),
      unit: line.unit,
      unitPrice: toQuoteFormNumberValue(line.unitPrice),
      weight: line.weight ? toQuoteFormNumberValue(line.weight) : "",
      yards: line.yards ? toQuoteFormNumberValue(line.yards) : "",
      taxable: line.taxable,
      productId: line.productId,
      statusNote: line.statusNote,
      isDrainRing: line.isDrainRing ?? false,
      ringDiameterFeet: line.ringDiameterFeet
        ? Number.parseFloat(line.ringDiameterFeet.toString())
        : null,
      poolHeightFeet: line.poolHeightFeet
        ? Number.parseFloat(line.poolHeightFeet.toString())
        : null,
      drainRingStyle: (line.drainRingStyle ?? "DRAIN") as DrainRingStyle,
    })),
  };
}

export function mapProductToQuoteFormOption(product: {
  id: string;
  productCode: string;
  name: string;
  category: string;
  description: string | null;
  unit: string;
  defaultPrice: { toString(): string } | null;
  weight: { toString(): string } | null;
  yards: { toString(): string } | null;
  taxable: boolean;
  castingRole?: string | null;
}) {
  const isCastingAssembly = product.castingRole === "ASSEMBLY";
  const isCastingComponent = product.castingRole === "COMPONENT";
  const subcategory = product.description?.trim() || "";
  const baseDescription = subcategory || product.name;
  const description = isCastingAssembly
    ? `${baseDescription} [Casting assembly]`
    : isCastingComponent
      ? `${baseDescription} [Casting piece]`
      : baseDescription;

  return {
    id: product.id,
    code: product.productCode,
    name: product.name,
    description,
    category: product.category,
    subcategory,
    unit: product.unit,
    unitPrice: product.defaultPrice
      ? Number.parseFloat(product.defaultPrice.toString())
      : 0,
    weightLb: product.weight
      ? Number.parseFloat(product.weight.toString())
      : 0,
    yards: product.yards ? Number.parseFloat(product.yards.toString()) : 0,
    taxable: product.taxable,
    isCastingAssembly,
    isCastingComponent,
  };
}
