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

/** Adds every checked product in one submit (duplicates are skipped),
 * appended after the group's existing members. */
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
  await withDatabaseRetry(async (client) => {
    const last = await client.productGroupMember.aggregate({
      where: { groupId },
      _max: { sortOrder: true },
    });
    const start = (last._max.sortOrder ?? -1) + 1;
    await client.productGroupMember.createMany({
      data: productIds.map((productId, index) => ({
        groupId,
        productId,
        sortOrder: start + index,
      })),
      skipDuplicates: true,
    });
  });
  revalidatePath(PAGE_PATH);
}

/** Moves a member one step left/right in its group's display order. */
export async function moveProductGroupMemberFormAction(
  formData: FormData,
): Promise<void> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const id = String(formData.get("id") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();
  if (!id || (direction !== "up" && direction !== "down")) {
    return;
  }
  await withDatabaseRetry(async (client) => {
    const member = await client.productGroupMember.findUnique({
      where: { id },
      select: { id: true, groupId: true },
    });
    if (!member) {
      return;
    }
    // Renumber 0..n-1 first so legacy all-zero rows get distinct positions,
    // then swap with the neighbor.
    const members = await client.productGroupMember.findMany({
      where: { groupId: member.groupId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const index = members.findIndex((entry) => entry.id === id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= members.length) {
      return;
    }
    const reordered = [...members];
    [reordered[index], reordered[target]] = [
      reordered[target]!,
      reordered[index]!,
    ];
    await client.$transaction(
      reordered.map((entry, position) =>
        client.productGroupMember.update({
          where: { id: entry.id },
          data: { sortOrder: position },
        }),
      ),
    );
  });
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
