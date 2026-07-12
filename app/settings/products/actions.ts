"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppPermission, Prisma } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import {
  parseCategoryDefaultProductKind,
  parseCategoryProductType,
} from "@/lib/product-taxonomy";
import { withDatabaseRetry } from "@/lib/prisma";
import {
  isNextRedirectError,
  translatePrismaError,
} from "@/lib/server/action-errors";

function revalidateProductTaxonomyPaths() {
  revalidatePath("/settings/products");
  revalidatePath("/settings");
  revalidatePath("/products");
  revalidatePath("/products/new");
  revalidatePath("/products/bulk");
  revalidatePath("/settings/rings");
}

export async function createProductCategoryFormAction(formData: FormData) {
  await requirePermission(AppPermission.SETTINGS_MANAGE);

  const name = String(formData.get("name") ?? "").trim();
  const sortOrderRaw = String(formData.get("sortOrder") ?? "0").trim();
  const sortOrder = Number(sortOrderRaw);
  const defaultProductKind = parseCategoryDefaultProductKind(
    String(formData.get("defaultProductKind") ?? ""),
  );
  const productType = parseCategoryProductType(
    String(formData.get("productType") ?? ""),
  );

  if (!name) {
    redirect(
      `/settings/products?error=${encodeURIComponent("Category name is required.")}`,
    );
  }

  if (!productType) {
    redirect(
      `/settings/products?error=${encodeURIComponent("Product type is required.")}`,
    );
  }

  try {
    await withDatabaseRetry((client) =>
      client.productCategory.create({
        data: {
          name,
          productType,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
          defaultProductKind,
        },
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create category.";
    redirect(`/settings/products?error=${encodeURIComponent(message)}`);
  }

  revalidateProductTaxonomyPaths();
  redirect("/settings/products?success=1");
}

export async function updateProductCategoryFormAction(formData: FormData) {
  await requirePermission(AppPermission.SETTINGS_MANAGE);

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const status = String(formData.get("status") ?? "ACTIVE").trim();
  const sortOrderRaw = String(formData.get("sortOrder") ?? "0").trim();
  const sortOrder = Number(sortOrderRaw);
  const defaultProductKind = parseCategoryDefaultProductKind(
    String(formData.get("defaultProductKind") ?? ""),
  );
  const productType = parseCategoryProductType(
    String(formData.get("productType") ?? ""),
  );

  if (!id || !name) {
    redirect(
      `/settings/products?error=${encodeURIComponent("Category id and name are required.")}`,
    );
  }

  if (!productType) {
    redirect(
      `/settings/products?error=${encodeURIComponent("Product type is required.")}`,
    );
  }

  if (status !== "ACTIVE" && status !== "INACTIVE") {
    redirect(
      `/settings/products?error=${encodeURIComponent("Invalid status.")}`,
    );
  }

  try {
    await withDatabaseRetry((client) =>
      client.productCategory.update({
        where: { id },
        data: {
          name,
          productType,
          status,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
          defaultProductKind,
        },
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update category.";
    redirect(`/settings/products?error=${encodeURIComponent(message)}`);
  }

  revalidateProductTaxonomyPaths();
  redirect("/settings/products?success=1");
}

export async function createProductSubcategoryFormAction(formData: FormData) {
  await requirePermission(AppPermission.SETTINGS_MANAGE);

  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const sortOrderRaw = String(formData.get("sortOrder") ?? "0").trim();
  const sortOrder = Number(sortOrderRaw);

  if (!categoryId || !name) {
    redirect(
      `/settings/products?error=${encodeURIComponent("Category and subcategory name are required.")}`,
    );
  }

  try {
    await withDatabaseRetry((client) =>
      client.productSubcategory.create({
        data: {
          categoryId,
          name,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        },
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create subcategory.";
    redirect(`/settings/products?error=${encodeURIComponent(message)}`);
  }

  revalidateProductTaxonomyPaths();
  redirect("/settings/products?success=1");
}

export async function updateProductSubcategoryFormAction(formData: FormData) {
  await requirePermission(AppPermission.SETTINGS_MANAGE);

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const sortOrderRaw = String(formData.get("sortOrder") ?? "0").trim();
  const sortOrder = Number(sortOrderRaw);

  if (!id || !name) {
    redirect(
      `/settings/products?error=${encodeURIComponent("Subcategory id and name are required.")}`,
    );
  }

  try {
    await withDatabaseRetry((client) =>
      client.productSubcategory.update({
        where: { id },
        data: {
          name,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        },
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update subcategory.";
    redirect(`/settings/products?error=${encodeURIComponent(message)}`);
  }

  revalidateProductTaxonomyPaths();
  redirect("/settings/products?success=1");
}

export async function deleteProductCategory(
  formData: FormData,
): Promise<{ error: string } | void> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { error: "Category id is required." };
  }

  try {
    await withDatabaseRetry((client) =>
      client.$transaction(async (tx) => {
        const category = await tx.productCategory.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            _count: {
              select: { products: true, subcategories: true },
            },
          },
        });

        if (!category) {
          throw new Error("Category was not found.");
        }

        if (category._count.products > 0) {
          throw new Error(
            `Cannot delete "${category.name}" — ${category._count.products} product${category._count.products === 1 ? "" : "s"} assigned to it. Reassign or remove those products first.`,
          );
        }

        if (category._count.subcategories > 0) {
          throw new Error(
            `Cannot delete "${category.name}" — delete its ${category._count.subcategories} subcategor${category._count.subcategories === 1 ? "y" : "ies"} first.`,
          );
        }

        await tx.productCategory.delete({ where: { id } });
      }),
    );

    revalidateProductTaxonomyPaths();
    redirect("/settings/products?success=1");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return {
        error:
          "This category is referenced by other records and cannot be deleted.",
      };
    }
    return { error: translatePrismaError(error).message };
  }
}

export async function deleteProductSubcategory(
  formData: FormData,
): Promise<{ error: string } | void> {
  await requirePermission(AppPermission.SETTINGS_MANAGE);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { error: "Subcategory id is required." };
  }

  try {
    await withDatabaseRetry((client) =>
      client.$transaction(async (tx) => {
        const subcategory = await tx.productSubcategory.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            category: { select: { name: true } },
            _count: { select: { products: true } },
          },
        });

        if (!subcategory) {
          throw new Error("Subcategory was not found.");
        }

        await tx.productSubcategory.delete({ where: { id } });
      }),
    );

    revalidateProductTaxonomyPaths();
    redirect("/settings/products?success=1");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return {
        error:
          "This subcategory is referenced by other records and cannot be deleted.",
      };
    }
    return { error: translatePrismaError(error).message };
  }
}

export async function listActiveCastingSuppliersForBulkImport() {
  await requirePermission(AppPermission.PRODUCTS_MANAGE);
  return withDatabaseRetry((client) =>
    client.castingSupplier.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, origin: true },
    }),
  );
}
