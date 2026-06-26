"use server";

import { revalidatePath } from "next/cache";
import { AppPermission, type PrismaClient } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma, withDatabaseRetry } from "@/lib/prisma";
import { saveDailyProductionEntry } from "@/lib/inventory-service";
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
  convertDeliveryTicketToInvoice,
  maybeCreatePayNowInvoiceForTicket,
} from "@/lib/invoicing-service";

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

export async function approveStructureForProduction(jobStructureId: string) {
  await requirePermission(AppPermission.PRODUCTION_MANAGE);
  try {
    await withDatabaseRetry(async (client) => {
      await approveJobStructureForProduction(client, jobStructureId);
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

  const productIds = formData.getAll("productId").map(String);
  const quantities = formData.getAll("quantityProduced").map(String);

  const lines = productIds
    .map((productId, index) => ({
      productId: productId.trim(),
      quantityProduced: Number(quantities[index] ?? 0),
    }))
    .filter((line) => line.productId && line.quantityProduced > 0);

  try {
    await withDatabaseRetry((client) =>
      saveDailyProductionEntry(client, {
        productionDate,
        enteredBy,
        notes,
        lines,
      }),
    );
    revalidatePath("/inventory");
    revalidatePath("/inventory/production");
    return { success: true };
  } catch (error) {
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
    return {
      error:
        error instanceof Error ? error.message : "Could not mark delivered.",
    };
  }
}

export async function convertTicketToInvoice(deliveryTicketId: string) {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  try {
    const invoiceId = await withDatabaseRetry((client) =>
      convertDeliveryTicketToInvoice(client, deliveryTicketId),
    );
    revalidatePath(`/delivery-tickets/${deliveryTicketId}`);
    revalidatePath("/invoices");
    return { invoiceId };
  } catch (error) {
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
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  const dateRaw = String(formData.get("reconciliationDate") ?? "").trim();
  const confirmedBy = String(formData.get("confirmedBy") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!dateRaw || !confirmedBy) {
    return { error: "Date and confirmed-by are required." };
  }

  const reconciliationDate = parseReconciliationDate(dateRaw);
  if (!reconciliationDate) {
    return { error: "Invalid date." };
  }

  await withDatabaseRetry((client) =>
    client.deliveryDayReconciliation.upsert({
      where: { reconciliationDate },
      create: {
        reconciliationDate,
        confirmedBy,
        confirmedAt: new Date(),
        notes,
      },
      update: {
        confirmedBy,
        confirmedAt: new Date(),
        notes,
      },
    }),
  );

  revalidatePath("/delivery-tickets/reconcile");
  return { success: true };
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
      where: { trackInventory: true, status: "ACTIVE", productType: "STOCK" },
      orderBy: { productCode: "asc" },
      select: { id: true, productCode: true, name: true, unit: true },
    }),
  );
}

export async function listTicketsForReconciliation(date: string) {
  await requirePermission(AppPermission.DELIVERY_MANAGE);
  const start = parseReconciliationDate(date);
  if (!start) {
    return { tickets: [], reconciliation: null };
  }
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return withDatabaseRetry(async (client) => {
    const [tickets, reconciliation] = await Promise.all([
      client.deliveryTicket.findMany({
        where: {
          deliveryDate: { gte: start, lte: end },
        },
        orderBy: { ticketNumber: "asc" },
        select: {
          id: true,
          ticketNumber: true,
          customerName: true,
          projectName: true,
          status: true,
          paperTicketPrinted: true,
          paperTicketVerified: true,
          verifiedBy: true,
        },
      }),
      client.deliveryDayReconciliation.findUnique({
        where: { reconciliationDate: start },
      }),
    ]);

    return { tickets, reconciliation };
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
