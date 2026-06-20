"use server";

import { revalidatePath } from "next/cache";
import { adjustInventory } from "@/lib/inventory-service";
import { withDatabaseRetry } from "@/lib/prisma";

export async function saveInventoryAdjustment(formData: FormData) {
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

  const transactionDate = dateRaw ? new Date(dateRaw) : new Date();
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
