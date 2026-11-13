"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AppPermission,
  type InvoiceLineType,
  type InvoiceStatus,
} from "@/app/generated/prisma/client";
import { Prisma } from "@/app/generated/prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { requirePermission } from "@/lib/auth/session";
import {
  INVOICE_LIST_FILTERS,
  isUnpaidInvoiceStatus,
  UNPAID_INVOICE_STATUSES,
  type InvoiceFilterCounts,
  type InvoiceListFilter,
} from "@/lib/invoice-status";
import { computeMoneyTotals } from "@/lib/money";
import { withDatabaseRetry } from "@/lib/prisma";
import { computeDeliveryAmount } from "@/lib/quotes/money-rules";
import { buildPageInfo } from "@/lib/list-params";
import { returnActionError } from "@/lib/server/action-errors";

export type InvoiceLineInput = {
  id?: string;
  lineNumber: number;
  lineType: InvoiceLineType;
  itemCode: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  /**
   * A line still waiting for a price (prints PRICE NEEDED). Only a line that
   * is already flagged can stay flagged, and only at $0: typing a price
   * clears it, and so does an explicit `false` with a $0 price (no charge).
   */
  needsPrice?: boolean;
  taxable: boolean;
};

export type UpdateInvoiceInput = {
  invoiceId: string;
  taxRate: number;
  discountAmount: number;
  lines: InvoiceLineInput[];
  deletedLineIds: string[];
};

function computeInvoiceFinancials(
  lines: InvoiceLineInput[],
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

// There is no draft stage: an invoice is open from the moment its ticket is
// marked delivered, and stays editable until it is paid or voided
// (see lib/invoice-status).
async function requireEditableInvoice(invoiceId: string) {
  const invoice = await withDatabaseRetry((client) =>
    client.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, status: true },
    }),
  );

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  if (!isUnpaidInvoiceStatus(invoice.status)) {
    throw new Error("Paid or voided invoices cannot be edited.");
  }

  return invoice;
}

export async function markInvoicePaid(invoiceId: string) {
  await requirePermission(AppPermission.INVOICES_MANAGE);
  try {
    // Only an open invoice can be paid, and paying must not rewrite the
    // invoice date. A line still waiting for a price blocks it: the total is
    // not known yet, so "paid" would be recording the wrong amount.
    const updated = await withDatabaseRetry((client) =>
      client.invoice.updateMany({
        where: {
          id: invoiceId,
          status: { in: [...UNPAID_INVOICE_STATUSES] },
          lineItems: { none: { needsPrice: true } },
        },
        data: { status: "PAID" },
      }),
    );
    if (updated.count === 0) {
      const current = await withDatabaseRetry((client) =>
        client.invoice.findUnique({
          where: { id: invoiceId },
          select: { status: true },
        }),
      );
      return {
        error:
          current && isUnpaidInvoiceStatus(current.status)
            ? "This invoice still has a line waiting for a price. Type the price (or 0 for no charge) before marking it paid."
            : "Only open invoices can be marked paid.",
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
 * Unpaid invoices only: removes the invoice outright (line items cascade).
 * The ticket stays delivered and can be invoiced again from the ticket page
 * (Convert to Invoice) — e.g. after fixing a price on the quote — and the new
 * invoice derives the same number back from the ticket number. A paid invoice
 * is voided instead, so the record of the payment survives.
 */
export async function deleteInvoice(invoiceId: string) {
  const user = await requirePermission(AppPermission.INVOICES_MANAGE);
  try {
    const invoice = await withDatabaseRetry((client) =>
      client.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          invoiceNumber: true,
          deliveryTicket: { select: { id: true, ticketNumber: true } },
        },
      }),
    );
    // Status stays in the WHERE clause: a payment recorded between the read
    // above and this delete must never be wiped out.
    const deleted = await withDatabaseRetry((client) =>
      client.invoice.deleteMany({
        where: { id: invoiceId, status: { in: [...UNPAID_INVOICE_STATUSES] } },
      }),
    );
    if (deleted.count === 0 || !invoice) {
      return {
        error:
          "Only unpaid invoices can be deleted. Void a paid invoice instead.",
      };
    }
    await writeAuditLog({
      userId: user.id,
      action: "invoice.delete",
      entityType: "Invoice",
      entityId: invoiceId,
      summary: `${user.displayName} deleted unpaid invoice ${invoice.invoiceNumber} (ticket ${invoice.deliveryTicket.ticketNumber ?? "—"})`,
    });
    revalidatePath("/invoices");
    revalidatePath(`/delivery-tickets/${invoice.deliveryTicket.id}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not delete the invoice.",
    };
  }
}

export async function voidInvoice(invoiceId: string) {
  await requirePermission(AppPermission.INVOICES_MANAGE);
  try {
    // Open or paid only: re-voiding is a no-op that would hide the earlier
    // state.
    const updated = await withDatabaseRetry((client) =>
      client.invoice.updateMany({
        where: {
          id: invoiceId,
          status: { in: [...UNPAID_INVOICE_STATUSES, "PAID"] },
        },
        data: { status: "VOID" },
      }),
    );
    if (updated.count === 0) {
      return {
        error: "This invoice is already void.",
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

/**
 * Undo a void: the invoice comes back open with its number, ticket and lines
 * intact, ready to be corrected. (A voided invoice keeps its delivery ticket
 * — one invoice per ticket, numbered from it — so without this a void left
 * the delivery unbillable.) For a fresh invoice priced from scratch, delete
 * the reopened invoice and convert the ticket again.
 */
export async function reopenVoidedInvoice(invoiceId: string) {
  const user = await requirePermission(AppPermission.INVOICES_MANAGE);
  try {
    const invoice = await withDatabaseRetry((client) =>
      client.invoice.findUnique({
        where: { id: invoiceId },
        select: { invoiceNumber: true },
      }),
    );
    const reopened = await withDatabaseRetry((client) =>
      client.invoice.updateMany({
        where: { id: invoiceId, status: "VOID" },
        data: { status: "SENT" },
      }),
    );
    if (reopened.count === 0 || !invoice) {
      return { error: "Only voided invoices can be reopened." };
    }
    await writeAuditLog({
      userId: user.id,
      action: "invoice.reopen",
      entityType: "Invoice",
      entityId: invoiceId,
      summary: `${user.displayName} reopened voided invoice ${invoice.invoiceNumber}`,
    });
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not reopen the invoice.",
    };
  }
}

export async function updateInvoice(input: UpdateInvoiceInput) {
  await requirePermission(AppPermission.INVOICES_MANAGE);
  const editable = await returnActionError(() =>
    requireEditableInvoice(input.invoiceId),
  );
  if ("error" in editable) {
    return { error: editable.error };
  }

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
    // One transaction: the status check, line writes, and totals commit or
    // roll back together, so a concurrent payment can't interleave and a
    // mid-save failure can't leave lines and totals disagreeing.
    const lineIds = await withDatabaseRetry((client) =>
      client.$transaction(async (tx) => {
        const savedLineIds: string[] = [];
        const invoice = await tx.invoice.findUnique({
          where: { id: input.invoiceId },
          select: {
            status: true,
            lineItems: { select: { id: true, needsPrice: true } },
          },
        });
        if (!invoice || !isUnpaidInvoiceStatus(invoice.status)) {
          throw new Error("Paid or voided invoices cannot be edited.");
        }
        // PRICE NEEDED can only be kept, never newly set, from the editor.
        const flaggedLineIds = new Set(
          invoice.lineItems
            .filter((line) => line.needsPrice)
            .map((line) => line.id),
        );

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
            // Still waiting for a price only while it stays at $0 and nobody
            // said "no charge" (an explicit false). Any price clears it.
            needsPrice:
              line.id != null &&
              flaggedLineIds.has(line.id) &&
              line.unitPrice === 0 &&
              line.needsPrice !== false,
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
            savedLineIds.push(line.id);
          } else {
            const created = await tx.invoiceLineItem.create({
              data: {
                ...data,
                invoiceId: input.invoiceId,
              },
              select: { id: true },
            });
            savedLineIds.push(created.id);
          }
        }

        // Conditional on still being editable, so a payment or void that
        // slipped in between statements can't be overwritten.
        const updatedInvoice = await tx.invoice.updateMany({
          where: {
            id: input.invoiceId,
            status: { in: [...UNPAID_INVOICE_STATUSES] },
          },
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
          throw new Error("Paid or voided invoices cannot be edited.");
        }
        return savedLineIds;
      }),
    );

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${input.invoiceId}`);
    revalidatePath(`/invoices/${input.invoiceId}/edit`);
    // Saved line ids in input order: the editor stays open after a plain
    // save, and new lines must carry their id into the next save or they're
    // created a second time.
    return { success: true, lineIds };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not save the invoice.",
    };
  }
}

export async function saveInvoiceAndRedirect(input: UpdateInvoiceInput) {
  const result = await updateInvoice(input);
  if (result.error) {
    return result;
  }
  redirect(`/invoices/${input.invoiceId}`);
}

export async function getInvoiceEditorData(invoiceId: string) {
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
  /** Price before tax: the subtotal with any discount taken off. */
  price: number;
  salesTax: number;
  total: number;
  invoiceDate: Date | null;
  ticketNumber: string;
  ticketType: string;
  paymentMethod: string | null;
  paymentReceived: boolean;
  deliveryDate: Date | null;
  /** Item codes of the lines still waiting for a price (PRICE NEEDED). */
  priceNeededItems: string[];
};

function invoiceListWhere(filter: InvoiceListFilter): Prisma.InvoiceWhereInput {
  switch (filter) {
    case "PRICE_NEEDED":
      return {
        status: { in: [...UNPAID_INVOICE_STATUSES] },
        lineItems: { some: { needsPrice: true } },
      };
    case "OPEN":
      return { status: { in: [...UNPAID_INVOICE_STATUSES] } };
    case "PAID":
      return { status: "PAID" };
    case "VOID":
      return { status: "VOID" };
    default:
      return {};
  }
}

const INVOICE_LIST_INCLUDE = {
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
    where: { needsPrice: true },
    orderBy: { lineNumber: "asc" },
    select: { itemCode: true },
  },
} as const satisfies Prisma.InvoiceInclude;

function mapInvoiceListRow(
  invoice: Prisma.InvoiceGetPayload<{ include: typeof INVOICE_LIST_INCLUDE }>,
): InvoiceListRow {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customerName,
    projectName: invoice.projectName,
    status: invoice.status,
    price: Number(invoice.subtotal) - Number(invoice.discountAmount),
    salesTax: Number(invoice.salesTax),
    total: Number(invoice.total),
    invoiceDate: invoice.invoiceDate,
    // Invoiced tickets are always numbered; nullable only to match the model.
    ticketNumber: invoice.deliveryTicket.ticketNumber ?? "—",
    ticketType: invoice.deliveryTicket.ticketType,
    paymentMethod: invoice.deliveryTicket.paymentMethod,
    paymentReceived: invoice.deliveryTicket.paymentReceived,
    deliveryDate: invoice.deliveryTicket.deliveryDate,
    // Only an unpaid invoice can still be waiting for a price.
    priceNeededItems: isUnpaidInvoiceStatus(invoice.status)
      ? invoice.lineItems.map((line) => line.itemCode)
      : [],
  };
}

export async function listInvoicesForPage(options: {
  filter: InvoiceListFilter;
  page: number;
}) {
  await requirePermission(AppPermission.INVOICES_VIEW);

  const where = invoiceListWhere(options.filter);

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
      include: INVOICE_LIST_INCLUDE,
    }),
  );

  return {
    invoices: invoices.map(mapInvoiceListRow),
    pageInfo,
  };
}

/** One count per filter chip, so each chip shows how many it holds. */
export async function getInvoiceFilterCounts(): Promise<InvoiceFilterCounts> {
  await requirePermission(AppPermission.INVOICES_VIEW);

  const filters = INVOICE_LIST_FILTERS.map((filter) => filter.value);
  const counts = await withDatabaseRetry((client) =>
    Promise.all(
      filters.map((filter) =>
        client.invoice.count({ where: invoiceListWhere(filter) }),
      ),
    ),
  );

  return Object.fromEntries(
    filters.map((filter, index) => [filter, counts[index]!]),
  ) as InvoiceFilterCounts;
}
