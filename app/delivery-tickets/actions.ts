"use server";

import { revalidatePath } from "next/cache";
import { AppPermission, Prisma } from "@/app/generated/prisma/client";
import type {
  DeliveryLineType,
  DeliveryTicketStatus,
  DeliveryTicketType,
  FulfillmentMethod,
  TicketPaymentMethod,
} from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { allocateDeliveryTicketNumber } from "@/lib/delivery-ticket-number";
import {
  cancelDeliveredTicket,
  getQuoteLineFulfillmentAndScheduled,
  markDeliveryTicketDelivered,
  OPEN_TICKET_STATUSES,
} from "@/lib/delivery-fulfillment";
import { formatDrainRingStyleLabel } from "@/lib/drain-ring-utils";
import { generateSubmittalPackageForDeliveryTicket } from "@/lib/submittal-package";
import { maybeCreatePayNowInvoiceForTicket } from "@/lib/invoicing-service";
import { getDefaultPriceListId, getProductPricesForList } from "@/lib/price-list-service";
import {
  enrichProductWithDerivedAssemblyValues,
  isDerivableCastingAssembly,
  loadDerivedAssemblyValues,
} from "@/lib/casting-service";
import { withDatabaseRetry } from "@/lib/prisma";

export type TicketProductOption = {
  id: string;
  productCode: string;
  name: string;
  unit: string;
  weight: number | null;
  unitPrice: number | null;
  currentStock: number | null;
  trackInventory: boolean;
};

export type DeliveryTicketLineInput = {
  quoteLineItemId?: string | null;
  productId?: string | null;
  jobStructureId?: string | null;
  lineType: DeliveryLineType;
  itemCode: string;
  description?: string | null;
  quantity: number;
  unit?: string;
  weightEach?: number | null;
  yardLocation?: string | null;
  notes?: string | null;
};

export type SaveDeliveryTicketInput = {
  ticketType: DeliveryTicketType;
  fulfillmentMethod?: FulfillmentMethod;
  status: DeliveryTicketStatus;
  paymentMethod?: TicketPaymentMethod | null;
  paymentReceived?: boolean;
  pickedUpBy?: string | null;
  jobId?: string | null;
  quoteId?: string | null;
  customerId?: string | null;
  priceListId?: string | null;
  jobNumber?: string | null;
  quoteNumber?: string | null;
  customerName: string;
  projectName: string;
  deliveryAddress?: string | null;
  siteContactName?: string | null;
  siteContactPhone?: string | null;
  siteContactEmail?: string | null;
  siteInstructions?: string | null;
  deliveryDate?: string | null;
  deliveryTime?: string | null;
  requestedBy?: string | null;
  createdBy?: string | null;
  truck?: string | null;
  trailer?: string | null;
  driver?: string | null;
  loadSequence?: string | null;
  specialEquipmentNeeded?: string | null;
  craneRequired?: boolean;
  forkliftRequired?: boolean;
  driverNotes?: string | null;
  internalNotes?: string | null;
  customerNotes?: string | null;
  loadingNotes?: string | null;
  // ISO timestamp of the ticket's updatedAt when the editor loaded it. When
  // provided, updateDeliveryTicket rejects the save if someone else changed
  // the ticket in the meantime (optimistic concurrency).
  expectedUpdatedAt?: string;
  lines: DeliveryTicketLineInput[];
};

function parseDate(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

async function validateLines(
  client: Prisma.TransactionClient,
  input: SaveDeliveryTicketInput,
  excludeTicketId?: string,
) {
  if (input.lines.length === 0) {
    throw new Error("Add at least one delivery line.");
  }

  if (input.ticketType === "JOB" && input.quoteId) {
    // Remaining = quoted − delivered − scheduled-on-other-open-tickets, so two
    // open loads can't jointly commit more than the quote allows.
    const { fulfillment, scheduled: scheduledByLine } =
      await getQuoteLineFulfillmentAndScheduled(
        client,
        input.quoteId,
        excludeTicketId,
        OPEN_TICKET_STATUSES,
      );
    const byId = new Map(fulfillment.map((line) => [line.quoteLineItemId, line]));
    const remainingFor = (line: (typeof fulfillment)[number]) =>
      Math.max(0, line.remainingQty - (scheduledByLine.get(line.quoteLineItemId) ?? 0));
    const drainRingFeetByLine = new Map<string, number>();
    const adsPipeQtyByLine = new Map<string, number>();
    const castingPiecesByAssembly = new Map<string, Map<string, number>>();

    for (const line of input.lines) {
      if (!line.quoteLineItemId) continue;
      const meta = byId.get(line.quoteLineItemId);
      if (!meta) {
        throw new Error(`Quote line ${line.itemCode} is not on this quote.`);
      }
      if (line.quantity <= 0) {
        throw new Error(`Quantity must be greater than zero for ${line.itemCode}.`);
      }

      if (meta.isDrainRing) {
        const option = meta.drainRingOptions.find(
          (entry) => entry.productId === line.productId,
        );
        if (!option) {
          throw new Error(
            `${line.itemCode} is not a valid ${formatDrainRingStyleLabel(meta.drainRingStyle).toLowerCase()} ring for ${meta.displayName}.`,
          );
        }
        if (option.drainRingStyle !== meta.drainRingStyle) {
          throw new Error(
            `${line.itemCode} does not match the quoted ${formatDrainRingStyleLabel(meta.drainRingStyle).toLowerCase()} ring line.`,
          );
        }
        drainRingFeetByLine.set(
          line.quoteLineItemId,
          (drainRingFeetByLine.get(line.quoteLineItemId) ?? 0) +
            option.heightFeet * line.quantity,
        );
        continue;
      }

      if (meta.isAdsPipe) {
        if (!line.productId) {
          throw new Error(
            `${line.itemCode} requires a product selection for ADS pipe fulfillment.`,
          );
        }
        const option = meta.adsPipeOptions.find(
          (entry) => entry.productId === line.productId,
        );
        if (!option) {
          throw new Error(
            `${line.itemCode} is not a valid ADS pipe SKU for ${meta.displayName}.`,
          );
        }
        adsPipeQtyByLine.set(
          line.quoteLineItemId,
          (adsPipeQtyByLine.get(line.quoteLineItemId) ?? 0) + line.quantity,
        );
        continue;
      }

      if (meta.isCastingAssembly) {
        if (!line.productId) continue;
        const pieces = castingPiecesByAssembly.get(line.quoteLineItemId) ?? new Map<string, number>();
        pieces.set(line.productId, (pieces.get(line.productId) ?? 0) + line.quantity);
        castingPiecesByAssembly.set(line.quoteLineItemId, pieces);
        continue;
      }

      const remainingQty = remainingFor(meta);
      if (line.quantity > remainingQty) {
        throw new Error(
          `Quantity for ${line.itemCode} exceeds remaining (${remainingQty}${remainingQty < meta.remainingQty ? ", including other open tickets" : ""}).`,
        );
      }
      if (
        (line.lineType === "CONFIGURABLE_STRUCTURE" ||
          line.lineType === "CUSTOM_STRUCTURE") &&
        meta.jobStructureStatus !== "MADE"
      ) {
        throw new Error(`${line.itemCode} is not made yet (${meta.jobStructureStatus ?? "no structure"}).`);
      }
    }

    for (const [quoteLineItemId, feet] of drainRingFeetByLine) {
      const meta = byId.get(quoteLineItemId);
      if (!meta) continue;
      const remainingQty = remainingFor(meta);
      if (feet > remainingQty + 0.001) {
        const over = Math.round((feet - remainingQty) * 100) / 100;
        throw new Error(
          `${meta.displayName} exceeds remaining (${remainingQty} LF${remainingQty < meta.remainingQty ? ", including other open tickets" : ""}) by ${over} LF.`,
        );
      }
    }

    for (const [quoteLineItemId, qty] of adsPipeQtyByLine) {
      const meta = byId.get(quoteLineItemId);
      if (!meta) continue;
      const remainingQty = remainingFor(meta);
      if (qty > remainingQty) {
        throw new Error(
          `${meta.displayName} exceeds remaining (${remainingQty}${remainingQty < meta.remainingQty ? ", including other open tickets" : ""}).`,
        );
      }
    }

    for (const [quoteLineItemId, piecesByProduct] of castingPiecesByAssembly) {
      const meta = byId.get(quoteLineItemId);
      if (!meta || meta.castingComponentOptions.length === 0) continue;
      let sets = Number.POSITIVE_INFINITY;
      for (const option of meta.castingComponentOptions) {
        const pieces = piecesByProduct.get(option.productId) ?? 0;
        sets = Math.min(sets, Math.floor(pieces / option.quantity));
      }
      const setsUsed = Number.isFinite(sets) ? sets : 0;
      const remainingQty = remainingFor(meta);
      if (setsUsed > remainingQty) {
        throw new Error(
          `${meta.displayName}: sets on this load (${setsUsed}) exceed remaining (${remainingQty}${remainingQty < meta.remainingQty ? ", including other open tickets" : ""}).`,
        );
      }
    }
  }
}

function buildLineCreates(lines: DeliveryTicketLineInput[]) {
  return lines.map((line, index) => {
    const qty = toDecimal(line.quantity);
    const weightEach = line.weightEach != null ? toDecimal(line.weightEach) : null;
    const totalWeight = weightEach ? weightEach.mul(qty) : null;

    return {
      lineNumber: index + 1,
      lineType: line.lineType,
      productId: line.productId ?? null,
      quoteLineItemId: line.quoteLineItemId ?? null,
      jobStructureId: line.jobStructureId ?? null,
      itemCode: line.itemCode,
      description: line.description ?? null,
      quantity: qty,
      unit: line.unit ?? "EA",
      weightEach,
      totalWeight,
      yardLocation: line.yardLocation ?? null,
      notes: line.notes ?? null,
      sortOrder: index,
      status: "NOT_READY" as const,
    };
  });
}

function ticketData(input: SaveDeliveryTicketInput) {
  const lineCreates = buildLineCreates(input.lines);
  const totalItems = input.lines.length;
  const totalWeight = lineCreates.reduce((sum, line) => {
    if (!line.totalWeight) return sum;
    return sum.add(line.totalWeight);
  }, new Prisma.Decimal(0));

  return {
    ticketType: input.ticketType,
    fulfillmentMethod: input.fulfillmentMethod ?? "DELIVERY",
    status: input.status,
    paymentMethod: input.paymentMethod ?? null,
    paymentReceived: input.paymentReceived ?? false,
    pickedUpBy: input.pickedUpBy ?? null,
    jobId: input.jobId ?? null,
    quoteId: input.quoteId ?? null,
    customerId: input.customerId ?? null,
    priceListId: input.priceListId ?? null,
    jobNumber: input.jobNumber ?? null,
    quoteNumber: input.quoteNumber ?? null,
    customerName: input.customerName.trim(),
    projectName: input.projectName.trim(),
    deliveryAddress: input.deliveryAddress ?? null,
    siteContactName: input.siteContactName ?? null,
    siteContactPhone: input.siteContactPhone ?? null,
    siteContactEmail: input.siteContactEmail ?? null,
    siteInstructions: input.siteInstructions ?? null,
    deliveryDate: parseDate(input.deliveryDate),
    deliveryTime: input.deliveryTime ?? null,
    requestedBy: input.requestedBy ?? null,
    createdBy: input.createdBy ?? null,
    truck: input.truck ?? null,
    trailer: input.trailer ?? null,
    driver: input.driver ?? null,
    loadSequence: input.loadSequence ?? null,
    specialEquipmentNeeded: input.specialEquipmentNeeded ?? null,
    craneRequired: input.craneRequired ?? false,
    forkliftRequired: input.forkliftRequired ?? false,
    driverNotes: input.driverNotes ?? null,
    internalNotes: input.internalNotes ?? null,
    customerNotes: input.customerNotes ?? null,
    loadingNotes: input.loadingNotes ?? null,
    totalItems,
    totalWeight: totalWeight.gt(0) ? totalWeight : null,
    lineItems: { create: lineCreates },
  };
}

export type DeliveryTicketActionResult =
  | { success: true; ticketId: string }
  | { error: string };

export async function createDeliveryTicket(
  input: SaveDeliveryTicketInput,
): Promise<DeliveryTicketActionResult> {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  if (!input.customerName.trim() || !input.projectName.trim()) {
    return { error: "Customer and project name are required." };
  }

  if (input.status === "SCHEDULED" && !input.deliveryDate?.trim()) {
    return { error: "Pick a delivery date before scheduling." };
  }

  try {
    const defaultPriceListId = input.priceListId ?? (await getDefaultPriceListId());
    const ticket = await withDatabaseRetry(async (client) =>
      client.$transaction(async (tx) => {
        await validateLines(tx, input);
        const numbering = await allocateDeliveryTicketNumber(tx);
        return tx.deliveryTicket.create({
          data: {
            ...ticketData({ ...input, priceListId: defaultPriceListId }),
            ticketNumber: numbering.ticketNumber,
            year: numbering.year,
            yearTwoDigit: numbering.yearTwoDigit,
            sequenceNumber: numbering.sequenceNumber,
          },
          select: { id: true },
        });
      }),
    );

    revalidatePath("/delivery-tickets");
    return { success: true, ticketId: ticket.id };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not create delivery ticket.",
    };
  }
}

export async function updateDeliveryTicket(
  ticketId: string,
  input: SaveDeliveryTicketInput,
): Promise<DeliveryTicketActionResult> {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  if (!input.customerName.trim() || !input.projectName.trim()) {
    return { error: "Customer and project name are required." };
  }

  if (input.status === "SCHEDULED" && !input.deliveryDate?.trim()) {
    return { error: "Pick a delivery date before scheduling." };
  }

  try {
    await withDatabaseRetry(async (client) =>
      client.$transaction(async (tx) => {
        const existing = await tx.deliveryTicket.findUnique({
          where: { id: ticketId },
          select: { status: true, updatedAt: true },
        });
        if (!existing) throw new Error("Delivery ticket not found.");
        if (existing.status === "DELIVERED") {
          throw new Error("Delivered tickets cannot be edited.");
        }
        if (input.expectedUpdatedAt) {
          // Lines are replaced wholesale below, so a stale save would silently
          // discard another dispatcher's edits. Compare millisecond timestamps
          // to detect a concurrent change since the editor loaded.
          const expected = new Date(input.expectedUpdatedAt);
          if (
            Number.isNaN(expected.getTime()) ||
            existing.updatedAt.getTime() !== expected.getTime()
          ) {
            throw new Error(
              "This ticket was changed by someone else while you were editing. Refresh the page to load the latest version, then re-apply your changes.",
            );
          }
        }

        await validateLines(tx, input, ticketId);
        await tx.deliveryTicketLineItem.deleteMany({ where: { deliveryTicketId: ticketId } });

        const defaultPriceListId =
          input.priceListId ?? (await getDefaultPriceListId(tx));
        const data = ticketData({ ...input, priceListId: defaultPriceListId });
        const { lineItems, ...rest } = data;

        await tx.deliveryTicket.update({
          where: { id: ticketId },
          data: {
            ...rest,
            lineItems,
          },
        });
      }),
    );

    revalidatePath("/delivery-tickets");
    revalidatePath(`/delivery-tickets/${ticketId}`);
    return { success: true, ticketId };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not update delivery ticket.",
    };
  }
}

export async function listStockProductsForTicket(
  priceListId?: string | null,
): Promise<TicketProductOption[]> {
  await requirePermission(AppPermission.DELIVERY_VIEW);
  const resolvedPriceListId =
    priceListId ?? (await getDefaultPriceListId()) ?? null;

  const products = await withDatabaseRetry((client) =>
    client.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: { productCode: "asc" },
      select: {
        id: true,
        productCode: true,
        name: true,
        unit: true,
        weight: true,
        cost: true,
        castingRole: true,
        castingSoldAsUnit: true,
        manufacturerCode: true,
        currentStockQuantity: true,
        trackInventory: true,
      },
    }),
  );

  const priceMap = resolvedPriceListId
    ? await getProductPricesForList(
        products.map((product) => product.id),
        resolvedPriceListId,
      )
    : new Map();

  const derivableAssemblyIds = products
    .filter((product) => isDerivableCastingAssembly(product))
    .map((product) => product.id);
  const derivedMap = derivableAssemblyIds.length
    ? await withDatabaseRetry((client) =>
        loadDerivedAssemblyValues(
          client,
          derivableAssemblyIds,
          resolvedPriceListId,
        ),
      )
    : new Map();

  return products.map((product) => {
    const enriched = enrichProductWithDerivedAssemblyValues(
      product,
      priceMap.get(product.id),
      derivedMap.get(product.id),
    );
    return {
      id: product.id,
      productCode: product.productCode,
      name: product.name,
      unit: product.unit,
      weight:
        enriched.weight != null ? Number(enriched.weight.toString()) : null,
      unitPrice:
        enriched.unitPrice != null
          ? Number(enriched.unitPrice.toString())
          : null,
      currentStock: product.trackInventory ? product.currentStockQuantity : null,
      trackInventory: product.trackInventory,
    };
  });
}

export type GenerateTicketSubmittalResult =
  | {
      success: true;
      filePath: string;
      missing: string[];
      skipped: string[];
      includedCount: number;
    }
  | { success: false; error: string };

export async function generateDeliveryTicketSubmittalPackage(
  ticketId: string,
): Promise<GenerateTicketSubmittalResult> {
  await requirePermission(AppPermission.DELIVERY_VIEW);
  if (!ticketId.trim()) {
    return { success: false, error: "Ticket id is required." };
  }

  try {
    const result = await withDatabaseRetry((client) =>
      generateSubmittalPackageForDeliveryTicket(client, ticketId),
    );
    return {
      success: true,
      filePath: result.filePath,
      missing: result.missing,
      skipped: result.skipped,
      includedCount: result.includedCount,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate submittal package.",
    };
  }
}

const STATUS_FLOW: Record<string, DeliveryTicketStatus[]> = {
  DRAFT: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["IN_TRANSIT", "DELIVERED", "CANCELLED"],
  LOADING: ["IN_TRANSIT", "DELIVERED", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export async function updateDeliveryTicketStatus(
  ticketId: string,
  status: DeliveryTicketStatus,
) {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  try {
    const ticket = await withDatabaseRetry((client) =>
      client.deliveryTicket.findUnique({
        where: { id: ticketId },
        select: { status: true },
      }),
    );

    if (!ticket) {
      return { error: "Delivery ticket not found." };
    }

    const allowed = STATUS_FLOW[ticket.status] ?? [];
    if (!allowed.includes(status) && ticket.status !== status) {
      return { error: `Cannot change status from ${ticket.status} to ${status}.` };
    }

    let invoiceWarning: string | null = null;
    if (status === "DELIVERED") {
      await withDatabaseRetry((client) =>
        markDeliveryTicketDelivered(client, ticketId),
      );
      const invoiceResult = await withDatabaseRetry((client) =>
        maybeCreatePayNowInvoiceForTicket(client, ticketId),
      );
      if (invoiceResult.error) {
        invoiceWarning = `Ticket completed, but the pay-now invoice could not be created: ${invoiceResult.error}`;
      } else if (invoiceResult.invoiceId) {
        revalidatePath("/invoices");
      }
    } else if (status === "CANCELLED" && ticket.status === "DELIVERED") {
      await withDatabaseRetry((client) =>
        cancelDeliveredTicket(client, ticketId),
      );
    } else {
      await withDatabaseRetry((client) =>
        client.deliveryTicket.update({
          where: { id: ticketId },
          data: { status },
        }),
      );
    }

    revalidatePath("/delivery-tickets");
    revalidatePath(`/delivery-tickets/${ticketId}`);
    revalidatePath("/walk-ins");
    revalidatePath("/inventory");
    return { success: true, warning: invoiceWarning };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not update ticket status.",
    };
  }
}

export type DeliveryTicketJobSearchOption = {
  id: string;
  jobNumber: string;
  projectName: string;
  customerName: string;
};

export async function searchJobsForDeliveryTicket(
  query: string,
): Promise<DeliveryTicketJobSearchOption[]> {
  await requirePermission(AppPermission.DELIVERY_MANAGE);

  const trimmed = query.trim();
  return withDatabaseRetry((client) =>
    client.job.findMany({
      where: trimmed
        ? {
            OR: [
              { jobNumber: { contains: trimmed, mode: "insensitive" } },
              { projectName: { contains: trimmed, mode: "insensitive" } },
              { customerName: { contains: trimmed, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: [{ year: "desc" }, { sequenceNumber: "desc" }],
      take: 20,
      select: {
        id: true,
        jobNumber: true,
        projectName: true,
        customerName: true,
      },
    }),
  );
}
