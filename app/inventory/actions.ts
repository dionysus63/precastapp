"use server";

import { revalidatePath } from "next/cache";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { adjustInventory, savePurchaseReceiptEntry } from "@/lib/inventory-service";
import { withDatabaseRetry } from "@/lib/prisma";

export async function saveInventoryAdjustment(formData: FormData) {
  await requirePermission(AppPermission.INVENTORY_MANAGE);
  const productId = String(formData.get("productId") ?? "").trim();
  const quantityChange = Number(formData.get("quantityChange"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const enteredBy = String(formData.get("enteredBy") ?? "").trim() || null;
  const dateRaw = String(formData.get("transactionDate") ?? "").trim();

  if (!productId) {
    return { error: "Product is required." };
  }

  if (!Number.isFinite(quantityChange) || quantityChange === 0) {
    return { error: "Enter a non-zero adjustment quantity." };
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
      }),
    );

    revalidatePath("/inventory");
    revalidatePath(`/inventory/${productId}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not save adjustment.",
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

  const productIds = formData.getAll("productId").map(String);
  const quantities = formData.getAll("quantityReceived").map(String);

  const lines: { productId: string; quantityReceived: number }[] = [];
  for (let index = 0; index < productIds.length; index += 1) {
    const productId = productIds[index]?.trim();
    const qty = Number(quantities[index]);
    if (productId && Number.isFinite(qty) && qty > 0) {
      lines.push({ productId, quantityReceived: qty });
    }
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
          lines: txLines,
        });
      });
    });

    revalidatePath("/inventory");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not save receipt.",
    };
  }
}
