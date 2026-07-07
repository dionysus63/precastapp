"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppPermission, type ReceivingCategory } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { parseReceivingCategory } from "@/lib/receiving-utils";
import { withDatabaseRetry } from "@/lib/prisma";

function revalidateVendorPaths() {
  revalidatePath("/settings/vendors");
  revalidatePath("/settings");
  revalidatePath("/purchase-orders");
  revalidatePath("/purchase-orders/new");
}

export async function createVendorFormAction(formData: FormData) {
  await requirePermission(AppPermission.SETTINGS_MANAGE);

  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const sortOrderRaw = String(formData.get("sortOrder") ?? "0").trim();
  const sortOrder = Number(sortOrderRaw);
  const categoryRaw = String(formData.get("defaultCategory") ?? "").trim();
  const defaultCategory = categoryRaw
    ? parseReceivingCategory(categoryRaw)
    : null;

  if (!name) {
    redirect(
      `/settings/vendors?error=${encodeURIComponent("Vendor name is required.")}`,
    );
  }

  if (categoryRaw && !defaultCategory) {
    redirect(
      `/settings/vendors?error=${encodeURIComponent("Invalid default category.")}`,
    );
  }

  try {
    await withDatabaseRetry((client) =>
      client.vendor.create({
        data: {
          name,
          notes,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
          defaultCategory: defaultCategory as ReceivingCategory | null,
        },
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create vendor.";
    redirect(`/settings/vendors?error=${encodeURIComponent(message)}`);
  }

  revalidateVendorPaths();
  redirect("/settings/vendors?success=1");
}

export async function updateVendorFormAction(formData: FormData) {
  await requirePermission(AppPermission.SETTINGS_MANAGE);

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const sortOrderRaw = String(formData.get("sortOrder") ?? "0").trim();
  const sortOrder = Number(sortOrderRaw);
  const status = String(formData.get("status") ?? "ACTIVE").trim();
  const categoryRaw = String(formData.get("defaultCategory") ?? "").trim();
  const defaultCategory = categoryRaw
    ? parseReceivingCategory(categoryRaw)
    : null;

  if (!id || !name) {
    redirect(
      `/settings/vendors?error=${encodeURIComponent("Vendor id and name are required.")}`,
    );
  }

  if (status !== "ACTIVE" && status !== "INACTIVE") {
    redirect(
      `/settings/vendors?error=${encodeURIComponent("Invalid status.")}`,
    );
  }

  if (categoryRaw && !defaultCategory) {
    redirect(
      `/settings/vendors?error=${encodeURIComponent("Invalid default category.")}`,
    );
  }

  try {
    await withDatabaseRetry((client) =>
      client.vendor.update({
        where: { id },
        data: {
          name,
          notes,
          status,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
          defaultCategory: defaultCategory as ReceivingCategory | null,
        },
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update vendor.";
    redirect(`/settings/vendors?error=${encodeURIComponent(message)}`);
  }

  revalidateVendorPaths();
  redirect("/settings/vendors?success=1");
}
