"use server";

import { revalidatePath } from "next/cache";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { withDatabaseRetry } from "@/lib/prisma";

const PAGE_PATH = "/settings/product-groups";

function parseSortOrder(raw: FormDataEntryValue | null): number {
  const parsed = Number(String(raw ?? "").trim());
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

export async function createProductGroupFormAction(
  formData: FormData,
): Promise<void> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const name = String(formData.get("name") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "").trim() || null;
  if (!name) {
    return;
  }
  try {
    await withDatabaseRetry((client) =>
      client.productGroup.create({
        data: { name, parentId, sortOrder: parseSortOrder(formData.get("sortOrder")) },
      }),
    );
  } catch {
    // Duplicate name under the same parent — leave the page unchanged.
    return;
  }
  revalidatePath(PAGE_PATH);
}

export async function updateProductGroupFormAction(
  formData: FormData,
): Promise<void> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) {
    return;
  }
  try {
    await withDatabaseRetry((client) =>
      client.productGroup.update({
        where: { id },
        data: { name, sortOrder: parseSortOrder(formData.get("sortOrder")) },
      }),
    );
  } catch {
    return;
  }
  revalidatePath(PAGE_PATH);
}

/** Deletes the group, its sub-groups, and all memberships (cascade). */
export async function deleteProductGroupFormAction(
  formData: FormData,
): Promise<void> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return;
  }
  await withDatabaseRetry((client) =>
    client.productGroup.delete({ where: { id } }),
  );
  revalidatePath(PAGE_PATH);
}

/** Adds every checked product in one submit (duplicates are skipped). */
export async function addProductGroupMembersFormAction(
  formData: FormData,
): Promise<void> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const groupId = String(formData.get("groupId") ?? "").trim();
  const productIds = formData
    .getAll("productIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
  if (!groupId || productIds.length === 0) {
    return;
  }
  await withDatabaseRetry((client) =>
    client.productGroupMember.createMany({
      data: productIds.map((productId) => ({ groupId, productId })),
      skipDuplicates: true,
    }),
  );
  revalidatePath(PAGE_PATH);
}

export async function addProductGroupMemberFormAction(
  formData: FormData,
): Promise<void> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const groupId = String(formData.get("groupId") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();
  if (!groupId || !productId) {
    return;
  }
  await withDatabaseRetry((client) =>
    client.productGroupMember.upsert({
      where: { groupId_productId: { groupId, productId } },
      create: { groupId, productId },
      update: {},
    }),
  );
  revalidatePath(PAGE_PATH);
}

export async function removeProductGroupMemberFormAction(
  formData: FormData,
): Promise<void> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return;
  }
  await withDatabaseRetry((client) =>
    client.productGroupMember.delete({ where: { id } }),
  );
  revalidatePath(PAGE_PATH);
}
