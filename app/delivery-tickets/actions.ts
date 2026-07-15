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
import { getDefaultContactForRole } from "@/lib/customer-contacts";
import { allocateDeliveryTicketNumber } from "@/lib/delivery-ticket-number";
import {
  cancelDeliveredTicket,
  getQuoteLineFulfillmentAndScheduled,
  markDeliveryTicketDelivered,
  OPEN_TICKET_STATUSES,
} from "@/lib/delivery-fulfillment";
import { formatDrainRingStyleLabel } from "@/lib/drain-ring-utils";
import { deliveryTicketStatusFlow } from "@/components/delivery-tickets/delivery-ticket-utils";
import { generateSubmittalPackageForDeliveryTicket } from "@/lib/submittal-package";
import { maybeCreatePayNowInvoiceForTicket } from "@/lib/invoicing-service";
import { getDefaultPriceListId, getProductPricesForList } from "@/lib/price-list-service";
import {
  enrichProductWithDerivedAssemblyValues,
  isPartsModeCastingAssembly,
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
  categoryId: string;
  categoryName: string;
  categorySortOrder: number;
  subcategoryId: string | null;
  subcategoryName: string | null;
  subcategorySortOrder: number | null;
};

export type DeliveryTicketLineInput = {
  quoteLineItemId?: string | null;
  productId?: string | null;
  jobStructureId?: string | null;
  jobStructurePieceId?: string | null;
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

/**
 * A ticket may only be linked to a WON quote. The picker UI already filters to
 * won quotes; this is the server-side backstop, because a ticket against a
 * still-editable quote (DRAFT/IN_REVIEW) would have its quote-line references
 * silently severed by the next quote edit (line items are recreated with new
 * ids on save).
 */
async function assertQuoteLinkable(
  client: Prisma.TransactionClient,
  quoteId: string,
) {
  const quote = await client.quote.findUnique({
    where: { id: quoteId },
    select: { status: true, quoteNumber: true },
  });
  if (!quote) {
    throw new Error("The linked quote was not found.");
  }
  if (quote.status !== "WON") {
    throw new Error(
      `Delivery tickets can only be created from a won quote (${quote.quoteNumber} is ${quote.status}).`,
    );
  }
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
    const structurePiecesSeen = new Set<string>();

    for (const line of input.lines) {
      if (!line.quoteLineItemId) continue;
      const meta = byId.get(line.quoteLineItemId);
      if (!meta) {
        throw new Error(`Quote line ${line.itemCode} is not on this quote.`);
      }
      if (line.quantity <= 0) {
        throw new Error(`Quantity must be greater than zero for ${line.itemCode}.`);
      }

      if (meta.isSplitStructure) {
        if (!line.jobStructurePieceId) {
          throw new Error(
            `${meta.displayName} is split into pieces — pick individual pieces instead of the whole structure.`,
          );
        }
        if (line.quantity !== 1) {
          throw new Error(
            `Structure pieces ship one at a time (${meta.displayName}).`,
          );
        }
        const option = meta.structurePieceOptions.find(
          (piece) => piece.pieceId === line.jobStructurePieceId,
        );
        if (!option) {
          throw new Error(
            `${line.description || line.itemCode} is not a piece of ${meta.displayName}.`,
          );
        }
        if (structurePiecesSeen.has(option.pieceId)) {
          throw new Error(
            `${meta.displayName} — ${option.name} is on this load twice.`,
          );
        }
        structurePiecesSeen.add(option.pieceId);
        const claimedBy =
          option.deliveredTicketNumber ?? option.openTicketNumber;
        if (claimedBy) {
          throw new Error(
            `${meta.displayName} — ${option.name} is already on ${claimedBy}.`,
          );
        }
        if (meta.jobStructureStatus !== "MADE") {
          throw new Error(
            `${meta.displayName} is not made yet (${meta.jobStructureStatus ?? "no structure"}).`,
          );
        }
        continue;
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
      jobStructurePieceId: line.jobStructurePieceId ?? null,
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

/** Line creates plus the totals they imply — shared by full ticket writes and
 * the planner's lines-only draft updates. */
function buildLinesPayload(lines: DeliveryTicketLineInput[]) {
  const lineCreates = buildLineCreates(lines);
  const totalWeight = lineCreates.reduce((sum, line) => {
    if (!line.totalWeight) return sum;
    return sum.add(line.totalWeight);
  }, new Prisma.Decimal(0));

  return {
    lineCreates,
    totalItems: lines.length,
    totalWeight: totalWeight.gt(0) ? totalWeight : null,
  };
}

function ticketData(input: SaveDeliveryTicketInput) {
  const { lineCreates, totalItems, totalWeight } = buildLinesPayload(input.lines);

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
    totalWeight,
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
        if (input.ticketType === "JOB" && input.quoteId) {
          await assertQuoteLinkable(tx, input.quoteId);
        }
        await validateLines(tx, input);

        // New tickets with a known customer and no site contact default to
        // the customer's FIELD contact so the driver has someone to call.
        let effectiveInput = input;
        if (
          input.customerId &&
          !input.siteContactName?.trim() &&
          !input.siteContactPhone?.trim() &&
          !input.siteContactEmail?.trim()
        ) {
          const fieldContact = await getDefaultContactForRole(
            tx,
            input.customerId,
            "FIELD",
          );
          if (fieldContact) {
            effectiveInput = {
              ...input,
              siteContactName: fieldContact.contactName,
              siteContactPhone: fieldContact.contactPhone,
              siteContactEmail: fieldContact.contactEmail,
            };
          }
        }

        const numbering = await allocateDeliveryTicketNumber(tx);
        return tx.deliveryTicket.create({
          data: {
            ...ticketData({ ...effectiveInput, priceListId: defaultPriceListId }),
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

export type PlannedLoadInput = {
  // Existing DRAFT ticket to rewrite; omit/null for a brand-new load.
  ticketId?: string | null;
  // Required when ticketId is set: ISO updatedAt as loaded by the planner.
  expectedUpdatedAt?: string;
  lines: DeliveryTicketLineInput[];
};

export type SavePlannedLoadsInput = {
  jobId: string;
  quoteId: string;
  // Display order; loadSequence is renumbered "i of N" across this array.
  loads: PlannedLoadInput[];
  deletions: { ticketId: string; expectedUpdatedAt: string }[];
};

export type SavePlannedLoadsResult =
  | {
      success: true;
      ticketIds: string[];
      ticketNumbers: string[];
      createdCount: number;
      updatedCount: number;
      deletedCount: number;
    }
  | { error: string };

/**
 * Save the whole load plan at once: rewrite the lines of existing DRAFT
 * tickets, create tickets for new loads, delete removed drafts — all in one
 * transaction. The managed drafts' lines are wiped first, so validateLines
 * needs no exclusions: availability is "quoted − delivered − other open
 * tickets", exactly the baseline the planner displayed. Loads are then
 * validated sequentially — OPEN_TICKET_STATUSES includes DRAFT and the
 * interactive transaction reads its own writes, so each load's quota check
 * sees the loads written before it and the batch cannot jointly over-commit
 * the quote. Any failure rolls the whole plan back.
 *
 * Existing drafts keep their header, schedule, and note fields — only lines,
 * totals, and loadSequence are rewritten. Drafts outside the plan keep their
 * old loadSequence strings (cosmetic).
 */
export async function savePlannedLoads(
  input: SavePlannedLoadsInput,
): Promise<SavePlannedLoadsResult> {
  await requirePermission(AppPermission.DELIVERY_MANAGE);

  // New loads with nothing assigned are simply skipped; an existing ticket
  // with no lines must arrive as a deletion instead.
  const loads = input.loads.filter(
    (load) => load.ticketId || load.lines.length > 0,
  );
  const deletions = input.deletions;

  const managedIds = new Set<string>();
  for (const load of loads) {
    if (!load.ticketId) continue;
    if (load.lines.length === 0) {
      return {
        error:
          "An existing load has no items left — remove the load instead of leaving it empty.",
      };
    }
    if (managedIds.has(load.ticketId)) {
      return { error: "The plan lists the same ticket twice. Refresh the page." };
    }
    managedIds.add(load.ticketId);
  }
  for (const deletion of deletions) {
    if (managedIds.has(deletion.ticketId)) {
      return {
        error: "A ticket can't be both kept and deleted. Refresh the page.",
      };
    }
    managedIds.add(deletion.ticketId);
  }
  if (loads.length === 0 && deletions.length === 0) {
    return { error: "Nothing to save." };
  }

  try {
    const [job, quote, defaultPriceListId] = await Promise.all([
      withDatabaseRetry((client) =>
        client.job.findUnique({
          where: { id: input.jobId },
          select: {
            jobNumber: true,
            customerName: true,
            projectName: true,
            customerId: true,
          },
        }),
      ),
      withDatabaseRetry((client) =>
        client.quote.findUnique({
          where: { id: input.quoteId },
          select: { quoteNumber: true, jobId: true },
        }),
      ),
      getDefaultPriceListId(),
    ]);
    if (!job) {
      return { error: "Job not found." };
    }
    if (!quote || quote.jobId !== input.jobId) {
      return { error: "The selected quote does not belong to this job." };
    }

    const saved = await withDatabaseRetry(async (client) =>
      client.$transaction(
        async (tx) => {
          await assertQuoteLinkable(tx, input.quoteId);

          const managedRefs = [
            ...loads
              .filter((load) => load.ticketId)
              .map((load) => ({
                ticketId: load.ticketId!,
                expectedUpdatedAt: load.expectedUpdatedAt,
              })),
            ...deletions,
          ];

          if (managedRefs.length > 0) {
            const existing = await tx.deliveryTicket.findMany({
              where: { id: { in: managedRefs.map((ref) => ref.ticketId) } },
              select: {
                id: true,
                ticketNumber: true,
                status: true,
                jobId: true,
                quoteId: true,
                updatedAt: true,
              },
            });
            const byId = new Map(existing.map((ticket) => [ticket.id, ticket]));
            for (const ref of managedRefs) {
              const ticket = byId.get(ref.ticketId);
              if (
                !ticket ||
                ticket.jobId !== input.jobId ||
                ticket.quoteId !== input.quoteId
              ) {
                throw new Error(
                  "One of the planned tickets no longer belongs to this job. Refresh the page.",
                );
              }
              if (ticket.status !== "DRAFT") {
                throw new Error(
                  `${ticket.ticketNumber} is ${ticket.status.toLowerCase().replace(/_/g, " ")} — it changed while you were planning and can't be re-planned here. Refresh the page.`,
                );
              }
              const expected = ref.expectedUpdatedAt
                ? new Date(ref.expectedUpdatedAt)
                : null;
              if (
                !expected ||
                Number.isNaN(expected.getTime()) ||
                ticket.updatedAt.getTime() !== expected.getTime()
              ) {
                throw new Error(
                  `${ticket.ticketNumber} was changed by someone else while you were planning. Refresh the page to load the latest version, then re-apply your changes.`,
                );
              }
            }

            // Wipe every managed draft's lines before validating anything.
            await tx.deliveryTicketLineItem.deleteMany({
              where: {
                deliveryTicketId: { in: managedRefs.map((ref) => ref.ticketId) },
              },
            });
          }

          if (deletions.length > 0) {
            await tx.deliveryTicket.deleteMany({
              where: { id: { in: deletions.map((entry) => entry.ticketId) } },
            });
          }

          const tickets: { id: string; ticketNumber: string; created: boolean }[] =
            [];
          for (const [index, load] of loads.entries()) {
            const loadSequence = `${index + 1} of ${loads.length}`;
            const loadInput: SaveDeliveryTicketInput = {
              ticketType: "JOB",
              fulfillmentMethod: "DELIVERY",
              status: "DRAFT",
              jobId: input.jobId,
              quoteId: input.quoteId,
              customerId: job.customerId,
              priceListId: defaultPriceListId,
              jobNumber: job.jobNumber,
              quoteNumber: quote.quoteNumber,
              customerName: job.customerName,
              projectName: job.projectName,
              loadSequence,
              lines: load.lines,
            };
            await validateLines(tx, loadInput);

            if (load.ticketId) {
              const { lineCreates, totalItems, totalWeight } = buildLinesPayload(
                load.lines,
              );
              const ticket = await tx.deliveryTicket.update({
                where: { id: load.ticketId },
                data: {
                  loadSequence,
                  totalItems,
                  totalWeight,
                  lineItems: { create: lineCreates },
                },
                select: { id: true, ticketNumber: true },
              });
              tickets.push({ ...ticket, created: false });
            } else {
              const numbering = await allocateDeliveryTicketNumber(tx);
              const ticket = await tx.deliveryTicket.create({
                data: {
                  ...ticketData(loadInput),
                  ticketNumber: numbering.ticketNumber,
                  year: numbering.year,
                  yearTwoDigit: numbering.yearTwoDigit,
                  sequenceNumber: numbering.sequenceNumber,
                },
                select: { id: true, ticketNumber: true },
              });
              tickets.push({ ...ticket, created: true });
            }
          }
          return tickets;
        },
        // Each load re-runs the fulfillment rollup; give large plans headroom
        // beyond the 5s default.
        { timeout: 30_000 },
      ),
    );

    revalidatePath("/delivery-tickets");
    revalidatePath(`/jobs/${input.jobId}`);
    for (const ticketId of managedIds) {
      revalidatePath(`/delivery-tickets/${ticketId}`);
    }

    return {
      success: true,
      ticketIds: saved.map((ticket) => ticket.id),
      ticketNumbers: saved.map((ticket) => ticket.ticketNumber),
      createdCount: saved.filter((ticket) => ticket.created).length,
      updatedCount: saved.filter((ticket) => !ticket.created).length,
      deletedCount: deletions.length,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not save the load plan.",
    };
  }
}

export type ScheduleLoadUpdate = {
  ticketId: string;
  deliveryDate: string | null;
  deliveryTime: string | null;
  trailer: string | null;
  driver: string | null;
  // ISO updatedAt as loaded by the schedule page; stale saves are rejected.
  expectedUpdatedAt: string;
};

export type ScheduleJobLoadsResult =
  | { success: true; scheduledCount: number }
  | { error: string };

/**
 * Dispatch-side scheduling: updates only the schedule fields (date, time,
 * trailer and driver) of a job's open tickets, promoting DRAFT tickets to
 * SCHEDULED when they receive a date. Lines are untouched, so no quota
 * re-validation is needed — DRAFT quantities already count as committed
 * (see OPEN_TICKET_STATUSES). All-or-nothing across the batch.
 */
export async function scheduleJobLoads(
  jobId: string,
  updates: ScheduleLoadUpdate[],
): Promise<ScheduleJobLoadsResult> {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  if (updates.length === 0) {
    return { error: "Nothing to save." };
  }

  const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

  try {
    const scheduledCount = await withDatabaseRetry(async (client) =>
      client.$transaction(async (tx) => {
        let scheduled = 0;
        for (const update of updates) {
          const ticket = await tx.deliveryTicket.findUnique({
            where: { id: update.ticketId },
            select: {
              ticketNumber: true,
              jobId: true,
              status: true,
              updatedAt: true,
            },
          });
          if (!ticket || ticket.jobId !== jobId) {
            throw new Error("One of the tickets no longer belongs to this job. Refresh the page.");
          }
          if (ticket.status !== "DRAFT" && ticket.status !== "SCHEDULED") {
            throw new Error(
              `${ticket.ticketNumber} is ${ticket.status.toLowerCase().replace(/_/g, " ")} and can't be rescheduled here.`,
            );
          }

          const expected = new Date(update.expectedUpdatedAt);
          if (
            Number.isNaN(expected.getTime()) ||
            ticket.updatedAt.getTime() !== expected.getTime()
          ) {
            throw new Error(
              `${ticket.ticketNumber} was changed by someone else while you were editing. Refresh the page to load the latest version, then re-apply your changes.`,
            );
          }

          const deliveryDate = parseDate(update.deliveryDate);
          if (update.deliveryDate?.trim() && !deliveryDate) {
            throw new Error(`Invalid delivery date for ${ticket.ticketNumber}.`);
          }
          if (ticket.status === "SCHEDULED" && !deliveryDate) {
            throw new Error(
              `${ticket.ticketNumber} is already scheduled — it needs a delivery date. Cancel the ticket instead if the load is off.`,
            );
          }
          const deliveryTime = update.deliveryTime?.trim() || null;
          if (deliveryTime && !TIME_PATTERN.test(deliveryTime)) {
            throw new Error(`Invalid delivery time for ${ticket.ticketNumber} (use HH:MM).`);
          }

          const status = deliveryDate ? "SCHEDULED" : ticket.status;
          if (ticket.status === "DRAFT" && status === "SCHEDULED") {
            scheduled += 1;
          }

          await tx.deliveryTicket.update({
            where: { id: update.ticketId },
            data: {
              deliveryDate,
              deliveryTime,
              trailer: update.trailer?.trim() || null,
              driver: update.driver?.trim() || null,
              status,
            },
          });
        }
        return scheduled;
      }),
    );

    revalidatePath("/delivery-tickets");
    revalidatePath(`/jobs/${jobId}`);
    for (const update of updates) {
      revalidatePath(`/delivery-tickets/${update.ticketId}`);
    }
    return { success: true, scheduledCount };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save the schedule.",
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
          select: { status: true, updatedAt: true, quoteId: true },
        });
        if (!existing) throw new Error("Delivery ticket not found.");
        if (existing.status === "DELIVERED") {
          throw new Error("Delivered tickets cannot be edited.");
        }

        // Only re-check the quote when the link changes: a ticket's existing
        // quote may legitimately have moved WON → REVISED since creation.
        if (
          input.ticketType === "JOB" &&
          input.quoteId &&
          input.quoteId !== existing.quoteId
        ) {
          await assertQuoteLinkable(tx, input.quoteId);
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
        categoryId: true,
        subcategoryId: true,
        productCategory: { select: { name: true, sortOrder: true } },
        subcategory: { select: { name: true, sortOrder: true } },
      },
    }),
  );

  const priceMap = resolvedPriceListId
    ? await getProductPricesForList(
        products.map((product) => product.id),
        resolvedPriceListId,
      )
    : new Map();

  const partsAssemblyIds = products
    .filter((product) => isPartsModeCastingAssembly(product))
    .map((product) => product.id);
  const derivedMap = partsAssemblyIds.length
    ? await withDatabaseRetry((client) =>
        loadDerivedAssemblyValues(client, partsAssemblyIds),
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
      categoryId: product.categoryId,
      categoryName: product.productCategory.name,
      categorySortOrder: product.productCategory.sortOrder,
      subcategoryId: product.subcategoryId,
      subcategoryName: product.subcategory?.name ?? null,
      subcategorySortOrder: product.subcategory?.sortOrder ?? null,
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

    const allowed = deliveryTicketStatusFlow[ticket.status] ?? [];
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

export type UpdateTicketDriverResult =
  | { success: true }
  | { error: string };

/**
 * Dispatch quick-assign: change only the driver on an open ticket, e.g. from
 * the Today's Loads panel. Full rescheduling stays in scheduleJobLoads.
 */
export async function updateTicketDriver(
  ticketId: string,
  driver: string | null,
): Promise<UpdateTicketDriverResult> {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  try {
    const ticket = await withDatabaseRetry((client) =>
      client.deliveryTicket.findUnique({
        where: { id: ticketId },
        select: { status: true, ticketNumber: true },
      }),
    );
    if (!ticket) {
      return { error: "Ticket not found. Refresh the page." };
    }
    if (ticket.status === "DELIVERED" || ticket.status === "CANCELLED") {
      return {
        error: `${ticket.ticketNumber} is ${ticket.status.toLowerCase()} and can't be reassigned.`,
      };
    }

    await withDatabaseRetry((client) =>
      client.deliveryTicket.update({
        where: { id: ticketId },
        data: { driver: driver?.trim() || null },
      }),
    );

    revalidatePath("/delivery-tickets");
    revalidatePath(`/delivery-tickets/${ticketId}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not update the driver.",
    };
  }
}

/**
 * Dispatch quick-assign: change only the trailer on an open ticket, e.g. from
 * the Today's Loads panel. Full rescheduling stays in scheduleJobLoads.
 */
export async function updateTicketTrailer(
  ticketId: string,
  trailer: string | null,
): Promise<UpdateTicketDriverResult> {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  try {
    const ticket = await withDatabaseRetry((client) =>
      client.deliveryTicket.findUnique({
        where: { id: ticketId },
        select: { status: true, ticketNumber: true },
      }),
    );
    if (!ticket) {
      return { error: "Ticket not found. Refresh the page." };
    }
    if (ticket.status === "DELIVERED" || ticket.status === "CANCELLED") {
      return {
        error: `${ticket.ticketNumber} is ${ticket.status.toLowerCase()} and can't be reassigned.`,
      };
    }

    await withDatabaseRetry((client) =>
      client.deliveryTicket.update({
        where: { id: ticketId },
        data: { trailer: trailer?.trim() || null },
      }),
    );

    revalidatePath("/delivery-tickets");
    revalidatePath(`/delivery-tickets/${ticketId}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not update the trailer.",
    };
  }
}

export type SplitStructureResult = { success: true } | { error: string };

/**
 * Define (or redefine) the named shipping pieces of a structure. Allowed any
 * time before pieces land on tickets; redefining wipes and recreates them.
 */
export async function splitStructureForShipping(
  jobStructureId: string,
  pieces: { name: string; weightLbs: number | null }[],
): Promise<SplitStructureResult> {
  await requirePermission(AppPermission.DELIVERY_MANAGE);

  const cleaned = pieces.map((piece) => ({
    name: piece.name.trim(),
    weightLbs:
      piece.weightLbs != null &&
      Number.isFinite(piece.weightLbs) &&
      piece.weightLbs > 0
        ? piece.weightLbs
        : null,
  }));
  if (cleaned.length < 2) {
    return { error: "Split into at least two pieces." };
  }
  if (cleaned.some((piece) => !piece.name)) {
    return { error: "Every piece needs a name." };
  }

  try {
    await withDatabaseRetry((client) =>
      client.$transaction(async (tx) => {
        const structure = await tx.jobStructure.findUnique({
          where: { id: jobStructureId },
          select: {
            id: true,
            status: true,
            pieces: {
              select: {
                id: true,
                deliveryTicketLineItems: { select: { id: true }, take: 1 },
              },
            },
          },
        });
        if (!structure) {
          throw new Error("Structure not found.");
        }
        if (structure.status === "SHIPPED") {
          throw new Error("This structure has already shipped.");
        }
        if (
          structure.pieces.some(
            (piece) => piece.deliveryTicketLineItems.length > 0,
          )
        ) {
          throw new Error(
            "Pieces of this structure are already on delivery tickets — remove them from those tickets before re-splitting.",
          );
        }
        await tx.jobStructurePiece.deleteMany({ where: { jobStructureId } });
        await tx.jobStructurePiece.createMany({
          data: cleaned.map((piece, index) => ({
            jobStructureId,
            name: piece.name,
            weightLbs: piece.weightLbs,
            sortOrder: index,
          })),
        });
      }),
    );
    revalidatePath("/delivery-tickets");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not split the structure.",
    };
  }
}

/** Remove an unused split so the structure ships whole again. */
export async function unsplitStructure(
  jobStructureId: string,
): Promise<SplitStructureResult> {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  try {
    await withDatabaseRetry((client) =>
      client.$transaction(async (tx) => {
        const used = await tx.deliveryTicketLineItem.count({
          where: { jobStructurePiece: { jobStructureId } },
        });
        if (used > 0) {
          throw new Error(
            "Pieces of this structure are already on delivery tickets — remove them from those tickets first.",
          );
        }
        await tx.jobStructurePiece.deleteMany({ where: { jobStructureId } });
      }),
    );
    revalidatePath("/delivery-tickets");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not remove the split.",
    };
  }
}

export type WalkInCustomerOption = {
  id: string;
  name: string;
};

export async function searchCustomersForWalkInTicket(
  query: string,
): Promise<WalkInCustomerOption[]> {
  await requirePermission(AppPermission.DELIVERY_VIEW);

  const trimmed = query.trim();
  return withDatabaseRetry((client) =>
    client.customer.findMany({
      where: trimmed
        ? { name: { contains: trimmed, mode: "insensitive" } }
        : {},
      orderBy: { name: "asc" },
      take: 20,
      select: { id: true, name: true },
    }),
  );
}

export type DeliveryTicketJobSearchOption = {
  id: string;
  jobNumber: string;
  projectName: string;
  customerName: string;
  quotes: { id: string; quoteNumber: string }[];
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
        quotes: {
          where: { status: "WON" },
          orderBy: { revisionNumber: "desc" },
          select: { id: true, quoteNumber: true },
        },
      },
    }),
  );
}
