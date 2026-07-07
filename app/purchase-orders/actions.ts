"use server";

import { mkdir, writeFile } from "fs/promises";
import { revalidatePath } from "next/cache";
import {
  AppPermission,
  type PurchaseOrderStatus,
  type ReceivingCategory,
} from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { sanitizeFileName, resolveUniqueFilePath } from "@/lib/file-upload-utils";
import {
  resolvePurchaseOrderDirectory,
} from "@/lib/purchase-order-path";
import {
  createPurchaseOrderRecord,
  listOpenPurchaseOrders,
  updatePurchaseOrderRecord,
  type PurchaseOrderLineInput,
  type SavePurchaseOrderInput,
} from "@/lib/purchase-order-service";
import {
  canEditPurchaseOrder,
  parsePurchaseOrderStatus,
} from "@/lib/purchase-order-utils";
import { parseReceivingCategory } from "@/lib/receiving-utils";
import { withDatabaseRetry } from "@/lib/prisma";
import { assertUploadAllowed } from "@/lib/upload-validation";
import { translatePrismaError } from "@/lib/server/action-errors";

function parseDate(value: string | null | undefined): Date | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const date = new Date(`${trimmed}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseLinesFromFormData(formData: FormData): PurchaseOrderLineInput[] {
  const itemCodes = formData.getAll("itemCode").map(String);
  const descriptions = formData.getAll("description").map(String);
  const productIds = formData.getAll("productId").map(String);
  const quantities = formData.getAll("quantityOrdered").map(String);
  const units = formData.getAll("unit").map(String);
  const unitPrices = formData.getAll("unitPrice").map(String);

  const lines: PurchaseOrderLineInput[] = [];
  for (let index = 0; index < itemCodes.length; index += 1) {
    const itemCode = itemCodes[index]?.trim();
    const qtyRaw = quantities[index]?.trim();
    if (!itemCode && !qtyRaw) {
      continue;
    }
    if (!itemCode) {
      throw new Error(`Line ${index + 1}: item code is required.`);
    }
    const quantityOrdered = Number(qtyRaw);
    if (!Number.isFinite(quantityOrdered) || quantityOrdered <= 0) {
      throw new Error(`Line ${index + 1}: quantity must be greater than zero.`);
    }
    const unitPrice = Number(unitPrices[index] ?? "0");
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Line ${index + 1}: unit price cannot be negative.`);
    }
    lines.push({
      itemCode,
      description: descriptions[index]?.trim() || null,
      productId: productIds[index]?.trim() || null,
      quantityOrdered,
      unit: units[index]?.trim() || "EA",
      unitPrice,
    });
  }
  return lines;
}

function parseSaveInput(formData: FormData): SavePurchaseOrderInput {
  const vendorId = String(formData.get("vendorId") ?? "").trim();
  if (!vendorId) {
    throw new Error("Vendor is required.");
  }

  const categoryRaw = String(formData.get("category") ?? "").trim();
  const category = categoryRaw ? parseReceivingCategory(categoryRaw) : null;
  if (categoryRaw && !category) {
    throw new Error("Invalid category.");
  }

  const orderDate = parseDate(String(formData.get("orderDate") ?? ""));
  if (!orderDate) {
    throw new Error("Order date is required.");
  }

  const expectedDate = parseDate(String(formData.get("expectedDate") ?? ""));

  return {
    vendorId,
    category,
    orderDate,
    expectedDate,
    notes: String(formData.get("notes") ?? "").trim() || null,
    enteredBy: String(formData.get("enteredBy") ?? "").trim() || null,
    submissionKey: String(formData.get("submissionKey") ?? "").trim() || null,
    lines: parseLinesFromFormData(formData),
  };
}

function revalidatePurchaseOrderPaths(id?: string) {
  revalidatePath("/purchase-orders");
  revalidatePath("/receiving");
  if (id) {
    revalidatePath(`/purchase-orders/${id}`);
    revalidatePath(`/purchase-orders/${id}/edit`);
  }
}

async function persistVendorQuote(
  purchaseOrderId: string,
  file: File,
): Promise<void> {
  assertUploadAllowed(file);

  const po = await withDatabaseRetry((client) =>
    client.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: { poNumber: true },
    }),
  );
  if (!po) {
    throw new Error("Purchase order not found.");
  }

  const directory = resolvePurchaseOrderDirectory(po.poNumber);
  await mkdir(directory, { recursive: true });

  const safeName = sanitizeFileName(file.name);
  const filePath = await resolveUniqueFilePath(directory, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  await withDatabaseRetry((client) =>
    client.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        vendorQuotePath: filePath,
        vendorQuoteName: safeName,
      },
    }),
  );
}

export async function createPurchaseOrder(formData: FormData) {
  await requirePermission(AppPermission.INVENTORY_MANAGE);

  try {
    const input = parseSaveInput(formData);
    const vendorQuote = formData.get("vendorQuote");

    const id = await withDatabaseRetry((client) =>
      client.$transaction((tx) => createPurchaseOrderRecord(tx, input)),
    );

    if (vendorQuote instanceof File && vendorQuote.size > 0) {
      await persistVendorQuote(id, vendorQuote);
    }

    revalidatePurchaseOrderPaths(id);
    return { success: true, id };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? translatePrismaError(error).message
          : "Could not create purchase order.",
    };
  }
}

export async function updatePurchaseOrder(
  purchaseOrderId: string,
  formData: FormData,
) {
  await requirePermission(AppPermission.INVENTORY_MANAGE);

  const expectedUpdatedAtRaw = String(
    formData.get("expectedUpdatedAt") ?? "",
  ).trim();
  const expectedUpdatedAt = expectedUpdatedAtRaw
    ? new Date(expectedUpdatedAtRaw)
    : null;

  try {
    const input = parseSaveInput(formData);
    const vendorQuote = formData.get("vendorQuote");

    await withDatabaseRetry((client) =>
      client.$transaction((tx) =>
        updatePurchaseOrderRecord(
          tx,
          purchaseOrderId,
          input,
          expectedUpdatedAt,
        ),
      ),
    );

    if (vendorQuote instanceof File && vendorQuote.size > 0) {
      await persistVendorQuote(purchaseOrderId, vendorQuote);
    }

    revalidatePurchaseOrderPaths(purchaseOrderId);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? translatePrismaError(error).message
          : "Could not update purchase order.",
    };
  }
}

export async function updatePurchaseOrderStatus(
  purchaseOrderId: string,
  status: PurchaseOrderStatus,
) {
  await requirePermission(AppPermission.INVENTORY_MANAGE);

  if (!parsePurchaseOrderStatus(status)) {
    return { error: "Invalid status." };
  }

  try {
    await withDatabaseRetry(async (client) => {
      const po = await client.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        select: { status: true },
      });
      if (!po) {
        throw new Error("Purchase order not found.");
      }

      if (status === "ISSUED" && po.status !== "DRAFT") {
        throw new Error("Only draft purchase orders can be issued.");
      }
      if (status === "CANCELLED" && !canEditPurchaseOrder(po.status)) {
        throw new Error("This purchase order cannot be cancelled.");
      }

      await client.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: { status },
      });
    });

    revalidatePurchaseOrderPaths(purchaseOrderId);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? translatePrismaError(error).message
          : "Could not update status.",
    };
  }
}

export async function listOpenPurchaseOrdersForReceiving(
  category?: ReceivingCategory | null,
) {
  await requirePermission(AppPermission.INVENTORY_VIEW);
  return withDatabaseRetry((client) =>
    listOpenPurchaseOrders(client, category ?? undefined),
  );
}

export async function getPurchaseOrderForReceiving(purchaseOrderId: string) {
  await requirePermission(AppPermission.INVENTORY_VIEW);
  return withDatabaseRetry((client) =>
    client.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: {
        id: true,
        poNumber: true,
        category: true,
        status: true,
        vendor: { select: { name: true } },
        lines: {
          orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }],
          select: {
            id: true,
            productId: true,
            itemCode: true,
            description: true,
            quantityOrdered: true,
            quantityReceived: true,
            unit: true,
          },
        },
      },
    }),
  );
}

export async function listVendorsForPurchaseOrderForm() {
  await requirePermission(AppPermission.INVENTORY_VIEW);
  return withDatabaseRetry((client) =>
    client.vendor.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        defaultCategory: true,
      },
    }),
  );
}
