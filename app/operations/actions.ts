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

export async function updateTicketPaperVerification(
  deliveryTicketId: string,
  formData: FormData,
) {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  const paperTicketPrinted = formData.get("paperTicketPrinted") === "on";
  const paperTicketVerified = formData.get("paperTicketVerified") === "on";
  const verifiedBy = String(formData.get("verifiedBy") ?? "").trim() || null;

  await withDatabaseRetry((client) =>
    client.deliveryTicket.update({
      where: { id: deliveryTicketId },
      data: {
        paperTicketPrinted,
        paperTicketVerified,
        verifiedBy: paperTicketVerified ? verifiedBy : null,
        verifiedAt: paperTicketVerified ? new Date() : null,
      },
    }),
  );

  revalidatePath("/delivery-tickets/reconcile");
}

export async function confirmDeliveryDayReconciliation(formData: FormData) {
  const user = await requirePermission(AppPermission.DELIVERY_MANAGE);
  const dateRaw = String(formData.get("reconciliationDate") ?? "").trim();
  const confirmedBy = String(formData.get("confirmedBy") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const createInvoices = formData.get("createInvoices") === "on";

  if (!dateRaw || !confirmedBy) {
    return { error: "Date and confirmed-by are required." };
  }

  const reconciliationDate = parseReconciliationDate(dateRaw);
  if (!reconciliationDate) {
    return { error: "Invalid date." };
  }

  const start = reconciliationDate;
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const conversionResult = await withDatabaseRetry(async (client) => {
    await client.deliveryDayReconciliation.upsert({
      where: { reconciliationDate: start },
      create: {
        reconciliationDate: start,
        confirmedBy,
        confirmedAt: new Date(),
        notes,
      },
      update: {
        confirmedBy,
        confirmedAt: new Date(),
        notes,
      },
    });

    if (createInvoices && (await hasPermission(user, AppPermission.INVOICES_MANAGE))) {
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
  paperTicketVerified: true,
  verifiedBy: true,
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
    paperTicketVerified: boolean;
    verifiedBy: string | null;
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
