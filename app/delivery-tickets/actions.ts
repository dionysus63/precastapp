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
  getQuoteLineFulfillment,
  markDeliveryTicketDelivered,
} from "@/lib/delivery-fulfillment";
import { formatDrainRingStyleLabel } from "@/lib/drain-ring-utils";
import { generateSubmittalPackageForDeliveryTicket } from "@/lib/submittal-package";
import { maybeCreatePayNowInvoiceForTicket } from "@/lib/invoicing-service";
import { prisma, withDatabaseRetry } from "@/lib/prisma";

export type TicketProductOption = {
  id: string;
  productCode: string;
  name: string;
  unit: string;
  weight: number | null;
  defaultPrice: number | null;
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
    const fulfillment = await getQuoteLineFulfillment(
      client,
      input.quoteId,
      excludeTicketId,
    );
    const byId = new Map(fulfillment.map((line) => [line.quoteLineItemId, line]));
    const drainRingFeetByLine = new Map<string, number>();
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

      if (meta.isCastingAssembly) {
        if (!line.productId) continue;
        const pieces = castingPiecesByAssembly.get(line.quoteLineItemId) ?? new Map<string, number>();
        pieces.set(line.productId, (pieces.get(line.productId) ?? 0) + line.quantity);
        castingPiecesByAssembly.set(line.quoteLineItemId, pieces);
        continue;
      }

      if (line.quantity > meta.remainingQty) {
        throw new Error(
          `Quantity for ${line.itemCode} exceeds remaining (${meta.remainingQty}).`,
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
      if (meta && feet > meta.remainingQty + 0.001) {
        const over = Math.round((feet - meta.remainingQty) * 100) / 100;
        throw new Error(
          `${meta.displayName} exceeds remaining (${meta.remainingQty} LF) by ${over} LF.`,
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
      if (setsUsed > meta.remainingQty) {
        throw new Error(
          `${meta.displayName}: sets on this load (${setsUsed}) exceed remaining (${meta.remainingQty}).`,
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
    const ticket = await withDatabaseRetry(async (client) =>
      client.$transaction(async (tx) => {
        await validateLines(tx, input);
        const numbering = await allocateDeliveryTicketNumber(tx);
        return tx.deliveryTicket.create({
          data: {
            ...ticketData(input),
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
          select: { status: true },
        });
        if (!existing) throw new Error("Delivery ticket not found.");
        if (existing.status === "DELIVERED") {
          throw new Error("Delivered tickets cannot be edited.");
        }

        await validateLines(tx, input, ticketId);
        await tx.deliveryTicketLineItem.deleteMany({ where: { deliveryTicketId: ticketId } });

        const data = ticketData(input);
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

export async function listStockProductsForTicket(): Promise<
  TicketProductOption[]
> {
  await requirePermission(AppPermission.DELIVERY_VIEW);
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
        defaultPrice: true,
        currentStockQuantity: true,
        trackInventory: true,
      },
    }),
  );

  return products.map((product) => ({
    id: product.id,
    productCode: product.productCode,
    name: product.name,
    unit: product.unit,
    weight: product.weight != null ? Number(product.weight) : null,
    defaultPrice: product.defaultPrice != null ? Number(product.defaultPrice) : null,
    currentStock: product.trackInventory ? product.currentStockQuantity : null,
    trackInventory: product.trackInventory,
  }));
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

