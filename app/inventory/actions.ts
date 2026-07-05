"use server";

import { revalidatePath } from "next/cache";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import {
  adjustInventory,
  isDuplicateSubmission,
  savePurchaseReceiptEntry,
} from "@/lib/inventory-service";
import { withDatabaseRetry } from "@/lib/prisma";
import { translatePrismaError } from "@/lib/server/action-errors";

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
          supplierId,
          enteredBy,
          notes,
          batchLabel,
          submissionKey,
          lines: txLines,
        });
      });
    });

    revalidatePath("/inventory");
    revalidatePath("/inventory/receipts");
    return { success: true };
  } catch (error) {
    // The same submission already landed (double-click / retry) — success.
    if (isDuplicateSubmission(error)) {
      revalidatePath("/inventory");
      return { success: true };
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
