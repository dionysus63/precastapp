"use server";

import { revalidatePath } from "next/cache";
import { AppPermission, type ReceivingCategory } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import {
  adjustInventory,
  isDuplicateSubmission,
  savePurchaseReceiptEntry,
} from "@/lib/inventory-service";
import { withDatabaseRetry } from "@/lib/prisma";
import {
  isCastingReceivingCategory,
  isPipeReceivingCategory,
  parseReceivingCategory,
} from "@/lib/receiving-utils";
import { translatePrismaError } from "@/lib/server/action-errors";

async function resolveReceivingCategory(input: {
  categoryRaw: string | null;
  supplierId: string | null;
}): Promise<ReceivingCategory | null> {
  const explicitCategory = input.categoryRaw
    ? parseReceivingCategory(input.categoryRaw)
    : null;

  if (explicitCategory && isPipeReceivingCategory(explicitCategory)) {
    return explicitCategory;
  }

  if (input.supplierId) {
    const supplier = await withDatabaseRetry((client) =>
      client.castingSupplier.findUnique({
        where: { id: input.supplierId! },
        select: { origin: true },
      }),
    );
    if (supplier?.origin === "DOMESTIC") {
      return "DOMESTIC_CASTINGS";
    }
    if (supplier?.origin === "IMPORTED") {
      return "IMPORTED_CASTINGS";
    }
  }

  if (explicitCategory && isCastingReceivingCategory(explicitCategory)) {
    return explicitCategory;
  }

  return null;
}

export async function saveInventoryAdjustment(formData: FormData) {
  await requirePermission(AppPermission.INVENTORY_MANAGE);
  const productId = String(formData.get("productId") ?? "").trim();
  const quantityChange = Number(formData.get("quantityChange"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const enteredBy = String(formData.get("enteredBy") ?? "").trim() || null;
  const dateRaw = String(formData.get("transactionDate") ?? "").trim();
  const submissionKey =
    String(formData.get("submissionKey") ?? "").trim() || null;

  if (!productId) {
    return { error: "Product is required." };
  }

  if (!Number.isFinite(quantityChange) || quantityChange === 0) {
    return { error: "Enter a non-zero adjustment quantity." };
  }

  if (!Number.isInteger(quantityChange)) {
    return { error: "Adjustment quantity must be a whole number." };
  }

  const transactionDate = dateRaw ? new Date(`${dateRaw}T00:00:00`) : new Date();
  if (Number.isNaN(transactionDate.getTime())) {
    return { error: "Invalid adjustment date." };
  }

  try {
    await withDatabaseRetry((client) =>
      adjustInventory(client, {
        productId,
        quantityChange,
        transactionDate,
        notes,
        createdBy: enteredBy,
        submissionKey,
      }),
    );

    revalidatePath("/inventory");
    revalidatePath(`/inventory/${productId}`);
    return { success: true };
  } catch (error) {
    // The same submission already landed (double-click / retry) — success.
    if (isDuplicateSubmission(error)) {
      revalidatePath("/inventory");
      revalidatePath(`/inventory/${productId}`);
      return { success: true };
    }
    return {
      error:
        error instanceof Error
          ? translatePrismaError(error).message
          : "Could not save adjustment.",
    };
  }
}

export async function savePurchaseReceipt(formData: FormData) {
  await requirePermission(AppPermission.INVENTORY_MANAGE);

  const supplierId = String(formData.get("supplierId") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const enteredBy = String(formData.get("enteredBy") ?? "").trim() || null;
  const batchLabel = String(formData.get("batchLabel") ?? "").trim() || null;
  const dateRaw = String(formData.get("receiptDate") ?? "").trim();
  const assemblyId = String(formData.get("assemblyId") ?? "").trim();
  const assemblyQtyRaw = String(formData.get("assemblyQty") ?? "").trim();
  const submissionKey =
    String(formData.get("submissionKey") ?? "").trim() || null;
  const categoryRaw = String(formData.get("category") ?? "").trim() || null;
  const returnPath = String(formData.get("returnPath") ?? "").trim() || null;
  const purchaseOrderId =
    String(formData.get("purchaseOrderId") ?? "").trim() || null;

  const category = await resolveReceivingCategory({ categoryRaw, supplierId });

  const productIds = formData.getAll("productId").map(String);
  const quantities = formData.getAll("quantityReceived").map(String);

  const lines: { productId: string; quantityReceived: number }[] = [];
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
        error: `Line ${index + 1}: quantity received must be a positive number.`,
      };
    }
    if (!Number.isInteger(qty)) {
      return {
        error: `Line ${index + 1}: quantity received must be a whole number.`,
      };
    }
    lines.push({ productId, quantityReceived: qty });
  }

  const receiptDate = dateRaw ? new Date(`${dateRaw}T00:00:00`) : new Date();
  if (Number.isNaN(receiptDate.getTime())) {
    return { error: "Invalid receipt date." };
  }

  if (category === "RCP" || category === "ADS_PIPE") {
    const expectedType = category === "RCP" ? "PRECAST_PIPE" : "ADS_PIPE";
    const productIdsToCheck = [...new Set(lines.map((line) => line.productId))];
    if (productIdsToCheck.length > 0) {
      const products = await withDatabaseRetry((client) =>
        client.product.findMany({
          where: { id: { in: productIdsToCheck } },
          select: { id: true, productType: true, productCode: true },
        }),
      );
      const productById = new Map(products.map((product) => [product.id, product]));
      for (const line of lines) {
        const product = productById.get(line.productId);
        if (!product) {
          return { error: "Product not found." };
        }
        if (product.productType !== expectedType) {
          return {
            error: `"${product.productCode}" is not a valid ${category === "RCP" ? "RCP" : "ADS Pipe"} product.`,
          };
        }
      }
    }
  }

  try {
    await withDatabaseRetry(async (client) => {
      await client.$transaction(async (tx) => {
        const txLines = [...lines];

        if (assemblyId && txLines.length === 0) {
          const assemblyQty = Number(assemblyQtyRaw);
          if (!Number.isFinite(assemblyQty) || assemblyQty <= 0) {
            throw new Error("Enter a quantity for the full casting set.");
          }
          if (!Number.isInteger(assemblyQty)) {
            throw new Error("Casting set quantity must be a whole number.");
          }

          const bom = await tx.productCastingComponent.findMany({
            where: { assemblyId },
            select: { componentId: true, quantity: true },
          });

          if (bom.length === 0) {
            throw new Error("Selected assembly has no BOM components.");
          }

          for (const row of bom) {
            txLines.push({
              productId: row.componentId,
              quantityReceived: row.quantity * assemblyQty,
            });
          }
        }

        await savePurchaseReceiptEntry(tx, {
          receiptDate,
          category,
          supplierId,
          purchaseOrderId,
          enteredBy,
          notes,
          batchLabel,
          submissionKey,
          lines: txLines,
        });
      },
      // Generous ceiling for big receipts; the service batches its writes so
      // normal entries stay far under it.
      { timeout: 30_000 });
    });

    revalidatePath("/inventory");
    revalidatePath("/inventory/receipts");
    revalidatePath("/receiving");
    revalidatePath("/purchase-orders");
    if (purchaseOrderId) {
      revalidatePath(`/purchase-orders/${purchaseOrderId}`);
    }
    return {
      success: true,
      returnPath:
        returnPath && returnPath.startsWith("/") ? returnPath : "/inventory/receipts",
    };
  } catch (error) {
    // The same submission already landed (double-click / retry) — success.
    if (isDuplicateSubmission(error)) {
      revalidatePath("/inventory");
      revalidatePath("/inventory/receipts");
      revalidatePath("/receiving");
      revalidatePath("/purchase-orders");
      if (purchaseOrderId) {
        revalidatePath(`/purchase-orders/${purchaseOrderId}`);
      }
      return {
        success: true,
        returnPath:
          returnPath && returnPath.startsWith("/") ? returnPath : "/inventory/receipts",
      };
    }
    return {
      error:
        error instanceof Error
          ? translatePrismaError(error).message
          : "Could not save receipt.",
    };
  }
}

export type InventoryProductSearchOption = {
  id: string;
  productCode: string;
  name: string;
  unit: string;
  currentStockQuantity: number;
};

export async function searchInventoryProducts(
  query: string,
): Promise<InventoryProductSearchOption[]> {
  await requirePermission(AppPermission.INVENTORY_VIEW);

  const trimmed = query.trim();
  return withDatabaseRetry((client) =>
    client.product.findMany({
      where: {
        trackInventory: true,
        status: "ACTIVE",
        ...(trimmed
          ? {
              OR: [
                { productCode: { contains: trimmed, mode: "insensitive" } },
                { name: { contains: trimmed, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { productCode: "asc" },
      take: 20,
      select: {
        id: true,
        productCode: true,
        name: true,
        unit: true,
        currentStockQuantity: true,
      },
    }),
  );
}
