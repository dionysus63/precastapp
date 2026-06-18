"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const PRODUCT_STATUSES = ["ACTIVE", "INACTIVE", "DISCONTINUED"] as const;

type ProductStatus = (typeof PRODUCT_STATUSES)[number];

function parseRequiredString(formData: FormData, field: string, label: string) {
  const value = String(formData.get(field) ?? "").trim();
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function parseOptionalNonNegativeDecimal(
  formData: FormData,
  field: string,
  label: string,
): Prisma.Decimal | null {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`${label} must be a number.`);
  }
  if (value < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  return new Prisma.Decimal(raw);
}

function parseNonNegativeInt(
  formData: FormData,
  field: string,
  label: string,
  defaultValue: number,
) {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) {
    return defaultValue;
  }

  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number.`);
  }
  if (value < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  return value;
}

function parseProductStatus(formData: FormData): ProductStatus {
  const status = String(formData.get("status") ?? "ACTIVE").trim();

  if (!PRODUCT_STATUSES.includes(status as ProductStatus)) {
    throw new Error("Invalid product status.");
  }

  return status as ProductStatus;
}

function parseProductFormData(formData: FormData) {
  const productCode = parseRequiredString(formData, "productCode", "Product code");
  const productName = parseRequiredString(formData, "productName", "Product name");

  const unit = String(formData.get("unit") ?? "EA").trim() || "EA";
  const status = parseProductStatus(formData);

  const category = String(formData.get("category") ?? "").trim() || "Vaults";
  const subcategory = String(formData.get("subcategory") ?? "").trim() || null;
  const trackInventory = String(formData.get("trackInventory") ?? "yes") === "yes";
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const defaultPrice = parseOptionalNonNegativeDecimal(
    formData,
    "defaultPrice",
    "Default price",
  );
  const weight = parseOptionalNonNegativeDecimal(formData, "weight", "Weight");
  const yards = parseOptionalNonNegativeDecimal(formData, "yards", "Yards");

  const currentStockQuantity = parseNonNegativeInt(
    formData,
    "currentStockQuantity",
    "Current stock quantity",
    0,
  );
  const reorderLevel = parseNonNegativeInt(
    formData,
    "reorderLevel",
    "Reorder level",
    0,
  );

  return {
    productCode,
    productName,
    category,
    subcategory,
    unit,
    defaultPrice,
    weight,
    yards,
    trackInventory,
    currentStockQuantity,
    reorderLevel,
    status,
    notes,
  };
}

export async function createProduct(formData: FormData) {
  const data = parseProductFormData(formData);

  await prisma.product.create({ data });

  revalidatePath("/products");
  redirect("/products");
}

type BulkImportRow = {
  productCode: string;
  productName: string;
  category: string;
  subcategory: string;
  unit: string;
  defaultPrice: string;
  weight: string;
  yards: string;
  trackInventory: string;
};

function parseBulkNumeric(
  raw: string,
  label: string,
  lineNumber: number,
): Prisma.Decimal | null {
  const cleaned = raw.replace(/[$,]/g, "").replace(/[^\d.]/g, "").trim();
  if (!cleaned) {
    return null;
  }

  const value = Number(cleaned);
  if (Number.isNaN(value)) {
    throw new Error(`Line ${lineNumber}: ${label} must be a number.`);
  }
  if (value < 0) {
    throw new Error(`Line ${lineNumber}: ${label} cannot be negative.`);
  }

  return new Prisma.Decimal(cleaned);
}

function mapBulkImportRow(row: BulkImportRow, lineNumber: number) {
  const productCode = row.productCode.trim();
  const productName = row.productName.trim();

  if (!productCode) {
    throw new Error(`Line ${lineNumber}: Product code is required.`);
  }
  if (!productName) {
    throw new Error(`Line ${lineNumber}: Product name is required.`);
  }

  const unit = row.unit.trim() || "EA";
  const category = row.category.trim() || "Vaults";
  const subcategory = row.subcategory.trim() || null;

  const inventoryValue = row.trackInventory.trim().toLowerCase();
  if (inventoryValue && inventoryValue !== "yes" && inventoryValue !== "no") {
    throw new Error(
      `Line ${lineNumber}: Track inventory must be "Yes" or "No".`,
    );
  }
  const trackInventory = inventoryValue !== "no";

  return {
    productCode,
    productName,
    category,
    subcategory,
    unit: unit === "Each" ? "EA" : unit,
    defaultPrice: parseBulkNumeric(row.defaultPrice, "Default price", lineNumber),
    weight: parseBulkNumeric(row.weight, "Weight", lineNumber),
    yards: parseBulkNumeric(row.yards, "Yards", lineNumber),
    trackInventory,
    currentStockQuantity: 0,
    reorderLevel: 0,
    status: "ACTIVE" as ProductStatus,
    notes: null,
  };
}

export async function importProducts(formData: FormData) {
  const raw = String(formData.get("products") ?? "").trim();
  if (!raw) {
    throw new Error("No products to import.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid import data.");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("No products to import.");
  }

  const uniqueRows = new Map<string, ReturnType<typeof mapBulkImportRow>>();

  parsed.forEach((row, index) => {
    const mapped = mapBulkImportRow(row as BulkImportRow, index + 1);
    uniqueRows.set(mapped.productCode, mapped);
  });

  const products = [...uniqueRows.values()];

  await prisma.$transaction(
    products.map((product) => prisma.product.create({ data: product })),
  );

  revalidatePath("/products");
  redirect("/products");
}
