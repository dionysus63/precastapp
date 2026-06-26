"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { parseCastingSupplierOrigin } from "@/lib/casting-utils";
import { prisma, withDatabaseRetry } from "@/lib/prisma";

function revalidateCastingSupplierPaths() {
  revalidatePath("/settings/casting-suppliers");
  revalidatePath("/settings");
  revalidatePath("/products");
  revalidatePath("/products/new");
}

export async function createCastingSupplierFormAction(formData: FormData) {
  await requirePermission(AppPermission.SETTINGS_MANAGE);

  const name = String(formData.get("name") ?? "").trim();
  const originRaw = String(formData.get("origin") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const sortOrderRaw = String(formData.get("sortOrder") ?? "0").trim();
  const sortOrder = Number(sortOrderRaw);

  if (!name) {
    redirect(
      `/settings/casting-suppliers?error=${encodeURIComponent("Supplier name is required.")}`,
    );
  }

  const origin = parseCastingSupplierOrigin(originRaw);
  if (!origin) {
    redirect(
      `/settings/casting-suppliers?error=${encodeURIComponent("Choose domestic or imported.")}`,
    );
  }

  try {
    await withDatabaseRetry((client) =>
      client.castingSupplier.create({
        data: {
          name,
          origin,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
          notes,
        },
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create supplier.";
    redirect(`/settings/casting-suppliers?error=${encodeURIComponent(message)}`);
  }

  revalidateCastingSupplierPaths();
  redirect("/settings/casting-suppliers?success=1");
}

export async function updateCastingSupplierFormAction(formData: FormData) {
  await requirePermission(AppPermission.SETTINGS_MANAGE);

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const originRaw = String(formData.get("origin") ?? "").trim();
  const status = String(formData.get("status") ?? "ACTIVE").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const sortOrderRaw = String(formData.get("sortOrder") ?? "0").trim();
  const sortOrder = Number(sortOrderRaw);

  if (!id || !name) {
    redirect(
      `/settings/casting-suppliers?error=${encodeURIComponent("Supplier id and name are required.")}`,
    );
  }

  const origin = parseCastingSupplierOrigin(originRaw);
  if (!origin) {
    redirect(
      `/settings/casting-suppliers?error=${encodeURIComponent("Choose domestic or imported.")}`,
    );
  }

  if (status !== "ACTIVE" && status !== "INACTIVE") {
    redirect(
      `/settings/casting-suppliers?error=${encodeURIComponent("Invalid status.")}`,
    );
  }

  try {
    await withDatabaseRetry((client) =>
      client.castingSupplier.update({
        where: { id },
        data: {
          name,
          origin,
          status,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
          notes,
        },
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update supplier.";
    redirect(`/settings/casting-suppliers?error=${encodeURIComponent(message)}`);
  }

  revalidateCastingSupplierPaths();
  redirect("/settings/casting-suppliers?success=1");
}

export async function listCastingSuppliersForForm() {
  await requirePermission(AppPermission.SETTINGS_VIEW);
  return withDatabaseRetry((client) =>
    client.castingSupplier.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, origin: true },
    }),
  );
}
