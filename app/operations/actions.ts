"use server";

import { revalidatePath } from "next/cache";
import { AppPermission, type PrismaClient } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { withDatabaseRetry } from "@/lib/prisma";
import { PHYSICAL_PRODUCT_TYPES } from "@/lib/product-types";
import {
  isDuplicateSubmission,
  saveDailyProductionEntry,
} from "@/lib/inventory-service";
import {
  approveJobStructureForProduction,
  linkJobStructuresFromQuote,
  markJobStructureMade,
  setJobStructureStatus,
  startJobStructureProduction,
  submitJobStructureForApproval,
} from "@/lib/job-structure-workflow";
import {
  markDeliveryTicketDelivered,
} from "@/lib/delivery-fulfillment";
import {
  batchConvertDeliveredTicketsToInvoices,
  convertDeliveryTicketToInvoice,
  InvoiceAlreadyExistsError,
  maybeCreatePayNowInvoiceForTicket,
} from "@/lib/invoicing-service";
import { hasPermission } from "@/lib/auth/permissions";

function parseReconciliationDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

async function revalidateStructurePaths(
  client: PrismaClient,
  jobStructureId: string,
) {
  const structure = await client.jobStructure.findUnique({
    where: { id: jobStructureId },
    select: { jobId: true },
  });

  revalidatePath("/production");
  if (structure?.jobId) {
    revalidatePath(`/jobs/${structure.jobId}`);
    revalidatePath(`/jobs/${structure.jobId}/structures/${jobStructureId}`);
  }
}

export async function linkStructuresForWonQuote(quoteId: string) {
  await requirePermission(AppPermission.PRODUCTION_MANAGE);
  return withDatabaseRetry(async (client) => {
    const count = await linkJobStructuresFromQuote(client, quoteId);
    revalidatePath("/production");
    revalidatePath(`/quotes/${quoteId}`);
    return { count };
  });
}

/**
 * Detailing flow: after the drill-sheet packet is sent to the contractor,
 * mark every still-NOT_SUBMITTED structure with a sheet on the job as
 * submitted in one click. Structures that require an uploaded job-specific
 * submittal and have none are skipped and reported, not failed.
 */
export async function markAllJobStructuresSubmitted(jobId: string) {
  await requirePermission(AppPermission.PRODUCTION_MANAGE);
  try {
    let submitted = 0;
    const skipped: string[] = [];
    await withDatabaseRetry(async (client) => {
      const structures = await client.jobStructure.findMany({
        where: { jobId, status: "NOT_SUBMITTED", calc: { isNot: null } },
        select: { id: true, structureNumber: true },
        orderBy: { createdAt: "asc" },
      });
      for (const structure of structures) {
        try {
          await submitJobStructureForApproval(client, structure.id);
          submitted += 1;
        } catch (error) {
          skipped.push(
            `${structure.structureNumber ?? "Structure"}: ${
              error instanceof Error ? error.message : "could not submit."
            }`,
          );
        }
      }
      revalidatePath("/production");
      revalidatePath(`/jobs/${jobId}`);
    });
    return { success: true as const, submitted, skipped };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not mark the structures as submitted.",
    };
  }
}

export async function submitStructureForApproval(jobStructureId: string) {
  await requirePermission(AppPermission.PRODUCTION_MANAGE);
  try {
    await withDatabaseRetry(async (client) => {
      await submitJobStructureForApproval(client, jobStructureId);
      await revalidateStructurePaths(client, jobStructureId);
    });
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not submit structure.",
    };
  }
}

export async function approveStructureForProduction(formData: FormData) {
  await requirePermission(AppPermission.PRODUCTION_MANAGE);
  const jobStructureId = String(formData.get("jobStructureId") ?? "").trim();
  const useGeneratedSubmittal =
    formData.get("useGeneratedSubmittal") === "true";
  const approvalFile = formData.get("approvalFile");

  if (!jobStructureId) {
    return { error: "Structure is required." };
  }

  try {
    await withDatabaseRetry(async (client) => {
      await approveJobStructureForProduction(client, jobStructureId, {
        useGeneratedSubmittal,
        approvalFile:
          approvalFile instanceof File && approvalFile.size > 0
            ? approvalFile
            : undefined,
      });
      await revalidateStructurePaths(client, jobStructureId);
    });
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not approve structure.",
    };
  }
}

/**
 * Bulk attach board: upload one job-specific submittal file for a structure.
 * Unlike the jobs-page upload action this returns errors instead of throwing,
 * so one bad tile doesn't blow up a whole drag-and-drop batch.
 *
 * With markSubmitted, a still-NOT_SUBMITTED structure is also marked as
 * submitted — the queue steps ("needs submittal" → "awaiting approval") are
 * status-driven, and the bulk board exists so nobody has to open every
 * structure just to click "Mark as submitted" after uploading.
 */
export async function uploadStructureSubmittalFile(formData: FormData) {
  await requirePermission(AppPermission.PRODUCTION_MANAGE);
  const jobStructureId = String(formData.get("jobStructureId") ?? "").trim();
  const markSubmitted = formData.get("markSubmitted") === "true";
  const file = formData.get("file");

  if (!jobStructureId) {
    return { error: "Structure is required." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }

  try {
    let submitted = false;
    await withDatabaseRetry(async (client) => {
      const { uploadJobStructureDocument } = await import(
        "@/lib/job-structure-documents-service"
      );
      await uploadJobStructureDocument(
        client,
        jobStructureId,
        "JOB_SPECIFIC_SUBMITTAL",
        file,
      );
      if (markSubmitted) {
        const structure = await client.jobStructure.findUnique({
          where: { id: jobStructureId },
          select: { status: true },
        });
        if (structure?.status === "NOT_SUBMITTED") {
          await submitJobStructureForApproval(client, jobStructureId);
          submitted = true;
        }
      }
      await revalidateStructurePaths(client, jobStructureId);
    });
    return { success: true, submitted };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not upload the file.",
    };
  }
}

export async function startStructureProduction(jobStructureId: string) {
  await requirePermission(AppPermission.PRODUCTION_MANAGE);
  try {
    await withDatabaseRetry(async (client) => {
      await startJobStructureProduction(client, jobStructureId);
      await revalidateStructurePaths(client, jobStructureId);
    });
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not start production.",
    };
  }
}

export async function markStructureMade(jobStructureId: string) {
  await requirePermission(AppPermission.PRODUCTION_MANAGE);
  try {
    await withDatabaseRetry(async (client) => {
      await markJobStructureMade(client, jobStructureId);
      await revalidateStructurePaths(client, jobStructureId);
    });
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not mark structure made.",
    };
  }
}

export async function saveProductionEntry(formData: FormData) {
  await requirePermission(AppPermission.PRODUCTION_MANAGE);
  const productionDateRaw = String(formData.get("productionDate") ?? "").trim();
  if (!productionDateRaw) {
    return { error: "Production date is required." };
  }

  const productionDate = new Date(productionDateRaw);
  if (Number.isNaN(productionDate.getTime())) {
    return { error: "Invalid production date." };
  }

  const enteredBy = String(formData.get("enteredBy") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const submissionKey =
    String(formData.get("submissionKey") ?? "").trim() || null;

  const productIds = formData.getAll("productId").map(String);
  const quantities = formData.getAll("quantityProduced").map(String);

  const lines: { productId: string; quantityProduced: number }[] = [];
  for (let index = 0; index < productIds.length; index += 1) {
    const productId = productIds[index]?.trim();
    const qtyRaw = String(quantities[index] ?? "").trim();
    if (!productId || !qtyRaw) {
      // Blank rows are allowed; skip them.
      continue;
    }
    const qty = Number(qtyRaw);
    if (!Number.isFinite(qty) || qty <= 0) {
      // Reject instead of silently dropping the line.
      return {
        error: `Line ${index + 1}: quantity produced must be a positive number.`,
      };
    }
    if (!Number.isInteger(qty)) {
      return {
        error: `Line ${index + 1}: quantity produced must be a whole number.`,
      };
    }
    lines.push({ productId, quantityProduced: qty });
  }

  try {
    await withDatabaseRetry((client) =>
      saveDailyProductionEntry(client, {
        productionDate,
        enteredBy,
        notes,
        submissionKey,
        lines,
      }),
    );
    revalidatePath("/inventory");
    revalidatePath("/inventory/production");
    return { success: true };
  } catch (error) {
    // The same submission already landed (double-click / retry) — success.
    if (isDuplicateSubmission(error)) {
      revalidatePath("/inventory");
      revalidatePath("/inventory/production");
      return { success: true };
    }
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not save production entry.",
    };
  }
}

const BULK_STRUCTURE_STATUSES = [
  "SUBMITTED",
  "APPROVED",
  "IN_PRODUCTION",
  "MADE",
] as const;

export type BulkStructureStatus = (typeof BULK_STRUCTURE_STATUSES)[number];

/**
 * Bulk status change from the job production tab. Deliberately skips the
 * per-structure submittal/approval gates — those exist for the
 * contractor-approval flow, and self-directed jobs (bulk-created sound wall
 * panels etc.) don't have one. The confirm dialog in the UI states this.
 */
export async function bulkSetJobStructureStatuses(
  jobId: string,
  structureIds: string[],
  status: BulkStructureStatus,
  setJobActive: boolean,
) {
  await requirePermission(AppPermission.PRODUCTION_MANAGE);
  if (structureIds.length === 0) {
    return { error: "Select at least one structure." };
  }
  if (!BULK_STRUCTURE_STATUSES.includes(status)) {
    return { error: "Invalid status." };
  }
  try {
    let updated = 0;
    await withDatabaseRetry(async (client) => {
      const structures = await client.jobStructure.findMany({
        where: { id: { in: structureIds }, jobId },
        select: { id: true, status: true },
      });
      if (structures.length !== structureIds.length) {
        throw new Error("Some selected structures are no longer on this job.");
      }
      for (const structure of structures) {
        if (structure.status === status) continue;
        await setJobStructureStatus(client, structure.id, status);
        updated += 1;
      }
      if (setJobActive) {
        await client.job.updateMany({
          where: {
            id: jobId,
            status: { in: ["QUOTING", "DETAILING", "AWARDED"] },
          },
          data: { status: "ACTIVE" },
        });
      }
      revalidatePath("/production");
      revalidatePath(`/jobs/${jobId}`);
    });
    return { success: true as const, updated };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not update the selected structures.",
    };
  }
}

export type DailyProductionSaveInput = {
  /** yyyy-mm-dd */
  productionDate: string;
  enteredBy?: string | null;
  notes?: string | null;
  submissionKey: string;
  stockLines: { productId: string; quantityProduced: number }[];
  structureLines: {
    jobStructureId: string;
    jobStructurePieceId?: string | null;
    quantityMade: number;
  }[];
};

/** Save one person's Daily Production entry (structures + stock together). */
export async function saveDailyProductionDay(input: DailyProductionSaveInput) {
  await requirePermission(AppPermission.PRODUCTION_MANAGE);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.productionDate)) {
    return { error: "Production date is required." };
  }
  const productionDate = new Date(input.productionDate);
  if (Number.isNaN(productionDate.getTime())) {
    return { error: "Invalid production date." };
  }
  if (input.stockLines.length === 0 && input.structureLines.length === 0) {
    return { error: "Enter at least one made quantity or piece." };
  }
  for (const line of input.stockLines) {
    if (!Number.isInteger(line.quantityProduced) || line.quantityProduced <= 0) {
      return { error: "Stock quantities must be positive whole numbers." };
    }
  }
  for (const line of input.structureLines) {
    if (
      !line.jobStructurePieceId &&
      (!Number.isFinite(line.quantityMade) || line.quantityMade <= 0)
    ) {
      return { error: "Structure quantities must be positive numbers." };
    }
  }

  try {
    await withDatabaseRetry((client) =>
      saveDailyProductionEntry(client, {
        productionDate,
        enteredBy: input.enteredBy ?? null,
        notes: input.notes ?? null,
        submissionKey: input.submissionKey,
        lines: input.stockLines,
        structureLines: input.structureLines,
      }),
    );
  } catch (error) {
    // The same submission already landed (double-click / retry) — success.
    if (!isDuplicateSubmission(error)) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Could not save the production entry.",
      };
    }
  }
  revalidatePath("/production/daily");
  revalidatePath("/production");
  revalidatePath("/inventory");
  return { success: true as const };
}

export async function deliverTicket(deliveryTicketId: string) {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  try {
    await withDatabaseRetry((client) =>
      markDeliveryTicketDelivered(client, deliveryTicketId),
    );
    const invoiceResult = await withDatabaseRetry((client) =>
      maybeCreatePayNowInvoiceForTicket(client, deliveryTicketId),
    );
    revalidatePath("/delivery-tickets");
    revalidatePath(`/delivery-tickets/${deliveryTicketId}`);
    revalidatePath("/walk-ins");
    revalidatePath("/inventory");
    if (invoiceResult.invoiceId) {
      revalidatePath("/invoices");
    }
    return {
      success: true,
      warning: invoiceResult.error
        ? `Ticket completed, but the pay-now invoice could not be created: ${invoiceResult.error}`
        : null,
    };
  } catch (error) {
    // The DB blocks negative stock; translate the raw constraint failure for
    // the front desk instead of leaking SQL wording.
    if (
      error instanceof Error &&
      error.message.includes("Product_currentStockQuantity_nonneg")
    ) {
      return {
        error:
          "Not enough stock on hand to complete this ticket. Adjust inventory or the line quantities first.",
      };
    }
    return {
      error:
        error instanceof Error ? error.message : "Could not mark delivered.",
    };
  }
}

export async function convertTicketToInvoice(deliveryTicketId: string) {
  // Creating an invoice is a billing operation, not a dispatch one. (The
  // automatic pay-now invoice on deliverTicket stays under DELIVERY_MANAGE
  // because it is a system side effect of completing the delivery.)
  await requirePermission(AppPermission.INVOICES_MANAGE);
  try {
    const invoiceId = await withDatabaseRetry((client) =>
      convertDeliveryTicketToInvoice(client, deliveryTicketId),
    );
    revalidatePath(`/delivery-tickets/${deliveryTicketId}`);
    revalidatePath("/invoices");
    return { invoiceId };
  } catch (error) {
    // A concurrent conversion already invoiced the ticket — treat as success
    // and hand back the existing invoice instead of a confusing error.
    if (error instanceof InvoiceAlreadyExistsError && error.invoiceId) {
      revalidatePath(`/delivery-tickets/${deliveryTicketId}`);
      revalidatePath("/invoices");
      return { invoiceId: error.invoiceId };
    }
    return {
      error:
        error instanceof Error ? error.message : "Could not create invoice.",
    };
  }
}

/**
 * Reconcile helper: mark every still-open ticket on a day as delivered in one
 * click. The dispatcher won't reliably mark loads delivered in the app, so
 * the bookkeeper counts paper tickets against the screen and closes the day.
 */
export type DeliverAllTicketsResult =
  | { error: string }
  | {
      success: true;
      delivered: number;
      failed: { ticketNumber: string; error: string }[];
      warnings: string[];
    };

export async function deliverAllTicketsForDay(
  dateRaw: string,
): Promise<DeliverAllTicketsResult> {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  const reconciliationDate = parseReconciliationDate(dateRaw);
  if (!reconciliationDate) {
    return { error: "Invalid date." };
  }

  const start = reconciliationDate;
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const openTickets = await withDatabaseRetry((client) =>
    client.deliveryTicket.findMany({
      where: {
        deliveryDate: { gte: start, lte: end },
        status: { notIn: ["DELIVERED", "CANCELLED"] },
      },
      orderBy: { ticketNumber: "asc" },
      select: { id: true, ticketNumber: true },
    }),
  );

  let delivered = 0;
  const failed: { ticketNumber: string; error: string }[] = [];
  const warnings: string[] = [];

  for (const ticket of openTickets) {
    // Same path as the single-ticket "Mark delivered" button, one at a time so
    // one bad ticket (e.g. negative stock) doesn't block the rest of the day.
    const result = await deliverTicket(ticket.id);
    if ("error" in result && result.error) {
      failed.push({ ticketNumber: ticket.ticketNumber, error: result.error });
      continue;
    }
    delivered += 1;
    if ("warning" in result && result.warning) {
      warnings.push(`${ticket.ticketNumber}: ${result.warning}`);
    }
  }

  revalidatePath("/delivery-tickets/reconcile");
  revalidatePath("/delivery-tickets");
  revalidatePath("/invoices");
  return { success: true as const, delivered, failed, warnings };
}

export async function confirmDeliveryDayReconciliation(dateRaw: string) {
  const user = await requirePermission(AppPermission.DELIVERY_MANAGE);

  const reconciliationDate = parseReconciliationDate(dateRaw);
  if (!reconciliationDate) {
    return { error: "Invalid date." };
  }

  const start = reconciliationDate;
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const conversionResult = await withDatabaseRetry(async (client) => {
    // Confirmation is stamped with the signed-in user; the old free-text
    // confirmed-by/notes inputs are gone.
    await client.deliveryDayReconciliation.upsert({
      where: { reconciliationDate: start },
      create: {
        reconciliationDate: start,
        confirmedBy: user.displayName,
        confirmedAt: new Date(),
      },
      update: {
        confirmedBy: user.displayName,
        confirmedAt: new Date(),
      },
    });

    if (await hasPermission(user, AppPermission.INVOICES_MANAGE)) {
      const [scheduledTickets, deliveredOtherDayTickets] = await Promise.all([
        client.deliveryTicket.findMany({
          where: { deliveryDate: { gte: start, lte: end } },
          select: {
            id: true,
            status: true,
            invoice: { select: { id: true } },
          },
        }),
        client.deliveryTicket.findMany({
          where: {
            status: "DELIVERED",
            deliveredAt: { gte: start, lte: end },
            OR: [
              { deliveryDate: { lt: start } },
              { deliveryDate: { gt: end } },
              { deliveryDate: null },
            ],
          },
          select: {
            id: true,
            status: true,
            invoice: { select: { id: true } },
          },
        }),
      ]);

      const ticketIds = collectDeliveredUninvoicedTicketIds(
        scheduledTickets.map((ticket) => ({
          id: ticket.id,
          status: ticket.status,
          hasInvoice: Boolean(ticket.invoice),
        })),
        deliveredOtherDayTickets.map((ticket) => ({
          id: ticket.id,
          status: ticket.status,
          hasInvoice: Boolean(ticket.invoice),
        })),
      );

      return batchConvertDeliveredTicketsToInvoices(client, ticketIds);
    }

    return null;
  });

  revalidatePath("/delivery-tickets/reconcile");
  revalidatePath("/invoices");
  return {
    success: true as const,
    conversionResult,
    invoicesCreated: conversionResult?.created ?? 0,
  };
}

export async function getQuoteFulfillmentForTicket(
  quoteId: string,
  excludeTicketId?: string,
) {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  const { getQuoteLineFulfillment } = await import("@/lib/delivery-fulfillment");
  return withDatabaseRetry((client) =>
    getQuoteLineFulfillment(client, quoteId, excludeTicketId),
  );
}

/**
 * Fulfillment plus quantities sitting on OTHER open (not yet delivered)
 * tickets, so the editor can flag scheduled-but-not-shipped items. Uses
 * OPEN_TICKET_STATUSES to match what validateLines enforces on save.
 */
export async function getQuoteFulfillmentWithOpenLoads(
  quoteId: string,
  excludeTicketId?: string,
): Promise<{
  fulfillment: Awaited<ReturnType<typeof getQuoteFulfillmentForTicket>>;
  onOpenLoads: Record<string, number>;
}> {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  const { getQuoteLineFulfillmentAndScheduled, OPEN_TICKET_STATUSES } =
    await import("@/lib/delivery-fulfillment");
  const { fulfillment, scheduled } = await withDatabaseRetry((client) =>
    getQuoteLineFulfillmentAndScheduled(
      client,
      quoteId,
      excludeTicketId,
      OPEN_TICKET_STATUSES,
    ),
  );
  return { fulfillment, onOpenLoads: Object.fromEntries(scheduled) };
}

export async function listProductionQueue() {
  await requirePermission(AppPermission.PRODUCTION_VIEW);
  return withDatabaseRetry((client) =>
    client.jobStructure.findMany({
      where: { status: { in: ["APPROVED", "IN_PRODUCTION"] } },
      orderBy: [{ productionDate: "asc" }, { createdAt: "asc" }],
      // Working queue, not an archive: cap so stale rows can't grow it forever.
      take: 200,
      include: {
        job: { select: { jobNumber: true, projectName: true } },
        quote: { select: { quoteNumber: true } },
        product: { select: { productCode: true, name: true } },
      },
    }),
  );
}

export async function listInventoryProducts() {
  await requirePermission(AppPermission.INVENTORY_VIEW);
  return withDatabaseRetry((client) =>
    client.product.findMany({
      where: { trackInventory: true, status: "ACTIVE" },
      orderBy: { productCode: "asc" },
      select: {
        id: true,
        productCode: true,
        name: true,
        currentStockQuantity: true,
        reorderLevel: true,
        yardLocation: true,
        unit: true,
      },
    }),
  );
}

export async function listStockProductsForProduction() {
  await requirePermission(AppPermission.PRODUCTION_VIEW);
  return withDatabaseRetry((client) =>
    client.product.findMany({
      where: {
        trackInventory: true,
        status: "ACTIVE",
        productType: { in: [...PHYSICAL_PRODUCT_TYPES] },
      },
      orderBy: { productCode: "asc" },
      select: { id: true, productCode: true, name: true, unit: true },
    }),
  );
}

const RECONCILE_TICKET_SELECT = {
  id: true,
  ticketNumber: true,
  customerName: true,
  projectName: true,
  status: true,
  deliveryDate: true,
  deliveredAt: true,
  ticketType: true,
  paymentMethod: true,
  paymentReceived: true,
  paperTicketPrinted: true,
  invoice: { select: { id: true } },
} as const;

function mapReconcileTicket(
  ticket: {
    id: string;
    ticketNumber: string;
    customerName: string;
    projectName: string;
    status: string;
    deliveryDate: Date | null;
    deliveredAt: Date | null;
    ticketType: string;
    paymentMethod: string | null;
    paymentReceived: boolean;
    paperTicketPrinted: boolean;
    invoice: { id: string } | null;
  },
) {
  return {
    ...ticket,
    hasInvoice: Boolean(ticket.invoice),
  };
}

function collectDeliveredUninvoicedTicketIds(
  scheduledTickets: Array<{ id: string; status: string; hasInvoice: boolean }>,
  deliveredOtherDayTickets: Array<{ id: string; status: string; hasInvoice: boolean }>,
): string[] {
  const ids = new Set<string>();
  for (const ticket of [...scheduledTickets, ...deliveredOtherDayTickets]) {
    if (ticket.status === "DELIVERED" && !ticket.hasInvoice) {
      ids.add(ticket.id);
    }
  }
  return [...ids];
}

export async function moveTicketDeliveryDate(
  deliveryTicketId: string,
  newDateRaw: string,
) {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  const newDate = parseReconciliationDate(newDateRaw);
  if (!newDate) {
    return { error: "Invalid date." };
  }

  try {
    await withDatabaseRetry((client) =>
      client.deliveryTicket.update({
        where: { id: deliveryTicketId },
        data: { deliveryDate: newDate },
      }),
    );
    revalidatePath("/delivery-tickets/reconcile");
    revalidatePath("/delivery-tickets");
    revalidatePath(`/delivery-tickets/${deliveryTicketId}`);
    revalidatePath("/invoices");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not move ticket date.",
    };
  }
}

export async function cancelTicketFromReconcile(deliveryTicketId: string) {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  const { updateDeliveryTicketStatus } = await import(
    "@/app/delivery-tickets/actions"
  );
  const result = await updateDeliveryTicketStatus(
    deliveryTicketId,
    "CANCELLED",
  );
  revalidatePath("/delivery-tickets/reconcile");
  revalidatePath("/invoices");
  return result;
}

export async function listTicketsForReconciliation(date: string) {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  const start = parseReconciliationDate(date);
  if (!start) {
    return {
      scheduledTickets: [],
      deliveredOtherDayTickets: [],
      reconciliation: null,
    };
  }
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return withDatabaseRetry(async (client) => {
    const [scheduledTickets, deliveredOtherDayTickets, reconciliation] =
      await Promise.all([
        client.deliveryTicket.findMany({
          where: {
            deliveryDate: { gte: start, lte: end },
          },
          orderBy: { ticketNumber: "asc" },
          select: RECONCILE_TICKET_SELECT,
        }),
        client.deliveryTicket.findMany({
          where: {
            status: "DELIVERED",
            deliveredAt: { gte: start, lte: end },
            OR: [
              { deliveryDate: { lt: start } },
              { deliveryDate: { gt: end } },
              { deliveryDate: null },
            ],
          },
          orderBy: { ticketNumber: "asc" },
          select: RECONCILE_TICKET_SELECT,
        }),
        client.deliveryDayReconciliation.findUnique({
          where: { reconciliationDate: start },
        }),
      ]);

    return {
      scheduledTickets: scheduledTickets.map(mapReconcileTicket),
      deliveredOtherDayTickets: deliveredOtherDayTickets.map(mapReconcileTicket),
      reconciliation,
    };
  });
}

/** Longest from→to span the reconcile range view will load. */
const RECONCILE_RANGE_MAX_DAYS = 92;
/** View-all mode loads at most this many tickets before cutting older days. */
const RECONCILE_VIEW_ALL_TICKET_CAP = 500;

function reconcileDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Tickets grouped per delivery day for the reconcile range / view-all modes.
 * With `from`/`to` set it loads that span (capped at RECONCILE_RANGE_MAX_DAYS);
 * with neither it loads the most recent days until the ticket cap is hit.
 */
export async function listTicketsForReconciliationRange(options: {
  from?: string | null;
  to?: string | null;
}) {
  await requirePermission(AppPermission.DELIVERY_MANAGE);

  let start = options.from ? parseReconciliationDate(options.from) : null;
  let end = options.to ? parseReconciliationDate(options.to) : null;
  if (start && end && end < start) {
    [start, end] = [end, start];
  }
  if (start && !end) {
    end = start;
  }
  let truncated = false;
  if (start && end) {
    const spanDays =
      Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (spanDays > RECONCILE_RANGE_MAX_DAYS) {
      end = new Date(start);
      end.setDate(end.getDate() + RECONCILE_RANGE_MAX_DAYS - 1);
      truncated = true;
    }
  }

  return withDatabaseRetry(async (client) => {
    let tickets;
    if (start && end) {
      const endOfDay = new Date(end);
      endOfDay.setHours(23, 59, 59, 999);
      tickets = await client.deliveryTicket.findMany({
        where: { deliveryDate: { gte: start, lte: endOfDay } },
        orderBy: [{ deliveryDate: "desc" }, { ticketNumber: "asc" }],
        select: RECONCILE_TICKET_SELECT,
      });
    } else {
      tickets = await client.deliveryTicket.findMany({
        where: { deliveryDate: { not: null } },
        orderBy: [{ deliveryDate: "desc" }, { ticketNumber: "asc" }],
        take: RECONCILE_VIEW_ALL_TICKET_CAP + 1,
        select: RECONCILE_TICKET_SELECT,
      });
      if (tickets.length > RECONCILE_VIEW_ALL_TICKET_CAP) {
        truncated = true;
        tickets = tickets.slice(0, RECONCILE_VIEW_ALL_TICKET_CAP);
      }
    }

    const buckets = new Map<string, typeof tickets>();
    for (const ticket of tickets) {
      const key = reconcileDayKey(ticket.deliveryDate!);
      const existing = buckets.get(key);
      if (existing) {
        existing.push(ticket);
      } else {
        buckets.set(key, [ticket]);
      }
    }
    // The cap can leave the oldest day partially loaded; drop it rather than
    // show (and let someone confirm) an incomplete day.
    if (truncated && !start && buckets.size > 1) {
      const keys = [...buckets.keys()];
      buckets.delete(keys[keys.length - 1]!);
    }

    const dayDates = [...buckets.keys()]
      .map((key) => parseReconciliationDate(key))
      .filter((value): value is Date => value !== null);
    const reconciliations =
      dayDates.length > 0
        ? await client.deliveryDayReconciliation.findMany({
            where: { reconciliationDate: { in: dayDates } },
          })
        : [];
    const reconciliationByKey = new Map(
      reconciliations.map((record) => [
        reconcileDayKey(record.reconciliationDate),
        record,
      ]),
    );

    return {
      days: [...buckets.entries()].map(([date, dayTickets]) => ({
        date,
        scheduledTickets: dayTickets.map(mapReconcileTicket),
        reconciliation: reconciliationByKey.get(date) ?? null,
      })),
      truncated,
    };
  });
}

export async function listJobsWithQuotes() {
  await requirePermission(AppPermission.DELIVERY_VIEW);
  return withDatabaseRetry((client) =>
    client.job.findMany({
      orderBy: { jobNumber: "desc" },
      take: 50,
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
