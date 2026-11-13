"use server";

import { revalidatePath } from "next/cache";
import { AppPermission, type PrismaClient } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { parseCalendarDate } from "@/lib/date-only";
import { withDatabaseRetry } from "@/lib/prisma";
import { PHYSICAL_PRODUCT_TYPES } from "@/lib/product-types";
import {
  isDuplicateSubmission,
  saveDailyProductionEntry,
} from "@/lib/inventory-service";
import {
  approveJobStructureForProduction,
  findJobStructureDeleteBlockers,
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
  convertDeliveryTicketToInvoice,
  ensureInvoiceAfterDelivery,
  InvoiceAlreadyExistsError,
} from "@/lib/invoicing-service";
import { returnActionError } from "@/lib/server/action-errors";

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
  return returnActionError(() =>
    withDatabaseRetry(async (client) => {
      const count = await linkJobStructuresFromQuote(client, quoteId);
      revalidatePath("/production");
      revalidatePath(`/quotes/${quoteId}`);
      return { count };
    }),
  );
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

  const productionDate = parseCalendarDate(productionDateRaw);
  if (!productionDate) {
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

/**
 * Deletes selected structures from a job. All-or-nothing: structures on a
 * delivery ticket or with production history block the whole delete
 * (findJobStructureDeleteBlockers), so nothing disappears half-way. Quote
 * lines linked to a deleted structure stay on the quote but lose their
 * structure link.
 */
export async function bulkDeleteJobStructures(
  jobId: string,
  structureIds: string[],
) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  if (structureIds.length === 0) {
    return { error: "Select at least one structure." };
  }
  try {
    let deleted = 0;
    await withDatabaseRetry((client) =>
      client.$transaction(async (tx) => {
        const structures = await tx.jobStructure.findMany({
          where: { id: { in: structureIds }, jobId },
          select: { id: true },
        });
        if (structures.length !== structureIds.length) {
          throw new Error("Some selected structures are no longer on this job.");
        }
        const blockers = await findJobStructureDeleteBlockers(tx, structureIds);
        if (blockers.length > 0) {
          throw new Error(
            `Can't delete: ${blockers.join("; ")}. Deselect them and try again.`,
          );
        }
        const result = await tx.jobStructure.deleteMany({
          where: { id: { in: structureIds }, jobId },
        });
        deleted = result.count;
      }),
    );
    revalidatePath("/production");
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/drill-sheets");
    return { success: true as const, deleted };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not delete the selected structures.",
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
  const productionDate = parseCalendarDate(input.productionDate);
  if (!productionDate) {
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

export async function deliverTicket(
  deliveryTicketId: string,
  options: {
    /** Counter flow: set the ticket's payment-received flag before the
     * invoice is created, so a pay-now sale comes out PAID (or open). */
    paymentReceived?: boolean;
  } = {},
) {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  try {
    // The flag only decides how the invoice is created, so it may
    // only change before completion. A reprint of a completed sale must not
    // flip it: the existing invoice wouldn't follow, leaving the ticket
    // saying "paid" next to an unpaid invoice (or the reverse).
    let paymentFlagIgnored = false;
    if (options.paymentReceived !== undefined) {
      const updated = await withDatabaseRetry((client) =>
        client.deliveryTicket.updateMany({
          where: {
            id: deliveryTicketId,
            status: { notIn: ["DELIVERED", "CANCELLED"] },
          },
          data: { paymentReceived: options.paymentReceived },
        }),
      );
      if (updated.count === 0) {
        const current = await withDatabaseRetry((client) =>
          client.deliveryTicket.findUnique({
            where: { id: deliveryTicketId },
            select: { paymentReceived: true },
          }),
        );
        paymentFlagIgnored =
          current != null && current.paymentReceived !== options.paymentReceived;
      }
    }
    await withDatabaseRetry((client) =>
      markDeliveryTicketDelivered(client, deliveryTicketId),
    );
    // Every delivered ticket gets its invoice right away (no draft stage, no
    // separate "create invoices" step). A failure here is a warning, never a
    // failed delivery: the stock is already deducted.
    const invoiceResult = await withDatabaseRetry((client) =>
      ensureInvoiceAfterDelivery(client, deliveryTicketId),
    );
    revalidatePath("/delivery-tickets");
    revalidatePath(`/delivery-tickets/${deliveryTicketId}`);
    revalidatePath("/walk-ins");
    revalidatePath("/inventory");
    if (invoiceResult.invoice) {
      revalidatePath("/invoices");
    }
    return {
      success: true,
      // Number and status for the confirmation ("Invoice I10123 made") and
      // for the counter flow, which prints a pay-now invoice straight away.
      invoice: invoiceResult.invoice,
      invoiceCreated: invoiceResult.created,
      warning:
        [
          paymentFlagIgnored
            ? "This sale was already completed, so its payment status wasn't changed. Record the payment on the invoice instead."
            : null,
          invoiceResult.warning,
        ]
          .filter(Boolean)
          .join(" ") || null,
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
  // Making an invoice by hand is a billing operation, not a dispatch one.
  // (The automatic invoice on deliverTicket stays under DELIVERY_MANAGE
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
        customerId: true,
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
