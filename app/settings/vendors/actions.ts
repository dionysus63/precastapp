"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppPermission, type ReceivingCategory } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { parseReceivingCategory } from "@/lib/receiving-utils";
import { withDatabaseRetry } from "@/lib/prisma";
import { translatePrismaError } from "@/lib/server/action-errors";

/** The address and contact fields, blank ones stored as empty (null). */
function parseVendorContact(formData: FormData) {
  const field = (name: string) =>
    String(formData.get(name) ?? "").trim() || null;
  return {
    address: field("address"),
    city: field("city"),
    state: field("state"),
    zip: field("zip"),
    phone: field("phone"),
    email: field("email"),
    contactName: field("contactName"),
  };
}

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
          ...parseVendorContact(formData),
          notes,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
          defaultCategory: defaultCategory as ReceivingCategory | null,
        },
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? translatePrismaError(error).message : "Could not create vendor.";
    redirect(`/settings/vendors?error=${encodeURIComponent(message)}`);
  }

  revalidateVendorPaths();
  redirect("/settings/vendors?success=1");
}

export type CreatedVendor = {
  id: string;
  name: string;
  defaultCategory: ReceivingCategory | null;
};

/**
 * Adds a vendor without leaving the screen that needs one (the purchase
 * order editor): same fields and permission as the form above, but the new
 * vendor comes back instead of a redirect to Settings.
 */
export async function createVendorInPlace(
  formData: FormData,
): Promise<{ vendor: CreatedVendor } | { error: string }> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Vendor name is required." };
  }
  const categoryRaw = String(formData.get("defaultCategory") ?? "").trim();
  const defaultCategory = categoryRaw ? parseReceivingCategory(categoryRaw) : null;
  if (categoryRaw && !defaultCategory) {
    return { error: "Invalid default category." };
  }

  try {
    const vendor = await withDatabaseRetry(async (client) => {
      const existing = await client.vendor.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { name: true, status: true },
      });
      if (existing) {
        throw new Error(
          existing.status === "ACTIVE"
            ? `${existing.name} is already a vendor. Pick it from the list.`
            : `${existing.name} is already a vendor, but switched off. Switch it back on in Settings, Vendors.`,
        );
      }
      return client.vendor.create({
        data: {
          name,
          ...parseVendorContact(formData),
          defaultCategory: defaultCategory as ReceivingCategory | null,
        },
        select: { id: true, name: true, defaultCategory: true },
      });
    });
    revalidateVendorPaths();
    return { vendor };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? translatePrismaError(error).message
          : "Could not create vendor.",
    };
  }
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
          ...parseVendorContact(formData),
          notes,
          status,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
          defaultCategory: defaultCategory as ReceivingCategory | null,
        },
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? translatePrismaError(error).message : "Could not update vendor.";
    redirect(`/settings/vendors?error=${encodeURIComponent(message)}`);
  }

  revalidateVendorPaths();
  redirect("/settings/vendors?success=1");
}
