/**
 * Live ticket preview for the delivery ticket editor.
 *
 * The editor sends what is on screen (job, date, driver, lines...) and this
 * module turns it into the same shape the saved-ticket PDF is filled from,
 * WITHOUT saving anything. Everything the editor does not carry is looked up
 * the way a save would leave it:
 *
 * - Editing: the saved ticket keeps its number, own delivery address, site
 *   contact and notes (the editor never sends those, so a save keeps them).
 * - New: no number yet ("DRAFT" prints, the real one is taken on save), and
 *   the site contact defaults to the customer's FIELD contact unless the job
 *   carries its own, exactly like createDeliveryTicket.
 * - The job's delivery site and the quote's PO / terms resolve live, as they
 *   do on the saved ticket's PDF (lib/delivery-site).
 */
import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import { getDefaultContactForRole } from "@/lib/customer-contacts";
import { parseLocalDay } from "@/lib/date-only";
import { hasSiteContact } from "@/lib/delivery-site";
import { normalizeCustomLine } from "@/lib/delivery-ticket-custom-line";
import type { DbDeliveryTicketForPdf } from "@/lib/delivery-ticket-pdf-data";

type DbClient = PrismaClient | Prisma.TransactionClient;

/** More lines than any real load; keeps a bad request from filling pages. */
export const DRAFT_PREVIEW_MAX_LINES = 400;

export type DeliveryTicketDraftPreviewLine = {
  productId: string | null;
  jobStructureId: string | null;
  itemCode: string;
  description: string | null;
  quantity: number;
  unit: string;
  weightEach: number | null;
};

export type DeliveryTicketDraftPreviewInput = {
  /** The ticket being edited; null while creating a new one. */
  ticketId: string | null;
  ticketType: "JOB" | "WALK_IN";
  fulfillmentMethod: "DELIVERY" | "PICKUP";
  jobId: string | null;
  quoteId: string | null;
  customerId: string | null;
  jobNumber: string | null;
  customerName: string;
  projectName: string;
  /** yyyy-mm-dd, as the date input holds it. */
  deliveryDate: string | null;
  driver: string | null;
  trailer: string | null;
  customLine: string | null;
  lines: DeliveryTicketDraftPreviewLine[];
};

function text(value: unknown, maxLength = 500): string {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function textOrNull(value: unknown, maxLength = 500): string | null {
  const trimmed = text(value, maxLength).trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Re-reads what the browser sent: a server action can be called with anything,
 * so nothing here is trusted to have the declared shape.
 */
export function parseDraftPreviewInput(
  raw: unknown,
): DeliveryTicketDraftPreviewInput {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const rawLines = Array.isArray(input.lines) ? input.lines : [];
  const lines: DeliveryTicketDraftPreviewLine[] = [];
  for (const entry of rawLines.slice(0, DRAFT_PREVIEW_MAX_LINES)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const line = entry as Record<string, unknown>;
    const quantity = numberOrNull(line.quantity);
    if (quantity == null || quantity <= 0) {
      continue;
    }
    lines.push({
      productId: textOrNull(line.productId, 64),
      jobStructureId: textOrNull(line.jobStructureId, 64),
      itemCode: text(line.itemCode, 200),
      description: textOrNull(line.description, 2000),
      quantity,
      unit: text(line.unit, 20).trim() || "EA",
      weightEach: numberOrNull(line.weightEach),
    });
  }

  const ticketType = input.ticketType === "WALK_IN" ? "WALK_IN" : "JOB";
  return {
    ticketId: textOrNull(input.ticketId, 64),
    ticketType,
    // Walk-ins are always picked up at the yard.
    fulfillmentMethod:
      ticketType === "WALK_IN" || input.fulfillmentMethod === "PICKUP"
        ? "PICKUP"
        : "DELIVERY",
    jobId: ticketType === "JOB" ? textOrNull(input.jobId, 64) : null,
    quoteId: ticketType === "JOB" ? textOrNull(input.quoteId, 64) : null,
    customerId: textOrNull(input.customerId, 64),
    jobNumber: textOrNull(input.jobNumber, 100),
    customerName: text(input.customerName).trim(),
    projectName: text(input.projectName).trim(),
    deliveryDate: textOrNull(input.deliveryDate, 10),
    driver: textOrNull(input.driver, 200),
    trailer: textOrNull(input.trailer, 200),
    customLine: textOrNull(input.customLine, 200),
    lines,
  };
}

type SavedTicketFields = {
  ticketNumber: string | null;
  deliveryAddress: string | null;
  siteContactName: string | null;
  siteContactPhone: string | null;
  siteInstructions: string | null;
  customerNotes: string | null;
};

type DraftJob = NonNullable<DbDeliveryTicketForPdf["job"]>;
type DraftQuote = NonNullable<DbDeliveryTicketForPdf["quote"]>;
type DraftStructure = NonNullable<
  DbDeliveryTicketForPdf["lineItems"][number]["jobStructure"]
>;
type DraftProduct = NonNullable<
  DbDeliveryTicketForPdf["lineItems"][number]["product"]
>;

/** Everything the draft needs that is not on the editor screen. */
export type DraftPreviewLookups = {
  /** The saved ticket, when editing one. */
  saved: SavedTicketFields | null;
  job: DraftJob | null;
  quote: DraftQuote | null;
  /** New tickets only: the contact a save would put on the ticket. */
  defaultSiteContact: { name: string | null; phone: string | null } | null;
  structuresById: Map<string, DraftStructure>;
  productsById: Map<string, DraftProduct>;
};

/** The ticket as it would be saved right now, in the PDF fill's shape. */
export function buildDraftTicketForPdf(
  input: DeliveryTicketDraftPreviewInput,
  lookups: DraftPreviewLookups,
): DbDeliveryTicketForPdf {
  const { saved } = lookups;
  let totalWeight = 0;
  const lineItems: DbDeliveryTicketForPdf["lineItems"] = input.lines.map(
    (line) => {
      const lineWeight =
        line.weightEach != null ? line.weightEach * line.quantity : null;
      totalWeight += lineWeight ?? 0;
      return {
        itemCode: line.itemCode,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        totalWeight: lineWeight,
        jobStructure: line.jobStructureId
          ? (lookups.structuresById.get(line.jobStructureId) ?? null)
          : null,
        product: line.productId
          ? (lookups.productsById.get(line.productId) ?? null)
          : null,
      };
    },
  );

  return {
    ticketNumber: saved?.ticketNumber ?? null,
    fulfillmentMethod: input.fulfillmentMethod,
    customLine:
      input.ticketType === "JOB" ? normalizeCustomLine(input.customLine) : null,
    customerName: input.customerName,
    projectName: input.projectName,
    deliveryAddress: saved?.deliveryAddress ?? null,
    siteContactName: saved
      ? saved.siteContactName
      : (lookups.defaultSiteContact?.name ?? null),
    siteContactPhone: saved
      ? saved.siteContactPhone
      : (lookups.defaultSiteContact?.phone ?? null),
    jobNumber: input.jobNumber,
    deliveryDate: input.deliveryDate ? parseLocalDay(input.deliveryDate) : null,
    driver: input.driver,
    trailer: input.trailer,
    customerNotes: saved?.customerNotes ?? null,
    siteInstructions: saved?.siteInstructions ?? null,
    totalItems: lineItems.length,
    totalWeight: totalWeight > 0 ? totalWeight : null,
    customer: null,
    job: lookups.job,
    quoteNumber: null,
    quote: lookups.quote,
    lineItems,
  };
}

/** Reads the lookups for a draft and builds the printable ticket. Read only. */
export async function loadDraftTicketForPdf(
  client: DbClient,
  input: DeliveryTicketDraftPreviewInput,
): Promise<DbDeliveryTicketForPdf> {
  const structureIds = [
    ...new Set(
      input.lines
        .map((line) => line.jobStructureId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const productIds = [
    ...new Set(
      input.lines
        .map((line) => line.productId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [saved, job, quote, structures, products] = await Promise.all([
    input.ticketId
      ? client.deliveryTicket.findUnique({
          where: { id: input.ticketId },
          select: {
            ticketNumber: true,
            deliveryAddress: true,
            siteContactName: true,
            siteContactPhone: true,
            siteInstructions: true,
            customerNotes: true,
          },
        })
      : null,
    input.jobId
      ? client.job.findUnique({
          where: { id: input.jobId },
          select: {
            customerId: true,
            deliveryAddress: true,
            projectAddress: true,
            city: true,
            state: true,
            zip: true,
            siteContactName: true,
            siteContactPhone: true,
            siteContactEmail: true,
          },
        })
      : null,
    input.quoteId
      ? client.quote.findUnique({
          where: { id: input.quoteId },
          select: {
            customerPO: true,
            termsAndConditions: true,
            projectAddress: true,
          },
        })
      : null,
    structureIds.length > 0
      ? client.jobStructure.findMany({
          where: { id: { in: structureIds } },
          select: { id: true, structureNumber: true, description: true },
        })
      : [],
    productIds.length > 0
      ? client.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            pipeLengthFeet: true,
            castingRole: true,
            castingSoldAsUnit: true,
            castingAssemblyComponents: { select: { quantity: true } },
          },
        })
      : [],
  ]);

  if (input.ticketId && !saved) {
    throw new Error("Delivery ticket not found.");
  }

  // A new ticket picks up the customer's FIELD contact on save, unless the
  // job has its own site contact (that one always wins on the PDF).
  let defaultSiteContact: DraftPreviewLookups["defaultSiteContact"] = null;
  const customerId = input.customerId ?? job?.customerId ?? null;
  if (
    !saved &&
    customerId &&
    input.fulfillmentMethod !== "PICKUP" &&
    !hasSiteContact(job)
  ) {
    const fieldContact = await getDefaultContactForRole(
      client,
      customerId,
      "FIELD",
    );
    if (fieldContact) {
      defaultSiteContact = {
        name: fieldContact.contactName,
        phone: fieldContact.contactPhone,
      };
    }
  }

  return buildDraftTicketForPdf(input, {
    saved,
    job,
    quote,
    defaultSiteContact,
    structuresById: new Map(
      structures.map((structure) => [structure.id, structure]),
    ),
    productsById: new Map(products.map((product) => [product.id, product])),
  });
}
