"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AppPermission,
  type InvoiceLineType,
  type InvoiceStatus,
} from "@/app/generated/prisma/client";
import { Prisma } from "@/app/generated/prisma/client";
import { getAppSettings } from "@/lib/app-settings";
import { requirePermission } from "@/lib/auth/session";
import { invoiceDueDateFromDelivery } from "@/lib/invoicing-service";
import { computeMoneyTotals } from "@/lib/money";
import { withDatabaseRetry } from "@/lib/prisma";
import { computeDeliveryAmount } from "@/lib/quotes/money-rules";
import { buildPageInfo } from "@/lib/list-params";

export type DraftInvoiceLineInput = {
  id?: string;
  lineNumber: number;
  lineType: InvoiceLineType;
  itemCode: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxable: boolean;
};

export type UpdateDraftInvoiceInput = {
  invoiceId: string;
  taxRate: number;
  discountAmount: number;
  lines: DraftInvoiceLineInput[];
  deletedLineIds: string[];
};

function parseInvoiceDate(value: string | null | undefined): Date | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function computeInvoiceFinancials(
  lines: DraftInvoiceLineInput[],
  taxRate: number,
  discountAmount: number,
) {
  const computed = computeMoneyTotals(
    lines.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxable: line.taxable,
    })),
    taxRate,
    discountAmount,
  );

  const deliveryAmount = computeDeliveryAmount(
    lines.map((line) => ({
      lineType: line.lineType,
      itemCode: line.itemCode,
      description: line.description,
    })),
    computed.lineTotals,
  );

  return { computed, deliveryAmount };
}

async function requireDraftInvoice(invoiceId: string) {
  const invoice = await withDatabaseRetry((client) =>
    client.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, status: true },
    }),
  );

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  if (invoice.status !== "DRAFT") {
    throw new Error("Only draft invoices can be edited.");
  }

  return invoice;
}

export async function finalizeInvoices(
  invoiceIds: string[],
  invoiceDateRaw?: string,
) {
  const user = await requirePermission(AppPermission.INVOICES_MANAGE);
  const uniqueIds = [...new Set(invoiceIds.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return { error: "Select at least one draft invoice to finalize." };
  }

  const invoiceDate = parseInvoiceDate(invoiceDateRaw) ?? new Date();
  invoiceDate.setHours(0, 0, 0, 0);

  try {
    const result = await withDatabaseRetry(async (client) => {
      // Due dates are one month after each ticket's delivery/pickup date,
      // so the batch updates per invoice. Status stays in the WHERE clause:
      // an invoice finalized (or voided) by a concurrent caller between the
      // find and an update must not be stamped again.
      const drafts = await client.invoice.findMany({
        where: { id: { in: uniqueIds }, status: "DRAFT" },
        select: {
          id: true,
          deliveryTicket: { select: { deliveryDate: true } },
        },
      });

      let finalized = 0;
      for (const draft of drafts) {
        const updated = await client.invoice.updateMany({
          where: { id: draft.id, status: "DRAFT" },
          data: {
            status: "SENT",
            invoiceDate,
            dueDate: invoiceDueDateFromDelivery(
              draft.deliveryTicket?.deliveryDate,
              invoiceDate,
            ),
            finalizedAt: new Date(),
            finalizedBy: user.displayName,
          },
        });
        finalized += updated.count;
      }

      if (finalized === 0) {
        throw new Error("No draft invoices found to finalize.");
      }

      return { finalized };
    });

    revalidatePath("/invoices");
    for (const id of uniqueIds) {
      revalidatePath(`/invoices/${id}`);
    }
    return { success: true, finalized: result.finalized };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not finalize invoices.",
    };
  }
}

export async function finalizeAllDraftInvoices(invoiceDateRaw?: string) {
  await requirePermission(AppPermission.INVOICES_MANAGE);
  const draftIds = await withDatabaseRetry((client) =>
    client.invoice.findMany({
      where: { status: "DRAFT" },
      select: { id: true },
    }),
  );
  return finalizeInvoices(
    draftIds.map((invoice) => invoice.id),
    invoiceDateRaw,
  );
}

export async function markInvoicePaid(invoiceId: string) {
  await requirePermission(AppPermission.INVOICES_MANAGE);
  try {
    // Only a finalized (SENT) invoice can be paid, and paying must not
    // rewrite the invoice date — that's the billing date on the document.
    const updated = await withDatabaseRetry((client) =>
      client.invoice.updateMany({
        where: { id: invoiceId, status: "SENT" },
        data: { status: "PAID" },
      }),
    );
    if (updated.count === 0) {
      return {
        error: "Only finalized invoices can be marked paid.",
      };
    }
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not mark invoice paid.",
    };
  }
}

/**
 * Drafts only: removes the invoice outright (line items cascade), freeing
 * the delivery ticket to be re-converted — e.g. after a pricing fix. The
 * re-created invoice derives the same number back from the ticket number.
 * Finalized invoices are voided instead so the numbering trail survives.
 */
export async function deleteDraftInvoice(invoiceId: string) {
  await requirePermission(AppPermission.INVOICES_MANAGE);
  try {
    const deleted = await withDatabaseRetry((client) =>
      client.invoice.deleteMany({
        where: { id: invoiceId, status: "DRAFT" },
      }),
    );
    if (deleted.count === 0) {
      return { error: "Only draft invoices can be deleted." };
    }
    revalidatePath("/invoices");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not delete the draft.",
    };
  }
}

export async function voidInvoice(invoiceId: string) {
  await requirePermission(AppPermission.INVOICES_MANAGE);
  try {
    // SENT or PAID only: drafts should be edited or deleted instead, and
    // re-voiding is a no-op that would hide the earlier state.
    const updated = await withDatabaseRetry((client) =>
      client.invoice.updateMany({
        where: { id: invoiceId, status: { in: ["SENT", "PAID"] } },
        data: { status: "VOID" },
      }),
    );
    if (updated.count === 0) {
      return {
        error: "Only finalized or paid invoices can be voided.",
      };
    }
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not void invoice.",
    };
  }
}

export async function updateDraftInvoice(input: UpdateDraftInvoiceInput) {
  await requirePermission(AppPermission.INVOICES_MANAGE);
  await requireDraftInvoice(input.invoiceId);

  if (input.lines.length === 0) {
    return { error: "At least one line item is required." };
  }

  for (const line of input.lines) {
    if (!line.itemCode.trim()) {
      return { error: "Every line must have an item code." };
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      return { error: `Invalid quantity for line ${line.lineNumber}.` };
    }
    if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
      return { error: `Invalid unit price for line ${line.lineNumber}.` };
    }
  }

  const { computed, deliveryAmount } = computeInvoiceFinancials(
    input.lines,
    input.taxRate,
    input.discountAmount,
  );

  try {
    // One transaction: the draft check, line writes, and totals commit or
    // roll back together, so a concurrent finalization can't interleave and
    // a mid-save failure can't leave lines and totals disagreeing.
    await withDatabaseRetry((client) =>
      client.$transaction(async (tx) => {
        const invoice = await tx.invoice.findUnique({
          where: { id: input.invoiceId },
          select: { status: true },
        });
        if (!invoice || invoice.status !== "DRAFT") {
          throw new Error("Only draft invoices can be edited.");
        }

        if (input.deletedLineIds.length > 0) {
          await tx.invoiceLineItem.deleteMany({
            where: {
              id: { in: input.deletedLineIds },
              invoiceId: input.invoiceId,
            },
          });
        }

        for (let index = 0; index < input.lines.length; index += 1) {
          const line = input.lines[index]!;
          const total = computed.lineTotals[index]!;
          const data = {
            lineNumber: line.lineNumber,
            lineType: line.lineType,
            itemCode: line.itemCode.trim(),
            description: line.description.trim() || null,
            quantity: new Prisma.Decimal(line.quantity),
            unit: line.unit.trim() || "EA",
            unitPrice: new Prisma.Decimal(line.unitPrice),
            taxable: line.taxable,
            total,
            sortOrder: index,
          };

          if (line.id) {
            // Scoped by invoiceId: a stale or crafted line id belonging to a
            // different invoice must never be written through this edit.
            const updated = await tx.invoiceLineItem.updateMany({
              where: { id: line.id, invoiceId: input.invoiceId },
              data,
            });
            if (updated.count === 0) {
              throw new Error(
                "A line on this invoice changed or was removed. Reload and try again.",
              );
            }
          } else {
            await tx.invoiceLineItem.create({
              data: {
                ...data,
                invoiceId: input.invoiceId,
              },
            });
          }
        }

        // Conditional on still being a draft, so a finalization that slipped
        // in between statements can't be overwritten.
        const updatedInvoice = await tx.invoice.updateMany({
          where: { id: input.invoiceId, status: "DRAFT" },
          data: {
            subtotal: computed.subtotal,
            discountAmount: new Prisma.Decimal(input.discountAmount),
            deliveryAmount,
            taxableAmount: computed.taxableAmount,
            taxRate: new Prisma.Decimal(input.taxRate),
            salesTax: computed.salesTax,
            total: computed.total,
          },
        });
        if (updatedInvoice.count === 0) {
          throw new Error("Only draft invoices can be edited.");
        }
      }),
    );

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${input.invoiceId}`);
    revalidatePath(`/invoices/${input.invoiceId}/edit`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not save draft invoice.",
    };
  }
}

export async function saveDraftInvoiceAndRedirect(input: UpdateDraftInvoiceInput) {
  const result = await updateDraftInvoice(input);
  if (result.error) {
    return result;
  }
  redirect(`/invoices/${input.invoiceId}`);
}

export async function getDraftInvoiceEditorData(invoiceId: string) {
  await requirePermission(AppPermission.INVOICES_VIEW);
  const invoice = await withDatabaseRetry((client) =>
    client.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lineItems: { orderBy: { lineNumber: "asc" } },
        deliveryTicket: {
          select: {
            ticketNumber: true,
            ticketType: true,
            paymentMethod: true,
            paymentReceived: true,
          },
        },
      },
    }),
  );

  if (!invoice) {
    return null;
  }

  return invoice;
}

export type InvoiceListRow = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  projectName: string;
  status: InvoiceStatus;
  subtotal: number;
  deliveryAmount: number;
  salesTax: number;
  total: number;
  invoiceDate: Date | null;
  ticketNumber: string;
  ticketType: string;
  paymentMethod: string | null;
  paymentReceived: boolean;
  deliveryDate: Date | null;
  hasZeroPriceLine: boolean;
};

function mapInvoiceListRow(invoice: {
  id: string;
  invoiceNumber: string;
  customerName: string;
  projectName: string;
  status: InvoiceStatus;
  subtotal: { toString(): string };
  deliveryAmount: { toString(): string };
  salesTax: { toString(): string };
  total: { toString(): string };
  invoiceDate: Date | null;
  deliveryTicket: {
    ticketNumber: string;
    ticketType: string;
    paymentMethod: string | null;
    paymentReceived: boolean;
    deliveryDate: Date | null;
  };
  lineItems: Array<{ unitPrice: { toString(): string } }>;
}): InvoiceListRow {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customerName,
    projectName: invoice.projectName,
    status: invoice.status,
    subtotal: Number(invoice.subtotal),
    deliveryAmount: Number(invoice.deliveryAmount),
    salesTax: Number(invoice.salesTax),
    total: Number(invoice.total),
    invoiceDate: invoice.invoiceDate,
    ticketNumber: invoice.deliveryTicket.ticketNumber,
    ticketType: invoice.deliveryTicket.ticketType,
    paymentMethod: invoice.deliveryTicket.paymentMethod,
    paymentReceived: invoice.deliveryTicket.paymentReceived,
    deliveryDate: invoice.deliveryTicket.deliveryDate,
    hasZeroPriceLine: invoice.lineItems.some(
      (line) => Number(line.unitPrice) === 0,
    ),
  };
}

export async function listInvoicesForPage(options: {
  tab: "drafts" | "final";
  status?: string;
  page: number;
  /** Drafts tab only: inclusive delivery-date range (YYYY-MM-DD). */
  deliveryFrom?: string | null;
  deliveryTo?: string | null;
}) {
  await requirePermission(AppPermission.INVOICES_VIEW);

  const deliveryFrom = parseInvoiceDate(options.deliveryFrom);
  const deliveryToEnd = parseInvoiceDate(options.deliveryTo);
  if (deliveryToEnd) {
    deliveryToEnd.setHours(23, 59, 59, 999);
  }
  const deliveryDateFilter =
    options.tab === "drafts" && (deliveryFrom || deliveryToEnd)
      ? {
          deliveryTicket: {
            deliveryDate: {
              ...(deliveryFrom ? { gte: deliveryFrom } : {}),
              ...(deliveryToEnd ? { lte: deliveryToEnd } : {}),
            },
          },
        }
      : {};

  const where =
    options.tab === "drafts"
      ? { status: "DRAFT" as const, ...deliveryDateFilter }
      : options.status && options.status !== "ALL"
        ? { status: options.status as InvoiceStatus }
        : { status: { in: ["SENT", "PAID", "VOID"] as InvoiceStatus[] } };

  const total = await withDatabaseRetry((client) =>
    client.invoice.count({ where }),
  );
  const pageInfo = buildPageInfo(total, options.page);

  const invoices = await withDatabaseRetry((client) =>
    client.invoice.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: pageInfo.skip,
      take: pageInfo.take,
      include: {
        deliveryTicket: {
          select: {
            ticketNumber: true,
            ticketType: true,
            paymentMethod: true,
            paymentReceived: true,
            deliveryDate: true,
          },
        },
        lineItems: {
          select: { unitPrice: true },
        },
      },
    }),
  );

  return {
    invoices: invoices.map(mapInvoiceListRow),
    pageInfo,
  };
}

export async function getInvoiceTabCounts() {
  await requirePermission(AppPermission.INVOICES_VIEW);

  const [draftCount, finalCount, paidWalkInCount] = await withDatabaseRetry(
    (client) =>
      Promise.all([
        client.invoice.count({ where: { status: "DRAFT" } }),
        client.invoice.count({
          where: { status: { in: ["SENT", "PAID", "VOID"] } },
        }),
        client.invoice.count({
          where: {
            status: "PAID",
            deliveryTicket: {
              ticketType: "WALK_IN",
              paymentMethod: "PAY_NOW",
              paymentReceived: true,
            },
          },
        }),
      ]),
  );

  return { draftCount, finalCount, paidWalkInCount };
}

export async function listPaidWalkInInvoices() {
  await requirePermission(AppPermission.INVOICES_VIEW);

  const invoices = await withDatabaseRetry((client) =>
    client.invoice.findMany({
      where: {
        status: "PAID",
        deliveryTicket: {
          ticketType: "WALK_IN",
          paymentMethod: "PAY_NOW",
          paymentReceived: true,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
      include: {
        deliveryTicket: {
          select: {
            ticketNumber: true,
            ticketType: true,
            paymentMethod: true,
            paymentReceived: true,
            deliveryDate: true,
          },
        },
        lineItems: {
          select: { unitPrice: true },
        },
      },
    }),
  );

  return invoices.map(mapInvoiceListRow);
}
